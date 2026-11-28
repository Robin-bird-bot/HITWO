/**
 * The packing screen's particles, on one canvas over the whole 1600 × 1000
 * stage (the prototypes' `burst`): pixel squares, sparks, dust, leaves,
 * falling glyphs, rings and pictures (acorns). Under reduced motion about a
 * quarter of them (27-packing-screen.md, section 5).
 */
import { STAGE_HEIGHT, STAGE_WIDTH } from '../stage/fitStage';

export type ParticleKind =
  /** A square that keeps its size (TrailMate's pixel sparks). */
  | 'pix'
  /** A square that shrinks as it fades. */
  | 'bit'
  /** An eight-point star (the cabinet's sparks). */
  | 'star'
  /** A soft puff that grows. */
  | 'dust'
  /** A small flat ellipse (autumn leaves). */
  | 'leaf'
  /** A falling character that flickers (TrailMate's data rain). */
  | 'glyph'
  /** A ring that spreads out. */
  | 'ring'
  /** A picture (an acorn). */
  | 'img';

export interface BurstOptions {
  speed?: number;
  /** Spread the starting points this wide. */
  spread?: number;
  /** A head start upward. */
  up?: number;
  decay?: number;
  size?: number;
  colors?: readonly string[];
  src?: string;
  /** Gravity per frame. */
  gravity?: number;
  /** A ring's widest radius. */
  max?: number;
  /** Fall from above the whole screen, like rain. */
  rain?: boolean;
  /** Draw pictures with crisp pixels. */
  pixelated?: boolean;
}

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  life: number;
  decay: number;
  size: number;
  color: string;
  src: string | null;
  g: number;
  max: number;
  ch: string;
  pixelated: boolean;
}

const GLYPHS = '01▲◆+×#@%$&<>'.split('');
const anyOf = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;

export class Particles {
  private parts: Particle[] = [];
  private running = false;
  private frame = 0;
  private readonly images = new Map<string, HTMLImageElement>();

  private readonly canvas: HTMLCanvasElement;
  private readonly reduced: boolean;

  constructor(canvas: HTMLCanvasElement, reduced: boolean) {
    this.canvas = canvas;
    this.reduced = reduced;
  }

  private image(src: string): HTMLImageElement {
    let img = this.images.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      this.images.set(src, img);
    }
    return img;
  }

  burst(x: number, y: number, kind: ParticleKind, count: number, o: BurstOptions = {}): void {
    const n = this.reduced ? Math.ceil(count / 4) : count;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 6) * (0.4 + Math.random());
      const p: Particle = {
        kind,
        x: x + (o.spread ? (Math.random() - 0.5) * o.spread : 0),
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (o.up ?? 0),
        r: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1,
        decay: o.decay ?? 0.012 + Math.random() * 0.01,
        size: o.size ?? 8,
        color: o.colors ? anyOf(o.colors) : '#6BFF8A',
        src: o.src ?? null,
        g: o.gravity ?? 0.2,
        max: o.max ?? 600,
        ch: anyOf(GLYPHS),
        pixelated: !!o.pixelated,
      };
      if (o.rain) {
        p.x = Math.random() * STAGE_WIDTH;
        p.y = -40 - Math.random() * 500;
        p.vx = kind === 'glyph' ? 0 : (Math.random() - 0.5) * 2;
        p.vy = 3 + Math.random() * 4;
        p.decay = 0.004;
      }
      if (kind === 'ring') {
        p.vx = 0;
        p.vy = 0;
        p.g = 0;
        p.decay = o.decay ?? 0.012;
      }
      this.parts.push(p);
    }
    if (!this.running) {
      this.running = true;
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
    this.running = false;
    this.parts = [];
  }

  private readonly tick = (): void => {
    const g = this.canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    this.parts = this.parts.filter((p) => p.life > 0 && p.y < STAGE_HEIGHT + 100);
    for (const p of this.parts) {
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      p.life -= p.decay;
      if (p.kind === 'dust') {
        p.vx *= 0.9;
        p.vy *= 0.9;
      }
      g.save();
      g.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
      g.translate(Math.round(p.x), Math.round(p.y));
      this.draw(g, p);
      g.restore();
    }
    if (this.parts.length) this.frame = requestAnimationFrame(this.tick);
    else {
      this.running = false;
      g.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    }
  };

  private draw(g: CanvasRenderingContext2D, p: Particle): void {
    switch (p.kind) {
      case 'ring':
        g.globalAlpha = Math.max(0, p.life) * 0.8;
        g.strokeStyle = p.color;
        g.lineWidth = 4;
        g.beginPath();
        g.arc(0, 0, (1 - p.life) * p.max + 10, 0, Math.PI * 2);
        g.stroke();
        return;
      case 'glyph':
        g.fillStyle = p.color;
        g.font = `${p.size}px EditUndo, monospace`;
        if (Math.random() < 0.08) p.ch = anyOf(GLYPHS);
        g.fillText(p.ch, 0, 0);
        return;
      case 'img': {
        if (!p.src) return;
        const img = this.image(p.src);
        if (!img.complete) return;
        g.rotate(p.r);
        g.imageSmoothingEnabled = !p.pixelated;
        g.drawImage(img, -p.size / 2, -p.size / 2, p.size, p.size);
        return;
      }
      case 'star':
        g.rotate(p.r);
        g.fillStyle = p.color;
        g.beginPath();
        for (let k = 0; k < 8; k++) {
          const rr = k % 2 ? p.size * 0.35 : p.size;
          g.lineTo(Math.cos((k * Math.PI) / 4) * rr, Math.sin((k * Math.PI) / 4) * rr);
        }
        g.fill();
        return;
      case 'dust':
        g.fillStyle = 'rgba(220,190,150,.35)';
        g.beginPath();
        g.arc(0, 0, p.size * (1.6 - p.life), 0, Math.PI * 2);
        g.fill();
        return;
      case 'leaf':
        g.rotate(p.r);
        g.fillStyle = p.color;
        g.beginPath();
        g.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        g.fill();
        return;
      default: {
        g.fillStyle = p.color;
        const s = Math.max(2, Math.round(p.size * (p.kind === 'pix' ? 1 : p.life)));
        g.fillRect(-s / 2, -s / 2, s, s);
      }
    }
  }
}
