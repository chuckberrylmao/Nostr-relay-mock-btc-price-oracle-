import { z } from "zod";

export const nostrEventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string(),
});

export type NostrEvent = z.infer<typeof nostrEventSchema>;

export const priceRequestSchema = z.object({
  pair: z.string().default("BTC-USD"),
  method: z.enum(["trimmed_mean", "median", "mean"]).default("trimmed_mean"),
  sources: z.array(z.string()).optional(),
  maxAgeMs: z.number().default(20000),
});

export type PriceRequest = z.infer<typeof priceRequestSchema>;

export const priceSampleSchema = z.object({
  source: z.string(),
  value: z.number(),
  ts: z.number(),
});

export type PriceSample = z.infer<typeof priceSampleSchema>;

export const priceResponseSchema = z.object({
  pair: z.string(),
  ts: z.number(),
  value: z.number(),
  method: z.string(),
  sources_used: z.array(z.string()),
  samples: z.array(priceSampleSchema),
  cache: z.object({
    hit: z.boolean(),
    ageMs: z.number(),
  }),
});

export type PriceResponse = z.infer<typeof priceResponseSchema>;

export const relayInfoSchema = z.object({
  name: z.string(),
  description: z.string(),
  pubkey: z.string(),
  contact: z.string(),
  supported_nips: z.array(z.number()),
  software: z.string(),
  version: z.string(),
});

export type RelayInfo = z.infer<typeof relayInfoSchema>;

export const KIND_PRICE_REQ = 38000;
export const KIND_PRICE_RES = 38001;
export const KIND_PRICE_ERR = 38002;

export interface LocalAccount {
  npub: string;
  pubkeyHex: string;
  enc: {
    salt: string;
    iv: string;
    ct: string;
    kdf: { name: string; iters: number };
  };
  createdAt: number;
}

export interface ConsoleLogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "event" | "error" | "success";
  message: string;
  eventKind?: number;
  eventId?: string;
}
