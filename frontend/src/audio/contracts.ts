import type { Project, Track } from "../domain/types";

export interface AudioMeters {
  master: number;
  tracks: Record<string, number>;
}

export interface AudioEngine {
  initialize(): Promise<void>;
  setProject(project: Project): void;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(beat: number): void;
  getPosition(): number;
  isPlaying(): boolean;
  setMetronome(enabled: boolean): void;
  audition(track: Track, pitch: number, velocity?: number): Promise<void>;
  getMeters(): AudioMeters;
  dispose(): void;
}
