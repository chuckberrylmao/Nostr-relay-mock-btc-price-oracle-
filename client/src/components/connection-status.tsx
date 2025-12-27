import { Badge } from "@/components/ui/badge";
import type { ConnectionStatus as ConnectionStatusType } from "@/hooks/use-websocket";

interface ConnectionStatusProps {
  status: ConnectionStatusType;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          dotClass: "bg-status-online",
          text: "Connected",
          variant: "outline" as const,
        };
      case "connecting":
        return {
          dotClass: "bg-status-away animate-pulse",
          text: "Connecting",
          variant: "outline" as const,
        };
      case "disconnected":
        return {
          dotClass: "bg-status-busy",
          text: "Disconnected",
          variant: "outline" as const,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge variant={config.variant} className="gap-2 px-3 py-1.5 font-medium" data-testid="badge-connection-status">
      <span className={`h-2.5 w-2.5 rounded-full ${config.dotClass}`} />
      <span>{config.text}</span>
    </Badge>
  );
}
