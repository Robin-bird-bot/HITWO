/**
 * The audio engine (32-audio-system.md, section 2): one `AudioContext`, made
 * on the first click or key (browsers need a gesture), suspended while the
 * tab is hidden. Every sound goes through a bus (ui, sfx, minigame,
 * ambience, music) into a master gain, so Settings → Sound can set each
 * group's level and mute them all.
 *
 * - `sfx(id, options)` plays a one-shot and returns a handle that stops it.
 * - `loop(id, options)` starts a loop (fading in) and returns a handle that
 *   fades it out. A loop asked for before the first click starts with it.
 * - An id with no files plays nothing (logged once in dev builds).
 *
 * Files are fetched once and decoded into `AudioBuffer`s; `preload` fetches
 * ahead (the common sounds at the title, a biome's ambience on its loading
 * screen, a game's sounds when its challenge opens).
 */
import { BALANCE } from '../config/balance';
import {
  BUSES,
  fileUrl,
  parseManifest,
  pickFormat,
  type AudioFormat,
  type Bus,
  type Manifest,
  type SoundEntry,
} from './manifest';
import { admit, jitterFor, pickVersion, type Voice } from './voices';

const A = BALANCE.audio;

export interface SfxOptions {
  /** Times the sound's own level (1 by default). */
  volume?: number;
  /** −1 (left) to 1 (right). */
  pan?: number;
  /** Playback rate (pitch). Setting it turns off the random jitter. */
  rate?: number;
  /** Seconds from now. */
  delay?: number;
  /** This version, not a random one (the debug panel's play buttons). */
  version?: number;
}

export interface SoundHandle {
  stop(): void;
}

export interface LoopOptions {
  /** Seconds to fade in. */
  fadeIn?: number;
  /** Times the sound's own level (1 by default). */
  volume?: number;
}

export interface LoopHandle {
  readonly id: string;
  /** Fades to silence over this many seconds, then stops. */
  fadeOut(seconds?: number): void;
  /** Glides to a new level (times the sound's own) over this many seconds. */
  setVolume(volume: number, seconds?: number): void;
}

/** The levels Settings → Sound sets. */
export interface Levels {
  master: number;
  music: number;
  ambience: number;
  effects: number;
  muted: boolean;
}

const NONE: SoundHandle = { stop() {} };

const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

class Loop implements LoopHandle {
  readonly id: string;
  private readonly engine: AudioEngine;
  private readonly options: LoopOptions;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private level: number;
  private stopped = false;

  constructor(engine: AudioEngine, id: string, options: LoopOptions) {
    this.engine = engine;
    this.id = id;
    this.options = options;
    this.level = options.volume ?? 1;
  }

  get done(): boolean {
    return this.stopped;
  }

  /** Starts it, once the context exists and the file has loaded. */
  begin(context: AudioContext, entry: SoundEntry, buffer: AudioBuffer | null): void {
    if (this.stopped || this.source || !buffer) return;
    const gain = context.createGain();
    const target = this.level * (entry.volume ?? 1);
    const fade = this.options.fadeIn ?? 0;
    const t = context.currentTime;
    gain.gain.setValueAtTime(fade > 0 ? 0 : target, t);
    if (fade > 0) gain.gain.linearRampToValueAtTime(target, t + fade);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain).connect(this.engine.busInput(entry.bus) ?? context.destination);
    source.start(t);
    this.source = source;
    this.gain = gain;
  }

  fadeOut(seconds = 0.5): void {
    if (this.stopped) return;
    this.stopped = true;
    this.engine.forgetLoop(this);
    const { source, gain } = this;
    const context = this.engine.context;
    if (!source || !gain || !context) return;
    const t = context.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + Math.max(0.01, seconds));
    source.stop(t + Math.max(0.01, seconds) + 0.05);
  }

  setVolume(volume: number, seconds = 0.5): void {
    this.level = volume;
    const { gain } = this;
    const context = this.engine.context;
    const entry = this.engine.entry(this.id);
    if (!gain || !context || this.stopped) return;
    const t = context.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(volume * (entry?.volume ?? 1), t + Math.max(0.01, seconds));
  }
}

