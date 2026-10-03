// Руфь: золотой час, пыльная дорога меж холмов — две женщины (Ноеминь и Руфь) идут в Вифлеем, Орфа вдали
// оборачивается и уходит назад → клятва: две женщины держатся за руки и обнимаются (цитата) →
// ячменное поле на закате: жнецы, Руфь подбирает колосья, Вооз смотрит; финал — тёплый общий план.
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, rng, fbm, noise2, smooth, cameraPath, handheld } = lib;
  const C = meta.cues;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#d8a070', 0.004);
  const col = (c) => new THREE.Color(c);
  function look(keys, t) {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, a] = keys[i], [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
    const k = t1 > t0 ? smooth(0, 1, (t - t0) / (t1 - t0)) : 0; const o = {};
    for (const n in a) o[n] = typeof a[n] === 'number' ? lerp(a[n], b[n], k) : col(a[n]).lerp(col(b[n]), k);
    return o;
  }
  const SUN = new THREE.Vector3(0.52, 0.07, -1).normalize();

  // ---------- стебли / колосья: инстансы «пучков», ветер в шейдере ----------
  function stalkField({ count, seed, place, ears = true, n = 7, h = [0.9, 1.25], root = '#5a4418', tip = '#e2bc68', ear = '#f2cf7a', width = 0.022 }) {
    const r = rng(seed); const pos = [];
    const quad = (x, z, y0, y1, w, lean, rot, tag) => {
      const cx = Math.cos(rot) * w, cz = Math.sin(rot) * w; const lx = Math.cos(rot + 0.6) * lean, lz = Math.sin(rot + 0.6) * lean;
      const A = [x - cx, y0, z - cz], B = [x + cx, y0, z + cz], Cc = [x + cx * 0.4 + lx, y1, z + cz * 0.4 + lz], D = [x - cx * 0.4 + lx, y1, z - cz * 0.4 + lz];
      pos.push(...A, ...B, ...Cc, ...A, ...Cc, ...D);
    };
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 0.35, z = (r() - 0.5) * 0.35, H = lerp(h[0], h[1], r()), rot = r() * Math.PI, lean = (r() - 0.5) * 0.25;
      quad(x, z, 0, H, width * 0.5, lean, rot);
      if (ears) { // колос: ромб у верхушки
        const ex = x + Math.cos(rot + 0.6) * lean, ez = z + Math.sin(rot + 0.6) * lean; const er = rot + 1.2;
        const cx = Math.cos(er) * 0.03, cz = Math.sin(er) * 0.03, d = 0.05 + r() * 0.04;
        pos.push(ex, H - 0.02, ez, ex + cx + d * 0.3, H + 0.08, ez + cz, ex + d * 0.6, H + 0.2, ez + d * 0.3, ex, H - 0.02, ez, ex + d * 0.6, H + 0.2, ez + d * 0.3, ex - cx + d * 0.3, H + 0.08, ez - cz);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { time: { value: 0 }, sunDir: { value: SUN.clone() }, sunCol: { value: col('#ffc880') }, root: { value: col(root) }, tip: { value: col(tip) }, earC: { value: col(ear) }, amb: { value: col('#6a5040') }, wind: { value: 1 } }]);
    const m = new THREE.ShaderMaterial({
      uniforms: u, fog: true, side: THREE.DoubleSide,
      vertexShader: `#include <fog_pars_vertex>
        uniform float time, wind; varying float vH; varying vec3 vW;
        void main(){ vec3 p = position; vH = p.y;
          vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.);
          float h2 = p.y*p.y; float g = sin(time*1.3 + w.x*.18 + w.z*.11)*.5 + sin(time*2.7 + w.x*.6)*.2;
          w.x += (g*.16 + .05)*h2*wind; w.z += (cos(time*1.1 + w.z*.2)*.06)*h2*wind;
          vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `#include <fog_pars_fragment>
        uniform vec3 sunDir, sunCol, root, tip, earC, amb; varying float vH; varying vec3 vW;
        void main(){ float k = clamp(vH/1.25, 0., 1.);
          vec3 base = mix(root, tip, smoothstep(.0, .9, k)); base = mix(base, earC, smoothstep(.95, 1.05, vH/1.15)*1.);
          vec3 v = normalize(cameraPosition - vW); float back = pow(max(dot(-v, normalize(sunDir)), 0.), 5.);
          float dist = length(cameraPosition - vW); vec3 c = base*(amb + sunCol*.55) + sunCol*base*back*k*mix(.6, 2.2, smoothstep(2., 9., dist)); c *= mix(.55, 1., smoothstep(1.5, 6., dist));
          gl_FragColor = vec4(c, 1.);
          #include <fog_fragment>
        }`,
    });
    const im = new THREE.InstancedMesh(g, m, count); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let c = 0, tries = 0;
    while (c < count && tries < count * 20) { tries++; const p = place(r); if (!p) continue; e.set(0, r() * 6.28, 0); q.setFromEuler(e); const s = p[3] || (0.85 + r() * 0.3);
      m4.compose(new THREE.Vector3(p[0], p[1], p[2]), q, new THREE.Vector3(s, s * (0.9 + r() * 0.2), s)); im.setMatrixAt(c++, m4); }
    im.count = c; im.frustumCulled = false; return Object.assign(im, { u });
  }
  // дальние хребты-силуэты (кольцо)
  function ridge({ radius, height, y0, seed, color, amp = 0.5, arc = [0, Math.PI * 2] }) {
    const g = new THREE.CylinderGeometry(radius, radius, height, 160, 1, true, arc[0], arc[1] - arc[0]); g.translate(0, y0 + height / 2, 0);
    const u = { c: { value: col(color) }, top: { value: col(color) }, seed: { value: seed }, amp: { value: amp } };
    const m = new THREE.ShaderMaterial({ uniforms: u, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: lib.GLSL_NOISE + `uniform vec3 c, top; uniform float seed, amp; varying vec2 vUv;
        void main(){ float x = vUv.x*24. + seed; float prof = .35 + amp*(fbm2(vec2(x, seed))*.9 - .2) + .12*sin(vUv.x*31.+seed);
          float a = smoothstep(prof+.004, prof-.004, vUv.y); if (a < .01) discard;
          gl_FragColor = vec4(mix(c, top, smoothstep(prof-.3, prof, vUv.y)), a); }` });
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = -5; mesh.frustumCulled = false; return Object.assign(mesh, { u });
  }
  // деревья (оливы): инстансы ствол + 4 кроны
  function trees(list, parent, leafCol = '#3a4a26') {
    const trunkG = new THREE.CylinderGeometry(0.18, 0.32, 2.2, 6); trunkG.translate(0, 1.1, 0);
    const leafG = new THREE.IcosahedronGeometry(1, 1);
    const tr = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 1 }), list.length);
    const lf = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ color: leafCol, roughness: 0.95, flatShading: true }), list.length * 4);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); const r = rng(91);
    list.forEach(([x, y, z, s], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (r() - 0.5) * 0.3); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)); tr.setMatrixAt(i, m4);
      for (let k = 0; k < 4; k++) { const a = k * 1.6 + r(); m4.compose(new THREE.Vector3(x + Math.cos(a) * 0.9 * s, y + (2.3 + r() * 0.8) * s, z + Math.sin(a) * 0.9 * s), q.identity(), new THREE.Vector3(1.3 * s, 0.75 * s, 1.2 * s)); lf.setMatrixAt(i * 4 + k, m4); }
    });
    tr.castShadow = lf.castShadow = true; parent.add(tr, lf);
  }
  function embracePose(a, b, hug, tilt = 0.06) {
    [a, b].forEach((f, j) => f.parts.arms.forEach((arm, s) => { arm.rotation.order = 'YXZ'; arm.rotation.x = lerp(arm.rotation.x, -1.2 + j * 0.1, hug); arm.rotation.y = (s ? -1 : 1) * 0.55 * hug; }));
    a.parts.body.rotation.x = tilt * hug; b.parts.body.rotation.x = tilt * 0.6 * hug;
  }

  const sky = lib.skyDome({ top: '#3a5a8a', horizon: '#f0b070', bottom: '#4a3020', sunDir: SUN.toArray(), sunColor: '#ffd08a', sunSize: 0.03, sunGlow: 1.0 });
  scene.add(sky);
  const sun = new THREE.DirectionalLight('#ffc890', 3.0); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 200 }); sun.shadow.bias = -0.0006;
  const hemi = new THREE.HemisphereLight('#9ab0d8', '#6a4a2a', 0.75); scene.add(hemi);

  // =====================================================================
  // ДОРОГА
  // =====================================================================
  const gR = new THREE.Group(); scene.add(gR);
  const roadX = (z) => Math.sin(z * 0.011) * 24 + Math.sin(z * 0.031 + 1) * 5;
  const hills = (x, z) => fbm(x * 0.006 + 3, z * 0.006, 5) * 26;
  const roadH = (z) => hills(roadX(z), z) * 0.6;
  const hR = (x, z) => { const d = Math.abs(x - roadX(z)); const base = roadH(z); const hl = hills(x, z) * 0.6 + smooth(12, 140, d) * (18 + fbm(x * 0.01, z * 0.01, 3) * 20);
    return lerp(base + fbm(x * 0.15, z * 0.15, 2) * 0.12, hl, smooth(5, 26, d)); };
  const roadLand = lib.terrain({ size: 1100, seg: 170, center: [0, -300], heightFn: hR, roughness: 1,
    colorFn: (x, z, y, sl) => { const d = Math.abs(x - roadX(z)); const n = noise2(x * 0.08, z * 0.08) * 0.5 + 0.5;
      return col('#a08048').lerp(col('#6a6a34'), clamp(noise2(x * 0.03 + 9, z * 0.03) * 0.9 + 0.1) * 0.6).lerp(col('#7a5a3a'), sl * 1.2).lerp(col('#e2c294'), smooth(3.4, 1.8, d) * (0.85 + n * 0.15)).lerp(col('#a88660'), smooth(0.35, 0.1, Math.abs(d - 0.8)) * 0.5).multiplyScalar(0.88 + n * 0.2); } });
  gR.add(roadLand);
  // камни и кусты вдоль дороги
  { const RR = rng(5); const rockG = new THREE.DodecahedronGeometry(1, 0); const rocks = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ color: '#8a7058', roughness: 1, flatShading: true }), 260);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 260; i++) { const z = 40 - RR() * 400; const side = RR() < 0.5 ? -1 : 1; const x = roadX(z) + side * (3 + RR() * 60); const s = 0.2 + Math.pow(RR(), 3) * 1.6; e.set(RR() * 3, RR() * 3, RR() * 3); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, hR(x, z) + s * 0.2, z), q, new THREE.Vector3(s * 1.3, s * 0.7, s)); rocks.setMatrixAt(i, m4); }
    rocks.castShadow = true; gR.add(rocks);
    const tl = []; for (let i = 0; i < 40; i++) { const z = 30 - RR() * 300; const side = RR() < 0.5 ? -1 : 1; const x = roadX(z) + side * (6 + RR() * 50); tl.push([x, hR(x, z) - 0.1, z, 0.8 + RR() * 0.7]); }
    trees(tl, gR); }
  const roadGrass = stalkField({ count: 2600, seed: 12, ears: false, n: 6, h: [0.25, 0.65], root: '#5a4a24', tip: '#c8a868', width: 0.03,
    place: (r) => { const z = 16 - r() * 60; const side = r() < 0.5 ? -1 : 1; const d = 1.9 + Math.pow(r(), 1.5) * 16; const x = roadX(z) + side * d; return [x, hR(x, z), z]; } });
  gR.add(roadGrass);
  const ridgesR = [ridge({ radius: 900, height: 160, y0: -40, seed: 3, color: '#a0786a', amp: 0.35 }), ridge({ radius: 860, height: 120, y0: -30, seed: 7, color: '#80605a', amp: 0.4 })];
  ridgesR.forEach((m) => gR.add(m));
  const dustR = lib.motes({ count: 500, box: [26, 8, 30], center: [0, 3, -4], size: 2.6, color: '#ffe0b0', speed: 0.15, opacity: 0.55, seed: 21 }); gR.add(dustR);
  // три женщины
  const naomi = lib.figure({ height: 1.66, robe: '#3e3836', skin: '#7a5038', hood: true, hoodColor: '#5e5650', staff: true, belt: '#2a2018', seed: 61 });
  const ruth = lib.figure({ height: 1.68, robe: '#8a4434', skin: '#9a6a4a', hood: true, hoodColor: '#d0b08a', belt: '#5a3020', seed: 62 });
  const orpah = lib.figure({ height: 1.66, robe: '#5a4a6a', hood: true, hoodColor: '#8a7a8a', seed: 63 });
  naomi.parts.body.rotation.x = 0.07; gR.add(naomi, ruth, orpah);
  // путь: скорость спадает к остановке перед клятвой
  const walkD = (t) => { let d = 0; const dt = 0.05; for (let s = 0; s < t; s += dt) d += 0.85 * (1 - smooth(8.0, 9.6, s)) * Math.min(dt, t - s); return d; };
  const Z0 = -8.2;

  // =====================================================================
  // ЯЧМЕННОЕ ПОЛЕ
  // =====================================================================
  const gF = new THREE.Group(); scene.add(gF);
  const hF = (x, z) => fbm(x * 0.01 + 7, z * 0.01, 4) * 6 + Math.max(0, -z - 120) * 0.12 + smooth(-150, -260, z) * fbm(x * 0.008, 3.3, 3) * 30;
  const cutLine = (x) => -2 + Math.sin(x * 0.08) * 2 + x * 0.12; // сжато: z > cutLine
  const fieldLand = lib.terrain({ size: 800, seg: 130, center: [0, -200], heightFn: hF, roughness: 1,
    colorFn: (x, z, y) => { const n = noise2(x * 0.1, z * 0.1) * 0.5 + 0.5; const inF = smooth(48, 40, Math.abs(x)) * smooth(-70, -62, z) * smooth(22, 16, z);
      const stub = z > cutLine(x) ? 1 : 0; return col('#7a6a3a').lerp(col('#5a5a2a'), n * 0.5).lerp(col(stub ? '#b89a5a' : '#c89a48'), inF).multiplyScalar(0.85 + n * 0.25); } });
  gF.add(fieldLand);
  const barley = stalkField({ count: 3800, seed: 33, n: 6, h: [0.85, 1.15],
    place: (r) => { const k = r(); if (k < 0.025) { const a = r() * 6.28, rr = Math.sqrt(r()) * 1.0; const x = 1.4 + Math.cos(a) * rr * 1.4, z = 8.6 + Math.sin(a) * rr; return [x, hF(x, z), z]; }
      const near = k < 0.4; const x = near ? -4 + (r() - 0.5) * 26 : (r() - 0.5) * 92, z = near ? -6 + (r() - 0.5) * 8 : 18 - r() * 86;
      if (z > cutLine(x) || Math.abs(x) > 46 || z < -68) return null; return [x, hF(x, z), z]; } });
  gF.add(barley);
  const stubble = stalkField({ count: 900, seed: 34, ears: false, n: 5, h: [0.12, 0.22], root: '#6a5428', tip: '#c8a462', width: 0.03,
    place: (r) => { const x = (r() - 0.5) * 70, z = 16 - r() * 30; if (z <= cutLine(x) || Math.abs(x) > 46) return null; return [x, hF(x, z), z]; } });
  gF.add(stubble);
  // снопы
  { const sg = new THREE.LatheGeometry([[0, 0], [0.3, 0], [0.2, 0.3], [0.15, 0.62], [0.24, 0.85], [0.36, 1.05], [0.22, 1.18], [0, 1.22]].map(([x, y]) => new THREE.Vector2(x, y)), 10); const tg = new THREE.TorusGeometry(0.16, 0.025, 4, 12); tg.rotateX(Math.PI / 2); tg.translate(0, 0.62, 0);
    const shM = new THREE.MeshStandardMaterial({ color: '#c8a050', roughness: 1 }); const RS = rng(8); const n = 26;
    const s1 = new THREE.InstancedMesh(sg, shM, n), s2 = new THREE.InstancedMesh(tg, shM, n); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let i = 0;
    while (i < n) { const x = -30 + RS() * 60, z = 15 - RS() * 14; if (z <= cutLine(x) + 2) continue; q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (RS() - 0.5) * 0.2); m4.compose(new THREE.Vector3(x, hF(x, z), z), q, new THREE.Vector3(1, 1, 1)); s1.setMatrixAt(i, m4); s2.setMatrixAt(i, m4); i++; }
    s1.castShadow = s2.castShadow = true; gF.add(s1, s2); }
  // Вифлеем на дальнем холме
  { const RH = rng(17); const n = 70; const hg = new THREE.BoxGeometry(1, 1, 1); hg.translate(0, 0.5, 0); const hm = new THREE.InstancedMesh(hg, new THREE.MeshStandardMaterial({ color: '#c8aa80', roughness: 1 }), n); const m4 = new THREE.Matrix4(); const c = new THREE.Color();
    for (let i = 0; i < n; i++) { const x = -150 + (RH() - 0.5) * 70, z = -230 + (RH() - 0.5) * 50; const w = 3 + RH() * 4, h = 3 + RH() * 4; m4.makeScale(w, h, w * (0.8 + RH() * 0.4)).setPosition(x, hF(x, z) - 0.5, z); hm.setMatrixAt(i, m4); c.set('#c8aa80').multiplyScalar(0.7 + RH() * 0.4); hm.setColorAt(i, c); }
    gF.add(hm); }
  const ftl = [[-34, 0, 4, 1.3], [-38, 0, -6, 1.1], [40, 0, -20, 1.2], [-44, 0, -40, 1.4], [30, 0, 22, 1.0], [-55, 0, 12, 1.2]].map(([x, , z, s]) => [x, hF(x, z) - 0.1, z, s]);
  trees(ftl, gF, '#3a4422');
  const ridgesF = [ridge({ radius: 900, height: 140, y0: -30, seed: 11, color: '#8a5a5a', amp: 0.3 })]; ridgesF.forEach((m) => gF.add(m));
  const dustF = lib.motes({ count: 600, box: [40, 8, 40], center: [-4, 3, 0], size: 2.4, color: '#ffd8a0', speed: 0.12, opacity: 0.55, seed: 22 }); gF.add(dustF);
  // жнецы, Руфь, Вооз
  const reapers = []; const RQ = rng(44);
  for (let i = 0; i < 5; i++) {
    const x = -16 + i * 6.5 + (RQ() - 0.5) * 2; const z = cutLine(x) + 0.9;
    const f = lib.figure({ height: 1.72 + RQ() * 0.12, robe: ['#6a5038', '#5a4a3a', '#7a5a40', '#4a4034', '#6a4a30'][i], hood: true, hoodColor: '#c8b494', seed: 70 + i });
    const w = new THREE.Group(); w.position.set(x, hF(x, z), z); w.rotation.y = Math.PI + (RQ() - 0.5) * 0.6; w.add(f); gF.add(w);
    const sick = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 4, 12, Math.PI * 1.2), new THREE.MeshStandardMaterial({ color: '#8a8a8a', metalness: 0.7, roughness: 0.4 }));
    sick.position.y = -0.66; f.parts.arms[1].add(sick); f.parts.arms.forEach((a) => (a.rotation.order = 'YXZ'));
    reapers.push({ w, f, ph: RQ() * 6, x, z });
  }
  const ruthF = lib.figure({ height: 1.68, robe: '#8a4434', skin: '#9a6a4a', hood: true, hoodColor: '#d0b08a', belt: '#5a3020', seed: 62 });
  const ruthW = new THREE.Group(); ruthW.add(ruthF); gF.add(ruthW); ruthF.parts.arms.forEach((a) => (a.rotation.order = 'YXZ'));
  const RX = -4, RZ = 5.5; ruthW.position.set(RX, hF(RX, RZ), RZ);
  const bundle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.6, 6), new THREE.MeshStandardMaterial({ color: '#d8b060' })); bundle.position.set(0, -0.5, 0.05); bundle.rotation.x = 0.3; ruthF.parts.arms[0].add(bundle);
  const boaz = lib.figure({ height: 1.9, robe: '#5a2e22', skin: '#7a5034', hood: true, hoodColor: '#c8a060', belt: '#c8a060', staff: true, seed: 80 });
  const BX = -15, BZ = 11; boaz.position.set(BX, hF(BX, BZ), BZ); gF.add(boaz);

  // ---------- образы ----------
  const LR = { top: '#3a5a8a', hor: '#f0b070', bot: '#4a3020', fog: '#d8a070', fogD: 0.0035, sunY: 0.07, glow: 1.0, sun: 3.0, hemi: 0.75, exp: 0.95, r1: '#b0806a', r2: '#8a6058' };
  const LV = { ...LR, top: '#2e4874', hor: '#e49a60', fog: '#c08860', sunY: 0.05, glow: 0.9, exp: 0.82 };
  const LF = { top: '#2a3a6a', hor: '#f08a4a', bot: '#3a2018', fog: '#c87a52', fogD: 0.0032, sunY: 0.03, glow: 1.15, sun: 2.6, hemi: 0.6, exp: 0.92, r1: '#8a5a5a', r2: '#7a4a4a' };
  const LF2 = { ...LF, hor: '#e87a40', sunY: 0.012, exp: 0.95 };
  const looks = [[0, LR], [C.vow - 0.01, LR], [C.vow, LV], [C.field - 0.01, LV], [C.field, LF], [meta.dur, LF2]];

  return {
    scene, camera,
    update(t, S) {
      const Lk = look(looks, t); const field = t >= C.field;
      gR.visible = !field; gF.visible = field;
      const sx = field ? 0.3 : t >= C.vow ? 0.66 : 0.52; SUN.set(sx, Lk.sunY, -1).normalize();
      sky.u.top.value.copy(Lk.top); sky.u.horizon.value.copy(Lk.hor); sky.u.bottom.value.copy(Lk.bot); sky.u.sunDir.value.copy(SUN); sky.u.sunGlow.value = Lk.glow;
      scene.fog.color.copy(Lk.fog); scene.fog.density = Lk.fogD;
      sun.intensity = Lk.sun; hemi.intensity = Lk.hemi;
      [roadGrass, barley, stubble].forEach((f) => f.u.sunDir.value.copy(SUN));
      (field ? ridgesF : ridgesR).forEach((m, i) => { m.u.c.value.copy(i ? Lk.r2 : Lk.r1).lerp(Lk.fog, 0.35); m.u.top.value.copy(Lk.hor).lerp(Lk.r1, 0.5); });
      S.post.exposure = Lk.exp; S.post.bloom = 0.6; S.post.bloomThreshold = 0.78; S.post.tint = [1.04, 0.98, 0.9]; S.post.vignette = 0.42; S.post.sat = 1.05;

      if (!field) {
        // ----- дорога / клятва -----
        const d = walkD(t); const z = Z0 + d; const rx = roadX(z);
        const walking = 1 - smooth(8.0, 9.6, t);
        naomi.position.set(rx - 0.42, hR(rx - 0.42, z), z); ruth.position.set(rx + 0.42, hR(rx + 0.42, z + 0.15), z + 0.15);
        const turn = ramp(t, C.vow - 0.3, 1.4);
        naomi.rotation.y = lerp(0.02, Math.PI / 2, turn); ruth.rotation.y = lerp(0.0, -Math.PI / 2, turn);
        lib.walkPose(naomi, d * 0.62, walking); lib.walkPose(ruth, d * 0.62 + 0.35, walking);
        const hands = ramp(t, C.vow + 1.0, 1.2); const hug = ramp(t, 16.6, 1.6);
        if (t > C.vow) {
          const gap = lerp(0.42, 0.27, hug);
          naomi.position.x = rx - gap; ruth.position.x = rx + gap;
          [naomi, ruth].forEach((f) => f.parts.arms.forEach((a, s) => { a.rotation.order = 'YXZ'; a.rotation.x = -0.75 * hands; a.rotation.y = (s ? -1 : 1) * 0.2 * hands; }));
          if (naomi.parts.staff) naomi.parts.arms[1].rotation.x = lerp(-0.25, -0.5, hands);
          embracePose(ruth, naomi, hug, 0.1);
          ruth.parts.head.position.z = 0.05 * hug;
        }
        // Орфа: уходит назад, оборачивается
        const od = t < 3.0 ? t : t < 6.2 ? 3.0 + (t - 3.0) * 0.05 : 3.16 + (t - 6.2);
        const oz = -24 - od * 0.9; const ox = roadX(oz) + 0.3; orpah.position.set(ox, hR(ox, oz), oz);
        const look = ramp(t, 3.1, 0.9) * (1 - ramp(t, 5.6, 0.8)); orpah.rotation.y = lerp(Math.PI, 0.2, look);
        lib.walkPose(orpah, t * 0.75, 1 - look); orpah.visible = t < C.vow;
        sun.position.set(rx + SUN.x * 60, hR(rx, z) + SUN.y * 60 + 6, z + SUN.z * 60); sun.target.position.set(rx, hR(rx, z), z);
        if (t < 4.7) {
          S.quote.y = 0.5;
          const zc = Z0 + walkD(2);
          const yz = hR(rx, z); cameraPath(camera, [[0, [rx - 5.5, yz + 7.0, z + 17], [lerp(rx, roadX(-40), 0.5), yz + 0.5, z - 18]], [4.7, [rx - 4.2, yz + 5.4, z + 13.5], [lerp(rx, roadX(-40), 0.5), yz + 0.6, z - 18]]], t);
        } else if (t < C.vow) {
          cameraPath(camera, [[4.7, [rx - 2.4, hR(rx, z) + 1.45, z + 3.4], [rx + 0.4, hR(rx, z) + 1.35, z - 6]], [C.vow, [rx - 2.0, hR(rx, z) + 1.5, z + 2.9], [rx + 0.4, hR(rx, z) + 1.4, z - 6]]], t);
        } else {
          S.quote.y = 0.34;
          const y0 = hR(rx, z);
          cameraPath(camera, [[C.vow, [rx - 0.6, y0 + 1.75, z + 6.4], [rx + 0.2, y0 + 2.45, z - 4]], [C.field, [rx + 0.5, y0 + 1.6, z + 4.6], [rx + 0.1, y0 + 2.35, z - 4]]], t);
        }
        handheld(camera, t, 0.004);
      } else {
        // ----- поле -----
        const ft = t - C.field;
        reapers.forEach(({ w, f, ph }, i) => {
          const sw = Math.sin(t * 2.2 + ph);
          f.rotation.x = 0.55 + 0.08 * sw; f.position.y = -0.12;
          f.parts.arms[1].rotation.x = -0.9 - 0.5 * sw; f.parts.arms[1].rotation.y = -0.4 * sw;
          f.parts.arms[0].rotation.x = -1.0 + 0.2 * sw;
        });
        // Руфь: наклоняется, подбирает колосья, распрямляется, шаг
        const cyc = (ft * 0.32) % 1; const bend = smooth(0.0, 0.25, cyc) * (1 - smooth(0.55, 0.8, cyc));
        ruthF.rotation.x = 0.75 * bend; ruthF.position.y = -0.1 * bend;
        ruthF.parts.arms[1].rotation.x = -0.4 - 1.0 * bend; ruthF.parts.arms[1].rotation.y = -0.2;
        ruthF.parts.arms[0].rotation.x = -0.5 + 0.2 * bend;
        const rstep = Math.floor(ft * 0.32) + smooth(0.8, 1.0, cyc); ruthW.position.set(RX + rstep * 0.7, hF(RX + rstep * 0.7, RZ), RZ - rstep * 0.15);
        ruthW.rotation.y = -2.4;
        boaz.rotation.y = Math.atan2(ruthW.position.x - BX, ruthW.position.z - BZ);
        sun.position.set(SUN.x * 80 - 8, SUN.y * 80 + 12, SUN.z * 80); sun.target.position.set(-8, 0, 0);
        if (t < 26.3) {
          // низко в колосьях, Руфь в среднем плане
          S.quote.y = 0.5;
          const y0 = hF(RX, RZ); cameraPath(camera, [[C.field, [RX + 4.6, y0 + 0.95, RZ + 6.2], [RX - 0.4, y0 + 1.1, RZ - 4]], [26.3, [RX + 3.6, y0 + 1.0, RZ + 5.8], [RX - 0.2, y0 + 1.1, RZ - 4]]], t);
        } else if (t < 29.9) {
          // из-за плеча Вооза
          const by = hF(BX, BZ);
          cameraPath(camera, [[26.3, [BX - 1.5, by + 1.62, BZ + 2.3], [ruthW.position.x + 1.5, by + 0.9, ruthW.position.z - 2]], [29.9, [BX - 1.1, by + 1.6, BZ + 1.9], [ruthW.position.x + 1.5, by + 0.95, ruthW.position.z - 2]]], t);
        } else {
          S.fadeOut = 1.2;
          cameraPath(camera, [[29.9, [-36, 4, 32], [-2, 1, -30]], [meta.dur, [-46, 16, 52], [-4, 2, -40]]], t);
        }
        handheld(camera, t, 0.0035);
      }
    },
  };
}
