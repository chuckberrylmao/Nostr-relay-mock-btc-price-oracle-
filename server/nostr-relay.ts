import { WebSocketServer, WebSocket } from "ws";
import { verifyEvent as nostrVerifyEvent, generateSecretKey, getPublicKey, finalizeEvent } from "nostr-tools";
import type { Server } from "http";
import { log } from "./index";
import { KIND_PRICE_REQ, KIND_PRICE_RES, KIND_PRICE_ERR, type NostrEvent, type PriceSample } from "@shared/schema";

const MIN_QUORUM = Number(process.env.MIN_QUORUM ?? 3);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 2500);
const FETCH_RETRIES = Number(process.env.FETCH_RETRIES ?? 1);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS ?? 2000);
const MAX_REQUEST_MAXAGE_MS = Number(process.env.MAX_REQUEST_MAXAGE_MS ?? 60000);
const MAX_EVENT_BYTES = Number(process.env.MAX_EVENT_BYTES ?? 64_000);
const MAX_STORED_EVENTS = Number(process.env.MAX_STORED_EVENTS ?? 10_000);
const RATE_IP_RPS = Number(process.env.RATE_IP_RPS ?? 3);
const RATE_PUBKEY_RPS = Number(process.env.RATE_PUBKEY_RPS ?? 2);
const RATE_BURST = Number(process.env.RATE_BURST ?? 10);

let RELAY_SECRET_KEY: Uint8Array | null = null;
let RELAY_PUBKEY_HEX = "";

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getTag(evt: NostrEvent, name: string): string | null {
  for (const t of evt.tags ?? []) {
    if (t[0] === name && t[1]) return t[1];
  }
  return null;
}

function verifyEvent(evt: any): boolean {
  if (!evt || typeof evt !== "object") {
    log("verifyEvent: not an object", "nostr");
    return false;
  }
  if (!evt.id || !evt.pubkey || !evt.sig) {
    log("verifyEvent: missing id, pubkey, or sig", "nostr");
    return false;
  }

  try {
    const valid = nostrVerifyEvent(evt);
    if (!valid) {
      log(`verifyEvent: nostr-tools verification failed`, "nostr");
    }
    return valid;
  } catch (e: any) {
    log(`verifyEvent: exception - ${e.message}`, "nostr");
    return false;
  }
}

function signEvent(params: { kind: number; tags: string[][]; content: string }): NostrEvent {
  if (!RELAY_SECRET_KEY) {
    throw new Error("Relay secret key not initialized");
  }
  const created_at = nowSec();
  const eventTemplate = {
    kind: params.kind,
    created_at,
    tags: params.tags,
    content: params.content,
  };
  const signedEvent = finalizeEvent(eventTemplate, RELAY_SECRET_KEY);
  return signedEvent as unknown as NostrEvent;
}

