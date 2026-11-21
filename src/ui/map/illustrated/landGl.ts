/**
 * Showing the land (Phase 10.5, sections 6 and 9) with one WebGL2 quad:
 *
 * - the pencil sketch and the painted map, mixed through the reveal mask,
 *   with the paint darkening a little where the mask is about half (pigment
 *   pooling at the edge);
 * - the grades, on the land only: night (moonlit blues and a warm glow at
 *   camps), rain and storm (duller, cooler, slanted streaks), snow (open
 *   ground fades to white, trees stay dark), heatwave (a warm wash), and the
 *   route view's fade.
 *
 * Without WebGL2 it returns null, and the caller draws with Canvas2D.
 */
import { MAP_STYLE } from '../../../config/mapStyle';

export interface Grade {
  night: number;
  rain: number;
  storm: number;
  snow: number;
  heat: number;
  routes: number;
  /** The rain's slanted streaks (0 under reduced motion). */
  streaks: number;
  /** Seconds, for the rain streaks. */
  time: number;
  /** Warm glows, in land pixels (x, y), at night. */
  glows: readonly { x: number; y: number }[];
}

export const NO_GRADE: Grade = {
  night: 0,
  rain: 0,
  storm: 0,
  snow: 0,
  heat: 0,
  routes: 0,
  streaks: 0,
  time: 0,
  glows: [],
};

const MAX_GLOWS = 12;
const G = MAP_STYLE.grade;
const v3 = (a: readonly number[]) => `vec3(${a.map((n) => n.toFixed(4)).join(', ')})`;

const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  // One triangle over the whole canvas: p is 0–2, and 0–1 of it is on screen.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = vec2(p.x, 1.0 - p.y);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPainted;
uniform sampler2D uSketch;
uniform sampler2D uMask;
uniform vec2 uMaskScale;
uniform vec2 uSize;
uniform float uNight, uRain, uStorm, uSnow, uHeat, uRoutes, uStreaks, uTime;
uniform vec2 uGlow[${MAX_GLOWS}];
uniform int uGlows;
uniform int uView;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec3 painted = texture(uPainted, vUv).rgb;
  vec3 sketch = texture(uSketch, vUv).rgb;
  float m = texture(uMask, vUv * uMaskScale).r;
  if (uView == 1) { outColor = vec4(vec3(m), 1.0); return; }
  // Pigment pooling where the paint meets the paper.
  float rim = clamp(1.0 - abs(m - 0.55) / 0.25, 0.0, 1.0) * ${MAP_STYLE.reveal.rim.toFixed(3)};
  vec3 col = mix(sketch, painted * (1.0 - rim), m);
  float lum = dot(col, vec3(0.3, 0.59, 0.11));
  vec2 px = vUv * uSize;

  // Night: moonlit blues, and a warm glow at camps.
  vec3 night = lum * ${v3(G.night.lum)} * ${G.night.lumScale.toFixed(3)} + col * ${v3(G.night.rgb)} + ${v3(G.night.add)};
  for (int i = 0; i < ${MAX_GLOWS}; i++) {
    if (i >= uGlows) break;
    vec2 d = px - uGlow[i];
    float r = ${G.glow.radius.toFixed(1)} * ${(152 / 134).toFixed(4)};
    night += exp(-dot(d, d) / (2.0 * r * r)) * ${v3(G.glow.color)} * 0.8;
  }
  col = mix(col, night, uNight);

  // Rain (and Storm, darker): duller and cooler, with slanted streaks drifting down.
  vec3 rain = (col * ${G.rain.color.toFixed(3)} + lum * ${G.rain.gray.toFixed(3)}) * ${v3(G.rain.tint)} - ${G.rain.darken.toFixed(3)} - uStorm * ${G.storm.darken.toFixed(3)};
  vec2 q = vec2(px.x + px.y * 0.33, px.y - uTime * 260.0);
  vec2 cellId = floor(q / vec2(9.0, 64.0));
  vec2 f = fract(q / vec2(9.0, 64.0));
  float streak = uStreaks * step(0.86, hash(cellId)) * step(abs(f.x - 0.5), 0.07) * step(f.y, 0.28);
  rain = rain * (1.0 - 0.35 * streak) + streak * 0.35 * vec3(0.85, 0.92, 0.98);
  col = mix(col, rain, uRain);

  // Snow: open ground above the brightness line fades to white; trees stay dark.
  float s = clamp((lum - ${G.snow.above.toFixed(3)}) / ${G.snow.ramp.toFixed(3)}, 0.0, 1.0);
  vec3 snow = (col * (1.0 - s) + (vec3(0.93, 0.95, 0.98) - (1.0 - lum) * 0.15) * s) * vec3(0.95, 0.98, 1.05);
  col = mix(col, snow, uSnow);

  // Heatwave: a warm wash.
  col = mix(col, col * ${v3(G.heat.color)} + ${v3(G.heat.add)}, uHeat);

  // The route view: the land fades (saturate 0.35, brightness 0.72, contrast 0.9).
  float l2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 faded = mix(vec3(l2), col, 0.35) * 0.72;
  faded = (faded - 0.5) * 0.9 + 0.5;
  col = mix(col, faded, uRoutes);

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export interface LandGl {
  /** Uploads part of the mask (cells x0–x1, y0–y1 of a `w`-wide grid). */
  uploadMask(
    alpha: Uint8Array,
    w: number,
    box: { x0: number; y0: number; x1: number; y1: number },
  ): void;
  render(grade: Grade, view?: 'land' | 'mask'): void;
  dispose(): void;
}

