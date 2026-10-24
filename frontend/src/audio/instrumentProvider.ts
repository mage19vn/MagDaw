import * as Tone from "tone";
import type { Track } from "../domain/types";

export interface TrackInstrument {
  attack(key: string, pitch: number, velocity: number, time: number): void;
  release(key: string, time: number): void;
  silence(time: number): void;
  dispose(): void;
}

export interface InstrumentProvider {
  create(track: Track, destination: Tone.ToneAudioNode): TrackInstrument;
}

type VoiceSynth = Tone.Synth | Tone.MembraneSynth | Tone.NoiseSynth;
interface Voice {
  synth: VoiceSynth;
  kind: string;
  reservedUntil: number;
}

export function instrumentDescription(track: Track): string {
  if (track.is_drum) return "Trống tổng hợp: kick màng, snare/hi-hat nhiễu";
  if (track.instrument_config.preset !== "auto")
    return `Synth ${track.instrument_config.preset}`;
  if (track.program < 8) return "Piano nghe thử: sóng tam giác, envelope gõ";
  if (track.program >= 32 && track.program < 40)
    return "Bass nghe thử: sóng tam giác, âm ngắn";
  if (track.program >= 40 && track.program < 56)
    return "Strings nghe thử: sóng răng cưa, attack chậm";
  if (track.program >= 56 && track.program < 80)
    return "Kèn/lead nghe thử: sóng vuông";
  return "Synth nghe thử: sóng sin";
}

function waveformForTrack(
  track: Track,
): "sine" | "triangle" | "sawtooth" | "square" {
  if (track.instrument_config.preset !== "auto")
    return track.instrument_config.preset;
  if (track.program < 8 || (track.program >= 32 && track.program < 40))
    return "triangle";
  if (track.program >= 40 && track.program < 56) return "sawtooth";
  if (track.program >= 56 && track.program < 80) return "square";
  return "sine";
}

function drumKind(pitch: number): string {
  if (pitch <= 36) return "kick";
  if ([38, 39, 40].includes(pitch)) return "snare";
  if ([42, 44, 46].includes(pitch)) return "hat";
  return "tom";
}

class SynthTrackInstrument implements TrackInstrument {
  private readonly voices: Voice[] = [];
  private readonly active = new Map<string, Voice>();

  constructor(
    private readonly track: Track,
    private readonly destination: Tone.ToneAudioNode,
  ) {}

  private createVoice(kind: string): Voice {
    let synth: VoiceSynth;
    if (kind === "kick" || kind === "tom") {
      synth = new Tone.MembraneSynth({
        pitchDecay: kind === "kick" ? 0.035 : 0.02,
        octaves: kind === "kick" ? 5 : 2,
        volume: -8,
        envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.04 },
      });
    } else if (kind === "hat" || kind === "snare") {
      synth = new Tone.NoiseSynth({
        noise: { type: kind === "hat" ? "white" : "pink" },
        volume: kind === "hat" ? -19 : -10,
        envelope: {
          attack: 0.001,
          decay: kind === "hat" ? 0.035 : 0.12,
          sustain: 0,
          release: 0.025,
        },
      });
    } else {
      const strings = this.track.program >= 40 && this.track.program < 56;
      const bass = this.track.program >= 32 && this.track.program < 40;
      synth = new Tone.Synth({
        oscillator: { type: waveformForTrack(this.track) },
        volume: -13,
        envelope: {
          attack: strings ? 0.08 : 0.005,
          decay: bass ? 0.15 : 0.3,
          sustain: strings ? 0.45 : bass ? 0.2 : 0.15,
          release: strings ? 0.5 : 0.12,
        },
      });
    }
    synth.connect(this.destination);
    const voice = { synth, kind, reservedUntil: -Infinity };
    this.voices.push(voice);
    return voice;
  }

  attack(key: string, pitch: number, velocity: number, time: number): void {
    this.release(key, time);
    const kind = this.track.is_drum ? drumKind(pitch) : "melodic";
    // Each overlapping event owns a voice, including notes with the same pitch.
    const voice =
      this.voices.find(
        (item) => item.kind === kind && item.reservedUntil <= time,
      ) ?? this.createVoice(kind);
    voice.reservedUntil = Infinity;
    this.active.set(key, voice);
    if (voice.synth instanceof Tone.NoiseSynth) {
      voice.synth.triggerAttack(time, velocity / 127);
    } else {
      const frequency =
        kind === "kick"
          ? 48
          : kind === "tom"
            ? Tone.Frequency(pitch, "midi").toFrequency() / 2
            : Tone.Frequency(pitch, "midi").toFrequency();
      voice.synth.triggerAttack(frequency, time, velocity / 127);
    }
  }

  release(key: string, time: number): void {
    const voice = this.active.get(key);
    if (!voice) return;
    voice.synth.triggerRelease(time);
    voice.reservedUntil = time + 0.6;
    this.active.delete(key);
  }

  silence(time: number): void {
    for (const voice of this.voices) {
      voice.synth.triggerRelease(time);
      voice.reservedUntil = time + 0.6;
    }
    this.active.clear();
  }

  dispose(): void {
    this.active.clear();
    this.voices.forEach((voice) => voice.synth.dispose());
    this.voices.length = 0;
  }
}

export class ToneInstrumentProvider implements InstrumentProvider {
  create(track: Track, destination: Tone.ToneAudioNode): TrackInstrument {
    return new SynthTrackInstrument(track, destination);
  }
}
