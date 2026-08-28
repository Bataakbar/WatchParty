import type { ClientEvent } from "@watchparty/shared";
import { GenericHTML5VideoAdapter } from "./generic-adapter";
import { findVideo } from "./player-detector";
import { safeSendMessage } from "../shared/runtime";

const DETECT_TIMEOUT_MS = 15000;
const POSITION_REPORT_MS = 1000;
const SUPPRESS_MS = 600;

type SiteCommand = Extract<
  ClientEvent,
  { type: "PLAY" | "PAUSE" | "SEEK" | "RATE_CHANGE" }
>;

declare global {
  interface Window {
    __wtEmbedAgent?: boolean;
  }
}

export function startEmbedAgent(): void {
  if (window.__wtEmbedAgent) return;
  window.__wtEmbedAgent = true;

  const send = (event: ClientEvent) => {
    safeSendMessage({ source: "wt-content", kind: "EVENT", event });
  };

  const adapter = new GenericHTML5VideoAdapter();
  let suppressUntil = 0;

  adapter.setChangeListener((change) => {
    if (Date.now() < suppressUntil) return;
    switch (change.type) {
      case "play":
        send({ type: "PLAY", position: change.position });
        break;
      case "pause":
        send({ type: "PAUSE", position: change.position });
        break;
      case "seek":
        send({ type: "SEEK", position: change.position });
        break;
      case "ratechange":
        send({ type: "RATE_CHANGE", rate: change.rate });
        break;
      case "ended":
        send({ type: "PAUSE", position: change.position });
        break;
    }
  });

  async function execute(command: SiteCommand): Promise<void> {
    suppressUntil = Date.now() + SUPPRESS_MS;
    try {
      switch (command.type) {
        case "PLAY":
          await adapter.seek(command.position);
          await adapter.play();
          break;
        case "PAUSE":
          await adapter.pause();
          await adapter.seek(command.position);
          break;
        case "SEEK":
          await adapter.seek(command.position);
          break;
        case "RATE_CHANGE":
          await adapter.setPlaybackRate(command.rate);
          break;
      }
    } finally {
      setTimeout(() => {
        suppressUntil = 0;
      }, 100);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.source !== "wt-worker" || message.kind !== "COMMAND") return;
    const event = message.command as ClientEvent;
    if (
      event.type === "PLAY" ||
      event.type === "PAUSE" ||
      event.type === "SEEK" ||
      event.type === "RATE_CHANGE"
    ) {
      void execute(event);
    }
  });

  const poll = setInterval(() => {
    const found = findVideo();
    if (found && !adapter.detect()) {
      clearInterval(poll);
      adapter.setVideo(found);
      send({ type: "MEDIA_READY" });
    }
  }, 300);

  setTimeout(() => clearInterval(poll), DETECT_TIMEOUT_MS);

  setInterval(() => {
    if (!adapter.detect()) return;
    send({
      type: "PLAYER_POSITION",
      position: adapter.getPosition(),
      playing: adapter.isPlaying(),
    });
  }, POSITION_REPORT_MS);

  send({ type: "PLAYER_STATUS", status: "LOADING" });
}
