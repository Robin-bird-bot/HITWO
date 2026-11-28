/**
 * The brush reveal's covers (35-ui-overhaul.md, section 5), ported from the
 * prototype's `paintCover` and `brushBits`: each card hides under its node's
 * cover, drawn with depth and shadows, painted once per card into a canvas.
 *
 * - Forest: piles of autumn leaves and twigs.
 * - River: wet pebbles over ripples.
 * - Wildlife: tall grass with seed heads and little flowers.
 * - Mountain: chipped stone slabs with light edges and gravel, after Wyatt's
 *   stone square.
 *
 * Brushing erases the cover with a wide round brush; bits of leaf, water,
 * grass or gravel flick off as you go. It's only a look: randomness here is
 * the screen's, not the game's.
 */
import { BALANCE } from '../../config/balance';
import type { NodeType } from '../../engine';

type CoverNode = NodeType | 'any';

const pick = <T>(r: () => number, items: readonly T[]): T => items[Math.floor(r() * items.length)]!;

/** Paints a node's cover over the whole canvas. */
export function paintCover(canvas: HTMLCanvasElement, node: CoverNode, random = Math.random): void {
  const x = canvas.getContext('2d');
  if (!x) return;
  const W = canvas.width;
  const Hh = canvas.height;
  const s = W / 158;
  const R = (a: number, b: number) => a + random() * (b - a);
  const shadow = (blur: number, oy: number, a = 0.35) => {
    x.shadowColor = `rgba(0,0,0,${a})`;
    x.shadowBlur = blur * s;
    x.shadowOffsetY = oy * s;
    x.shadowOffsetX = oy * 0.4 * s;
  };
  const noShadow = () => {
    x.shadowColor = 'transparent';
    x.shadowBlur = 0;
    x.shadowOffsetX = 0;
    x.shadowOffsetY = 0;
  };
  const grad = (y0: number, y1: number, c0: string, c1: string) => {
    const g = x.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    return g;
  };

  if (node === 'forest' || node === 'any') {
    x.fillStyle = grad(0, Hh, '#3e3020', '#2c2216');
    x.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 40; i++) {
      x.strokeStyle = pick(random, ['#5a4428', '#6b5232']);
      x.lineWidth = R(1, 2.2) * s;
      x.beginPath();
      const px = R(0, W);
      const py = R(0, Hh);
      x.moveTo(px, py);
      x.lineTo(px + R(-30, 30) * s, py + R(-12, 12) * s);
      x.stroke();
    }
    const cols: [string, string][] = [
      ['#7d9b3e', '#a9c05a'],
      ['#5f7f34', '#8aa64a'],
      ['#c98d2c', '#ecc25a'],
      ['#c4622a', '#e8904a'],
      ['#a8402a', '#d2684a'],
      ['#8c5c2a', '#b98448'],
      ['#b9a23a', '#e0cd68'],
    ];
    for (let i = 0; i < 95; i++) {
      const [c0, c1] = pick(random, cols);
      const l = R(16, 30) * s;
      const w = l * R(0.36, 0.5);
      const maple = random() < 0.3;
      x.save();
      x.translate(R(-14, W + 14), R(-14, Hh + 14));
      x.rotate(R(0, 6.3));
      shadow(5, 2.5);
      const g = x.createLinearGradient(-l, -w, l, w);
      g.addColorStop(0, c0);
      g.addColorStop(0.55, c1);
      g.addColorStop(1, c0);
      x.fillStyle = g;
      x.beginPath();
      if (maple) {
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          const rr = (k % 2 ? 0.45 : 1) * l * 0.75;
          x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        x.closePath();
      } else {
        x.moveTo(-l, 0);
        x.bezierCurveTo(-l * 0.4, -w * 1.25, l * 0.5, -w * 1.1, l, 0);
        x.bezierCurveTo(l * 0.5, w * 1.1, -l * 0.4, w * 1.25, -l, 0);
      }
      x.fill();
      noShadow();
      x.strokeStyle = 'rgba(60,35,10,.45)';
      x.lineWidth = 1.1 * s;
      x.beginPath();
      if (maple) {
        for (let k = 0; k < 10; k += 2) {
          const a = (k / 10) * Math.PI * 2;
          x.moveTo(0, 0);
          x.lineTo(Math.cos(a) * l * 0.65, Math.sin(a) * l * 0.65);
        }
      } else {
        x.moveTo(-l * 1.15, 0);
        x.lineTo(l * 0.9, 0);
        for (let k = -2; k <= 2; k++) {
          if (!k) continue;
          const vx = k * l * 0.3;
          x.moveTo(vx, 0);
          x.lineTo(vx + l * 0.22, (k % 2 ? 1 : -1) * w * 0.6);
          x.moveTo(vx, 0);
          x.lineTo(vx + l * 0.22, (k % 2 ? -1 : 1) * w * 0.6);
        }
      }
      x.stroke();
      x.restore();
    }
    for (let i = 0; i < 7; i++) {
      x.save();
      x.translate(R(0, W), R(0, Hh));
      x.rotate(R(0, 6.3));
      shadow(3, 2);
      x.strokeStyle = '#5a3a1c';
      x.lineWidth = 3 * s;
      x.beginPath();
      x.moveTo(-30 * s, 0);
      x.lineTo(30 * s, 2 * s);
      x.moveTo(5 * s, 1 * s);
      x.lineTo(18 * s, -10 * s);
      x.stroke();
      x.restore();
    }
    noShadow();
  } else if (node === 'river') {
    x.fillStyle = grad(0, Hh, '#4f9bc0', '#25587a');
    x.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 60; i++) {
      x.strokeStyle = `rgba(220,245,255,${R(0.1, 0.32).toFixed(2)})`;
      x.lineWidth = R(1.2, 3) * s;
      x.beginPath();
      const rr = R(10, 26) * s;
      x.ellipse(R(0, W), R(0, Hh), rr, rr * R(0.4, 0.7), R(-0.3, 0.3), R(0, 3), R(3.5, 6.3));
      x.stroke();
    }
    for (let i = 0; i < 46; i++) {
      const rx = R(9, 22) * s;
      const ry = rx * R(0.6, 0.85);
      const base = pick(random, ['#8c8f8e', '#a7a49a', '#6e7476', '#b8ad96', '#8a7f6e', '#c4c0b6']);
      x.save();
      x.translate(R(-8, W + 8), R(-8, Hh + 8));
      x.rotate(R(0, 3.14));
      shadow(6, 3, 0.45);
      const g = x.createRadialGradient(-rx * 0.35, -ry * 0.4, 1, 0, 0, rx * 1.1);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.18, base);
      g.addColorStop(1, '#3d4446');
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(0, 0, rx, ry, 0, 0, 7);
      x.fill();
      noShadow();
      x.fillStyle = 'rgba(255,255,255,.55)';
      x.beginPath();
      x.ellipse(-rx * 0.35, -ry * 0.45, rx * 0.22, ry * 0.12, -0.3, 0, 7);
      x.fill();
      x.restore();
    }
    for (let i = 0; i < 20; i++) {
      x.strokeStyle = 'rgba(235,250,255,.55)';
      x.lineWidth = 1.2 * s;
      x.beginPath();
      x.arc(R(0, W), R(0, Hh), R(2, 5) * s, 0, 7);
      x.stroke();
    }
  } else if (node === 'wildlife') {
    x.fillStyle = grad(0, Hh, '#8a6a3a', '#5e4524');
    x.fillRect(0, 0, W, Hh);
    const blade = (
      bx: number,
      by: number,
      h: number,
      lean: number,
      w: number,
      c0: string,
      c1: string,
    ) => {
      const g = x.createLinearGradient(bx, by, bx + lean, by - h);
      g.addColorStop(0, c0);
      g.addColorStop(1, c1);
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(bx - w, by);
      x.quadraticCurveTo(bx - w * 0.2 + lean * 0.3, by - h * 0.55, bx + lean, by - h);
      x.quadraticCurveTo(bx + w * 0.4 + lean * 0.3, by - h * 0.5, bx + w, by);
      x.closePath();
      x.fill();
    };
    const pal: [string, string][] = [
      ['#5c5a26', '#c9b35a'],
      ['#4e6a2c', '#a8c060'],
      ['#6d5a2a', '#e2cb7a'],
      ['#3f5a2a', '#88a858'],
      ['#7a5f2c', '#d8b860'],
    ];
    for (let row = 0; row < 7; row++) {
      const by = Hh * (0.25 + row * 0.15) + 10 * s;
      for (let i = 0; i < 46; i++) {
        const [c0, c1] = pick(random, pal);
        shadow(2, 1, 0.25);
        blade(
          R(-6, W + 6),
          by + R(-8, 8) * s,
          R(50, 110) * s,
          R(-26, 26) * s,
          R(2.2, 4.2) * s,
          c0,
          c1,
        );
      }
    }
    noShadow();
    for (let i = 0; i < 16; i++) {
      const hx = R(0, W);
      const hy = R(0, Hh * 0.7);
      x.fillStyle = '#e8d08a';
      for (let k = 0; k < 6; k++) {
        x.beginPath();
        x.ellipse(
          hx + Math.sin(k) * 2 * s,
          hy + k * 4 * s,
          2.6 * s,
          4 * s,
          0.3 * (k % 2 ? 1 : -1),
          0,
          7,
        );
        x.fill();
      }
    }
    for (let i = 0; i < 10; i++) {
      x.fillStyle = pick(random, ['#f4efe2', '#f2d26a', '#c9a3d8']);
      const fx = R(0, W);
      const fy = R(Hh * 0.3, Hh);
      for (let k = 0; k < 5; k++) {
        x.beginPath();
        x.arc(fx + Math.cos(k * 1.26) * 3 * s, fy + Math.sin(k * 1.26) * 3 * s, 2.2 * s, 0, 7);
        x.fill();
      }
      x.fillStyle = '#d99a2a';
      x.beginPath();
      x.arc(fx, fy, 1.6 * s, 0, 7);
      x.fill();
    }
  } else {
    x.fillStyle = '#4b4a46';
    x.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 260; i++) {
      x.fillStyle = pick(random, ['#5b5a55', '#6c6a64', '#3e3d3a', '#7c7a73']);
      x.beginPath();
      x.arc(R(0, W), R(0, Hh), R(1, 3.5) * s, 0, 7);
      x.fill();
    }
    const slab = (cx: number, cy: number, w: number, h: number, rot: number) => {
      const pts: [number, number][] = [];
      const cut = () => R(0.04, 0.16);
      const corners: [number, number][] = [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ];
      corners.forEach(([px, py], k) => {
        const nx = corners[(k + 1) % 4]!;
        const pv = corners[(k + 3) % 4]!;
        pts.push([px + (pv[0] - px) * cut(), py + (pv[1] - py) * cut()]);
        pts.push([px + (nx[0] - px) * cut(), py + (nx[1] - py) * cut()]);
        const mx = (px + nx[0]) / 2;
        const my = (py + nx[1]) / 2;
        pts.push([mx + R(-6, 6) * s, my + R(-4, 4) * s]);
      });
      x.save();
      x.translate(cx, cy);
      x.rotate(rot);
      shadow(8, 4, 0.5);
      const path = () => {
        x.beginPath();
        pts.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py)));
        x.closePath();
      };
      path();
      x.fillStyle = '#8f8f8c';
      x.fill();
      noShadow();
      x.save();
      path();
      x.clip();
      for (let k = 0; k < pts.length; k++) {
        const [ax, ay] = pts[k]!;
        const [bx, by] = pts[(k + 1) % pts.length]!;
        const v = Math.floor(R(128, 168));
        x.fillStyle = `rgb(${v},${v},${v - 3})`;
        x.beginPath();
        x.moveTo(R(-w * 0.12, w * 0.12), R(-h * 0.12, h * 0.12));
        x.lineTo(ax, ay);
        x.lineTo(bx, by);
        x.closePath();
        x.fill();
      }
      x.fillStyle = 'rgba(255,255,255,.08)';
      x.fillRect(-w / 2, -h / 2, w, h * 0.4);
      x.restore();
      path();
      x.lineJoin = 'round';
      x.strokeStyle = '#3f3f3c';
      x.lineWidth = 4 * s;
      x.stroke();
      x.save();
      x.scale(0.9, 0.9);
      path();
      x.strokeStyle = 'rgba(236,236,230,.85)';
      x.lineWidth = 3.2 * s;
      x.stroke();
      x.restore();
      x.restore();
    };
    const cells: [number, number][] = [
      [0.27, 0.27],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.74, 0.76],
      [0.5, 0.5],
    ];
    cells.forEach(([u, v], k) =>
      slab(
        W * u + R(-6, 6) * s,
        Hh * v + R(-6, 6) * s,
        (k === 4 ? 62 : R(70, 84)) * s,
        (k === 4 ? 56 : R(66, 80)) * s,
        R(-0.25, 0.25),
      ),
    );
    for (let i = 0; i < 26; i++) {
      const cx = R(0, W);
      const cy = R(0, Hh);
      const rr = R(3, 7) * s;
      shadow(3, 2, 0.45);
      x.fillStyle = pick(random, ['#9a9a96', '#b4b3ae', '#7d7c78']);
      x.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * 6.28 + R(-0.3, 0.3);
        x.lineTo(cx + Math.cos(a) * rr * R(0.7, 1.2), cy + Math.sin(a) * rr * R(0.7, 1.2));
      }
      x.fill();
      noShadow();
    }
  }
}

