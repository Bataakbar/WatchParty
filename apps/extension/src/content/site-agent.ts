import type { ClientEvent, ServerEvent } from "@watchparty/shared";
import { FilmapikAdapter } from "./filmapik-adapter";
import { findVideo } from "./player-detector";
import { ChatWidget } from "./chat-widget";
import type { ContentToWorkerEvent } from "../shared/messages";

const DETECTION_TIMEOUT_MS = 20000;
const URL_POLL_MS = 800;
const SUPPRESS_MS = 600;
const POSITION_REPORT_MS = 1000;

function sendToWorker(event: ClientEvent): void {
  const message: ContentToWorkerEvent = { source: "wt-content", kind: "EVENT", event };
  chrome.runtime.sendMessage(message).catch(() => {});
}

type SiteCommand = Extract<
  ClientEvent,
  { type: "PLAY" | "PAUSE" | "SEEK" | "RATE_CHANGE" }
>;

export function startSiteAgent(): void {
  if (!FilmapikAdapter.supportsLocation(window.location.href)) return;

  const adapter = new FilmapikAdapter();
  const chatWidget = new ChatWidget();
  chatWidget.setOnSend((text) => {
    sendToWorker({ type: "CHAT_MESSAGE", message: text });
  });

  let lastUrl = window.location.href;
  let suppressUntil = 0;

  sendToWorker({ type: "PLAYER_STATUS", status: "LOADING" });

  adapter.setChangeListener((change) => {
    if (Date.now() < suppressUntil) return;
    switch (change.type) {
      case "play":
        sendToWorker({ type: "PLAY", position: change.position });
        break;
      case "pause":
        sendToWorker({ type: "PAUSE", position: change.position });
        break;
      case "seek":
        sendToWorker({ type: "SEEK", position: change.position });
        break;
      case "ratechange":
        sendToWorker({ type: "RATE_CHANGE", rate: change.rate });
        break;
      case "ended":
        sendToWorker({ type: "PAUSE", position: change.position });
        break;
    }
  });

  function detectPlayer(): void {
    const found = findVideo();
    if (found && !adapter.detect()) {
      adapter.setVideo(found);
      sendToWorker({ type: "MEDIA_READY" });
    }
  }

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
    if (message?.source !== "wt-worker") return;
    if (message.kind === "COMMAND") {
      const event = message.command as ClientEvent | ServerEvent;
      if (event.type === "CHAT_MESSAGE" && "username" in event && "createdAt" in event) {
        chatWidget.addMessage({
          id: event.id,
          username: event.username,
          role: event.role,
          message: event.message,
          createdAt: event.createdAt,
        });
        return;
      }
      if (event.type === "JOINED" || event.type === "ROOM_STATE") {
        if (event.room?.code) {
          chatWidget.setRoomInfo(event.room.code);
        }
      }
      if (
        event.type === "PLAY" ||
        event.type === "PAUSE" ||
        event.type === "SEEK" ||
        event.type === "RATE_CHANGE"
      ) {
        void execute(event as SiteCommand);
      }
    }
  });

  const poll = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (FilmapikAdapter.supportsLocation(lastUrl)) {
        sendToWorker({ type: "PLAYER_STATUS", status: "LOADING" });
        sendToWorker({
          type: "MEDIA_OPEN",
          url: lastUrl,
          ...(adapter.getMediaId() ? { mediaId: adapter.getMediaId() as string } : {}),
        });
      }
      return;
    }
    if (FilmapikAdapter.supportsLocation(lastUrl)) detectPlayer();
  }, URL_POLL_MS);

  const reportTimer = setInterval(() => {
    if (!adapter.detect()) return;
    sendToWorker({
      type: "PLAYER_POSITION",
      position: adapter.getPosition(),
      playing: adapter.isPlaying(),
    });
  }, POSITION_REPORT_MS);

  setTimeout(() => {
    clearInterval(poll);
    if (!adapter.detect()) {
      sendToWorker({ type: "PLAYER_STATUS", status: "PLAYER_UNAVAILABLE" });
    }
  }, DETECTION_TIMEOUT_MS);

  detectPlayer();
}
