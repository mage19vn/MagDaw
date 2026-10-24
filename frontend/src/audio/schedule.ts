import type { Project } from "../types";
import { audibleTrackIds, beatToSeconds } from "../utils/music";

export type DrumKind = "kick" | "snare" | "hihat" | "other";

export interface ScheduledEvent {
  time: number;
  trackId: string;
  pitch: number;
  duration: number;
  velocity: number;
  isDrum: boolean;
  drumKind: DrumKind;
}

export function drumKindForPitch(pitch: number): DrumKind {
  if (pitch === 36) return "kick";
  if (pitch === 38) return "snare";
  if (pitch === 42 || pitch === 46) return "hihat";
  if (pitch < 38) return "kick";
  if (pitch <= 40) return "snare";
  return "hihat";
}

export function buildScheduleEvents(project: Project): ScheduledEvent[] {
  const audible = audibleTrackIds(project.tracks);
  const events: ScheduledEvent[] = [];
  for (const track of project.tracks) {
    if (!audible.has(track.id)) continue;
    for (const clip of track.clips) {
      for (const note of clip.notes) {
        const absoluteBeat = clip.start_beat + note.start_beat;
        events.push({
          time: beatToSeconds(absoluteBeat, project.bpm),
          trackId: track.id,
          pitch: note.pitch,
          duration: beatToSeconds(note.length_beat, project.bpm),
          velocity: note.velocity,
          isDrum: track.is_drum,
          drumKind: drumKindForPitch(note.pitch),
        });
      }
    }
  }
  events.sort((a, b) => a.time - b.time);
  return events;
}

export function songEndSeconds(project: Project): number {
  let endBeat = 0;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      endBeat = Math.max(endBeat, clip.start_beat + clip.length_beats);
    }
  }
  return beatToSeconds(endBeat, project.bpm);
}
