const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const API_BASE_URL = API_URL;

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

export interface RoomCreated {
  code: string;
  token: string;
  participantId: string;
  role: string;
}

export interface RoomInfo {
  code: string;
  exists: boolean;
  participants: number;
  capacity: number;
  hasMedia: boolean;
  hostUsername: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { detail?: string };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function createRoom(username: string): Promise<RoomCreated> {
  return request<RoomCreated>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function getRoomInfo(code: string): Promise<RoomInfo> {
  return request<RoomInfo>(`/api/rooms/${encodeURIComponent(code)}`);
}
