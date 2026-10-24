import { describe, expect, it } from "vitest";
import {
  addNote,
  addTrack,
  createClip,
  deleteNotes,
  duplicateClip,
  duplicateNotes,
  editProject,
  moveClip,
  moveNotes,
  newProject,
  newTrack,
  pasteNotes,
  quantizeNotes,
  reorderTrack,
  resizeNotes,
  setNoteVelocity,
  updateNote,
  updateTrackMixer,
} from "./commands";
import { ProjectHistory } from "./history";
import { audibleTracks, beatsPerBar } from "./types";
import type { EditorSnapshot, Note, Project } from "./types";
import { beatPosition, beatToSeconds, secondsToBeat, snapBeat } from "./time";
import { validateProject } from "./validation";
import { BrowserProjectRepository } from "../services/projectRepository";

function fixture(): Project {
  return createClip(
    addTrack(newProject(), { ...newTrack(), id: "track" }),
    "track",
    {
      id: "clip",
      name: "Câu nhạc",
      start_beat: 4,
      length_beats: 4,
      notes: [
        {
          id: "n1",
          pitch: 60,
          start_beat: 0.11,
          length_beat: 0.1,
          velocity: 90,
        },
        {
          id: "n2",
          pitch: 64,
          start_beat: 1.11,
          length_beat: 1,
          velocity: 110,
        },
      ],
    },
  );
}
const selected = { trackId: "track", clipId: "clip", noteIds: ["n1", "n2"] };
function notes(project: Project): Note[] {
  return project.tracks[0].clips[0].notes;
}

describe("Chỉnh sửa note và clip", () => {
  it("thêm/sửa/xóa thuần và tự mở rộng clip, không mất note", () => {
    const original = fixture();
    const added = addNote(original, "track", "clip", {
      id: "n3",
      pitch: 70,
      start_beat: 6,
      length_beat: 2,
      velocity: 80,
    });
    expect(original.tracks[0].clips[0].length_beats).toBe(4);
    expect(added.tracks[0].clips[0].length_beats).toBe(8);
    const edited = updateNote(added, "track", "clip", "n3", { length_beat: 4 });
    expect(edited.tracks[0].clips[0].length_beats).toBe(10);
    expect(notes(deleteNotes(edited, "track", "clip", ["n1"]))).toHaveLength(2);
  });
  it("di chuyển nhóm giữ khoảng cách khi chạm đầu clip hoặc biên pitch", () => {
    const moved = moveNotes(fixture(), "track", "clip", ["n1", "n2"], -4, -90);
    expect(notes(moved)[0].start_beat).toBe(0);
    expect(notes(moved)[1].start_beat).toBeCloseTo(1);
    expect(notes(moved).map((note) => note.pitch)).toEqual([0, 4]);
  });
  it("resize nhóm không tạo note bằng 0 và mở rộng clip", () => {
    const small = resizeNotes(
      fixture(),
      "track",
      "clip",
      ["n1", "n2"],
      -5,
      0.25,
    );
    expect(notes(small)[0].length_beat).toBe(0.25);
    const large = resizeNotes(small, "track", "clip", ["n1", "n2"], 10);
    expect(large.tracks[0].clips[0].length_beats).toBeGreaterThan(10);
  });
  it("quantize nearest grid, ties later, độ dài tối thiểu một grid", () => {
    const quantized = quantizeNotes(
      fixture(),
      "track",
      "clip",
      ["n1", "n2"],
      0.25,
    );
    expect(notes(quantized).map((note) => note.start_beat)).toEqual([0, 1]);
    expect(notes(quantized).map((note) => note.length_beat)).toEqual([0.25, 1]);
    expect(snapBeat(0.125, 0.25)).toBe(0.25);
    expect(() => quantizeNotes(fixture(), "track", "clip", ["n1"], 0)).toThrow(
      "lưới snap",
    );
  });
  it("duplicate/copy-paste giữ quan hệ tương đối và velocity, tạo ID mới", () => {
    const project = fixture();
    const pasted = pasteNotes(project, "track", "clip", notes(project), 4);
    expect(
      notes(pasted)
        .slice(2)
        .map((note) => [note.start_beat, note.pitch, note.velocity]),
    ).toEqual([
      [4, 60, 90],
      [5, 64, 110],
    ]);
    expect(new Set(notes(pasted).map((note) => note.id)).size).toBe(4);
    const duplicated = duplicateNotes(
      project,
      "track",
      "clip",
      ["n1", "n2"],
      4,
    );
    expect(notes(duplicated)[2].start_beat).toBe(4.11);
  });
  it("velocity validation và thiếu note được báo lỗi", () => {
    expect(
      notes(setNoteVelocity(fixture(), "track", "clip", ["n1"], 127))[0]
        .velocity,
    ).toBe(127);
    expect(() =>
      setNoteVelocity(fixture(), "track", "clip", ["n1"], 0),
    ).toThrow("Velocity");
    expect(() => deleteNotes(fixture(), "track", "clip", ["missing"])).toThrow(
      "Không tìm thấy",
    );
  });
  it("duplicate clip thay ID và move sang track khác", () => {
    const project = duplicateClip(fixture(), "track", "clip");
    expect(project.tracks[0].clips[1].start_beat).toBe(8);
    expect(project.tracks[0].clips[1].notes[0].id).not.toBe("n1");
    const two = addTrack(project, { ...newTrack(), id: "second" });
    const moved = moveClip(two, "track", "clip", 3, "second");
    expect(moved.tracks[0].clips).toHaveLength(1);
    expect(moved.tracks[1].clips[0].start_beat).toBe(3);
    expect(reorderTrack(moved, "second", 0).tracks[0].id).toBe("second");
  });
});

