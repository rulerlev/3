// Церковь: горница в Пятидесятницу (языки огня, ветер) → «Вавилон наоборот» (цветные потоки сливаются в один)
// → карта Средиземноморья с путешествиями Павла → свеча и письмо (1 Кор 13:13).
export default function build({ THREE, lib, W, H, meta }) {
  const { ramp, lerp, clamp, rng, fbm, noise2, cameraPath, handheld, smooth } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 3000);
  scene.fog = new THREE.FogExp2('#000', 0.02);
  const C = meta.cues;
  const add = (p, o) => (p.add(o), o);

  // ================= A. ГОРНИЦА =================
  const room = add(scene, new THREE.Group());
  const plaster = lib.canvasTexture(512, 512, (g, w, h) => {
    const r = rng(12); g.fillStyle = '#8a7258'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = r(); g.fillStyle = `rgba(${v > 0.5 ? '255,235,210' : '30,20,10'},${r() * 0.06})`; g.fillRect(r() * w, r() * h, 4 + r() * 30, 3 + r() * 20); }
  });
  plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping; plaster.repeat.set(3, 1.5);
  const wallM = new THREE.MeshStandardMaterial({ map: plaster, color: '#c8b49a', roughness: 0.95 });
  const RW = 12, RH = 4.4, RD = 10, WZ = -5; // ширина, высота, глубина; z задней стены
  const box = (w, h, d, x, y, z, m = wallM) => { const b = add(room, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)); b.position.set(x, y, z); b.receiveShadow = true; return b; };
  // задняя стена с окном 1.8×1.4 (центр x=0.6, y=2.4)
  const wx0 = -1.1, wx1 = 1.1, wy0 = 1.2, wy1 = 3.2;
  box(RW / 2 + wx0, RH, 0.4, (-RW / 2 + wx0) / 2, RH / 2, WZ);
  box(RW / 2 - wx1, RH, 0.4, (RW / 2 + wx1) / 2, RH / 2, WZ);
  box(wx1 - wx0, wy0, 0.4, (wx0 + wx1) / 2, wy0 / 2, WZ);
  box(wx1 - wx0, RH - wy1, 0.4, (wx0 + wx1) / 2, (RH + wy1) / 2, WZ);
  box(0.4, RH, RD, -RW / 2, RH / 2, WZ + RD / 2); box(0.4, RH, RD, RW / 2, RH / 2, WZ + RD / 2);
  const floorM = new THREE.MeshStandardMaterial({ color: '#5a4430', roughness: 0.95 });
  box(RW, 0.2, RD, 0, -0.1, WZ + RD / 2, floorM);
  box(RW, 0.2, RD, 0, RH + 0.1, WZ + RD / 2, new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.95 }));
  const beamM = new THREE.MeshStandardMaterial({ color: '#2a1c12', roughness: 0.9 });
  for (let i = 0; i < 5; i++) box(RW, 0.22, 0.26, 0, RH - 0.12, WZ + 1 + i * 2, beamM);
  // ковёр в центре
  const rug = add(room, new THREE.Mesh(new THREE.CircleGeometry(2.6, 40), new THREE.MeshStandardMaterial({ color: '#6a2a1a', roughness: 1 })));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.01, -1.2); rug.receiveShadow = true;
  // вид за окном: сумеречное небо
  const outTex = lib.canvasTexture(512, 384, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a7aa8'); gr.addColorStop(0.5, '#e8b47a'); gr.addColorStop(0.68, '#ffd9a0'); gr.addColorStop(1, '#c08a5a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(31); g.fillStyle = '#3a2618'; // крыши Иерусалима
    for (let x = 0; x < w;) { const bw = 30 + r() * 70, bh = 40 + r() * 90; g.fillRect(x, h - bh, bw, bh); if (r() > 0.75) { g.beginPath(); g.arc(x + bw / 2, h - bh, bw * 0.35, Math.PI, 0); g.fill(); } x += bw + r() * 6; }
  });
  const outside = add(room, new THREE.Mesh(new THREE.PlaneGeometry(8, 6), new THREE.MeshBasicMaterial({ map: outTex, fog: false, color: '#d0b8a0' })));
  outside.position.set(0, 2.75, WZ - 2.2);
  // занавеска, колышется от ветра (CPU-деформация)
  const curtG = new THREE.PlaneGeometry(0.7, 2.0, 10, 16); const curtBase = curtG.attributes.position.array.slice();
  const curtain = add(room, new THREE.Mesh(curtG, new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.9, side: THREE.DoubleSide, emissive: '#5a3a1a', emissiveIntensity: 0.35 })));
  curtain.position.set(wx0 + 0.3, 2.2, WZ + 0.3);
  // свет из окна
  const sunA = add(room, new THREE.DirectionalLight('#ffd2a0', 2.2)); sunA.position.set(1.2, 5.5, WZ - 6); sunA.target.position.set(0, 0, 0);
  room.add(sunA.target); sunA.castShadow = true; sunA.shadow.mapSize.set(1024, 1024);
  Object.assign(sunA.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 }); sunA.shadow.bias = -0.001;
  const hemiA = add(room, new THREE.HemisphereLight('#c8a888', '#3a2414', 0.5));
  const bounce = add(room, new THREE.PointLight('#ffb878', 3.5, 14, 1.5)); bounce.position.set(0, 1.0, WZ + 1.6);
  const fireL = add(room, new THREE.PointLight('#ff9a48', 0, 12, 1.6)); fireL.position.set(0, 2.2, -1.2);
  const beam = (lib.lightBeam({ radiusTop: 0.6, radiusBottom: 2.6, length: 9.5, color: '#ffd8a8', opacity: 0.2 }));
  beam.position.set(0, 3.3, WZ - 1.6); beam.rotation.x = -0.95;
  // сидящие фигуры по кругу
  const robes = ['#4a3424', '#3a3028', '#5a3a2a', '#2e2a2a', '#4a3a2c', '#3c2c22', '#5a4632', '#33302a', '#4c2e22', '#3a3424', '#46382a', '#2c2620'];
  const seated = [];
  const NF = 12;
  for (let i = 0; i < NF; i++) {
    const a = (i / NF) * Math.PI * 2 + 0.2; const rr = 2.0 + (i % 2) * 0.35;
    const f = lib.figure({ height: 1.75 + ((i * 37) % 10) * 0.012, robe: robes[i], hood: true, seed: 40 + i, skin: '#8a5a3c' });
    const s = f.parts.body.scale; const dy = 0.56 * (1.75 / 1.8);
    f.children.forEach((c) => { if (c !== f.parts.body) c.position.y -= dy; }); s.y = 0.62;
    f.parts.arms.forEach((ar, j) => { ar.rotation.x = -0.4; ar.rotation.z = (j ? 1 : -1) * -0.08; });
    f.position.set(Math.sin(a) * rr, 0, -1.2 + Math.cos(a) * rr); f.rotation.y = a + Math.PI;
    room.add(f);
    const fl = lib.fire({ count: 46, seed: 100 + i, radius: 0.035, height: 0.24, size: 2.2, color1: '#fff0c0', color2: '#ff7a24', intensity: 0 });
    fl.position.set(f.position.x, 1.3, f.position.z); room.add(fl);
    const gl = lib.glow('#ffb060', 0.6, 0); gl.position.set(f.position.x, 1.42, f.position.z); room.add(gl);
    seated.push({ f, fl, gl, delay: 3.6 + ((i * 7) % NF) * 0.12 });
  }
  const rush = add(room, lib.glow('#ffe0a8', 1, 0)); rush.position.set(0, 3.3, -1.2);
  // ветер: пылинки, сдуваемые порывами из окна
  const gustT = [1.6, 4.4, 7.2];
  const gustI = (t) => gustT.reduce((s, g) => s + smooth(g, g + 1.6, t), 0); // интеграл порывов (детерминированно)
  const gustV = (t) => gustT.reduce((s, g) => s + Math.max(0, 1 - Math.abs(t - g - 0.7) / 0.9), 0);
  const ND = 700, rd = rng(3), dp = new Float32Array(ND * 3), dsd = new Float32Array(ND * 2);
  for (let i = 0; i < ND; i++) { dp.set([(rd() - 0.5) * 3.2, rd() * 4, rd() * 9], i * 3); dsd.set([rd(), rd()], i * 2); }
  const dG = new THREE.BufferGeometry(); dG.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dG.setAttribute('sd', new THREE.BufferAttribute(dsd, 2));
  const dU = { time: { value: 0 }, pxr: { value: 1 }, wind: { value: 0 }, op: { value: 0.6 } };
  const dust = add(room, new THREE.Points(dG, new THREE.ShaderMaterial({
    uniforms: dU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec2 sd; uniform float time, pxr, wind; varying float vA;
      void main(){ vec3 q = position; float w = wind*(2.5+sd.x*2.);
        q.z = mod(q.z + w + time*.05, 9.); q.x += sin(time*.3+sd.y*30.)*.3 - w*.25; q.y += sin(time*.4+sd.x*20.)*.2 - w*.08;
        q = vec3(q.x, mod(q.y, 4.), q.z - 5.);
        vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv;
        vA = (.4+.6*fract(sd.y*7.3)) * smoothstep(3.6, 1.0, abs(q.y - 2.6 + (q.z+5.)*.55)*1.6 + abs(q.x)) * smoothstep(9., 5., q.z+5.); gl_PointSize = (1.+sd.y*2.)*pxr*(14./max(-mv.z,.5)); }`,
    fragmentShader: `uniform float op; varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d);
      gl_FragColor = vec4(vec3(1.,.86,.66)*a*a*vA*op, 1.); }`,
  })));
  dust.frustumCulled = false;

  // ================= B. ВАВИЛОН НАОБОРОТ =================
  const babel = add(scene, new THREE.Group()); babel.position.set(0, 0, -3000);
  const skyB = lib.skyDome({ top: '#05050f', horizon: '#2a1e36', bottom: '#050308', sunDir: [0, -0.1, -1], sunGlow: 0, radius: 1500 });
  babel.add(skyB);
  const starsB = add(babel, lib.starfield({ count: 2500, radius: 1400, size: 1.8, minY: 0.05, seed: 8 })); starsB.u.opacity.value = 0.5;
  const plain = add(babel, lib.terrain({ size: 900, seg: 90, heightFn: (x, z) => fbm(x * 0.006, z * 0.006, 4) * 14 - 2 + Math.min(1, Math.hypot(x, z) / 300) * 10, color: '#1a1820' }));
  const NS = 16, PER = 900; const CEN = new THREE.Vector3(0, 30, 0);
  const hues = ['#ff5a4a', '#ff9a3a', '#ffd84a', '#9adf5a', '#3ad6a8', '#3ab8ff', '#5a7aff', '#a46aff', '#ff5ad0', '#ff7a8a'];
  const sr = rng(55); const NP = NS * PER;
  const bA = new Float32Array(NP * 3), bB = new Float32Array(NP * 3), bJ = new Float32Array(NP * 3), bC = new Float32Array(NP * 3), bP = new Float32Array(NP);
  const origins = [];
  for (let s = 0; s < NS; s++) {
    const ang = (s / NS) * Math.PI * 2 + sr() * 0.25, R = 160 + sr() * 120;
    const A = new THREE.Vector3(Math.sin(ang) * R, 4 + sr() * 6, Math.cos(ang) * R); origins.push(A);
    const side = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang)).multiplyScalar((sr() - 0.5) * 120);
    const B = A.clone().lerp(CEN, 0.5).add(side).add(new THREE.Vector3(0, 30 + sr() * 50, 0));
    const col = new THREE.Color(hues[s % hues.length]);
    for (let i = 0; i < PER; i++) {
      const k = s * PER + i; bA.set([A.x, A.y, A.z], k * 3); bB.set([B.x, B.y, B.z], k * 3); bC.set([col.r, col.g, col.b], k * 3);
      let x, y, z; do { x = sr() * 2 - 1; y = sr() * 2 - 1; z = sr() * 2 - 1; } while (x * x + y * y + z * z > 1);
      bJ.set([x, y, z], k * 3); bP[k] = sr();
    }
  }
  const bG = new THREE.BufferGeometry();
  bG.setAttribute('position', new THREE.BufferAttribute(bA, 3)); bG.setAttribute('ctrl', new THREE.BufferAttribute(bB, 3));
  bG.setAttribute('jit', new THREE.BufferAttribute(bJ, 3)); bG.setAttribute('col', new THREE.BufferAttribute(bC, 3)); bG.setAttribute('ph', new THREE.BufferAttribute(bP, 1));
  const bU = { time: { value: 0 }, pxr: { value: 1 }, front: { value: 0 }, cen: { value: CEN }, merge: { value: 0 } };
  const streams = add(babel, new THREE.Points(bG, new THREE.ShaderMaterial({
    uniforms: bU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 ctrl, jit, col; attribute float ph; uniform float time, pxr, front, merge; uniform vec3 cen; varying vec3 vC; varying float vA;
      void main(){ float u = fract(ph + time*.11); const float M = .62; vec3 q; float w;
        if (u < M) { float s = u/M; vec3 a = mix(position, ctrl, s), b = mix(ctrl, cen, s); q = mix(a, b, s);
          w = (1.-s*s)*1.4 + .3; q += jit*w + vec3(sin(time*1.3+ph*60.), cos(time*1.1+ph*40.), 0.)*w*.3;
          vC = mix(col, vec3(1.,.9,.7), smoothstep(.75, 1., s)*.6); vA = smoothstep(0., .05, s);
        } else { float s = (u-M)/(1.-M);
          q = cen + vec3(sin(s*5.+time*.4)*6.*s, s*230., -s*s*60.) + jit*(1.2+s*4.);
          vC = mix(vec3(1.,.9,.7), vec3(1.,.78,.45), s); vA = (1.-smoothstep(.7,1.,s))*merge*.6; }
        vA *= 1. - smoothstep(front-.04, front, u);
        vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (2.+fract(ph*13.1)*2.8)*pxr*(320./max(-mv.z,1.)) * (u<M?1.:1.3); gl_PointSize = min(gl_PointSize, 22.*pxr); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d);
      gl_FragColor = vec4(vC*a*a*vA*.9, 1.); }`,
  })));
  streams.frustumCulled = false;
  const originGlows = origins.map((o, i) => { const g = lib.glow(hues[i % hues.length], 26, 0); g.position.copy(o); g.material.fog = false; babel.add(g); return g; });
  const heart = add(babel, lib.glow('#fff0d0', 60, 0)); heart.position.copy(CEN); heart.material.fog = false;
  const pillar = add(babel, lib.lightBeam({ radiusTop: 6, radiusBottom: 2, length: 260, color: '#ffe2b0', opacity: 0 }));
  pillar.rotation.x = Math.PI; pillar.position.copy(CEN);

  // ================= C. КАРТА: путешествия Павла =================
  const map = add(scene, new THREE.Group()); map.position.set(3000, 0, 0);
  const K = 8, X = (lon) => (lon - 24) * K, Z = (lat) => (37 - lat) * K;
  const P = (pts) => pts.map(([a, b]) => [a, b]);
  const lands = [
    // Италия
    P([[6, 44], [8.5, 44.4], [10.2, 43.9], [10.5, 42.9], [11.1, 42.4], [12.3, 41.7], [13, 41.2], [14, 40.8], [14.9, 40.2], [15.7, 39.9], [15.8, 39], [15.6, 38.2], [16.1, 38], [16.6, 38.4], [17.1, 39], [16.5, 39.7], [17, 40.5], [18, 40.1], [18.5, 40.2], [17.9, 40.7], [16.2, 41.4], [15.9, 41.9], [14.7, 42.1], [13.6, 43.5], [12.3, 44.5], [12.4, 45.4], [13.7, 45.7], [13.6, 47], [6, 47]]),
    // Балканы и Греция
    P([[13.7, 45.7], [14.5, 45.2], [15.2, 44.3], [16, 43.5], [17.5, 43], [18.5, 42.4], [19.4, 41.8], [19.5, 40.9], [19.3, 40.4], [20, 39.6], [20.7, 38.9], [21.1, 38.3], [21.3, 37.7], [21.7, 36.8], [22.4, 36.4], [22.8, 36.6], [23.2, 36.5], [22.9, 37.5], [23.2, 37.9], [23.4, 37.95], [24, 37.65], [24.1, 38.2], [23.6, 38.5], [22.9, 38.9], [23.2, 39.3], [22.6, 40], [22.9, 40.6], [23.5, 40.2], [24, 40.3], [23.8, 40.7], [24.4, 40.9], [25.9, 40.85], [26.6, 40.6], [26.2, 40.05], [26.8, 40.4], [27.5, 40.9], [28.9, 41], [29.1, 41.2], [28, 41.6], [27.7, 42.5], [28.6, 44], [30, 45.5], [30, 47], [13.6, 47]]),
    // Малая Азия, Левант, Северная Африка
    P([[29.1, 41.1], [29, 40.6], [27.5, 40.4], [26.6, 40.3], [26.2, 39.9], [26.1, 39.5], [26.9, 39.4], [26.7, 38.7], [26.4, 38.3], [27.2, 37.8], [27.3, 37.3], [27.4, 36.9], [28, 36.8], [28.3, 36.6], [29.1, 36.6], [29.7, 36.2], [30.5, 36.4], [30.6, 36.8], [31.4, 36.7], [32.3, 36.1], [33, 36.1], [34, 36.3], [34.7, 36.8], [35.6, 36.6], [36.2, 36.9], [35.9, 36.2], [35.8, 35.5], [35.9, 34.9], [35.6, 34.3], [35.1, 33.1], [34.9, 32.5], [34.5, 31.5], [34.2, 31.3], [33, 31.1], [32.3, 31.3], [31, 31.6], [30, 31.4], [29, 30.9], [27, 31.3], [25.2, 31.6], [24, 32], [23, 32.6], [22, 32.9], [21, 32.8], [20.1, 32.2], [20, 31], [19, 30.3], [18, 30.8], [16, 31.3], [15.2, 32.3], [13, 32.9], [11.5, 33.2], [10.5, 33.7], [10.1, 34.3], [11.1, 35.2], [10.5, 36.4], [11, 37], [10.2, 37.2], [9, 37.2], [5, 37], [5, 25], [45, 25], [45, 42], [41.5, 41.5], [41, 41], [36, 41.7], [33, 42], [31, 41.2]]),
    P([[12.4, 38.1], [13.3, 38.2], [15.6, 38.3], [15.1, 37.3], [15.1, 36.7], [14.3, 37], [12.6, 37.6]]), // Сицилия
    P([[8.4, 39], [9.6, 39.1], [9.8, 40.9], [9.2, 41.3], [8.2, 40.9], [8.4, 40]]), // Сардиния
    P([[8.6, 41.4], [9.4, 41.4], [9.5, 43], [8.6, 42.3]]), // Корсика
    P([[23.5, 35.3], [24.3, 35.6], [26.3, 35.3], [25.9, 35], [24.7, 34.9], [23.6, 35.2]]), // Крит
    P([[32.3, 34.7], [33, 34.6], [34, 35], [34.6, 35.7], [33, 35.4], [32.3, 35.1]]), // Кипр
    P([[22.8, 38.9], [23.3, 39], [24.6, 38.1], [24.2, 38.05]]), // Эвбея
  ];
  const isles = [[14.4, 35.9, 0.12], [28.0, 36.2, 0.22], [25.4, 37.1, 0.12], [26.0, 38.4, 0.25], [26.5, 39.2, 0.3], [25.6, 40.5, 0.15], [24.6, 40.6, 0.15], [20.6, 39.4, 0.2]]; // Мальта, Родос, острова Эгеиды
  function sdPoly(px, py, poly) {
    let d = 1e9, inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      const ex = xi - xj, ey = yi - yj, wx = px - xj, wy = py - yj; const h = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey));
      d = Math.min(d, Math.hypot(wx - ex * h, wy - ey * h));
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside ? d : -d;
  }
  const landSD = (lon, lat) => {
    let d = -1e9; for (const p of lands) d = Math.max(d, sdPoly(lon, lat, p));
    for (const [a, b, r] of isles) d = Math.max(d, r - Math.hypot(lon - a, lat - b));
    return d + fbm(lon * 1.7, lat * 1.7, 3) * 0.12;
  };
  const MW = 236, MD = 128, segX = 236, segZ = 128;
  const mG = new THREE.PlaneGeometry(MW, MD, segX, segZ); mG.rotateX(-Math.PI / 2);
  const mpos = mG.attributes.position; const mcol = new Float32Array(mpos.count * 3); const cc = new THREE.Color();
  const hAt = (lon, lat) => {
    const sd = landSD(lon, lat);
    if (sd > 0) { const m = clamp(fbm(lon * 0.45 + 3, lat * 0.45, 5) * 1.3 + 0.35); return Math.min(sd, 0.4) * 1.6 + 4.6 * m * m * smooth(0.1, 1.6, sd); }
    return Math.max(sd, -2) * 1.6;
  };
  for (let i = 0; i < mpos.count; i++) {
    const x = mpos.getX(i), z = mpos.getZ(i); const lon = x / K + 24, lat = 37 - z / K; mpos.setY(i, hAt(lon, lat));
  }
  mG.computeVertexNormals();
  const mn = mG.attributes.normal;
  for (let i = 0; i < mpos.count; i++) {
    const y = mpos.getY(i), sl = 1 - mn.getY(i), x = mpos.getX(i), z = mpos.getZ(i);
    const sea = new THREE.Color('#2a8a96').lerp(new THREE.Color('#06283a'), clamp(-y / 1.6));
    {
      cc.set('#a08a58').lerp(new THREE.Color('#6a7a40'), clamp(noise2(x * 0.05, z * 0.05) * 0.6 + 0.35)).lerp(new THREE.Color('#c8b088'), clamp(y / 4.5)).lerp(new THREE.Color('#5a4630'), clamp(sl * 1.6));
      cc.lerp(new THREE.Color('#e0cca0'), 0.6 * clamp(1 - Math.abs(y) / 0.3));
      cc.lerp(sea, smooth(0.15, -0.35, y));
    }
    mcol.set([cc.r, cc.g, cc.b], i * 3);
  }
  mG.setAttribute('color', new THREE.BufferAttribute(mcol, 3));
  const mapMesh = add(map, new THREE.Mesh(mG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })));
  const water = add(map, new THREE.Mesh(new THREE.PlaneGeometry(MW, MD), new THREE.MeshStandardMaterial({ color: '#0e4a5e', roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.55 })));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.02;
  // «рамка» карты: тёмный стол под ней
  const under = add(map, new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: '#0a0806', roughness: 1 })));
  under.rotation.x = -Math.PI / 2; under.position.y = -3;
  const sunC = add(map, new THREE.DirectionalLight('#ffd8a8', 2.8)); sunC.position.set(-160, 70, 30); sunC.target.position.set(0, 0, 0); map.add(sunC.target);
  const hemiC = add(map, new THREE.HemisphereLight('#9ab0cc', '#2a2016', 0.6));

  // города и маршруты
  const CT = {
    jer: [35.2, 31.78, 'Иерусалим'], dam: [36.3, 33.5, 'Дамаск'], ant: [36.16, 36.2, 'Антиохия'], sel: [35.93, 36.12], sal: [33.9, 35.18], pap: [32.41, 34.76],
    per: [30.85, 36.96], pis: [31.19, 38.3], ico: [32.49, 37.87], lys: [32.33, 37.58], der: [33.36, 37.35], att: [30.7, 36.88], tar: [34.9, 36.92, 'Тарс'],
    tro: [26.24, 39.75, 'Троада'], nea: [24.4, 40.93], phi: [24.29, 41.01, 'Филиппы'], the: [22.94, 40.64, 'Фессалоника'], ber: [22.2, 40.52], ath: [23.73, 37.98, 'Афины'],
    cor: [22.88, 37.91, 'Коринф'], eph: [27.34, 37.94, 'Эфес'], cae: [34.89, 32.5], mil: [27.28, 37.53], rho: [28.2, 36.42], tyr: [35.2, 33.27], sid: [35.37, 33.56],
    myr: [29.98, 36.24], fai: [24.8, 34.93], mal: [14.4, 35.9, 'Мальта'], syr: [15.29, 37.07], reg: [15.65, 38.11], put: [14.1, 40.82], rom: [12.5, 41.9, 'Рим'],
  };
  const routes = [
    { cities: ['jer', 'dam'], t0: C.paul + 0.4, t1: C.paul + 3.6, color: '#fff1d0' },
    { cities: ['ant', 'sel', 'sal', 'pap', 'per', 'pis', 'ico', 'lys', 'der', 'lys', 'per', 'att', 'ant'], t0: C.paul + 4.6, t1: C.paul + 7.0, color: '#ffc46a' },
    { cities: ['ant', 'tar', 'der', 'ico', 'tro', 'nea', 'phi', 'the', 'ber', 'ath', 'cor', 'eph', 'cae', 'jer'], t0: C.paul + 6.6, t1: C.paul + 8.9, color: '#ff9a5a' },
    { cities: ['ant', 'tar', 'ico', 'eph', 'tro', 'phi', 'cor', 'phi', 'tro', 'mil', 'rho', 'tyr', 'cae', 'jer'], t0: C.paul + 8.4, t1: C.paul + 9.8, color: '#ffdf8a' },
    { cities: ['cae', 'sid', 'myr', 'fai', 'mal', 'syr', 'reg', 'put', 'rom'], t0: C.paul + 9.3, t1: C.paul + 10.8, color: '#fff0c0' },
  ];
  const lift = (lon, lat) => Math.max(hAt(lon, lat), 0) + 0.45;
  const ribbonMat = (color) => new THREE.ShaderMaterial({
    uniforms: { reveal: { value: 0 }, color: { value: new THREE.Color(color) }, op: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute float prog; attribute float edge; varying float vP; varying float vE; void main(){ vP = prog; vE = edge; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float reveal, op; uniform vec3 color; varying float vP; varying float vE;
      void main(){ if (vP > reveal) discard; float head = smoothstep(reveal-.03, reveal, vP); float e = 1.-abs(vE);
        gl_FragColor = vec4(color*(e*e*(1.1 + head*2.5))*op, 1.); }`,
  });
  const markers = [];
  routes.forEach((R) => {
    const pts = []; const cityProg = [];
    for (let i = 0; i < R.cities.length - 1; i++) {
      const [a0, b0] = CT[R.cities[i]], [a1, b1] = CT[R.cities[i + 1]]; const n = Math.max(6, Math.ceil(Math.hypot(a1 - a0, b1 - b0) * 6));
      for (let j = 0; j < n; j++) {
        const s = j / n; const lon = lerp(a0, a1, s) + Math.sin(s * Math.PI) * (b1 - b0) * 0.06, lat = lerp(b0, b1, s) - Math.sin(s * Math.PI) * (a1 - a0) * 0.06;
        if (j === 0) cityProg.push([R.cities[i], pts.length]);
        pts.push(new THREE.Vector3(X(lon), lift(lon, lat) + Math.sin(s * Math.PI) * 0.6, Z(lat)));
      }
    }
    const last = CT[R.cities.at(-1)]; cityProg.push([R.cities.at(-1), pts.length]); pts.push(new THREE.Vector3(X(last[0]), lift(last[0], last[1]), Z(last[1])));
    const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const L = len.at(-1); const wv = 0.75; const pos = [], prog = [], edge = [], idx = [];
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l * wv, nz = dx / l * wv;
      pos.push(p.x + nx, p.y, p.z + nz, p.x - nx, p.y, p.z - nz); prog.push(len[i] / L, len[i] / L); edge.push(1, -1);
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('prog', new THREE.Float32BufferAttribute(prog, 1)); g.setAttribute('edge', new THREE.Float32BufferAttribute(edge, 1)); g.setIndex(idx);
    R.mesh = add(map, new THREE.Mesh(g, ribbonMat(R.color))); R.mesh.frustumCulled = false;
    R.pts = pts; R.len = len; R.L = L;
    cityProg.forEach(([c, pi]) => { const m = lib.glow(R.color, 3.2, 0); m.position.copy(pts[pi]).add(new THREE.Vector3(0, 0.3, 0)); map.add(m); markers.push({ m, R, p: len[pi] / L, c }); });
  });
  const headGlow = add(map, lib.glow('#fff0c8', 6, 0));
  const flashD = add(map, lib.glow('#fff6e0', 40, 0)); flashD.position.set(X(36.3), 4, Z(33.5));
  // кораблик
  const ship = add(map, new THREE.Group());
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.6), new THREE.MeshStandardMaterial({ color: '#4a2c16', roughness: 0.8 })); hull.position.y = 0.2; ship.add(hull);
  const prow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), hull.material); prow.rotation.z = -Math.PI / 2; prow.position.set(1.25, 0.25, 0); ship.add(prow);
  const sailG = new THREE.BufferGeometry(); sailG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.5, 0, 0, 2.0, 0.05, 0, 0.6, 0.9, 0, 0.5, 0, 0, 2.0, 0.05, 0, 0.6, -0.9], 3)); sailG.computeVertexNormals();
  ship.add(new THREE.Mesh(sailG, new THREE.MeshStandardMaterial({ color: '#efe2c4', side: THREE.DoubleSide, emissive: '#5a4a30', emissiveIntensity: 0.5 })));
  const motesC = add(map, lib.motes({ count: 500, box: [240, 30, 130], center: [0, 18, 0], size: 10, color: '#ffe0b0', speed: 0.2, opacity: 0.35 }));
  const tmpV = new THREE.Vector3();
  const sampleRoute = (R, k) => { const d = k * R.L; let i = 1; while (i < R.len.length - 1 && R.len[i] < d) i++; const s = clamp((d - R.len[i - 1]) / (R.len[i] - R.len[i - 1] || 1)); return [tmpV.copy(R.pts[i - 1]).lerp(R.pts[i], s), R.pts[i]]; };

  // ================= D. СВЕЧА И ПИСЬМО =================
  const desk = add(scene, new THREE.Group()); desk.position.set(-3000, 0, 0);
  const woodTex = lib.canvasTexture(1024, 256, (g, w, h) => {
    const r = rng(4); g.fillStyle = '#4a2e1a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) { const y = r() * h; g.strokeStyle = `rgba(${r() > 0.5 ? '20,10,4' : '120,80,40'},${0.1 + r() * 0.2})`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6 + (r() - 0.5) * 2); g.stroke(); }
  });
  const table = add(desk, new THREE.Mesh(new THREE.BoxGeometry(5, 0.12, 2.4), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.6, color: '#c09070' })));
  table.position.set(0, -0.06, 0); table.receiveShadow = true;
  const letterTex = lib.canvasTexture(1024, 720, (g, w, h) => {
    const r = rng(19); g.fillStyle = '#d9c39a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '120,90,50' : '255,245,220'},${r() * 0.08})`; g.fillRect(r() * w, r() * h, 2 + r() * 12, 2 + r() * 12); }
    const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,50,20,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,24,12,0.82)'; g.lineWidth = 2.6; g.lineCap = 'round';
    for (let row = 0; row < 15; row++) {
      const y = 80 + row * 40; let x = 90 + (row === 0 ? 120 : 0); const xe = w - 90 - (row === 14 ? 420 : r() * 40);
      while (x < xe) { const ww = 20 + r() * 60; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < ww; k += 4) g.lineTo(x + k, y - Math.abs(Math.sin(k * 0.4 + r() * 3)) * (6 + r() * 9) + (r() - 0.5) * 3); g.stroke(); x += ww + 12 + r() * 10; }
    }
  });
  const lg = new THREE.PlaneGeometry(1.2, 0.85, 24, 6); lg.rotateX(-Math.PI / 2);
  { const p = lg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.pow(Math.abs(x) / 0.6, 4) * 0.05 + Math.pow(Math.max(0, z) / 0.42, 3) * 0.015); } lg.computeVertexNormals(); }
  const letter = add(desk, new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ map: letterTex, roughness: 0.85, side: THREE.DoubleSide, color: '#8a7a64' })));
  letter.position.set(-0.05, 0.005, -0.1); letter.rotation.y = 0.18; letter.receiveShadow = true;
  const rollM = new THREE.MeshStandardMaterial({ color: '#c8ad80', roughness: 0.85 });
  const roll = add(desk, new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 20), rollM)); roll.rotation.z = Math.PI / 2; roll.rotation.y = 0.18; roll.position.set(0.03, 0.06, -0.58);
  const inkM = new THREE.MeshStandardMaterial({ color: '#12100e', roughness: 0.2, metalness: 0.3 });
  const ink = add(desk, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 20), inkM)); ink.position.set(0.72, 0.07, -0.3);
  const quill = add(desk, new THREE.Group()); quill.position.set(0.62, 0.012, 0.12); quill.rotation.set(0, 0.6, Math.PI / 2 - 0.02);
  quill.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.6, 6), new THREE.MeshStandardMaterial({ color: '#e8e0d0' }))).position.y = 0.25;
  const feather = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.9 })); feather.scale.set(0.35, 3.2, 0.08); feather.position.y = 0.38; quill.add(feather);
  // главная свеча (справа) и три малые — вера, надежда, любовь
  const wax = new THREE.MeshStandardMaterial({ color: '#efe0c4', roughness: 0.6, emissive: '#4a2a10', emissiveIntensity: 0.25 });
  const candles = [];
  const mkCandle = (x, z, h, r, big) => {
    const c = add(desk, new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, h, 20), wax)); c.position.set(x, h / 2, z);
    const holder = add(desk, new THREE.Mesh(new THREE.CylinderGeometry(r * 2.4, r * 2.8, 0.03, 24), new THREE.MeshStandardMaterial({ color: '#6a4a24', metalness: 0.6, roughness: 0.4 }))); holder.position.set(x, 0.015, z);
    const fl = lib.fire({ count: big ? 110 : 70, seed: Math.round(x * 100 + 7), radius: r * 0.15, height: big ? 0.11 : 0.07, size: big ? 1.6 : 1.1, color1: '#fff2c8', color2: '#ff7a20', intensity: 0 });
    fl.position.set(x, h + 0.012, z); desk.add(fl);
    const gl = lib.glow('#ffb860', big ? 0.6 : 0.4, 0); gl.position.set(x, h + 0.06, z); desk.add(gl);
    const core = lib.glow('#fff0c8', big ? 0.07 : 0.045, 0); core.position.set(x, h + 0.04, z); desk.add(core);
    const o = { fl, gl, core, x, z, h }; candles.push(o); return o;
  };
  const bigC = mkCandle(1.05, -0.35, 0.26, 0.055, true);
  const small = [mkCandle(0.1, -0.75, 0.12, 0.03), mkCandle(0.33, -0.8, 0.15, 0.03), mkCandle(0.56, -0.76, 0.18, 0.035)];
  const candleL = add(desk, new THREE.PointLight('#ffa858', 2.5, 8, 2)); candleL.position.set(1.0, 0.4, -0.25);
  const loveL = add(desk, new THREE.PointLight('#ff9a50', 0, 5, 2)); loveL.position.set(0.33, 0.3, -0.7);
  const hemiD = add(desk, new THREE.HemisphereLight('#3a4a6a', '#1a0e06', 0.25));
  const wallD = add(desk, new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshStandardMaterial({ map: plaster, color: '#6a5444', roughness: 1 })));
  wallD.position.set(0, 1.5, -1.6);
  const dustD = add(desk, lib.motes({ count: 220, box: [8, 6, 6], center: [0.6, 0.6, -0.2], size: 0.35, color: '#ffd8a8', speed: 0.1, opacity: 0.4 }));
  dustD.scale.setScalar(0.3);

  // ---------- подписи городов (2D поверх 3D) ----------
  let labelState = null;
  const labelFn = (g, ov) => {
    if (!labelState) return; const { k } = ov; const cw = ov.W, ch = ov.H;
    g.save(); g.font = `${Math.round(17 * k)}px PTMono`; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 6 * k;
    labelState.forEach(({ name, pos, a }) => {
      if (a <= 0.01) return; const v = pos.clone().project(camera); if (v.z > 1) return;
      const x = (v.x * 0.5 + 0.5) * cw, y = (-v.y * 0.5 + 0.5) * ch;
      g.globalAlpha = a; g.fillStyle = 'rgba(255,232,190,0.92)'; g.textAlign = 'left'; g.fillText(name.toUpperCase(), x + 12 * k, y - 10 * k);
    });
    g.restore();
  };
  const labelCities = Object.entries(CT).filter(([, v]) => v[2]).map(([key, v]) => ({ key, name: v[2], pos: new THREE.Vector3(X(v[0]) + 3000, lift(v[0], v[1]) + 0.5, Z(v[1])) }));
  const firstReach = {}; routes.forEach((R) => markers.filter((m) => m.R === R).forEach((m) => { const tt = lerp(R.t0, R.t1, m.p); if (!(m.c in firstReach) || firstReach[m.c] > tt) firstReach[m.c] = tt; }));

  // ================= UPDATE =================
  return {
    scene, camera,
    update(t, S) {
      const shot = t < C.unbabel ? 0 : t < C.paul ? 1 : t < C.love ? 2 : 3;
      room.visible = shot === 0; babel.visible = shot === 1; map.visible = shot === 2; desk.visible = shot === 3;
      const cuts = [C.unbabel, C.paul, C.love]; let dip = 1; cuts.forEach((c) => { dip = Math.min(dip, smooth(0, 0.3, Math.abs(t - c))); });
      const P = S.post; P.vignette = 0.45; P.grain = 0.045; labelState = null;

      if (shot === 0) {
        scene.fog.color.set('#1a120c'); scene.fog.density = 0.035;
        const fireK = ramp(t, 3.4, 1.6);
        seated.forEach(({ f, fl, gl, delay }, i) => {
          const k = ramp(t, delay, 0.5); fl.u.intensity.value = k * (0.9 + 0.1 * Math.sin(t * 7 + i));
          gl.material.opacity = k * 0.35; gl.scale.setScalar(0.5 + 0.12 * Math.sin(t * 5 + i * 2));
          f.parts.head.rotation.x = -0.25 * ramp(t, delay - 0.6, 1.2); f.parts.arms[0].rotation.x = -0.4 - 0.9 * ramp(t, delay + 0.5 + (i % 4) * 0.3, 1.2) * (i % 3 === 0 ? 1 : 0);
        });
        rush.material.opacity = Math.min(ramp(t, 3.0, 0.5), 1 - ramp(t, 3.7, 1.2)) * 0.6; rush.scale.setScalar(lerp(1, 7, ramp(t, 3.0, 1.6)));
        fireL.intensity = fireK * 3.2 * (0.9 + 0.1 * noise2(t * 5, 2));
        sunA.intensity = 2.4 + gustV(t) * 0.4; hemiA.intensity = 0.45; bounce.intensity = 3.0 + fireK * 1.0;
        beam.u.opacity.value = 0.2 + gustV(t) * 0.05;
        dU.wind.value = gustI(t); dU.op.value = 0.5;
        // занавеска
        const pa = curtG.attributes.position; const gv = gustV(t);
        for (let i = 0; i < pa.count; i++) {
          const x = curtBase[i * 3], y = curtBase[i * 3 + 1]; const hang = (1.0 - y) / 2.0; // 0 сверху → 1 снизу
          const w = hang * hang * (0.08 * Math.sin(t * 2 + x * 6 + y * 3) + gv * 0.55 * (0.8 + 0.2 * Math.sin(t * 9 + y * 5)));
          pa.setXYZ(i, x + w * 0.3, y + w * 0.15, w);
        }
        pa.needsUpdate = true; curtG.computeVertexNormals();
        // камера: общий план от входа → средний, вокруг круга
        if (t < 5.6) cameraPath(camera, [[0, [-2.4, 2.3, 5.4], [0.1, 1.5, -3]], [5.6, [-1.4, 1.95, 4.3], [0.1, 1.45, -3]]], t);
        else cameraPath(camera, [[5.6, [3.9, 1.45, 1.4], [-0.6, 1.35, -2.2]], [C.unbabel, [3.3, 1.5, 0.4], [-0.8, 1.35, -2.4]]], t);
        handheld(camera, t, 0.006);
        P.exposure = 0.95; P.bloom = 0.55 + fireK * 0.25; P.bloomThreshold = 0.6; P.bloomRadius = 0.6; P.tint = [1.04, 1.0, 0.94];
        P.flash = Math.min(ramp(t, 3.05, 0.2), 1 - ramp(t, 3.25, 0.9)) * 0.12;
      } else if (shot === 1) {
        const tt = t - C.unbabel;
        scene.fog.color.set('#0c0a14'); scene.fog.density = 0.0018;
        const front = lerp(0.0, 1.02, ramp(t, C.unbabel - 0.2, 3.4)); bU.front.value = front; bU.merge.value = ramp(t, C.unbabel + 1.6, 1.4);
        originGlows.forEach((g, i) => { g.material.opacity = (0.3 + 0.5 * ramp(t, C.unbabel + (i % 5) * 0.1, 0.6)) * 0.8; });
        const join = ramp(t, C.unbabel + 3.6, 1.5); // «Они соединяют»
        heart.material.opacity = bU.merge.value * 0.18 + join * 0.12; heart.scale.setScalar(36 + join * 16 + Math.sin(t * 3) * 3);
        pillar.u.opacity.value = join * 0.12;
        skyB.u.horizon.value.set('#2a1e36').lerp(new THREE.Color('#4a3238'), join);
        const ang = lerp(0.6, -0.1, tt / (C.paul - C.unbabel)); const rad = lerp(190, 150, ramp(t, C.unbabel, 6));
        camera.position.set(Math.sin(ang) * rad, lerp(18, 30, ramp(t, C.unbabel, 6)), Math.cos(ang) * rad - 3000);
        camera.lookAt(0, lerp(34, 58, ramp(t, C.unbabel + 2, 4)), -3000);
        P.exposure = 0.95; P.bloom = 0.85; P.bloomThreshold = 0.45; P.bloomRadius = 0.75; P.tint = [1, 1, 1];
      } else if (shot === 2) {
        scene.fog.color.set('#0a0806'); scene.fog.density = 0.0016;
        routes.forEach((R) => { R.mesh.material.uniforms.reveal.value = lib.ease((t - R.t0) / (R.t1 - R.t0)) * 1.0001 - (t < R.t0 ? 1 : 0); });
        markers.forEach(({ m, R, p }) => { const rv = R.mesh.material.uniforms.reveal.value; m.material.opacity = rv >= p ? 0.75 : 0; });
        // голова текущего маршрута + корабль
        let active = null; for (const R of routes) if (t >= R.t0 - 0.05 && t <= R.t1 + 0.3) active = R;
        if (active) {
          const k = clamp((t - active.t0) / (active.t1 - active.t0)); const [p, nxt] = sampleRoute(active, lib.ease(k));
          headGlow.position.copy(p); headGlow.material.opacity = 0.9 * (1 - ramp(t, active.t1, 0.3)); headGlow.scale.setScalar(5 + Math.sin(t * 8) * 0.6);
          const lon = (p.x) / K + 24, lat = 37 - p.z / K; const sea = hAt(lon, lat) < 0.05;
          ship.visible = sea && active !== routes[0]; ship.position.set(p.x, 0.05, p.z); ship.rotation.y = Math.atan2(-(nxt.z - p.z), nxt.x - p.x);
        } else { headGlow.material.opacity = 0; ship.visible = false; }
        const fl = Math.min(ramp(t, C.paul + 2.2, 0.3), 1 - ramp(t, C.paul + 2.6, 1.6));
        flashD.material.opacity = fl * 0.9; flashD.scale.setScalar(20 + fl * 30);
        P.flash = Math.min(ramp(t, C.paul + 2.25, 0.15), 1 - ramp(t, C.paul + 2.45, 0.6)) * 0.22;
        // камера: от Леванта — к общему виду всего моря
        const o = 3000;
        cameraPath(camera, [
          [C.paul, [X(36.6) + o + 10, 34, Z(31.2) + 46], [X(35.6) + o, 0, Z(33.2)]],
          [C.paul + 3.6, [X(36.0) + o + 6, 42, Z(31.0) + 54], [X(35.0) + o, 0, Z(33.6)]],
          [C.paul + 7.2, [X(30) + o, 96, Z(33.5) + 92], [X(29.5) + o, 0, Z(37.2)]],
          [C.love - 0.3, [X(22.5) + o, 140, Z(33) + 128], [X(23) + o, 0, Z(37.6)]],
        ], t);
        P.exposure = 1.0; P.bloom = 0.6; P.bloomThreshold = 0.7; P.bloomRadius = 0.5; P.tint = [1.03, 1, 0.95];
        S.overlay.push(labelFn); labelState = labelCities.map((c) => ({ ...c, a: c.key in firstReach ? ramp(t, firstReach[c.key] - 0.05, 0.4) * 0.9 : 0 }));
      } else {
        scene.fog.color.set('#050302'); scene.fog.density = 0.18;
        const flick = 0.92 + 0.08 * noise2(t * 5, 1.1);
        bigC.fl.u.intensity.value = 0.6; bigC.gl.material.opacity = 0.2 * flick; bigC.core.material.opacity = 0.35;
        const words = [29.0, 29.6, 30.4].map((w) => w - 26.0 + C.love);
        small.forEach((c, i) => { const k = ramp(t, words[i], 0.4); c.fl.u.intensity.value = k * (i === 2 ? 1.25 : 0.95); c.gl.material.opacity = k * (i === 2 ? 0.4 : 0.25) * flick; c.core.material.opacity = k * 0.6; });
        candleL.intensity = 2.4 * flick; loveL.intensity = 0.8 * ramp(t, words[0], 0.4) + 0.8 * ramp(t, words[1], 0.4) + 1.6 * ramp(t, words[2], 0.6);
        const k = (t - C.love) / (S.dur - C.love);
        camera.position.set(lerp(-0.75, -0.5, k) - 3000, lerp(0.48, 0.42, k), lerp(1.45, 1.15, lib.ease(k)));
        camera.lookAt(lerp(0.25, 0.3, k) - 3000, lerp(0.24, 0.22, k), -0.6);
        handheld(camera, t, 0.003);
        P.exposure = 0.95; P.bloom = 0.65; P.bloomThreshold = 0.6; P.bloomRadius = 0.7; P.vignette = 0.55; P.tint = [1.04, 0.99, 0.92];
        S.quote.y = 0.36;
      }
      P.exposure *= lerp(0.15, 1, dip);
      S.fadeOut = 0.7;
    },
  };
}
