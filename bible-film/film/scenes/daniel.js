// Пророки-рассказы: Вавилон на закате → Иона: буря и кит → золотой истукан и огненная печь (четвёртый в огне) →
// Даниил во рву львином → луч Ангела, львы ложатся (цитата) → Есфирь идёт по тронному залу к царю.
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, rng, fbm, noise2, cameraPath, handheld, smooth, easeOut, easeIn } = lib;
  const C = meta.cues;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#3a2418', 0.004);
  const col = (c) => new THREE.Color(c);
  const cA = new THREE.Color();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), eul = new THREE.Euler();
  const T_THROW = 9.2, T_UNDER = 10.8, T_FURN = 19.6, T_LIE = 32.6;

  const sky = lib.skyDome({ top: '#1a2440', horizon: '#e08850', bottom: '#2a1a10', sunDir: [0, 0.05, -1], sunSize: 0.035, sunGlow: 1.0 });
  scene.add(sky);
  const hemi = new THREE.HemisphereLight('#8a9ab8', '#2a2018', 0.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd0a0', 1.5); scene.add(sun); scene.add(sun.target);
  const setSky = (top, hor, bot, dir, sc, size, gl, stars = 0) => {
    sky.u.top.value.set(top); sky.u.horizon.value.set(hor); sky.u.bottom.value.set(bot);
    sky.u.sunDir.value.set(...dir).normalize(); sky.u.sunColor.value.set(sc); sky.u.sunSize.value = size; sky.u.sunGlow.value = gl; sky.u.starAmt.value = stars;
  };
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const box = (parent, w, h, d, x, y, z, mat) => mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y + h / 2, z);
  const pplGeo = new THREE.LatheGeometry([[0, 0], [.34, 0], [.3, .5], [.22, 1.05], [.25, 1.3], [.12, 1.44], [.11, 1.52], [.12, 1.62], [.08, 1.72], [0, 1.76]].map(([x, y]) => new THREE.Vector2(x, y)), 7);
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b04a', metalness: 0.7, roughness: 0.3, emissive: '#5a3a08', emissiveIntensity: 0.5 });

  // ================= A. Вавилон на закате =================
  const gA = new THREE.Group(); scene.add(gA);
  const RZ = 30; // река вдоль x на z = RZ
  const hA = (x, z) => { const d = Math.abs(z - RZ - Math.sin(x * 0.02) * 6); return lerp(-2.2, 0.6 + fbm(x * 0.01, z * 0.01, 3) * 2, smooth(9, 16, d)); };
  gA.add(lib.terrain({ size: 1000, seg: 160, center: [0, -200], heightFn: hA, colorFn: (x, z, y) => col('#6a5434').lerp(col('#4a4a2a'), clamp(noise2(x * 0.02, z * 0.02) + 0.4)).lerp(col('#3a3020'), clamp(-y)) }));
  const river = lib.ocean({ size: 900, seg: 90, deep: '#1a2028', shallow: '#3a3a3a', sky: '#e08850', amp: 0.05, choppy: 0.3, sunDir: [0.1, 0.05, -1], sunColor: '#ffb070' });
  river.position.y = -0.9; gA.add(river);
  const mudTex = lib.canvasTexture(256, 256, (g, w, h) => { const r = rng(6); g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 * 8; x < w; x += 16) { g.fillStyle = `rgb(${150 + r() * 40},${115 + r() * 30},${75 + r() * 20})`; g.fillRect(x + 1, y + 1, 14, 6); } });
  mudTex.wrapS = mudTex.wrapT = THREE.RepeatWrapping; mudTex.repeat.set(8, 2);
  const mud = new THREE.MeshStandardMaterial({ map: mudTex, color: '#c8a070', roughness: 0.95 });
  const mudDark = new THREE.MeshStandardMaterial({ color: '#5a4028', roughness: 1 });
  const zig = new THREE.Group(); zig.position.set(0, 0, -60); gA.add(zig);
  { let y = 0; [[64, 9], [52, 8], [41, 7], [31, 6.5], [22, 6], [14, 5.5]].forEach(([w, h]) => { box(zig, w, h, w, 0, y, 0, mud); box(zig, w + 0.8, 0.7, w + 0.8, 0, y + h - 0.7, 0, mudDark); for (let k = 0; k < Math.floor(w / 4); k++) box(zig, 0.9, h * 0.8, 0.5, -w / 2 + 2 + k * 4, y, w / 2 + 0.1, mudDark); y += h; });
    box(zig, 9, 6, 9, 0, 42, 0, new THREE.MeshStandardMaterial({ color: '#2a4a8a', roughness: 0.5, emissive: '#0a1a3a', emissiveIntensity: 0.4 }));
    const st = box(zig, 7, 1, 46, 0, 0, 40, mud); st.rotation.x = -0.72; st.position.set(0, 14, 30);
    const tg = lib.glow('#ffb060', 14, 0.5); tg.position.set(0, 46, 6); zig.add(tg); }
  // стены с башнями
  const NW = 90; const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mud, NW);
  for (let i = 0; i < NW; i++) { const a = i / NW * Math.PI * 2, a2 = (i + 1) / NW * Math.PI * 2; const R = 150; const x = Math.cos(a) * R, z = Math.sin(a) * R * 0.7 - 90, x2 = Math.cos(a2) * R, z2 = Math.sin(a2) * R * 0.7 - 90;
    const L = Math.hypot(x2 - x, z2 - z); const tower = i % 5 === 0; walls.setMatrixAt(i, tmpM.compose(tmpP.set((x + x2) / 2, -0.5, (z + z2) / 2), tmpQ.setFromEuler(eul.set(0, -Math.atan2(z2 - z, x2 - x), 0)), tmpS.set(tower ? 9 : L + 0.5, tower ? 22 : 15, tower ? 9 : 5))); }
  gA.add(walls);
  // Врата Иштар (синие)
  const gate = new THREE.Group(); gate.position.set(-30, 0, 13); gA.add(gate);
  { const bm = new THREE.MeshStandardMaterial({ color: '#1a4a9a', roughness: 0.4, emissive: '#081a40', emissiveIntensity: 0.5 });
    box(gate, 7, 24, 8, -7, -0.5, 0, bm); box(gate, 7, 24, 8, 7, -0.5, 0, bm); box(gate, 21, 6, 8, 0, 14, 0, bm); box(gate, 7, 14, 0.3, 0, -0.5, -1, new THREE.MeshBasicMaterial({ color: '#1a0c06' }));
    for (let i = 0; i < 6; i++) { const g = lib.glow('#ffd070', 1.2, 0.6); g.position.set(-9 + i * 3.6, 18, 4.1); gate.add(g); } }
  const NH = 650; const houses = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#b89a6a', roughness: 0.95 }), NH);
  const winPts = []; { const r = rng(5); let n = 0; while (n < NH) { const x = (r() - .5) * 280, z = -170 + r() * 180; if (Math.hypot(x / 150, (z + 90) / 105) > 0.95 || Math.hypot(x, z + 60) < 45) continue; const w = 4 + r() * 6, h = 3 + r() * 6;
    houses.setMatrixAt(n, tmpM.compose(tmpP.set(x, hA(x, z) - 0.5, z), tmpQ.setFromEuler(eul.set(0, (r() - .5) * 0.3, 0)), tmpS.set(w, h, w * (0.7 + r() * 0.5)))); houses.setColorAt(n, col('#b89a6a').multiplyScalar(0.6 + r() * 0.5));
    if (r() < 0.45) winPts.push(x + (r() - .5) * w * 0.5, hA(x, z) + h * 0.5, z + w * 0.4); n++; } }
  gA.add(houses);
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(winPts, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffb050', size: 0.9, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, map: lib.radialTexture() })); gA.add(pts); }
  // пальмы
  const palms = new THREE.Group(); gA.add(palms);
  { const tr = new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 1 }), lf = new THREE.MeshStandardMaterial({ color: '#2a3a1a', roughness: 1, side: THREE.DoubleSide }); const r = rng(8);
    const frondG = new THREE.PlaneGeometry(4.2, 0.9); frondG.translate(2.1, 0, 0);
    for (let i = 0; i < 26; i++) { const x = (r() - .5) * 260, z = RZ - 16 - r() * 14 + (i % 3 === 0 ? 34 : 0); const y = hA(x, z); const h = 8 + r() * 5; const lean = (r() - .5) * 0.3;
      const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.z = lean; palms.add(p); mesh(new THREE.CylinderGeometry(0.22, 0.35, h, 6).translate(0, h / 2, 0), tr, p);
      for (let k = 0; k < 8; k++) { const f = new THREE.Mesh(frondG, lf); f.position.y = h; f.rotation.set(0, k / 8 * Math.PI * 2 + r(), -0.5 - r() * 0.3, 'YXZ'); p.add(f); } } }
  const birds = []; { const r = rng(12); for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.6, 0.2, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 0.2, 0)]), new THREE.MeshBasicMaterial({ color: '#1a1008', side: THREE.DoubleSide }));
    b.geometry.setIndex([0, 1, 2]); b.userData = { x: -60 + r() * 40, y: 30 + r() * 15, z: -20 + r() * 30, s: 4 + r() * 2, p: r() * 6 }; gA.add(b); birds.push(b); } }
  const hazeA = lib.cloudLayer({ count: 10, area: [700, 200], y: 6, scale: [260, 22], seed: 3, color: '#e09060', opacity: 0.35, center: [0, -80] }); gA.add(hazeA);

  // ================= B1. Иона: буря =================
  const gB = new THREE.Group(); scene.add(gB);
  const sea = lib.ocean({ size: 700, seg: 200, deep: '#03080c', shallow: '#0c2028', sky: '#1a2430', amp: 1.6, choppy: 1.2, foam: 0.18, sunDir: [0.3, 0.3, -1], sunColor: '#3a4a5a' });
  gB.add(sea);
  const WAV = [[1, 0.3, 38, 1.0, 6], [-0.4, 1, 21, 0.6, 4.6], [0.7, -0.6, 11, 0.32, 3.4], [-0.9, -0.2, 6, 0.18, 2.5], [0.2, 0.9, 3.1, 0.08, 1.8]].map(([dx, dz, wl, a, sp]) => { const l = Math.hypot(dx, dz); return [dx / l, dz / l, 2 * Math.PI / wl, a, sp]; });
  const waveY = (x, z, t, amp) => { let y = 0; for (const [dx, dz, k, a, sp] of WAV) y += amp * a * Math.sin(k * (dx * x + dz * z - sp * t)); return y; };
  const ship = new THREE.Group(); gB.add(ship);
  const shipWood = new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.9 });
  { const hg = new THREE.BoxGeometry(9, 2, 3, 12, 2, 4); const p = hg.attributes.position;
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const e = Math.abs(x) / 4.5; z *= (1 - Math.pow(e, 2.2) * 0.85) * (y < 0 ? 0.6 : 1); y += Math.pow(e, 2) * 1.1; p.setXYZ(i, x, y, z); } hg.computeVertexNormals();
    mesh(hg, shipWood, ship, 0, 0.4, 0);
    mesh(new THREE.CylinderGeometry(0.1, 0.13, 8, 6).translate(0, 4, 0), shipWood, ship, 0.3, 1.2, 0);
    const sailG = new THREE.PlaneGeometry(4.4, 4, 8, 8); { const q = sailG.attributes.position; for (let i = 0; i < q.count; i++) q.setZ(i, Math.cos(q.getX(i) / 2.2 * 1.5) * 0.7); sailG.computeVertexNormals(); }
    const sail = mesh(sailG, new THREE.MeshStandardMaterial({ color: '#8a7a64', roughness: 1, side: THREE.DoubleSide }), ship, 0.3, 5.6, 0.45); sail.rotation.y = Math.PI / 2 + 0.3;
    for (let i = 0; i < 3; i++) { const s = lib.figure({ height: 1.6, robe: '#2a2018', skin: '#5a3a2a', hood: true, seed: 30 + i }); s.position.set(-2.4 + i * 1.6, 1.3, (i - 1) * 0.5); s.rotation.y = 1.2 + i; ship.add(s); }
    const lamp = lib.glow('#ffa040', 3.2, 0.9); lamp.position.set(-3.6, 2.6, 0); ship.add(lamp); const lampL = new THREE.PointLight('#ffa050', 5, 12, 1.6); lampL.position.set(-3.4, 3, 0.5); ship.add(lampL); }
  const jonahS = lib.figure({ height: 1.7, robe: '#5a4a38', skin: '#7a5a40', hood: false, seed: 41 }); gB.add(jonahS);
  const splash = []; { const tx = lib.cloudTexture(55, 128); for (let i = 0; i < 8; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, color: '#c8d8e0', transparent: true, opacity: 0, depthWrite: false })); gB.add(sp); splash.push(sp); } }
  function makeRain({ count, box: bx, center, seed, speed, color, opacity, slant }) {
    const r = rng(seed), p = new Float32Array(count * 6), sd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { const x = (r() - .5) * bx[0], y = (r() - .5) * bx[1], z = (r() - .5) * bx[2], s = r(); p.set([x, y, z, x, y, z], i * 6); sd.set([s, 0, s, 1], i * 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 2));
    const u = { time: { value: 0 }, speed: { value: speed }, box: { value: new THREE.Vector3(...bx) }, color: { value: col(color) }, opacity: { value: opacity }, slant: { value: slant } };
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec2 sd; uniform float time, speed, slant; uniform vec3 box; varying float vE;
        void main(){ vec3 q = position; float fall = time*speed*(.8+sd.x*.4); q.y = mod(q.y - fall + box.y*.5, box.y) - box.y*.5; q.x += q.y*slant; q.y += sd.y*1.4; q.x -= sd.y*1.4*slant; vE = sd.y;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(q,1.); }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; varying float vE; void main(){ gl_FragColor = vec4(color*opacity*(1.-vE*.7), 1.); }` });
    const ls = new THREE.LineSegments(g, m); ls.position.set(...center); ls.frustumCulled = false; return Object.assign(ls, { u });
  }
  const rainB = makeRain({ count: 7000, box: [60, 30, 50], center: [0, 10, 0], seed: 5, speed: 30, color: '#8aa0b8', opacity: 0.4, slant: 0.35 }); gB.add(rainB);
  const cloudsB = lib.cloudLayer({ count: 20, area: [600, 400], y: 55, scale: [200, 80], seed: 7, color: '#2a3038', opacity: 0.9, center: [0, -150] }); gB.add(cloudsB);
  const bolt = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#e8f0ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  { const r = rng(91); const pts = []; let x = 0, y = 70; for (let i = 0; i < 14; i++) { const nx = x + (r() - .5) * 10, ny = y - 5; pts.push(x, y, 0, nx, ny, 0); x = nx; y = ny; } const v = []; for (let i = 0; i < pts.length; i += 6) { const [x1, y1, , x2, y2] = pts.slice(i, i + 5); const w = 0.5; v.push(x1 - w, y1, 0, x1 + w, y1, 0, x2 + w, y2, 0, x1 - w, y1, 0, x2 + w, y2, 0, x2 - w, y2, 0); }
    bolt.geometry.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); }
  bolt.position.set(40, 0, -160); gB.add(bolt);
  const boltGlow = lib.glow('#c8d8ff', 160, 0); boltGlow.position.set(40, 40, -170); gB.add(boltGlow);

  // ================= B2. Под водой: кит =================
  const gU = new THREE.Group(); scene.add(gU);
  const surfU = { time: { value: 0 } };
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShaderMaterial({ uniforms: surfU, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec2 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: lib.GLSL_NOISE + `uniform float time; varying vec2 vP; void main(){ float n = fbm2(vP*.08 + vec2(time*.15, time*.1)); float c = smoothstep(.45,.75,n);
      float d = length(vP)/200.; vec3 col = mix(vec3(.05,.2,.3), vec3(.5,.75,.85), c) * (1.-smoothstep(.1,1.,d)); gl_FragColor = vec4(col, 1.); }` }));
  surf.rotation.x = Math.PI / 2; surf.position.y = 26; gU.add(surf);
  const rays = []; { const r = rng(21); for (let i = 0; i < 9; i++) { const b = lib.lightBeam({ radiusTop: 1.2 + r() * 1.5, radiusBottom: 5 + r() * 4, length: 70, color: '#8ad0e0', opacity: 0.18 + r() * 0.1 }); b.position.set((r() - .5) * 60, 26, (r() - .5) * 40 - 10); b.rotation.set((r() - .5) * 0.2, 0, 0.25 + (r() - .5) * 0.15); gU.add(b); rays.push(b); } }
  const plankton = lib.motes({ count: 1500, box: [60, 40, 60], center: [0, 0, -10], size: 1.6, color: '#a0d8e0', speed: 0.15, opacity: 0.5, seed: 23 }); gU.add(plankton);
  const bubbles = lib.motes({ count: 150, box: [2, 10, 2], center: [0, 4, 0], size: 2.5, color: '#d0f0ff', speed: 0.5, kind: 'rise', opacity: 0.8, seed: 24 }); gU.add(bubbles);
  const jonahU = lib.figure({ height: 1.7, robe: '#3a3028', skin: '#5a4030', hood: false, seed: 42 }); gU.add(jonahU);
  jonahU.parts.arms[0].rotation.set(0, 0, -2.4); jonahU.parts.arms[1].rotation.set(0, 0, 2.4);
  // кит: тело вращения вдоль z, пасть = нижняя челюсть
  const whale = new THREE.Group(); gU.add(whale);
  const whaleM = new THREE.MeshStandardMaterial({ color: '#1e2c34', roughness: 0.7 });
  { const prof = [[0, -13], [1.2, -12.4], [2.6, -10.5], [3.4, -7], [3.6, -3], [3.2, 2], [2.4, 6], [1.4, 9.5], [0.7, 12], [0.4, 13.5], [0, 14]].map(([r, z]) => new THREE.Vector2(r, z));
    const bg = new THREE.LatheGeometry(prof, 28); bg.rotateX(Math.PI / 2); bg.scale(1, 0.85, 1); // нос в -z... после поворота y→z
    const body = mesh(bg, whaleM, whale); body.rotation.y = Math.PI; // голова к +z
    const jawG = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); jawG.scale(2.6, 1.3, 5);
    const jawP = new THREE.Group(); jawP.position.set(0, -0.8, 5.5); whale.add(jawP); const jaw = mesh(jawG, whaleM, jawP, 0, 0, 2.6); void jaw; whale.userData.jaw = jawP;
    
    const fluke = new THREE.Shape(); fluke.moveTo(0, 0); fluke.quadraticCurveTo(3, 1, 6, 2.5); fluke.quadraticCurveTo(4, -0.4, 0, -1.5); fluke.quadraticCurveTo(-4, -0.4, -6, 2.5); fluke.quadraticCurveTo(-3, 1, 0, 0);
    const fg = new THREE.ShapeGeometry(fluke); fg.rotateX(-Math.PI / 2); const tailP = new THREE.Group(); tailP.position.set(0, 0, -13); whale.add(tailP); mesh(fg, new THREE.MeshStandardMaterial({ color: '#1e2c34', roughness: 0.7, side: THREE.DoubleSide }), tailP, 0, 0, -0.5); whale.userData.tail = tailP;
    [-1, 1].forEach((s) => { const f = mesh(new THREE.SphereGeometry(1, 10, 6), whaleM, whale, s * 3.4, -1.5, 3); f.scale.set(2.6, 0.2, 0.9); f.rotation.set(0, s * 0.5, s * -0.4); });
    for (let i = 0; i < 10; i++) { const g = mesh(new THREE.BoxGeometry(0.08, 0.1, 9), new THREE.MeshStandardMaterial({ color: '#3a4a50', roughness: 0.8 }), whale, -2.2 + i * 0.5, -2.7, 4); g.rotation.x = 0.05; } }

  // ================= C1. Золотой истукан =================
  const gC = new THREE.Group(); scene.add(gC);
  const hC = (x, z) => fbm(x * 0.01, z * 0.01, 3) * 3 * smooth(110, 220, Math.hypot(x, z + 60));
  gC.add(lib.terrain({ size: 900, seg: 120, center: [0, -200], heightFn: hC, colorFn: (x, z) => col('#a07a4c').lerp(col('#7a5a3a'), clamp(noise2(x * 0.03, z * 0.03) + 0.5)) }));
  const IDZ = -70;
  box(gC, 18, 10, 18, 0, -0.5, IDZ, new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.9 }));
  box(gC, 14, 3, 14, 0, 9.5, IDZ, new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.9 }));
  const idol = lib.figure({ height: 30, robe: '#e0b04a', skin: '#e0b04a', hood: false, seed: 51, belt: '#a07020' }); idol.position.set(0, 12.5, IDZ); gC.add(idol);
  idol.traverse((o) => { if (o.isMesh) { o.material = gold; o.castShadow = false; } });
  idol.parts.arms[0].rotation.set(-0.3, 0, -0.15); idol.parts.arms[1].rotation.set(-0.5, 0, 0.15);
  { const s = 30 / 1.8; const crown = new THREE.Group(); crown.position.y = 1.72 * s; idol.add(crown); mesh(new THREE.CylinderGeometry(0.15 * s, 0.13 * s, 0.12 * s, 16, 1, true), gold, crown);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; mesh(new THREE.ConeGeometry(0.03 * s, 0.14 * s, 4), gold, crown, Math.cos(a) * 0.14 * s, 0.1 * s, Math.sin(a) * 0.14 * s); }
    const staff = mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 1.9 * s, 8), gold, idol.parts.arms[1], 0, -0.62 * s, 0.05 * s); staff.rotation.x = 0.5; }
  const idolGlow = lib.glow('#ffd070', 50, 0.15); idolGlow.position.set(0, 35, IDZ); gC.add(idolGlow);
  // поклоняющаяся толпа и трое стоящих
  const NB = 420; const bowers = new THREE.InstancedMesh(pplGeo, new THREE.MeshStandardMaterial({ color: '#5a4430', roughness: 1 }), NB);
  { const r = rng(61); let n = 0; while (n < NB) { const x = (r() - .5) * 110, z = IDZ + 20 + r() * 75; if (Math.abs(x) < 4 && z > IDZ + 60) continue;
    const ry = Math.atan2(-x, IDZ - z); bowers.setMatrixAt(n, tmpM.compose(tmpP.set(x, hC(x, z) - 0.1, z), tmpQ.setFromEuler(eul.set(1.15 + r() * 0.2, ry, 0, 'YXZ')), tmpS.setScalar(0.9 + r() * 0.2)));
    bowers.setColorAt(n, col('#5a4430').multiplyScalar(0.6 + r() * 0.8)); n++; } }
  gC.add(bowers);
  const youths = [0, 1, 2].map((i) => { const f = lib.figure({ height: 1.75, robe: ['#e8dcc8', '#c8b090', '#d8c8a8'][i], skin: '#8a5a3c', hood: false, seed: 71 + i }); f.position.set(-1.0 + i * 1.3, hC(0, IDZ + 86), IDZ + 86 - (i % 2) * 0.4); f.rotation.y = Math.PI; gC.add(f); return f; });
  const dustC = lib.motes({ count: 600, box: [80, 20, 80], center: [0, 6, IDZ + 50], size: 3, color: '#ffd8a0', speed: 0.2, opacity: 0.5, seed: 62 }); gC.add(dustC);

  // ================= C2. Огненная печь =================
  const gF = new THREE.Group(); scene.add(gF);
  const brickTex = lib.canvasTexture(256, 256, (g, w, h) => { const r = rng(4); g.fillStyle = '#2a1408'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 * 16; x < w; x += 32) { g.fillStyle = `rgb(${120 + r() * 50},${60 + r() * 30},${30 + r() * 15})`; g.fillRect(x + 1, y + 1, 30, 14); } });
  brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping; brickTex.repeat.set(6, 4);
  const brickM = new THREE.MeshStandardMaterial({ map: brickTex, color: '#a08070', roughness: 0.95 });
  const OW = 8, OH = 9;
  box(gF, 15, 22, 3, -(OW / 2 + 7.5), 0, 0, brickM); box(gF, 15, 22, 3, OW / 2 + 7.5, 0, 0, brickM); box(gF, OW, 22 - OH, 3, 0, OH, 0, brickM);
  { const dome = mesh(new THREE.SphereGeometry(16, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), brickM, gF, 0, 20, -14); dome.scale.set(1.2, 0.6, 1); }
  const inner = new THREE.MeshStandardMaterial({ map: brickTex, color: '#ff8a40', emissive: '#ff5a10', emissiveMap: brickTex, emissiveIntensity: 0.25, roughness: 1, side: THREE.BackSide });
  mesh(new THREE.BoxGeometry(26, 20, 22), inner, gF, 0, 10, -12.5);
  const furnFires = [[-5, -11, 3.5, 380, 9], [5, -11, 3.5, 380, 9], [0, -15, 6, 480, 11], [-10, -8, 2.5, 200, 8], [10, -8, 2.5, 200, 8], [0, -4.5, 5, 300, 1.4]].map(([x, z, rad, n, h], i) => { const f = lib.fire({ count: n, radius: rad, height: h, size: 95, seed: 81 + i, intensity: i === 5 ? 0.2 : 0.17 }); f.position.set(x, 0, z); gF.add(f); return f; });
  const walkers = [0, 1, 2, 3].map((i) => { const f = lib.figure({ height: 1.8, robe: i === 3 ? '#fff4e0' : '#1a0c06', skin: i === 3 ? '#fff0d8' : '#1a0c06', hood: i === 3, seed: 91 + i, glow: i === 3 ? 1.2 : 0, emissive: i === 3 ? '#ffe8c0' : '#000', belt: i === 3 ? '#ffe0a0' : '#0a0604' });
    if (i === 3) { f.parts.robeMat.emissiveIntensity = 1.6; f.traverse((o) => { if (o.isMesh && o.material !== f.parts.robeMat) o.material = f.parts.robeMat; }); }
    f.position.set(-4 + i * 2.6, 0, -7); gF.add(f); return f; });
  const furnL = new THREE.PointLight('#ff7a30', 120, 60, 1.5); furnL.position.set(0, 6, 3); gF.add(furnL);
  const mouthGlow = lib.glow('#ff9a40', 26, 0.5); mouthGlow.position.set(0, 4.5, 2); gF.add(mouthGlow);
  const fourthGlow = lib.glow('#fff0c8', 7, 0.7); gF.add(fourthGlow);
  const embersF = lib.motes({ count: 450, box: [30, 18, 20], center: [0, 8, 4], size: 3, color: '#ff8a40', speed: 0.8, kind: 'embers', opacity: 0.9, seed: 99 }); gF.add(embersF);
  mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 1 }), gF, 0, 0, 40);
  const guards = [-1, 1].map((s, i) => { const f = lib.figure({ height: 1.8, robe: '#1a1210', skin: '#2a1a10', hood: false, seed: 101 + i, staff: true }); f.position.set(s * 6.5, 0, 6 + i); f.rotation.y = s * 2.6; gF.add(f); return f; });

  // ================= D/E. Ров со львами =================
  const gD = new THREE.Group(); scene.add(gD);
  const PRAD = 12;
  { const wg = new THREE.CylinderGeometry(PRAD, PRAD - 0.6, 13, 72, 16, true); const p = wg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = 1 + (fbm(a * 3, y * 0.25, 4) * 0.08 + noise2(a * 12, y * 0.8) * 0.02); p.setX(i, x * k); p.setZ(i, z * k); }
    wg.computeVertexNormals(); const wall = mesh(wg, new THREE.MeshStandardMaterial({ color: '#7a6a5a', roughness: 1, side: THREE.BackSide, flatShading: true }), gD, 0, 6.5, 0); void wall; }
  const floorG = new THREE.CircleGeometry(PRAD + 1, 64); floorG.rotateX(-Math.PI / 2);
  mesh(floorG, new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 1 }), gD);
  { const r = rng(111); const rk = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#5a5048', roughness: 1, flatShading: true }), 40);
    for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = PRAD - 0.8 - r() * 1.5; const s = 0.3 + r() * 0.9; rk.setMatrixAt(i, tmpM.compose(tmpP.set(Math.cos(a) * d, s * 0.3, Math.sin(a) * d), tmpQ.setFromEuler(eul.set(r(), r(), r())), tmpS.set(s, s * 0.7, s))); }
    gD.add(rk);
  }
  const rimG = new THREE.RingGeometry(PRAD, 200, 72, 1); rimG.rotateX(-Math.PI / 2);
  mesh(rimG, new THREE.MeshStandardMaterial({ color: '#2a2a28', roughness: 1 }), gD, 0, 13, 0);
  const daniel = lib.figure({ height: 1.75, robe: '#d8ccb4', skin: '#8a5a3c', hood: false, seed: 121, belt: '#6a4a2a' });
  daniel.position.set(0, -0.48, 0); daniel.rotation.y = 0.4; daniel.parts.body.rotation.x = 0.08;
  daniel.parts.head.position.z = 0.06; gD.add(daniel);
  const lionM = new THREE.MeshStandardMaterial({ color: '#b88450', roughness: 0.85 }), maneM = new THREE.MeshStandardMaterial({ color: '#5a3418', roughness: 1 });
  const sph = new THREE.SphereGeometry(1, 16, 10), legG = new THREE.CylinderGeometry(0.12, 0.09, 0.84, 8).translate(0, -0.42, 0), maneG = new THREE.IcosahedronGeometry(0.6, 2);
  function lion(seed) {
    const r = rng(seed); const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
    const body = mesh(sph, lionM, inner, -0.05, 0.86, 0); body.scale.set(0.95, 0.42, 0.4);
    const haunch = mesh(sph, lionM, inner, -0.62, 0.86, 0); haunch.scale.set(0.42, 0.46, 0.4);
    const chest = mesh(sph, lionM, inner, 0.55, 0.92, 0); chest.scale.set(0.5, 0.52, 0.44);
    const collar = mesh(sph, maneM, inner, 0.82, 1.08, 0); collar.scale.set(0.42, 0.58, 0.5);
    const head = new THREE.Group(); head.position.set(1.02, 1.3, 0); inner.add(head);
    const mane = mesh(maneG, maneM, head, 0.0, 0, 0); mane.scale.set(0.75, 1.05, 1.1);
    const sk = mesh(sph, lionM, head, 0.3, -0.03, 0); sk.scale.set(0.3, 0.27, 0.25);
    const mz = mesh(sph, lionM, head, 0.52, -0.13, 0); mz.scale.set(0.17, 0.13, 0.15);
    const nose = mesh(sph, maneM, head, 0.66, -0.08, 0); nose.scale.set(0.05, 0.04, 0.06);
    [-1, 1].forEach((s) => { const e = mesh(sph, lionM, head, 0.18, 0.27, s * 0.2); e.scale.setScalar(0.07); });
    const legs = [[0.6, 0.2], [0.6, -0.2], [-0.62, 0.2], [-0.62, -0.2]].map(([x, z]) => { const pv = new THREE.Group(); pv.position.set(x, 0.86, z); inner.add(pv); mesh(legG, lionM, pv); const paw = mesh(sph, lionM, pv, 0.05, -0.84, 0); paw.scale.set(0.14, 0.07, 0.12); return pv; });
    const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.95, 0.95, 0), new THREE.Vector3(-1.45, 0.7, 0), new THREE.Vector3(-1.75, 0.3, 0.1)]), 10, 0.04, 5), lionM); inner.add(tail);
    const tuft = mesh(sph, maneM, inner, -1.77, 0.27, 0.1); tuft.scale.setScalar(0.1);
    g.parts = { legs, head, inner, tail }; g.scale.setScalar(0.78 + r() * 0.1); return g;
  }
  const lions = [0, 1, 2, 3, 4].map((i) => { const L = lion(131 + i); gD.add(L); return Object.assign(L, { a0: i / 5 * Math.PI * 2 + i * 0.3, R: 2.9 + (i % 3) * 0.9, w: 0.32 + (i % 2) * 0.1, dir: i % 2 ? 1 : -1 }); });
  const moonBeam = lib.lightBeam({ radiusTop: 3, radiusBottom: 5, length: 15, color: '#9ab8e8', opacity: 0.1 }); moonBeam.position.set(-3.5, 14, -1); moonBeam.rotation.z = 0.25; gD.add(moonBeam);
  const moonSpot = new THREE.SpotLight('#a8c0ff', 60, 40, 0.38, 0.6, 1.2); moonSpot.position.set(-4, 16, -1); moonSpot.target.position.set(0, 0, 0); gD.add(moonSpot, moonSpot.target);
  const angelU = { op: { value: 0 }, time: { value: 0 } };
  const angelBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 2.1, 26, 48, 1, true).translate(0, 13, 0), new THREE.ShaderMaterial({ uniforms: angelU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying float vE; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vec3 n = normalize(normalMatrix*normal); vE = pow(abs(dot(n, normalize(-mv.xyz))), 1.5); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: lib.GLSL_NOISE + `uniform float op, time; varying vec2 vUv; varying float vE; void main(){ float along = mix(1., .15, smoothstep(0., .7, vUv.y)) * smoothstep(1., .85, vUv.y);
      float n = .75 + .25*vnoise(vec2(vUv.x*14., vUv.y*4. - time*.4)); gl_FragColor = vec4(vec3(1.,.86,.6)*vE*along*n*op, 1.); }` }));
  gD.add(angelBeam);
  const angelPool = lib.glow('#ffe0a8', 6, 0); angelPool.position.set(0, 0.6, 0); gD.add(angelPool);
  const angelMotes = lib.motes({ count: 400, box: [5, 14, 5], center: [0, 7, 0], size: 2, color: '#ffe8b8', speed: 0.25, kind: 'rise', opacity: 0, seed: 141 }); gD.add(angelMotes);
  const angelL = new THREE.PointLight('#ffd8a0', 0, 18, 1.4); angelL.position.set(0, 4, 0); gD.add(angelL);
  const moonL = new THREE.DirectionalLight('#9ab8ff', 1.2); moonL.position.set(-8, 30, 4); moonL.target.position.set(0, 0, 0); gD.add(moonL, moonL.target);
  const starsD = lib.starfield({ count: 3000, radius: 1400, size: 2.4, minY: 0.3, seed: 33 }); gD.add(starsD);

  // ================= F. Есфирь в тронном зале =================
  const gE = new THREE.Group(); scene.add(gE);
  const HL = 70; // зал по z от +40 до -30
  const marbleTex = lib.canvasTexture(512, 512, (g, w, h) => { g.fillStyle = '#3a2e26'; g.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#4a3a2e' : '#2a2018'; g.fillRect(x * 64 + 1, y * 64 + 1, 62, 62); } });
  marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping; marbleTex.repeat.set(4, 14);
  mesh(new THREE.PlaneGeometry(30, 100).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.35, metalness: 0.2 }), gE, 0, 0, 5);
  mesh(new THREE.PlaneGeometry(3.2, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6a1414', roughness: 0.9 }), gE, 0, 0.02, 12);
  const hallM = new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.9 });
  box(gE, 1, 24, 100, -15, 0, 5, hallM); box(gE, 1, 24, 100, 15, 0, 5, hallM); box(gE, 30, 24, 1, 0, 0, -32, hallM);
  box(gE, 30, 1, 100, 0, 24, 5, new THREE.MeshStandardMaterial({ color: '#2a1a10', roughness: 1 }));
  const NCOL = 11; const colG = new THREE.CylinderGeometry(0.7, 0.8, 16, 16).translate(0, 8, 0);
  const cols = new THREE.InstancedMesh(colG, new THREE.MeshStandardMaterial({ color: '#c8b498', roughness: 0.7 }), NCOL * 2);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1.4, 2.2), gold, NCOL * 2);
  for (let i = 0; i < NCOL; i++) [-1, 1].forEach((s, j) => { const z = 38 - i * 6.4; cols.setMatrixAt(i * 2 + j, tmpM.compose(tmpP.set(s * 7, 0, z), tmpQ.identity(), tmpS.set(1, 1, 1))); caps.setMatrixAt(i * 2 + j, tmpM.compose(tmpP.set(s * 7, 16.6, z), tmpQ.identity(), tmpS.set(1, 1, 1))); });
  gE.add(cols, caps);
  const banners = []; for (let i = 0; i < 6; i++) [-1, 1].forEach((s) => { const b = mesh(new THREE.PlaneGeometry(3, 12), new THREE.MeshStandardMaterial({ color: i % 2 ? '#2a3a7a' : '#7a1a1a', roughness: 0.9, side: THREE.DoubleSide }), gE, s * 14.4, 14, 34 - i * 12); b.rotation.y = -s * Math.PI / 2; banners.push(b); });
  const braziers = []; for (let i = 0; i < 6; i++) [-1, 1].forEach((s) => { const z = 34 - i * 12.8; const x = s * 4.4; box(gE, 0.4, 1.4, 0.4, x, 0, z, gold); const f = lib.fire({ count: 90, radius: 0.35, height: 1.2, size: 12, seed: 151 + i * 2 + (s > 0), intensity: 0.8 }); f.position.set(x, 1.5, z); gE.add(f);
    const gl = lib.glow('#ff9a40', 3.5, 0.45); gl.position.set(x, 2.2, z); gE.add(gl); braziers.push(gl); });
  
  const hallL2 = new THREE.PointLight('#ffb060', 60, 40, 1.4); hallL2.position.set(0, 6, -20); gE.add(hallL2);
  const shafts = [0, 1].map((i) => { const b = lib.lightBeam({ radiusTop: 1.2, radiusBottom: 3.5, length: 30, color: '#ffd8a0', opacity: 0.2 }); b.position.set(-14, 22, 22 - i * 22); b.rotation.set(0, 0, 0.6); gE.add(b); return b; });
  const dustE = lib.motes({ count: 350, box: [24, 18, 70], center: [0, 9, 5], size: 1.6, color: '#ffd8a0', speed: 0.15, opacity: 0.6, seed: 161 }); gE.add(dustE);
  // трон и царь
  const TZ = -26;
  box(gE, 12, 0.6, 7, 0, 0, TZ, gold); box(gE, 9, 0.6, 5.6, 0, 0.6, TZ - 0.3, gold); box(gE, 7, 0.6, 4.4, 0, 1.2, TZ - 0.6, gold);
  box(gE, 2.6, 1.2, 1.8, 0, 1.8, TZ - 0.8, gold); box(gE, 2.8, 5.2, 0.5, 0, 1.8, TZ - 1.8, gold);
  const throneGlow = lib.glow('#ffc870', 14, 0.35); throneGlow.position.set(0, 5, TZ - 2.2); gE.add(throneGlow);
  const king = lib.figure({ height: 1.9, robe: '#5a1a2a', skin: '#8a5a3c', hood: false, seed: 171, belt: '#e0b04a' }); king.position.set(0, 2.25, TZ - 0.7); king.parts.body.scale.set(1.15, 0.78, 1.15);
  king.parts.head.position.y -= 0.42; king.parts.arms.forEach((a) => (a.position.y -= 0.42)); king.children.forEach((c) => { if (c.geometry?.type === 'TorusGeometry') c.position.y -= 0.42; }); gE.add(king);
  { const crown = new THREE.Group(); crown.position.set(0, king.parts.head.position.y + 0.15, 0); king.add(crown); mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.14, 12, 1, true), gold, crown); }
  const sceptre = new THREE.Group(); king.parts.arms[1].add(sceptre); sceptre.position.set(0, -0.62, 0.05);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 6), gold, sceptre, 0, -0.35, 0); const scTip = mesh(new THREE.SphereGeometry(0.07, 10, 8), gold, sceptre, 0, -1.0, 0); void scTip;
  const scGlow = lib.glow('#ffe0a0', 0.9, 0); sceptre.add(scGlow); scGlow.position.y = -1.0;
  const kingGuards = [-1, 1].map((s, i) => { const f = lib.figure({ height: 1.9, robe: '#2a2a3a', skin: '#5a3a2a', hood: false, seed: 181 + i, staff: true }); f.position.set(s * 4.5, 1.8, TZ + 0.5); gE.add(f); return f; });
  // царица
  const queen = lib.figure({ height: 1.72, robe: '#5a2a7a', skin: '#9a6a4a', hood: true, hoodColor: '#d8b878', seed: 191, belt: '#e0b04a' }); gE.add(queen);
  { const crown = new THREE.Group(); crown.position.y = 1.8; queen.add(crown); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; mesh(new THREE.ConeGeometry(0.025, 0.1, 4), gold, crown, Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12); } }
  const trainG = new THREE.PlaneGeometry(0.6, 2.2, 4, 8); trainG.translate(0, -1.1, 0); trainG.rotateX(Math.PI / 2 - 0.05);
  { const p = trainG.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setX(i, p.getX(i) * (1 + Math.max(0, -z) * 0.45)); } }
  const train = mesh(trainG, new THREE.MeshStandardMaterial({ color: '#4a1a6a', roughness: 0.8, side: THREE.DoubleSide }), queen, 0, 1.25, -0.2);
  train.rotation.x = 0; // шлейф лежит на полу за спиной
  { const p = trainG.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); p.setY(i, p.getY(i) - Math.min(1.25, (-z) * 1.1) + 0.0); } trainG.computeVertexNormals(); }
  const courtiers = new THREE.InstancedMesh(pplGeo, new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 1 }), 24);
  { const r = rng(201); for (let i = 0; i < 24; i++) { const s = i % 2 ? 1 : -1; const z = 34 - Math.floor(i / 2) * 5.2 + r(); const x = s * (9.5 + r() * 3); courtiers.setMatrixAt(i, tmpM.compose(tmpP.set(x, 0, z), tmpQ.setFromEuler(eul.set(0, -s * Math.PI / 2 + (r() - .5) * 0.4, 0)), tmpS.setScalar(1.0 + r() * 0.1))); courtiers.setColorAt(i, col('#4a3a30').multiplyScalar(0.5 + r() * 0.9)); } }
  gE.add(courtiers);

  const groups = [gA, gB, gU, gC, gF, gD, gE];
  const show = (g) => groups.forEach((x) => (x.visible = x === g));
  const angLerp = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };

  return {
    scene, camera,
    update(t, S) {
      const P = S.post; P.bloom = 0.55; P.bloomThreshold = 0.8; P.exposure = 1.0;
      sky.visible = true; scene.fog.density = 0.004;
      if (t < C.jonah) { // ---- Вавилон
        show(gA);
        setSky('#2a3058', '#f09050', '#3a2418', [0.9, 0.06, -0.45], '#ffc080', 0.035, 1.0);
        scene.fog.color.set('#c07850'); scene.fog.density = 0.0035;
        hemi.color.set('#8a90c0'); hemi.groundColor.set('#3a2418'); hemi.intensity = 0.5; sun.color.set('#ffa868'); sun.intensity = 2.0; sun.position.set(300, 30, -150); sun.target.position.set(0, 0, -60);
        river.u.skyc.value.set('#e08850'); hazeA.drift(t, 3, 0);
        birds.forEach((b) => { const d = b.userData; b.position.set(d.x + t * d.s, d.y + Math.sin(t + d.p) * 1.5, d.z); b.scale.set(1.4, 1 + Math.sin(t * 9 + d.p) * 0.8, 1.4); });
        P.exposure = 0.95; P.bloomThreshold = 0.75;
        cameraPath(camera, [[0, [105, 26, 140], [-15, 12, -70]], [C.jonah, [80, 30, 132], [-15, 14, -70]]], t);
        handheld(camera, t, 0.002);
      } else if (t < T_UNDER) { // ---- буря
        show(gB);
        const fl = Math.max(0, Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1) - 0.82) * 5.5 + ramp(t, 7.6, 0.05) * (1 - ramp(t, 7.7, 0.3));
        setSky('#05080e', cA.set('#1a2230').lerp(col('#8090b0'), clamp(fl)).getStyle(), '#020304', [0.3, 0.3, -1], '#8090a0', 0.0, 0.0);
        scene.fog.color.set('#0e141c').lerp(col('#40506a'), clamp(fl) * 0.6); scene.fog.density = 0.012;
        hemi.color.set('#4a5a78'); hemi.groundColor.set('#05080a'); hemi.intensity = 0.55 + fl * 1.2; sun.color.set('#a8b8d8'); sun.intensity = 0.3 + fl * 2.5; sun.position.set(40, 60, -150); sun.target.position.set(0, 0, 0);
        bolt.visible = fl > 0.15; bolt.material.opacity = clamp(fl); boltGlow.material.opacity = clamp(fl) * 0.5;
        cloudsB.drift(t, 10, 0); cloudsB.setColor(cA.set('#1a2028').lerp(col('#6a7a9a'), clamp(fl) * 0.6));
        sea.u.skyc.value.set('#1a2430').lerp(col('#6a7a9a'), clamp(fl)); sea.u.fogColor.value.copy(scene.fog.color); sea.u.fogDensity.value = 0.008;
        const sy = waveY(0, 0, t, 1.6); const pitch = (waveY(3, 0, t, 1.6) - waveY(-3, 0, t, 1.6)) / 6, roll = (waveY(0, 1.5, t, 1.6) - waveY(0, -1.5, t, 1.6)) / 3;
        ship.position.set(0, sy - 0.2, 0); ship.rotation.set(-roll * 0.8, 0.25, pitch * 0.9);
        // Иону бросают за борт
        const k = clamp((t - T_THROW) / 0.75); ship.updateMatrixWorld(true);
        if (t < T_THROW) { tmpP.set(0.6, 1.3, 0.9); ship.localToWorld(tmpP); jonahS.position.copy(tmpP); jonahS.rotation.set(0, 0.6, 0); jonahS.parts.arms[0].rotation.set(-0.3, 0, -0.3); jonahS.parts.arms[1].rotation.set(0, 0, 0.12); }
        else { const a = new THREE.Vector3(0.6, 1.3, 0.9); ship.localToWorld(a); jonahS.position.set(a.x + k * 2.4, a.y + Math.sin(k * Math.PI) * 1.8 - easeIn(k) * 3.2, a.z + k * 3.2); jonahS.rotation.set(k * 1.8, 0.6, k * 0.8); jonahS.parts.arms[0].rotation.set(0, 0, -2.4 * k); jonahS.parts.arms[1].rotation.set(0, 0, 2.4 * k); }
        jonahS.visible = t < T_THROW + 0.9;
        const sk = clamp((t - T_THROW - 0.7) / 1.3); splash.forEach((sp, i) => { const a = i / 8 * Math.PI * 2; sp.position.set(0.6 + 2.4 + Math.cos(a) * sk * 1.2, waveY(3, 4, t, 1.6) + 0.4 + sk * 1.6 * (0.5 + (i % 3) * 0.3), 0.9 + 3.2 + Math.sin(a) * sk * 1.2); const s = 1 + sk * 2.5; sp.scale.set(s, s, 1); sp.material.opacity = t > T_THROW + 0.7 ? (1 - sk) * 0.7 : 0; });
        P.flash = clamp(fl) * 0.12; P.exposure = 1.0 + fl * 0.2; P.sat = 0.8; P.tint = [0.92, 0.98, 1.06];
        cameraPath(camera, [[C.jonah, [-5, 3.4, 21], [0, 3.0, 0]], [T_UNDER, [-2.5, 3.0, 17], [1.5, 2.4, 1.5]]], t);
        camera.position.y += waveY(-12, 16, t, 1.6) * 0.5;
        handheld(camera, t * 1.6, 0.012);
      } else if (t < C.furnace) { // ---- под водой
        show(gU); sky.visible = false;
        scene.fog.color.set('#05202a'); scene.fog.density = 0.028;
        hemi.color.set('#4a9ab0'); hemi.groundColor.set('#02080a'); hemi.intensity = 0.9; sun.color.set('#8ad0e0'); sun.intensity = 1.6; sun.position.set(10, 50, 0); sun.target.position.set(0, 0, 0);
        const u = t - T_UNDER;
        jonahU.position.set(0.3, 6 - u * 1.0, 0); jonahU.rotation.set(0.4 + Math.sin(t * 0.8) * 0.15, u * 0.2, 0.3);
        bubbles.position.copy(jonahU.position);
        // кит идёт из глубины снизу-справа, раскрывает пасть
        const sw = smooth(0, 3.0, u); const W0 = new THREE.Vector3(26, -14, -30), W1 = new THREE.Vector3(0.3, 0.5, -3);
        whale.position.copy(W0).lerp(W1, sw); whale.position.y += 0; tmpP.copy(W1).sub(W0).normalize();
        whale.rotation.set(0, 0, 0); whale.lookAt(whale.position.clone().add(tmpP)); whale.rotateZ(0.0);
        const open = ramp(t, T_UNDER + 1.3, 0.8) * (1 - ramp(t, 13.6, 0.5));
        whale.userData.jaw.rotation.x = open * 0.45; 
        whale.userData.tail.rotation.x = Math.sin(t * 2.2) * 0.25;
        jonahU.visible = t < 13.45;
        P.exposure = 1.05; P.bloom = 0.6; P.bloomThreshold = 0.7; P.sat = 0.9;
        camera.position.set(-6 - u * 0.5, -1.5 - u * 0.4, 13 + u * 0.8); camera.lookAt(1, 3 - u * 0.4, -3);
        handheld(camera, t, 0.006);
      } else if (t < T_FURN) { // ---- золотой истукан
        show(gC);
        setSky('#3a5a8a', '#e8b07a', '#6a4a30', [1.0, 0.3, -0.6], '#fff0d0', 0.03, 0.8);
        scene.fog.color.set('#c09870'); scene.fog.density = 0.0025;
        hemi.color.set('#b0c0e0'); hemi.groundColor.set('#6a4a30'); hemi.intensity = 0.7; sun.color.set('#ffe0b0'); sun.intensity = 2.6; sun.position.set(300, 90, -180 + IDZ); sun.target.position.set(0, 0, IDZ);
        P.exposure = 0.92; P.bloom = 0.55; P.bloomThreshold = 0.82;
        cameraPath(camera, [[C.furnace, [2.6, 1.5, IDZ + 96], [0, 15, IDZ]], [T_FURN, [1.8, 1.6, IDZ + 93.5], [0, 18, IDZ]]], t);
        handheld(camera, t, 0.003);
      } else if (t < C.lions) { // ---- печь
        show(gF); sky.visible = true;
        setSky('#05060a', '#2a1208', '#050302', [0, 0.2, -1], '#000', 0, 0);
        scene.fog.color.set('#1a0a04'); scene.fog.density = 0.01;
        hemi.color.set('#6a3a20'); hemi.groundColor.set('#100804'); hemi.intensity = 0.4; sun.intensity = 0;
        const fl = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.7);
        furnL.intensity = 70 * fl; mouthGlow.material.opacity = 0.18 + 0.05 * fl;
        walkers.forEach((w, i) => { const ph = t * 0.55 + i * 0.27; w.position.set(-3.4 + i * 2.2 + Math.sin(t * 0.25 + i) * 0.4, 0, -5.5 + Math.sin(t * 0.3 + i * 2) * 0.5); w.rotation.y = 0.9 + Math.sin(t * 0.2) * 0.1; lib.walkPose(w, ph * 1.2, 0.8); });
        fourthGlow.position.set(walkers[3].position.x, 1.4, walkers[3].position.z); fourthGlow.material.opacity = 0.55 + 0.1 * Math.sin(t * 2);
        P.exposure = 0.9; P.bloom = 0.6; P.bloomThreshold = 0.82; P.contrast = 1.1;
        cameraPath(camera, [[T_FURN, [2.5, 2.2, 24], [0, 3.6, -5]], [C.lions, [0.6, 1.7, 9.5], [0, 2.0, -6]]], t);
        handheld(camera, t, 0.004);
      } else { // ---- ров со львами / Есфирь
        const den = t < C.esther;
        if (den) {
          show(gD);
          const ang = ramp(t, 30.6, 2.4);
          setSky('#05091a', '#1a2440', '#05060a', [-0.3, 0.7, -0.6], '#d8e4ff', 0.02, 0.4, 1.3);
          scene.fog.color.set('#0a1020'); scene.fog.density = 0.012;
          hemi.color.set('#4a5a8a'); hemi.groundColor.set('#0a0a0c'); hemi.intensity = 0.3 + ang * 0.1; sun.intensity = 0; moonL.intensity = 0.35;
          angelU.op.value = ang * 0.2; angelPool.material.opacity = ang * 0.3; angelL.intensity = ang * 14; angelL.visible = ang > 0.001; angelMotes.u.opacity.value = ang * 0.8;
          daniel.parts.arms[0].rotation.set(lerp(-0.75, -1.9, ang), 0, lerp(0.5, -0.3, ang)); daniel.parts.arms[1].rotation.set(lerp(-0.75, -1.9, ang), 0, lerp(-0.5, 0.3, ang));
          const lie = ramp(t, T_LIE, 1.8);
          lions.forEach((L, i) => {
            const T0 = C.lions, D = 1.6; const tt = Math.min(t, T_LIE) - T0; const extra = t > T_LIE ? D * (1 - Math.exp(-(t - T_LIE) / D)) : 0;
            const a = L.a0 + L.dir * L.w * (tt + extra); const R = L.R + lie * 0.4;
            L.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
            const face = Math.atan2(L.dir * Math.cos(a), -L.dir * Math.sin(a)) * -1; // по касательной
            const vx = -Math.sin(a) * L.dir, vz = Math.cos(a) * L.dir; const yawWalk = Math.atan2(-vz, vx); const yawIn = Math.atan2(Math.sin(a), -Math.cos(a)); void face;
            L.rotation.y = angLerp(yawWalk, yawIn, lie);
            const gait = (1 - lie) * 1; const ph = t * 1.6 * L.w * 3 + i;
            L.parts.legs.forEach((lg, j) => { const off = (j === 0 || j === 3) ? 0 : Math.PI; lg.rotation.z = lerp(Math.sin(ph * Math.PI * 2 / 3 + off) * 0.38 * gait, j < 2 ? 1.45 : 1.35, lie); });
            L.parts.inner.position.y = -lie * 0.6 + Math.abs(Math.sin(ph)) * 0.03 * gait;
            L.parts.head.rotation.z = Math.sin(t * 0.7 + i) * 0.12 * gait - lie * 0.25; L.parts.head.rotation.y = Math.sin(t * 0.5 + i * 2) * 0.3 * gait;
          });
          if (t < C.angel) {
            cameraPath(camera, [[C.lions, [8.6, 3.0, 3.4], [0, 0.9, 0]], [C.angel, [7.6, 2.3, -4.6], [0, 1.0, 0]]], t);
            S.quote.y = 0.5;
          } else {
            cameraPath(camera, [[C.angel, [8.4, 2.3, 3.6], [0, 1.5, 0]], [C.esther, [7.4, 2.0, 3.1], [0, 1.7, 0]]], t);
            S.quote.y = 0.3;
          }
          P.exposure = 1.0; P.bloom = 0.6; P.bloomThreshold = 0.75; P.sat = 0.85; P.tint = [0.95, 0.98, 1.05];
          handheld(camera, t, 0.003);
        } else { // ---- Есфирь
          show(gE); sky.visible = false;
          scene.fog.color.set('#1a0e08'); scene.fog.density = 0.016;
          hemi.color.set('#9a7a5a'); hemi.groundColor.set('#2a1a10'); hemi.intensity = 0.7; sun.color.set('#ffc890'); sun.intensity = 1.1; sun.position.set(-40, 50, 30); sun.target.position.set(0, 0, 0);
          braziers.forEach((g, i) => (g.material.opacity = 0.4 + 0.08 * Math.sin(t * 9 + i)));
          const wk = clamp((t - C.esther) / 6.2); const qz = lerp(30, -15.5, lib.easeOut(wk) * 0.3 + wk * 0.7);
          queen.position.set(0, 0, qz); queen.rotation.y = Math.PI; lib.walkPose(queen, (t - C.esther) * 0.75, 0.5 * (1 - ramp(t, C.esther + 6.0, 0.6)));
          const ext = ramp(t, 42.6, 1.0); king.parts.arms[1].rotation.set(lerp(-0.25, -1.25, ext), 0, 0.12); scGlow.material.opacity = ext * 0.8;
          P.exposure = 1.0; P.bloom = 0.6; P.bloomThreshold = 0.72;
          if (t < 41.6) cameraPath(camera, [[C.esther, [0.6, 1.2, 37.5], [0, 2.4, -26]], [41.6, [0.4, 1.4, qz + 5.5], [0, 2.6, -26]]], t);
          else cameraPath(camera, [[41.6, [-7.5, 1.9, -7.5], [0.6, 2.2, -21]], [S.dur, [-6.6, 2.1, -9.5], [0.3, 2.3, -21.5]]], t);
          handheld(camera, t, 0.003);
        }
      }
      sun.visible = sun.intensity > 0.001;
      sky.position.copy(camera.position);
    },
  };
}
