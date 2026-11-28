/**
 * The music player (32-audio-system.md, section 5): plays what `music.ts`
 * chooses on the music bus. A piece's versions all start together and loop
 * on the piece's length, each through its own gain; changes only move
 * those gains, and a new piece starts on the current one's next bar line.
 *
 * On the way to the bus: a low-pass filter that sweeps in wind, and a slow
 * pitch wobble in a heatwave (Claude's ideas). A minigame's last seconds
 * raise the playback rate. With no songs in the manifest yet, it plays
 * nothing.
 */
import { BALANCE } from '../config/balance';
import { audio } from './engine';
import { pickFormat } from './manifest';
import {
  chooseMusic,
  loopSeconds,
  parseMusicManifest,
  planMusic,
  weatherEffects,
  type MusicManifest,
  type MusicScene,
  type NowPlaying,
} from './music';

const M = BALANCE.audio.music;
const OPEN_HZ = 20000;
/** A moment's notice for anything scheduled "now", so every version starts together. */
const LEAD = 0.08;

interface Playing extends NowPlaying {
  out: GainNode;
  versions: Map<string, { gain: GainNode; source: AudioBufferSourceNode }>;
}

class MusicPlayer {
  private manifest: MusicManifest = { pieces: {} };
  private siteBase = '/';
  private format: 'ogg' | 'mp3' = 'ogg';
  private scene: MusicScene = { place: 'none' };
  private playing: Playing | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private chain: {
    filter: BiquadFilterNode;
    sweep: GainNode;
    wobble: GainNode;
  } | null = null;
  private rate = 1;
  /** Bumps with every change, so a slow load can't start a piece that's no longer wanted. */
  private turn = 0;
  private hadContext = false;

