import type { ClientEvent } from "@watchparty/shared";

export type PlayerStatusValue =
  | "LOADING"
  | "SYNCING"
  | "CONNECTED"
  | "PLAYER_UNAVAILABLE";

export interface ContentToWorkerHello {
  source: "wt-content";
  kind: "APP_HELLO";
}

export interface ContentToWorkerEvent {
  source: "wt-content";
  kind: "EVENT";
  event: ClientEvent;
  originTabId?: number;
}

export type ContentToWorker = ContentToWorkerHello | ContentToWorkerEvent;

export interface WorkerToAppRelayEvent {
  source: "wt-worker";
  kind: "EXT_EVENT";
  event: ClientEvent;
}

export interface WorkerToSiteCommand {
  source: "wt-worker";
  kind: "COMMAND";
  command: Extract<ClientEvent, { type: "PLAY" | "PAUSE" | "SEEK" | "RATE_CHANGE" | "MEDIA_OPEN" }>;
}

export type WorkerToContent = WorkerToAppRelayEvent | WorkerToSiteCommand;
