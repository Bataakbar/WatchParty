import type { MediaAdapter, PlayerChangeListener } from "../shared/adapter";
import { attachListeners } from "./player-detector";

export class GenericHTML5VideoAdapter implements MediaAdapter {
  protected video: HTMLVideoElement | null = null;
  protected detach: (() => void) | null = null;
  protected listener: PlayerChangeListener | null = null;

  setVideo(video: HTMLVideoElement): void {
    this.detach?.();
    this.video = video;
    this.detach = attachListeners(video, (change) => this.listener?.(change));
  }

  setChangeListener(listener: PlayerChangeListener): void {
    this.listener = listener;
  }

  detect(): boolean {
    return this.video !== null && document.contains(this.video);
  }

  getUrl(): string | null {
    return typeof window !== "undefined" ? window.location.href : null;
  }

  getMediaId(): string | null {
    return null;
  }

  async play(): Promise<void> {
    if (!this.video) return;
    try {
      await this.video.play();
    } catch {
      this.video.muted = true;
      await this.video.play().catch(() => {});
    }
  }

  async pause(): Promise<void> {
    this.video?.pause();
  }

  async seek(position: number): Promise<void> {
    if (!this.video) return;
    const target = Math.min(Math.max(0, position), this.getDuration());
    this.video.currentTime = Number.isFinite(target) ? target : position;
  }

  getPosition(): number {
    return this.video?.currentTime ?? 0;
  }

  getDuration(): number {
    const duration = this.video?.duration ?? NaN;
    return Number.isFinite(duration) ? duration : 0;
  }

  async setPlaybackRate(rate: number): Promise<void> {
    if (!this.video) return;
    try {
      this.video.playbackRate = rate;
    } catch {
      // player rejected rate
    }
  }

  isPlaying(): boolean {
    return this.video ? !this.video.paused && !this.video.ended : false;
  }
}
