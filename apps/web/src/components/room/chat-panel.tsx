"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHAT_MAX_LENGTH } from "@watchparty/shared";
import type { ChatItem } from "@/hooks/use-room";

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({
  messages,
  onSend,
}: {
  messages: ChatItem[];
  onSend: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed.length > CHAT_MAX_LENGTH) return;
    onSend(trimmed);
    setDraft("");
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="px-4 py-3 text-xs uppercase tracking-wider text-muted">Chat</header>
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted/60">Say hi to the room.</p>
        )}
        {messages.map((m) => (
          <div key={m.id}>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{m.username}</span>
              {m.role === "HOST" && (
                <span className="rounded bg-cyan-400/10 px-1.5 py-px text-[10px] font-medium text-cyan-300">
                  Host
                </span>
              )}
              <span className="ml-auto text-[10px] text-muted/60 tabular-nums">
                {formatClock(m.createdAt)}
              </span>
            </div>
            <p className="mt-0.5 break-words text-sm leading-snug text-zinc-300">{m.message}</p>
          </div>
        ))}
      </div>
      <footer className="border-t border-line p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_LENGTH))}
            placeholder="Message…"
            maxLength={CHAT_MAX_LENGTH}
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white/[0.04] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
          />
          <Button size="icon" variant="secondary" type="submit" aria-label="Send">
            <SendHorizontal size={16} />
          </Button>
        </form>
      </footer>
    </section>
  );
}
