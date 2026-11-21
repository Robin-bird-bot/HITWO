// Hiker selection background (WebGL2, GLSL ES 3.00 fragment body).
// Prepend: #version 300 es / precision highp float; / out vec4 outColor;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec3 uDeep;
uniform vec3 uMoss;
uniform vec3 uMist;
uniform vec3 uGlow;
uniform float uSwirl;
uniform float uPixels;
uniform float uPull;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5; mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.02; a *= 0.5; }
  return v;
}
void main() {
  // chunky pixels to match the pixel art
  float px = max(uResolution.y / max(uPixels, 20.0), 1.0);
  vec2 fc = (floor(gl_FragCoord.xy / px) + 0.5) * px;
  vec2 p = (fc - 0.5 * uResolution) / uResolution.y;
  vec2 m = (uMouse - 0.5) * uResolution / uResolution.y;
  float t = uTime * 0.08;
  // the paint bends around the pointer
  vec2 dm = p - m;
  p += uPull * dm * exp(-dot(dm, dm) * 6.0) * 0.35;
  // twist: the farther out, the more it turns
  float len = length(p);
  float ang = atan(p.y, p.x) - uSwirl * 2.2 * len + t * 0.6;
  vec2 uv = vec2(cos(ang), sin(ang)) * len * 11.0;
  // fold the space a few times for the marbled paint
  for (int i = 0; i < 4; i++) {
    float k = float(i);
    uv += 0.6 * vec2(sin(uv.y * 0.85 + t * 1.6 + k), cos(uv.x * 0.75 - t * 1.2 + k * 1.7));
  }
  float v = 0.5 + 0.5 * sin(length(uv) * 0.62 - t * 2.2);
  v = mix(v, fbm(uv * 0.25 + t), 0.25);
  // posterize into a few flat tones, like painted pixel art
  float lv = floor(v * 4.0) / 3.0;
  vec3 col = mix(uDeep, uMoss, smoothstep(0.0, 0.5, lv));
  col = mix(col, uMist, smoothstep(0.6, 1.0, lv) * 0.4);
  // thin gold seams where tones meet
  float seam = 1.0 - smoothstep(0.0, 0.04, abs(fract(v * 4.0) - 0.02));
  col += uGlow * seam * step(0.7, v) * 0.12;
  // dark edges keep the cards readable
  col *= 1.0 - 0.5 * smoothstep(0.3, 1.1, length((fc - 0.5 * uResolution) / uResolution.y));
  col += (hash(fc) - 0.5) * 0.015;
  outColor = vec4(col, 1.0);
}
