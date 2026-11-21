import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../config/balance';
import FRAGMENT_BODY from '../../../shaders/hiker-select-bg.frag?raw';
import {
  BG_COLORS,
  BG_FALLBACK,
  FRAGMENT_SOURCE,
  hexToRgb,
  startBackground,
  UNIFORMS,
  VERTEX_SOURCE,
  type BackgroundEnv,
} from './backgroundGl';
import { SelectBackground } from './SelectBackground';

/** A stand-in WebGL2 context that remembers uniforms and counts draws. */
function fakeGl({ compiles = true } = {}) {
  const uniforms = new Map<string, unknown>();
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    TRIANGLES: 5,
    draws: 0,
    sources: [] as string[],
    deleted: 0,
    uniforms,
    createShader: () => ({}),
    shaderSource: (_: unknown, src: string) => gl.sources.push(src),
    compileShader: () => {},
    getShaderParameter: () => compiles,
    getShaderInfoLog: () => 'ERROR: 0:1: nope',
    deleteShader: () => {},
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram: () => gl.deleted++,
    createVertexArray: () => ({}),
    bindVertexArray: () => {},
    deleteVertexArray: () => {},
    useProgram: () => {},
    getUniformLocation: (_: unknown, name: string) => name,
    uniform1f: (at: string, v: number) => uniforms.set(at, v),
    uniform2f: (at: string, x: number, y: number) => uniforms.set(at, [x, y]),
    uniform3fv: (at: string, v: number[]) => uniforms.set(at, v),
    viewport: () => {},
    drawArrays: () => gl.draws++,
  };
  return gl;
}

function fakeCanvas(gl: unknown, size = { w: 1000, h: 600 }) {
  const listeners = new Map<string, (e: Event) => void>();
  return {
    width: 300,
    height: 150,
    clientWidth: size.w,
    clientHeight: size.h,
    getContext: (kind: string) => (kind === 'webgl2' ? gl : null),
    addEventListener: (type: string, fn: (e: Event) => void) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
    listeners,
  };
}

/** Frames run only when the test says so. */
function fakeEnv({ reducedMotion = false, pixelRatio = 1 } = {}) {
  const queue = new Map<number, (ms: number) => void>();
  let next = 1;
  let isHidden = false;
  const env: BackgroundEnv & {
    queued(): number;
    run(ms: number): void;
    hide(h: boolean): void;
    asked: number;
  } = {
    reducedMotion,
    asked: 0,
    pixelRatio: () => pixelRatio,
    requestFrame: (draw) => {
      env.asked++;
      queue.set(next, draw);
      return next++;
    },
    cancelFrame: (id) => queue.delete(id),
    hidden: () => isHidden,
    queued: () => queue.size,
    run(ms) {
      const due = [...queue.values()];
      queue.clear();
      for (const draw of due) draw(ms);
    },
    hide(h) {
      isHidden = h;
    },
  };
  return env;
}

const start = (
  gl: ReturnType<typeof fakeGl>,
  env: BackgroundEnv,
  size?: { w: number; h: number },
) => {
  const canvas = fakeCanvas(gl, size);
  const bg = startBackground(canvas as unknown as HTMLCanvasElement, env);
  return { canvas, bg };
};

describe('the shader', () => {
  it('gets the WebGL2 header in front of the file', () => {
    expect(
      FRAGMENT_SOURCE.startsWith('#version 300 es\nprecision highp float;\nout vec4 outColor;\n'),
    ).toBe(true);
    expect(FRAGMENT_SOURCE.endsWith(FRAGMENT_BODY)).toBe(true);
    expect(VERTEX_SOURCE.startsWith('#version 300 es\n')).toBe(true);
  });

  it('declares exactly the uniforms the screen sets', () => {
    const declared = [...FRAGMENT_BODY.matchAll(/^uniform \w+ (\w+);/gm)].map((m) => m[1]);
    expect(declared.sort()).toEqual([...UNIFORMS].sort());
    expect(FRAGMENT_BODY).toContain('void main()');
    expect(FRAGMENT_BODY).toContain('outColor =');
  });

  it('uses the darker colors, and the plan’s swirl, pixels and pull', () => {
    const gl = fakeGl();
    start(gl, fakeEnv({ reducedMotion: true }));
    expect(gl.uniforms.get('uDeep')).toEqual(hexToRgb('#0C1411'));
    expect(gl.uniforms.get('uMoss')).toEqual(hexToRgb('#1D3129'));
    expect(gl.uniforms.get('uMist')).toEqual(hexToRgb('#476055'));
    expect(gl.uniforms.get('uGlow')).toEqual(hexToRgb('#E9B44C'));
    expect(gl.uniforms.get('uSwirl')).toBe(BALANCE.ui.selectBackground.swirl);
    expect(gl.uniforms.get('uPixels')).toBe(BALANCE.ui.selectBackground.pixels);
    expect(gl.uniforms.get('uPull')).toBe(BALANCE.ui.selectBackground.pull);
    expect(BALANCE.ui.selectBackground).toMatchObject({ swirl: 1.2, pixels: 150, pull: 0.5 });
  });

  it('turns colors into 0–1 values', () => {
    expect(hexToRgb('#FF8000')).toEqual([1, 128 / 255, 0]);
  });
});