/** The bits that flick off a cover, by node: a color and a corner rounding. */
const BITS: Record<CoverNode, readonly [string, string][]> = {
  forest: [
    ['#c98d2c', '50% 0'],
    ['#7d9b3e', '50% 0'],
    ['#c4622a', '50% 0'],
  ],
  any: [
    ['#c98d2c', '50% 0'],
    ['#7d9b3e', '50% 0'],
  ],
  river: [
    ['#bfe6f7', '50%'],
    ['#ffffff', '50%'],
    ['#9a9a96', '40%'],
  ],
  wildlife: [
    ['#c9b35a', '2px'],
    ['#a8c060', '2px'],
    ['#e8d08a', '50%'],
  ],
  mountain: [
    ['#a3a39e', '2px'],
    ['#7d7c78', '1px'],
    ['#cfcfca', '2px'],
  ],
};

/** A few bits flick off where the brush is (`x`, `y` in `layer`'s pixels). */
export function brushBits(layer: HTMLElement, x: number, y: number, node: CoverNode): void {
  for (let i = 0; i < 3; i++) {
    const [color, round] = pick(Math.random, BITS[node]);
    const el = document.createElement('div');
    const w = node === 'wildlife' ? 3 : 5 + Math.random() * 4;
    const h = node === 'wildlife' ? 9 + Math.random() * 5 : 4 + Math.random() * 3;
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${color};border-radius:${round};pointer-events:none;z-index:9`;
    layer.appendChild(el);
    const a = -Math.random() * Math.PI;
    const d = 18 + Math.random() * 28;
    const anim = el.animate(
      [
        { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
        {
          transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 40}px) rotate(${Math.random() * 600 - 300}deg)`,
          opacity: 0,
        },
      ],
      { duration: 450 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.5,1)' },
    );
    anim.onfinish = () => el.remove();
  }
}

