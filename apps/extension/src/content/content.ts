import { startAppRelay } from "./app-relay";
import { startEmbedAgent } from "./embed-agent";
import { startSiteAgent } from "./site-agent";

window.addEventListener("error", (event) => {
  if (
    event.message?.includes("Extension context invalidated") ||
    event.error?.message?.includes("Extension context invalidated")
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

const isApp =
  location.origin === "http://localhost:3000" ||
  location.origin === "http://127.0.0.1:3000" ||
  location.host.includes("localhost:3000");

if (isApp) {
  startAppRelay();
} else if (window.top !== window.self) {
  startEmbedAgent();
} else if (location.hostname.includes("filmapik")) {
  startSiteAgent();
}

