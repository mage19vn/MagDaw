import * as Tone from "tone";
import {
  audibleTracks,
  beatsPerBar,
  projectEnd,
  type Project,
  type Track,
} from "../domain/types";
import type { AudioEngine, AudioMeters } from "./contracts";
import {
  ToneInstrumentProvider,
  type InstrumentProvider,
  type TrackInstrument,
} from "./instrumentProvider";

interface ScheduledNote {
  key: string;
  trackId: string;
  pitch: number;
  velocity: number;
  start: number;
  end: number;
}
interface TrackChannel {
  gain: Tone.Gain;
  pan: Tone.Panner;
  meter: Tone.Analyser;
  instrument: TrackInstrument;
  instrumentKey: string;
}
interface MasterNodes {
  gain: Tone.Gain;
  compressor: Tone.Compressor;
  reverb: Tone.Freeverb;
  limiter: Tone.Limiter;
  meter: Tone.Analyser;
}

export const PLAYBACK_POLICY = {
  seek: "Note bắt đầu trước vị trí seek nhưng chưa kết thúc được phát lại phần còn lại.",
  loop: "Mỗi vòng tắt note cũ và phát lại phần note còn kéo qua đầu vùng loop.",
  edits:
    "Thay note hoặc nhạc cụ: thay lịch ngay tại ranh giới transport hiện tại, nghỉ đồng bộ 30 ms rồi tiếp tục.",
  overlap:
    "Các note chồng nhau được cộng dồn, kể cả cùng pitch trong cùng track.",
} as const;

export class ToneAudioEngine implements AudioEngine {
  private project: Project | null = null;
  private readonly transport = Tone.getTransport();
  private readonly channels = new Map<string, TrackChannel>();
  private master: MasterNodes | null = null;
  private click: Tone.Synth | null = null;
  private eventIds: number[] = [];
  private metronomeEnabled = false;
  private initialized = false;
  private playing = false;
  private playRevision = 0;
  private musicFingerprint = "";
  private masterChainFingerprint = "";
  private notes: ScheduledNote[] = [];
  private readonly onLoopEnd = (time: number): void => this.silence(time);

  constructor(
    private readonly instrumentProvider: InstrumentProvider = new ToneInstrumentProvider(),
  ) {}

