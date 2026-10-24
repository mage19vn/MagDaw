import { create } from "zustand";
import * as engine from "../audio/engine";
import { addNote, deleteNotes, duplicateNotes, moveNotes, quantizeNotes, resizeNote, setNoteVelocity, updateNote } from "../features/notes";
import { createClip, deleteClip, duplicateClip, moveClip, renameClip } from "../features/clips";
import { addTrack, moveTrack, removeTrack, renameTrack, setTrackInstrument, setTrackMute, setTrackPan, setTrackSolo, setTrackVolume, updateMasterSettings } from "../features/tracks";
import type { Clip, Note, Project, SnapValue } from "../types";
import { newId } from "../types";

interface DawState {
  project: Project | null;
  loading: boolean;
  notice: string | null;
  noticeKind: "info" | "error" | "success";
  selectedTrackId: string | null;
  selectedClipId: string | null;
  selectedNoteIds: Set<string>;
  clipboard: Note[];
  playing: boolean;
  playheadBeat: number;
  metronome: boolean;
  snap: SnapValue;
  dirty: boolean;
  past: Project[];
  future: Project[];

  setProject: (project: Project, markDirty?: boolean) => void;
  setNotice: (message: string | null, kind?: "info" | "error" | "success") => void;
  setLoading: (loading: boolean) => void;
  applyEdit: (next: Project) => void;
  undo: () => void;
  redo: () => void;
  selectClip: (trackId: string | null, clipId: string | null) => void;
  setSelectedNoteIds: (ids: Set<string>) => void;
  setSnap: (snap: SnapValue) => void;
  setMetronome: (on: boolean) => void;
  setBpm: (bpm: number) => void;

  addNoteToClip: (trackId: string, clipId: string, note: Omit<Note, "id">) => string;
  updateNoteInClip: (trackId: string, clipId: string, noteId: string, patch: Partial<Omit<Note, "id">>) => void;
  deleteSelectedNotes: () => void;
  moveSelectedNotes: (deltaBeats: number, deltaPitch: number) => void;
  resizeSelectedNote: (noteId: string, lengthBeat: number) => void;
  duplicateSelectedNotes: () => void;
  setSelectedVelocity: (velocity: number) => void;
  quantizeSelectedNotes: () => void;
  copySelectedNotes: () => void;
  pasteNotes: () => void;

  addTrackAction: () => void;
  removeTrackAction: (trackId: string) => void;
  renameTrackAction: (trackId: string, name: string) => void;
  moveTrackAction: (trackId: string, direction: -1 | 1) => void;
  setInstrumentAction: (trackId: string, program: number, isDrum: boolean) => void;
  setVolumeAction: (trackId: string, volumeDb: number) => void;
  setPanAction: (trackId: string, pan: number) => void;
  setMuteAction: (trackId: string, mute: boolean) => void;
  setSoloAction: (trackId: string, solo: boolean) => void;
  createClipAction: (trackId: string, startBeat: number, lengthBeats: number) => void;
  moveClipAction: (trackId: string, clipId: string, startBeat: number) => void;
  duplicateClipAction: (trackId: string, clipId: string) => void;
  deleteClipAction: (trackId: string, clipId: string) => void;
  renameClipAction: (trackId: string, clipId: string, name: string) => void;
  updateMasterAction: (patch: Partial<Project["master_settings"]>) => void;
  setLoopAction: (startBeat: number, endBeat: number, enabled: boolean) => void;

