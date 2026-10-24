import type { Project, Track } from "../types";
import { newId } from "../types";

export function addTrack(project: Project, name?: string): Project {
  const track: Track = {
    id: newId("track"),
    name: name ?? `Track ${project.tracks.length + 1}`,
    program: 0,
    is_drum: false,
    volume_db: 0,
    pan: 0,
    mute: false,
    solo: false,
    clips: [],
  };
  return { ...project, tracks: [...project.tracks, track] };
}

export function removeTrack(project: Project, trackId: string): Project {
  return {
    ...project,
    tracks: project.tracks.filter((track) => track.id !== trackId),
  };
}

export function renameTrack(
  project: Project,
  trackId: string,
  name: string,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === trackId ? { ...track, name } : track,
    ),
  };
}

export function moveTrack(
  project: Project,
  trackId: string,
  direction: -1 | 1,
): Project {
  const index = project.tracks.findIndex((t) => t.id === trackId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= project.tracks.length) {
    return project;
  }
  const tracks = [...project.tracks];
  [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
  return { ...project, tracks };
}

export function setTrackInstrument(
  project: Project,
  trackId: string,
  program: number,
  isDrum: boolean,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === trackId
        ? {
            ...track,
            program: Math.min(127, Math.max(0, Math.round(program))),
            is_drum: isDrum,
          }
        : track,
    ),
  };
}

export function setTrackVolume(
  project: Project,
  trackId: string,
  volumeDb: number,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === trackId
        ? { ...track, volume_db: Math.min(12, Math.max(-60, volumeDb)) }
        : track,
    ),
  };
}

export function setTrackPan(
  project: Project,
  trackId: string,
  pan: number,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === trackId
        ? { ...track, pan: Math.min(1, Math.max(-1, pan)) }
        : track,
    ),
  };
}

export function setTrackMute(
  project: Project,
  trackId: string,
  mute: boolean,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === trackId ? { ...track, mute } : track,
    ),
  };
}

export function setTrackSolo(
  project: Project,
  trackId: string,
  solo: boolean,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === trackId ? { ...track, solo } : track,
    ),
  };
}

export function updateMasterSettings(
  project: Project,
  patch: Partial<Project["master_settings"]>,
): Project {
  return {
    ...project,
    master_settings: { ...project.master_settings, ...patch },
  };
}
