// Исход: неопалимая купина на склоне Хорива → Египет: Нил становится кровью, тьма → ночной берег, народ и
// колесницы позади → море расступается (две стены воды) → люди идут посуху между светящимися стенами.
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, rng, fbm, cameraPath, handheld } = lib;
  const C = meta.cues;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#2a1a24', 0.008);
  const col = (c) => new THREE.Color(c);
  function look(keys, t) {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, a] = keys[i], [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
    const k = t1 > t0 ? lib.smooth(0, 1, (t - t0) / (t1 - t0)) : 0; const o = {};
    for (const n in a) o[n] = typeof a[n] === 'number' ? lerp(a[n], b[n], k) : col(a[n]).lerp(col(b[n]), k);
    return o;
  }
  function taperTube(pts, r0, r1, seg = 10, rad = 5) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, seg, 1, rad, false); const pos = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) { const c = curve.getPointAt(i / seg); const r = lerp(r0, r1, i / seg); for (let j = 0; j <= rad; j++) { const idx = i * (rad + 1) + j; v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c); pos.setXYZ(idx, v.x, v.y, v.z); } }
    g.computeVertexNormals(); return g;
  }
  function mergeGeos(geos) {
    const posA = [], norA = [], idx = []; let off = 0;
    for (const g of geos) { const p = g.attributes.position, nn = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { posA.push(p.getX(i), p.getY(i), p.getZ(i)); norA.push(nn.getX(i), nn.getY(i), nn.getZ(i)); }
      for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); off += p.count; }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(norA, 3)); m.setIndex(idx); return m;
  }
  const T_BLOOD = 21.0, T_DARK = 23.1, T_DEATH = 23.9, T_FIRE = 6.3;

  // ---------- общее небо/свет ----------
  const sky = lib.skyDome({ top: '#1a1830', horizon: '#d07850', bottom: '#2a1810', sunDir: [0.4, 0.02, -1], sunColor: '#ff9a60', sunSize: 0.035, sunGlow: 0.8, stars: 0 });
  scene.add(sky);
  const stars = lib.starfield({ count: 5000, radius: 850, size: 2.6, minY: 0.0, seed: 9 }); scene.add(stars);
  const sun = new THREE.DirectionalLight('#ffb080', 1.2); sun.position.set(80, 30, -100); scene.add(sun);
  const hemi = new THREE.HemisphereLight('#6a6a9a', '#201410', 0.4); scene.add(hemi);

  // ================= A. Купина =================
  const gA = new THREE.Group(); scene.add(gA);
  const hM = (x, z) => 0.18 * (-z) + fbm(x * 0.04, z * 0.04, 5) * 4 * lib.smooth(6, 22, Math.hypot(x + 2, z - 1)) + fbm(x * 0.1, z * 0.1, 2) * 0.4 + Math.abs(fbm(x * 0.012 + 3, z * 0.012, 3)) * 18 * lib.smooth(30, 120, -z) + lib.smooth(-20, -90, x) * 0;
  const slope = lib.terrain({ size: 420, seg: 150, center: [0, -120], heightFn: hM, colorFn: (x, z, y, sl) => col('#5a4030').lerp(col('#8a6a48'), clamp(lib.noise2(x * 0.2, z * 0.2) * 0.5 + 0.5)).lerp(col('#3a2a22'), sl * 1.6) });
  gA.add(slope);
  const rockG = new THREE.DodecahedronGeometry(1, 0); const rockM = new THREE.MeshStandardMaterial({ color: '#4a3a30', roughness: 1, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockG, rockM, 60); { const r = rng(3), m4 = new THREE.Matrix4(); for (let i = 0; i < 60; i++) { const x = (r() - 0.5) * 70, z = -r() * 60 + 8; const s = 0.25 + r() * 0.8; if (Math.hypot(x + 10, z - 10) < 7) { i--; continue; } m4.compose(new THREE.Vector3(x, hM(x, z) + s * 0.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), new THREE.Vector3(s, s * 0.7, s)); rocks.setMatrixAt(i, m4); } }
  gA.add(rocks);
  const BUSH = new THREE.Vector3(2, hM(2, -6), -6);
  const bushGeos = []; { const r = rng(21); for (let i = 0; i < 22; i++) { const a = r() * Math.PI * 2, l = 0.35 + r() * 0.7, hgt = 0.9 + r() * 1.1;
      const mid = [Math.cos(a) * l * 0.5, hgt * 0.5, Math.sin(a) * l * 0.5], tip = [Math.cos(a) * l, hgt, Math.sin(a) * l];
      bushGeos.push(taperTube([[Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08], [mid[0] * 0.8, mid[1], mid[2] * 0.8], tip], 0.06, 0.012, 6, 4));
      for (let k = 0; k < 2; k++) { const b2 = a + (r() - 0.5) * 1.6, l2 = 0.25 + r() * 0.35; bushGeos.push(taperTube([mid, [mid[0] + Math.cos(b2) * l2 * 0.6, mid[1] + 0.25 + r() * 0.2, mid[2] + Math.sin(b2) * l2 * 0.6], [mid[0] + Math.cos(b2) * l2, mid[1] + 0.45 + r() * 0.4, mid[2] + Math.sin(b2) * l2]], 0.03, 0.008, 4, 3)); } } }
  const bush = new THREE.Mesh(mergeGeos(bushGeos), new THREE.MeshStandardMaterial({ color: '#1a120c', roughness: 1 })); bush.position.copy(BUSH); gA.add(bush);
  const bushFire = [lib.fire({ count: 300, radius: 0.85, height: 2.2, size: 26, seed: 2, color1: '#ffb860', color2: '#ff4a10' }), lib.fire({ count: 120, radius: 0.5, height: 3.0, size: 20, seed: 3, color1: '#ffd080', color2: '#ff6a18' })];
  bushFire.forEach((f) => { f.position.copy(BUSH); gA.add(f); });
  const bushGlow = lib.glow('#ff8a30', 6, 0); bushGlow.position.copy(BUSH).add(new THREE.Vector3(0, 1.4, 0)); gA.add(bushGlow);
  const bushLight = new THREE.PointLight('#ffa050', 0, 40, 1.5); bushLight.position.copy(BUSH).add(new THREE.Vector3(0, 1.5, 0.5)); gA.add(bushLight);
  const sparks = lib.motes({ count: 120, box: [3, 6, 3], center: [BUSH.x, BUSH.y + 3, BUSH.z], size: 2.2, color: '#ffc070', speed: 0.5, kind: 'embers', opacity: 0, seed: 5 }); gA.add(sparks);
  const moses = lib.figure({ height: 1.8, robe: '#5a4232', skin: '#8a5a3c', hood: true, hoodColor: '#4a3a2c', staff: true, seed: 33 }); gA.add(moses);
  const sheep = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshStandardMaterial({ color: '#b8a890', roughness: 1 }), 14);
  { const r = rng(8), m4 = new THREE.Matrix4(); for (let i = 0; i < 14; i++) { const x = -14 + r() * 8, z = 10 + r() * 8; m4.compose(new THREE.Vector3(x, hM(x, z) + 0.35, z), new THREE.Quaternion(), new THREE.Vector3(1.4, 0.9, 0.9)); sheep.setMatrixAt(i, m4); } }
  gA.add(sheep);

  // ================= B. Египет: казни =================
  const gB = new THREE.Group(); scene.add(gB);
  const nile = lib.ocean({ size: 500, seg: 80, deep: '#0a2028', shallow: '#2a4a50', sky: '#d07850', amp: 0.06, choppy: 0.4, foam: 0, sunDir: [0.4, 0.05, -1], sunColor: '#ffb070' });
  nile.position.set(0, 0, 0); gB.add(nile);
  const bankFar = lib.terrain({ size: 600, seg: 60, center: [0, -260], heightFn: (x, z) => lib.smooth(-40, -60, z) * 3 + fbm(x * 0.02, z * 0.02, 3) * 1.5 - 1.5, color: '#8a6a48' });
  gB.add(bankFar);
  const bankNear = lib.terrain({ size: 200, seg: 40, center: [0, 70], heightFn: (x, z) => lib.smooth(14, 26, z) * 1.6 - 0.8 + fbm(x * 0.05, z * 0.05, 2) * 0.4, color: '#6a5038' });
  gB.add(bankNear);
  const stoneM = new THREE.MeshStandardMaterial({ color: '#c09a70', roughness: 0.95 });
  const pylonG = new THREE.BoxGeometry(18, 26, 7, 1, 1, 1); { const p = pylonG.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.8); p.setZ(i, p.getZ(i) * 0.8); } pylonG.computeVertexNormals(); }
  const palace = new THREE.Group(); palace.position.set(0, 1.5, -95); gB.add(palace);
  [-13, 13].forEach((x) => { const m = new THREE.Mesh(pylonG, stoneM); m.position.set(x, 13, 0); palace.add(m); });
  const gate = new THREE.Mesh(new THREE.BoxGeometry(8, 16, 5), stoneM); gate.position.set(0, 8, 0); palace.add(gate);
  const gateDoor = new THREE.Mesh(new THREE.PlaneGeometry(4, 9), new THREE.MeshBasicMaterial({ color: '#ffa050' })); gateDoor.position.set(0, 4.5, 2.6); palace.add(gateDoor);
  const colG = new THREE.CylinderGeometry(1.1, 1.3, 16, 10);
  for (let i = 0; i < 10; i++) { const c = new THREE.Mesh(colG, stoneM); c.position.set(-60 + i * 5 + (i > 4 ? 70 : 0), 8, 6); palace.add(c); }
  const roofB = new THREE.Mesh(new THREE.BoxGeometry(24, 2, 9), stoneM); roofB.position.set(-50, 17, 6); palace.add(roofB); const roofC = roofB.clone(); roofC.position.x = 50; palace.add(roofC);
  const obeliskG = new THREE.CylinderGeometry(0.9, 1.6, 30, 4, 1); obeliskG.rotateY(Math.PI / 4); const tipG = new THREE.ConeGeometry(1.25, 2.4, 4); tipG.rotateY(Math.PI / 4);
  [[-28, 14], [28, 14]].forEach(([x, z]) => { const o = new THREE.Mesh(obeliskG, stoneM); o.position.set(x, 15, z); palace.add(o); const tp = new THREE.Mesh(tipG, new THREE.MeshStandardMaterial({ color: '#e0b060', metalness: 0.6, roughness: 0.3 })); tp.position.set(x, 31.2, z); palace.add(tp); });
  [[-150, -260, 90], [160, -300, 70]].forEach(([x, z, h]) => { const p = new THREE.Mesh(new THREE.ConeGeometry(h * 0.78, h, 4), stoneM); p.position.set(x, h / 2 - 2, z); p.rotation.y = Math.PI / 4; gB.add(p); });
  const torches = []; [[-9, 27.5], [9, 27.5], [-3.5, 11], [3.5, 11]].forEach(([x, y]) => { const f = lib.fire({ count: 60, radius: 0.3, height: 1.4, size: 40, seed: 50 + x }); f.position.set(x, y, 3.8); palace.add(f); const g = lib.glow('#ff9040', 6, 0.5); g.position.set(x, y + 0.7, 3.8); palace.add(g); torches.push([f, g]); });
  const mosesB = lib.figure({ height: 1.8, robe: '#4a3a2c', hood: true, staff: true, seed: 34 }); mosesB.position.set(-2, 0, 22); mosesB.rotation.y = Math.PI + 0.1; gB.add(mosesB);
  const aaron = lib.figure({ height: 1.75, robe: '#3a3028', hood: true, seed: 35 }); aaron.position.set(-0.6, 0, 23.4); aaron.rotation.y = Math.PI - 0.1; gB.add(aaron);
  const plagueMotes = lib.motes({ count: 600, box: [100, 30, 80], center: [0, 12, -20], size: 3, color: '#ff6040', speed: 0.3, opacity: 0, seed: 77 }); gB.add(plagueMotes);

  // ================= C/D/E. Море =================
  const gS = new THREE.Group(); scene.add(gS);
  const W = 10, HW = 28;
  const hS = (x, z) => { const beach = -0.4 + z * 0.07 + fbm(x * 0.05, z * 0.05, 3) * 0.5; const bed = -1.7 + (fbm(x * 0.08, z * 0.08, 3) * 0.5) * lib.smooth(W - 2, W + 6, Math.abs(x)) + fbm(x * 0.4, z * 0.4, 2) * 0.1; return lerp(bed, Math.min(beach, 3 + fbm(x * 0.02, z * 0.02, 3) * 3), lib.smooth(-8, 4, z)); };
  const seabed = lib.terrain({ size: 700, seg: 200, center: [0, -150], heightFn: hS, colorFn: (x, z, y) => col('#3a3026').lerp(col('#8a7458'), lib.smooth(-4, 6, z)).lerp(col('#2a2a22'), clamp(lib.noise2(x * 0.3, z * 0.3)) * lib.smooth(0, -10, z)) });
  gS.add(seabed);
  // вода с коридором: неравномерная сетка (густо у стен)
  const xs = []; { const push = (a, b, st) => { for (let x = a; x < b - 1e-6; x += st) xs.push(x); };
    push(0, W - 3, 1.0); push(W - 3, W + 4, 0.2); push(W + 4, W + 12, 0.8); push(W + 12, 60, 3); push(60, 320, 13); xs.push(320);
    const half = xs.slice(); xs.length = 0; for (let i = half.length - 1; i > 0; i--) xs.push(-half[i]); half.forEach((x) => xs.push(x)); }
  const zs = []; for (let z = 6; z >= -420; z -= z > -60 ? 1.5 : 4) zs.push(z);
  const wg = new THREE.BufferGeometry(); { const p = new Float32Array(xs.length * zs.length * 3); let k = 0; for (const z of zs) for (const x of xs) { p[k++] = x; p[k++] = 0; p[k++] = z; }
    const idx = []; const nx = xs.length; for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, b, c, d); }
    wg.setAttribute('position', new THREE.BufferAttribute(p, 3)); wg.setIndex(idx); }
  const wU = { time: { value: 0 }, p: { value: 0 }, W: { value: W }, H: { value: HW }, glow: { value: 1 }, deep: { value: col('#03121a') }, mid: { value: col('#0c3a44') }, glowC: { value: col('#2ac0c8') },
    skyc: { value: col('#14203a') }, moonDir: { value: new THREE.Vector3(-0.3, 0.6, -1).normalize() }, moonC: { value: col('#c8d8ff') }, fogC: { value: col('#0a1020') }, fogD: { value: 0.006 }, wave: { value: 0.35 } };
  const water = new THREE.Mesh(wg, new THREE.ShaderMaterial({
    uniforms: wU, side: THREE.DoubleSide,
    vertexShader: `uniform float time, p, W, H, wave; varying vec3 vW; varying vec3 vN; varying float vFace, vCrest, vRise;
      float waves(vec2 q){ return (sin(q.x*.21 + time*1.7) + sin(q.y*.17 - time*1.3 + q.x*.05)*.8 + sin((q.x+q.y)*.43 + time*2.6)*.35)*wave; }
      float hgt(vec2 q, out float face, out float crest){
        float ax = abs(q.x); float rise = smoothstep(.05, 1., p); float open = smoothstep(0., .55, p);
        float Wp = mix(.5, W, open); float zf = smoothstep(2., -22., q.y);
        float wallH = H*rise*zf; float fw = 2.4 + (1.-rise)*10.;
        face = smoothstep(Wp - .3, Wp + fw, ax);
        float plateau = 1. - smoothstep(Wp + 22., Wp + 170., ax);
        float inner = -9.*open;
        crest = exp(-pow((ax - Wp - fw)/1.4, 2.))*rise*zf;
        return mix(inner, wallH*plateau, face) + waves(q)*(1. - .6*face*rise) + sin(q.y*.35 + time*3.)*.5*crest; }
      void main(){ vec3 pos = position; float f, c, f2, c2; float h = hgt(pos.xz, f, c);
        float e = .25; float hx = hgt(pos.xz + vec2(e, 0.), f2, c2), hz = hgt(pos.xz + vec2(0., e), f2, c2);
        vN = normalize(vec3(h - hx, e, h - hz)); pos.y = h; vW = pos; vFace = f; vCrest = c; vRise = smoothstep(.05, 1., p);
        gl_Position = projectionMatrix*viewMatrix*vec4(pos,1.); }`,
    fragmentShader: lib.GLSL_NOISE + `uniform float time, glow, H, fogD; uniform vec3 deep, mid, glowC, skyc, moonDir, moonC, fogC; varying vec3 vW; varying vec3 vN; varying float vFace, vCrest, vRise;
      void main(){ vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n; vec3 v = normalize(cameraPosition - vW);
        float steep = 1. - abs(n.y); float fr = pow(1. - max(dot(n, v), 0.), 4.);
        float flow = fbm2(vec2(vW.z*.07 + vW.x*.05, vW.y*.16 - time*.9));
        vec3 c = mix(deep, mid, .3 + .4*flow*steep);
        float hy = clamp(vW.y/H, 0., 1.);
        c += glowC * steep * glow * (.25 + .75*flow) * (.35 + .65*(1. - hy)) * vRise;
        c = mix(c, skyc, fr*.6);
        float sp = pow(max(dot(reflect(-v, n), moonDir), 0.), 60.); c += moonC*sp*.6;
        float streak = smoothstep(.55, .85, vnoise(vec2(vW.z*.7 + vW.x*.2, vW.y*.12 + time*2.2))) * steep * vRise;
        c = mix(c, vec3(.6,.85,.9), streak*.12);
        float foam = vCrest * smoothstep(.35, .7, vnoise(vec2(vW.z*.5, time*2.)) + .3);
        c = mix(c, vec3(.85,.95,1.), clamp(foam, 0., 1.)*.85);
        float d = length(vW - cameraPosition); c = mix(c, fogC, 1. - exp(-pow(d*fogD, 2.)));
        gl_FragColor = vec4(c, 1.); }`,
  }));
  water.frustumCulled = false; gS.add(water);
  // брызги, срываемые ветром с гребней
  const SP = 5000; const spP = new Float32Array(SP * 3), spS = new Float32Array(SP * 3); { const r = rng(61); for (let i = 0; i < SP; i++) { const s = r() < 0.5 ? -1 : 1; spP.set([s, 0, -r() * 200 + 2], i * 3); spS.set([r(), r(), r()], i * 3); } }
  const spG = new THREE.BufferGeometry(); spG.setAttribute('position', new THREE.BufferAttribute(spP, 3)); spG.setAttribute('sd', new THREE.BufferAttribute(spS, 3));
  const spU = { time: { value: 0 }, p: { value: 0 }, W: { value: W }, H: { value: HW }, pxr: { value: 1 }, op: { value: 0 } };
  const spray = new THREE.Points(spG, new THREE.ShaderMaterial({
    uniforms: spU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 sd; uniform float time, p, W, H, pxr; varying float vA;
      void main(){ float rise = smoothstep(.05, 1., p); float zf = smoothstep(2., -22., position.z); float life = fract(time*(.35 + sd.x*.4) + sd.y);
        float top = H*rise*zf; float side = position.x; float Wp = mix(.5, W, smoothstep(0., .55, p)) + 2.4 + (1.-rise)*10.;
        vec3 q = vec3(side*(Wp + .5 - life*(3. + sd.z*9.)), top + life*(4. + sd.z*6.) - life*life*7., position.z - life*6.);
        vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = min((2. + sd.z*4.)*pxr*(70./max(-mv.z,1.)), 18.);
        vA = sin(life*3.14159)*rise*zf; }`,
    fragmentShader: `uniform float op; varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d); gl_FragColor = vec4(vec3(.7,.9,1.)*a*a*vA*op*.6, 1.); }`,
  }));
  spray.frustumCulled = false; gS.add(spray);
  const mist = lib.motes({ count: 900, box: [60, 26, 160], center: [0, 10, -70], size: 9, color: '#8ac8d8', speed: 0.6, opacity: 0, seed: 71 }); gS.add(mist);
  // народ (инстансы)
  const personG = (() => { const b = new THREE.LatheGeometry([[0, 0], [0.3, 0], [0.27, 0.3], [0.21, 0.8], [0.19, 1.15], [0.23, 1.3], [0.16, 1.42], [0, 1.46]].map(([x, y]) => new THREE.Vector2(x, y)), 8); const h = new THREE.SphereGeometry(0.13, 8, 6); h.scale(1, 1.15, 1.05); h.translate(0, 1.6, 0.0); return mergeGeos([b, h]); })();
  const NP = 800; const crowd = new THREE.InstancedMesh(personG, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#0c2226', emissiveIntensity: 0 }), NP);
  const crowdD = []; { const r = rng(91); const pal = ['#5a4636', '#3a3a44', '#6a5a42', '#4a3024', '#7a6a58', '#2e2a26'].map(col);
    for (let i = 0; i < NP; i++) { crowdD.push({ x: (r() - 0.5) * 2, z: r(), s: 0.85 + r() * 0.3, ph: r(), sp: 0.8 + r() * 0.4, a: (r() - 0.5) * 0.6 }); crowd.setColorAt(i, pal[i % pal.length].clone().multiplyScalar(0.8 + r() * 0.4)); } }
  crowd.frustumCulled = false; gS.add(crowd);
  const mosesS = lib.figure({ height: 1.85, robe: '#5a4232', hood: true, staff: true, seed: 36 }); gS.add(mosesS);
  // факелы колесниц вдали и огненный столп
  const chariots = []; for (let i = 0; i < 26; i++) { const g = lib.glow('#ff8a3a', 3.5, 0.8); g.position.set(-70 + i * 5.5 + Math.sin(i * 7.1) * 2, 0, 180 + Math.sin(i * 3.3) * 8); gS.add(g); chariots.push(g); }
  const pillar = lib.lightBeam({ radiusTop: 4, radiusBottom: 7, length: 90, color: '#ffb060', opacity: 0.5 }); pillar.rotation.x = Math.PI; pillar.position.set(0, -2, 90); gS.add(pillar);
  const pillarGlow = lib.glow('#ff9a40', 40, 0.4); pillarGlow.position.set(0, 12, 90); gS.add(pillarGlow);
  const crowdTorches = []; for (let i = 0; i < 14; i++) { const g = lib.glow('#ffa050', 1.3, 0.9); gS.add(g); crowdTorches.push(g); }

  // ---------- образы ----------
  const LA = { top: '#22224a', hor: '#f09058', bot: '#2a1810', sunC: '#ff9a60', sunY: 0.03, glow: 0.8, fog: '#7a4a40', fogD: 0.006, sunI: 1.6, sunL: '#ffa070', hemi: 0.75, stars: 0.2, exp: 1.0, sat: 1.0 };
  const LA2 = { ...LA, top: '#100f28', hor: '#9a4a40', sunY: -0.01, glow: 0.4, fog: '#2a1c24', sunI: 0.3, hemi: 0.35, stars: 0.5 };
  const LB = { top: '#2a2440', hor: '#e89058', bot: '#3a2418', sunC: '#ffa060', sunY: 0.03, glow: 0.8, fog: '#a06048', fogD: 0.004, sunI: 1.4, sunL: '#ffb070', hemi: 0.5, stars: 0, exp: 0.95, sat: 1.0 };
  const LBr = { ...LB, top: '#2a0a10', hor: '#a02818', fog: '#5a1810', sunC: '#ff3010', sunL: '#ff4020', sunI: 1.0, sat: 1.1 };
  const LBd = { ...LBr, top: '#020203', hor: '#0a0404', bot: '#020202', sunC: '#000000', fog: '#050303', fogD: 0.012, glow: 0, sunI: 0, hemi: 0.05, exp: 0.9 };
  const LBx = { ...LBd, top: '#04060c', hor: '#0e1420', fog: '#060a10', hemi: 0.12, sunL: '#6080c0' };
  const LS = { top: '#030612', hor: '#101a30', bot: '#04060a', sunC: '#dfe8ff', sunY: 0.35, glow: 0.35, fog: '#0a1222', fogD: 0.006, sunI: 1.0, sunL: '#9ab0e0', hemi: 0.6, stars: 1.0, exp: 1.0, sat: 0.95 };
  const looks = [[0, LA], [T_FIRE, LA], [T_FIRE + 3, LA2], [C.plagues - 0.01, LA2], [C.plagues, LB], [T_BLOOD, LB], [T_BLOOD + 1.2, LBr], [T_DARK, LBr], [T_DARK + 0.6, LBd], [T_DEATH, LBd], [T_DEATH + 1, LBx], [C.shore - 0.01, LBx], [C.shore, LS], [C.walk - 0.01, LS], [C.walk, { ...LS, fogD: 0.0095 }], [44, { ...LS, fogD: 0.0095 }]];

  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const CAMV = 1.7, camZ = (t) => -16 - (t - C.walk) * CAMV, CAMX = 1.2;
  function walkPos(d, t) { const L = 200; const m = ((d.z * L + (t - C.walk) * (1.0 * d.sp + 0.2 - CAMV)) % L + L) % L; const z = camZ(t) + 6 - m; let x = d.x * 6.8 + Math.sin(z * 0.1 + d.ph * 6) * 0.3; if (Math.abs(x - CAMX) < 1.4) x += x < CAMX ? -1.5 : 1.5; return [x, z]; }
  function placeCrowd(t, mode) {
    for (let i = 0; i < NP; i++) {
      const d = crowdD[i]; let x, z, y, ry = Math.PI, bob = 0;
      if (mode === 'shore') { x = d.x * 46; z = 8 + d.z * 34 + Math.abs(d.x) * 6; ry = Math.PI + d.a; bob = Math.abs(Math.sin(t * 2 + d.ph * 6)) * 0.03; }
      else { [x, z] = walkPos(d, t); ry = Math.PI + d.a * 0.3; bob = Math.abs(Math.sin((t * 1.6 * d.sp + d.ph) * Math.PI)) * 0.06; }
      const sc = mode === 'walk' && i % 3 ? 0 : d.s; y = hS(x, z) + bob; m4.compose(v3.set(x, y, z), q4.setFromAxisAngle(s3.set(0, 1, 0), ry), s3.set(sc, sc, sc)); crowd.setMatrixAt(i, m4);
    }
    crowd.instanceMatrix.needsUpdate = true;
  }

  return {
    scene, camera,
    update(t, S) {
      const Lk = look(looks, t); const shot = t < C.plagues ? 0 : t < C.shore ? 1 : 2;
      gA.visible = shot === 0; gB.visible = shot === 1; gS.visible = shot === 2;
      sky.u.top.value.copy(Lk.top); sky.u.horizon.value.copy(Lk.hor); sky.u.bottom.value.copy(Lk.bot); sky.u.sunColor.value.copy(Lk.sunC); sky.u.sunGlow.value = Lk.glow;
      scene.fog.color.copy(Lk.fog); scene.fog.density = Lk.fogD; sun.intensity = Lk.sunI; sun.color.copy(Lk.sunL); hemi.intensity = Lk.hemi;
      stars.u.opacity.value = Lk.stars; stars.visible = Lk.stars > 0.01;
      S.post.exposure = Lk.exp; S.post.sat = Lk.sat; S.post.bloom = 0.65; S.post.bloomThreshold = 0.75;

      if (shot === 0) {
        sky.u.sunDir.value.set(0.5, Lk.sunY, -1).normalize(); sun.position.set(80, 20, -100);
        const fire = ramp(t, T_FIRE, 1.2);
        bushFire[0].u.intensity.value = fire * 0.75; bushFire[1].u.intensity.value = fire * 0.55; bushGlow.material.opacity = fire * 0.35 * (0.9 + 0.1 * Math.sin(t * 9));
        bushLight.intensity = fire * 40 * (0.9 + 0.1 * Math.sin(t * 13)); sparks.u.opacity.value = fire * 0.8;
        bushFire.forEach((f) => (f.visible = fire > 0.001));
        // Моисей подходит, затем преклоняет колени
        const walk = ramp(t, 0.5, 6.5), kneel = ramp(t, 8.0, 1.4);
        const mx = lerp(-6, -0.6, walk), mz = lerp(6, -3.4, walk);
        moses.position.set(mx, hM(mx, mz) - kneel * 0.55, mz); moses.rotation.y = Math.atan2(BUSH.x - mx, BUSH.z - mz);
        moses.rotation.x = kneel * 0.32; lib.walkPose(moses, t * 0.9, 1 - ramp(t, 6.5, 0.6));
        moses.parts.arms[0].rotation.x = -kneel * 0.9; moses.parts.arms[0].rotation.z = -0.2;
        const by = BUSH.y;
        if (t < T_FIRE) cameraPath(camera, [[0, [-9, hM(-9, 11) + 0.9, 11], [-2, by + 2.6, -3]], [T_FIRE, [-7.5, hM(-7.5, 8) + 0.8, 8], [-0.5, by + 2.2, -4]]], t);
        else cameraPath(camera, [[T_FIRE, [6.4, Math.max(hM(6.4, 1.0), by) + 1.5, 1.0], [-0.1, by + 1.1, -5.0]], [C.plagues, [5.3, Math.max(hM(5.3, -0.1), by) + 1.3, -0.1], [-0.1, by + 1.0, -5.2]]], t);
        handheld(camera, t, 0.004);
      } else if (shot === 1) {
        sky.u.sunDir.value.set(0.35, Lk.sunY, -1).normalize(); sun.position.set(80, 20, -200);
        const blood = ramp(t, T_BLOOD, 1.4), dark = ramp(t, T_DARK, 0.6);
        nile.u.deep.value.set('#0a2028').lerp(col('#3a0204'), blood).multiplyScalar(1 - dark * 0.85);
        nile.u.shallow.value.set('#2a4a50').lerp(col('#8a0a08'), blood).multiplyScalar(1 - dark * 0.85);
        nile.u.skyc.value.copy(Lk.hor); nile.u.sunColor.value.copy(Lk.sunC).multiplyScalar(1 - dark); nile.u.sunDir.value.copy(sky.u.sunDir.value);
        nile.u.fogColor.value.copy(Lk.fog); nile.u.fogDensity.value = Lk.fogD;
        torches.forEach(([f, g], i) => { const k = 1 - ramp(t, T_DEATH + 0.2 + i * 0.15, 0.5) * 0.85; f.u.intensity.value = k; g.material.opacity = 0.5 * k; });
        gateDoor.material.color.set('#ffa050').multiplyScalar(1 - dark * 0.8);
        plagueMotes.u.opacity.value = blood * (1 - dark) * 0.5;
        S.post.contrast = 1.06;
        cameraPath(camera, [[C.plagues, [-16, 2.2, 34], [2, 9, -95]], [C.shore, [10, 2.6, 30], [-2, 10, -95]]], t);
        handheld(camera, t, 0.003);
      } else {
        // ---- море ----
        sky.u.sunDir.value.set(-0.3, 0.45, -1).normalize(); sun.position.set(-30, 60, -100);
        const part = ramp(t, C.part + 0.1, 2.9) * 0.82 + ramp(t, C.part + 2.6, 3.5) * 0.18;
        wU.p.value = part; spU.p.value = part; spU.op.value = t > C.part ? 1 : 0;
        wU.glow.value = lerp(0.6, 1.25, ramp(t, C.walk, 2)); mist.u.opacity.value = ramp(t, C.part, 1.5) * 0.18;
        wU.wave.value = lerp(0.5, 0.25, ramp(t, C.part + 2, 3));
        wU.fogC.value.copy(Lk.fog); wU.fogD.value = Lk.fogD;
        // колесницы приближаются, огненный столп
        chariots.forEach((g, i) => { const z = lerp(180, 150, ramp(t, C.shore, 15)) + Math.sin(i * 3.3) * 8; g.position.set(g.position.x, hS(g.position.x, Math.min(z, 60)) + 3 + Math.sin(i) * 1.5, z); g.material.opacity = 0.7 + 0.3 * Math.sin(t * 6 + i * 2); });
        pillar.u.opacity.value = 0.45 * ramp(t, C.shore + 1, 2); pillarGlow.material.opacity = 0.4 * ramp(t, C.shore + 1, 2);
        // народ
        const walking = t >= C.walk; placeCrowd(t, walking ? 'walk' : 'shore'); crowd.material.emissiveIntensity = ramp(t, C.part + 1, 2) * 1.0;
        crowdTorches.forEach((g, i) => { const d = crowdD[i * 37 % NP]; if (!walking) g.position.set(d.x * 40, hS(d.x * 40, 14 + d.z * 26) + 2.4, 14 + d.z * 26); else { const [x, z] = walkPos(d, t); g.position.set(x + 0.35, hS(x, z) + 2.0, z); } g.material.opacity = 0.75 + 0.25 * Math.sin(t * 9 + i); });
        // Моисей у кромки воды, поднимает посох
        mosesS.position.set(0.5, hS(0.5, 5.5), 5.5); mosesS.rotation.y = Math.PI; mosesS.visible = !walking;
        const raise = ramp(t, C.part - 0.6, 0.8); mosesS.parts.arms[1].rotation.x = -0.25 - raise * 2.6; mosesS.parts.arms[0].rotation.x = -raise * 1.2; mosesS.parts.arms[0].rotation.z = -0.6 * raise;
        if (t < C.part) {
          cameraPath(camera, [[C.shore, [14, 3.6, -14], [-3, 3.2, 30]], [C.part, [11, 3.2, -10], [-2, 3.0, 30]]], t);
          handheld(camera, t, 0.004);
        } else if (t < C.walk) {
          cameraPath(camera, [[C.part, [0.9, 2.9, 14.5], [0, 7, -80]], [C.walk, [0.9, 9, 19], [0, 5, -80]]], t);
          handheld(camera, t, 0.006 + 0.004 * Math.sin(t * 3));
        } else {
          const k = t - C.walk, cz = camZ(t); camera.position.set(CAMX + Math.sin(k * 0.2) * 0.3, hS(CAMX, cz) + 2.3, cz);
          camera.lookAt(0, 3.4 + k * 0.05, cz - 90);
          handheld(camera, t, 0.004);
        }
      }
    },
  };
}
