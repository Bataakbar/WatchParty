"use client";

import { cn } from "@/lib/utils";
import type { ConnectionState } from "@/hooks/use-room";

const CONNECTION_META: Record<ConnectionState, { label: string; dot: string }> = {
  connecting: { label: "Connecting", dot: "bg-yellow-400 animate-pulse" },
  connected: { label: "Connected", dot: "bg-emerald-400" },
  reconnecting: { label: "Reconnecting", dot: "bg-yellow-400 animate-pulse" },
  disconnected: { label: "Disconnected", dot: "bg-red-400" },
};

export function StatusPill({ connection }: { connection: ConnectionState }) {
  const meta = CONNECTION_META[connection];
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-3 py-1 text-xs">
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </div>
  );
}
