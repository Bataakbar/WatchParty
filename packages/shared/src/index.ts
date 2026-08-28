export type Role = "HOST" | "GUEST";

export type ParticipantStatus =
  | "CONNECTED"
  | "SYNCING"
  | "PLAYER_UNAVAILABLE";

export interface Participant {
  id: string;
  username: string;
  role: Role;
  status: ParticipantStatus;
}

export interface RoomSnapshot {
  code: string;
  hostId: string | null;
  currentUrl: string | null;
  mediaId: string | null;
  playbackPosition: number;
  isPlaying: boolean;
  playbackRate: number;
  timestamp: number;
}

export const SUPPORTED_SITE_ORIGIN = "https://filmapik.college";
export const SUPPORTED_MEDIA_URL_PATTERN = /^https:\/\/filmapik\.college\//;

export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export const CHAT_MAX_LENGTH = 500;

export const SYNC_DRIFT_SOFT_SECONDS = 0.35;
export const SYNC_DRIFT_HARD_SECONDS = 5;

export const SYNC_STATE_INTERVAL_MS = 3000;
export const WS_RECONNECT_BASE_MS = 800;

export type JoinRoomPayload = {
  code: string;
  username: string;
  token?: string;
};

export type MediaOpenPayload = {
  url: string;
  mediaId?: string;
};

export type PlaybackPositionPayload = {
  position: number;
};

export type RateChangePayload = {
  rate: number;
};

export type ChatMessagePayload = {
  message: string;
};

export type PlayerStatusValue =
  | "CONNECTED"
  | "LOADING"
  | "SYNCING"
  | "PLAYER_UNAVAILABLE";

export interface PlayerPositionPayload {
  position: number;
  playing: boolean;
}

export type ClientEvent =
  | ({ type: "JOIN_ROOM" } & JoinRoomPayload)
  | { type: "LEAVE_ROOM" }
  | ({ type: "MEDIA_OPEN" } & MediaOpenPayload)
  | { type: "MEDIA_READY" }
  | { type: "PLAY"; position: number }
  | { type: "PAUSE"; position: number }
  | { type: "SEEK"; position: number }
  | { type: "RATE_CHANGE"; rate: number }
  | { type: "SYNC_REQUEST" }
  | ({ type: "CHAT_MESSAGE" } & ChatMessagePayload)
  | ({ type: "PLAYER_STATUS"; status: PlayerStatusValue; detail?: string })
  | ({ type: "PLAYER_POSITION" } & PlayerPositionPayload)
  | { type: "PING"; sentAt: number };

export interface SyncBroadcast {
  position: number;
  playing: boolean;
  rate: number;
  timestamp: number;
}

export type ServerEvent =
  | {
      type: "JOINED";
      token: string;
      participantId: string;
      room: RoomSnapshot;
      participants: Participant[];
    }
  | { type: "ROOM_STATE"; room: RoomSnapshot; participants: Participant[] }
  | { type: "USER_JOINED"; participant: Participant }
  | { type: "USER_LEFT"; participantId: string }
  | { type: "HOST_CHANGED"; hostId: string }
  | ({ type: "MEDIA_OPEN" } & Required<Pick<MediaOpenPayload, "url">> &
      Pick<MediaOpenPayload, "mediaId"> &
      SyncBroadcast)
  | ({ type: "PLAY" } & SyncBroadcast)
  | (Omit<SyncBroadcast, "playing"> & { type: "PAUSE"; playing: false; timestamp: number })
  | ({ type: "SEEK" } & SyncBroadcast)
  | ({ type: "RATE_CHANGE" } & SyncBroadcast)
  | ({ type: "SYNC_STATE" } & SyncBroadcast)
  | ({ type: "SYNC_RESPONSE" } & SyncBroadcast)
  | {
      type: "CHAT_MESSAGE";
      id: string;
      username: string;
      role: Role;
      message: string;
      createdAt: number;
    }
  | { type: "PARTICIPANT_STATUS"; participantId: string; status: ParticipantStatus }
  | { type: "PARTICIPANT_OFFLINE"; participantId: string }
  | { type: "ERROR"; code: string; message: string }
  | { type: "PONG"; sentAt: number; serverTime: number };

export function expectedPosition(
  base: SyncBroadcast,
  nowMs: number,
): number {
  if (!base.playing) return base.position;
  const elapsedSeconds = Math.max(0, nowMs - base.timestamp) / 1000;
  return base.position + elapsedSeconds * base.rate;
}

export function driftCorrection(
  authoritative: number,
  local: number,
): { action: "none" } | { action: "rate" } | { action: "seek"; position: number } {
  const diff = authoritative - local;
  const abs = Math.abs(diff);
  if (abs <= SYNC_DRIFT_SOFT_SECONDS) return { action: "none" };
  if (abs < SYNC_DRIFT_HARD_SECONDS) return { action: "rate" };
  return { action: "seek", position: authoritative };
}
