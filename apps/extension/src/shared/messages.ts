import type { ClientEvent, ServerEvent } from "@watchparty/shared";

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
  event: ClientEvent | ServerEvent;
  originTabId?: number;
}

export type ContentToWorker = ContentToWorkerHello | ContentToWorkerEvent;

export interface WorkerToAppRelayEvent {
  source: "wt-worker";
  kind: "EXT_EVENT";
  event: ClientEvent | ServerEvent;
}

export interface WorkerToSiteCommand {
  source: "wt-worker";
  kind: "COMMAND";
  command: ClientEvent | ServerEvent;
}

export type WorkerToContent = WorkerToAppRelayEvent | WorkerToSiteCommand;
