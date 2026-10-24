import type { Clip, Project } from "../types";
import { newId } from "../types";

export function createClip(
  project: Project,
  trackId: string,
  startBeat: number,
  lengthBeats: number,
): Project {
  const clip: Clip = {
    id: newId("clip"),
    name: "Clip mới",
    start_beat: Math.max(0, startBeat),
    length_beats: Math.max(1, lengthBeats),
    notes: [],
  };
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id === trackId
        ? { ...track, clips: [...track.clips, clip] }
        : track,
    ),
  };
}

export function moveClip(
  project: Project,
  trackId: string,
  clipId: string,
  newStartBeat: number,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id !== trackId
        ? track
        : {
            ...track,
            clips: track.clips.map((clip) =>
              clip.id === clipId
                ? { ...clip, start_beat: Math.max(0, newStartBeat) }
                : clip,
            ),
          },
    ),
  };
}

export function duplicateClip(
  project: Project,
  trackId: string,
  clipId: string,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) => {
      if (track.id !== trackId) return track;
      const source = track.clips.find((c) => c.id === clipId);
      if (!source) return track;
      const copy: Clip = {
        ...source,
        id: newId("clip"),
        name: `${source.name} (bản sao)`,
        start_beat: source.start_beat + source.length_beats,
        notes: source.notes.map((note) => ({ ...note, id: newId("note") })),
      };
      return { ...track, clips: [...track.clips, copy] };
    }),
  };
}

export function deleteClip(
  project: Project,
  trackId: string,
  clipId: string,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id !== trackId
        ? track
        : {
            ...track,
            clips: track.clips.filter((clip) => clip.id !== clipId),
          },
    ),
  };
}

export function renameClip(
  project: Project,
  trackId: string,
  clipId: string,
  name: string,
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id !== trackId
        ? track
        : {
            ...track,
            clips: track.clips.map((clip) =>
              clip.id === clipId ? { ...clip, name } : clip,
            ),
          },
    ),
  };
}
