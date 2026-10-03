// Авраам: ночь в пустыне, шатёр и костёр, старик с посохом → взгляд в звёздное небо (Млечный Путь) →
// двенадцать костров загораются кольцом по барханам (12 колен) → рассвет над Нилом, пирамиды, караван идёт в Египет.
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, rng, fbm, cameraPath, handheld } = lib;
  const C = meta.cues; const VIEW_D = -0.38;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#0a1020', 0.006);
  const col = (c) => new THREE.Color(c);
  function look(keys, t) {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, a] = keys[i], [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
    const k = t1 > t0 ? lib.smooth(0, 1, (t - t0) / (t1 - t0)) : 0; const o = {};
    for (const n in a) o[n] = typeof a[n] === 'number' ? lerp(a[n], b[n], k) : col(a[n]).lerp(col(b[n]), k);
    return o;
  }
  function taperTube(pts, r0, r1, seg = 16, rad = 6) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, seg, 1, rad, false); const pos = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) { const c = curve.getPointAt(i / seg); const r = lerp(r0, r1, i / seg); for (let j = 0; j <= rad; j++) { const idx = i * (rad + 1) + j; v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c); pos.setXYZ(idx, v.x, v.y, v.z); } }
    g.computeVertexNormals(); return g;
  }
  function mergeGeos(geos) {
    const posA = [], norA = [], idx = []; let off = 0;
    for (const g0 of geos) { const g = g0.index ? g0 : g0.setIndex([...Array(g0.attributes.position.count).keys()]); const p = g.attributes.position, nn = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { posA.push(p.getX(i), p.getY(i), p.getZ(i)); norA.push(nn.getX(i), nn.getY(i), nn.getZ(i)); }
      for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); off += p.count; }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(norA, 3)); m.setIndex(idx); return m;
  }

  // ---------- небо ----------
  const sky = lib.skyDome({ top: '#02040c', horizon: '#121a34', bottom: '#05060a', sunDir: [0.3, -0.3, -1], sunColor: '#ffd0a0', sunSize: 0.03, sunGlow: 0, stars: 1.0 });
  scene.add(sky);
  // Млечный Путь: полоса по большому кругу с пылевыми прожилками
  const LQ = new THREE.Vector3(-0.47, 0.41, -0.78).normalize(); // направление взгляда в кадре «звёзды»
  const mwN = new THREE.Vector3().crossVectors(LQ, new THREE.Vector3(0.75, 0.66, 0)).normalize().addScaledVector(LQ, 0.22).normalize();
  const mwU = { op: { value: 1 }, n: { value: mwN }, time: { value: 0 } };
  const mw = new THREE.Mesh(new THREE.SphereGeometry(880, 48, 24), new THREE.ShaderMaterial({
    uniforms: mwU, side: THREE.BackSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: lib.GLSL_NOISE + `uniform float op; uniform vec3 n; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float b = dot(d, n);
        vec3 u = normalize(cross(n, vec3(0.,1.,0.))); vec3 w = cross(n, u); vec2 q = vec2(atan(dot(d,w), dot(d,u))*9., b*16.);
        float band = exp(-b*b*28.); float core = exp(-b*b*90.);
        float cl = fbm2(q*1.3 + 3.) ; float dust = smoothstep(.45, .7, fbm2(q*2.6 + vec2(7.,1.)) + b*1.5);
        vec3 c = vec3(.42,.5,.85)*band*(.25 + .7*cl*cl) + vec3(1.,.78,.55)*core*cl*.6;
        c *= 1. - dust*.75*band;
        c *= smoothstep(-.05, .2, d.y);
        gl_FragColor = vec4(c*op*.3, 1.); }`,
  }));
  mw.renderOrder = -9; mw.frustumCulled = false; scene.add(mw);
  const stars = lib.starfield({ count: 14000, radius: 850, size: 3.4, minY: -0.05, seed: 3 }); scene.add(stars);
  // звёзды, сгущённые вдоль Млечного Пути
  const mwStars = (() => { const r = rng(44), n = 6000, p = new Float32Array(n * 3), sd = new Float32Array(n), sz = new Float32Array(n);
    const u = new THREE.Vector3().crossVectors(mwN, new THREE.Vector3(0, 1, 0)).normalize(), w = new THREE.Vector3().crossVectors(mwN, u);
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2; const g = (r() + r() + r() - 1.5) * 0.18; const d = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(w, Math.sin(a)).addScaledVector(mwN, g).normalize().multiplyScalar(840);
      if (d.y < -20) { i--; continue; } p.set([d.x, d.y, d.z], i * 3); sd[i] = r() * 100; sz[i] = Math.pow(r(), 5) * 2.5 + 0.35; }
    const s = lib.starfield({ count: 10, seed: 1 }); s.geometry.setAttribute('position', new THREE.BufferAttribute(p, 3)); s.geometry.setAttribute('seed', new THREE.BufferAttribute(sd, 1)); s.geometry.setAttribute('sz', new THREE.BufferAttribute(sz, 1)); s.u.size.value = 3.0; return s; })();
  scene.add(mwStars);
  const moon = new THREE.DirectionalLight('#8aa4e0', 0.55); moon.position.set(-60, 80, 40); scene.add(moon);
  const hemi = new THREE.HemisphereLight('#3a4a78', '#140e08', 0.35); scene.add(hemi);

  // ================= ночная пустыня =================
  const gN = new THREE.Group(); scene.add(gN);
  const hD = (x, z) => {
    const r = Math.hypot(x, z); const dune = Math.sin(x * 0.045 + Math.sin(z * 0.025) * 2.2 + fbm(x * 0.01, z * 0.01, 2) * 2) * 3.2 + fbm(x * 0.015, z * 0.015, 4) * 6;
    return lerp(dune, fbm(x * 0.05, z * 0.05, 2) * 0.3, lib.smooth(30, 8, r));
  };
  const sand = lib.terrain({ size: 700, seg: 180, heightFn: hD, colorFn: (x, z, y, sl) => col('#9a7a58').lerp(col('#c8a070'), clamp(y / 8 + 0.4)).multiplyScalar(0.9 + 0.2 * lib.noise2(x * 0.3, z * 0.3)), roughness: 1 });
  gN.add(sand);
  // шатёр
  const tentM = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 1, side: THREE.DoubleSide });
  const tent = new THREE.Group(); tent.position.set(-3, hD(-3, -2), -2); tent.rotation.y = 0.5; gN.add(tent);
  const tg = new THREE.ConeGeometry(3.4, 3.2, 7, 1, true); tg.translate(0, 1.6, 0); const tentMesh = new THREE.Mesh(tg, tentM); tentMesh.scale.set(1.35, 1, 1); tent.add(tentMesh);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), new THREE.MeshBasicMaterial({ color: '#8a3a12' })); door.position.set(0, 0.9, 3.0); door.rotation.x = -0.2; tent.add(door);
  const doorGlow = lib.glow('#ff9040', 4, 0.4); doorGlow.position.set(0, 1, 3.2); tent.add(doorGlow);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.2, 5), new THREE.MeshStandardMaterial({ color: '#2a1a10' })); pole.position.y = 2.1; tent.add(pole);
  // костёр
  const FIRE = new THREE.Vector3(1.8, hD(1.8, 2.5), 2.5);
  const camp = lib.fire({ count: 260, radius: 0.45, height: 1.8, size: 30, seed: 5 }); camp.position.copy(FIRE); gN.add(camp);
  const campGlow = lib.glow('#ff8a3a', 6, 0.55); campGlow.position.copy(FIRE).add(new THREE.Vector3(0, 0.8, 0)); gN.add(campGlow);
  const campLight = new THREE.PointLight('#ff8a40', 25, 30, 1.6); campLight.position.copy(FIRE).add(new THREE.Vector3(0, 1.2, 0)); gN.add(campLight);
  const embers = lib.motes({ count: 50, box: [2.5, 4, 2.5], center: [FIRE.x, FIRE.y + 2, FIRE.z], size: 2.0, color: '#ffa050', speed: 0.6, kind: 'embers', opacity: 0.9, seed: 6 }); gN.add(embers);
  const stoneG = new THREE.DodecahedronGeometry(0.22, 0); const stoneM = new THREE.MeshStandardMaterial({ color: '#3a3028' });
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const s = new THREE.Mesh(stoneG, stoneM); s.position.set(FIRE.x + Math.cos(a) * 0.65, FIRE.y + 0.08, FIRE.z + Math.sin(a) * 0.65); gN.add(s); }
  // Авраам
  const abr = lib.figure({ height: 1.75, robe: '#5a4636', skin: '#8a6048', hood: true, hoodColor: '#6a5a48', staff: true, seed: 12 });
  abr.position.set(4.0, hD(4.0, 4.6), 4.6); abr.rotation.y = -2.4; gN.add(abr);
  abr.parts.body.rotation.x = 0.06;
  // верблюды у шатра (силуэты)
  function camel(scale = 1, colr = '#3a2a1c') {
    const m = new THREE.MeshStandardMaterial({ color: colr, roughness: 1 }); const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), m); body.scale.set(1.5, 0.75, 0.7); body.position.y = 1.9; g.add(body);
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), m); hump.position.set(0, 2.45, 0); hump.scale.set(1.1, 0.9, 0.9); g.add(hump);
    const neck = new THREE.Mesh(taperTube([[1.0, 2.0, 0], [1.6, 2.3, 0], [1.8, 2.9, 0]], 0.28, 0.17, 8, 6), m); g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), m); head.scale.set(1.8, 0.9, 0.9); head.position.set(2.05, 2.95, 0); g.add(head);
    const legs = []; for (const [x, z] of [[0.75, 0.3], [0.75, -0.3], [-0.75, 0.3], [-0.75, -0.3]]) { const p = new THREE.Group(); p.position.set(x, 1.6, z); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 1.6, 5), m); l.position.y = -0.8; p.add(l); g.add(p); legs.push(p); }
    g.scale.setScalar(scale); g.legs = legs; return g;
  }
  const camelA = camel(1); camelA.position.set(-8, hD(-8, 3), 3); camelA.rotation.y = 0.9; gN.add(camelA);
  // 12 костров кольцом по барханам + 12 звёзд
  const ring = []; const RR = rng(12);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + 0.2, d = 46 + RR() * 10; const x = Math.cos(a) * d, z = Math.sin(a) * d - 10; const y = hD(x, z);
    const f = lib.fire({ count: 70, radius: 0.5, height: 2.2, size: 60, seed: 20 + i }); f.position.set(x, y, z); gN.add(f);
    const gl = lib.glow('#ff8a3a', 12, 0); gl.position.set(x, y + 1.2, z); gN.add(gl);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ map: lib.radialTexture(), color: '#ff7a30', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, y + 0.4, z); gN.add(pool);
    const tn = new THREE.Mesh(tg, tentM); tn.scale.set(0.8, 0.7, 0.8); tn.position.set(x + 3, hD(x + 3, z - 2), z - 2); gN.add(tn);
    ring.push({ f, gl, pool });
  }
  const tribeStars = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const s = lib.glow('#e8f0ff', 26, 0); s.position.set(Math.cos(a) * 180, 260 + Math.sin(a) * 40, -420 + Math.sin(a) * 120); scene.add(s); tribeStars.push(s); }

  // ================= Египет на рассвете =================
  const gE = new THREE.Group(); scene.add(gE);
  const hE = (x, z) => { const ax = Math.abs(x + Math.sin(z * 0.01) * 15); const river = -2.2 * lib.smooth(22, 14, ax); const bank = lib.smooth(40, 70, ax) * (3 + fbm(x * 0.01, z * 0.01, 3) * 6);
    return river + bank + fbm(x * 0.06, z * 0.06, 2) * 0.3; };
  const nileLand = lib.terrain({ size: 900, seg: 170, heightFn: hE, colorFn: (x, z, y) => { const ax = Math.abs(x + Math.sin(z * 0.01) * 15); return col('#3a5a24').lerp(col('#6a7a30'), clamp(lib.noise2(x * 0.05, z * 0.05) * 0.5 + 0.5)).lerp(col('#c8a06a'), lib.smooth(34, 48, ax)).lerp(col('#4a3a28'), lib.smooth(16, 12, ax)); } });
  gE.add(nileLand);
  const nile = lib.ocean({ size: 900, seg: 90, deep: '#0a2028', shallow: '#2a4a50', sky: '#f0a070', amp: 0.04, choppy: 0.3, foam: 0, sunDir: [-0.15, 0.06, -1], sunColor: '#ffc080' });
  nile.position.y = -0.6; gE.add(nile);
  const sandM = new THREE.MeshStandardMaterial({ color: '#d8b080', roughness: 0.95, flatShading: true });
  [[-120, -420, 70], [-20, -470, 90], [70, -400, 55]].forEach(([x, z, h]) => { const p = new THREE.Mesh(new THREE.ConeGeometry(h * 0.78, h, 4), sandM); p.position.set(x, hE(x, z) + h / 2 - 1, z); p.rotation.y = Math.PI / 4 + 0.15; gE.add(p); });
  // пальмы
  const palmTrunks = [], palmLeaves = []; const RP = rng(31);
  const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(1.6, 0.5, 4.2, 0); leafShape.quadraticCurveTo(1.6, -0.5, 0, 0);
  for (let i = 0; i < 46; i++) {
    const side = RP() < 0.5 ? -1 : 1; const z = 60 - RP() * 360; const x = -Math.sin(z * 0.01) * 15 + side * (17 + RP() * 20); const y = hE(x, z) - 0.2;
    const h = 7 + RP() * 5, lean = (RP() - 0.5) * 2.2; const top = [x + lean, y + h, z + (RP() - 0.5) * 1.5];
    palmTrunks.push(taperTube([[x, y, z], [x + lean * 0.3, y + h * 0.5, z], top], 0.32, 0.18, 8, 5));
    for (let k = 0; k < 9; k++) { const lg = new THREE.ShapeGeometry(leafShape, 3); const p = lg.attributes.position; for (let j = 0; j < p.count; j++) { const lx = p.getX(j); p.setZ(j, -lx * lx * 0.08); } lg.rotateX(-Math.PI / 2); lg.rotateZ(-0.25 + RP() * 0.3); lg.rotateY(k / 9 * Math.PI * 2 + RP() * 0.4);
      lg.translate(...top); lg.computeVertexNormals(); palmLeaves.push(lg); }
  }
  gE.add(new THREE.Mesh(mergeGeos(palmTrunks), new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 1 })));
  gE.add(new THREE.Mesh(mergeGeos(palmLeaves), new THREE.MeshStandardMaterial({ color: '#3a5a22', roughness: 0.9, side: THREE.DoubleSide })));
  // караван
  const caravan = []; const RC = rng(7);
  for (let i = 0; i < 9; i++) {
    const isCamel = i % 3 === 1; const o = isCamel ? camel(0.9, '#5a4028') : lib.figure({ height: 1.7 + RC() * 0.15, robe: ['#6a4a32', '#4a3a2a', '#7a5a3a', '#3a3040'][i % 4], hood: true, staff: i % 4 === 0, seed: 40 + i });
    gE.add(o); caravan.push({ o, isCamel, off: i * 3.2 + RC() * 0.8, side: (RC() - 0.5) * 2.4, ph: RC() });
  }
  const dustE = lib.motes({ count: 400, box: [80, 14, 120], center: [-20, 5, -40], size: 4, color: '#ffd0a0', speed: 0.2, opacity: 0.45, seed: 17 }); gE.add(dustE);
  const birds = new THREE.Group(); { const bm = new THREE.MeshBasicMaterial({ color: '#2a1a14', side: THREE.DoubleSide }); for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.8, 0.25, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.8, 0.25, 0), new THREE.Vector3(0, 0.08, 0.25)]).setIndex([0, 1, 3, 1, 2, 3]), bm); b.position.set(i * 3 - 10 + (i % 2) * 1.5, (i % 3) * 1.2, -i * 2.5); birds.add(b); } }
  gE.add(birds);

  // ---------- образы ----------
  const LN = { top: '#02040c', hor: '#121a34', bot: '#05060a', fog: '#0a1020', fogD: 0.006, moon: 0.55, hemi: 0.35, stars: 1.0, mw: 1.0, sunY: -0.3, glow: 0, exp: 1.0, sat: 1.0 };
  const LS = { ...LN, top: '#010309', hor: '#0c1430', mw: 1.25, fogD: 0.005, exp: 1.05 };
  const LE = { top: '#24406e', hor: '#e08858', bot: '#3a2418', fog: '#a86a4a', fogD: 0.0022, moon: 0, hemi: 0.55, stars: 0, mw: 0, sunY: 0.035, glow: 0.55, exp: 0.82, sat: 1.05 };
  const LE2 = { ...LE, top: '#3a5e92', hor: '#f0a070', sunY: 0.07, fogD: 0.002, exp: 0.85 };
  const looks = [[0, LN], [C.stars - 1.5, LN], [C.stars, LS], [C.tribes - 0.01, LS], [C.tribes, LN], [C.egypt - 0.01, LN], [C.egypt, LE], [39.4, LE2]];

  return {
    scene, camera,
    update(t, S) {
      const Lk = look(looks, t); const egypt = t >= C.egypt;
      gN.visible = !egypt; gE.visible = egypt;
      sky.u.top.value.copy(Lk.top); sky.u.horizon.value.copy(Lk.hor); sky.u.bottom.value.copy(Lk.bot); sky.u.starAmt.value = 0;
      sky.u.sunDir.value.set(egypt ? 0.38 : -0.15, Lk.sunY, -1).normalize(); sky.u.sunGlow.value = Lk.glow; sky.u.sunColor.value.set('#ffc890');
      scene.fog.color.copy(Lk.fog); scene.fog.density = Lk.fogD;
      moon.intensity = Lk.moon; hemi.intensity = Lk.hemi; mwU.op.value = Lk.mw; stars.u.opacity.value = Lk.stars; mwStars.u.opacity.value = Lk.stars;
      mw.visible = stars.visible = mwStars.visible = !egypt;
      stars.rotation.y = mwStars.rotation.y = mw.rotation.y = t * 0.004;
      S.post.exposure = Lk.exp; S.post.sat = Lk.sat; S.post.bloom = 0.65; S.post.bloomThreshold = 0.7;

      // костёр мерцает
      campLight.intensity = 25 * (0.85 + 0.1 * Math.sin(t * 11) + 0.05 * Math.sin(t * 23));
      // 12 костров: Исаак, Иаков, затем все двенадцать
      const ign = (i) => i === 0 ? 18.5 : i === 1 ? 20.0 : 23.2 + (i - 2) * 0.28;
      ring.forEach(({ f, gl, pool }, i) => { const k = ramp(t, ign(i), 0.6); f.u.intensity.value = k * 1.3; gl.material.opacity = k * 0.55 * (0.9 + 0.1 * Math.sin(t * 7 + i)); pool.material.opacity = k * 0.35; f.visible = k > 0.001; });
      tribeStars.forEach((s, i) => { const k = ramp(t, 23.4 + i * 0.25, 1.2) * (1 - ramp(t, C.egypt - 0.5, 0.5)); s.material.opacity = k * 0.8 * (0.85 + 0.15 * Math.sin(t * 3 + i)); });

      if (t < C.stars) {
        // общий план лагеря → камера поднимает взгляд к небу
        abr.rotation.y = -2.4; abr.parts.arms[0].rotation.x = 0;
        const up = ramp(t, 4.4, 2.8);
        cameraPath(camera, [[0, [13, 2.0, 15], [0, 1.6, 0]], [C.stars, [11, 1.8, 12.5], [0, 2.2, -1]]], t);
        const tgt = new THREE.Vector3(0, 2.2, -1); camera.lookAt(lerp(0.5, -4, up), lerp(1.8, 22, up * up), lerp(0, -6, up));
        handheld(camera, t, 0.004);
      } else if (t < C.tribes) {
        // взгляд в небо: фигура маленькая внизу кадра
        const k = (t - C.stars) / (C.tribes - C.stars);
        const cx = 6.9 - k * 0.5, cz = 7.3 - k * 0.4; camera.position.set(cx, hD(cx, cz) + 0.45, cz);
        const ca = Math.atan2(abr.position.x - cx, abr.position.z - cz) + VIEW_D, pit = lerp(0.42, 0.5, k);
        camera.lookAt(cx + Math.sin(ca) * 30, camera.position.y + Math.tan(pit) * 30, cz + Math.cos(ca) * 30);
        abr.rotation.y = ca; abr.parts.arms[0].rotation.x = -0.2 - 0.5 * ramp(t, C.stars + 2, 2);
        handheld(camera, t, 0.003);
      } else if (t < C.egypt) {
        // кран вверх: кольцо костров
        abr.parts.arms[0].rotation.x = 0;
        cameraPath(camera, [[C.tribes, [6, 6, 34], [0, 1, -6]], [22.5, [8, 16, 70], [0, 0, -14]], [C.egypt, [10, 30, 102], [0, -2, -14]]], t);
        handheld(camera, t, 0.003);
      } else {
        // Нил на рассвете, караван
        const st = t - C.egypt;
        nile.u.skyc.value.copy(Lk.hor).multiplyScalar(0.55); nile.u.sunDir.value.copy(sky.u.sunDir.value);
        nile.u.fogColor.value.copy(Lk.fog); nile.u.fogDensity.value = Lk.fogD;
        caravan.forEach(({ o, isCamel, off, side, ph }) => {
          const z = 18 - st * 1.35 - off; const x = -Math.sin(z * 0.01) * 15 - 24 + side; o.position.set(x, hE(x, z), z); o.rotation.y = Math.PI + 0.05;
          if (isCamel) { o.rotation.y = Math.PI / 2 + 0.05; o.legs.forEach((l, j) => (l.rotation.z = Math.sin((t * 1.6 + ph + (j % 2) * 0.5) * Math.PI * 2) * 0.3)); }
          else lib.walkPose(o, t * 0.75 + ph, 1);
        });
        birds.position.set(-30 + st * 4, 26 + Math.sin(st * 0.5) * 2, -60 - st * 2); birds.children.forEach((b, i) => (b.scale.y = 0.6 + 0.4 * Math.sin(t * 8 + i)));
        if (t < 33.2) cameraPath(camera, [[C.egypt, [-60, 22, 70], [-10, 6, -120]], [33.2, [-52, 16, 52], [-14, 6, -140]]], t);
        else { const zc = 18 - st * 1.35; cameraPath(camera, [[33.2, [-11, 2.4, zc - 2], [-34, 2.6, zc - 32]], [39.4, [-11.5, 2.6, zc - 4], [-34, 2.8, zc - 36]]], t); }
        handheld(camera, t, 0.003);
      }
    },
  };
}
