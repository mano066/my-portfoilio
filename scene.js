// WebGL layer for every page. Each canvas found on the page gets its own small
// view; views only render while visible, and pause when motion is turned off.
import * as THREE from './vendor/three.module.min.js';

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isAnimating = () => !reduceMotion && !root.classList.contains('motion-off');
const DPR = () => Math.min(window.devicePixelRatio || 1, 1.75);

// Older Safari/Firefox lack roundRect; a plain rect is a fine fallback for the HUD.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
}

const GLITCH_A = '#39ff88';
const GLITCH_B = '#ff3df2';
const EMBER = '#ff6a2b';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// View manager: one rAF loop, per-view visibility, resize and context loss
// ---------------------------------------------------------------------------
const views = [];
let rafId = 0;
let elapsed = 0;
let last = performance.now();

function addView(canvas, view) {
  view.canvas = canvas;
  view.visible = false;
  view.lost = false;
  views.push(view);

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      view.visible = e.isIntersecting;
      if (view.visible) requestRender();
    });
  }, { rootMargin: '120px' });
  io.observe(canvas);

  const ro = new ResizeObserver(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w && h) {
      view.resize(w, h);
      requestRender();
    }
  });
  ro.observe(canvas);

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    view.lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    view.lost = false;
    requestRender();
  });
  canvas.classList.add('ready');
}

function renderAll() {
  views.forEach((v) => {
    if (v.visible && !v.lost && v.canvas.clientWidth) v.render(elapsed);
  });
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  elapsed += dt;
  renderAll();
  rafId = isAnimating() ? requestAnimationFrame(loop) : 0;
}

// Render one frame now; keep looping only while animation is enabled.
function requestRender() {
  if (rafId) return;
  last = performance.now();
  rafId = requestAnimationFrame(loop);
}

window.addEventListener('motionchange', requestRender);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  } else if (!document.hidden) {
    requestRender();
  }
});

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
}, { passive: true });
function stepMouse() {
  mouse.x += (mouse.tx - mouse.x) * 0.06;
  mouse.y += (mouse.ty - mouse.y) * 0.06;
}

function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR());
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

// Studio-like environment for chrome reflections: dark room, white softboxes, ember floor.
function makeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x070707);
  const panel = (w, h, color, intensity, pos, rot) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    m.rotation.set(...rot);
    env.add(m);
  };
  panel(12, 3, '#ffffff', 5, [0, 7, 0], [Math.PI / 2, 0, 0]);
  panel(1.2, 12, '#ffffff', 6, [-7, 0, 2], [0, Math.PI / 2, 0]);
  panel(1.6, 10, '#ffffff', 3, [7, 1, -2], [0, -Math.PI / 2, 0]);
  panel(5, 2, '#ffffff', 1.5, [0, 0, 8], [0, Math.PI, 0]);
  // Large soft key light up-front so flat faces read as bright chrome
  panel(10, 4, '#ffffff', 2.2, [0, 4, 7], [-Math.PI / 5, Math.PI, 0]);
  panel(14, 6, EMBER, 2.6, [0, -6, 0], [-Math.PI / 2, 0, 0]);
  const rt = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  return rt.texture;
}

