import type { ClientEvent, ServerEvent } from "@watchparty/shared";
import type {
  ContentToWorker,
  WorkerToAppRelayEvent,
  WorkerToSiteCommand,
} from "../shared/messages";

const SITE_MATCH = "https://filmapik.college/*";
const APP_MATCH = "http://localhost:3000/*";

interface State {
  appTabIds: Set<number>;
  siteTabId: number | null;
  siteFrameId: number | null;
}

const state: State = { appTabIds: new Set(), siteTabId: null, siteFrameId: null };

function isPlaybackCommand(
  event: ClientEvent | ServerEvent,
): event is Extract<ClientEvent, { type: "PLAY" | "PAUSE" | "SEEK" | "RATE_CHANGE" }> {
  return (
    event.type === "PLAY" ||
    event.type === "PAUSE" ||
    event.type === "SEEK" ||
    event.type === "RATE_CHANGE"
  );
}

async function ensureSiteTab(url: string): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: SITE_MATCH });
  if (tabs.length > 0 && tabs[0]?.id !== undefined) {
    const id = tabs[0].id;
    if (id !== state.siteTabId) {
      state.siteTabId = id;
      state.siteFrameId = null;
      await chrome.tabs.update(id, { active: true }).catch(() => {});
    }
    return id;
  }
  try {
    const created = await chrome.tabs.create({ url, active: true });
    state.siteTabId = created.id ?? null;
    state.siteFrameId = null;
    return created.id ?? null;
  } catch {
    return null;
  }
}

async function forwardToApp(event: ClientEvent | ServerEvent): Promise<void> {
  for (const tabId of state.appTabIds) {
    const message: WorkerToAppRelayEvent = { source: "wt-worker", kind: "EXT_EVENT", event };
    await chrome.tabs.sendMessage(tabId, message).catch(() => {});
  }
}

async function forwardToSite(command: ClientEvent | ServerEvent): Promise<void> {
  let siteTabId = state.siteTabId;
  if (siteTabId === null) {
    const tabs = await chrome.tabs.query({ url: SITE_MATCH });
    siteTabId = tabs[0]?.id ?? null;
    state.siteTabId = siteTabId;
  }
  if (siteTabId === null) return;
  const message: WorkerToSiteCommand = {
    source: "wt-worker",
    kind: "COMMAND",
    command,
  };
  const frameId = state.siteFrameId;
  if (frameId !== null && isPlaybackCommand(command)) {
    await chrome.tabs.sendMessage(siteTabId, message, { frameId }).catch(async () => {
      state.siteFrameId = null;
      await chrome.tabs.sendMessage(siteTabId as number, message).catch(() => {});
    });
  } else {
    await chrome.tabs.sendMessage(siteTabId, message).catch(() => {});
  }
}

async function injectAgentFrames(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"],
    });
  } catch {
    // frames not injectable (web store pages etc.)
  }
}

chrome.runtime.onMessage.addListener((message: ContentToWorker, sender, sendResponse) => {
  if (message?.source !== "wt-content") return;

  if (message.kind === "APP_HELLO") {
    const tabId = sender.tab?.id;
    if (tabId !== undefined) state.appTabIds.add(tabId);
    sendResponse({ ok: true });
    return;
  }

  const tabId = sender.tab?.id;
  const isAppTab = tabId !== undefined && state.appTabIds.has(tabId);
  const fromSite = tabId !== undefined && !isAppTab;
  const event = message.event;
  if (!event) return;

  if (fromSite && tabId !== undefined) {
    state.siteTabId = tabId;
    if (sender.frameId !== undefined && sender.frameId > 0) {
      state.siteFrameId = sender.frameId;
    }
  }

  if (!fromSite) {
    void (async () => {
      if (event.type === "MEDIA_OPEN") {
        await ensureSiteTab(event.url);
        await forwardToApp(event);
        return;
      }
      if (isPlaybackCommand(event)) {
        await forwardToSite(event);
        return;
      }
      if (
        event.type === "CHAT_MESSAGE" ||
        event.type === "ROOM_STATE" ||
        event.type === "JOINED" ||
        event.type === "USER_JOINED" ||
        event.type === "USER_LEFT"
      ) {
        await forwardToSite(event);
      }
      await forwardToApp(event);
    })();
  } else {
    void forwardToApp(event);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  state.appTabIds.delete(tabId);
  if (state.siteTabId === tabId) {
    state.siteTabId = null;
    state.siteFrameId = null;
  }
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete" && tab.url?.startsWith("https://filmapik.college")) {
    state.siteTabId = tabId;
    void injectAgentFrames(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_STATUS") {
    sendResponse({
      appTabs: [...state.appTabIds],
      siteTabId: state.siteTabId,
    });
    return true;
  }
});