  play: (fromBeat?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (beat: number) => void;
  setPlayheadBeat: (beat: number) => void;
  handlePlaybackEnded: () => void;
}

function selectedClipOf(state: DawState): Clip | null {
  if (!state.project || !state.selectedTrackId || !state.selectedClipId) return null;
  return (
    state.project.tracks
      .find((t) => t.id === state.selectedTrackId)
      ?.clips.find((c) => c.id === state.selectedClipId) ?? null
  );
}

export const useDaw = create<DawState>((set, get) => ({
  project: null,
  loading: true,
  notice: null,
  noticeKind: "info",
  selectedTrackId: null,
  selectedClipId: null,
  selectedNoteIds: new Set(),
  clipboard: [],
  playing: false,
  playheadBeat: 0,
  metronome: false,
  snap: 0.25,
  dirty: false,
  past: [],
  future: [],

  setProject: (project, markDirty = false) =>
    set({
      project,
      dirty: markDirty,
      past: [],
      future: [],
      selectedTrackId: project.tracks[0]?.id ?? null,
      selectedClipId: project.tracks[0]?.clips[0]?.id ?? null,
      selectedNoteIds: new Set(),
    }),

  setNotice: (message, kind = "info") =>
    set({ notice: message, noticeKind: kind }),

  setLoading: (loading) => set({ loading }),

  applyEdit: (next) => {
    const { project, past } = get();
    if (!project) return;
    set({
      project: next,
      past: [...past.slice(-99), project],
      future: [],
      dirty: true,
    });
  },

  undo: () => {
    const { past, project, future } = get();
    if (!project || past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      project: previous,
      past: past.slice(0, -1),
      future: [project, ...future],
      dirty: true,
      selectedNoteIds: new Set(),
    });
  },

  redo: () => {
    const { future, project, past } = get();
    if (!project || future.length === 0) return;
    const [next, ...rest] = future;
    set({
      project: next,
      past: [...past, project],
      future: rest,
      dirty: true,
      selectedNoteIds: new Set(),
    });
  },

  selectClip: (trackId, clipId) =>
    set({ selectedTrackId: trackId, selectedClipId: clipId, selectedNoteIds: new Set() }),

  setSelectedNoteIds: (ids) => set({ selectedNoteIds: ids }),

  setSnap: (snap) => set({ snap }),

  setMetronome: (on) => set({ metronome: on }),

  setBpm: (bpm) => {
    const { project, applyEdit } = get();
    if (!project || bpm <= 0) return;
    applyEdit({ ...project, bpm });
    engine.setTempo(bpm);
  },

  addNoteToClip: (trackId, clipId, note) => {
    const { project, applyEdit } = get();
    const id = newId("note");
    if (!project) return id;
    applyEdit(addNote(project, trackId, clipId, { ...note, id }));
    set({ selectedNoteIds: new Set([id]) });
    return id;
  },

  updateNoteInClip: (trackId, clipId, noteId, patch) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(updateNote(project, trackId, clipId, noteId, patch));
  },

  deleteSelectedNotes: () => {
    const state = get();
    const { project, selectedTrackId, selectedClipId, selectedNoteIds } = state;
    if (!project || !selectedTrackId || !selectedClipId || selectedNoteIds.size === 0) return;
    state.applyEdit(deleteNotes(project, selectedTrackId, selectedClipId, selectedNoteIds));
    set({ selectedNoteIds: new Set() });
  },

  moveSelectedNotes: (deltaBeats, deltaPitch) => {
    const state = get();
    const { project, selectedTrackId, selectedClipId, selectedNoteIds } = state;
    if (!project || !selectedTrackId || !selectedClipId || selectedNoteIds.size === 0) return;
    state.applyEdit(moveNotes(project, selectedTrackId, selectedClipId, selectedNoteIds, deltaBeats, deltaPitch));
  },

  resizeSelectedNote: (noteId, lengthBeat) => {
    const state = get();
    const { project, selectedTrackId, selectedClipId } = state;
    if (!project || !selectedTrackId || !selectedClipId) return;
    state.applyEdit(resizeNote(project, selectedTrackId, selectedClipId, noteId, lengthBeat));
  },

  duplicateSelectedNotes: () => {
    const state = get();
    const { project, selectedTrackId, selectedClipId, selectedNoteIds } = state;
    if (!project || !selectedTrackId || !selectedClipId || selectedNoteIds.size === 0) return;
    state.applyEdit(duplicateNotes(project, selectedTrackId, selectedClipId, selectedNoteIds, 1));
  },

  setSelectedVelocity: (velocity) => {
    const state = get();
    const { project, selectedTrackId, selectedClipId, selectedNoteIds } = state;
    if (!project || !selectedTrackId || !selectedClipId || selectedNoteIds.size === 0) return;
    state.applyEdit(setNoteVelocity(project, selectedTrackId, selectedClipId, selectedNoteIds, velocity));
  },

  quantizeSelectedNotes: () => {
    const state = get();
    const { project, selectedTrackId, selectedClipId, selectedNoteIds, snap } = state;
    if (!project || !selectedTrackId || !selectedClipId || selectedNoteIds.size === 0 || snap === 0) return;
    state.applyEdit(quantizeNotes(project, selectedTrackId, selectedClipId, selectedNoteIds, snap));
  },

  copySelectedNotes: () => {
    const state = get();
    const clip = selectedClipOf(state);
    if (!clip) return;
    const copies = clip.notes.filter((n) => state.selectedNoteIds.has(n.id));
    set({ clipboard: copies });
  },

  pasteNotes: () => {
    const state = get();
    const { project, selectedTrackId, selectedClipId, clipboard } = state;
    if (!project || !selectedTrackId || !selectedClipId || clipboard.length === 0) return;
    let next = project;
    for (const note of clipboard) {
      next = addNote(next, selectedTrackId, selectedClipId, {
        id: newId("note"),
        pitch: note.pitch,
        start_beat: note.start_beat + 1,
        length_beat: note.length_beat,
        velocity: note.velocity,
      });
    }
    state.applyEdit(next);
  },

  addTrackAction: () => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(addTrack(project));
  },

