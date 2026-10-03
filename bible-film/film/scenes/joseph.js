// Иосиф: зал египетского дворца, колонны и факелы — одиннадцать братьев кланяются правителю на помосте →
// он сходит вниз и обнимает брата → терраса над Нилом на закате (цитата) → общий план: поселения, пирамиды,
// камера отъезжает, сумерки сгущаются в ночь (четыреста лет).
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, rng, fbm, noise2, smooth, cameraPath, handheld } = lib;
  const C = meta.cues;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#2a160c', 0.028);
  const col = (c) => new THREE.Color(c);
  function look(keys, t) {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, a] = keys[i], [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
    const k = t1 > t0 ? smooth(0, 1, (t - t0) / (t1 - t0)) : 0; const o = {};
    for (const n in a) o[n] = typeof a[n] === 'number' ? lerp(a[n], b[n], k) : col(a[n]).lerp(col(b[n]), k);
    return o;
  }
  function mergeGeos(geos) {
    const posA = [], norA = [], idx = []; let off = 0;
    for (const g0 of geos) {
      const g = g0.index ? g0 : g0.setIndex([...Array(g0.attributes.position.count).keys()]); const p = g.attributes.position, nn = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { posA.push(p.getX(i), p.getY(i), p.getZ(i)); norA.push(nn.getX(i), nn.getY(i), nn.getZ(i)); }
      for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); off += p.count;
    }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(norA, 3)); m.setIndex(idx); return m;
  }
  const box = (w, h, d, mat, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };

  // колонна с капителью-папирусом (Lathe) + расписная текстура
  const colTex = lib.canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#b8936a'; g.fillRect(0, 0, w, h); const r = rng(5);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${60 + r() * 60},${40 + r() * 30},${20},${r() * 0.12})`; g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6); }
    const band = (y, hh, c) => { g.fillStyle = c; g.fillRect(0, y, w, hh); };
    // капитель (верх текстуры = верх колонны → v=1 сверху в Lathe: v растёт снизу вверх; canvas y=0 — это v=1)
    band(14, 10, '#2c5a6a'); band(28, 6, '#8a2c1c'); band(38, 10, '#2c5a6a'); band(52, 4, '#c9a040');
    for (let x = 0; x < w; x += 16) { g.fillStyle = '#3a6a4a'; g.beginPath(); g.moveTo(x, 110); g.lineTo(x + 8, 60); g.lineTo(x + 16, 110); g.fill(); }
    band(112, 6, '#c9a040'); band(122, 4, '#8a2c1c');
    // столбцы «иероглифов»
    for (let cx = 10; cx < w; cx += 32) for (let y = 140; y < 420; y += 14) {
      g.fillStyle = r() < 0.5 ? 'rgba(60,30,15,0.55)' : 'rgba(40,70,80,0.5)';
      const k = r(); if (k < 0.3) g.fillRect(cx, y, 10, 8); else if (k < 0.6) { g.beginPath(); g.arc(cx + 5, y + 4, 4, 0, 6.3); g.fill(); } else g.fillRect(cx + 3, y, 4, 10);
    }
    band(440, 6, '#8a2c1c'); band(450, 10, '#2c5a6a'); band(466, 4, '#c9a040');
  });
  const colProf = [[0, 0], [1.15, 0], [1.15, 0.35], [0.88, 0.45], [0.82, 8.0], [0.95, 8.4], [1.35, 9.4], [1.5, 9.9], [1.25, 10.05], [1.2, 10.7], [0, 10.7]].map(([x, y]) => new THREE.Vector2(x, y));
  const colGeo = new THREE.LatheGeometry(colProf, 18);
  const colMat = new THREE.MeshStandardMaterial({ map: colTex, roughness: 0.85 });

  // =====================================================================
  // ИНТЕРЬЕР ДВОРЦА
  // =====================================================================
  const gI = new THREE.Group(); scene.add(gI);
  const floorTex = lib.canvasTexture(512, 512, (g, w, h) => {
    const r = rng(9); const n = 4; const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 0.8 + r() * 0.25; g.fillStyle = `rgb(${Math.round(120 * v)},${Math.round(92 * v)},${Math.round(64 * v)})`; g.fillRect(i * s, j * s, s, s); }
    g.strokeStyle = 'rgba(30,18,8,0.7)'; g.lineWidth = 3; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(7, 17);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 70), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.45, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = -10; floor.receiveShadow = true; gI.add(floor);
  const COLZ = [8, 3, -2, -7, -12, -17, -23];
  const cols = new THREE.InstancedMesh(colGeo, colMat, COLZ.length * 4); { const m4 = new THREE.Matrix4(); let n = 0;
    for (const z of COLZ) for (const x of [-5.6, 5.6, -10.5, 10.5]) { const s = Math.abs(x) > 8 ? 1.0 : 1.0; m4.makeScale(s * 0.8, s, s * 0.8).setPosition(x, 0, z); cols.setMatrixAt(n++, m4); } }
  cols.castShadow = true; gI.add(cols);
  const stoneD = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.95 });
  box(1.4, 1.1, 46, stoneD, -5.6, 11.2, -8, gI); box(1.4, 1.1, 46, stoneD, 5.6, 11.2, -8, gI);
  box(30, 0.6, 50, new THREE.MeshStandardMaterial({ color: '#22140c', roughness: 1 }), 0, 12, -8, gI);
  box(1, 14, 50, stoneD, -13.5, 7, -8, gI); box(1, 14, 50, stoneD, 13.5, 7, -8, gI);
  // задняя стена с проёмом — за ним закатное небо (контровой свет)
  const wallTex = lib.canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#6a4a30'; g.fillRect(0, 0, w, h); const r = rng(3);
    for (let i = 0; i < 40; i++) { const x = r() * w, y = 40 + r() * 170; g.fillStyle = `rgba(${r() < 0.5 ? '40,20,10' : '30,60,70'},0.35)`; g.fillRect(x, y, 6 + r() * 14, 20 + r() * 50); }
    g.fillStyle = '#c9a040'; g.fillRect(0, 20, w, 5); g.fillRect(0, h - 25, w, 5);
  });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  box(11.5, 14, 1, wallMat, -8.25, 7, -25, gI); box(11.5, 14, 1, wallMat, 8.25, 7, -25, gI); box(5, 6.5, 1, wallMat, 0, 10.75, -25, gI);
  const doorSky = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), new THREE.ShaderMaterial({ fog: false, uniforms: { k: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float k; varying vec2 vUv; void main(){ vec3 a = vec3(1.0,.55,.26), b = vec3(.32,.14,.16); float y = vUv.y; vec3 c = mix(a, b, smoothstep(.12,.75,y)); c *= .55 + .45*smoothstep(.0,.12,y); c += vec3(1.,.78,.45)*exp(-pow(length((vUv-vec2(.46,.17))*vec2(1.,1.4))*7.,2.))*1.1; c += vec3(.9,.5,.3)*smoothstep(.02,0.,abs(y-.14+.01*sin(vUv.x*40.)))*.25; gl_FragColor = vec4(c*k*.62,1.); }' }));
  doorSky.position.set(0, 4, -27); gI.add(doorSky);
  const doorGlow = lib.glow('#ffb070', 12, 0.28); doorGlow.position.set(0, 3.2, -24); gI.add(doorGlow);
  // помост
  const daisMat = new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.55 });
  box(9, 0.5, 6.5, daisMat, 0, 0.25, -19.2, gI); box(7.6, 0.5, 5.4, daisMat, 0, 0.75, -19.7, gI); box(6.2, 0.5, 4.4, daisMat, 0, 1.25, -20.2, gI);
  const gold = new THREE.MeshStandardMaterial({ color: '#d4a84a', roughness: 0.3, metalness: 0.85, emissive: '#3a2008', emissiveIntensity: 0.4 });
  box(1.5, 0.6, 1.1, gold, 0, 1.8, -21.2, gI); box(1.5, 2.4, 0.2, gold, 0, 2.7, -21.75, gI); box(0.16, 1.0, 1.1, gold, -0.72, 2.0, -21.2, gI); box(0.16, 1.0, 1.1, gold, 0.72, 2.0, -21.2, gI);
  // правитель
  const joseph = lib.figure({ height: 1.86, robe: '#cfc2a8', skin: '#8a5a3c', hood: true, hoodColor: '#c8a450', belt: '#d4a84a', seed: 21 });
  joseph.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 20), gold); collar.rotation.x = Math.PI / 2; collar.position.y = 1.42 * 1.86 / 1.8; collar.scale.set(1, 1, 0.5); joseph.add(collar);
  gI.add(joseph);
  // стражи
  const guards = [-1, 1].map((s) => { const f = lib.figure({ height: 1.9, robe: '#2a1c14', hood: true, hoodColor: '#1c2a30', seed: 30 + s }); f.position.set(s * 3.6, 1.5, -21); const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 5), new THREE.MeshStandardMaterial({ color: '#3a2a1a' })); sp.position.set(s * 0.32, 1.6, 0.15); f.add(sp); gI.add(f); return f; });
  // жаровни
  const braz = [[-3.6, -14.6], [3.6, -14.6], [-3.2, -4], [3.2, -4]];
  const brazFires = [], brazLights = [];
  braz.forEach(([x, z], i) => {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 1.5, 8), gold); st.position.set(x, 0.75, z); gI.add(st);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.25, 0.35, 12), gold); bowl.position.set(x, 1.6, z); gI.add(bowl);
    const f = lib.fire({ count: 150, radius: 0.3, height: 1.2, size: 26, seed: 40 + i, intensity: 0.55 }); f.position.set(x, 1.72, z); gI.add(f); brazFires.push(f);
    const gl = lib.glow('#ff9a48', 3.2, 0.3); gl.position.set(x, 2.3, z); gI.add(gl);
    const L = new THREE.PointLight('#ff9a50', 26, 22, 1.4); L.position.set(x, 2.6, z); gI.add(L); brazLights.push(L);
  });
  // лучи из верхних окон
  const beams = [];
  for (let i = 0; i < 3; i++) { const b = lib.lightBeam({ radiusTop: 0.5, radiusBottom: 2.4, length: 18, color: '#ffc890', opacity: 0.16 }); b.position.set(-12, 11.5, -16 + i * 8); b.rotation.z = -0.62; b.rotation.y = 0.15; gI.add(b); beams.push(b); }
  const dustI = lib.motes({ count: 700, box: [20, 10, 34], center: [0, 5, -8], size: 3, color: '#ffd2a0', speed: 0.12, opacity: 0.45, seed: 8 }); gI.add(dustI);
  const hemiI = new THREE.HemisphereLight('#7a5a40', '#1a0e08', 0.55); gI.add(hemiI);
  const back = new THREE.SpotLight('#ffb070', 220, 0, 0.75, 0.6, 1.3); back.position.set(0, 4.5, -27); back.target.position.set(0, 0, -6); gI.add(back, back.target);
  back.castShadow = true; back.shadow.mapSize.set(1024, 1024); back.shadow.bias = -0.0006; back.shadow.camera.near = 2; back.shadow.camera.far = 60;
  // братья
  const browns = ['#5a4232', '#6a5038', '#4a3a2e', '#5e4a3a', '#7a5a3e', '#4e4038', '#665040', '#544636', '#6e5642', '#4a3428', '#5a5040'];
  const brothers = []; const RB = rng(77);
  for (let i = 0; i < 11; i++) {
    const row = i < 6 ? 0 : 1; const j = row ? i - 6 : i; const n = row ? 5 : 6;
    const x = (j - (n - 1) / 2) * 1.25 + (row ? 0 : 0) + (RB() - 0.5) * 0.25, z = row ? -11.0 + (RB() - 0.5) * 0.3 : -12.6 + (RB() - 0.5) * 0.3;
    const f = lib.figure({ height: 1.72 + RB() * 0.14, robe: browns[i], hood: true, hoodColor: browns[(i + 4) % 11], staff: i % 4 === 1, skin: '#7a5034', seed: 50 + i });
    const w = new THREE.Group(); w.position.set(x, 0, z); w.rotation.y = Math.PI + (RB() - 0.5) * 0.15; w.add(f); gI.add(w);
    brothers.push({ w, f, ph: RB(), x, z, d: RB() * 0.8 });
    f.parts.arms.forEach((a) => (a.rotation.order = 'YXZ'));
  }
  joseph.parts.arms.forEach((a) => (a.rotation.order = 'YXZ'));
  const BEN = brothers[2]; // к нему сходит Иосиф (передний ряд, центр)
  function kneel(b, k, bow) {
    b.f.position.y = -0.42 * k; b.f.rotation.x = (0.15 + 0.5 * bow) * k; b.f.parts.head.position.z = 0.05 * k * bow;
    b.f.parts.arms.forEach((a, s) => { a.rotation.x = -0.9 * k * bow - 0.3 * k; a.rotation.y = (s ? -1 : 1) * 0.15 * k; });
  }

  // =====================================================================
  // НАРУЖИ: терраса над Нилом, долина, пирамиды
  // =====================================================================
  const gX = new THREE.Group(); scene.add(gX);
  const sky = lib.skyDome({ top: '#1c2a4a', horizon: '#e0885a', bottom: '#2a1810', sunDir: [-0.42, 0.035, -1], sunColor: '#ffc078', sunSize: 0.028, sunGlow: 0.9, stars: 0 });
  gX.add(sky);
  const stars = lib.starfield({ count: 4000, radius: 1400, size: 2.2, minY: 0.02, seed: 13 }); stars.u.opacity.value = 0; gX.add(stars);
  const zr = (x) => -120 + Math.sin(x * 0.006) * 28 + Math.sin(x * 0.017) * 8;
  const hX = (x, z) => {
    const d = Math.abs(z - zr(x));
    const river = -3.2 * smooth(30, 18, d);
    const desert = smooth(170, 260, d) * (5 + fbm(x * 0.006, z * 0.006, 4) * 12);
    return -14 + river + fbm(x * 0.03, z * 0.03, 3) * 0.5 + desert;
  };
  const land = lib.terrain({ size: 1600, seg: 150, center: [0, -380], heightFn: hX, roughness: 1,
    colorFn: (x, z, y) => { const d = Math.abs(z - zr(x)); const cell = noise2(Math.floor(x / 14) * 1.7, Math.floor(z / 10) * 1.3);
      return col('#3a5424').lerp(col('#6a7a2c'), clamp(cell * 0.8 + 0.5)).lerp(col('#c9a06a'), smooth(150, 200, d)).lerp(col('#3a2e1c'), smooth(26, 18, d)).multiplyScalar(0.9 + 0.15 * noise2(x * 0.2, z * 0.2)); } });
  gX.add(land);
  const nile = lib.ocean({ size: 1600, seg: 90, deep: '#0a1a22', shallow: '#26404a', sky: '#e08a5a', amp: 0.05, choppy: 0.3, foam: 0, sunDir: [-0.42, 0.035, -1], sunColor: '#ffb070' });
  nile.position.set(0, -15.4, -380); gX.add(nile);
  const pyrM = new THREE.MeshStandardMaterial({ color: '#c8a070', roughness: 0.95, flatShading: true });
  [[-260, -560, 95], [-130, -610, 120], [10, -580, 70]].forEach(([x, z, h]) => { const p = new THREE.Mesh(new THREE.ConeGeometry(h * 0.8, h, 4), pyrM); p.position.set(x, hX(x, z) + h / 2 - 2, z); p.rotation.y = Math.PI / 4 + 0.2; gX.add(p); });
  // дома (глина), огни в окнах
  const RH = rng(19); const NH = 340; const houseG = new THREE.BoxGeometry(1, 1, 1); houseG.translate(0, 0.5, 0);
  const houses = new THREE.InstancedMesh(houseG, new THREE.MeshStandardMaterial({ color: '#c4a47a', roughness: 1 }), NH); houses.castShadow = false;
  const winPos = [], winSeed = []; { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(); let n = 0;
    while (n < NH) {
      const cl = Math.floor(RH() * 9); const cx = -420 + cl * 105 + (RH() - 0.5) * 60; const side = RH() < 0.55 ? 1 : -1;
      const x = cx + (RH() - 0.5) * 50; const z = zr(x) + side * (34 + RH() * 70); if (z > -25 && Math.abs(x) < 30) continue;
      const y = hX(x, z); const w = 3 + RH() * 4, h = 2.2 + RH() * 2.5 * (RH() < 0.3 ? 2 : 1), d = 3 + RH() * 4;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (RH() - 0.5) * 0.4); m4.compose(new THREE.Vector3(x, y - 0.3, z), q, new THREE.Vector3(w, h, d)); houses.setMatrixAt(n, m4);
      c.set('#c4a47a').multiplyScalar(0.7 + RH() * 0.4); houses.setColorAt(n, c);
      if (RH() < 0.75) { winPos.push(x + (RH() - 0.5) * w * 0.6, y + h * 0.45, z + d * 0.52 * (RH() < 0.5 ? 1 : -1)); winSeed.push(RH()); }
      n++;
    } }
  gX.add(houses);
  const winG = new THREE.BufferGeometry(); winG.setAttribute('position', new THREE.Float32BufferAttribute(winPos, 3)); winG.setAttribute('sd', new THREE.Float32BufferAttribute(winSeed, 1));
  const winU = { k: { value: 0 }, time: { value: 0 }, pxr: { value: 1 } };
  const wins = new THREE.Points(winG, new THREE.ShaderMaterial({ uniforms: winU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float sd; uniform float k, time, pxr; varying float vA; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; vA = smoothstep(sd, sd+.08, k)*(.8+.2*sin(time*3.+sd*60.)); gl_PointSize = pxr*clamp(1500./-mv.z, 3., 18.); }',
    fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d); gl_FragColor = vec4(vec3(1.,.62,.28)*a*a*vA*1.4,1.); }' }));
  wins.frustumCulled = false; gX.add(wins);
  // пальмы (инстансы)
  const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(1.4, 0.45, 3.6, 0); leafShape.quadraticCurveTo(1.4, -0.45, 0, 0);
  const crownG = mergeGeos([...Array(9)].map((_, k) => { const lg = new THREE.ShapeGeometry(leafShape, 3); const p = lg.attributes.position; for (let j = 0; j < p.count; j++) { const lx = p.getX(j); p.setZ(j, -lx * lx * 0.09); } lg.rotateX(-Math.PI / 2); lg.rotateZ(-0.2 + (k % 3) * 0.12); lg.rotateY(k / 9 * Math.PI * 2); lg.computeVertexNormals(); return lg; }));
  const trunkG = new THREE.CylinderGeometry(0.16, 0.28, 1, 6); trunkG.translate(0, 0.5, 0);
  const NP = 220; const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 1 }), NP);
  const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: '#3a5222', roughness: 0.9, side: THREE.DoubleSide }), NP);
  { const RP = rng(31), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let n = 0;
    while (n < NP) { const x = -600 + RP() * 1200; const side = RP() < 0.5 ? 1 : -1; const z = zr(x) + side * (22 + RP() * 110); if (z > -15) continue;
      const y = hX(x, z) - 0.2, h = 7 + RP() * 6; e.set((RP() - 0.5) * 0.25, 0, (RP() - 0.5) * 0.25); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, h, 1)); trunks.setMatrixAt(n, m4);
      const top = new THREE.Vector3(0, h, 0).applyQuaternion(q).add(new THREE.Vector3(x, y, z)); e.set(0, RP() * 6.28, 0); q.setFromEuler(e); const s = 0.8 + RP() * 0.4;
      m4.compose(top, q, new THREE.Vector3(s, s, s)); crowns.setMatrixAt(n, m4); n++; } }
  gX.add(trunks, crowns);
  // дворец и терраса
  const sandst = new THREE.MeshStandardMaterial({ color: '#b08a60', roughness: 0.9 });
  const terr = new THREE.Group(); gX.add(terr);
  box(40, 14.6, 30, sandst, 0, -7.3, -6, terr); box(18, 0.5, 12, sandst, 0, -0.25, -1, terr);
  box(18, 1.05, 0.5, sandst, 0, 0.52, -6.6, terr); box(19, 0.18, 0.7, new THREE.MeshStandardMaterial({ color: '#8a6a48' }), 0, 1.1, -6.6, terr);
  [[-7.5, -5.4], [8.2, -5.4]].forEach(([x, z]) => { const c = new THREE.Mesh(colGeo, colMat); c.scale.set(0.62, 0.78, 0.62); c.position.set(x, 0, z); terr.add(c); });
  box(19, 1.0, 1.4, sandst, 0.35, 8.8, -5.4, terr);
  // пилоны дворца внизу (силуэты с общего плана)
  [[-14, -18], [14, -18]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 22, 4), sandst); p.rotation.y = Math.PI / 4; p.position.set(x, -3, z); p.scale.set(1, 1, 0.5); terr.add(p); });
  const j2 = lib.figure({ height: 1.86, robe: '#ece2cc', skin: '#8a5a3c', hood: true, hoodColor: '#d8b45a', belt: '#d4a84a', seed: 22 });
  j2.position.set(3.3, 0, -5.6); j2.rotation.y = Math.PI + 0.25; terr.add(j2);
  const bro2 = lib.figure({ height: 1.78, robe: '#5a4232', hood: true, hoodColor: '#4a3a2e', seed: 23 }); bro2.position.set(4.25, 0, -5.4); bro2.rotation.y = Math.PI - 0.2; terr.add(bro2);
  j2.parts.arms[1].rotation.x = -0.25; j2.parts.arms[1].rotation.z = 0.5;
  const sunX = new THREE.DirectionalLight('#ffb070', 2.2); sunX.position.set(-200, 25, -480); gX.add(sunX);
  const hemiX = new THREE.HemisphereLight('#6a7aa8', '#3a2418', 0.6); gX.add(hemiX);
  const birds = new THREE.Group(); { const bm = new THREE.MeshBasicMaterial({ color: '#1a100c', side: THREE.DoubleSide }); for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.8, 0.25, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.8, 0.25, 0), new THREE.Vector3(0, 0.08, 0.25)]).setIndex([0, 1, 3, 1, 2, 3]), bm); b.position.set(i * 3 - 8 + (i % 2) * 1.5, (i % 3) * 1.1, -i * 2.2); birds.add(b); } }
  gX.add(birds);
  const dustX = lib.motes({ count: 260, box: [24, 10, 20], center: [0, 3, -8], size: 3, color: '#ffd0a0', speed: 0.15, opacity: 0.35, seed: 4 }); gX.add(dustX);

  // образы экстерьера
  const LQ = { top: '#1a2848', hor: '#d87a4e', bot: '#2a1810', fog: '#8a5a48', fogD: 0.0019, sunY: 0.03, glow: 1.15, sun: 2.0, hemi: 0.6, stars: 0, exp: 0.88, win: 0.15 };
  const LS0 = { ...LQ, hor: '#c86a48', sunY: 0.012, exp: 0.86, win: 0.35, fogD: 0.0016 };
  const LS1 = { top: '#060a1a', hor: '#3a2a3a', bot: '#0a0806', fog: '#1e1a26', fogD: 0.0014, sunY: -0.06, glow: 0.15, sun: 0.15, hemi: 0.3, stars: 1.0, exp: 0.8, win: 1.1 };
  const looksX = [[C.good, LQ], [C.stay - 0.01, LQ], [C.stay, LS0], [C.stay + 1.0, LS0], [meta.dur, LS1]];

  return {
    scene, camera,
    update(t, S) {
      const inside = t < C.good; gI.visible = inside; gX.visible = !inside;
      S.post.bloom = 0.7; S.post.bloomThreshold = 0.72; S.post.bloomRadius = 0.6;
      if (inside) {
        scene.fog.color.set('#2a160c'); scene.fog.density = 0.03;
        S.post.exposure = 0.82; S.post.tint = [1.04, 0.97, 0.88]; S.post.vignette = 0.5; S.post.contrast = 1.08; S.post.bloomThreshold = 0.82; S.post.bloom = 0.55;
        brazLights.forEach((L, i) => (L.intensity = 26 * (0.86 + 0.09 * Math.sin(t * 9 + i * 2) + 0.05 * Math.sin(t * 21 + i))));
        beams.forEach((b, i) => (b.u.opacity.value = 0.14 + 0.03 * Math.sin(t * 0.5 + i)));
        // братья кланяются; Иосиф стоит на помосте → сходит → объятие
        const embr = t >= C.embrace;
        brothers.forEach((b) => {
          let k = ramp(t, 1.4 + b.d, 1.6), bow = 0.6 + 0.4 * ramp(t, 2.0 + b.d, 1.8);
          if (b === BEN) { const up = ramp(t, C.embrace + 0.4, 1.1); k *= 1 - up; }
          else if (embr) bow *= 1 - 0.45 * ramp(t, C.embrace + 2.2, 2.0); // остальные поднимают головы
          kneel(b, k, bow);
          b.f.parts.body.rotation.z = Math.sin(t * 0.8 + b.ph * 6) * 0.01;
        });
        const jw = ramp(t, C.embrace - 3.4, 4.4); // путь вниз по ступеням
        const jz = lerp(-19.8, BEN.z - 0.62, jw); const jy = jz < -17.5 ? 1.5 : jz < -16.5 ? 1.0 : jz < -15.6 ? 0.5 : 0;
        const jyS = lerp(1.5, 0, smooth(-19.8, -15.5, jz) * 0) || jy; // ступени
        joseph.position.set(lerp(0, BEN.x, jw), lerp(1.5, 0, smooth(-17.9, -15.4, jz)), jz); joseph.rotation.y = 0;
        const walking = jw > 0.01 && jw < 0.99;
        if (walking) lib.walkPose(joseph, t * 0.9, 0.8); else { joseph.parts.body.rotation.z = 0; joseph.parts.body.position.y = 0; }
        const hug = ramp(t, C.embrace + 1.6, 0.9);
        if (hug > 0) {
          BEN.w.position.z = BEN.z - 0.08 * hug;
          joseph.parts.arms.forEach((a, s) => { a.rotation.x = lerp(a.rotation.x, -1.25, hug); a.rotation.y = (s ? -1 : 1) * 0.55 * hug; a.rotation.z = (s ? 1 : -1) * 0.12; });
          BEN.f.parts.arms.forEach((a, s) => { a.rotation.x = -1.15 * hug; a.rotation.y = (s ? -1 : 1) * 0.6 * hug; });
          const sob = Math.sin(t * 5.2) * 0.012 * hug;
          joseph.parts.body.rotation.x = 0.06 * hug + sob; joseph.parts.head.position.z = 0.06 * hug; BEN.f.rotation.x = 0.05 * hug;
          joseph.position.y = 0;
        } else { joseph.parts.head.position.z = 0; }
        guards.forEach((g, i) => (g.parts.body.rotation.z = Math.sin(t * 0.6 + i) * 0.01));
        if (t < C.embrace) {
          // с пола за спинами братьев — медленный наезд к помосту
          cameraPath(camera, [[0, [2.2, 2.3, 1.5], [0, 1.6, -20]], [C.embrace, [1.0, 2.0, -4.8], [0, 1.9, -20]]], t);
          S.quote.y = 0.5;
        } else {
          // объятие: средний план сбоку, мягкий наезд
          const cx = BEN.x;
          cameraPath(camera, [[C.embrace, [cx + 4.6, 1.6, -10.2], [cx - 0.2, 1.45, -13.6]], [C.embrace + 2.0, [cx + 4.1, 1.58, -10.6], [cx - 0.1, 1.45, -13.4]], [C.good, [cx + 3.2, 1.55, -11.3], [cx, 1.5, -13.1]]], t);
        }
        handheld(camera, t, 0.004);
      } else {
        const Lk = look(looksX, t);
        sky.u.top.value.copy(Lk.top); sky.u.horizon.value.copy(Lk.hor); sky.u.bottom.value.copy(Lk.bot);
        const sxd = t < C.stay ? 0.56 : -0.3; sky.u.sunDir.value.set(sxd, Lk.sunY, -1).normalize(); sunX.position.set(sxd * 480, 25, -480); sky.u.sunGlow.value = Lk.glow; sky.u.starAmt.value = Lk.stars * 0.6; stars.u.opacity.value = Lk.stars;
        scene.fog.color.copy(Lk.fog); scene.fog.density = Lk.fogD;
        nile.u.skyc.value.copy(Lk.hor).multiplyScalar(0.7); nile.u.sunDir.value.copy(sky.u.sunDir.value); nile.u.fogColor.value.copy(Lk.fog); nile.u.fogDensity.value = Lk.fogD;
        nile.u.sunColor.value.set('#ffb070').multiplyScalar(Lk.glow);
        sunX.intensity = Lk.sun; hemiX.intensity = Lk.hemi; winU.k.value = Lk.win;
        S.post.exposure = Lk.exp; S.post.tint = [1.03, 0.97, 0.92]; S.post.vignette = 0.42;
        birds.position.set(-40 + (t - C.good) * 3.2, 18 + Math.sin(t * 0.4) * 1.5, -70); birds.children.forEach((b, i) => (b.scale.y = 0.6 + 0.4 * Math.sin(t * 7 + i)));
        if (t < C.stay) {
          S.quote.y = 0.4; terr.visible = true;
          cameraPath(camera, [[C.good, [0.2, 2.6, 7.5], [-3, -1.5, -80]], [C.stay, [1.0, 2.4, 4.8], [-4, -1.2, -80]]], t);
          j2.parts.arms[1].rotation.z = 0.5 + 0.05 * Math.sin(t * 0.7);
        } else {
          S.fadeOut = 1.6;
          const k = (t - C.stay) / (meta.dur - C.stay);
          cameraPath(camera, [[C.stay, [22, 14, 34], [-30, -14, -180]], [meta.dur, [55, 52, 150], [-40, -20, -260]]], t);
          birds.visible = k < 0.5; terr.visible = false;
        }
        handheld(camera, t, 0.003);
      }
    },
  };
}