// Soft round glowing points (used by dust, nebula, sparks)
function pointsMaterial(size, opacity, color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(color || '#ffffff') },
      uPR: { value: DPR() },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute float aScale;
      uniform float uTime, uSize, uPR;
      varying float vTw;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vTw = 0.55 + 0.45 * sin(uTime * 1.3 + aSeed * 6.2831);
        gl_PointSize = uSize * aScale * uPR * (8.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 1.7);
        gl_FragColor = vec4(uColor, a * uOpacity * vTw);
      }`,
  });
}

function seededAttrs(geo, count, scaleMin, scaleMax) {
  const seed = new Float32Array(count);
  const scale = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    seed[i] = Math.random();
    scale[i] = scaleMin + Math.random() * (scaleMax - scaleMin);
  }
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
}

// ---------------------------------------------------------------------------
// 1. Dust: drifting particles behind every page
// ---------------------------------------------------------------------------
function initDust(canvas) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.z = 10;

  const count = window.innerWidth < 760 ? 320 : 700;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
    pos[i * 3 + 2] = -Math.random() * 16;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  seededAttrs(geo, count, 0.4, 1.4);
  const mat = pointsMaterial(7, 0.55);
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);

  addView(canvas, {
    resize(w, h) {
      renderer.setPixelRatio(DPR());
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    render(t) {
      stepMouse();
      mat.uniforms.uTime.value = t;
      pts.position.y = (t * 0.12 + window.scrollY * 0.002) % 4;
      pts.rotation.y = t * 0.01;
      camera.position.x = mouse.x * 0.4;
      camera.position.y = -mouse.y * 0.25;
      camera.lookAt(0, 0, -4);
      renderer.render(scene, camera);
    },
  });
}

// ---------------------------------------------------------------------------
// 2. Dither shader: portrait band (with texture) or flowing noise (without)
// ---------------------------------------------------------------------------
const DITHER_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform float uHasTex, uTime, uImgAspect, uCenterY;
  uniform vec2 uRes, uMouse;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  float lumAt(vec2 uv, float t) {
    float l;
    if (uHasTex > 0.5) {
      // Fit image width to the band, crop a horizontal slice around uCenterY
      float h = (uRes.y / uRes.x) / uImgAspect;
      float yTop = uCenterY - (uv.y - 0.5) * h;
      vec2 tuv = vec2(uv.x, 1.0 - yTop);
      vec3 c = texture2D(uTex, tuv).rgb;
      l = dot(c, vec3(0.299, 0.587, 0.114));
      l = smoothstep(0.06, 0.78, l);
      l = mix(l, fbm(uv * vec2(9.0, 2.0) + vec2(t * 0.15, 0.0)), 0.18);
    } else {
      vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 1.6;
      float n = fbm(p + vec2(t * 0.08, t * 0.03) + fbm(p * 1.5 - t * 0.05));
      l = smoothstep(0.3, 0.85, n);
    }
    // Sweeping scan bar
    l += 0.35 * exp(-pow((uv.x - fract(t * 0.09)) * 9.0, 2.0));
    return clamp(l, 0.0, 1.0);
  }

  void main() {
    float cellSize = 3.0;
    vec2 cell = floor(gl_FragCoord.xy / cellSize);
    vec2 uv = (cell * cellSize + 0.5 * cellSize) / uRes;
    float t = uTime;

    // Row glitches: occasional horizontal shifts
    float row = floor(uv.y * 18.0);
    float g = step(0.965, hash(vec2(row, floor(t * 6.0))));
    uv.x += g * (hash(vec2(row, t)) - 0.5) * 0.08;
    uv.x += sin(uv.y * 30.0 + t * 1.5) * 0.002;

    // Chromatic split grows near the cursor
    float md = uMouse.x < 0.0 ? 1.0 : length((uv - uMouse) * vec2(uRes.x / uRes.y, 1.0));
    float split = 0.004 + 0.02 * smoothstep(0.6, 0.0, md);
    float b = bayer4(cell);
    float r = step(b, lumAt(uv + vec2(split, 0.0), t));
    float gC = step(b, lumAt(uv, t));
    float bl = step(b, lumAt(uv - vec2(split, 0.0), t));

    // Square LED dots inside each cell
    vec2 f = fract(gl_FragCoord.xy / cellSize);
    float dotMask = step(f.x, 0.72) * step(f.y, 0.72);
    vec3 col = vec3(r, gC, bl);
    // Tint split fringes green / magenta
    vec3 tint = col.r > col.b ? vec3(1.0, 0.35, 0.95) : vec3(0.35, 1.0, 0.55);
    col = (col.r + col.g + col.b > 2.5) ? vec3(0.95) : col * tint;
    gl_FragColor = vec4(col * dotMask, 1.0);
  }
`;

function initDither(canvas, { texture = null, centerY = 0.3 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    uTex: { value: null },
    uHasTex: { value: 0 },
    uTime: { value: 0 },
    uImgAspect: { value: 864 / 1184 },
    uCenterY: { value: centerY },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(-1, -1) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: DITHER_FRAG,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  if (texture) {
    new THREE.TextureLoader().load(texture, (tex) => {
      tex.minFilter = THREE.LinearFilter;
      uniforms.uTex.value = tex;
      uniforms.uHasTex.value = 1;
      uniforms.uImgAspect.value = tex.image.width / tex.image.height;
      requestRender();
    });
  }

  canvas.parentElement.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    uniforms.uMouse.value.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
  });
  canvas.parentElement.addEventListener('pointerleave', () => uniforms.uMouse.value.set(-1, -1));

  addView(canvas, {
    resize(w, h) {
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    },
    render(t) {
      // Hold the frame until the portrait arrives so the band never flashes noise
      if (texture && !uniforms.uHasTex.value) return;
      uniforms.uTime.value = t;
      renderer.render(scene, camera);
      canvas.style.opacity = '1';
    },
  });
  canvas.style.opacity = '0';
}

