"use client";

import { useState } from "react";
import { RefreshCw, Server, Database, Activity } from "lucide-react";
import { Button } from "~/components/ui";

interface MinimalBackendStatusProps {
  status: "ok" | "error" | "loading" | "unknown";
  service?: string;
  version?: string;
  dataDir?: string;
  lastCheck?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function MinimalBackendStatus({
  status,
  service = "Kuti Backend",
  version = "-",
  dataDir = "-",
  lastCheck,
  onRefresh,
  isRefreshing,
}: MinimalBackendStatusProps) {
  const [showDetails, setShowDetails] = useState(false);

  const statusConfig = {
    ok: { color: "bg-success", text: "OK", pulse: false },
    error: { color: "bg-danger", text: "Erreur", pulse: false },
    loading: { color: "bg-warning", text: "...", pulse: true },
    unknown: { color: "bg-muted", text: "?", pulse: false },
  };

  const config = statusConfig[status];

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/95 backdrop-blur-sm border border-line/60 hover:border-accent/60 hover:bg-surface shadow-sm transition-colors"
        >
          <span className={config.pulse ? "relative flex h-2 w-2" : ""}>
            <span className={config.pulse ? `animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75` : ""} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`} />
          </span>
          <span className="text-xs font-medium text-muted">Backend</span>
          <span className="text-[10px] text-muted/60 hidden sm:inline">{config.text}</span>
        </button>
        
        {onRefresh && (
          <Button variant="ghost" className="p-1.5 h-auto" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          </Button>
        )}
      </div>

      {/* Tooltip/Details */}
      {showDetails && (
        <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-lg bg-surface/95 backdrop-blur-md border border-line shadow-xl z-50">
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Server size={12} className="text-accent" />
              <span className="text-muted">{service}</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-accent" />
              <span className="text-muted">v{version}</span>
            </div>
            <div className="flex items-center gap-2">
              <Database size={12} className="text-accent" />
              <span className="text-muted truncate">{dataDir}</span>
            </div>
            {lastCheck && (
              <div className="text-[10px] text-muted/60 border-t border-line/50 pt-1 mt-1">
                Dernier check: {new Date(lastCheck).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
