// Фон сайта — Animated Shader Background (@minhxthanh, 21st.dev; Three.js + GLSL) по формуле образца:
// 35 нитей «авроры» с шумом fbm, лёгкая дрожь кадра (04.11.2026, слово исполнителя). Без Three.js —
// голый WebGL1 (tanh — своей функцией: в GLSL ES 1.0 её нет). Тема светлая: свечение образца не
// прибавляется к чёрному, а ложится полупрозрачной краской на фон «туман долины» — нити читаются как
// мягкие янтарные пряди (цвет знака, 04.11), текст поверх остаётся контрастным.

const VERTEX = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

const FRAGMENT = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 u_base;
const float STRENGTH = 0.18;
float rand(vec2 n) {
  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 ip = floor(p);
  vec2 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  float res = mix(
    mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
    mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x), u.y);
  return res * res;
}
float fbm(vec2 x) {
  float v = 0.0;
  float a = 0.3;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 3; ++i) {
    v += a * noise(x);
    x = rot * x * 2.0 + shift;
    a *= 0.4;
  }
  return v;
}
vec3 tanh3(vec3 x) {
  vec3 e = exp(2.0 * clamp(x, -10.0, 10.0));
  return (e - 1.0) / (e + 1.0);
}
void main() {
  vec2 shake = vec2(sin(iTime * 1.2) * 0.002, cos(iTime * 2.1) * 0.002);
  vec2 p = ((gl_FragCoord.xy + shake * iResolution.xy) - iResolution.xy * 0.5) / iResolution.y * mat2(6.0, -4.0, 4.0, 6.0);
  vec2 v;
  vec3 o = vec3(0.0);
  float f = 2.0 + fbm(p + vec2(iTime * 5.0, 0.0)) * 0.5;
  for (float i = 0.0; i < 35.0; i += 1.0) {
    v = p + cos(i * i + (iTime + p.x * 0.08) * 0.025 + i * vec2(13.0, 11.0)) * 3.5 + vec2(sin(iTime * 3.0 + i) * 0.003, cos(iTime * 3.5 - i) * 0.003);
    float tailNoise = fbm(v + vec2(iTime * 0.5, i)) * 0.3 * (1.0 - (i / 35.0));
    vec3 auroraColors = vec3(
      0.1 + 0.3 * sin(i * 0.2 + iTime * 0.4),
      0.3 + 0.5 * cos(i * 0.3 + iTime * 0.5),
      0.7 + 0.3 * sin(i * 0.4 + iTime * 0.3));
    vec3 currentContribution = auroraColors * exp(sin(i * i + iTime * 0.8)) / length(max(v, vec2(v.x * f * 0.015, v.y * 1.5)));
    float thinnessFactor = smoothstep(0.0, 1.0, i / 35.0) * 0.6;
    o += currentContribution * (1.0 + tailNoise * 0.8) * thinnessFactor;
  }
  o = tanh3(pow(max(o / 100.0, 0.0), vec3(1.6))) * 1.5;
  float glow = clamp(max(o.r, max(o.g, o.b)), 0.0, 1.0);
  // Пряди — янтарь знака (#f89b0d), приглушённый к фону; оттенок образца лишь чуть сдвигает его к золоту.
  float warm = clamp(o.g / max(glow, 0.001), 0.0, 1.0);
  vec3 ink = mix(vec3(0.84, 0.52, 0.08), vec3(0.93, 0.68, 0.30), warm);
  gl_FragColor = vec4(mix(u_base, ink, pow(glow, 0.85) * STRENGTH), 1.0);
}`;

/** Фон «туман долины» — тот же, что --bg скина (#edf1f3). */
const BASE = [0xed / 255, 0xf1 / 255, 0xf3 / 255];
/** Буфер — 0,4 CSS-размера (пряди мягкие, разница не видна), не больше ~0,45 Мп: 35 нитей × fbm на пиксель. */
const RENDER_SCALE = 0.4;
/** Время образца × 0,5 и дрожь кадра 0,002 вместо 0,005 — спокойнее (слово исполнителя 04.11). */
const TIME_SCALE = 0.5;
const MAX_PIXELS = 450_000;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("background: shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(`background: ${gl.getShaderInfoLog(shader) ?? "compile"}`);
  return shader;
}

function link(gl: WebGLRenderingContext): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("background: program");
  const shaders = [
    compile(gl, gl.VERTEX_SHADER, VERTEX),
    compile(gl, gl.FRAGMENT_SHADER, FRAGMENT),
  ];
  shaders.forEach((shader) => gl.attachShader(program, shader));
  gl.linkProgram(program);
  shaders.forEach((shader) => gl.deleteShader(shader));
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("background: link");
  return program;
}

/** Один треугольник на весь экран. */
function coverScreen(gl: WebGLRenderingContext, program: WebGLProgram): WebGLBuffer | null {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  return buffer;
}

export type BackgroundRenderer = {
  resize: () => void;
  draw: (seconds: number) => void;
  dispose: () => void;
};

/** null — WebGL нет или он программный: остаётся CSS-градиент под холстом. */
export function createBackgroundRenderer(canvas: HTMLCanvasElement): BackgroundRenderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
    failIfMajorPerformanceCaveat: true,
  });
  if (!gl) return null;
  let program: WebGLProgram;
  try {
    program = link(gl);
  } catch {
    return null;
  }
  gl.useProgram(program);
  const buffer = coverScreen(gl, program);
  const resolution = gl.getUniformLocation(program, "iResolution");
  const time = gl.getUniformLocation(program, "iTime");
  gl.uniform3fv(gl.getUniformLocation(program, "u_base"), BASE);
  return {
    resize() {
      const width = canvas.clientWidth * RENDER_SCALE;
      const height = canvas.clientHeight * RENDER_SCALE;
      const fit = Math.min(1, Math.sqrt(MAX_PIXELS / Math.max(1, width * height)));
      canvas.width = Math.max(1, Math.round(width * fit));
      canvas.height = Math.max(1, Math.round(height * fit));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
    },
    draw(seconds) {
      gl.uniform1f(time, seconds * TIME_SCALE);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