// ---------------------------------------------------------------------------
// 3. Works: chrome sci-fi frame + live detection HUD screen + nebula
// ---------------------------------------------------------------------------
const WORKS = [
  { name: 'AIEI VISION', cam: 'CAM_07 · LIVE · VLM', color: '#78c8ff' },
  { name: 'V-LINE MURA', cam: 'AOI_02 · TFT-LCD · LV1', color: '#c88cff' },
  { name: 'ITRASH', cam: 'LINE_03 · RECYCLING', color: '#78ffaa' },
  { name: 'GRIND WHEEL', cam: 'QC_01 · INCREMENTAL', color: '#ff9650' },
];

function chamferShape(w, h, c) {
  const s = new THREE.Shape();
  const x = w / 2;
  const y = h / 2;
  s.moveTo(-x + c, -y);
  s.lineTo(x - c, -y);
  s.lineTo(x, -y + c);
  s.lineTo(x, y - c);
  s.lineTo(x - c, y);
  s.lineTo(-x + c, y);
  s.lineTo(-x, y - c);
  s.lineTo(-x, -y + c);
  s.closePath();
  return s;
}

// Draws one HUD frame for project `idx` into a 2D context.
function drawHUD(ctx, W, H, t, idx) {
  const work = WORKS[idx];
  ctx.save();
  ctx.fillStyle = '#030303';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 10, W * 0.5, H * 0.45, H * 0.7);
  g.addColorStop(0, work.color + '30');
  g.addColorStop(1, '#00000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const box = (x, y, w, h, label, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.font = '600 15px Rajdhani, sans-serif';
    const tw = ctx.measureText(label).width + 12;
    ctx.fillStyle = color;
    ctx.fillRect(x - 1, y - 20, tw, 20);
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + 5, y - 5);
  };

  if (idx === 0) {
    // Floor grid + people walking + danger zone + VQA exchange
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const y = H * 0.45 + i * i * 2.4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = EMBER;
    ctx.beginPath(); ctx.moveTo(W * 0.56, H * 0.5); ctx.lineTo(W * 0.95, H * 0.5); ctx.lineTo(W * 0.98, H * 0.74); ctx.lineTo(W * 0.5, H * 0.74); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
    const people = [0, 1, 2].map((k) => {
      const px = ((t * (18 + k * 9) + k * 170) % (W + 120)) - 60;
      const py = H * (0.47 + k * 0.07);
      const s = 0.8 + k * 0.18;
      return { px, py, s };
    });
    let alert = false;
    people.forEach(({ px, py, s }, k) => {
      ctx.fillStyle = 'rgba(220,220,220,.85)';
      ctx.beginPath(); ctx.arc(px, py - 62 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.roundRect(px - 15 * s, py - 48 * s, 30 * s, 48 * s, 8 * s); ctx.fill();
      ctx.fillRect(px - 11 * s, py, 8 * s, 30 * s); ctx.fillRect(px + 3 * s, py, 8 * s, 30 * s);
      const inZone = px > W * 0.55 && py > H * 0.49 && py < H * 0.75;
      alert = alert || inZone;
      box(px - 24 * s, py - 80 * s, 48 * s, 116 * s, `person ${(0.93 + k * 0.02).toFixed(2)}`, inZone ? EMBER : work.color);
    });
    ctx.font = '600 16px Rajdhani, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(24, H * 0.79, W - 48, 86);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillText('Q › Is anyone inside the restricted zone?', 38, H * 0.79 + 30);
    ctx.fillStyle = alert ? EMBER : '#ffffff';
    ctx.fillText(alert ? 'A › Yes — 1 person near the machine. Alert sent.' : 'A › No. Zone is clear.', 38, H * 0.79 + 62);
  } else if (idx === 1) {
    // LCD panel with a faint vertical line defect
    const px = 50; const py = 120; const pw = W - 100; const ph = H * 0.5;
    const lg = ctx.createLinearGradient(px, py, px + pw, py + ph);
    lg.addColorStop(0, '#3a3a3e'); lg.addColorStop(1, '#232326');
    ctx.fillStyle = lg; ctx.fillRect(px, py, pw, ph);
    const lx = px + pw * 0.62;
    ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fillRect(lx, py, 3, ph);
    const sy = py + ((t * 120) % ph);
    ctx.fillStyle = work.color + '88'; ctx.fillRect(px, sy, pw, 2);
    if (sy > py + ph * 0.2) box(lx - 16, py + 10, 36, ph - 20, 'V-mura LV1 0.99', work.color);
    ctx.font = '700 46px Gloock, serif'; ctx.fillStyle = '#fff';
    ctx.fillText('99.5%', 50, H * 0.83);
    ctx.font = '600 16px Rajdhani, sans-serif'; ctx.fillStyle = '#9a9a9a';
    ctx.fillText('mAP · YOLO-GA + Ghost + CBAM', 50, H * 0.83 + 28);
  } else if (idx === 2) {
    // Conveyor belt with classified objects
    const by = H * 0.62;
    ctx.fillStyle = '#151515'; ctx.fillRect(0, by, W, 46);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    for (let x = -(t * 60 % 40); x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + 20, by + 46); ctx.stroke(); }
    const items = [['PET', 0], ['CAN', 1], ['PAPER', 2], ['PET', 0], ['CAN', 1]];
    items.forEach(([label, kind], k) => {
      const x = ((t * 60 + k * 150) % (W + 160)) - 80;
      ctx.fillStyle = kind === 0 ? 'rgba(160,220,255,.75)' : kind === 1 ? 'rgba(210,210,210,.85)' : 'rgba(200,170,120,.85)';
      if (kind === 0) { ctx.beginPath(); ctx.roundRect(x - 14, by - 74, 28, 74, 8); ctx.fill(); ctx.fillRect(x - 6, by - 86, 12, 14); }
      else if (kind === 1) { ctx.beginPath(); ctx.roundRect(x - 18, by - 50, 36, 50, 5); ctx.fill(); }
      else { ctx.fillRect(x - 28, by - 30, 56, 30); }
      box(x - 34, by - 100, 68, 100, `${label} ${(0.95 + (k % 3) * 0.015).toFixed(2)}`, work.color);
    });
    ctx.font = '700 46px Gloock, serif'; ctx.fillStyle = '#fff';
    ctx.fillText('+50%', 50, H * 0.88);
    ctx.font = '600 16px Rajdhani, sans-serif'; ctx.fillStyle = '#9a9a9a';
    ctx.fillText('accuracy · YOLOv8-GA', 50, H * 0.88 + 28);
  } else {
    // Rotating grinding wheel with ellipse fit and crack
    const cx = W / 2; const cy = H * 0.46;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.6);
    ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    for (let r = 60; r < 150; r += 14) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = EMBER; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(70, -20); ctx.lineTo(95, -34); ctx.lineTo(110, -28); ctx.lineTo(132, -46); ctx.stroke();
    ctx.restore();
    ctx.setLineDash([6, 6]); ctx.strokeStyle = work.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, 156, 152, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const a = t * 0.6 - 0.32;
    const kx = cx + Math.cos(a) * 105; const ky = cy + Math.sin(a) * 105;
    box(kx - 40, ky - 30, 80, 60, 'crack 0.94', EMBER);
    ctx.font = '600 16px Rajdhani, sans-serif'; ctx.fillStyle = '#9a9a9a';
    ctx.fillText('ellipse fit ✓   MobileNetV3   incremental', 50, H * 0.84);
  }

  // Common chrome: title with RGB split, labels, corner brackets, scanlines
  ctx.font = '400 34px Gloock, serif';
  ctx.fillStyle = GLITCH_A + 'cc'; ctx.fillText(work.name, 38, 66);
  ctx.fillStyle = GLITCH_B + 'cc'; ctx.fillText(work.name, 42, 66);
  ctx.fillStyle = '#fff'; ctx.fillText(work.name, 40, 66);
  ctx.font = '700 13px Doto, monospace';
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.fillText(work.cam, 40, 90);
  ctx.fillStyle = Math.floor(t * 2) % 2 ? EMBER : '#550';
  ctx.beginPath(); ctx.arc(W - 46, 60, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.fillText('REC', W - 96, 65);
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
  [[18, 18, 1, 1], [W - 18, 18, -1, 1], [18, H - 18, 1, -1], [W - 18, H - 18, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(x, y + sy * 26); ctx.lineTo(x, y); ctx.lineTo(x + sx * 26, y); ctx.stroke();
  });
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.restore();
}