  removeTrackAction: (trackId) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(removeTrack(project, trackId));
  },

  renameTrackAction: (trackId, name) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(renameTrack(project, trackId, name));
  },

  moveTrackAction: (trackId, direction) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(moveTrack(project, trackId, direction));
  },

  setInstrumentAction: (trackId, program, isDrum) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(setTrackInstrument(project, trackId, program, isDrum));
  },

  setVolumeAction: (trackId, volumeDb) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(setTrackVolume(project, trackId, volumeDb));
    const current = get().project;
    if (current) engine.applyMixerToSession(current);
  },

  setPanAction: (trackId, pan) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(setTrackPan(project, trackId, pan));
    const current = get().project;
    if (current) engine.applyMixerToSession(current);
  },

  setMuteAction: (trackId, mute) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(setTrackMute(project, trackId, mute));
    const current = get().project;
    if (current) engine.applyMixerToSession(current);
  },

  setSoloAction: (trackId, solo) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(setTrackSolo(project, trackId, solo));
    const current = get().project;
    if (current) engine.applyMixerToSession(current);
  },

  createClipAction: (trackId, startBeat, lengthBeats) => {
    const { project, applyEdit } = get();
    if (!project) return;
    const next = createClip(project, trackId, startBeat, lengthBeats);
    applyEdit(next);
    const track = next.tracks.find((t) => t.id === trackId);
    const clip = track?.clips[track.clips.length - 1];
    if (track && clip) set({ selectedTrackId: track.id, selectedClipId: clip.id });
  },

  moveClipAction: (trackId, clipId, startBeat) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(moveClip(project, trackId, clipId, startBeat));
  },

  duplicateClipAction: (trackId, clipId) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(duplicateClip(project, trackId, clipId));
  },

  deleteClipAction: (trackId, clipId) => {
    const { project, applyEdit, selectedClipId } = get();
    if (!project) return;
    applyEdit(deleteClip(project, trackId, clipId));
    if (selectedClipId === clipId) {
      set({ selectedClipId: null, selectedNoteIds: new Set() });
    }
  },

  renameClipAction: (trackId, clipId, name) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit(renameClip(project, trackId, clipId, name));
  },

  updateMasterAction: (patch) => {
    const { project, applyEdit } = get();
    if (!project) return;
    const next = updateMasterSettings(project, patch);
    applyEdit(next);
    engine.updateMasterSettings(next.master_settings);
  },

  setLoopAction: (startBeat, endBeat, enabled) => {
    const { project, applyEdit } = get();
    if (!project) return;
    applyEdit({
      ...project,
      loop_range: { start_beat: startBeat, end_beat: endBeat, enabled },
    });
    engine.setLoopRange(startBeat, endBeat, enabled, project.bpm);
  },

  play: async (fromBeat) => {
    const { project, metronome, playheadBeat } = get();
    if (!project) return;
    try {
      await engine.playProject(project, fromBeat ?? playheadBeat, metronome);
      set({ playing: true });
    } catch (error) {
      set({
        notice: `Không phát được: ${error instanceof Error ? error.message : "lỗi không xác định"}. Hãy bấm Play lại sau một thao tác chuột.`,
        noticeKind: "error",
      });
    }
  },

  pause: () => {
    engine.pausePlayback();
    set({ playing: false });
  },

  stop: () => {
    engine.stopPlayback();
    set({ playing: false, playheadBeat: 0 });
  },

  seek: (beat) => {
    const { project, playing } = get();
    if (!project) return;
    engine.seekToBeat(beat, project.bpm);
    set({ playheadBeat: Math.max(0, beat) });
    void playing;
  },

  setPlayheadBeat: (beat) => set({ playheadBeat: beat }),

  handlePlaybackEnded: () => set({ playing: false, playheadBeat: 0 }),
}));

export function trackColor(index: number): string {
  const colors = [
    "#e5484d",
    "#f76b15",
    "#ffb224",
    "#46a758",
    "#0091ff",
    "#8e4ec6",
    "#d6409f",
    "#12a594",
  ];
  return colors[index % colors.length];
}

export function clipIdForNewNote(): string {
  return newId("note");
}
