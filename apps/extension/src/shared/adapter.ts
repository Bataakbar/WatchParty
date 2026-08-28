export interface MediaAdapter {
  detect(): boolean;
  getUrl(): string | null;
  getMediaId(): string | null;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(position: number): Promise<void>;
  getPosition(): number;
  getDuration(): number;
  setPlaybackRate(rate: number): Promise<void>;
  isPlaying(): boolean;
}

export type PlayerChangeType = "play" | "pause" | "seek" | "ratechange" | "ended";

export interface PlayerChangeListener {
  (change: { type: PlayerChangeType; position: number; rate: number }): void;
}