function initWorks(canvas) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);
  scene.environment = makeEnvironment(renderer);

  const group = new THREE.Group();
  scene.add(group);

  const FW = 3.3; const FH = 4.4;
  const outer = chamferShape(FW, FH, 0.5);
  outer.holes.push(chamferShape(FW - 0.42, FH - 0.42, 0.36));
  const chrome = new THREE.MeshStandardMaterial({ color: '#eef1f5', metalness: 1, roughness: 0.16 });
  const frame = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outer, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 1 }),
    chrome
  );
  frame.position.z = -0.11;
  group.add(frame);

  // Thin inner rim for a layered, machined look
  const rimShape = chamferShape(FW - 0.42, FH - 0.42, 0.36);
  rimShape.holes.push(chamferShape(FW - 0.56, FH - 0.56, 0.3));
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(rimShape, { depth: 0.05, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 1, roughness: 0.3 }));
  rim.position.z = 0.02;
  group.add(rim);

  // Screen with HUD texture; UVs normalised from shape coordinates
  const SW = FW - 0.56; const SH = FH - 0.56;
  const screenGeo = new THREE.ShapeGeometry(chamferShape(SW, SH, 0.3));
  const p = screenGeo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / SW + 0.5;
    uv[i * 2 + 1] = p.getY(i) / SH + 0.5;
  }
  screenGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const hud = document.createElement('canvas');
  hud.width = 512;
  hud.height = Math.round(512 * (SH / SW));
  const hctx = hud.getContext('2d');
  const tex = new THREE.CanvasTexture(hud);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
  screen.position.z = -0.02;
  group.add(screen);

  // Nebula: fine stars + large soft gas puffs, tinted per project
  const nebula = new THREE.Group();
  scene.add(nebula);
  const mkCloud = (count, rMin, rMax, size, opacity) => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rMin + Math.pow(Math.random(), 0.7) * (rMax - rMin);
      pos[i * 3] = Math.cos(a) * r * 1.2;
      pos[i * 3 + 1] = Math.sin(a) * r * 0.9;
      pos[i * 3 + 2] = -1.5 - Math.random() * 3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    seededAttrs(geo, count, 0.3, 1.2);
    const m = pointsMaterial(size, opacity, WORKS[0].color);
    nebula.add(new THREE.Points(geo, m));
    return m;
  };
  const starMat = mkCloud(900, 1.0, 6.0, 9, 0.9);
  const gasMat = mkCloud(110, 0.8, 3.6, 260, 0.05);
  const targetColor = new THREE.Color(WORKS[0].color);

  // Work switching: spin the frame and swap the screen while it is edge-on
  let shown = 0;
  let target = 0;
  let spinStart = -10;
  window.addEventListener('workchange', (e) => {
    target = e.detail;
    targetColor.set(WORKS[target].color);
    if (!isAnimating()) {
      shown = target;
      starMat.uniforms.uColor.value.copy(targetColor);
      gasMat.uniforms.uColor.value.copy(targetColor);
    } else {
      spinStart = -1; // start on next frame
    }
    requestRender();
  });
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  addView(canvas, {
    resize(w, h) {
      renderer.setPixelRatio(DPR());
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Keep the whole frame in view on narrow canvases
      camera.position.z = w / h < 0.75 ? 15 : 11;
      camera.updateProjectionMatrix();
    },
    render(t) {
      stepMouse();
      if (spinStart === -1) spinStart = t;
      let spin = 0;
      const k = (t - spinStart) / 1.0;
      if (k >= 0 && k <= 1) {
        const e = ease(k);
        spin = e * Math.PI * 2;
        if (e > 0.25 && shown !== target) shown = target;
      } else if (shown !== target) {
        shown = target;
      }
      drawHUD(hctx, hud.width, hud.height, t, shown);
      tex.needsUpdate = true;

      group.rotation.y = spin + Math.sin(t * 0.5) * 0.12 + mouse.x * 0.3;
      group.rotation.x = Math.sin(t * 0.35) * 0.05 + mouse.y * 0.15;
      group.position.y = Math.sin(t * 0.8) * 0.08;
      nebula.rotation.z = t * 0.02;
      [starMat, gasMat].forEach((m) => {
        m.uniforms.uTime.value = t;
        m.uniforms.uColor.value.lerp(targetColor, 0.05);
      });
      renderer.render(scene, camera);
    },
  });
}

