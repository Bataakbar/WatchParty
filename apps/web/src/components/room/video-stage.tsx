"use client";

import { type RefObject, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, MonitorPlay, Film, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/room/status-pill";
import type { ConnectionState } from "@/hooks/use-room";
import type { RoomSnapshot } from "@watchparty/shared";
import { API_BASE_URL } from "@/lib/api";

export const TEST_STREAM_URL = `${API_BASE_URL}/media/sample.mp4`;

export function VideoStage({
  room,
  connection,
  isHost,
  canControl,
  videoRef,
  onOpenTestStream,
  onOpenUrl,
}: {
  room: RoomSnapshot | null;
  connection: ConnectionState;
  isHost: boolean;
  canControl: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onOpenTestStream: () => void;
  onOpenUrl: (url: string) => void;
}) {
  const url = room?.currentUrl ?? null;
  const isDirectMedia = typeof url === "string" && /\.(mp4|webm|m3u8)(\?|$)/i.test(url);
  const streamReady = isHost && canControl;
  const [muted, setMuted] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isDirectMedia) return;
    const syncMuted = () => setMuted(v.muted);
    v.addEventListener("volumechange", syncMuted);
    setMuted(v.muted);
    return () => v.removeEventListener("volumechange", syncMuted);
  }, [isDirectMedia, videoRef]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = linkDraft.trim();
    if (!/^https:\/\/filmapik\.college\//i.test(trimmed)) {
      setLinkError("Link harus dari filmapik.college");
      return;
    }
    setLinkError(null);
    setLinkDraft("");
    onOpenUrl(trimmed);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="absolute left-4 top-4 z-10">
        <StatusPill connection={connection} />
      </div>

      {!url && (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-8">
          <div className="max-w-md rounded-2xl border border-line bg-surface-glass backdrop-blur-md p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400">
              <MonitorPlay size={22} />
            </div>
            <h2 className="mt-5 font-medium">No media open yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {isHost
                ? "Paste a movie link from filmapik.college below. Everyone in the room opens the same page automatically and stays in sync."
                : "Waiting for the host to open a video. This happens automatically."}
            </p>
            {isHost && (
              <form onSubmit={submitLink} className="mt-6 space-y-3 text-left">
                <label htmlFor="media-url" className="block text-xs uppercase tracking-wider text-muted">
                  Filmapik link
                </label>
                <input
                  id="media-url"
                  value={linkDraft}
                  onChange={(e) => {
                    setLinkDraft(e.target.value);
                    setLinkError(null);
                  }}
                  placeholder="https://filmapik.college/nonton-film-…"
                  spellCheck={false}
                  disabled={!streamReady}
                  className="h-11 w-full rounded-lg border border-line bg-white/[0.04] px-3 font-mono text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:opacity-40"
                />
                {linkError && <p className="text-xs text-red-400">{linkError}</p>}
                <div className="flex gap-2">
                  <Button type="submit" variant="accent" className="flex-1" disabled={!streamReady}>
                    <ExternalLink size={15} />
                    Open for everyone
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onOpenTestStream}
                    disabled={!streamReady}
                    title="Built-in 52s sync test clip"
                  >
                    <Film size={15} />
                    Test clip
                  </Button>
                </div>
                {!streamReady && (
                  <p className="text-center text-xs text-yellow-300/80">Connecting to room…</p>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {url && isDirectMedia && (
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black/60 p-6">
          <video
            ref={videoRef}
            src={url}
            playsInline
            className="max-h-full max-w-full rounded-xl shadow-2xl shadow-black/50"
          />
          <button
            onClick={toggleMute}
            className="absolute right-8 top-8 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70 cursor-pointer"
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      )}

      {url && !isDirectMedia && (
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <div className="max-w-lg rounded-2xl border border-line bg-surface-glass backdrop-blur-md p-8 text-center">
            <MonitorPlay size={22} className="mx-auto text-cyan-400" />
            <h2 className="mt-4 font-medium">Watching via filmapik.college</h2>
            <p className="mt-2 break-all text-xs leading-relaxed text-muted">{url}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              With the WatchTogether extension installed, your browser opened this page
              automatically and playback is synchronized here. Without it, open the page manually.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href={url} target="_blank">
                <Button variant="secondary">
                  <ExternalLink size={14} />
                  Open page manually
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
