import { createId, DEFAULT_MASTER } from "./types";
import type { Clip, Note, Project, Track, Master } from "./types";
import { validateProject } from "./validation";
import { snapBeat } from "./time";

export function editProject(
  project: Project,
  recipe: (draft: Project) => void,
): Project {
  const draft = structuredClone(project);
  recipe(draft);
  return validateProject(draft);
}
export function findTrack(project: Project, trackId: string): Track {
  const track = project.tracks.find((item) => item.id === trackId);
  if (!track) throw new Error("Không tìm thấy track.");
  return track;
}
export function findClip(
  project: Project,
  trackId: string,
  clipId: string,
): Clip {
  const clip = findTrack(project, trackId).clips.find(
    (item) => item.id === clipId,
  );
  if (!clip) throw new Error("Không tìm thấy clip.");
  return clip;
}
function expandClip(clip: Clip): void {
  clip.length_beats = Math.max(
    clip.length_beats,
    ...clip.notes.map((note) => note.start_beat + note.length_beat),
  );
}
function selectedNotes(clip: Clip, noteIds: readonly string[]): Note[] {
  const notes = clip.notes.filter((note) => noteIds.includes(note.id));
  if (notes.length !== new Set(noteIds).size)
    throw new Error("Không tìm thấy một hoặc nhiều note.");
  return notes;
}
export function addNote(
  project: Project,
  trackId: string,
  clipId: string,
  note: Note,
): Project {
  return editProject(project, (draft) => {
    const clip = findClip(draft, trackId, clipId);
    clip.notes.push(structuredClone(note));
    expandClip(clip);
  });
}
export function updateNote(
  project: Project,
  trackId: string,
  clipId: string,
  noteId: string,
  changes: Partial<Omit<Note, "id">>,
): Project {
  return editProject(project, (draft) => {
    const clip = findClip(draft, trackId, clipId);
    const [note] = selectedNotes(clip, [noteId]);
    Object.assign(note, changes);
    expandClip(clip);
  });
}
export function deleteNotes(
  project: Project,
  trackId: string,
  clipId: string,
  noteIds: readonly string[],
): Project {
  return editProject(project, (draft) => {
    const clip = findClip(draft, trackId, clipId);
    selectedNotes(clip, noteIds);
    clip.notes = clip.notes.filter((note) => !noteIds.includes(note.id));
  });
}
export function moveNotes(
  project: Project,
  trackId: string,
  clipId: string,
  noteIds: readonly string[],
  beatDelta: number,
  pitchDelta: number,
): Project {
  return editProject(project, (draft) => {
    if (!Number.isFinite(beatDelta) || !Number.isInteger(pitchDelta))
      throw new Error(
        "Độ dịch beat phải hữu hạn và độ dịch pitch phải là số nguyên.",
      );
    const clip = findClip(draft, trackId, clipId);
    const notes = selectedNotes(clip, noteIds);
    if (!notes.length) return;
    const clampedBeatDelta = Math.max(
      beatDelta,
      -Math.min(...notes.map((note) => note.start_beat)),
    );
    const clampedPitchDelta = Math.min(
      127 - Math.max(...notes.map((note) => note.pitch)),
      Math.max(pitchDelta, -Math.min(...notes.map((note) => note.pitch))),
    );
    notes.forEach((note) => {
      note.start_beat += clampedBeatDelta;
      note.pitch += clampedPitchDelta;
    });
    expandClip(clip);
  });
}
export function resizeNotes(
  project: Project,
  trackId: string,
  clipId: string,
  noteIds: readonly string[],
  lengthDelta: number,
  minimumLength = 1 / 64,
): Project {
  return editProject(project, (draft) => {
    if (!Number.isFinite(lengthDelta))
      throw new Error("Độ thay đổi độ dài phải hữu hạn.");
    if (!Number.isFinite(minimumLength) || minimumLength <= 0)
      throw new Error("Độ dài note tối thiểu phải lớn hơn 0.");
    const clip = findClip(draft, trackId, clipId);
    const notes = selectedNotes(clip, noteIds);
    if (!notes.length) return;
    const delta = Math.max(
      lengthDelta,
      minimumLength - Math.min(...notes.map((note) => note.length_beat)),
    );
    notes.forEach((note) => {
      note.length_beat += delta;
    });
    expandClip(clip);
  });
}
export function duplicateNotes(
  project: Project,
  trackId: string,
  clipId: string,
  noteIds: readonly string[],
  beatOffset?: number,
): Project {
  return editProject(project, (draft) => {
    const clip = findClip(draft, trackId, clipId);
    const notes = selectedNotes(clip, noteIds);
    if (!notes.length) return;
    const offset =
      beatOffset ??
      Math.max(...notes.map((note) => note.start_beat + note.length_beat)) -
        Math.min(...notes.map((note) => note.start_beat));
    clip.notes.push(
      ...notes.map((note) => ({
        ...note,
        id: createId(),
        start_beat: note.start_beat + offset,
      })),
    );
    expandClip(clip);
  });
}
export function pasteNotes(
  project: Project,
  trackId: string,
  clipId: string,
  notes: readonly Note[],
  startBeat: number,
): Project {
  return editProject(project, (draft) => {
    if (!notes.length) return;
    const clip = findClip(draft, trackId, clipId);
    const first = Math.min(...notes.map((note) => note.start_beat));
    clip.notes.push(
      ...notes.map((note) => ({
        ...note,
        id: createId(),
        start_beat: startBeat + note.start_beat - first,
      })),
    );
    expandClip(clip);
  });
}
/** Quantize starts and durations to nearest grid, ties later; at least one grid unit. */
export function quantizeNotes(
  project: Project,
  trackId: string,
  clipId: string,
  noteIds: readonly string[],
  grid: number,
): Project {
  return editProject(project, (draft) => {
    if (!Number.isFinite(grid) || grid <= 0)
      throw new Error("Hãy chọn lưới snap trước khi quantize.");
    const clip = findClip(draft, trackId, clipId);
    selectedNotes(clip, noteIds).forEach((note) => {
      note.start_beat = snapBeat(note.start_beat, grid);
      note.length_beat = Math.max(grid, snapBeat(note.length_beat, grid));
    });
    expandClip(clip);
  });
}
export function setNoteVelocity(
  project: Project,
  trackId: string,
  clipId: string,
  noteIds: readonly string[],
  velocity: number,
): Project {
  return editProject(project, (draft) => {
    selectedNotes(findClip(draft, trackId, clipId), noteIds).forEach((note) => {
      note.velocity = velocity;
    });
  });
}
export function createClip(
  project: Project,
  trackId: string,
  clip: Clip,
): Project {
  return editProject(project, (draft) => {
    findTrack(draft, trackId).clips.push(structuredClone(clip));
  });
}
export function moveClip(
  project: Project,
  trackId: string,
  clipId: string,
  startBeat: number,
  destinationTrackId = trackId,
): Project {
  return editProject(project, (draft) => {
    const clip = findClip(draft, trackId, clipId);
    clip.start_beat = startBeat;
    if (destinationTrackId !== trackId) {
      findTrack(draft, trackId).clips = findTrack(draft, trackId).clips.filter(
        (item) => item.id !== clipId,
      );
      findTrack(draft, destinationTrackId).clips.push(clip);
    }
  });
}
export function duplicateClip(
  project: Project,
  trackId: string,
  clipId: string,
): Project {
  return editProject(project, (draft) => {
    const track = findTrack(draft, trackId);
    const clip = findClip(draft, trackId, clipId);
    track.clips.push({
      ...structuredClone(clip),
      id: createId(),
      name: `${clip.name} (bản sao)`,
      start_beat: clip.start_beat + clip.length_beats,
      notes: clip.notes.map((note) => ({ ...note, id: createId() })),
    });
  });
}
export function deleteClip(
  project: Project,
  trackId: string,
  clipId: string,
): Project {
  return editProject(project, (draft) => {
    const track = findTrack(draft, trackId);
    findClip(draft, trackId, clipId);
    track.clips = track.clips.filter((clip) => clip.id !== clipId);
  });
}
export function newTrack(name = "Nhạc cụ mới"): Track {
  return {
    id: createId(),
    name,
    program: 0,
    is_drum: false,
    instrument_config: { preset: "auto" },
    volume_db: -9,
    pan: 0,
    mute: false,
    solo: false,
    clips: [],
  };
}
export function addTrack(project: Project, track: Track = newTrack()): Project {
  return editProject(project, (draft) => {
    draft.tracks.push(structuredClone(track));
  });
}
export function removeTrack(project: Project, trackId: string): Project {
  return editProject(project, (draft) => {
    findTrack(draft, trackId);
    draft.tracks = draft.tracks.filter((track) => track.id !== trackId);
  });
}
export function reorderTrack(
  project: Project,
  trackId: string,
  destinationIndex: number,
): Project {
  return editProject(project, (draft) => {
    if (
      !Number.isInteger(destinationIndex) ||
      destinationIndex < 0 ||
      destinationIndex >= draft.tracks.length
    )
      throw new Error("Thứ tự track không hợp lệ.");
    const sourceIndex = draft.tracks.findIndex((track) => track.id === trackId);
    findTrack(draft, trackId);
    const [track] = draft.tracks.splice(sourceIndex, 1);
    draft.tracks.splice(destinationIndex, 0, track);
  });
}
export function updateTrackMixer(
  project: Project,
  trackId: string,
  changes: Partial<Pick<Track, "volume_db" | "pan" | "mute" | "solo">>,
): Project {
  return editProject(project, (draft) => {
    Object.assign(findTrack(draft, trackId), changes);
  });
}
export function newProject(name = "Bản nhạc mới"): Project {
  return {
    schema_version: 1,
    id: createId(),
    name,
    bpm: 100,
    time_signature: [4, 4],
    tracks: [],
    loop: { enabled: false, start_beat: 0, end_beat: 16 },
    master: structuredClone(DEFAULT_MASTER),
  };
}
export function updateTrack(
  project: Project,
  trackId: string,
  changes: Partial<Omit<Track, "id" | "clips">>,
): Project {
  return editProject(project, (draft) => {
    Object.assign(findTrack(draft, trackId), changes);
  });
}
export function updateClip(
  project: Project,
  trackId: string,
  clipId: string,
  changes: Partial<Omit<Clip, "id" | "notes">>,
): Project {
  return editProject(project, (draft) => {
    const clip = findClip(draft, trackId, clipId);
    Object.assign(clip, changes);
    expandClip(clip);
  });
}

export function updateMaster(
  project: Project,
  changes: Partial<Master>,
): Project {
  return editProject(project, (draft) => {
    Object.assign(draft.master, changes);
  });
}
export function updateMasterEffect<
  K extends "compressor" | "reverb" | "limiter",
>(project: Project, effect: K, changes: Partial<Master[K]>): Project {
  return editProject(project, (draft) => {
    Object.assign(draft.master[effect], changes);
  });
}
