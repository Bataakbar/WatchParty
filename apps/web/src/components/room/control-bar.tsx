"use client";

import { Pause, Play, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

const RATES = [0.5, 1, 1.25, 1.5, 2];

export function ControlBar({
  isHost,
  playing,
  position,
  duration,
  rate,
  onPlayPause,
  onSeek,
  onRateChange,
}: {
  isHost: boolean;
  playing: boolean;
  position: number;
  duration: number;
  rate: number;
  onPlayPause: () => void;
  onSeek: (position: number) => void;
  onRateChange: (rate: number) => void;
}) {
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <footer className="flex items-center gap-4 border-t border-line bg-surface-glass px-5 py-3 backdrop-blur-md">
      <Button
        size="icon"
        variant={isHost ? "accent" : "secondary"}
        onClick={onPlayPause}
        disabled={!isHost}
        aria-label={playing ? "Pause" : "Play"}
        title={isHost ? undefined : "Only the host can control playback"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="text-xs tabular-nums text-muted">{formatTime(position)}</span>
        <div className="relative min-w-0 flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-400 transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          {isHost && duration > 0 && (
            <input
              type="range"
              min={0}
              max={Math.floor(duration)}
              step={1}
              value={Math.floor(position)}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Seek"
            />
          )}
        </div>
        <span className="text-xs tabular-nums text-muted">{formatTime(duration)}</span>
      </div>

      <label className="flex items-center gap-2">
        <Settings2 size={14} className="text-muted" />
        <select
          value={rate}
          onChange={(e) => onRateChange(Number(e.target.value))}
          disabled={!isHost}
          className="h-8 rounded-md border border-line bg-white/[0.04] px-1.5 text-xs disabled:opacity-40 focus:outline-none cursor-pointer"
          aria-label="Playback rate"
        >
          {RATES.map((r) => (
            <option key={r} value={r}>
              {r}x
            </option>
          ))}
        </select>
      </label>
    </footer>
  );
}