export function createLandGl(
  canvas: HTMLCanvasElement,
  painted: TexImageSource,
  sketch: TexImageSource,
  mask: { w: number; h: number; cell: number },
  land: { width: number; height: number; scale: number },
): LandGl | null {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: false });
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) throw new Error('No shader');
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) ?? 'Shader failed');
    }
    return s;
  };
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'Program failed');
  }
  gl.useProgram(program);
  const tex = (unit: number, src: TexImageSource | null, w?: number, h?: number) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    else {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w ?? 1, h ?? 1, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    }
    return t;
  };
  const tPainted = tex(0, painted);
  const tSketch = tex(1, sketch);
  const tMask = tex(2, null, mask.w, mask.h);
  const loc = (name: string) => gl.getUniformLocation(program, name);
  gl.uniform1i(loc('uPainted'), 0);
  gl.uniform1i(loc('uSketch'), 1);
  gl.uniform1i(loc('uMask'), 2);
  // The mask's cells cover a little more than the land.
  gl.uniform2f(
    loc('uMaskScale'),
    land.width / (mask.w * mask.cell),
    land.height / (mask.h * mask.cell),
  );
  gl.uniform2f(loc('uSize'), land.width, land.height);
  const U = {
    night: loc('uNight'),
    rain: loc('uRain'),
    storm: loc('uStorm'),
    snow: loc('uSnow'),
    heat: loc('uHeat'),
    routes: loc('uRoutes'),
    streaks: loc('uStreaks'),
    time: loc('uTime'),
    glow: loc('uGlow'),
    glows: loc('uGlows'),
    view: loc('uView'),
  };
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  return {
    uploadMask(alpha, w, box) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, tMask);
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, w);
      gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, box.x0);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, box.y0);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        box.x0,
        box.y0,
        box.x1 - box.x0 + 1,
        box.y1 - box.y0 + 1,
        gl.RED,
        gl.UNSIGNED_BYTE,
        alpha,
      );
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
      gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
      gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    },
    render(g, view = 'land') {
      gl.uniform1f(U.night, g.night);
      gl.uniform1f(U.rain, g.rain);
      gl.uniform1f(U.storm, g.storm);
      gl.uniform1f(U.snow, g.snow);
      gl.uniform1f(U.heat, g.heat);
      gl.uniform1f(U.routes, g.routes);
      gl.uniform1f(U.streaks, g.streaks);
      gl.uniform1f(U.time, g.time);
      const glows = g.glows.slice(0, MAX_GLOWS);
      const flat = new Float32Array(MAX_GLOWS * 2);
      glows.forEach((p, i) => {
        flat[i * 2] = p.x;
        flat[i * 2 + 1] = p.y;
      });
      gl.uniform2fv(U.glow, flat);
      gl.uniform1i(U.glows, glows.length);
      gl.uniform1i(U.view, view === 'mask' ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteTexture(tPainted);
      gl.deleteTexture(tSketch);
      gl.deleteTexture(tMask);
      gl.deleteProgram(program);
    },
  };
}