class AudioEngine {
  context: AudioContext | null = null;
  manifest: Manifest | null = null;
  /** Console-logs every `sfx()` and `loop()` call (the debug panel's switch). */
  logCalls = false;

  private format: AudioFormat = 'ogg';
  private siteBase = '/';
  private master: GainNode | null = null;
  private busLevel = new Map<Bus, GainNode>();
  private busDuck = new Map<Bus, GainNode>();
  private levels: Levels = { ...A.defaults, muted: false };
  private ducks = new Map<Bus, Map<string, number>>();
  private bytes = new Map<string, Promise<ArrayBuffer | null>>();
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  /** Decoded files, for their lengths. */
  private decoded = new Map<string, AudioBuffer>();
  private voices: Voice[] = [];
  private lastStart = new Map<string, number>();
  private lastVersion = new Map<string, number>();
  private warned = new Set<string>();
  private loops = new Set<Loop>();
  private listeners = new Set<() => void>();
  private info = new Map<string, string>();
  private loading: Promise<Manifest | null> | null = null;

  /** Loads the manifest and waits for the first click or key to make the context. */
  start(siteBase: string): Promise<Manifest | null> {
    if (this.loading) return this.loading;
    this.siteBase = siteBase;
    if (typeof window === 'undefined') return Promise.resolve(null);
    try {
      this.format = pickFormat((type) => new Audio().canPlayType(type));
    } catch {
      this.format = 'mp3';
    }
    const unlock = () => this.unlock();
    for (const type of ['pointerdown', 'keydown', 'touchend'] as const) {
      window.addEventListener(type, unlock, { capture: true });
    }
    document.addEventListener('visibilitychange', () => {
      const c = this.context;
      if (!c) return;
      if (document.hidden) void c.suspend();
      else void c.resume();
    });
    this.loading = fetch(`${siteBase}assets/audio/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw: unknown) => {
        this.manifest = parseManifest(raw);
        // Loops asked for while it loaded: the ones with files start (once there's a context).
        for (const l of [...this.loops]) {
          if (!this.playable(l.id)) this.loops.delete(l);
          else if (this.context) void this.beginLoop(l);
        }
        this.changed();
        return this.manifest;
      })
      .catch(() => null);
    return this.loading;
  }

  /** Makes (or wakes) the context after a gesture, and starts the loops that were waiting. */
  unlock(): AudioContext | null {
    if (!this.context) {
      try {
        this.context = new AudioContext();
      } catch {
        return null;
      }
      const c = this.context;
      this.master = c.createGain();
      this.master.connect(c.destination);
      for (const bus of BUSES) {
        const level = c.createGain();
        const duck = c.createGain();
        level.connect(duck).connect(this.master);
        this.busLevel.set(bus, level);
        this.busDuck.set(bus, duck);
      }
      this.applyLevels(0);
      for (const bus of BUSES) this.applyDuck(bus, 0);
      // What was fetched at the title decodes now, so its lengths are known.
      for (const file of [...this.bytes.keys()]) void this.buffer(file);
      for (const l of this.loops) void this.beginLoop(l);
      this.changed();
    }
    if (this.context.state === 'suspended' && !document.hidden) void this.context.resume();
    return this.context;
  }

  /** Where a sound on this bus connects (the packing synth uses the `sfx` bus). */
  busInput(bus: Bus): AudioNode | null {
    return this.busLevel.get(bus) ?? null;
  }

  entry(id: string): SoundEntry | undefined {
    return this.manifest?.sounds[id];
  }

  setLevels(levels: Levels): void {
    this.levels = levels;
    this.applyLevels(A.levelRampSeconds);
  }

  /**
   * Turns a bus down to `factor` (0 to 1) for one reason (`key`), over
   * `seconds`; `factor` 1 lifts it. Several reasons multiply.
   */
  duck(bus: Bus, key: string, factor: number, seconds = 0.5): void {
    const map = this.ducks.get(bus) ?? new Map<string, number>();
    if (factor >= 1) map.delete(key);
    else map.set(key, clamp(factor, 0, 1));
    this.ducks.set(bus, map);
    this.applyDuck(bus, seconds);
  }

  sfx(id: string, options: SfxOptions = {}): SoundHandle {
    if (this.logCalls) console.log('[sfx]', id, options);
    const entry = this.playable(id);
    const context = this.context;
    if (!entry || !context || context.state !== 'running') return NONE;
    const at = now();
    // When it starts: the limits look at that, so a run of delayed beeps all play.
    const startsAt = at + Math.max(0, options.delay ?? 0) * 1000;
    const version =
      options.version !== undefined
        ? clamp(Math.floor(options.version), 0, entry.files.length - 1)
        : pickVersion(entry.files.length, this.lastVersion.get(id), Math.random);
    const file = entry.files[version] ?? entry.files[0] ?? '';
    const { rate, gain } = jitterFor(id, entry.files.length, options.rate, Math.random);
    const length = this.decoded.get(file)?.duration;
    const admission = admit(this.voices, id, startsAt, this.lastStart.get(id));
    if (!admission.play) return NONE;
    for (const v of admission.stop) v.stop();
    this.lastStart.set(id, startsAt);
    this.lastVersion.set(id, version);

    let source: AudioBufferSourceNode | null = null;
    let cancelled = false;
    const voice: Voice = {
      id,
      started: startsAt,
      ...(length !== undefined ? { ends: startsAt + (length / rate) * 1000 } : {}),
      stop: () => {
        cancelled = true;
        this.forgetVoice(voice);
        try {
          source?.stop();
        } catch {
          // Already stopped.
        }
      },
    };
    this.voices.push(voice);
    this.changed();

    void this.buffer(file).then((buffer) => {
      if (cancelled || !buffer || now() - at > A.lateMs) {
        this.forgetVoice(voice);
        return;
      }
      const node = context.createBufferSource();
      node.buffer = buffer;
      node.playbackRate.value = rate;
      const level = context.createGain();
      level.gain.value = (options.volume ?? 1) * (entry.volume ?? 1) * gain;
      let out: AudioNode = node.connect(level);
      if (options.pan) {
        const panner = context.createStereoPanner();
        panner.pan.value = clamp(options.pan, -1, 1);
        out = out.connect(panner);
      }
      out.connect(this.busInput(entry.bus) ?? context.destination);
      node.onended = () => {
        this.forgetVoice(voice);
        node.disconnect();
      };
      source = node;
      node.start(context.currentTime + Math.max(0, options.delay ?? 0));
    });
    return voice;
  }

  loop(id: string, options: LoopOptions = {}): LoopHandle {
    if (this.logCalls) console.log('[loop]', id, options);
    const l = new Loop(this, id, options);
    // Before the manifest is in (the title's ambience), the loop waits for it.
    if (this.manifest && !this.playable(id)) return l;
    this.loops.add(l);
    this.changed();
    if (this.context) void this.beginLoop(l);
    return l;
  }

  forgetLoop(l: Loop): void {
    if (this.loops.delete(l)) this.changed();
  }

  /** Fetches these sounds' files ahead of time (and decodes them once the context exists). */
  async preload(ids: readonly string[], onProgress?: (done: number, total: number) => void) {
    const files = [...new Set(ids.flatMap((id) => this.entry(id)?.files ?? []))];
    let done = 0;
    onProgress?.(0, files.length);
    await Promise.all(
      files.map(async (f) => {
        if (this.context) await this.buffer(f);
        else await this.fetchBytes(f);
        done += 1;
        onProgress?.(done, files.length);
      }),
    );
  }

  /** How many one-shots and loops are playing (the debug panel). */
  get playing(): { sounds: number; loops: string[] } {
    return { sounds: this.voices.length, loops: [...this.loops].map((l) => l.id) };
  }

  /** A line for the debug panel's Sound tab (the ambience and music directors fill these in). */
  setInfo(key: string, text: string | null): void {
    if (text === null) this.info.delete(key);
    else this.info.set(key, text);
    this.changed();
  }

  getInfo(key: string): string | undefined {
    return this.info.get(key);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private changed(): void {
    for (const l of this.listeners) l();
  }

  /** The id's entry when it has a file to play; otherwise nothing (said once in dev builds). */
  private playable(id: string): SoundEntry | null {
    const entry = this.entry(id);
    if (entry?.files.length) return entry;
    if (this.manifest && import.meta.env.DEV && !this.warned.has(id)) {
      this.warned.add(id);
      console.info(`[sound] ${id}: ${entry ? 'no file yet' : 'not in the manifest'}`);
    }
    return null;
  }

  private async beginLoop(l: Loop): Promise<void> {
    const entry = this.entry(l.id);
    const context = this.context;
    if (!entry || !context || l.done) return;
    const file = entry.files[Math.floor(Math.random() * entry.files.length)] ?? '';
    l.begin(context, entry, await this.buffer(file));
  }

  private forgetVoice(v: Voice): void {
    const i = this.voices.indexOf(v);
    if (i >= 0) {
      this.voices.splice(i, 1);
      this.changed();
    }
  }

  private fetchBytes(file: string): Promise<ArrayBuffer | null> {
    let p = this.bytes.get(file);
    if (!p && this.manifest) {
      const url = fileUrl(this.manifest, file, this.format, this.siteBase);
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
      this.bytes.set(file, p);
    }
    return p ?? Promise.resolve(null);
  }

  private buffer(file: string): Promise<AudioBuffer | null> {
    const context = this.context;
    if (!context) return Promise.resolve(null);
    let p = this.buffers.get(file);
    if (!p) {
      p = this.fetchBytes(file).then(async (bytes) => {
        // Decoding takes the bytes over, so the fetched copy goes.
        this.bytes.delete(file);
        if (!bytes) return null;
        try {
          const buffer = await context.decodeAudioData(bytes);
          this.decoded.set(file, buffer);
          return buffer;
        } catch {
          return null;
        }
      });
      this.buffers.set(file, p);
    }
    return p;
  }

  private ramp(param: AudioParam, value: number, seconds: number): void {
    const c = this.context;
    if (!c) return;
    const t = c.currentTime;
    param.cancelScheduledValues(t);
    if (seconds <= 0) param.setValueAtTime(value, t);
    else param.setTargetAtTime(value, t, seconds / 3);
  }

  private applyLevels(seconds: number): void {
    const { master, music, ambience, effects, muted } = this.levels;
    if (this.master) this.ramp(this.master.gain, muted ? 0 : master, seconds);
    const level: Record<Bus, number> = {
      ui: effects,
      sfx: effects,
      minigame: effects,
      ambience,
      music,
    };
    for (const bus of BUSES) {
      const g = this.busLevel.get(bus);
      if (g) this.ramp(g.gain, level[bus], seconds);
    }
  }

  private applyDuck(bus: Bus, seconds: number): void {
    const g = this.busDuck.get(bus);
    if (!g) return;
    let factor = 1;
    for (const f of this.ducks.get(bus)?.values() ?? []) factor *= f;
    this.ramp(g.gain, factor, seconds);
  }
}

/** The game's one audio engine. */
export const audio = new AudioEngine();

/** Plays a one-shot sound by id (`33-sound-list.md`). */
export const sfx = (id: string, options?: SfxOptions): SoundHandle => audio.sfx(id, options);

/** Starts a loop by id; fade it out with the handle. */
export const loop = (id: string, options?: LoopOptions): LoopHandle => audio.loop(id, options);
