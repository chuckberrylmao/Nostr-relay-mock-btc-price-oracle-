import { useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pause, Play } from "lucide-react";
import type { ConsoleLogEntry } from "@shared/schema";
import { useState } from "react";

interface EventConsoleProps {
  logs: ConsoleLogEntry[];
  onClear: () => void;
}

export function EventConsole({ logs, onClear }: EventConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoscroll, setAutoscroll] = useState(true);

  useEffect(() => {
    if (autoscroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoscroll]);

  const getLogTypeConfig = (type: ConsoleLogEntry["type"]) => {
    switch (type) {
      case "info":
        return { color: "text-muted-foreground", badge: null };
      case "event":
        return { color: "text-chart-1", badge: "secondary" as const };
      case "error":
        return { color: "text-destructive", badge: "destructive" as const };
      case "success":
        return { color: "text-chart-2", badge: null };
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <Card className="flex flex-col" data-testid="card-event-console">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="text-base font-semibold">Event Stream</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAutoscroll(!autoscroll)} data-testid="button-toggle-autoscroll">
            {autoscroll ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} data-testid="button-clear-console">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <ScrollArea className="h-80 rounded-md border bg-muted/30 p-3" ref={scrollRef}>
          <div className="space-y-1 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-muted-foreground" data-testid="text-console-empty">
                No events yet. Request a price to see activity.
              </p>
            ) : (
              logs.map((log) => {
                const config = getLogTypeConfig(log.type);
                return (
                  <div key={log.id} className="flex gap-2 leading-relaxed" data-testid={`log-entry-${log.id}`}>
                    <span className="text-muted-foreground shrink-0">[{formatTimestamp(log.timestamp)}]</span>
                    {log.eventKind && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal shrink-0">
                        {log.eventKind}
                      </Badge>
                    )}
                    <span className={`${config.color} break-all`}>{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
