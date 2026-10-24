import { beatsPerBar } from "./types";

export function beatToSeconds(beat: number, bpm: number): number {
  if (!Number.isFinite(beat) || !Number.isFinite(bpm) || beat < 0 || bpm <= 0)
    throw new Error("Beat phải không âm và BPM phải lớn hơn 0.");
  return (beat * 60) / bpm;
}
export function secondsToBeat(seconds: number, bpm: number): number {
  if (
    !Number.isFinite(seconds) ||
    !Number.isFinite(bpm) ||
    seconds < 0 ||
    bpm <= 0
  )
    throw new Error("Thời gian phải không âm và BPM phải lớn hơn 0.");
  return (seconds * bpm) / 60;
}
/** Bar and beat labels are one-based; a displayed beat is one denominator note. */
export function beatPosition(
  beat: number,
  signature: [number, number],
): { bar: number; beat: number } {
  const barLength = beatsPerBar(signature);
  return {
    bar: Math.floor(beat / barLength) + 1,
    beat: ((beat % barLength) * signature[1]) / 4 + 1,
  };
}
export function snapBeat(beat: number, grid: number): number {
  if (!Number.isFinite(beat) || !Number.isFinite(grid) || grid < 0)
    throw new Error("Giá trị snap không hợp lệ.");
  return Math.max(0, grid === 0 ? beat : Math.round(beat / grid) * grid);
}
