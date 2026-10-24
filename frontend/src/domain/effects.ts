import { DEFAULT_MASTER } from "./types";
import type { Master } from "./types";
import { validateMaster } from "./validation";

export interface EffectParameter {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  defaultValue: number;
}
export interface EffectDefinition {
  id: keyof Master;
  label: string;
  parameters: EffectParameter[];
}
export const EFFECT_CATALOG: readonly EffectDefinition[] = [
  {
    id: "gain_db",
    label: "Gain",
    parameters: [
      {
        id: "gain_db",
        label: "Gain đầu vào",
        unit: "dB",
        min: -24,
        max: 12,
        defaultValue: 0,
      },
    ],
  },
  {
    id: "compressor",
    label: "Compressor",
    parameters: [
      {
        id: "threshold_db",
        label: "Ngưỡng",
        unit: "dB",
        min: -60,
        max: 0,
        defaultValue: -18,
      },
      {
        id: "ratio",
        label: "Tỉ lệ",
        unit: ":1",
        min: 1,
        max: 20,
        defaultValue: 3,
      },
      {
        id: "attack_ms",
        label: "Attack",
        unit: "ms",
        min: 0.1,
        max: 100,
        defaultValue: 10,
      },
      {
        id: "release_ms",
        label: "Release",
        unit: "ms",
        min: 10,
        max: 1000,
        defaultValue: 100,
      },
    ],
  },
  {
    id: "reverb",
    label: "Reverb",
    parameters: [
      { id: "wet", label: "Wet", unit: "", min: 0, max: 1, defaultValue: 0.2 },
      {
        id: "room_size",
        label: "Kích thước phòng",
        unit: "",
        min: 0,
        max: 1,
        defaultValue: 0.5,
      },
    ],
  },
  {
    id: "limiter",
    label: "Limiter",
    parameters: [
      {
        id: "ceiling_db",
        label: "Ceiling",
        unit: "dBFS",
        min: -12,
        max: 0,
        defaultValue: -1,
      },
    ],
  },
];
export function resetEffect(master: Master, effectId: keyof Master): Master {
  return validateMaster({
    ...master,
    [effectId]: structuredClone(DEFAULT_MASTER[effectId]),
  });
}
