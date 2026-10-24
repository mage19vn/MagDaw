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
export interface InstrumentConfig {
  preset: "auto" | "sine" | "triangle" | "sawtooth" | "square";
}
export interface Track {
  id: string;
  name: string;
  program: number;
  is_drum: boolean;
  instrument_config: InstrumentConfig;
  volume_db: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  clips: Clip[];
}
export interface Master {
  gain_bypass: boolean;
  gain_db: number;
  compressor: {
    bypass: boolean;
    threshold_db: number;
    ratio: number;
    attack_ms: number;
    release_ms: number;
  };
  reverb: { bypass: boolean; wet: number; room_size: number };
  limiter: { bypass: boolean; ceiling_db: number };
}
export interface Project {
  schema_version: 1;
  id: string;
  name: string;
  bpm: number;
  time_signature: [number, number];
  tracks: Track[];
  loop: { enabled: boolean; start_beat: number; end_beat: number };
  master: Master;
}
export interface Selection {
  trackId: string | null;
  clipId: string | null;
  noteIds: string[];
}
export interface EditorSnapshot {
  project: Project;
  selection: Selection;
}
export const DEFAULT_MASTER: Master = {
  gain_bypass: false,
  gain_db: 0,
  compressor: {
    bypass: false,
    threshold_db: -18,
    ratio: 3,
    attack_ms: 10,
    release_ms: 100,
  },
  reverb: { bypass: false, wet: 0.2, room_size: 0.5 },
  limiter: { bypass: false, ceiling_db: -1 },
};
export const createId = (): string => crypto.randomUUID();
export const audibleTracks = (project: Project): Track[] =>
  project.tracks.filter(
    (t) => !t.mute && (!project.tracks.some((x) => x.solo) || t.solo),
  );
export const projectEnd = (project: Project): number =>
  Math.max(
    4,
    ...project.tracks.flatMap((t) =>
      t.clips.map((c) => c.start_beat + c.length_beats),
    ),
  );
export const beatsPerBar = (signature: [number, number]): number =>
  (signature[0] * 4) / signature[1];
export const pitchName = (pitch: number): string =>
  `${["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][pitch % 12]}${Math.floor(pitch / 12) - 1}`;