describe("Schema và thời gian", () => {
  it("quarter beats đổi đúng 16 bars/100BPM và nhịp 6/8", () => {
    expect(beatToSeconds(64, 100)).toBe(38.4);
    expect(secondsToBeat(38.4, 100)).toBe(64);
    expect(beatsPerBar([6, 8])).toBe(3);
    expect(beatPosition(3.5, [6, 8])).toEqual({ bar: 2, beat: 2 });
  });
  it("từ chối schema tương lai, ID trùng, NaN, pitch/velocity/program/pan sai", () => {
    expect(() =>
      validateProject({ ...fixture(), schema_version: 999 }),
    ).toThrow("schema 999");
    expect(() =>
      editProject(fixture(), (draft) => {
        draft.tracks[0].id = "clip";
      }),
    ).toThrow("ID bị trùng");
    for (const changes of [
      { pitch: -1 },
      { velocity: 128 },
      { start_beat: -1 },
      { length_beat: 0 },
      { pitch: 60.5 },
    ]) {
      expect(() =>
        updateNote(fixture(), "track", "clip", "n1", changes),
      ).toThrow();
    }
    expect(() =>
      editProject(fixture(), (draft) => {
        draft.bpm = NaN;
      }),
    ).toThrow("BPM");
    expect(() =>
      editProject(fixture(), (draft) => {
        draft.tracks[0].program = 128;
      }),
    ).toThrow("Program");
    expect(() => updateTrackMixer(fixture(), "track", { pan: 1.1 })).toThrow(
      "Pan",
    );
  });
  it("migrate v0 thêm defaults và giữ note", () => {
    const old: Record<string, unknown> = structuredClone(
      fixture(),
    ) as unknown as Record<string, unknown>;
    old.schema_version = 0;
    delete old.master;
    delete old.loop;
    const migrated = validateProject(old);
    expect(migrated.schema_version).toBe(1);
    expect(migrated.master.reverb.wet).toBe(0.2);
    expect(notes(migrated)).toHaveLength(2);
  });
  it("mute luôn thắng solo; volume và pan lưu đúng thông số", () => {
    let project = addTrack(fixture(), { ...newTrack(), id: "second" });
    project = updateTrackMixer(project, "track", {
      solo: true,
      volume_db: -12,
      pan: -0.75,
    });
    expect(audibleTracks(project).map((track) => track.id)).toEqual(["track"]);
    expect(project.tracks[0].volume_db).toBe(-12);
    expect(project.tracks[0].pan).toBe(-0.75);
    project = updateTrackMixer(project, "track", { mute: true });
    expect(audibleTracks(project)).toHaveLength(0);
  });
});

describe("History", () => {
  it("một drag nhiều preview chỉ một undo và selection trở lại đúng", () => {
    const initial: EditorSnapshot = { project: fixture(), selection: selected };
    const history = new ProjectHistory(initial);
    let preview = initial.project;
    for (let index = 1; index <= 100; index++)
      preview = moveNotes(
        initial.project,
        "track",
        "clip",
        selected.noteIds,
        index / 10,
        1,
      );
    history.commit({
      project: preview,
      selection: { ...selected, noteIds: ["n2"] },
    });
    expect(history.canUndo).toBe(true);
    expect(history.undo()).toEqual(initial);
    expect(history.canUndo).toBe(false);
    expect(history.redo().selection.noteIds).toEqual(["n2"]);
    expect(notes(history.current.project)[0].start_beat).toBe(10.11);
  });
  it("đổi selection không tạo undo; reset project xóa history", () => {
    const history = new ProjectHistory({
      project: fixture(),
      selection: selected,
    });
    history.setSelection({ ...selected, noteIds: ["n1"] });
    expect(history.canUndo).toBe(false);
    history.commit({
      project: moveNotes(fixture(), "track", "clip", ["n1"], 1, 0),
      selection: selected,
    });
    history.undo();
    history.reset({
      project: newProject(),
      selection: { trackId: null, clipId: null, noteIds: [] },
    });
    expect(history.canRedo).toBe(false);
    expect(history.canUndo).toBe(false);
  });
});

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number {
    return this.values.size;
  }
  clear(): void {
    this.values.clear();
  }
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("Project repository", () => {
  it("save/open round-trip giữ đầy đủ musical settings", () => {
    const repository = new BrowserProjectRepository(new MemoryStorage());
    const project = fixture();
    expect(repository.parse(repository.serialize(project))).toEqual(project);
    expect(() => repository.parse("{bad")).toThrow("JSON");
    expect(notes(project)).toHaveLength(2);
  });
  it("autosave versioned giữ snapshot riêng, restore và clear", () => {
    const repository = new BrowserProjectRepository(new MemoryStorage());
    const project = fixture();
    expect(repository.loadAutosave()).toBeNull();
    repository.saveAutosave(project);
    project.name = "Tên sửa sau khi lưu";
    expect(repository.loadAutosave()?.project.name).not.toBe(project.name);
    expect(repository.loadAutosave()?.format_version).toBe(1);
    repository.clearAutosave();
    expect(repository.loadAutosave()).toBeNull();
  });
});
