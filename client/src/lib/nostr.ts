import { getPublicKey, generateSecretKey, finalizeEvent, type Event } from "nostr-tools";
import { nip19 } from "nostr-tools";
import type { LocalAccount } from "@shared/schema";

const LS_KEY = "btcRelayDemo.account.v1";

function b64encode(u8: Uint8Array): string {
  let s = "";
  u8.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveAesKey(passphrase: string, saltU8: Uint8Array, iterations = 200000): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: saltU8, iterations, hash: "SHA-256" }, keyMat, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecretKey(secretKeyU8: Uint8Array, passphrase: string): Promise<LocalAccount["enc"]> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, secretKeyU8));
  return { salt: b64encode(salt), iv: b64encode(iv), ct: b64encode(ct), kdf: { name: "PBKDF2", iters: 200000 } };
}

export async function decryptSecretKey(blob: LocalAccount["enc"], passphrase: string): Promise<Uint8Array> {
  const salt = b64decode(blob.salt);
  const iv = b64decode(blob.iv);
  const ct = b64decode(blob.ct);
  const iters = blob?.kdf?.iters ?? 200000;
  const key = await deriveAesKey(passphrase, salt, iters);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
  if (pt.length !== 32) throw new Error("bad secret key length");
  return pt;
}

export function loadAccount(): LocalAccount | null {
  const raw = localStorage.getItem(LS_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveAccount(obj: LocalAccount): void {
  localStorage.setItem(LS_KEY, JSON.stringify(obj));
}

export function clearAccount(): void {
  localStorage.removeItem(LS_KEY);
}

export async function createLocalAccount(passphrase: string): Promise<{ account: LocalAccount; secretKey: Uint8Array }> {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  const npub = nip19.npubEncode(pk);

  const enc = await encryptSecretKey(sk, passphrase);
  const account: LocalAccount = {
    npub,
    pubkeyHex: pk,
    enc,
    createdAt: Date.now(),
  };

  saveAccount(account);
  return { account, secretKey: sk };
}

export function createGuestAccount(): { pubkeyHex: string; secretKey: Uint8Array } {
  const sk = generateSecretKey();
  const pk = getPublicKey(sk);
  return { pubkeyHex: pk, secretKey: sk };
}

export function signPriceRequestEvent(secretKey: Uint8Array, pubkey: string): Event {
  const created_at = Math.floor(Date.now() / 1000);
  const eventTemplate = {
    kind: 38000,
    created_at,
    tags: [
      ["t", "price-request"],
      ["pair", "BTC-USD"],
    ],
    content: JSON.stringify({
      pair: "BTC-USD",
      method: "trimmed_mean",
      sources: ["coinbase", "kraken", "coingecko", "bitstamp"],
      maxAgeMs: 20000,
    }),
  };

  return finalizeEvent(eventTemplate, secretKey);
}

export function haveNip07(): boolean {
  return !!(window as any).nostr && !!(window as any).nostr.getPublicKey && !!(window as any).nostr.signEvent;
}

export async function getNip07Pubkey(): Promise<string | null> {
  if (!haveNip07()) return null;
  try {
    return await (window as any).nostr.getPublicKey();
  } catch {
    return null;
  }
}

export async function signWithNip07(event: any): Promise<any> {
  if (!haveNip07()) throw new Error("NIP-07 wallet not available");
  return await (window as any).nostr.signEvent(event);
}

export function truncatePubkey(pubkey: string, length = 8): string {
  if (pubkey.length <= length * 2) return pubkey;
  return `${pubkey.slice(0, length)}...${pubkey.slice(-length)}`;
}
