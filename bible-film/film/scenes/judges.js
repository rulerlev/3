// Судьи: Иерихон (трубы, стены рушатся) → круг из пяти камней (Грех · Враг · Вопль · Избавитель · Мир),
// свет обходит круг точно по словам → силуэты Гедеона, Деворы, Самсона на закате → беззаконные сумерки.
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, ease, easeIn, cameraPath, handheld, rng, fbm, noise2 } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#c89a6a', 0.0025);
  const C = meta.cues;
  const T_A2 = 4.1, T_HORN = 4.25, T_COL = 5.35;

  const sky = lib.skyDome({ top: '#3a5a80', horizon: '#f0b070', bottom: '#5a4030', sunDir: [-1, 0.12, -0.4], sunColor: '#ffd6a0', sunSize: 0.03, sunGlow: 1.0, stars: 0 });
  scene.add(sky);
  const hemi = new THREE.HemisphereLight('#9ab4d8', '#4a3424', 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffcf98', 2.2); sun.position.set(-300, 80, -120); scene.add(sun);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), eul = new THREE.Euler();
  const colA = new THREE.Color();

  const pplGeo = new THREE.LatheGeometry([[0, 0], [.34, 0], [.3, .5], [.22, 1.05], [.25, 1.3], [.12, 1.44], [.11, 1.52], [.12, 1.62], [.08, 1.72], [0, 1.76]].map(([x, y]) => new THREE.Vector2(x, y)), 7);

  function mkPalm(h = 7, seed = 1, dark = false) {
    const r = rng(seed); const g = new THREE.Group();
    const lean = (r() - .5) * 1.4; const pts = []; for (let i = 0; i <= 6; i++) { const k = i / 6; pts.push(new THREE.Vector3(lean * k * k, h * k, lean * 0.3 * k * k)); }
    const trunkMat = new THREE.MeshStandardMaterial({ color: dark ? '#0c0806' : '#5a4430', roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: dark ? '#080604' : '#3d5a2a', roughness: 0.9, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.22 * h / 7, 6), trunkMat));
    const top = pts[6];
    for (let i = 0; i < 10; i++) {
      const L = (2.6 + r() * 1.2) * h / 7; const geo = new THREE.PlaneGeometry(0.7 * h / 7, L, 1, 6); const p = geo.attributes.position;
      for (let v = 0; v < p.count; v++) { const y = p.getY(v) + L / 2; const k = y / L; p.setX(v, p.getX(v) * Math.sin(k * Math.PI) * 1.2); p.setY(v, y); p.setZ(v, -k * k * L * 0.55); }
      geo.computeVertexNormals();
      const leaf = new THREE.Mesh(geo, leafMat); leaf.position.copy(top); leaf.rotation.order = 'YXZ'; leaf.rotation.y = i / 10 * Math.PI * 2 + r() * 0.3; leaf.rotation.x = -0.5 - r() * 0.5; g.add(leaf);
    }
    return g;
  }

  // ================= A: Иерихон =================
  const gA = new THREE.Group(); scene.add(gA);
  const plainH = (x, z) => fbm(x * 0.006, z * 0.006, 4) * 6 + Math.max(0, 1 - Math.hypot(x, z) / 60) * 4;
  gA.add(lib.terrain({ size: 900, seg: 110, heightFn: plainH, colorFn: (x, z, y, sl) => new THREE.Color('#b08a5a').lerp(new THREE.Color('#6a6a38'), clamp(noise2(x * 0.02, z * 0.02) * 0.8 + 0.2)).multiplyScalar(0.9 + 0.15 * noise2(x * 0.3, z * 0.3)) }));
  const WR = 36, NSEG = 44, WH = 9.5;
  const blockGeo = new THREE.BoxGeometry(1, 1, 1); blockGeo.translate(0, 0.5, 0);
  const blocks = []; const NB = NSEG * 2;
  const wall = new THREE.InstancedMesh(blockGeo, new THREE.MeshStandardMaterial({ color: '#c2a074', roughness: 1 }), NB + 8 * 3);
  {
    const r = rng(12);
    for (let i = 0; i < NSEG; i++) for (let j = 0; j < 2; j++) {
      const a = (i + 0.5) / NSEG * Math.PI * 2; const x = Math.cos(a) * WR, z = Math.sin(a) * WR;
      const h = WH / 2 + (j ? (r() - .5) * 0.6 : 0);
      blocks.push({ a, x, z, y: plainH(x, z) - 0.5 + j * WH / 2, sx: 2 * Math.PI * WR / NSEG * 1.02, sy: h, sz: j ? 2.2 : 2.6, j, r1: r(), r2: r(), r3: r(), tower: false });
      wall.setColorAt(blocks.length - 1, new THREE.Color('#c2a074').multiplyScalar(0.8 + r() * 0.3));
    }
    for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) {
      const a = i / 8 * Math.PI * 2 + 0.2; const x = Math.cos(a) * WR, z = Math.sin(a) * WR;
      blocks.push({ a, x, z, y: plainH(x, z) - 0.5 + j * 4.6, sx: 5.4, sy: 4.6 + (j === 2 ? 0.6 : 0), sz: 5.4, j: j + 0.5, r1: r(), r2: r(), r3: r(), tower: true });
      wall.setColorAt(blocks.length - 1, new THREE.Color('#b8966a').multiplyScalar(0.85 + r() * 0.2));
    }
    // порядок обрушения: сначала сторона к камере, потом по кругу
    blocks.forEach((b) => { const da = Math.abs(Math.atan2(Math.sin(b.a - 0.55), Math.cos(b.a - 0.55))); b.tc = T_COL + da * 0.35 + b.r1 * 0.25 + (b.j > 0.9 ? -0.1 : 0.1); });
  }
  gA.add(wall);
  // дома внутри
  const houses = new THREE.InstancedMesh(blockGeo, new THREE.MeshStandardMaterial({ color: '#b89a72', roughness: 1 }), 150);
  { const r = rng(4); for (let i = 0; i < 150; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (WR - 5); const x = Math.cos(a) * d, z = Math.sin(a) * d; const w = 3 + r() * 4;
    tmpM.compose(tmpP.set(x, plainH(x, z) - 0.3, z), tmpQ.setFromEuler(eul.set(0, r() * 0.4, 0)), tmpS.set(w, 2.5 + r() * 3.5, w * (0.7 + r() * 0.6))); houses.setMatrixAt(i, tmpM);
    houses.setColorAt(i, new THREE.Color('#c4a47a').multiplyScalar(0.75 + r() * 0.35)); } }
  gA.add(houses);
  { const r = rng(8); for (let i = 0; i < 16; i++) { const a = r() * Math.PI * 2, d = 62 + r() * 60; const p = mkPalm(6 + r() * 4, 30 + i); const x = Math.cos(a) * d, z = Math.sin(a) * d; p.position.set(x, plainH(x, z) - 0.2, z); gA.add(p); } }
  // священники с трубами + ковчег + народ
  const PR = 49; const priests = [];
  const hornMat = new THREE.MeshStandardMaterial({ color: '#e8d4a8', roughness: 0.5 });
  for (let i = 0; i < 7; i++) {
    const f = lib.figure({ height: 1.8, robe: '#e6dccb', hoodColor: '#d8ccb4', skin: '#8a5a3c', seed: 50 + i, belt: '#7a4a7a' });
    const horn = new THREE.Group();
    const tor = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 14, Math.PI * 0.9), hornMat); horn.add(tor);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 8, 1, true), hornMat); bell.position.set(-0.22, 0.05, 0); bell.rotation.z = 0.2; horn.add(bell);
    horn.position.set(0.05, 1.62, 0.32); horn.rotation.set(0, Math.PI / 2, 0.6); horn.scale.setScalar(1.3); f.add(horn); f.userData.horn = horn;
    gA.add(f); priests.push(f);
  }
  const ark = new THREE.Group();
  { const gold = new THREE.MeshStandardMaterial({ color: '#d8a640', metalness: 0.9, roughness: 0.3, emissive: '#3a2400' });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.8), gold); box.position.y = 1.55; ark.add(box);
    [-1, 1].forEach((s) => { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.6, 6), gold); pole.rotation.z = Math.PI / 2; pole.position.set(0, 1.25, s * 0.45); ark.add(pole);
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 4), gold); wing.position.set(s * 0.4, 2.15, 0); wing.rotation.z = -s * 0.6; ark.add(wing); });
    [[-1.4, -0.45], [-1.4, 0.45], [1.4, -0.45], [1.4, 0.45]].forEach(([x, z], i) => { const f = lib.figure({ height: 1.75, robe: '#e0d6c4', seed: 70 + i }); f.position.set(x, 0, z); f.rotation.y = Math.PI / 2; f.parts.arms.forEach((a) => (a.rotation.x = -0.9)); ark.add(f); });
  }
  gA.add(ark);
  const NA = 160; const army = new THREE.InstancedMesh(pplGeo, new THREE.MeshStandardMaterial({ color: '#5a4430', roughness: 1 }), NA);
  const armyD = []; { const r = rng(21); for (let i = 0; i < NA; i++) { armyD.push([r(), r(), r()]); army.setColorAt(i, new THREE.Color().setHSL(0.07 + r() * 0.04, 0.25, 0.2 + r() * 0.2)); } }
  gA.add(army);
  // пыль обрушения
  const dustTex = [lib.cloudTexture(91), lib.cloudTexture(92), lib.cloudTexture(93)];
  const dusts = []; { const r = rng(5); for (let i = 0; i < 42; i++) { const a = (i + r()) / 42 * Math.PI * 2; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex[i % 3], color: '#c8a87e', transparent: true, depthWrite: false, opacity: 0 }));
    const da = Math.abs(Math.atan2(Math.sin(a - 0.55), Math.cos(a - 0.55))); sp.userData = { a, tc: T_COL + da * 0.35 + 0.2 + r() * 0.3, s: 14 + r() * 10, r: r() }; gA.add(sp); dusts.push(sp); } }
  const dustMotes = lib.motes({ count: 900, box: [110, 25, 110], center: [0, 8, 0], size: 10, color: '#e0c49a', speed: 0.6, opacity: 0 }); gA.add(dustMotes);

  // ================= B: круг из пяти камней =================
  const gB = new THREE.Group(); scene.add(gB);
  gB.add(lib.terrain({ size: 500, seg: 100, heightFn: (x, z) => fbm(x * 0.01, z * 0.01, 4) * 8 * clamp((Math.hypot(x, z) - 14) / 40) - 0.1 + fbm(x * 0.2, z * 0.2, 2) * 0.12, colorFn: (x, z, y, sl) => new THREE.Color('#2a2a24').lerp(new THREE.Color('#14140f'), clamp(sl * 2 + noise2(x * 0.1, z * 0.1) * 0.4)) }));
  const SR = 8.5; const WORDS = ['Грех', 'Враг', 'Вопль', 'Избавитель', 'Мир'];
  const SCOL = ['#e04a32', '#ff6a20', '#7aa6ff', '#ffd27a', '#b8f0d0'].map((c) => new THREE.Color(c));
  const stones = [];
  const stoneAng = (i) => Math.PI / 2 - i / 5 * Math.PI * 2; // по часовой, если смотреть сверху
  for (let i = 0; i < 5; i++) {
    const geo = new THREE.BoxGeometry(1.9, 4.6, 0.8, 4, 8, 2); const p = geo.attributes.position; const r = rng(200 + i);
    for (let v = 0; v < p.count; v++) { const x = p.getX(v), y = p.getY(v), z = p.getZ(v); const n = noise2(x * 1.3 + i * 10, y * 1.1) * 0.12;
      const taper = 1 - Math.max(0, y - 1) * 0.08; p.setXYZ(v, x * taper + n, y + (y > 2.2 ? noise2(x * 2 + i, 3) * 0.35 : 0), z * taper + noise2(y * 1.5, x + i) * 0.06); }
    geo.translate(0, 2.2, 0); geo.computeVertexNormals();
    const st = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#6a665c', roughness: 0.95, flatShading: true }));
    const a = stoneAng(i); const grp = new THREE.Group(); grp.position.set(Math.cos(a) * SR, -0.2, Math.sin(a) * SR); grp.lookAt(0, -0.2, 0); grp.rotation.z = (r() - .5) * 0.08; grp.add(st);
    const px = WORDS[i].length > 6 ? 120 : 170;
    const mkTxt = (back) => { const tp = lib.textPlane([WORDS[i]], { width: 1.7, height: 0.6, px, color: '#ffffff', font: 'GaramondSC' }); tp.material.color.setScalar(0.05); tp.material.fog = false; tp.position.set(0, 2.9, back ? -0.43 : 0.43); if (back) tp.rotation.y = Math.PI; grp.add(tp); return tp; };
    const front = mkTxt(false), back = mkTxt(true);
    const halo = lib.glow(SCOL[i], 7, 0); halo.position.set(0, 2.6, 0.9); grp.add(halo);
    const light = new THREE.PointLight(SCOL[i], 0, 18, 1.6); light.position.set(0, 3, 2.2); grp.add(light);
    gB.add(grp); stones.push({ grp, st, front, back, halo, light, a });
  }
  // светящийся след на земле по кругу
  const ringU = { orb: { value: 0 }, amt: { value: 0 }, color: { value: new THREE.Color('#ffd27a') } };
  const ring = new THREE.Mesh(new THREE.RingGeometry(SR - 0.25, SR + 0.25, 160, 1), new THREE.ShaderMaterial({
    uniforms: ringU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float orb, amt; uniform vec3 color; varying vec2 vP;
      void main(){ float a = atan(-vP.y, vP.x); float d = mod(a - orb + 6.2831853*4., 6.2831853); // позади шара
        float r = length(vP); float edge = 1. - abs(r - ${SR.toFixed(1)})/.25;
        float trail = exp(-d*1.1) + .12; gl_FragColor = vec4(color*edge*edge*trail*amt, 1.); }`,
  }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; gB.add(ring);
  const orb = lib.glow('#ffe2b0', 3.2, 1); gB.add(orb);
  const orbCore = lib.glow('#ffffff', 1.0, 1); gB.add(orbCore);
  const orbLight = new THREE.PointLight('#ffd8a0', 0, 30, 1.4); gB.add(orbLight);
  const starsB = lib.starfield({ count: 4000, radius: 1400, size: 2.2, minY: 0.03 }); gB.add(starsB);
  const mistB = lib.motes({ count: 700, box: [60, 6, 60], center: [0, 1.5, 0], size: 10, color: '#8a9ab8', speed: 0.2, opacity: 0.25 }); gB.add(mistB);
  // ключевые моменты: индекс камня (непрерывный) по времени — точно по словам
  const LOOPK = [[C.loop, 5], [14.2, 6], [15.34, 7], [17.34, 8], [19.38, 9], [20.11, 10]];
  const orbIdx = (t, lead = 0.65) => {
    if (t < C.loop) { // круг-демонстрация: от «круг» до первой реплики цикла
      const k = ease(clamp((t - 8.4) / (C.loop - 8.4))); return k * 5;
    }
    for (let i = LOOPK.length - 1; i >= 0; i--) if (t >= LOOPK[i][0] - lead && i > 0) {
      const [t1, k1] = LOOPK[i], [, k0] = LOOPK[i - 1]; const p = ease(clamp((t - (t1 - lead)) / lead)); return k0 + (k1 - k0) * p + (i === LOOPK.length - 1 ? Math.max(0, t - t1) * 0.12 : 0);
    }
    return 5;
  };

  // ================= C: Гедеон, Девора, Самсон — закат =================
  const gC = new THREE.Group(); scene.add(gC);
  const ridgeH = (x, z) => -Math.max(0, -z - 2) * 0.35 - Math.max(0, z - 4) * 0.08 + fbm(x * 0.05, z * 0.05, 3) * 0.6 - Math.abs(x) * 0.012 + 0.0;
  gC.add(lib.terrain({ size: 260, seg: 110, center: [0, -40], heightFn: ridgeH, color: '#120c09' }));
  const valH = (x, z) => -26 + fbm(x * 0.008, z * 0.008, 4) * 14;
  gC.add(lib.terrain({ size: 1400, seg: 90, center: [0, -600], heightFn: valH, colorFn: (x, z, y) => new THREE.Color('#2a1a14').multiplyScalar(0.7 + 0.3 * noise2(x * 0.02, z * 0.02)) }));
  const silh = (o) => lib.figure({ robe: '#0d0907', skin: '#0d0907', hoodColor: '#0d0907', belt: '#0d0907', ...o });
  const gideon = silh({ height: 1.8, seed: 91 }); gideon.position.set(-7.5, ridgeH(-7.5, 0), 0); gideon.rotation.y = 0.4; gC.add(gideon);
  gideon.parts.arms[1].rotation.set(-2.7, 0, 0.2); gideon.parts.arms[0].rotation.set(-0.7, 0, -0.3);
  const torch = lib.fire({ count: 160, radius: 0.12, height: 0.9, size: 9, intensity: 1.0, seed: 3 }); torch.position.set(0.05, -0.75, 0); gideon.parts.arms[1].add(torch);
  const jar = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshStandardMaterial({ color: '#100a07' })); jar.scale.y = 1.2; jar.position.set(0, -0.72, 0); gideon.parts.arms[0].add(jar);
  const torchGlow = lib.glow('#ff9a40', 3, 0.7); gC.add(torchGlow);
  const deborah = silh({ height: 1.7, seed: 92, staff: true }); deborah.position.set(-0.6, ridgeH(0, 0.5), 0.5); deborah.rotation.y = -0.2; gC.add(deborah);
  const palm = mkPalm(7.5, 77, true); palm.position.set(0.5, ridgeH(0.5, -0.5) - 0.1, -0.5); palm.rotation.y = 1; gC.add(palm);
  const samson = silh({ height: 2.05, seed: 93, hood: false }); samson.position.set(7.5, ridgeH(7.5, 0), 0); gC.add(samson);
  samson.parts.arms[0].rotation.set(0, 0, -1.45); samson.parts.arms[1].rotation.set(0, 0, 1.45);
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#120c09', roughness: 1 });
  const pillars = [-1, 1].map((s) => { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 5.2, 12), pillarMat); c.position.y = 2.6; g.add(c);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.3, 0.95), pillarMat); cap.position.y = 5.3; g.add(cap); g.position.set(7.5 + s * 1.15, ridgeH(7.5, 0) - 0.1, 0); gC.add(g); return g; });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, 1.1), pillarMat); gC.add(lintel);
  const nameGlows = [[-7.5, '#ff9a50'], [0.2, '#ffb070'], [7.5, '#ff8a50']].map(([x, c]) => { const g = lib.glow(c, 9, 0); g.position.set(x, 2.2, -4); gC.add(g); return g; });
  const dustC = []; { const r = rng(15); for (let i = 0; i < 10; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex[i % 3], color: '#6a4a38', transparent: true, depthWrite: false, opacity: 0 })); sp.userData = { x: 7.5 + (r() - .5) * 4, r: r() }; gC.add(sp); dustC.push(sp); } }
  // беззаконные сумерки: костры по равнине
  const fires = []; { const r = rng(44); for (let i = 0; i < 9; i++) { const x = (r() - .5) * 500, z = -120 - r() * 450; const f = lib.fire({ count: 80, radius: 1.5, height: 6, size: 40, intensity: 0.9, seed: 100 + i }); f.position.set(x, valH(x, z), z); gC.add(f);
    const g = lib.glow('#ff7a30', 28, 0.35); g.position.set(x, valH(x, z) + 3, z); gC.add(g); fires.push(f, g); } }
  const smokeC = lib.cloudLayer({ count: 12, area: [700, 300], y: 10, scale: [200, 60], seed: 66, color: '#3a2420', opacity: 0.5, center: [0, -350] }); gC.add(smokeC);

  return {
    scene, camera,
    update(t, S) {
      const shot = t < C.cycle ? 0 : t < C.names ? 1 : 2;
      gA.visible = shot === 0; gB.visible = shot === 1; gC.visible = shot === 2;
      if (shot === 0) {
        sky.u.top.value.set('#4a6a90'); sky.u.horizon.value.set('#f2b878'); sky.u.bottom.value.set('#6a4a32'); sky.u.sunDir.value.set(-1, 0.1, -0.5).normalize(); sky.u.sunGlow.value = 1.0; sky.u.starAmt.value = 0;
        scene.fog.color.set('#d8a878'); scene.fog.density = 0.0022;
        hemi.color.set('#9ab4d8'); hemi.groundColor.set('#4a3424'); hemi.intensity = 0.7; sun.color.set('#ffcf98'); sun.intensity = 2.4; sun.position.set(-300, 70, -150);
        // процессия
        const walkA = t < T_HORN ? t : T_HORN + (t - T_HORN) * 0.15;
        priests.forEach((f, i) => { const a = 0.95 - i * 0.075 + walkA * 0.022; f.position.set(Math.cos(a) * PR, 0, Math.sin(a) * PR); f.position.y = plainH(f.position.x, f.position.z);
          const face = t < T_HORN ? -a + Math.PI : -a + Math.PI / 2 + Math.PI; f.rotation.y = lerp(-a + Math.PI, Math.atan2(-f.position.x, -f.position.z), ramp(t, T_HORN - 0.3, 0.6));
          lib.walkPose(f, walkA * 0.9 + i * 0.3, 1 - ramp(t, T_HORN - 0.3, 0.4));
          const up = ramp(t, T_HORN - 0.2, 0.5) * (0.6 + 0.4 * Math.sin(t * 2 + i)); f.parts.arms[1].rotation.x = lerp(-0.6, -1.6, up); f.parts.arms[0].rotation.x = lerp(f.parts.arms[0].rotation.x, -1.3, up);
          f.userData.horn.rotation.z = 0.6 + up * 0.6; });
        { const a = 0.95 - 8 * 0.075 + walkA * 0.022; ark.position.set(Math.cos(a) * PR, plainH(Math.cos(a) * PR, Math.sin(a) * PR) + Math.abs(Math.sin(walkA * 6)) * 0.04, Math.sin(a) * PR); ark.rotation.y = -a; }
        for (let i = 0; i < NA; i++) { const [r1, r2, r3] = armyD[i]; const a = 0.95 - 9 * 0.075 - r1 * 1.6 + walkA * 0.022; const rr = PR + (r2 - .5) * 6; const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
          tmpP.set(x, plainH(x, z) + Math.abs(Math.sin(walkA * 5 + r3 * 9)) * 0.05 * (t < T_HORN ? 1 : 0), z); tmpQ.setFromEuler(eul.set(0, -a + Math.PI, 0)); tmpS.setScalar(1.0 + r3 * 0.15); army.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS)); }
        army.instanceMatrix.needsUpdate = true;
        // стены: дрожь → обрушение
        const quake = ramp(t, T_COL - 0.5, 0.4);
        blocks.forEach((b, i) => {
          const k = easeIn(clamp((t - b.tc) / (1.3 + b.r2 * 0.6))); const out = 2.5 + b.r3 * 6 + (b.tower ? 2 : 0);
          const jit = quake * (1 - k) * 0.06 * Math.sin(t * 40 + i);
          const cx = Math.cos(b.a), cz = Math.sin(b.a);
          tmpP.set(b.x + cx * (out * k + jit), lerp(b.y, plainH(b.x, b.z) - 0.6 - b.r1 * 0.8, k) , b.z + cz * (out * k));
          eul.set(0, -b.a + Math.PI / 2, 0, 'YXZ'); tmpQ.setFromEuler(eul);
          const tilt = new THREE.Quaternion().setFromAxisAngle(tmpS.set(1, 0, 0), k * (1.0 + b.r1 * 0.9) * (b.r2 > 0.3 ? 1 : -1));
          tmpQ.multiply(tilt);
          const sq = 1 - k * 0.35; tmpS.set(b.sx * (1 - k * 0.15), b.sy * sq, b.sz);
          wall.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
        });
        wall.instanceMatrix.needsUpdate = true;
        dusts.forEach((sp) => { const d = sp.userData; const k = clamp((t - d.tc) / 3.5); const e = 1 - Math.pow(1 - k, 2);
          sp.position.set(Math.cos(d.a) * (WR + 3 + e * 8), 3 + e * 8, Math.sin(d.a) * (WR + 3 + e * 8)); const s = d.s * (0.3 + e * 1.3); sp.scale.set(s, s * 0.75, 1);
          sp.material.opacity = (t > d.tc ? ramp(t, d.tc, 0.25) : 0) * (1 - k * 0.4) * 0.95; sp.material.rotation = d.r * 6 + e * 0.4; });
        dustMotes.u.opacity.value = ramp(t, T_COL + 0.3, 1.5) * 0.5;
        S.post.exposure = 1.0; S.post.bloom = 0.45; S.post.bloomThreshold = 0.85; S.post.sat = 1.05;
        if (t < T_A2) cameraPath(camera, [[0, [150, 70, 150], [0, 4, 0]], [T_A2, [118, 48, 150], [0, 4, 0]]], t);
        else cameraPath(camera, [[T_A2, [Math.cos(0.62) * 72, 2.6, Math.sin(0.62) * 72], [Math.cos(0.5) * 36, 6.5, Math.sin(0.5) * 36]], [C.cycle, [Math.cos(0.66) * 80, 4.6, Math.sin(0.66) * 80], [Math.cos(0.5) * 36, 5, Math.sin(0.5) * 36]]], t);
        const shake = ramp(t, T_COL, 0.2) * (1 - ramp(t, T_COL + 1.2, 1.2));
        handheld(camera, t * (1 + shake * 8), 0.004 + shake * 0.025);
      } else if (shot === 1) {
        sky.u.top.value.set('#03050c'); sky.u.horizon.value.set('#1a1e2c'); sky.u.bottom.value.set('#050506'); sky.u.sunGlow.value = 0; sky.u.starAmt.value = 0.6;
        scene.fog.color.set('#0c0e14'); scene.fog.density = 0.012;
        hemi.color.set('#5a6a90'); hemi.groundColor.set('#0a0a08'); hemi.intensity = 0.35; sun.intensity = 0.25; sun.color.set('#8aa0d0'); sun.position.set(100, 200, -200);
        const idx = orbIdx(t); const theta = stoneAng(0) - idx / 5 * Math.PI * 2;
        const ci = ((Math.round(idx) % 5) + 5) % 5; const frac = idx - Math.floor(idx);
        const oc = colA.copy(SCOL[Math.floor(idx) % 5]).lerp(SCOL[(Math.floor(idx) + 1) % 5], frac);
        const appear = ramp(t, C.cycle + 0.3, 1.0);
        const orbR = SR - 1.6, orbY = 2.7 + Math.sin(t * 2.2) * 0.12;
        orb.position.set(Math.cos(theta) * orbR, orbY, Math.sin(theta) * orbR); orbCore.position.copy(orb.position); orbLight.position.copy(orb.position);
        orb.material.color.copy(oc); orb.material.opacity = appear * 0.9; orbCore.material.opacity = appear * 0.8; orbLight.color.copy(oc); orbLight.intensity = appear * 30;
        orb.scale.setScalar(3.2 * (1 + 0.08 * Math.sin(t * 5)));
        ringU.orb.value = theta; ringU.amt.value = appear * 0.9; ringU.color.value.copy(oc);
        const lapReset = t > 19.86;
        stones.forEach((s, i) => {
          let d = Math.abs(((idx - i) % 5 + 7.5) % 5 - 2.5); const near = Math.exp(-d * d * 6);
          let visited = 0; if (t >= C.loop && !lapReset) { const vi = LOOPK.findIndex(([, k]) => ((k % 5) === i)); if (vi >= 0 && t >= LOOPK[vi][0]) visited = 0.22; }
          const L = Math.max(near * appear, visited);
          const c = colA.copy(SCOL[i]).multiplyScalar(0.05 + L * 2.4);
          s.front.material.color.copy(c); s.back.material.color.copy(c);
          s.halo.material.opacity = L * 0.55; s.light.intensity = L * 22;
        });
        starsB.u.opacity.value = 0.8; mistB.u.opacity.value = 0.22;
        S.post.exposure = 1.05; S.post.bloom = 0.85; S.post.bloomThreshold = 0.6; S.post.sat = 1.0;
        if (t < C.loop) {
          const a = lerp(0.9, 0.4, ease((t - C.cycle) / (C.loop - C.cycle)));
          camera.position.set(Math.cos(a) * lerp(30, 21, ease((t - C.cycle) / 5)), lerp(26, 13, ease((t - C.cycle) / 5)), Math.sin(a) * lerp(30, 21, ease((t - C.cycle) / 5))); camera.lookAt(0, 0.5, 0);
        } else {
          const ci2 = orbIdx(t, 1.2); const th = stoneAng(0) - ci2 / 5 * Math.PI * 2; const k = ramp(t, C.loop, 1.0);
          const camR = lerp(-21, -5.5, k), camY = lerp(13, 4.6, k);
          camera.position.set(Math.cos(th) * camR, camY, Math.sin(th) * camR);
          camera.lookAt(Math.cos(th) * SR * lerp(0, 1, k), lerp(0.5, 2.3, k), Math.sin(th) * SR * lerp(0, 1, k));
        }
        handheld(camera, t, 0.004);
      } else {
        const tn = t - C.names; const dusk = ramp(t, 24.5, 6);
        sky.u.top.value.set('#2a2440').lerp(colA.set('#0a0814'), dusk); sky.u.horizon.value.set('#ff8a40').lerp(colA.set('#7a2a1a'), dusk); sky.u.bottom.value.set('#3a1a10');
        sky.u.sunDir.value.set(0.05, lerp(0.035, -0.03, dusk), -1).normalize(); sky.u.sunColor.value.set('#ffb070'); sky.u.sunSize.value = 0.05; sky.u.sunGlow.value = lerp(1.15, 0.6, dusk); sky.u.starAmt.value = dusk * 0.5;
        scene.fog.color.set('#a85a34').lerp(colA.set('#2a1210'), dusk); scene.fog.density = 0.0035;
        hemi.color.set('#ffa070'); hemi.groundColor.set('#1a0c08'); hemi.intensity = 0.25; sun.intensity = 0.6; sun.color.set('#ff9a60'); sun.position.set(0, 20, -200);
        // имена: подсветка за фигурой точно на слове
        [21.78, 22.5, 23.21].forEach((nt, i) => { nameGlows[i].material.opacity = ramp(t, nt - 0.1, 0.35) * (0.55 - 0.25 * ramp(t, nt + 0.8, 1.5)) * (1 - dusk * 0.6); });
        torchGlow.position.set(-7.5 + 0.5, ridgeH(-7.5, 0) + 2.55, 0.15); torchGlow.material.opacity = 0.6 + 0.15 * Math.sin(t * 17);
        // Самсон раздвигает столпы, они рушатся
        const push = ramp(t, 23.4, 1.4), fall = easeIn(clamp((t - 24.6) / 1.5));
        samson.parts.arms[0].rotation.z = -1.45 - push * 0.08; samson.parts.arms[1].rotation.z = 1.45 + push * 0.08; samson.rotation.x = push * 0.06 - fall * 0.2; samson.position.y = ridgeH(7.5, 0) - fall * 0.9;
        pillars.forEach((p, i) => { const s = i ? 1 : -1; p.rotation.z = -s * (push * 0.06 + fall * 1.3); p.rotation.x = fall * 0.2 * s; });
        lintel.position.set(7.5, ridgeH(7.5, 0) + 5.55 - fall * 5.0 - push * 0.15, 0); lintel.rotation.z = fall * 0.4 + push * 0.03;
        dustC.forEach((sp) => { const d = sp.userData; const k = clamp((t - 25.6 - d.r * 0.3) / 3); sp.position.set(d.x, ridgeH(7.5, 0) + 0.5 + k * 3, 0.5); const s = 2 + k * 7; sp.scale.set(s, s * 0.7, 1); sp.material.opacity = t > 25.6 ? ramp(t, 25.6, 0.3) * (1 - k) * 0.8 : 0; });
        smokeC.drift(t, 3, 0);
        fires.forEach((f) => (f.visible = t > 26));
        S.post.exposure = 1.0; S.post.bloom = 0.6; S.post.bloomThreshold = 0.8; S.post.sat = 1.08;
        cameraPath(camera, [[C.names, [0.2, 1.35, 21], [0, 2.6, -10]], [23.7, [0.4, 1.5, 19.5], [0.2, 2.6, -10]], [S.dur, [-2, 9, 40], [3, -2, -120]]], t);
        handheld(camera, t, 0.003);
        void tn;
      }
      sky.position.copy(camera.position);
    },
  };
}