// 2D fallback when WebGL is unavailable: draw the HUD flat
function initWorksFallback(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const hud = document.createElement('canvas');
  hud.width = 512;
  hud.height = 680;
  const hctx = hud.getContext('2d');
  let idx = 0;
  const draw = () => {
    const w = (canvas.width = canvas.clientWidth);
    const h = (canvas.height = canvas.clientHeight);
    drawHUD(hctx, hud.width, hud.height, 2, idx);
    const s = Math.min(w / hud.width, h / hud.height) * 0.9;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(hud, (w - hud.width * s) / 2, (h - hud.height * s) / 2, hud.width * s, hud.height * s);
  };
  window.addEventListener('workchange', (e) => { idx = e.detail; draw(); });
  new ResizeObserver(draw).observe(canvas);
}

// ---------------------------------------------------------------------------
// 4. Chrome "M" monogram with ember sparks
// ---------------------------------------------------------------------------
function initChrome(canvas) {
  const renderer = makeRenderer(canvas);
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  scene.environment = makeEnvironment(renderer);

  // "M" outline (same proportions as the favicon), centred and scaled
  const P = [[17, 46], [17, 18], [23, 18], [32, 32], [41, 18], [47, 18], [47, 46], [40.5, 46], [40.5, 29.5], [32, 42.5], [23.5, 29.5], [23.5, 46]];
  const shape = new THREE.Shape();
  P.forEach(([x, y], i) => {
    const v = [(x - 32) / 11, -(y - 32) / 11];
    if (i === 0) shape.moveTo(...v); else shape.lineTo(...v);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.09, bevelSegments: 6, curveSegments: 1 });
  geo.center();
  const chrome = new THREE.MeshStandardMaterial({ color: '#f0f2f5', metalness: 1, roughness: 0.12 });
  const logo = new THREE.Group();
  logo.add(new THREE.Mesh(geo, chrome));

  // Four-point star above the M, ember-lit
  const star = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? 0.42 : 0.1;
    if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  star.closePath();
  const starMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(star, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 }),
    new THREE.MeshStandardMaterial({ color: '#ffd2b0', metalness: 0.9, roughness: 0.2, emissive: EMBER, emissiveIntensity: 1.4 })
  );
  starMesh.position.set(0, 1.85, 0);
  logo.add(starMesh);
  scene.add(logo);

  const glow = new THREE.PointLight(EMBER, 18, 8, 1.6);
  glow.position.set(0, -1.6, 1.4);
  scene.add(glow);

  // Rising sparks
  const N = 70;
  const sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    sp[i * 3] = (Math.random() - 0.5) * 5;
    sp[i * 3 + 1] = Math.random() * 4 - 2;
    sp[i * 3 + 2] = (Math.random() - 0.5) * 2;
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  seededAttrs(sGeo, N, 0.4, 1.3);
  const sMat = pointsMaterial(14, 0.9, EMBER);
  const sparks = new THREE.Points(sGeo, sMat);
  scene.add(sparks);

  addView(canvas, {
    resize(w, h) {
      renderer.setPixelRatio(DPR());
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = w / h < 1.2 ? 12 : 9;
      camera.updateProjectionMatrix();
    },
    render(t) {
      stepMouse();
      logo.rotation.y = reduceMotion ? 0.5 : t * 0.7;
      logo.rotation.x = mouse.y * 0.15;
      starMesh.rotation.z = t * 1.5;
      sMat.uniforms.uTime.value = t;
      const pos = sGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        let y = pos.getY(i) + 0.006;
        if (y > 2.2) y = -2;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      glow.intensity = 16 + Math.sin(t * 3) * 3;
      renderer.render(scene, camera);
    },
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
function safe(fn, canvas) {
  try {
    fn(canvas);
  } catch (err) {
    console.warn('3D view disabled:', err);
    canvas.remove();
  }
}

const hasGL = webglAvailable();
const bg = document.getElementById('bg-canvas');
const band = document.getElementById('hero-band');
const paper = document.getElementById('paper-dither');
const works = document.getElementById('works-3d');
const chromeLogo = document.getElementById('chrome-logo');

if (hasGL) {
  if (bg) safe(initDust, bg);
  if (band) safe((c) => initDither(c, { texture: 'assets/profile.jpg', centerY: 0.3 }), band);
  if (paper) safe((c) => initDither(c), paper);
  if (works) safe(initWorks, works);
  if (chromeLogo) safe(initChrome, chromeLogo);
  requestRender();
} else {
  [bg, band, paper, chromeLogo].forEach((c) => c && c.remove());
  if (works) initWorksFallback(works);
}
