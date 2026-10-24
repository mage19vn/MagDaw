import * as Tone from "tone";
import type { MasterSettings, Project } from "../types";
import { beatToSeconds } from "../utils/music";
import {
  buildScheduleEvents,
  songEndSeconds,
  type ScheduledEvent,
} from "./schedule";

interface TrackNodes {
  channel: Tone.Channel;
  synth: Tone.PolySynth | null;
  kick: Tone.MembraneSynth | null;
  snare: Tone.NoiseSynth | null;
  hihat: Tone.MetalSynth | null;
}

interface Session {
  trackNodes: Map<string, TrackNodes>;
  parts: Tone.Part<ScheduledEvent>[];
  metronomeId: number | null;
  endId: number | null;
}

let initialized = false;
let masterGain: Tone.Gain | null = null;
let masterCompressor: Tone.Compressor | null = null;
let masterReverb: Tone.Reverb | null = null;
let masterLimiter: Tone.Limiter | null = null;
let masterMeter: Tone.Meter | null = null;
let session: Session | null = null;
let onEndedCallback: (() => void) | null = null;
let previewSynth: Tone.PolySynth | null = null;
let previewKick: Tone.MembraneSynth | null = null;
let previewSnare: Tone.NoiseSynth | null = null;
let previewHihat: Tone.MetalSynth | null = null;

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function setOnEnded(callback: (() => void) | null): void {
  onEndedCallback = callback;
}

export async function initializeAudio(): Promise<void> {
  await Tone.start();
  if (initialized) return;
  masterGain = new Tone.Gain(1);
  masterCompressor = new Tone.Compressor({
    threshold: -18,
    ratio: 3,
  });
  masterReverb = new Tone.Reverb({ decay: 2.5, wet: 0.2 });
  void masterReverb.generate();
  masterLimiter = new Tone.Limiter(-1);
  masterMeter = new Tone.Meter({ normalRange: true });
  masterGain.chain(
    masterCompressor,
    masterReverb,
    masterLimiter,
    masterMeter,
    Tone.getDestination(),
  );
  initialized = true;
}

export function isAudioInitialized(): boolean {
  return initialized;
}

export function updateMasterSettings(settings: MasterSettings): void {
  if (!initialized) return;
  if (masterGain) masterGain.gain.value = dbToGain(settings.master_gain_db);
  if (masterCompressor) {
    masterCompressor.threshold.value = settings.compressor_enabled
      ? settings.compressor_threshold_db
      : 0;
    masterCompressor.ratio.value = settings.compressor_enabled
      ? settings.compressor_ratio
      : 1;
  }
  if (masterReverb) {
    masterReverb.wet.value = settings.reverb_enabled
      ? settings.reverb_wet
      : 0;
  }
  if (masterLimiter) {
    masterLimiter.threshold.value = settings.limiter_enabled
      ? settings.limiter_ceiling_db
      : 0;
  }
}

export function getMasterPeak(): number {
  if (!masterMeter) return 0;
  const value = masterMeter.getValue();
  if (typeof value === "number") return value;
  return 0;
}

function disposeSession(): void {
  if (!session) return;
  for (const part of session.parts) {
    part.dispose();
  }
  if (session.metronomeId !== null) {
    Tone.getTransport().clear(session.metronomeId);
  }
  if (session.endId !== null) {
    Tone.getTransport().clear(session.endId);
  }
  for (const nodes of session.trackNodes.values()) {
    nodes.synth?.dispose();
    nodes.kick?.dispose();
    nodes.snare?.dispose();
    nodes.hihat?.dispose();
    nodes.channel.dispose();
  }
  session = null;
}

function buildSession(project: Project, metronome: boolean): Session {
  const transport = Tone.getTransport();
  const events = buildScheduleEvents(project);
  const byTrack = new Map<string, ScheduledEvent[]>();
  for (const event of events) {
    const list = byTrack.get(event.trackId) ?? [];
    list.push(event);
    byTrack.set(event.trackId, list);
  }
  const trackNodes = new Map<string, TrackNodes>();
  const parts: Tone.Part<ScheduledEvent>[] = [];
  for (const track of project.tracks) {
    const channel = new Tone.Channel({
      volume: track.volume_db,
      pan: track.pan,
      mute: track.mute,
      solo: track.solo,
    });
    if (masterGain) channel.connect(masterGain);
    let synth: Tone.PolySynth | null = null;
    let kick: Tone.MembraneSynth | null = null;
    let snare: Tone.NoiseSynth | null = null;
    let hihat: Tone.MetalSynth | null = null;
    if (track.is_drum) {
      kick = new Tone.MembraneSynth().connect(channel);
      snare = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
      }).connect(channel);
      hihat = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      }).connect(channel);
    } else {
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.4 },
      }).connect(channel);
    }
    trackNodes.set(track.id, { channel, synth, kick, snare, hihat });
    const trackEvents = byTrack.get(track.id) ?? [];
    const nodes = trackNodes.get(track.id)!;
    const part = new Tone.Part<ScheduledEvent>(
      (time, event) => {
        const velocity = event.velocity / 127;
        if (event.isDrum) {
          if (event.drumKind === "kick") {
            nodes.kick?.triggerAttackRelease("C1", event.duration, time, velocity);
          } else if (event.drumKind === "snare") {
            nodes.snare?.triggerAttackRelease(event.duration, time, velocity);
          } else {
            nodes.hihat?.triggerAttackRelease(
              "G6",
              event.duration,
              time,
              velocity * 0.7,
            );
          }
        } else {
          nodes.synth?.triggerAttackRelease(
            Tone.Frequency(event.pitch, "midi").toFrequency(),
            event.duration,
            time,
            velocity,
          );
        }
      },
      trackEvents.map((event) => ({ ...event, time: event.time })),
    );
    part.start(0);
    parts.push(part);
  }
  let metronomeId: number | null = null;
  if (metronome) {
    const click = new Tone.MembraneSynth({
      pitchDecay: 0.001,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    });
    if (masterGain) click.connect(masterGain);
    metronomeId = transport.scheduleRepeat((time) => {
      click.triggerAttackRelease("A5", 0.05, time, 0.5);
    }, "4n");
  }
  return { trackNodes, parts, metronomeId, endId: null };
}

