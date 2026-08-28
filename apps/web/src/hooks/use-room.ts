"use client";

 

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ClientEvent,
  type Participant,
  type RoomSnapshot,
  type ServerEvent,
  WS_RECONNECT_BASE_MS,
  expectedPosition,
} from "@watchparty/shared";
import { WS_URL } from "@/lib/api";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface ChatItem {
  id: string;
  username: string;
  role: string;
  message: string;
  createdAt: number;
}

export interface UseRoomOptions {
  code: string;
  username: string;
  onAuthoritative?: (snapshot: RoomSnapshot & { receivedAtServer: number }) => void;
  onEvent?: (event: ServerEvent) => void;
}

interface AuthoritativeUpdate {
  position: number;
  playing: boolean;
  rate: number;
  timestamp: number;
  currentUrl?: string | null;
  mediaId?: string | null;
}

export function useRoom({
  code,
  username,
  onAuthoritative,
  onEvent,
}: UseRoomOptions) {
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const offsetSamplesRef = useRef<number[]>([]);
  const offsetRef = useRef(0);
  const pendingPingsRef = useRef<Map<number, number>>(new Map());
  const authoritativeRef = useRef<RoomSnapshot | null>(null);
  const onAuthoritativeRef = useRef(onAuthoritative);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onAuthoritativeRef.current = onAuthoritative;
    onEventRef.current = onEvent;
  });

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const send = useCallback((event: ClientEvent): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
      return true;
    }
    return false;
  }, []);

  const sendPing = useCallback(() => {
    const sentAt = Date.now();
    pendingPingsRef.current.set(sentAt, sentAt);
    send({ type: "PING", sentAt });
  }, [send]);

  const commitRoom = useCallback(
    (next: RoomSnapshot, receivedAtServer?: number) => {
      authoritativeRef.current = next;
      setRoom(next);
      if (typeof window !== "undefined") {
        (window as unknown as { __wt?: unknown }).__wt = { room: next };
      }
      if (receivedAtServer !== undefined) {
        onAuthoritativeRef.current?.({ ...next, receivedAtServer });
      }
    },
    [],
  );

  const applyAuthoritative = useCallback(
    (snap: AuthoritativeUpdate) => {
      const prev = authoritativeRef.current;
      commitRoom(
        {
          code: prev?.code ?? code,
          hostId: prev?.hostId ?? null,
          currentUrl:
            snap.currentUrl !== undefined ? snap.currentUrl : (prev?.currentUrl ?? null),
          mediaId: snap.mediaId !== undefined ? snap.mediaId : (prev?.mediaId ?? null),
          playbackPosition: snap.position,
          isPlaying: snap.playing,
          playbackRate: snap.rate,
          timestamp: snap.timestamp,
        },
        snap.timestamp,
      );
    },
    [code, commitRoom],
  );

  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const storeTokenKey = `wt:token:${code}`;

    const handleMessage = (raw: MessageEvent) => {
      let event: ServerEvent;
      try {
        event = JSON.parse(raw.data as string) as ServerEvent;
      } catch {
        return;
      }
      onEventRef.current?.(event);
      switch (event.type) {
        case "JOINED": {
          try {
            sessionStorage.setItem(storeTokenKey, event.token);
          } catch {
            // storage unavailable
          }
          setSelfId(event.participantId);
          setParticipants(event.participants);
          offsetRef.current = 0;
          offsetSamplesRef.current = [];
          setConnection("connected");
          setError(null);
          commitRoom(event.room, event.room.timestamp);
          sendPing();
          break;
        }
        case "ROOM_STATE": {
          commitRoom(event.room);
          setParticipants(event.participants);
          break;
        }
        case "USER_JOINED":
          setParticipants((prev) =>
            prev.some((p) => p.id === event.participant.id)
              ? prev.map((p) => (p.id === event.participant.id ? event.participant : p))
              : [...prev, event.participant],
          );
          break;
        case "USER_LEFT":
          setParticipants((prev) => prev.filter((p) => p.id !== event.participantId));
          break;
        case "PARTICIPANT_OFFLINE":
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === event.participantId ? { ...p, status: "SYNCING" as const } : p,
            ),
          );
          break;
        case "HOST_CHANGED": {
          setParticipants((prev) =>
            prev.map((p) => ({
              ...p,
              role:
                p.id === event.hostId
                  ? ("HOST" as const)
                  : p.role === "HOST"
                    ? ("GUEST" as const)
                    : p.role,
            })),
          );
          const prevSnap = authoritativeRef.current;
          if (prevSnap) commitRoom({ ...prevSnap, hostId: event.hostId });
          break;
        }
        case "PARTICIPANT_STATUS":
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === event.participantId ? { ...p, status: event.status } : p,
            ),
          );
          break;
        case "PLAY":
        case "PAUSE":
        case "SEEK":
        case "RATE_CHANGE":
        case "MEDIA_OPEN":
        case "SYNC_STATE":
        case "SYNC_RESPONSE": {
          if ("position" in event && "playing" in event && "rate" in event) {
            const { url, mediaId, ...rest } = event as typeof event & {
              url?: string;
              mediaId?: string | null;
            };
            applyAuthoritative({
              ...rest,
              position: rest.position,
              playing: rest.playing,
              rate: rest.rate,
              timestamp: rest.timestamp,
              ...(url !== undefined ? { currentUrl: url } : {}),
              ...(mediaId !== undefined ? { mediaId } : {}),
            });
          }
          break;
        }
        case "CHAT_MESSAGE":
          setMessages((prev) => [
            ...prev.slice(-199),
            {
              id: event.id,
              username: event.username,
              role: event.role,
              message: event.message,
              createdAt: event.createdAt,
            },
          ]);
          break;
        case "PONG": {
          const sentAt = pendingPingsRef.current.get(event.sentAt);
          pendingPingsRef.current.delete(event.sentAt);
          if (sentAt !== undefined) {
            const now = Date.now();
            const rtt = now - sentAt;
            const offset = event.serverTime - sentAt - rtt / 2;
            const samples = [...offsetSamplesRef.current, offset].slice(-5).sort((a, b) => a - b);
            offsetSamplesRef.current = samples;
            offsetRef.current = samples[Math.floor(samples.length / 2)] ?? 0;
          }
          break;
        }
        case "ERROR":
          setError(event.message);
          break;
      }
    };

    const connect = () => {
      if (disposed) return;
      setConnection(attempt === 0 ? "connecting" : "reconnecting");
      let socket: WebSocket;
      try {
        socket = new WebSocket(WS_URL);
      } catch {
        scheduleRetry();
        return;
      }
      wsRef.current = socket;
      socket.onopen = () => {
        if (disposed || wsRef.current !== socket) return;
        attempt = 0;
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(storeTokenKey);
        } catch {
          // storage unavailable
        }
        socket.send(
          JSON.stringify({ type: "JOIN_ROOM", code, username, ...(token ? { token } : {}) }),
        );
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (!disposed) sendPing();
        }, 10000);
      };
      socket.onmessage = handleMessage;
      socket.onclose = () => {
        if (wsRef.current === socket) wsRef.current = null;
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (!disposed && wsRef.current === null) {
          setConnection("reconnecting");
          scheduleRetry();
        }
      };
      socket.onerror = () => {
        if (wsRef.current === socket) {
          try {
            socket.close();
          } catch {
            // already closing
          }
        }
      };
    };

    const scheduleRetry = () => {
      if (disposed) return;
      const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** Math.min(attempt, 5), 15000);
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      const socket = wsRef.current;
      wsRef.current = null;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
      setConnection("connecting");
    };
  }, [code, username, sendPing, applyAuthoritative, commitRoom]);

  const getExpectedPosition = useCallback(() => {
    const snap = authoritativeRef.current;
    if (!snap) return 0;
    return expectedPosition(
      {
        position: snap.playbackPosition,
        playing: snap.isPlaying,
        rate: snap.playbackRate,
        timestamp: snap.timestamp,
      },
      serverNow(),
    );
  }, [serverNow]);

  const getAuthoritative = useCallback(() => authoritativeRef.current, []);

  const clearError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      connection,
      room,
      participants,
      selfId,
      messages,
      error,
      send,
      serverNow,
      getExpectedPosition,
      getAuthoritative,
      clearError,
    }),
    [
      connection,
      room,
      participants,
      selfId,
      messages,
      error,
      send,
      serverNow,
      getExpectedPosition,
      getAuthoritative,
      clearError,
    ],
  );
}
