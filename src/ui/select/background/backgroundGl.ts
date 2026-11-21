/**
 * The hiker selection screen's background (Phase 10b): a slow, swirling,
 * pixelated paint in forest greens, from src/shaders/hiker-select-bg.frag.
 *
 * - One WebGL2 fragment shader on one full-screen triangle.
 * - Drawn at no more than 1.5× device pixels; paused while the tab is hidden.
 * - Under reduced motion: one still frame (drawn again only when the size
 *   changes).
 * - No WebGL2, or a shader that won't compile: nothing is drawn and the
 *   plain fallback color behind the canvas shows.
 *
 * The browser bits (frames, visibility, pixel ratio) come in through
 * `BackgroundEnv`, so tests can drive it with a fake GL context.
 */
import { BALANCE } from '../../../config/balance';
import FRAGMENT_BODY from '../../../shaders/hiker-select-bg.frag?raw';

/** The shader's colors (the family update's darker set). */
export const BG_COLORS = {
  deep: '#0C1411',
  moss: '#1D3129',
  mist: '#476055',
  glow: '#E9B44C',
} as const;

/** What shows without WebGL2. */
export const BG_FALLBACK = BG_COLORS.deep;

export const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
out vec4 outColor;
${FRAGMENT_BODY}`;

/** A triangle that covers the screen, from the vertex number alone (no buffers). */
export const VERTEX_SOURCE = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const UNIFORMS = [
  'uTime',
  'uResolution',
  'uMouse',
  'uDeep',
  'uMoss',
  'uMist',
  'uGlow',
  'uSwirl',
  'uPixels',
  'uPull',
] as const;
type Uniform = (typeof UNIFORMS)[number];

/** A frame after a long gap (a hidden tab) moves time on by at most this (s). */
const MAX_STEP_S = 0.1;

/** "#E9B44C" → [0.91, 0.71, 0.30]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export interface BackgroundEnv {
  reducedMotion: boolean;
  /** The device's pixels per screen pixel (window.devicePixelRatio). */
  pixelRatio(): number;
  requestFrame(draw: (ms: number) => void): number;
  cancelFrame(id: number): void;
  /** The tab isn't visible. */
  hidden(): boolean;
}

export interface Background {
  /** The pointer, 0 to 1 with y up; null when it's away (the bend drifts). */
  point(at: { x: number; y: number } | null): void;
  /** The tab's visibility or the size changed: resume, pause or redraw. */
  refresh(): void;
  stop(): void;
  /** Frames drawn so far. */
  frames(): number;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  if (import.meta.env.DEV) console.warn('Background shader:', gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

interface Graphics {
  program: WebGLProgram;
  vao: WebGLVertexArrayObject | null;
  at: Record<Uniform, WebGLUniformLocation | null>;
}

/** Compiles and links the shader and sets the uniforms that never change. */
function setUp(gl: WebGL2RenderingContext): Graphics | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  const program = vertex && fragment ? gl.createProgram() : null;
  if (program && vertex && fragment) {
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
  }
  if (vertex) gl.deleteShader(vertex);
  if (fragment) gl.deleteShader(fragment);
  if (!program) return null;
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (import.meta.env.DEV) console.warn('Background shader:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.useProgram(program);
  const at = Object.fromEntries(
    UNIFORMS.map((u) => [u, gl.getUniformLocation(program, u)]),
  ) as Graphics['at'];
  const tune = BALANCE.ui.selectBackground;
  gl.uniform3fv(at.uDeep, hexToRgb(BG_COLORS.deep));
  gl.uniform3fv(at.uMoss, hexToRgb(BG_COLORS.moss));
  gl.uniform3fv(at.uMist, hexToRgb(BG_COLORS.mist));
  gl.uniform3fv(at.uGlow, hexToRgb(BG_COLORS.glow));
  gl.uniform1f(at.uSwirl, tune.swirl);
  gl.uniform1f(at.uPixels, tune.pixels);
  gl.uniform1f(at.uPull, tune.pull);
  return { program, vao, at };
}

/**
 * Starts drawing on `canvas` (sized by CSS). Returns null when there's no
 * WebGL2 or the shader won't build: the fallback color shows instead.
 */
export function startBackground(canvas: HTMLCanvasElement, env: BackgroundEnv): Background | null {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) return null;
  let gfx = setUp(gl);
  if (!gfx) return null;

  const tune = BALANCE.ui.selectBackground;
  let time = 0;
  let last: number | null = null;
  let frame: number | null = null;
  let drawn = 0;
  let stopped = false;
  let target: { x: number; y: number } | null = null;
  const mouse = { x: 0.5, y: 0.5 };

  const draw = () => {
    if (!gfx) return;
    const ratio = Math.min(env.pixelRatio() || 1, tune.maxPixelRatio);
    const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform1f(gfx.at.uTime, time);
    gl.uniform2f(gfx.at.uResolution, w, h);
    gl.uniform2f(gfx.at.uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    drawn++;
  };

  /** The bend follows the pointer, or drifts in a slow loop when it's away. */
  const follow = (dt: number) => {
    const turn = (2 * Math.PI * time) / tune.driftSeconds;
    const goal = target ?? {
      x: 0.5 + tune.driftRadius * Math.cos(turn),
      y: 0.5 + tune.driftRadius * Math.sin(turn),
    };
    const k = 1 - Math.exp(-dt * tune.pointerEase);
    mouse.x += (goal.x - mouse.x) * k;
    mouse.y += (goal.y - mouse.y) * k;
  };

  const tick = (ms: number) => {
    frame = null;
    if (stopped || env.hidden()) {
      last = null;
      return;
    }
    const dt = last === null ? 0 : Math.min(Math.max(ms - last, 0) / 1000, MAX_STEP_S);
    last = ms;
    time += dt;
    follow(dt);
    draw();
    frame = env.requestFrame(tick);
  };

  const pause = () => {
    if (frame !== null) env.cancelFrame(frame);
    frame = null;
    last = null;
  };

  const refresh = () => {
    if (stopped) return;
    if (env.reducedMotion) {
      draw();
      return;
    }
    if (env.hidden()) pause();
    else if (frame === null) frame = env.requestFrame(tick);
  };

  // A lost context (the GPU reset) pauses; a restored one builds again.
  const onLost = (e: Event) => {
    e.preventDefault();
    pause();
    gfx = null;
  };
  const onRestored = () => {
    gfx = setUp(gl);
    if (gfx) {
      draw();
      refresh();
    }
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // The first frame right away, even in a hidden tab, so the screen never flashes empty.
  draw();
  if (!env.reducedMotion) refresh();

  return {
    point(at) {
      target = at;
    },
    refresh,
    stop() {
      stopped = true;
      pause();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (gfx) {
        gl.deleteProgram(gfx.program);
        gl.deleteVertexArray(gfx.vao);
      }
      gfx = null;
    },
    frames: () => drawn,
  };
}
