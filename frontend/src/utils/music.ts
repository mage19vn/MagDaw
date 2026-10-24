import type { SnapValue } from "../types";

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export function pitchName(pitch: number): string {
  const name = NOTE_NAMES[((pitch % 12) + 12) % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${name}${octave}`;
}

export function beatToSeconds(beat: number, bpm: number): number {
  return (beat * 60) / bpm;
}

export function secondsToBeat(seconds: number, bpm: number): number {
  return (seconds * bpm) / 60;
}

export function snapBeat(beat: number, snap: SnapValue): number {
  if (snap === 0) return Math.max(0, beat);
  return Math.max(0, Math.round(beat / snap) * snap);
}

export function formatBarBeat(
  beat: number,
  beatsPerBar: number,
): string {
  const total = Math.max(0, beat);
  const bar = Math.floor(total / beatsPerBar) + 1;
  const beatInBar = Math.floor(total % beatsPerBar) + 1;
  const tick = Math.round((total % 1) * 100);
  return `${bar}:${beatInBar}:${tick.toString().padStart(2, "0")}`;
}

export function projectEndBeat(
  tracks: { clips: { start_beat: number; length_beats: number }[] }[],
): number {
  let end = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.start_beat + clip.length_beats);
    }
  }
  return end;
}

export function audibleTrackIds(tracks: {
  id: string;
  mute: boolean;
  solo: boolean;
}[]): Set<string> {
  const soloed = tracks.filter((t) => t.solo);
  if (soloed.length > 0) {
    return new Set(soloed.filter((t) => !t.mute).map((t) => t.id));
  }
  return new Set(tracks.filter((t) => !t.mute).map((t) => t.id));
}
