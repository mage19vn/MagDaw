import type { Clip, Note, Project } from "../types";
import { newId } from "../types";

export const MIN_NOTE_LENGTH = 0.25;

function clampNoteToClip(note: Note, clip: Clip): Note {
  const length = Math.max(
    MIN_NOTE_LENGTH,
    Math.min(note.length_beat, clip.length_beats),
  );
  const start = Math.min(
    Math.max(0, note.start_beat),
    Math.max(0, clip.length_beats - length),
  );
  return {
    ...note,
    start_beat: start,
    length_beat: Math.min(length, clip.length_beats - start),
  };
}

function updateClipNotes(
  project: Project,
  trackId: string,
  clipId: string,
  updater: (notes: Note[]) => Note[],
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.id !== trackId
        ? track
        : {
            ...track,
            clips: track.clips.map((clip) =>
              clip.id !== clipId
                ? clip
                : { ...clip, notes: updater(clip.notes) },
            ),
          },
    ),
  };
}

export function findClip(
  project: Project,
  trackId: string,
  clipId: string,
): Clip | undefined {
  return project.tracks
    .find((t) => t.id === trackId)
    ?.clips.find((c) => c.id === clipId);
}

export function addNote(
  project: Project,
  trackId: string,
  clipId: string,
  note: Note,
): Project {
  const clip = findClip(project, trackId, clipId);
  if (!clip) return project;
  const clamped = clampNoteToClip(note, clip);
  return updateClipNotes(project, trackId, clipId, (notes) => [
    ...notes,
    clamped,
  ]);
}

export function updateNote(
  project: Project,
  trackId: string,
  clipId: string,
  noteId: string,
  patch: Partial<Omit<Note, "id">>,
): Project {
  const clip = findClip(project, trackId, clipId);
  if (!clip) return project;
  return updateClipNotes(project, trackId, clipId, (notes) =>
    notes.map((note) =>
      note.id !== noteId
        ? note
        : clampNoteToClip(
            {
              ...note,
              ...patch,
              pitch: Math.min(127, Math.max(0, patch.pitch ?? note.pitch)),
              velocity: Math.min(
                127,
                Math.max(1, patch.velocity ?? note.velocity),
              ),
            },
            clip,
          ),
    ),
  );
}

export function deleteNotes(
  project: Project,
  trackId: string,
  clipId: string,
  noteIds: Set<string>,
): Project {
  return updateClipNotes(project, trackId, clipId, (notes) =>
    notes.filter((note) => !noteIds.has(note.id)),
  );
}

export function moveNotes(
  project: Project,
  trackId: string,
  clipId: string,
  noteIds: Set<string>,
  deltaBeats: number,
  deltaPitch: number,
): Project {
  const clip = findClip(project, trackId, clipId);
  if (!clip) return project;
  return updateClipNotes(project, trackId, clipId, (notes) =>
    notes.map((note) =>
      noteIds.has(note.id)
        ? clampNoteToClip(
            {
              ...note,
              start_beat: note.start_beat + deltaBeats,
              pitch: Math.min(127, Math.max(0, note.pitch + deltaPitch)),
            },
            clip,
          )
        : note,
    ),
  );
}

export function resizeNote(
  project: Project,
  trackId: string,
  clipId: string,
  noteId: string,
  newLengthBeat: number,
): Project {
  return updateNote(project, trackId, clipId, noteId, {
    length_beat: newLengthBeat,
  });
}

export function duplicateNotes(
  project: Project,
  trackId: string,
  clipId: string,
  noteIds: Set<string>,
  beatOffset: number,
): Project {
  const clip = findClip(project, trackId, clipId);
  if (!clip) return project;
  const copies = clip.notes
    .filter((note) => noteIds.has(note.id))
    .map((note) =>
      clampNoteToClip(
        { ...note, id: newId("note"), start_beat: note.start_beat + beatOffset },
        clip,
      ),
    );
  return updateClipNotes(project, trackId, clipId, (notes) => [
    ...notes,
    ...copies,
  ]);
}

export function setNoteVelocity(
  project: Project,
  trackId: string,
  clipId: string,
  noteIds: Set<string>,
  velocity: number,
): Project {
  const clamped = Math.min(127, Math.max(1, Math.round(velocity)));
  return updateClipNotes(project, trackId, clipId, (notes) =>
    notes.map((note) =>
      noteIds.has(note.id) ? { ...note, velocity: clamped } : note,
    ),
  );
}

export function quantizeNotes(
  project: Project,
  trackId: string,
  clipId: string,
  noteIds: Set<string>,
  snap: number,
): Project {
  if (snap <= 0) return project;
  const clip = findClip(project, trackId, clipId);
  if (!clip) return project;
  return updateClipNotes(project, trackId, clipId, (notes) =>
    notes.map((note) =>
      noteIds.has(note.id)
        ? clampNoteToClip(
            {
              ...note,
              start_beat: Math.round(note.start_beat / snap) * snap,
            },
            clip,
          )
        : note,
    ),
  );
}
