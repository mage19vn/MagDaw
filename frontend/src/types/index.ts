export interface Note {
  id: string;
  pitch: number;
  start_beat: number;
  length_beat: number;
  velocity: number;
}

export interface Clip {
  id: string;
  name: string;
  start_beat: number;
  length_beats: number;
  notes: Note[];
}

export interface Track {
  id: string;
  name: string;
  program: number;
  is_drum: boolean;
  volume_db: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  clips: Clip[];
}

export interface LoopRange {
  start_beat: number;
  end_beat: number;
  enabled: boolean;
}

export interface MasterSettings {
  master_gain_db: number;
  compressor_enabled: boolean;
  compressor_threshold_db: number;
  compressor_ratio: number;
  reverb_enabled: boolean;
  reverb_wet: number;
  limiter_enabled: boolean;
  limiter_ceiling_db: number;
}

export interface Project {
  schema_version: number;
  name: string;
  bpm: number;
  time_signature: [number, number];
  tracks: Track[];
  loop_range: LoopRange;
  master_settings: MasterSettings;
}

export type SnapValue = 0 | 0.25 | 0.5 | 1;

export const TRACK_COLORS = [
  "#e5484d",
  "#f76b15",
  "#ffb224",
  "#46a758",
  "#0091ff",
  "#8e4ec6",
  "#d6409f",
  "#12a594",
];

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}
