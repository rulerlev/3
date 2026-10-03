// Ядро: собирает сцены по таймлайну, рендерит кадр t (детерминированно), накладывает 2D-оверлей.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import * as lib from './lib.js';
import { Overlay } from './overlay.js';

const qs = new URLSearchParams(location.search);
const W = +qs.get('w') || 1920, H = +qs.get('h') || 1080;
const SCALE = W / 1920; // всё в сценах задано для 1920
const R3D = +(qs.get('r3d') || 0.75); const GW = Math.round(W * R3D), GH = Math.round(H * R3D); // 3D рендерится мельче, текст — в полном разрешении

const glCanvas = document.getElementById('gl'), out = document.getElementById('out');
out.width = W; out.height = H; const g2 = out.getContext('2d');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(GW, GH, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const rt = new THREE.WebGLRenderTarget(GW, GH, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
const bloom = new UnrealBloomPass(new THREE.Vector2(GW, GH), 0.6, 0.6, 0.8);
const output = new OutputPass();
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.35 }, grain: { value: 0.045 }, sat: { value: 1 }, contrast: { value: 1 },
    tint: { value: new THREE.Color(1, 1, 1) }, lift: { value: new THREE.Color(0, 0, 0) }, ca: { value: 0.0015 }, fade: { value: 0 }, flash: { value: 0 }, res: { value: new THREE.Vector2(GW, GH) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vignette, grain, sat, contrast, ca, fade, flash; uniform vec3 tint, lift; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 d = vUv-.5; float r2 = dot(d,d);
      vec3 c; c.r = texture2D(tDiffuse, vUv - d*ca*r2*4.).r; c.g = texture2D(tDiffuse, vUv).g; c.b = texture2D(tDiffuse, vUv + d*ca*r2*4.).b;
      float l = dot(c, vec3(.2126,.7152,.0722)); c = mix(vec3(l), c, sat);
      c = (c-.5)*contrast+.5; c = c*tint + lift*(1.-c);
      c *= 1. - vignette*smoothstep(.1, .75, r2*2.2);
      c += (h(vUv*res + fract(time*7.31)*91.) - .5)*grain;
      c = mix(c, vec3(1.), flash); c *= 1.-fade;
      gl_FragColor = vec4(clamp(c,0.,1.), 1.); }`,
});
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(output); composer.addPass(grade);

const POST_DEFAULT = { exposure: 1.0, bloom: 0.6, bloomRadius: 0.6, bloomThreshold: 0.8, vignette: 0.38, grain: 0.045, sat: 1.0, contrast: 1.04, tint: [1, 1, 1], lift: [0, 0, 0], ca: 0.0015, flash: 0 };

let timeline, scenesMeta, overlay;
const builders = {}; const built = new Map();
const E = { THREE, lib, W, H, SCALE: SCALE * R3D, renderer };

function placeholder(E) {
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 2000);
  scene.add(lib.starfield({ count: 3000 })); return { scene, camera, update(t) { camera.rotation.y = t * 0.01; } };
}

async function init() {
  timeline = await (await fetch('../data/' + (qs.get('tl') || 'timeline.json'))).json();
  const bible = await (await fetch('../data/bible.json')).json();
  const stats = await (await fetch('../data/stats.json')).json();
  const exact = await (await fetch('../data/exact.json')).json();
  scenesMeta = timeline.scenes;
  await Promise.all(scenesMeta.map(async (s) => {
    try { builders[s.id] = (await import(`./scenes/${s.id}.js`)).default; }
    catch (e) { console.warn('scene missing', s.id, e.message); builders[s.id] = placeholder; }
  }));
  await document.fonts.load('40px Garamond'); await document.fonts.load('italic 40px Garamond'); await document.fonts.load('40px PTSans');
  await document.fonts.load('bold 40px PTSans'); await document.fonts.load('40px PTMono'); await document.fonts.load('40px GaramondSC');
  overlay = new Overlay(g2, W, H, { timeline, bible, stats, exact });
  E.bible = bible; E.stats = stats; E.exact = exact;
  window.TOTAL = timeline.total; window.FRAMES = Math.ceil(timeline.total * timeline.fps);
  window.ready = true;
}

function getScene(i) {
  if (!built.has(i)) {
    // держим в памяти не больше 2 сцен
    for (const [k, v] of built) if (Math.abs(k - i) > 1) { disposeScene(v.scene); built.delete(k); }
    const meta = scenesMeta[i];
    const inst = builders[meta.id]({ ...E, meta });
    inst.camera.aspect = W / H; inst.camera.updateProjectionMatrix();
    built.set(i, inst);
  }
  return built.get(i);
}
function disposeScene(scene) {
  scene.traverse((o) => { o.geometry?.dispose(); const m = o.material; (Array.isArray(m) ? m : [m]).forEach((mm) => { if (!mm) return; for (const k in mm) if (mm[k]?.isTexture) mm[k].dispose(); mm.dispose?.(); }); });
}

function makeS(meta, t) {
  const S = {
    t, dur: meta.dur, meta, cues: meta.cues, lines: meta.lines,
    cue: (n) => meta.cues[n] ?? 1e9,
    since: (n) => t - (meta.cues[n] ?? 1e9),
    k: (n, d = 1, off = 0) => lib.ramp(t, (meta.cues[n] ?? 1e9) + off, d),
    post: structuredClone(POST_DEFAULT),
    fadeIn: 0.7, fadeOut: 0.7, hud: true, subs: true, quote: { y: 0.5, align: 'center', scale: 1, show: true }, overlay: [],
  };
  return S;
}

function sceneIndexAt(T) { let i = 0; while (i < scenesMeta.length - 1 && T >= scenesMeta[i + 1].start) i++; return i; }

window.renderFrame = (frame) => {
  const T = frame / timeline.fps; const i = sceneIndexAt(T); const meta = scenesMeta[i]; const t = T - meta.start;
  const inst = getScene(i); const S = makeS(meta, t);
  inst.update(t, S);
  inst.scene.traverse((o) => { const u = o.u || o.material?.uniforms; if (u?.time && !o.userData.manualTime) u.time.value = t; if (u?.pxr) u.pxr.value = SCALE * R3D; });
  const P = S.post;
  renderer.toneMappingExposure = P.exposure;
  bloom.strength = P.bloom; bloom.radius = P.bloomRadius; bloom.threshold = P.bloomThreshold;
  const gu = grade.uniforms; gu.time.value = T; gu.vignette.value = P.vignette; gu.grain.value = P.grain; gu.sat.value = P.sat; gu.contrast.value = P.contrast;
  gu.tint.value.setRGB(...P.tint); gu.lift.value.setRGB(...P.lift); gu.ca.value = P.ca; gu.flash.value = P.flash;
  gu.fade.value = 1 - Math.min(lib.ramp(t, 0, S.fadeIn), 1 - lib.ramp(t, meta.dur - S.fadeOut, S.fadeOut));
  if (S.fadeIn === 0 && S.fadeOut === 0) gu.fade.value = 0;
  renderPass.scene = inst.scene; renderPass.camera = inst.camera;
  composer.render();
  g2.imageSmoothingQuality = 'high'; g2.drawImage(glCanvas, 0, 0, W, H);
  overlay.draw(T, i, t, S);
  return true;
};
window.grab = (q = 0.93) => out.toDataURL('image/jpeg', q);

init().catch((e) => { console.error(e); window.initError = String(e.stack || e); });
