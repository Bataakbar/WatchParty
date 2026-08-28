import type { ClientEvent } from "@watchparty/shared";

interface ExtensionHello {
  source: "watchparty-extension";
  type: "HELLO";
}

interface ExtensionAck {
  source: "watchparty-extension";
  type: "ACK";
  id: string;
}

interface ExtensionError {
  source: "watchparty-extension";
  type: "ERROR";
  id: string;
  message: string;
}

type ExtensionMessage = ExtensionHello | ExtensionAck | ExtensionError;

let pendingId = 0;

function appOrigin(): string {
  return window.location.origin;
}

function sendToExtension(payload: unknown): void {
  window.postMessage(payload, appOrigin());
}

function waitForReply(id: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Extension timeout"));
    }, timeoutMs);
    function onMessage(event: MessageEvent) {
      if (event.origin !== appOrigin()) return;
      const data = event.data as ExtensionMessage | undefined;
      if (
        data &&
        data.source === "watchparty-extension" &&
        (data.type === "ACK" || data.type === "ERROR") &&
        data.id === id
      ) {
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        if (data.type === "ACK") resolve();
        else reject(new Error(data.message));
      }
    }
    window.addEventListener("message", onMessage);
  });
}

export async function relayEvent(event: ClientEvent, timeoutMs = 3000): Promise<void> {
  const id = `evt-${++pendingId}-${Date.now()}`;
  sendToExtension({ source: "watchparty-web", type: "RELAY_EVENT", id, event });
  await waitForReply(id, timeoutMs);
}

export async function checkExtension(timeoutMs = 600): Promise<boolean> {
  try {
    const id = `ping-${Date.now()}`;
    sendToExtension({ source: "watchparty-web", type: "PING", id });
    await waitForReply(id, timeoutMs);
    return true;
  } catch {
    return false;
  }
}