  /** Loads the music manifest, and starts once the audio does. */
  start(siteBase: string): void {
    this.siteBase = siteBase;
    try {
      this.format = pickFormat((type) => new Audio().canPlayType(type));
    } catch {
      this.format = 'mp3';
    }
    fetch(`${siteBase}assets/audio/music/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((raw: unknown) => {
        this.manifest = parseMusicManifest(raw);
        this.apply();
      })
      .catch(() => undefined);
    audio.subscribe(() => {
      if (audio.context && !this.hadContext) {
        this.hadContext = true;
        this.apply();
      }
    });
    this.info();
  }

  /** Where the game is: the music follows. */
  set(scene: MusicScene): void {
    this.scene = scene;
    this.apply();
  }

  /** A minigame's clock: faster in its last seconds (1 for normal). */
  hurry(rate: number): void {
    if (rate === this.rate) return;
    this.rate = rate;
    this.info();
    const c = audio.context;
    if (!c || !this.playing) return;
    for (const v of this.playing.versions.values()) {
      v.source.playbackRate.setTargetAtTime(rate, c.currentTime, 0.3);
    }
  }

  private url(file: string): string {
    return /\.\w+$/.test(file)
      ? `${this.siteBase}assets/audio/music/${file}`
      : `${this.siteBase}assets/audio/music/${file}.${this.format}`;
  }

  private load(c: AudioContext, file: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(file);
    if (!p) {
      p = fetch(this.url(file))
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((bytes) => (bytes ? c.decodeAudioData(bytes) : null))
        .catch(() => null);
      this.buffers.set(file, p);
    }
    return p;
  }

  /** The filter and the two slow oscillators, made once. */
  private ensureChain(c: AudioContext): NonNullable<MusicPlayer['chain']> {
    if (this.chain) return this.chain;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = OPEN_HZ;
    filter.connect(audio.busInput('music') ?? c.destination);
    // Wind: the cutoff swings between the two frequencies, out and back over twice the sweep.
    const sweepOsc = c.createOscillator();
    sweepOsc.frequency.value = 1 / (2 * M.wind.sweepSec);
    const sweep = c.createGain();
    sweep.gain.value = 0;
    sweepOsc.connect(sweep).connect(filter.frequency);
    sweepOsc.start();
    // Heat: a slow wobble of every source's pitch.
    const wobbleOsc = c.createOscillator();
    wobbleOsc.frequency.value = M.heat.hz;
    const wobble = c.createGain();
    wobble.gain.value = 0;
    wobbleOsc.connect(wobble);
    wobbleOsc.start();
    this.chain = { filter, sweep, wobble };
    return this.chain;
  }

  private applyWeather(c: AudioContext): void {
    const { filter, sweep, wobble } = this.ensureChain(c);
    const fx = weatherEffects(this.scene.place === 'trail' ? this.scene.weather : undefined);
    const t = c.currentTime;
    const middle = (M.wind.lowHz + M.wind.highHz) / 2;
    const depth = (M.wind.highHz - M.wind.lowHz) / 2;
    filter.frequency.setTargetAtTime(fx.sweep ? middle : OPEN_HZ, t, 1);
    sweep.gain.setTargetAtTime(fx.sweep ? depth : 0, t, 1);
    wobble.gain.setTargetAtTime(fx.wobble ? M.heat.cents : 0, t, 1);
  }

  private apply(): void {
    const c = audio.context;
    if (!c) return;
    this.applyWeather(c);
    const want = chooseMusic(this.scene, this.manifest);
    const plan = planMusic(this.playing, want, this.manifest, c.currentTime + LEAD);
    const turn = ++this.turn;
    if (plan.kind === 'keep') {
      this.info();
      return;
    }
    if (plan.kind === 'versions' && this.playing) {
      for (const [name, v] of this.playing.versions) {
        v.gain.gain.cancelScheduledValues(c.currentTime);
        v.gain.gain.setTargetAtTime(plan.volumes[name] ?? 0, c.currentTime, plan.fade / 3);
      }
      this.playing.version = want?.version ?? this.playing.version;
      this.info();
      return;
    }
    if (plan.kind === 'stop') {
      this.fadeOut(c, plan.at, plan.fade);
      this.playing = null;
      this.info();
      return;
    }
    if (plan.kind !== 'start') return;
    const piece = this.manifest.pieces[plan.piece];
    if (!piece) return;
    const names = Object.keys(piece.versions);
    void Promise.all(names.map((n) => this.load(c, piece.versions[n] ?? ''))).then((buffers) => {
      if (turn !== this.turn) return;
      const chain = this.ensureChain(c);
      // Loading may have taken a while: the bar line it waits for is still the plan's, or the next one.
      const at = Math.max(plan.at, c.currentTime + LEAD);
      const out = c.createGain();
      out.connect(chain.filter);
      out.gain.setValueAtTime(plan.fade ? 0 : 1, at);
      if (plan.fade) out.gain.linearRampToValueAtTime(1, at + plan.fade);
      const versions: Playing['versions'] = new Map();
      buffers.forEach((buffer, i) => {
        const name = names[i];
        if (!buffer || !name) return;
        const source = c.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = Math.min(loopSeconds(piece), buffer.duration);
        source.playbackRate.value = this.rate;
        chain.wobble.connect(source.detune);
        const gain = c.createGain();
        gain.gain.value = plan.volumes[name] ?? 0;
        source.connect(gain).connect(out);
        source.start(at);
        versions.set(name, { gain, source });
      });
      if (this.playing) this.fadeOut(c, at, plan.fade || M.fade.piece);
      this.playing = { piece: plan.piece, version: plan.version, startedAt: at, out, versions };
      this.info();
    });
  }

  private fadeOut(c: AudioContext, at: number, fade: number): void {
    const old = this.playing;
    if (!old) return;
    const start = Math.max(at, c.currentTime);
    old.out.gain.cancelScheduledValues(start);
    old.out.gain.setValueAtTime(old.out.gain.value, start);
    old.out.gain.linearRampToValueAtTime(0, start + fade);
    for (const v of old.versions.values()) {
      try {
        v.source.stop(start + fade + 0.05);
      } catch {
        // Already stopped.
      }
    }
  }

  private info(): void {
    const p = this.playing;
    const pieces = Object.keys(this.manifest.pieces).length;
    audio.setInfo(
      'music',
      p
        ? `${p.piece} · ${p.version}${this.rate !== 1 ? ` · ×${this.rate}` : ''}`
        : `off (${this.scene.place}${pieces ? '' : ', no songs yet'})`,
    );
  }
}

/** The game's one music player. Screens tell it where the game is (`useMusic`). */
export const music = new MusicPlayer();