describe('without WebGL2', () => {
  it('draws nothing, and the fallback color shows', () => {
    const canvas = fakeCanvas(null);
    expect(startBackground(canvas as unknown as HTMLCanvasElement, fakeEnv())).toBeNull();
    expect(BG_FALLBACK).toBe(BG_COLORS.deep);
    expect(BG_FALLBACK).toBe('#0C1411');
  });

  it('a shader that won’t compile falls back too', () => {
    const { bg } = start(fakeGl({ compiles: false }), fakeEnv());
    expect(bg).toBeNull();
  });

  it('the backdrop is the fallback color under the canvas', () => {
    const html = renderToStaticMarkup(createElement(SelectBackground));
    expect(html).toContain('background:#0C1411');
    expect(html).toContain('<canvas');
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('reduced motion', () => {
  it('draws one still frame and doesn’t animate', () => {
    const gl = fakeGl();
    const env = fakeEnv({ reducedMotion: true });
    const { bg } = start(gl, env);
    expect(gl.draws).toBe(1);
    expect(env.asked).toBe(0);
    expect(gl.uniforms.get('uTime')).toBe(0);
    bg?.point({ x: 0.9, y: 0.9 });
    env.run(1000);
    expect(gl.draws).toBe(1);
  });

  it('draws the still frame again when the size changes', () => {
    const gl = fakeGl();
    const env = fakeEnv({ reducedMotion: true });
    const { bg, canvas } = start(gl, env);
    canvas.clientWidth = 1200;
    bg?.refresh();
    expect(gl.draws).toBe(2);
    expect(canvas.width).toBe(1200);
    expect(env.asked).toBe(0);
  });
});

describe('animating', () => {
  it('draws every frame, with time in seconds', () => {
    const gl = fakeGl();
    const env = fakeEnv();
    start(gl, env);
    expect(gl.draws).toBe(1);
    env.run(1000);
    env.run(1050);
    env.run(1100);
    expect(gl.draws).toBe(4);
    expect(gl.uniforms.get('uTime')).toBeCloseTo(0.1);
    expect(env.queued()).toBe(1);
  });

  it('pauses while the tab is hidden, and picks up where it left off', () => {
    const gl = fakeGl();
    const env = fakeEnv();
    const { bg } = start(gl, env);
    env.run(0);
    env.run(50);
    env.hide(true);
    bg?.refresh();
    expect(env.queued()).toBe(0);
    const draws = gl.draws;
    env.run(60_000);
    expect(gl.draws).toBe(draws);
    env.hide(false);
    bg?.refresh();
    env.run(60_000);
    env.run(60_050);
    // No jump for the minute it was hidden.
    expect(gl.uniforms.get('uTime')).toBeCloseTo(0.1);
  });

  it('never more than 1.5 device pixels per screen pixel', () => {
    const gl = fakeGl();
    const { canvas } = start(gl, fakeEnv({ reducedMotion: true, pixelRatio: 3 }), {
      w: 1000,
      h: 600,
    });
    expect([canvas.width, canvas.height]).toEqual([1500, 900]);
    expect(gl.uniforms.get('uResolution')).toEqual([1500, 900]);
    const low = fakeGl();
    const small = start(low, fakeEnv({ reducedMotion: true, pixelRatio: 1 }), { w: 1000, h: 600 });
    expect(small.canvas.width).toBe(1000);
  });

  it('the bend eases toward the pointer, and drifts when it’s away', () => {
    const gl = fakeGl();
    const env = fakeEnv();
    const { bg } = start(gl, env);
    bg?.point({ x: 1, y: 1 });
    for (let ms = 0; ms <= 3000; ms += 50) env.run(ms);
    const [x, y] = gl.uniforms.get('uMouse') as number[];
    expect(x).toBeGreaterThan(0.95);
    expect(y).toBeGreaterThan(0.95);

    bg?.point(null);
    const seen = new Set<string>();
    for (let ms = 3050; ms <= 40_000; ms += 50) {
      env.run(ms);
      const [mx = 0, my = 0] = gl.uniforms.get('uMouse') as number[];
      seen.add(`${mx.toFixed(1)},${my.toFixed(1)}`);
      expect(Math.hypot(mx - 0.5, my - 0.5)).toBeLessThan(0.75);
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it('stopping cancels the next frame and frees the shader', () => {
    const gl = fakeGl();
    const env = fakeEnv();
    const { bg, canvas } = start(gl, env);
    expect(canvas.listeners.has('webglcontextlost')).toBe(true);
    bg?.stop();
    expect(env.queued()).toBe(0);
    expect(gl.deleted).toBe(1);
    expect(canvas.listeners.size).toBe(0);
    bg?.refresh();
    expect(env.queued()).toBe(0);
  });

  it('a lost GPU context pauses; a restored one draws again', () => {
    const gl = fakeGl();
    const env = fakeEnv();
    const { canvas, bg } = start(gl, env);
    canvas.listeners.get('webglcontextlost')?.({ preventDefault() {} } as Event);
    expect(env.queued()).toBe(0);
    const draws = gl.draws;
    canvas.listeners.get('webglcontextrestored')?.(new Event('webglcontextrestored'));
    expect(gl.draws).toBe(draws + 1);
    expect(env.queued()).toBe(1);
    expect(bg?.frames()).toBe(gl.draws);
  });
});