export function applyMixerToSession(project: Project): void {
  if (!session) return;
  for (const track of project.tracks) {
    const nodes = session.trackNodes.get(track.id);
    if (!nodes) continue;
    nodes.channel.volume.value = track.volume_db;
    nodes.channel.pan.value = track.pan;
    nodes.channel.mute = track.mute;
    nodes.channel.solo = track.solo;
  }
}

export async function playProject(
  project: Project,
  fromBeat: number,
  metronome: boolean,
): Promise<void> {
  await initializeAudio();
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel(0);
  disposeSession();
  updateMasterSettings(project.master_settings);
  session = buildSession(project, metronome);
  transport.bpm.value = project.bpm;
  const loop = project.loop_range;
  if (loop.enabled && loop.end_beat > loop.start_beat) {
    transport.loop = true;
    transport.loopStart = beatToSeconds(loop.start_beat, project.bpm);
    transport.loopEnd = beatToSeconds(loop.end_beat, project.bpm);
  } else {
    transport.loop = false;
    const endSeconds = songEndSeconds(project);
    if (endSeconds > 0) {
      session.endId = transport.schedule(() => {
        transport.stop();
        onEndedCallback?.();
      }, endSeconds);
    }
  }
  transport.seconds = beatToSeconds(Math.max(0, fromBeat), project.bpm);
  transport.start();
}

export function pausePlayback(): void {
  Tone.getTransport().pause();
}

export function stopPlayback(): void {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel(0);
  disposeSession();
}

export function seekToBeat(beat: number, bpm: number): void {
  const transport = Tone.getTransport();
  for (const nodes of session?.trackNodes.values() ?? []) {
    nodes.synth?.releaseAll();
  }
  transport.seconds = beatToSeconds(Math.max(0, beat), bpm);
}

export function setTempo(bpm: number): void {
  Tone.getTransport().bpm.value = bpm;
}

export function setLoopRange(
  startBeat: number,
  endBeat: number,
  enabled: boolean,
  bpm: number,
): void {
  const transport = Tone.getTransport();
  if (enabled && endBeat > startBeat) {
    transport.loop = true;
    transport.loopStart = beatToSeconds(startBeat, bpm);
    transport.loopEnd = beatToSeconds(endBeat, bpm);
  } else {
    transport.loop = false;
  }
}

export function getPlayheadSeconds(): number {
  return Tone.getTransport().seconds;
}

export async function previewNote(
  pitch: number,
  isDrum: boolean,
  velocity = 90,
): Promise<void> {
  await initializeAudio();
  const volume = velocity / 127;
  if (isDrum) {
    if (pitch === 36) {
      previewKick ??= new Tone.MembraneSynth().connect(masterGain!);
      previewKick.triggerAttackRelease("C1", 0.25, undefined, volume);
    } else if (pitch === 38) {
      previewSnare ??= new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
      }).connect(masterGain!);
      previewSnare.triggerAttackRelease(0.2, undefined, volume);
    } else {
      previewHihat ??= new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.05, release: 0.02 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      }).connect(masterGain!);
      previewHihat.triggerAttackRelease("G6", 0.08, undefined, volume * 0.7);
    }
    return;
  }
  previewSynth ??= new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.4 },
  }).connect(masterGain!);
  previewSynth.triggerAttackRelease(
    Tone.Frequency(pitch, "midi").toFrequency(),
    0.5,
    undefined,
    volume,
  );
}

export function disposeAudio(): void {
  stopPlayback();
  previewSynth?.dispose();
  previewKick?.dispose();
  previewSnare?.dispose();
  previewHihat?.dispose();
  previewSynth = null;
  previewKick = null;
  previewSnare = null;
  previewHihat = null;
  masterGain?.dispose();
  masterCompressor?.dispose();
  masterReverb?.dispose();
  masterLimiter?.dispose();
  masterMeter?.dispose();
  masterGain = null;
  masterCompressor = null;
  masterReverb = null;
  masterLimiter = null;
  masterMeter = null;
  initialized = false;
}
