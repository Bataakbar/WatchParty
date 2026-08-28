"use client";

/* eslint-disable react-hooks/refs -- sync engine reads latest player/authoritative values from timers */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Copy, Check, Clapperboard } from "lucide-react";
import {
  SUPPORTED_MEDIA_URL_PATTERN,
  SYNC_DRIFT_HARD_SECONDS,
  SYNC_DRIFT_SOFT_SECONDS,
  type ClientEvent,
  type ServerEvent,
} from "@watchparty/shared";
import { useRoom } from "@/hooks/use-room";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "@/components/room/chat-panel";
import { ControlBar } from "@/components/room/control-bar";
import { ParticipantsPanel } from "@/components/room/participants-panel";
import { TEST_STREAM_URL, VideoStage } from "@/components/room/video-stage";
import { checkExtension, relayEvent } from "@/lib/extension-bridge";

const EXT_DRIFT_INTERVAL_MS = 2000;
const DISPLAY_INTERVAL_MS = 250;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function RoomClient({ username }: { username: string }) {
  const params = useParams<{ code: string }>();
  const code = (params.code ?? "").toUpperCase();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [copied, setCopied] = useState(false);
  const [duration, setDuration] = useState(0);
  const [displayPosition, setDisplayPosition] = useState(0);
  const [extAvailable, setExtAvailable] = useState<boolean | null>(null);

  const baseRateRef = useRef(1);
  const lastRelayedUrlRef = useRef<string | null>(null);
  const extPlayerRef = useRef<{ position: number; playing: boolean } | null>(null);

  const handleServerEvent = useCallback((event: ServerEvent) => {
    if (event.type === "JOINED") {
      const self = event.participants.find((p) => p.id === event.participantId);
      setIsHost(self?.role === "HOST");
    }
  }, []);

  const room = useRoom({
    code,
    username,
    onEvent: handleServerEvent,
  });

  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  });

  const currentUrl = room.room?.currentUrl ?? null;
  const isDirectMedia =
    typeof currentUrl === "string" && /\.(mp4|webm|m3u8)(\?|$)/i.test(currentUrl);
  const connected = room.connection === "connected";

  useEffect(() => {
    checkExtension().then(setExtAvailable);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; type?: string; event?: ClientEvent };
      if (
        data?.source !== "watchparty-extension" ||
        data.type !== "EXT_EVENT" ||
        !data.event ||
        typeof data.event !== "object" ||
        !("type" in data.event)
      ) {
        return;
      }
      if (data.event.type === "PLAYER_POSITION") {
        extPlayerRef.current = {
          position: data.event.position,
          playing: data.event.playing,
        };
        return;
      }
      roomRef.current.send(data.event);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!currentUrl || isDirectMedia) return;
    if (!SUPPORTED_MEDIA_URL_PATTERN.test(currentUrl)) return;
    if (lastRelayedUrlRef.current === currentUrl) return;
    lastRelayedUrlRef.current = currentUrl;
    extPlayerRef.current = null;
    relayEvent({ type: "MEDIA_OPEN", url: currentUrl }).catch(() => {});
  }, [currentUrl, isDirectMedia]);

  useEffect(() => {
    if (!currentUrl || isDirectMedia) return;
    if (!SUPPORTED_MEDIA_URL_PATTERN.test(currentUrl)) return;
    const timer = setInterval(() => {
      if (isHost) return;
      const player = extPlayerRef.current;
      if (!player) return;
      const expected = roomRef.current.getExpectedPosition();
      const authoritativePlaying = roomRef.current.getAuthoritative()?.isPlaying ?? false;
      const diff = expected - player.position;
      const absDiff = Math.abs(diff);
      if (player.playing !== authoritativePlaying) {
        relayEvent(
          player.playing
            ? { type: "PAUSE", position: player.position }
            : { type: "PLAY", position: expected },
        ).catch(() => {});
        return;
      }
      if (absDiff <= SYNC_DRIFT_SOFT_SECONDS) return;
      if (absDiff < SYNC_DRIFT_HARD_SECONDS) {
        const factor = clamp(1 + diff / 8, 0.96, 1.04);
        relayEvent({
          type: "RATE_CHANGE",
          rate: clamp(baseRateRef.current * factor, 0.0625, 16),
        }).catch(() => {});
      } else {
        relayEvent({ type: "SEEK", position: expected }).catch(() => {});
      }
    }, EXT_DRIFT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [currentUrl, isDirectMedia, isHost]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isDirectMedia) return;
    const onLoaded = () => setDuration(v.duration || 0);
    v.addEventListener("loadedmetadata", onLoaded);
    return () => v.removeEventListener("loadedmetadata", onLoaded);
  }, [isDirectMedia, currentUrl]);

  useEffect(() => {
    const v = videoRef.current;
    const snap = room.room;
    if (!snap || !v || !isDirectMedia || v.readyState < 1) return;
    const expected = room.getExpectedPosition();
    if (!snap.isPlaying && Math.abs(v.currentTime - expected) > SYNC_DRIFT_SOFT_SECONDS) {
      v.currentTime = expected;
      v.playbackRate = baseRateRef.current;
      return;
    }
    if (Math.abs(v.currentTime - expected) > SYNC_DRIFT_HARD_SECONDS) {
      v.currentTime = expected;
    }
    if (Math.abs(v.playbackRate - baseRateRef.current) > 0.01) {
      v.playbackRate = baseRateRef.current;
    }
    if (snap.isPlaying && v.paused) {
      v.play().catch(() => {
        v.muted = true;
        v.play().catch(() => {});
      });
    } else if (!snap.isPlaying && !v.paused) {
      v.pause();
    }
  }, [room.room, isDirectMedia, room]);

  useEffect(() => {
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (isDirectMedia && v) {
        if (!isHost) {
          const expected = roomRef.current.getExpectedPosition();
          const authoritativePlaying =
            roomRef.current.getAuthoritative()?.isPlaying ?? false;
          const diff = expected - v.currentTime;
          const absDiff = Math.abs(diff);
          if (!authoritativePlaying && absDiff > SYNC_DRIFT_SOFT_SECONDS) {
            v.currentTime = expected;
            v.playbackRate = baseRateRef.current;
          } else if (absDiff <= SYNC_DRIFT_SOFT_SECONDS) {
            if (Math.abs(v.playbackRate - baseRateRef.current) > 0.01) {
              v.playbackRate = baseRateRef.current;
            }
          } else if (absDiff < SYNC_DRIFT_HARD_SECONDS) {
            const factor = clamp(1 + diff / 8, 0.96, 1.04);
            v.playbackRate = clamp(baseRateRef.current * factor, 0.0625, 16);
          } else {
            v.currentTime = expected;
            v.playbackRate = baseRateRef.current;
          }
        }
        setDisplayPosition(v.currentTime);
      } else {
        setDisplayPosition(roomRef.current.getExpectedPosition());
      }
    }, DISPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isDirectMedia, isHost]);

  const hostPosition = useCallback((): number => {
    const v = videoRef.current;
    if (v && isDirectMedia && v.readyState >= 1) return v.currentTime;
    return roomRef.current.getExpectedPosition();
  }, [isDirectMedia]);

  const handlePlayPause = useCallback(() => {
    if (!isHost) return;
    const pos = hostPosition();
    const playing = roomRef.current.getAuthoritative()?.isPlaying ?? false;
    roomRef.current.send(
      playing ? { type: "PAUSE", position: pos } : { type: "PLAY", position: pos },
    );
  }, [hostPosition, isHost]);

  const handleSeek = useCallback(
    (position: number) => {
      if (!isHost) return;
      room.send({ type: "SEEK", position });
    },
    [isHost, room],
  );

  const handleRateChange = useCallback(
    (rate: number) => {
      if (!isHost) return;
      baseRateRef.current = rate;
      room.send({ type: "RATE_CHANGE", rate });
    },
    [isHost, room],
  );

  const openTestStream = useCallback(() => {
    if (!isHost) return;
    const sent = roomRef.current.send({ type: "MEDIA_OPEN", url: TEST_STREAM_URL });
    if (!sent) {
      roomRef.current.clearError();
    }
  }, [isHost]);

  const openUrl = useCallback(
    (url: string) => {
      if (!isHost) return;
      const sent = roomRef.current.send({ type: "MEDIA_OPEN", url });
      if (!sent) {
        roomRef.current.clearError();
      }
    },
    [isHost],
  );

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const playing = room.room?.isPlaying ?? false;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line bg-surface-glass px-5 py-3 backdrop-blur-md">
        <Clapperboard size={18} className="text-cyan-400 shrink-0" />
        <span className="font-semibold tracking-tight">
          Watch<span className="text-cyan-400">Together</span>
        </span>
        <div className="mx-auto flex items-center gap-2 text-sm text-muted">
          Room:
          <span className="rounded-md border border-line bg-white/[0.04] px-2 py-0.5 font-mono tracking-[0.2em] text-foreground">
            {code}
          </span>
          <Button size="sm" variant="ghost" onClick={copyCode} aria-label="Copy room code">
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </Button>
        </div>
        {extAvailable === false && (
          <span className="hidden rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs text-yellow-300 lg:inline">
            Extension not detected
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-0 flex-1 flex-col">
          <VideoStage
            room={room.room}
            connection={room.connection}
            isHost={isHost}
            canControl={connected}
            videoRef={videoRef}
            onOpenTestStream={openTestStream}
            onOpenUrl={openUrl}
          />
          <ControlBar
            isHost={isHost}
            playing={playing}
            position={displayPosition}
            duration={duration}
            rate={baseRateRef.current}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onRateChange={handleRateChange}
          />
        </main>

        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-line bg-surface/80 lg:w-80 lg:border-l lg:border-t-0">
          <ParticipantsPanel participants={room.participants} selfId={room.selfId} />
          <ChatPanel
            messages={room.messages}
            onSend={(m) => room.send({ type: "CHAT_MESSAGE", message: m })}
          />
        </aside>
      </div>

      {room.error && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-400/30 bg-red-950/90 px-4 py-2 text-sm text-red-200 shadow-xl">
          {room.error}
          <button
            onClick={room.clearError}
            className="ml-3 cursor-pointer text-red-300 hover:text-white"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
