import type { ClientEvent, ServerEvent } from "@watchparty/shared";
import type { ContentToWorkerEvent } from "../shared/messages";

function forwardToWorker(event: ClientEvent | ServerEvent): void {
  const message: ContentToWorkerEvent = { source: "wt-content", kind: "EVENT", event };
  chrome.runtime.sendMessage(message).catch(() => {});
}

export function startAppRelay(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as
      | { source?: string; type?: string; id?: string; event?: ClientEvent | ServerEvent }
      | undefined;
    if (!data || data.source !== "watchparty-web") return;

    if (data.type === "PING" && typeof data.id === "string") {
      window.postMessage(
        { source: "watchparty-extension", type: "ACK", id: data.id },
        window.location.origin,
      );
      return;
    }

    if (data.type === "RELAY_EVENT" && data.event) {
      forwardToWorker(data.event);
      window.postMessage(
        { source: "watchparty-extension", type: "ACK", id: data.id },
        window.location.origin,
      );
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.source !== "wt-worker" || message.kind !== "EXT_EVENT") return;
    window.postMessage(
      {
        source: "watchparty-extension",
        type: "EXT_EVENT",
        event: message.event,
      },
      window.location.origin,
    );
  });

  chrome.runtime.sendMessage({ source: "wt-content", kind: "APP_HELLO" }).catch(() => {});
}
