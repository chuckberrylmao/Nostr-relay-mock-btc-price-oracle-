import { useState } from "react";
import { Bitcoin, Github, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatus } from "@/components/connection-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountPanel, type AccountMode } from "@/components/account-panel";
import { PricePanel } from "@/components/price-panel";
import { EventConsole } from "@/components/event-console";
import { useWebSocket } from "@/hooks/use-websocket";

export default function Dashboard() {
  const [mode, setMode] = useState<AccountMode>("local");
  const [secretKey, setSecretKey] = useState<Uint8Array | null>(null);
  const [pubkeyHex, setPubkeyHex] = useState<string | null>(null);
  const { status, logs, priceData, sendEvent, subscribe, clearLogs, addLog } = useWebSocket();

  const wsUrl = (window as any).RELAY_WS_URL || (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";

  return (
    <div className="min-h-screen bg-background" data-testid="page-dashboard">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Bitcoin className="h-5 w-5 text-primary" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold tracking-tight">BTC Price Relay</h1>
              <p className="text-xs text-muted-foreground">Nostr-native price oracle</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatus status={status} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
              <p className="text-muted-foreground">Query BTC prices from multiple exchanges via Nostr</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-2 font-mono text-xs" data-testid="badge-ws-url">
                WS: {wsUrl.replace(/^wss?:\/\//, "").slice(0, 30)}
              </Badge>
              <Button variant="outline" size="sm" asChild>
                <a href="/api/download-zip" download data-testid="button-download-zip">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" data-testid="link-github">
                  <Github className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <PricePanel mode={mode} secretKey={secretKey} pubkeyHex={pubkeyHex} priceData={priceData} onSendEvent={sendEvent} onSubscribe={subscribe} onLog={addLog} />
              <AccountPanel mode={mode} setMode={setMode} secretKey={secretKey} setSecretKey={setSecretKey} pubkeyHex={pubkeyHex} setPubkeyHex={setPubkeyHex} />
            </div>
            <div>
              <EventConsole logs={logs} onClear={clearLogs} />
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>Your private keys never leave this browser. All signing happens locally.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
