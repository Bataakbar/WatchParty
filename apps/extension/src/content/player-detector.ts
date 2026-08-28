import type { PlayerChangeListener } from "../shared/adapter";

interface Candidate {
  video: HTMLVideoElement;
  score: number;
}

function visibilityScore(video: HTMLVideoElement): number {
  const style = window.getComputedStyle(video);
  if (style.visibility === "hidden" || style.display === "none") return 0;
  const rect = video.getBoundingClientRect();
  let score = 10;
  if (rect.width > 0 && rect.height > 0) {
    score += (rect.width * rect.height) / 10000;
  }
  if (video.src || video.currentSrc || video.querySelector("source")) {
    score += 50;
  }
  if (!video.paused) {
    score += 100;
  }
  return score;
}

export function findVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll("video"));
  let best: Candidate | null = null;
  for (const video of videos) {
    const score = visibilityScore(video);
    if (score > 0 && (!best || score > best.score)) {
      best = { video, score };
    }
  }
  return best?.video ?? null;
}

export function waitForVideo(
  timeoutMs: number,
  onFound: (video: HTMLVideoElement) => void,
  onTimeout?: () => void,
): void {
  const existing = findVideo();
  if (existing) {
    onFound(existing);
    return;
  }
  let settled = false;
  const observer = new MutationObserver(() => {
    const found = findVideo();
    if (found && !settled) {
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      onFound(found);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const timer = setTimeout(() => {
    const late = findVideo();
    if (late && !settled) {
      settled = true;
      observer.disconnect();
      onFound(late);
      return;
    }
    if (!settled) {
      settled = true;
      observer.disconnect();
      onTimeout?.();
    }
  }, timeoutMs);
}

export function attachListeners(
  video: HTMLVideoElement,
  listener: PlayerChangeListener,
): () => void {
  const makeHandler =
    (type: Parameters<PlayerChangeListener>[0]["type"]) =>
    () => {
      listener({
        type,
        position: video.currentTime,
        rate: video.playbackRate,
      });
    };
  const handlers = {
    play: makeHandler("play"),
    pause: makeHandler("pause"),
    seeked: makeHandler("seek"),
    ratechange: makeHandler("ratechange"),
    ended: makeHandler("ended"),
  };
  for (const [event, handler] of Object.entries(handlers)) {
    video.addEventListener(event, handler, true);
  }
  return () => {
    for (const [event, handler] of Object.entries(handlers)) {
      video.removeEventListener(event, handler, true);
    }
  };
}
