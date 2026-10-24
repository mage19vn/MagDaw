import { DEFAULT_MASTER } from "./types";
import type {
  Clip,
  InstrumentConfig,
  Master,
  Note,
  Project,
  Track,
} from "./types";

export const CURRENT_SCHEMA_VERSION = 1;
const PRESETS = ["auto", "sine", "triangle", "sawtooth", "square"] as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} phải là đối tượng.`);
  return value as Record<string, unknown>;
}
function number(
  value: unknown,
  label: string,
  min: number,
  max = Infinity,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(
      `${label} phải là ${integer ? "số nguyên" : "số hữu hạn"} từ ${min}${max < Infinity ? ` đến ${max}` : " trở lên"}.`,
    );
  }
  return value;
}
function positive(value: unknown, label: string): number {
  const result = number(value, label, 0);
  if (result === 0) throw new Error(`${label} phải lớn hơn 0.`);
  return result;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new Error(`${label} không được để trống.`);
  return value;
}
function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean")
    throw new Error(`${label} phải là bật hoặc tắt.`);
  return value;
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} phải là danh sách.`);
  return value;
}
function identifier(value: unknown, label: string, ids: Set<string>): string {
  const id = text(value, label);
  if (ids.has(id)) throw new Error(`ID bị trùng: ${id}.`);
  ids.add(id);
  return id;
}
function validateNote(value: unknown, ids: Set<string>): Note {
  const note = record(value, "Note");
  return {
    id: identifier(note.id, "ID note", ids),
    pitch: number(note.pitch, "Pitch", 0, 127, true),
    start_beat: number(note.start_beat, "Vị trí note", 0),
    length_beat: positive(note.length_beat, "Độ dài note"),
    velocity: number(note.velocity, "Velocity", 1, 127, true),
  };
}
function validateClip(value: unknown, ids: Set<string>): Clip {
  const clip = record(value, "Clip");
  const result: Clip = {
    id: identifier(clip.id, "ID clip", ids),
    name: text(clip.name, "Tên clip"),
    start_beat: number(clip.start_beat, "Vị trí clip", 0),
    length_beats: positive(clip.length_beats, "Độ dài clip"),
    notes: array(clip.notes, "Danh sách note").map((note) =>
      validateNote(note, ids),
    ),
  };
  if (
    result.notes.some(
      (note) => note.start_beat + note.length_beat > result.length_beats + 1e-8,
    )
  )
    throw new Error(
      `Note vượt độ dài clip “${result.name}”. Hãy mở rộng clip trước khi lưu.`,
    );
  return result;
}
function validateTrack(value: unknown, ids: Set<string>): Track {
  const track = record(value, "Track");
  const config = record(track.instrument_config, "Cấu hình nhạc cụ");
  if (!PRESETS.some((preset) => preset === config.preset))
    throw new Error("Âm sắc không được hỗ trợ.");
  return {
    id: identifier(track.id, "ID track", ids),
    name: text(track.name, "Tên track"),
    program: number(track.program, "Program GM", 0, 127, true),
    is_drum: boolean(track.is_drum, "Track trống"),
    instrument_config: { preset: config.preset as InstrumentConfig["preset"] },
    volume_db: number(track.volume_db, "Âm lượng track (dB)", -60, 6),
    pan: number(track.pan, "Pan", -1, 1),
    mute: boolean(track.mute, "Mute"),
    solo: boolean(track.solo, "Solo"),
    clips: array(track.clips, "Danh sách clip").map((clip) =>
      validateClip(clip, ids),
    ),
  };
}
export function validateMaster(value: unknown): Master {
  const master = record(value, "Master");
  const compressor = record(master.compressor, "Compressor");
  const reverb = record(master.reverb, "Reverb");
  const limiter = record(master.limiter, "Limiter");
  return {
    gain_bypass:
      master.gain_bypass === undefined
        ? false
        : boolean(master.gain_bypass, "Bypass gain"),
    gain_db: number(master.gain_db, "Gain master (dB)", -24, 12),
    compressor: {
      bypass: boolean(compressor.bypass, "Bypass compressor"),
      threshold_db: number(
        compressor.threshold_db,
        "Ngưỡng compressor (dB)",
        -60,
        0,
      ),
      ratio: number(compressor.ratio, "Tỉ lệ compressor", 1, 20),
      attack_ms: number(compressor.attack_ms, "Attack (ms)", 0.1, 100),
      release_ms: number(compressor.release_ms, "Release (ms)", 10, 1000),
    },
    reverb: {
      bypass: boolean(reverb.bypass, "Bypass reverb"),
      wet: number(reverb.wet, "Reverb wet", 0, 1),
      room_size: number(reverb.room_size, "Kích thước phòng", 0, 1),
    },
    limiter: {
      bypass: boolean(limiter.bypass, "Bypass limiter"),
      ceiling_db: number(limiter.ceiling_db, "Ceiling limiter (dBFS)", -12, 0),
    },
  };
}

/** Version 0 lacked optional instrument, loop and master defaults. */
export function migrateProject(input: unknown): Record<string, unknown> {
  const project = record(input, "Project");
  if (project.schema_version === 0) {
    const tracks = array(project.tracks, "Danh sách track").map((value) => {
      const track = record(value, "Track");
      return {
        ...track,
        instrument_config: track.instrument_config ?? { preset: "auto" },
      };
    });
    return {
      ...project,
      schema_version: CURRENT_SCHEMA_VERSION,
      tracks,
      master: project.master ?? structuredClone(DEFAULT_MASTER),
      loop: project.loop ?? { enabled: false, start_beat: 0, end_beat: 16 },
    };
  }
  if (
    typeof project.schema_version === "number" &&
    project.schema_version > CURRENT_SCHEMA_VERSION
  )
    throw new Error(
      `Project dùng schema ${project.schema_version}; ứng dụng chỉ hỗ trợ đến schema ${CURRENT_SCHEMA_VERSION}.`,
    );
  if (project.schema_version !== CURRENT_SCHEMA_VERSION)
    throw new Error(
      "Phiên bản schema project không hợp lệ hoặc chưa được hỗ trợ.",
    );
  return project;
}

export function validateProject(input: unknown): Project {
  const project = migrateProject(input);
  const ids = new Set<string>();
  const signature = array(project.time_signature, "Số chỉ nhịp");
  if (signature.length !== 2)
    throw new Error("Số chỉ nhịp phải gồm tử số và mẫu số.");
  const numerator = number(signature[0], "Tử số nhịp", 1, 32, true);
  const denominator = number(signature[1], "Mẫu số nhịp", 1, 32, true);
  if (![1, 2, 4, 8, 16, 32].includes(denominator))
    throw new Error("Mẫu số nhịp phải là 1, 2, 4, 8, 16 hoặc 32.");
  const loop = record(project.loop, "Vùng lặp");
  const start = number(loop.start_beat, "Đầu vùng lặp", 0);
  const end = positive(loop.end_beat, "Cuối vùng lặp");
  if (end <= start) throw new Error("Cuối vùng lặp phải sau đầu vùng lặp.");
  return {
    schema_version: 1,
    id: identifier(project.id, "ID project", ids),
    name: text(project.name, "Tên project"),
    bpm: positive(project.bpm, "BPM"),
    time_signature: [numerator, denominator],
    tracks: array(project.tracks, "Danh sách track").map((track) =>
      validateTrack(track, ids),
    ),
    loop: {
      enabled: boolean(loop.enabled, "Loop"),
      start_beat: start,
      end_beat: end,
    },
    master: validateMaster(project.master),
  };
}
