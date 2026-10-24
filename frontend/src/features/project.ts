import type { Project } from "../types";
import { newId } from "../types";

export const AUTOSAVE_KEY = "daw-autosave-v1";

export function createProject(): Project {
  return {
    schema_version: 1,
    name: "Project mới",
    bpm: 100,
    time_signature: [4, 4],
    tracks: [],
    loop_range: { start_beat: 0, end_beat: 16, enabled: false },
    master_settings: {
      master_gain_db: 0,
      compressor_enabled: true,
      compressor_threshold_db: -18,
      compressor_ratio: 3,
      reverb_enabled: true,
      reverb_wet: 0.2,
      limiter_enabled: true,
      limiter_ceiling_db: -1,
    },
  };
}

export function validateProject(data: unknown): string[] {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return ["File không phải là một project JSON hợp lệ."];
  }
  const project = data as Record<string, unknown>;
  if (project.schema_version !== 1) {
    errors.push("Thiếu schema_version hoặc phiên bản project không hỗ trợ (cần 1).");
  }
  if (typeof project.bpm !== "number" || project.bpm <= 0) {
    errors.push("BPM phải là số lớn hơn 0.");
  }
  if (!Array.isArray(project.tracks)) {
    errors.push("Thiếu danh sách tracks.");
    return errors;
  }
  for (const track of project.tracks as Record<string, unknown>[]) {
    if (typeof track.program !== "number" || track.program < 0 || track.program > 127) {
      errors.push(`Track "${String(track.name ?? track.id)}" có program ngoài 0–127.`);
    }
    if (typeof track.pan === "number" && (track.pan < -1 || track.pan > 1)) {
      errors.push(`Track "${String(track.name ?? track.id)}" có pan ngoài −1..1.`);
    }
    if (!Array.isArray(track.clips)) {
      errors.push(`Track "${String(track.name ?? track.id)}" thiếu danh sách clips.`);
      continue;
    }
    for (const clip of track.clips as Record<string, unknown>[]) {
      if (typeof clip.length_beats !== "number" || clip.length_beats <= 0) {
        errors.push(`Clip "${String(clip.name ?? clip.id)}" phải có độ dài dương.`);
        continue;
      }
      if (!Array.isArray(clip.notes)) continue;
      for (const note of clip.notes as Record<string, unknown>[]) {
        const pitch = note.pitch as number;
        const start = note.start_beat as number;
        const length = note.length_beat as number;
        const velocity = note.velocity as number;
        if (typeof pitch !== "number" || pitch < 0 || pitch > 127) {
          errors.push(`Note trong clip "${String(clip.name ?? clip.id)}" có pitch ngoài 0–127.`);
        }
        if (typeof velocity !== "number" || velocity < 1 || velocity > 127) {
          errors.push(`Note trong clip "${String(clip.name ?? clip.id)}" có velocity ngoài 1–127.`);
        }
        if (
          typeof start === "number" &&
          typeof length === "number" &&
          start + length > (clip.length_beats as number) + 1e-9
        ) {
          errors.push(`Note trong clip "${String(clip.name ?? clip.id)}" vượt ra ngoài clip.`);
        }
      }
    }
  }
  return errors;
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function loadProject(jsonText: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("File không phải JSON hợp lệ. Hãy chọn lại file project .json.");
  }
  const errors = validateProject(data);
  if (errors.length > 0) {
    throw new Error(`File project không hợp lệ: ${errors.join(" ")}`);
  }
  return data as Project;
}

export function saveProject(project: Project): void {
  const blob = new Blob([serializeProject(project)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.name || "project"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function writeAutosave(project: Project): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serializeProject(project));
  } catch {
    // localStorage đầy hoặc bị chặn: bỏ qua, không làm gián đoạn soạn nhạc.
  }
}

export function readAutosave(): string | null {
  try {
    return localStorage.getItem(AUTOSAVE_KEY);
  } catch {
    return null;
  }
}

export function restoreAutosave(): Project {
  const raw = readAutosave();
  if (!raw) {
    throw new Error("Không có bản autosave để khôi phục.");
  }
  return loadProject(raw);
}

export function ensureTrackAndClipIds(project: Project): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) => ({
      ...track,
      id: track.id || newId("track"),
      clips: track.clips.map((clip) => ({
        ...clip,
        id: clip.id || newId("clip"),
        notes: clip.notes.map((note) => ({
          ...note,
          id: note.id || newId("note"),
        })),
      })),
    })),
  };
}
