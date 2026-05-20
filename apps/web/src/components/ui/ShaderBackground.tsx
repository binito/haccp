'use client';

import { useEffect, useRef } from 'react';

const VS_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Aurora Mist — soft volumetric gradients that drift toward the cursor
const FS_SRC = `
precision highp float;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform vec2 u_mouseV;
uniform float u_time;
uniform float u_press;
uniform float u_click;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), u.x),
             mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 6; i++){
    v += a * noise(p);
    p = p * 2.0 + vec2(13.0, 7.0);
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;
  vec2 m = u_mouse; m.x *= u_res.x / u_res.y;

  vec2 d = m - p;
  float dist = length(d);
  vec2 flow = normalize(d + 1e-5) * exp(-dist * 1.2) * 0.18;

  float t = u_time * 0.08;
  vec2 q = p * 1.8 + vec2(t * 0.5, -t) + flow * 1.2;

  float n = fbm(q + fbm(q * 0.7 - t));
  float n2 = fbm(q * 2.2 + n * 1.5);

  float bloom = exp(-dist * 3.0) * exp(-u_click * 0.9);

  vec3 c0 = vec3(0.02, 0.04, 0.10);
  vec3 c1 = vec3(0.05, 0.30, 0.45);
  vec3 c2 = vec3(0.40, 0.20, 0.60);
  vec3 c3 = vec3(0.95, 0.55, 0.70);
  vec3 c4 = vec3(1.00, 0.90, 0.78);

  float k = n * 0.65 + n2 * 0.35;
  vec3 col = mix(c0, c1, smoothstep(0.10, 0.55, k));
  col = mix(col, c2, smoothstep(0.45, 0.75, k));
  col = mix(col, c3, smoothstep(0.65, 0.90, k));
  col = mix(col, c4, smoothstep(0.85, 1.05, k + bloom * 0.6));

  float streak = sin((p.y + n * 1.5) * 9.0 + u_time * 0.3);
  streak = smoothstep(0.55, 1.0, streak);
  col += vec3(0.55, 0.85, 1.0) * streak * 0.18;

  col += vec3(1.0, 0.85, 0.95) * bloom * (0.25 + 0.5 * u_press);
  col *= mix(0.7, 1.05, smoothstep(0.0, 0.6, uv.y));

  gl_FragColor = vec4(col, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const prog = gl.createProgram();
  if (!prog) return null;
  const vs = compileShader(gl, gl.VERTEX_SHADER, VS_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_SRC);
  if (!vs || !fs) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext('webgl', { antialias: true, alpha: false }) ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return;

    const prog = createProgram(gl);
    if (!prog) return;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const mouse = { x: 0.5, y: 0.5 };
    const target = { x: 0.5, y: 0.5 };
    let pressTarget = 0;
    let press = 0;
    let lastClickT = 100;
    let rafId: number;
    let t0 = performance.now();
    let prevT = t0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.floor(window.innerWidth * dpr);
      canvas!.height = Math.floor(window.innerHeight * dpr);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
    }
    resize();
    window.addEventListener('resize', resize);

    function onMouseMove(e: MouseEvent) {
      target.x = e.clientX / window.innerWidth;
      target.y = 1 - e.clientY / window.innerHeight;
    }
    function onMouseDown() { pressTarget = 1; lastClickT = 0; }
    function onMouseUp() { pressTarget = 0; }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    function frame(now: number) {
      const t = (now - t0) / 1000;
      const dt = Math.max(0.001, (now - prevT) / 1000);
      prevT = now;

      const ease = 1 - Math.pow(0.001, dt);
      mouse.x += (target.x - mouse.x) * ease;
      mouse.y += (target.y - mouse.y) * ease;
      press += (pressTarget - press) * (1 - Math.pow(0.0001, dt));
      lastClickT += dt;

      gl!.useProgram(prog);

      const aPos = gl!.getAttribLocation(prog!, 'a_pos');
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
      gl!.enableVertexAttribArray(aPos);
      gl!.vertexAttribPointer(aPos, 2, gl!.FLOAT, false, 0, 0);

      const loc = (name: string) => gl!.getUniformLocation(prog!, name);
      gl!.uniform2f(loc('u_res'), canvas!.width, canvas!.height);
      gl!.uniform2f(loc('u_mouse'), mouse.x, mouse.y);
      gl!.uniform2f(loc('u_mouseV'), 0, 0);
      gl!.uniform1f(loc('u_time'), t);
      gl!.uniform1f(loc('u_press'), press);
      gl!.uniform1f(loc('u_click'), lastClickT);

      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        zIndex: 0,
      }}
    />
  );
}