/**
 * How much of a cover is brushed away (0 to 1), from its RGBA pixels:
 * every 16th pixel, clear when nearly see-through.
 */
export function clearedShareOf(rgba: ArrayLike<number>): number {
  let clear = 0;
  let seen = 0;
  for (let i = 3; i < rgba.length; i += 64) {
    seen += 1;
    if ((rgba[i] ?? 255) < 40) clear += 1;
  }
  return seen ? clear / seen : 1;
}

/** Whether enough is brushed away for the rest to blow off. */
export const uncovers = (share: number): boolean => share >= BALANCE.ui.overhaul.brush.clearShare;

/** How much of the cover on this canvas is brushed away (0 to 1). */
export function clearedShare(canvas: HTMLCanvasElement): number {
  const x = canvas.getContext('2d');
  if (!x) return 1;
  return clearedShareOf(x.getImageData(0, 0, canvas.width, canvas.height).data);
}

/** Sparks in a color set burst from a point (confetti for Rare cards, dust when a cover goes). */
export function burst(
  layer: HTMLElement,
  x: number,
  y: number,
  colors: readonly string[],
  n = 16,
  spread = 90,
  gravity = 120,
): void {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:7px;height:7px;background:${pick(Math.random, colors)};pointer-events:none;z-index:9`;
    layer.appendChild(el);
    const a = Math.random() * Math.PI * 2;
    const d = spread * (0.4 + Math.random() * 0.6);
    const anim = el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        {
          transform: `translate(${Math.cos(a) * d - 3}px,${Math.sin(a) * d - 3 + gravity * 0.3}px) scale(.9) rotate(${Math.random() * 360 - 180}deg)`,
          opacity: 1,
          offset: 0.6,
        },
        {
          transform: `translate(${Math.cos(a) * d * 1.15}px,${Math.sin(a) * d + gravity}px) scale(.4)`,
          opacity: 0,
        },
      ],
      { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.4,1)' },
    );
    anim.onfinish = () => el.remove();
  }
}

/** A string's seed (FNV-1a). */
export function seedOf(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