function median(values: number[]): number {
  const arr = [...values].sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function aggregate(samples: PriceSample[], method: string): { value: number; method: string; used: PriceSample[] } {
  const values = samples.map((s) => s.value);
  if (!values.length) throw new Error("no samples");

  if (method === "trimmed_mean" && samples.length >= 5) {
    const sorted = [...samples].sort((a, b) => a.value - b.value);
    const used = sorted.slice(1, -1);
    return { value: mean(used.map((s) => s.value)), method: "trimmed_mean", used };
  }

  if (samples.length >= 3) {
    return { value: median(values), method: "median", used: samples };
  }

  return { value: mean(values), method: "mean", used: samples };
}

class RateLimiter {
  buckets = new Map<string, { tokens: number; last: number }>();
  constructor(private rps: number, private burst: number) {}

  allow(key: string, nowMs = Date.now()): boolean {
    const b = this.buckets.get(key) ?? { tokens: this.burst, last: nowMs };
    const elapsed = (nowMs - b.last) / 1000;
    b.last = nowMs;
    b.tokens = Math.min(this.burst, b.tokens + elapsed * this.rps);
    if (b.tokens < 1) {
      this.buckets.set(key, b);
      return false;
    }
    b.tokens -= 1;
    this.buckets.set(key, b);
    return true;
  }
}

const ipLimiter = new RateLimiter(RATE_IP_RPS, RATE_BURST);
const pubLimiter = new RateLimiter(RATE_PUBKEY_RPS, RATE_BURST);

let priceCache: { tsMs: number; samples: PriceSample[] } | null = null;

function cacheGet(): { tsMs: number; samples: PriceSample[]; ageMs: number } | null {
  if (!priceCache) return null;
  const ageMs = Date.now() - priceCache.tsMs;
  if (ageMs > CACHE_TTL_MS) return null;
  return { ...priceCache, ageMs };
}

function cacheSet(samples: PriceSample[]): void {
  priceCache = { tsMs: Date.now(), samples };
}

async function fetchJson(url: string, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function withRetries<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function fetchPrice(source: string): Promise<PriceSample> {
  const ts = Date.now();

  return withRetries(async () => {
    switch (source) {
      case "coinbase": {
        const j = await fetchJson("https://api.exchange.coinbase.com/products/BTC-USD/ticker", FETCH_TIMEOUT_MS);
        const price = Number(j.price);
        if (!Number.isFinite(price)) throw new Error("bad price");
        return { source, value: price, ts };
      }
      case "kraken": {
        const j = await fetchJson("https://api.kraken.com/0/public/Ticker?pair=XBTUSD", FETCH_TIMEOUT_MS);
        const obj = j?.result?.XXBTZUSD;
        const price = Number(obj?.c?.[0]);
        if (!Number.isFinite(price)) throw new Error("bad price");
        return { source, value: price, ts };
      }
      case "coingecko": {
        const j = await fetchJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", FETCH_TIMEOUT_MS);
        const price = Number(j?.bitcoin?.usd);
        if (!Number.isFinite(price)) throw new Error("bad price");
        return { source, value: price, ts };
      }
      case "bitstamp": {
        const j = await fetchJson("https://www.bitstamp.net/api/v2/ticker/btcusd", FETCH_TIMEOUT_MS);
        const price = Number(j?.last);
        if (!Number.isFinite(price)) throw new Error("bad price");
        return { source, value: price, ts };
      }
      default:
        throw new Error("unknown source");
    }
  }, FETCH_RETRIES);
}

const ALL_SOURCES = ["coinbase", "kraken", "coingecko", "bitstamp"];

const events: NostrEvent[] = [];

function storeEvent(evt: NostrEvent): void {
  events.push(evt);
  if (events.length > MAX_STORED_EVENTS) events.splice(0, events.length - MAX_STORED_EVENTS);
}

interface NostrFilter {
  ids?: string[];
  kinds?: number[];
  authors?: string[];
  since?: number;
  until?: number;
  limit?: number;
  [key: string]: any;
}

function matchFilter(evt: NostrEvent, f: NostrFilter): boolean {
  if (f.ids && Array.isArray(f.ids) && !f.ids.includes(evt.id)) return false;
  if (f.kinds && Array.isArray(f.kinds) && !f.kinds.includes(evt.kind)) return false;
  if (f.authors && Array.isArray(f.authors) && !f.authors.includes(evt.pubkey)) return false;
  if (f.since && evt.created_at < f.since) return false;
  if (f.until && evt.created_at > f.until) return false;

  for (const k of Object.keys(f)) {
    if (!k.startsWith("#")) continue;
    const tagName = k.slice(1);
    const want = f[k] ?? [];
    const have = (evt.tags ?? []).filter((t) => t[0] === tagName).map((t) => t[1]);
    if (!want.some((x: string) => have.includes(x))) return false;
  }

  return true;
}

function queryEvents(filters: NostrFilter[]): NostrEvent[] {
  const out: NostrEvent[] = [];
  for (const f of filters) {
    const limit = Math.min(Number(f.limit ?? 200), 2000);
    const matched: NostrEvent[] = [];
    for (let i = events.length - 1; i >= 0 && matched.length < limit; i--) {
      const e = events[i];
      if (matchFilter(e, f)) matched.push(e);
    }
    out.push(...matched);
  }
  return out;
}

function ensureRelayKeys(): void {
  if (RELAY_SECRET_KEY && RELAY_PUBKEY_HEX) return;

  RELAY_SECRET_KEY = generateSecretKey();
  RELAY_PUBKEY_HEX = getPublicKey(RELAY_SECRET_KEY);

  log("Generated relay keypair", "nostr");
  log(`RELAY_PUBKEY_HEX=${RELAY_PUBKEY_HEX}`, "nostr");
}

export function getRelayInfo() {
  return {
    name: "BTC Average Price Relay",
    description: "Research relay: queries BTC price from multiple public sources and emits signed responses.",
    pubkey: RELAY_PUBKEY_HEX,
    contact: "nostr:research-demo",
    supported_nips: [1, 11],
    software: "btc-price-nostr-relay",
    version: "1.1.0",
    limitations: {
      max_message_length: MAX_EVENT_BYTES,
      max_subscriptions: 50,
      max_filters: 10,
      max_limit: 2000,
    },
  };
}

interface ExtendedWebSocket extends WebSocket {
  subs: Map<string, NostrFilter[]>;
  ip: string;
}

let wss: WebSocketServer | null = null;

function send(ws: WebSocket, msg: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(msg: any): void {
  if (!wss) return;
  const s = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(s);
    }
  }
}

export function setupNostrRelay(httpServer: Server): void {
  ensureRelayKeys();

  wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  log("WebSocket relay ready at /ws", "nostr");

  wss.on("connection", (ws: WebSocket, req) => {
    const extWs = ws as ExtendedWebSocket;
    extWs.subs = new Map();
    extWs.ip = req.socket.remoteAddress ?? "unknown";
    send(ws, ["NOTICE", "connected"]);
    log(`Client connected from ${extWs.ip}`, "nostr");
  });

  wss.on("connection", (ws: WebSocket) => {
    const extWs = ws as ExtendedWebSocket;

    ws.on("message", async (raw) => {
      if (raw.toString().length > MAX_EVENT_BYTES) {
        send(ws, ["NOTICE", "payload too large"]);
        return;
      }

      const txt = raw.toString("utf8");
      const msg = safeJsonParse(txt);
      if (!Array.isArray(msg) || msg.length < 2) return;

      const type = msg[0];

      if (type === "EVENT") {
        const evt = msg[1] as NostrEvent;

        const ok = await verifyEvent(evt);
        if (!ok) {
          send(ws, ["OK", evt?.id ?? "", false, "invalid: bad sig or id"]);
          return;
        }

        if (!ipLimiter.allow(`ip:${extWs.ip}`)) {
          send(ws, ["OK", evt.id, false, "rate limited (ip)"]);
          return;
        }
        if (!pubLimiter.allow(`pub:${evt.pubkey}`)) {
          send(ws, ["OK", evt.id, false, "rate limited (pubkey)"]);
          return;
        }

        storeEvent(evt);
        send(ws, ["OK", evt.id, true, "accepted"]);

        if (evt.kind === KIND_PRICE_REQ) {
          const body = safeJsonParse(evt.content) ?? {};
          const pair = body.pair ?? getTag(evt, "pair") ?? "BTC-USD";
          const method = String(body.method ?? "trimmed_mean");
          const maxAgeMsReq = Number(body.maxAgeMs ?? 20_000);
          const maxAgeMs = Math.min(maxAgeMsReq, MAX_REQUEST_MAXAGE_MS);

          log(`Price request from ${evt.pubkey.slice(0, 8)}... pair=${pair} method=${method}`, "nostr");

          if (pair !== "BTC-USD") {
            const errEvt = await signEvent({
              kind: KIND_PRICE_ERR,
              tags: [
                ["e", evt.id, "reply"],
                ["p", evt.pubkey],
                ["t", "price-error"],
                ["pair", pair],
              ],
              content: JSON.stringify({ error: "unsupported pair", pair }),
            });
            storeEvent(errEvt);
            broadcast(["EVENT", errEvt]);
            return;
          }

          const cached = cacheGet();
          if (cached && cached.ageMs <= maxAgeMs) {
            const { value, method: usedMethod, used } = aggregate(cached.samples, method);
            const resp = await signEvent({
              kind: KIND_PRICE_RES,
              tags: [
                ["e", evt.id, "reply"],
                ["p", evt.pubkey],
                ["t", "price"],
                ["pair", pair],
                ...used.map((s) => ["src", s.source]),
              ],
              content: JSON.stringify({
                pair,
                ts: Date.now(),
                value,
                method: usedMethod,
                sources_used: used.map((s) => s.source),
                samples: used,
                cache: { hit: true, ageMs: cached.ageMs },
              }),
            });
            storeEvent(resp);
            broadcast(["EVENT", resp]);
            log(`Price response (cached): $${value.toFixed(2)}`, "nostr");
            return;
          }

          const wantedSources = Array.isArray(body.sources) ? body.sources.filter((s: string) => ALL_SOURCES.includes(s)) : ALL_SOURCES;
          const sources = wantedSources.length ? wantedSources : ALL_SOURCES;

          const results = await Promise.allSettled(sources.map((s: string) => fetchPrice(s)));
          const samples = results.filter((r): r is PromiseFulfilledResult<PriceSample> => r.status === "fulfilled").map((r) => r.value);

          if (samples.length < MIN_QUORUM) {
            const errEvt = await signEvent({
              kind: KIND_PRICE_ERR,
              tags: [
                ["e", evt.id, "reply"],
                ["p", evt.pubkey],
                ["t", "price-error"],
                ["pair", pair],
              ],
              content: JSON.stringify({
                error: "insufficient quorum",
                need: MIN_QUORUM,
                got: samples.length,
                sources_requested: sources,
              }),
            });
            storeEvent(errEvt);
            broadcast(["EVENT", errEvt]);
            log(`Price error: insufficient quorum (got ${samples.length}/${MIN_QUORUM})`, "nostr");
            return;
          }

          cacheSet(samples);

          const { value, method: usedMethod, used } = aggregate(samples, method);

          const resp = await signEvent({
            kind: KIND_PRICE_RES,
            tags: [
              ["e", evt.id, "reply"],
              ["p", evt.pubkey],
              ["t", "price"],
              ["pair", pair],
              ...used.map((s) => ["src", s.source]),
            ],
            content: JSON.stringify({
              pair,
              ts: Date.now(),
              value,
              method: usedMethod,
              sources_used: used.map((s) => s.source),
              samples: used,
              cache: { hit: false, ageMs: 0 },
            }),
          });

          storeEvent(resp);
          broadcast(["EVENT", resp]);
          log(`Price response: $${value.toFixed(2)} via ${usedMethod}`, "nostr");
        }

        return;
      }

      if (type === "REQ") {
        const subId = msg[1];
        const filters = msg.slice(2) as NostrFilter[];
        extWs.subs.set(subId, filters);

        const found = queryEvents(filters);
        for (const e of found) send(ws, ["EVENT", subId, e]);

        send(ws, ["EOSE", subId]);
        return;
      }

      if (type === "CLOSE") {
        const subId = msg[1];
        extWs.subs.delete(subId);
        return;
      }
    });

    ws.on("close", () => {
      log(`Client disconnected`, "nostr");
    });
  });
}
