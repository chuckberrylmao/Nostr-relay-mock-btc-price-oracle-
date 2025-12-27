import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bitcoin, RefreshCw, Loader2, TrendingUp, Clock, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { signPriceRequestEvent, signWithNip07, haveNip07 } from "@/lib/nostr";
import type { AccountMode } from "./account-panel";
import type { PriceData } from "@/hooks/use-websocket";

interface PricePanelProps {
  mode: AccountMode;
  secretKey: Uint8Array | null;
  pubkeyHex: string | null;
  priceData: PriceData | null;
  onSendEvent: (event: any) => void;
  onSubscribe: (requestId: string) => void;
  onLog: (type: "info" | "event" | "error" | "success", message: string) => void;
}

export function PricePanel({ mode, secretKey, pubkeyHex, priceData, onSendEvent, onSubscribe, onLog }: PricePanelProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestPrice = async () => {
    if (!pubkeyHex) {
      toast({
        title: "No active account",
        description: "Create or unlock an account first",
        variant: "destructive",
      });
      onLog("error", "No active pubkey. Create/unlock a local account or enable a NIP-07 wallet.");
      return;
    }

    setIsLoading(true);
    try {
      let signedEvent: any;

      if (mode === "nip07") {
        if (!haveNip07()) {
          throw new Error("NIP-07 wallet not available");
        }
        const created_at = Math.floor(Date.now() / 1000);
        const eventTemplate = {
          kind: 38000,
          pubkey: pubkeyHex,
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
        signedEvent = await signWithNip07(eventTemplate);
      } else {
        if (!secretKey) {
          throw new Error("Local key locked. Unlock or create an account.");
        }
        signedEvent = signPriceRequestEvent(secretKey, pubkeyHex);
      }

      onLog("info", `Sending price request ${signedEvent.id.slice(0, 8)}...`);
      onSubscribe(signedEvent.id);
      onSendEvent(signedEvent);

      toast({
        title: "Request sent",
        description: "Waiting for price response...",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Request failed",
        description: message,
        variant: "destructive",
      });
      onLog("error", `Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Card className="border-primary/20" data-testid="card-price-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Bitcoin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">BTC Price</CardTitle>
              <CardDescription>Aggregated from multiple sources</CardDescription>
            </div>
          </div>
          <Button onClick={handleRequestPrice} disabled={isLoading || !pubkeyHex} className="gap-2" data-testid="button-get-price">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Get Price
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {priceData ? (
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-mono font-bold tracking-tight" data-testid="text-price-value">
                {formatPrice(priceData.value)}
              </span>
              <Badge variant="secondary" className="font-mono text-xs">
                BTC/USD
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                <span>{priceData.method}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Database className="h-4 w-4" />
                <span>{priceData.sourcesCount} sources</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>{priceData.timestamp.toLocaleTimeString()}</span>
              </div>
              {priceData.cached && <Badge variant="outline">Cached</Badge>}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground" data-testid="text-no-price">
            <Bitcoin className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No price data yet</p>
            <p className="text-sm mt-1">Click "Get Price" to request the current BTC price</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
