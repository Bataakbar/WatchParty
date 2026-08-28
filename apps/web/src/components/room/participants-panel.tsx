"use client";

import { Users } from "lucide-react";
import type { Participant } from "@watchparty/shared";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<Participant["status"], string> = {
  CONNECTED: "bg-emerald-400",
  SYNCING: "bg-yellow-400",
  PLAYER_UNAVAILABLE: "bg-red-400",
};

const STATUS_LABELS: Record<Participant["status"], string> = {
  CONNECTED: "Synced",
  SYNCING: "Synchronizing",
  PLAYER_UNAVAILABLE: "Player unavailable",
};

export function ParticipantsPanel({
  participants,
  selfId,
}: {
  participants: Participant[];
  selfId: string | null;
}) {
  return (
    <section className="flex min-h-0 flex-col border-b border-line">
      <header className="flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wider text-muted">
        <Users size={14} />
        Participants
        <span className="ml-auto tabular-nums">{participants.length}</span>
      </header>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {participants.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.03]"
          >
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 text-sm font-medium uppercase">
              {p.username.charAt(0)}
              <span
                className={cn(
                  "absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full ring-2 ring-surface",
                  STATUS_COLORS[p.status],
                )}
              />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                {p.username}
                {p.id === selfId && <span className="text-xs text-muted">(you)</span>}
              </div>
              <div className="text-xs text-muted">{STATUS_LABELS[p.status]}</div>
            </div>
            {p.role === "HOST" && (
              <span className="ml-auto rounded-md bg-cyan-400/10 px-2 py-0.5 text-[11px] font-medium text-cyan-300">
                Host
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