  async initialize(): Promise<void> {
    await Tone.start();
    if (this.initialized) return;
    this.master = {
      gain: new Tone.Gain(1),
      compressor: new Tone.Compressor({
        threshold: -18,
        ratio: 3,
        attack: 0.01,
        release: 0.1,
      }),
      reverb: new Tone.Freeverb({ roomSize: 0.5, dampening: 3000, wet: 0.2 }),
      limiter: new Tone.Limiter(-1),
      meter: new Tone.Analyser({ type: "waveform", size: 1024, channels: 2 }),
    };
    this.click = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.015, sustain: 0, release: 0.005 },
      volume: -20,
    }).connect(this.master.gain);
    this.transport.on("loopEnd", this.onLoopEnd);
    this.initialized = true;
    if (this.project) {
      this.applyProjectSettings();
      this.rebuildSchedule();
    }
  }

  setProject(project: Project): void {
    const previousId = this.project?.id;
    const fingerprint = JSON.stringify({
      id: project.id,
      signature: project.time_signature,
      loop: project.loop,
      tracks: project.tracks.map((track) => ({
        id: track.id,
        program: track.program,
        is_drum: track.is_drum,
        instrument_config: track.instrument_config,
        clips: track.clips,
      })),
    });
    const musicChanged = this.musicFingerprint !== fingerprint;
    const replacingProject =
      previousId !== undefined && previousId !== project.id;
    if (replacingProject) this.playRevision += 1;
    const resume = this.playing && !replacingProject;
    const position = replacingProject ? 0 : this.getPosition();
    if (this.initialized && musicChanged) {
      this.transport.pause();
      this.silence(Tone.now());
      this.playing = false;
    }
    this.project = project;
    this.musicFingerprint = fingerprint;
    if (!this.initialized) return;
    this.applyProjectSettings();
    if (musicChanged) {
      this.rebuildSchedule();
      this.transport.ticks = this.beatToTicks(position);
      if (resume) this.startAtPosition(position);
    }
  }

  private instrumentKey(track: Track): string {
    return JSON.stringify([
      track.program,
      track.is_drum,
      track.instrument_config,
    ]);
  }

  private createChannel(track: Track): TrackChannel {
    if (!this.master) throw new Error("Âm thanh chưa được khởi tạo.");
    const gain = new Tone.Gain(1);
    const pan = new Tone.Panner(track.pan);
    const meter = new Tone.Analyser({
      type: "waveform",
      size: 512,
      channels: 2,
    });
    gain.connect(pan);
    pan.connect(this.master.gain);
    pan.connect(meter);
    return {
      gain,
      pan,
      meter,
      instrument: this.instrumentProvider.create(track, gain),
      instrumentKey: this.instrumentKey(track),
    };
  }

  private disposeChannel(channel: TrackChannel): void {
    channel.instrument.dispose();
    channel.gain.dispose();
    channel.pan.dispose();
    channel.meter.dispose();
  }

  private applyProjectSettings(): void {
    const project = this.project;
    const master = this.master;
    if (!project || !master) return;
    this.transport.bpm.value = project.bpm;
    this.transport.timeSignature = project.time_signature;
    this.transport.loop = project.loop.enabled;
    this.transport.loopStart = `${this.beatToTicks(project.loop.start_beat)}i`;
    this.transport.loopEnd = `${this.beatToTicks(project.loop.end_beat)}i`;
    const audible = new Set(audibleTracks(project).map((track) => track.id));
    for (const [id, channel] of this.channels) {
      if (!project.tracks.some((track) => track.id === id)) {
        this.disposeChannel(channel);
        this.channels.delete(id);
      }
    }
    for (const track of project.tracks) {
      let channel = this.channels.get(track.id);
      if (!channel || channel.instrumentKey !== this.instrumentKey(track)) {
        if (channel) this.disposeChannel(channel);
        channel = this.createChannel(track);
        this.channels.set(track.id, channel);
      }
      channel.gain.gain.rampTo(
        audible.has(track.id) ? Tone.dbToGain(track.volume_db) : 0,
        0.012,
      );
      channel.pan.pan.rampTo(track.pan, 0.012);
    }
    master.gain.gain.rampTo(
      Tone.dbToGain(project.master.gain_bypass ? 0 : project.master.gain_db),
      0.012,
    );
    const compressor = project.master.compressor;
    master.compressor.set({
      threshold: compressor.threshold_db,
      ratio: compressor.ratio,
      attack: compressor.attack_ms / 1000,
      release: compressor.release_ms / 1000,
    });
    master.reverb.roomSize.value = project.master.reverb.room_size;
    master.reverb.wet.value = project.master.reverb.wet;
    master.limiter.threshold.value = project.master.limiter.ceiling_db;
    const chainFingerprint = JSON.stringify([
      project.master.compressor.bypass,
      project.master.reverb.bypass,
      project.master.limiter.bypass,
    ]);
    if (this.masterChainFingerprint !== chainFingerprint) {
      this.connectMasterChain();
      this.masterChainFingerprint = chainFingerprint;
    }
  }

  private connectMasterChain(): void {
    const master = this.master;
    const settings = this.project?.master;
    if (!master || !settings) return;
    master.gain.disconnect();
    master.compressor.disconnect();
    master.reverb.disconnect();
    master.limiter.disconnect();
    let previous: Tone.ToneAudioNode = master.gain;
    if (!settings.compressor.bypass) {
      previous.connect(master.compressor);
      previous = master.compressor;
    }
    if (!settings.reverb.bypass) {
      previous.connect(master.reverb);
      previous = master.reverb;
    }
    if (!settings.limiter.bypass) {
      previous.connect(master.limiter);
      previous = master.limiter;
    }
    // The analyser observes the final signal; no gain follows the limiter.
    previous.connect(Tone.getDestination());
    previous.connect(master.meter);
  }

  private beatToTicks(beat: number): number {
    return Math.round(beat * this.transport.PPQ);
  }

  private scheduleAt(beat: number, callback: (time: number) => void): void {
    this.eventIds.push(
      this.transport.schedule(callback, `${this.beatToTicks(beat)}i`),
    );
  }

  private rebuildSchedule(): void {
    this.eventIds.forEach((id) => this.transport.clear(id));
    this.eventIds = [];
    const project = this.project;
    if (!project) return;
    this.notes = project.tracks.flatMap((track) =>
      track.clips.flatMap((clip) =>
        clip.notes.map((note) => ({
          key: `${track.id}/${clip.id}/${note.id}`,
          trackId: track.id,
          pitch: note.pitch,
          velocity: note.velocity,
          start: clip.start_beat + note.start_beat,
          end: clip.start_beat + note.start_beat + note.length_beat,
        })),
      ),
    );
    for (const note of this.notes) {
      this.scheduleAt(note.start, (time) =>
        this.channels
          .get(note.trackId)
          ?.instrument.attack(note.key, note.pitch, note.velocity, time),
      );
      this.scheduleAt(note.end, (time) =>
        this.channels.get(note.trackId)?.instrument.release(note.key, time),
      );
      if (
        project.loop.enabled &&
        note.start < project.loop.start_beat &&
        note.end > project.loop.start_beat
      ) {
        this.scheduleAt(project.loop.start_beat, (time) =>
          this.channels
            .get(note.trackId)
            ?.instrument.attack(note.key, note.pitch, note.velocity, time),
        );
      }
    }
    const interval = 4 / project.time_signature[1];
    this.eventIds.push(
      this.transport.scheduleRepeat(
        (time) => {
          if (!this.metronomeEnabled) return;
          const beat = this.transport.getTicksAtTime(time) / this.transport.PPQ;
          const bar = beatsPerBar(project.time_signature);
          const accented =
            Math.abs(beat / bar - Math.round(beat / bar)) < 0.001;
          this.click?.triggerAttackRelease(
            accented ? 1800 : 1100,
            0.025,
            time,
            accented ? 0.7 : 0.4,
          );
        },
        `${this.beatToTicks(interval)}i`,
      ),
    );
    if (!project.loop.enabled) {
      this.scheduleAt(projectEnd(project), (time) => {
        this.transport.pause(time);
        this.playing = false;
      });
    }
  }

  private primeSustainedNotes(beat: number, time: number): void {
    for (const note of this.notes) {
      if (note.start < beat - 0.0001 && note.end > beat + 0.0001) {
        this.channels
          .get(note.trackId)
          ?.instrument.attack(note.key, note.pitch, note.velocity, time);
      }
    }
  }

  private startAtPosition(beat: number): void {
    const project = this.project;
    if (!project) return;
    const position =
      project.loop.enabled && beat >= project.loop.end_beat
        ? project.loop.start_beat
        : beat;
    this.transport.ticks = this.beatToTicks(position);
    const time = Tone.now() + 0.03;
    this.primeSustainedNotes(position, time);
    this.transport.start(time, `${this.beatToTicks(position)}i`);
    this.playing = true;
  }

  async play(): Promise<void> {
    const revision = ++this.playRevision;
    await this.initialize();
    if (revision !== this.playRevision || this.playing || !this.project) return;
    this.startAtPosition(this.getPosition());
  }

  private silence(time: number): void {
    this.channels.forEach((channel) => channel.instrument.silence(time));
    this.click?.triggerRelease(time);
  }

  pause(): void {
    this.playRevision += 1;
    if (!this.initialized) return;
    this.transport.pause();
    this.silence(Tone.now());
    this.playing = false;
  }

  stop(): void {
    this.playRevision += 1;
    this.transport.stop();
    this.transport.ticks = 0;
    if (this.initialized) this.silence(Tone.now());
    this.playing = false;
  }

  seek(beat: number): void {
    if (!Number.isFinite(beat) || beat < 0)
      throw new Error("Vị trí phát phải là beat không âm.");
    this.playRevision += 1;
    const resume = this.playing;
    if (this.initialized) {
      this.transport.pause();
      this.silence(Tone.now());
    }
    this.playing = false;
    this.transport.ticks = this.beatToTicks(beat);
    if (resume) this.startAtPosition(beat);
  }

  getPosition(): number {
    return Math.max(0, this.transport.ticks / this.transport.PPQ);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setMetronome(enabled: boolean): void {
    this.metronomeEnabled = enabled;
  }

  async audition(track: Track, pitch: number, velocity = 95): Promise<void> {
    await this.initialize();
    const channel = this.channels.get(track.id);
    if (!channel) return;
    const time = Tone.now();
    const key = `audition/${crypto.randomUUID()}`;
    channel.instrument.attack(key, pitch, velocity, time);
    channel.instrument.release(key, time + 0.25);
  }

  private peak(meter: Tone.Analyser): number {
    const values = meter.getValue();
    const channels = values instanceof Float32Array ? [values] : values;
    let peak = 0;
    for (const channel of channels) {
      for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
    }
    return peak;
  }

  getMeters(): AudioMeters {
    return {
      master: this.master ? this.peak(this.master.meter) : 0,
      tracks: Object.fromEntries(
        [...this.channels].map(([id, channel]) => [
          id,
          this.peak(channel.meter),
        ]),
      ),
    };
  }

  getDiagnostics(): {
    initialized: boolean;
    scheduledEvents: number;
    channels: number;
    playing: boolean;
  } {
    return {
      initialized: this.initialized,
      scheduledEvents: this.eventIds.length,
      channels: this.channels.size,
      playing: this.playing,
    };
  }

  dispose(): void {
    this.stop();
    this.eventIds.forEach((id) => this.transport.clear(id));
    this.eventIds = [];
    this.transport.off("loopEnd", this.onLoopEnd);
    this.channels.forEach((channel) => this.disposeChannel(channel));
    this.channels.clear();
    this.click?.dispose();
    this.click = null;
    if (this.master)
      Object.values(this.master).forEach((node) => node.dispose());
    this.master = null;
    this.initialized = false;
    this.project = null;
    this.musicFingerprint = "";
    this.masterChainFingerprint = "";
    this.notes = [];
  }
}
