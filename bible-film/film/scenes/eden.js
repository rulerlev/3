// Эдем: золотой сад и древо познания → змей и плод → люди прячутся → «Адам, где ты?» (сумерки) →
// врата с пламенным мечом, двое уходят в серую пустую землю.
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, rng, fbm, noise2, cameraPath, handheld } = lib;
  const C = meta.cues;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#d8ac70', 0.012);

  // ---------- хелперы ----------
  const col = (c) => new THREE.Color(c);
  // интерполяция «образа» кадра по ключам [[t, {..}], ...]
  function look(keys, t) {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, a] = keys[i], [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
    const k = t1 > t0 ? lib.smooth(0, 1, (t - t0) / (t1 - t0)) : 0; const o = {};
    for (const n in a) o[n] = typeof a[n] === 'number' ? lerp(a[n], b[n], k) : col(a[n]).lerp(col(b[n]), k);
    return o;
  }
  // труба с утоньшением r0 → r1
  function taperTube(pts, r0, r1, seg = 24, rad = 7) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, seg, 1, rad, false); const pos = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      const c = curve.getPointAt(i / seg); const r = lerp(r0, r1, Math.pow(i / seg, 0.8));
      for (let j = 0; j <= rad; j++) { const idx = i * (rad + 1) + j; v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c); pos.setXYZ(idx, v.x, v.y, v.z); }
    }
    g.computeVertexNormals(); return g;
  }
  // листва: «кисти» листьев — точки с текстурой (атлас 2×2), alphaTest, освещение градиентом
  const leafAtlas = lib.canvasTexture(512, 512, (g) => {
    const r = rng(1234);
    for (let q = 0; q < 4; q++) {
      const ox = (q % 2) * 256 + 128, oy = Math.floor(q / 2) * 256 + 128;
      for (let i = 0; i < 260; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 100 * (0.75 + 0.25 * Math.sin(a * 3 + q)); const x = ox + Math.cos(a) * d, y = oy + Math.sin(a) * d * 0.85;
        const lv = Math.round(150 + 105 * (1 - (y - oy + 100) / 200) * (0.6 + 0.4 * r()));
        g.fillStyle = `rgb(${lv},${lv},${lv})`; g.beginPath(); g.ellipse(x, y, 9 + r() * 7, 4 + r() * 3, r() * Math.PI, 0, Math.PI * 2); g.fill();
      }
    }
  });
  function foliage(list, { light = '#ffd9a0', amb = '#405030' } = {}) { // list: [x,y,z,size,r,g,b]
    const n = list.length, p = new Float32Array(n * 3), c = new Float32Array(n * 3), s = new Float32Array(n * 2); const r = rng(n + 3);
    list.forEach((e, i) => { p.set([e[0], e[1], e[2]], i * 3); c.set([e[4], e[5], e[6]], i * 3); s.set([e[3], Math.floor(r() * 4) + r() * 0.9], i * 2); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('col', new THREE.BufferAttribute(c, 3)); g.setAttribute('sd', new THREE.BufferAttribute(s, 2));
    const u = { time: { value: 0 }, pxr: { value: 1 }, wind: { value: 0.2 }, map: { value: leafAtlas }, lightC: { value: col(light) }, ambC: { value: col(amb) }, fogC: { value: col('#000') }, fogD: { value: 0.01 } };
    const m = new THREE.ShaderMaterial({
      uniforms: u, transparent: false,
      vertexShader: `attribute vec3 col; attribute vec2 sd; uniform float time, pxr, wind, fogD; varying vec3 vC; varying float vV, vR, vF;
        void main(){ vec3 q = position; q.x += sin(time*1.3 + q.z*.2 + sd.y*7.)*wind*.12*sd.x; q.z += cos(time*1.1 + q.x*.2 + sd.y*5.)*wind*.08*sd.x;
          vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv; float d = max(-mv.z, .5);
          gl_PointSize = min(sd.x*projectionMatrix[1][1]*540.*pxr/d, 900.); vC = col; vV = floor(sd.y); vR = fract(sd.y)*6.28 + sin(time*1.7+sd.y*9.)*wind*.08;
          vF = 1. - exp(-pow(d*fogD, 2.)); }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 lightC, ambC, fogC; varying vec3 vC; varying float vV, vR, vF;
        void main(){ vec2 pc = gl_PointCoord - .5; float cs = cos(vR), sn = sin(vR); vec2 q = vec2(cs*pc.x - sn*pc.y, sn*pc.x + cs*pc.y) + .5;
          if (q.x < 0. || q.y < 0. || q.x > 1. || q.y > 1.) discard;
          vec2 uv = (q + vec2(mod(vV, 2.), floor(vV/2.)))*.5; uv.y = 1. - uv.y; vec4 tx = texture2D(map, uv); if (tx.a < .5) discard;
          float top = 1. - gl_PointCoord.y; vec3 c = vC * tx.r * (ambC + lightC*(.25 + .75*top*tx.r));
          gl_FragColor = vec4(mix(c, fogC, vF), 1.); }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; return Object.assign(pts, { u });
  }
  const mergeGeos = (geos) => {
    let n = 0; geos.forEach((g) => (n += g.index.count));
    const posA = [], norA = [], idx = []; let off = 0;
    for (const g of geos) { const p = g.attributes.position, nn = g.attributes.normal; for (let i = 0; i < p.count; i++) { posA.push(p.getX(i), p.getY(i), p.getZ(i)); norA.push(nn.getX(i), nn.getY(i), nn.getZ(i)); } for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); off += p.count; }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(norA, 3)); m.setIndex(idx); return m;
  };

  // ---------- небо, свет ----------
  const sky = lib.skyDome({ top: '#5d7fa8', horizon: '#ffc27a', bottom: '#6a5030', sunDir: [0.22, 0.09, -1], sunColor: '#ffd79a', sunSize: 0.03, sunGlow: 1.0 });
  scene.add(sky);
  const sun = new THREE.DirectionalLight('#ffd49a', 2.2); sun.position.set(30, 20, -100); scene.add(sun);
  const hemi = new THREE.HemisphereLight('#bcd2e8', '#3a2a14', 0.6); scene.add(hemi);
  const fill = new THREE.DirectionalLight('#ffe2b8', 0.5); fill.position.set(10, 15, 40); scene.add(fill);

  // ---------- земля ----------
  const GATE_Z = 66;
  const hFn = (x, z) => {
    const r = Math.hypot(x, z);
    let h = fbm(x * 0.018, z * 0.018, 4) * 2.2 + Math.max(0, r - 90) * 0.12 + fbm(x * 0.004 + 3, z * 0.004, 3) * 6;
    const barren = lib.smooth(GATE_Z + 2, GATE_Z + 14, z);
    h += barren * (fbm(x * 0.05, z * 0.05, 4) * 2.0 + Math.max(0, z - 120) * 0.06);
    return h - lib.smooth(14, 0, r) * 0.4;
  };
  const ground = lib.terrain({
    size: 420, seg: 170, heightFn: hFn,
    colorFn: (x, z, y, sl) => {
      const n = fbm(x * 0.06, z * 0.06, 3); const g = col('#3f6a22').lerp(col('#8a9a2c'), clamp(n * 0.8 + 0.4)).lerp(col('#2a4a1a'), clamp(-n));
      const bar = col('#6b6560').lerp(col('#4a4642'), clamp(n + 0.5)).lerp(col('#7a6a58'), sl * 2);
      return g.lerp(bar, lib.smooth(GATE_Z - 1, GATE_Z + 8, z));
    },
  });
  scene.add(ground);
  // тень под деревом
  const shadowTex = lib.radialTexture();
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ map: shadowTex, color: '#000', transparent: true, opacity: 0.45, depthWrite: false }));
  shade.rotation.x = -Math.PI / 2; shade.position.set(1, hFn(0, 0) + 0.08, 1); scene.add(shade);
  shade.material.blending = THREE.CustomBlending; shade.material.blendEquation = THREE.AddEquation; shade.material.blendSrc = THREE.ZeroFactor; shade.material.blendDst = THREE.OneMinusSrcAlphaFactor;

  // ---------- древо познания ----------
  const R = rng(77);
  const barkMat = new THREE.MeshStandardMaterial({ color: '#3b2a1c', roughness: 0.95 });
  const branchGeos = []; const tips = [];
  const trunkPts = [[0, -0.5, 0], [0.3, 2, 0.2], [-0.2, 4.5, -0.1], [0.4, 6.8, 0.2]];
  branchGeos.push(taperTube(trunkPts, 1.7, 0.95, 20, 10));
  // корни
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + R() * 0.5; const d = 3.5 + R() * 2; branchGeos.push(taperTube([[0, 1.6, 0], [Math.cos(a) * 1.4, 0.4, Math.sin(a) * 1.4], [Math.cos(a) * d, -0.3, Math.sin(a) * d]], 0.75, 0.12, 10, 6)); }
  // ветви
  function branch(p0, dir, len, r0, depth) {
    const pts = [p0]; let p = new THREE.Vector3(...p0), d = new THREE.Vector3(...dir).normalize();
    for (let i = 0; i < 3; i++) { d.x += (R() - 0.5) * 0.5; d.z += (R() - 0.5) * 0.5; d.y += (R() - 0.4) * 0.25; d.normalize(); p = p.clone().addScaledVector(d, len / 3); pts.push([p.x, p.y, p.z]); }
    branchGeos.push(taperTube(pts, r0, r0 * 0.45, 10, 6));
    if (depth > 0) for (let k = 0; k < 2; k++) branch([p.x, p.y, p.z], [d.x + (R() - 0.5) * 1.2, d.y + 0.2, d.z + (R() - 0.5) * 1.2], len * 0.6, r0 * 0.45, depth - 1);
    else tips.push(p.clone());
  }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.4; branch([0.3, 6.3, 0.1], [Math.cos(a), 0.75, Math.sin(a)], 7.5, 0.75, 1); }
  // низкая ветвь к Еве (+x), на ней змей и плод
  const lowPts = [[0.6, 4.2, 0.3], [2.4, 4.0, 0.9], [4.4, 3.4, 1.6], [6.3, 3.05, 2.1], [7.4, 3.3, 2.2]];
  branchGeos.push(taperTube(lowPts, 0.42, 0.12, 20, 7));
  const tree = new THREE.Mesh(mergeGeos(branchGeos), barkMat); scene.add(tree);
  const lowCurve = new THREE.CatmullRomCurve3(lowPts.map((p) => new THREE.Vector3(...p)));

  // крона: тёмные массы + светящиеся золотисто-зелёные «листья»-точки
  const m4 = new THREE.Matrix4();
  const bigLeaves = [];
  tips.forEach((tp) => { for (let i = 0; i < 26; i++) { let x, y, z; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const c = col('#4a6a20').lerp(col('#9aa83a'), R() * 0.8); bigLeaves.push([tp.x + x * 3.6, tp.y + 0.6 + y * 1.9, tp.z + z * 3.6, 1.6 + R() * 1.4, c.r, c.g, c.b]); } });
  const bigCanopy = foliage(bigLeaves); scene.add(bigCanopy);
  const LEAF = 9000; const lp = new Float32Array(LEAF * 3), lc = new Float32Array(LEAF * 3), ls = new Float32Array(LEAF);
  for (let i = 0; i < LEAF; i++) {
    const tp = tips[i % tips.length]; let x, y, z; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const s = 3.4 + R() * 1.2; lp.set([tp.x + x * s * 1.25, tp.y + 0.7 + y * s * 0.7, tp.z + z * s * 1.25], i * 3);
    const c = col('#d8e070').lerp(col('#ffc850'), R()).lerp(col('#7ec04a'), R() * 0.6); lc.set([c.r, c.g, c.b], i * 3); ls[i] = R();
  }
  const leafGeo = new THREE.BufferGeometry(); leafGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3)); leafGeo.setAttribute('col', new THREE.BufferAttribute(lc, 3)); leafGeo.setAttribute('sd', new THREE.BufferAttribute(ls, 1));
  const leafU = { time: { value: 0 }, wind: { value: 0.3 }, size: { value: 5 }, pxr: { value: 1 }, bright: { value: 1 }, tint: { value: col('#ffffff') }, fogC: { value: col('#000') }, fogD: { value: 0.012 } };
  const leaves = new THREE.Points(leafGeo, new THREE.ShaderMaterial({
    uniforms: leafU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 col; attribute float sd; uniform float time, wind, size, pxr, bright, fogD; uniform vec3 tint; varying vec3 vC;
      void main(){ vec3 p = position; float h = max(p.y - 5., 0.);
        p.x += (sin(time*1.4 + p.z*.25 + sd*5.)*.6 + sin(time*3.1 + sd*30.)*.25) * wind * h * .08;
        p.z += cos(time*1.1 + p.x*.3 + sd*4.) * wind * h * .05; p.y += sin(time*2.3 + sd*17.)*wind*.15;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv; float d = -mv.z;
        gl_PointSize = min(size*(.5+sd)*pxr*(60./max(d,1.)), 22.);
        float fg = exp(-pow(d*fogD, 2.));
        vC = col*tint*bright*(.7+.3*sin(time*1.7+sd*40.))*fg; }`,
    fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,.0,d); gl_FragColor = vec4(vC*a*a*.55, 1.); }`,
  }));
  leaves.frustumCulled = false; scene.add(leaves);

  // плоды
  const fruitGeo = new THREE.SphereGeometry(0.2, 12, 10); const fruits = [];
  for (let i = 0; i < 26; i++) {
    const tp = tips[i % tips.length]; const a = R() * Math.PI * 2, rr = 1.5 + R() * 2.2;
    const m = new THREE.Mesh(fruitGeo, new THREE.MeshBasicMaterial({ color: col('#ffcf6a').multiplyScalar(1.6) }));
    m.position.set(tp.x + Math.cos(a) * rr, tp.y - 0.6 - R() * 1.2, tp.z + Math.sin(a) * rr); scene.add(m);
    const g = lib.glow('#ffc060', 1.6, 0.55); g.position.copy(m.position); scene.add(g); fruits.push([m, g]);
  }
  // тот самый плод — на низкой ветви
  const forb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffcf6a' }));
  forb.position.copy(lowCurve.getPointAt(0.78)).add(new THREE.Vector3(0, -0.8, 0.15)); scene.add(forb);
  const forbGlow = lib.glow('#ff5030', 2.0, 0.0); forbGlow.position.copy(forb.position); scene.add(forbGlow);
  const forbStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), barkMat); forbStem.position.copy(forb.position).add(new THREE.Vector3(0, 0.45, -0.03)); forbStem.scale.y = 2.0; scene.add(forbStem);

  // змей: тёмная извилистая труба, обвивает ветвь и свешивается к плоду
  const snakeMat = new THREE.MeshStandardMaterial({ color: '#0d0c0a', roughness: 0.4, metalness: 0.3 });
  const SN = 70, SR = 7; let snakeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), SN, 0.1, SR, false);
  const snake = new THREE.Mesh(snakeGeo, snakeMat); snake.frustumCulled = false; scene.add(snake);
  const snakeEye = lib.glow('#ffb040', 0.25, 0.0); scene.add(snakeEye);
  function updateSnake(t) {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const u = 0.2 + i / 14 * 0.5; const c = lowCurve.getPointAt(u); const a = i * 1.15 + t * 0.12; const rr = 0.3 - u * 0.12; pts.push(new THREE.Vector3(c.x, c.y + Math.sin(a) * rr, c.z + Math.cos(a) * rr)); }
    const end = pts[pts.length - 1];
    for (let i = 1; i <= 7; i++) { const k = i / 7; pts.push(new THREE.Vector3(end.x + 0.35 * k + Math.sin(t * 1.3 + k * 5) * 0.22 * k, end.y - k * 0.75 + Math.sin(k * 3.1) * 0.3, end.z + 0.9 * k + Math.sin(t * 1.1 + k * 6) * 0.2 * k)); }
    const curve = new THREE.CatmullRomCurve3(pts); const tg = new THREE.TubeGeometry(curve, SN, 1, SR, false);
    const pos = tg.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i <= SN; i++) { const u = i / SN; const c = curve.getPointAt(u); const r = 0.025 + 0.075 * Math.sin(Math.min(u * 1.1, 1) * Math.PI * 0.9 + 0.1) + (u > 0.95 ? 0.035 : 0);
      for (let j = 0; j <= SR; j++) { const idx = i * (SR + 1) + j; v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c); pos.setXYZ(idx, v.x, v.y, v.z); } }
    tg.computeVertexNormals(); snake.geometry.dispose(); snake.geometry = tg;
    snakeEye.position.copy(curve.getPointAt(1)).add(new THREE.Vector3(0.05, 0.08, 0.05));
  }

  // ---------- другие деревья сада ----------
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.45, 1, 6); trunkGeo.translate(0, 0.5, 0);
  const trees = []; const R2 = rng(5);
  const keepOut = [[-6, 46, 1, 0, 9], [-3, 30, 0, 2, 7], [18, 21, 6, 2, 5], [-40, 46, -28, 52, 9], [-30, 50, -10, 12, 6], [17, 91, 1, 66, 6]];
  const blocked = (x, z) => keepOut.some(([ax, az, bx, bz, r]) => { const dx = bx - ax, dz = bz - az; const k = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)); return Math.hypot(x - ax - dx * k, z - az - dz * k) < r; });
  for (let i = 0; i < 150; i++) {
    const a = R2() * Math.PI * 2, d = 15 + Math.pow(R2(), 0.7) * 100; const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.8 - 8;
    if (z > GATE_Z - 6 || blocked(x, z)) continue; if (Math.abs(x - 8) < 6 && z > -4 && z < 26) continue;
    trees.push([x, z, 6 + R2() * 7, R2()]);
  }
  // кромка сада у ворот — тёмная стена деревьев
  for (let i = 0; i < 30; i++) { const x = (i - 15) * 3.6 + (R2() - 0.5) * 2; if (Math.abs(x) < 6) continue; trees.push([x, GATE_Z - 2 - R2() * 5, 8 + R2() * 5, R2()]); }
  // дерево-укрытие для «спрятались»
  trees.push([12.4, 6.6, 11, 0.9], [15.5, -3, 10, 0.5]);
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, trees.length);
  const qq = new THREE.Quaternion(); const smallLeaves = [];
  trees.forEach(([x, z, h, s], i) => {
    const y = hFn(x, z) - 0.3; const w = 0.7 + s * 0.8;
    m4.compose(new THREE.Vector3(x, y, z), qq, new THREE.Vector3(w, h * 0.8, w)); trunks.setMatrixAt(i, m4);
    const base = col('#2e4a1c').lerp(col('#6a7a2a'), R2() * 0.8).lerp(col('#3a5a4a'), R2() * 0.4); const cr = h * 0.42;
    for (let k = 0; k < 16; k++) { let px, py, pz; do { px = R2() * 2 - 1; py = R2() * 2 - 1; pz = R2() * 2 - 1; } while (px * px + py * py + pz * pz > 1);
      const c = base.clone().multiplyScalar(0.8 + R2() * 0.4); smallLeaves.push([x + px * cr, y + h * 0.82 + py * cr * 0.7, z + pz * cr, cr * (0.55 + R2() * 0.4), c.r, c.g, c.b]); }
  });
  // кусты
  for (let i = 0; i < 260; i++) { const x = (R2() - 0.5) * 200, z = (R2() - 0.5) * 160 - 10; if (z > GATE_Z - 4 || blocked(x, z) || Math.hypot(x - 6, z - 4) < 9) continue;
    const c = col('#3a5a1e').lerp(col('#7a8a30'), R2()); smallLeaves.push([x, hFn(x, z) + 0.5, z, 1.4 + R2() * 1.6, c.r, c.g, c.b]); }
  scene.add(trunks);
  const smallCanopy = foliage(smallLeaves); scene.add(smallCanopy);

  // цветы-точки на траве и светлячки/пыльца
  const FL = 2600, fp = new Float32Array(FL * 3), fc = new Float32Array(FL * 3); const R3 = rng(9);
  for (let i = 0; i < FL; i++) { const x = (R3() - 0.5) * 120, z = (R3() - 0.5) * 120 + 5; if (z > GATE_Z - 3) { i--; continue; } fp.set([x, hFn(x, z) + 0.15, z], i * 3); const c = [col('#fff2d0'), col('#ff9ab0'), col('#ffd84a'), col('#c8a0ff')][Math.floor(R3() * 4)]; fc.set([c.r, c.g, c.b], i * 3); }
  const flGeo = new THREE.BufferGeometry(); flGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3)); flGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const flowers = new THREE.Points(flGeo, new THREE.PointsMaterial({ size: 0.18, vertexColors: true, sizeAttenuation: true, fog: true })); scene.add(flowers);
  const pollen = lib.motes({ count: 900, box: [70, 14, 70], center: [2, 6, 8], size: 3.5, color: '#ffe0a0', speed: 0.25, opacity: 0.7 }); scene.add(pollen);
  const blowing = lib.motes({ count: 500, box: [80, 18, 80], center: [0, 8, 0], size: 4, color: '#c8d890', speed: 1.2, opacity: 0.0, seed: 21 }); scene.add(blowing);

  // лучи света сквозь крону
  const beams = []; const beamDir = new THREE.Vector3(-0.22, -0.55, 1).normalize();
  for (let i = 0; i < 6; i++) {
    const b = lib.lightBeam({ radiusTop: 0.6, radiusBottom: 2.2 + i * 0.4, length: 46, color: '#ffd9a0', opacity: 0.12 });
    b.position.set(-10 + i * 4.2, 22, -14 + (i % 2) * 3); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), beamDir); scene.add(b); beams.push(b);
  }

  // ---------- Адам и Ева ----------
  const adam = lib.figure({ height: 1.8, robe: '#b89a72', skin: '#9a6a48', hood: false, belt: '#6a4a2a', seed: 3 });
  const eve = lib.figure({ height: 1.7, robe: '#c8b090', skin: '#a87a58', hood: true, hoodColor: '#8a6a4a', belt: '#7a5a3a', seed: 8 });
  scene.add(adam, eve);

  // ---------- врата с пламенным мечом ----------
  const gate = new THREE.Group(); gate.position.set(0, hFn(0, GATE_Z), GATE_Z); scene.add(gate);
  const stone = new THREE.MeshStandardMaterial({ color: '#8a7a66', roughness: 0.95 });
  [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(1.3, 9, 1.3), stone); p.position.set(s * 4, 4.5, 0); gate.add(p); const cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 1.7), stone); cap.position.set(s * 4, 0.2, 0); gate.add(cap); });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(4, 0.65, 8, 28, Math.PI), stone); arch.position.y = 9; gate.add(arch);
  const sword = new THREE.Group(); sword.position.set(0, 1.2, 1.5); gate.add(sword);
  const bladeU = { time: { value: 0 }, amt: { value: 1 } };
  const bladeMat = new THREE.ShaderMaterial({
    uniforms: bladeU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: lib.GLSL_NOISE + `uniform float time, amt; varying vec2 vUv;
      void main(){ float x = abs(vUv.x-.5)*2.; float n = fbm2(vec2(vUv.x*4., vUv.y*6. - time*3.));
        float core = smoothstep(.35, 0., x) * smoothstep(1., .9, vUv.y) * smoothstep(0., .04, vUv.y);
        float flame = smoothstep(.9, .1, x + (n-.5)*.9) * smoothstep(1., .6, vUv.y + (n-.5)*.2);
        vec3 c = vec3(1.,.62,.25)*core*.75 + mix(vec3(.85,.18,.02), vec3(1.,.5,.1), n)*flame*.8;
        gl_FragColor = vec4(c*amt, 1.); }`,
  });
  for (let k = 0; k < 2; k++) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 7.2), bladeMat); pl.position.y = 3.6; pl.rotation.y = k * Math.PI / 2; sword.add(pl); }
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.15, 0.15), new THREE.MeshBasicMaterial({ color: '#ffb050' })); hilt.position.y = 0.05; sword.add(hilt);
  const swordFire = lib.fire({ count: 260, radius: 0.35, height: 7.5, size: 22, seed: 31, color1: '#ff7a28', color2: '#ff2a06' }); sword.add(swordFire);
  const swordGlow = lib.glow('#ff8a30', 12, 0.5); swordGlow.position.y = 3.8; sword.add(swordGlow);
  const swordLight = new THREE.PointLight('#ff8a3a', 0, 40, 1.6); swordLight.position.set(0, 4, 2); gate.add(swordLight);
  const gardenGlow = lib.glow('#ffb860', 30, 0); gardenGlow.position.set(0, 5, GATE_Z - 14); scene.add(gardenGlow);
  const ash = lib.motes({ count: 500, box: [60, 12, 50], center: [0, 5, GATE_Z + 25], size: 3, color: '#b8b0a8', speed: 0.5, opacity: 0.0, seed: 41 }); scene.add(ash);

  // ---------- образы (свет/цвет) ----------
  const L0 = { skyTop: '#5d7fa8', skyHor: '#ffc27a', fog: '#d8ac70', fogD: 0.012, sunI: 2.2, sunC: '#ffd49a', hemi: 0.6, glow: 0.75, sunY: 0.09, leaf: 1.0, leafT: '#ffffff', fruit: 1.0, beam: 1, exp: 1.0, sat: 1.08, fl: '#ffc98a', fa: '#4a5a34' };
  const L1 = { ...L0, skyHor: '#ffb066', fog: '#c89a62', sunY: 0.07 };
  const Lhide = { skyTop: '#2a3a52', skyHor: '#7a7a88', fog: '#4a5260', fogD: 0.018, sunI: 0.4, sunC: '#a8b8d8', hemi: 0.3, glow: 0.25, sunY: 0.02, leaf: 0.45, leafT: '#9ab0c8', fruit: 0.5, beam: 0, exp: 0.9, sat: 0.75, fl: '#5a6a88', fa: '#222a36' };
  const Ldusk = { skyTop: '#0e1630', skyHor: '#6a4a68', fog: '#2a2638', fogD: 0.011, sunI: 0.25, sunC: '#d08aa0', hemi: 0.22, glow: 0.35, sunY: -0.02, leaf: 0.5, leafT: '#c0b0d0', fruit: 0.7, beam: 0, exp: 1.0, sat: 0.85, fl: '#7a5a80', fa: '#1a2034' };
  const Lgate = { skyTop: '#3a4048', skyHor: '#8a8580', fog: '#6e6a66', fogD: 0.016, sunI: 0.5, sunC: '#c8c0b8', hemi: 0.45, glow: 0.4, sunY: 0.05, leaf: 0.5, leafT: '#c0b0a0', fruit: 0.5, beam: 0, exp: 0.95, sat: 0.6, fl: '#8a8682', fa: '#3a3a38' };
  const looks = [[0, L0], [C.fruit, L1], [C.hide - 0.3, L1], [C.hide + 2.5, Lhide], [C.where - 0.01, Lhide], [C.where, Ldusk], [C.sword - 0.01, Ldusk], [C.sword, Lgate], [99, Lgate]];

  const eveHome = new THREE.Vector3(6.6, 0, 3.6), adamHome = new THREE.Vector3(4.4, 0, 5.4);
  const placeFig = (f, x, z, ry) => { f.position.set(x, hFn(x, z), z); f.rotation.y = ry; };

  return {
    scene, camera,
    update(t, S) {
      const Lk = look(looks, t);
      const where = t >= C.where && t < C.sword;
      leafU.wind.value = where ? 1.4 + 0.5 * Math.sin(t * 0.7) : t > C.hide ? 0.7 : 0.3;
      sky.u.top.value.copy(Lk.skyTop); sky.u.horizon.value.copy(Lk.skyHor); sky.u.bottom.value.copy(Lk.skyHor).multiplyScalar(0.4);
      sky.u.sunDir.value.set(0.22, Lk.sunY, -1).normalize(); sky.u.sunColor.value.copy(Lk.sunC); sky.u.sunGlow.value = Lk.glow;
      scene.fog.color.copy(Lk.fog); scene.fog.density = Lk.fogD; leafU.fogD.value = Lk.fogD * 0.8;
      sun.intensity = Lk.sunI; sun.color.copy(Lk.sunC); hemi.intensity = Lk.hemi;
      fill.intensity = Lk.hemi * 0.8;
      for (const f of [bigCanopy, smallCanopy]) { f.u.lightC.value.copy(Lk.fl); f.u.ambC.value.copy(Lk.fa); f.u.fogC.value.copy(Lk.fog); f.u.fogD.value = Lk.fogD; f.u.wind.value = leafU.wind.value; }
      leafU.bright.value = Lk.leaf; leafU.tint.value.copy(Lk.leafT);
      beams.forEach((b, i) => (b.u.opacity.value = 0.11 * Lk.beam * (0.7 + 0.3 * Math.sin(t * 0.4 + i * 2))));
      fruits.forEach(([m, g], i) => { g.material.opacity = 0.5 * Lk.fruit * (0.85 + 0.15 * Math.sin(t * 1.5 + i)); });
      S.post.exposure = Lk.exp; S.post.sat = Lk.sat; S.post.bloom = 0.65; S.post.bloomThreshold = 0.75;

      // ветер
      blowing.u.opacity.value = where ? 0.5 : 0; pollen.u.opacity.value = t < C.hide ? 0.7 : t < C.where ? 0.25 : 0.15;
      blowing.position.x = where ? (t - C.where) * 3 - 10 : 0;

      // запретный плод краснеет, змей появляется
      const red = ramp(t, C.fruit + 1.0, 2.0);
      forb.material.color.set('#ffcf6a').lerp(col('#ff2a10'), red).multiplyScalar(1.05 + red * 0.6);
      forbGlow.material.opacity = red * (0.55 + 0.15 * Math.sin(t * 3)) * (t > C.where ? 0.6 : 1);
      const eaten = t > C.hide - 0.6; forb.visible = forbStem.visible = !eaten || t > C.where; if (t > C.where) forb.material.color.set('#7a2010');
      snake.visible = t > C.fruit - 0.5 && t < C.sword; if (snake.visible) updateSnake(t);
      snakeEye.material.opacity = snake.visible ? 0.9 * ramp(t, C.fruit + 0.5, 1) * (1 - ramp(t, C.hide, 1)) : 0;

      // фигуры
      adam.visible = eve.visible = true;
      for (const f of [adam, eve]) { lib.walkPose(f, 0, 0); f.parts.arms[0].rotation.set(0, 0, -0.12); f.parts.arms[1].rotation.set(0, 0, 0.12); }
      adam.parts.head.rotation.x = 0; eve.parts.head.rotation.x = 0;
      if (t < C.hide) {
        placeFig(eve, eveHome.x, eveHome.z, Math.PI * 1.08); placeFig(adam, adamHome.x, adamHome.z, Math.PI * 1.2);
        if (t < C.fruit) { // гуляют
          const w = Math.sin(t * 0.3) * 0.4; placeFig(eve, eveHome.x + 1.2 + w, eveHome.z + 1.5, Math.PI * 1.1); placeFig(adam, adamHome.x - 0.5, adamHome.z + 0.6, Math.PI * 0.8);
          adam.parts.arms[1].rotation.x = -0.3;
        } else {
          const reach = ramp(t, C.fruit + 1.6, 1.8);
          const ex = lerp(eveHome.x + 1.2, forb.position.x + 0.3, ramp(t, C.fruit, 1.6)), ez = lerp(eveHome.z + 1.5, forb.position.z + 0.45, ramp(t, C.fruit, 1.6));
          placeFig(eve, ex, ez, Math.PI * 1.08); lib.walkPose(eve, (t - C.fruit) * 1.2, 1 - ramp(t, C.fruit + 1.2, 0.4));
          eve.parts.arms[1].rotation.x = -2.85 * reach; eve.parts.arms[1].rotation.z = 0.12 + 0.25 * reach;
          // плод сорван
        }
      } else {
        // уходят и прячутся за деревьями
        const k = ramp(t, C.hide + 0.2, 2.6);
        const ex = lerp(forb.position.x + 0.3, 10.2, k), ez = lerp(forb.position.z + 0.45, 0.4, k);
        const ax = lerp(adamHome.x, 10.8, k), az = lerp(adamHome.z, 1.8, k);
        placeFig(eve, ex, ez, Math.atan2(10.2 - eveHome.x, 0.4 - eveHome.z)); placeFig(adam, ax, az, Math.atan2(10.8 - adamHome.x, 1.8 - adamHome.z));
        lib.walkPose(eve, t * 1.3, k < 1 ? 1 : 0); lib.walkPose(adam, t * 1.25 + 0.3, k < 1 ? 1 : 0);
        eve.parts.head.rotation.x = 0.35; adam.parts.head.rotation.x = 0.35;
        if (t >= C.where) { adam.visible = eve.visible = false; }
      }
      if (t >= C.sword) {
        // уходят от ворот в серую землю
        const k = (t - C.sword) / (S.dur - C.sword);
        const z0 = GATE_Z + 3.5 + k * 16; adam.visible = eve.visible = true;
        placeFig(adam, -0.2 + k * 9, z0, Math.PI * 0.32); placeFig(eve, 1.2 + k * 9, z0 - 0.7, Math.PI * 0.32);
        lib.walkPose(adam, t * 0.9, 0.8); lib.walkPose(eve, t * 0.9 + 0.4, 0.8);
        eve.parts.head.rotation.x = 0.45; adam.parts.head.rotation.x = 0.4; adam.parts.arms[1].rotation.x = -0.6; adam.parts.arms[1].rotation.z = 0.5;
      }

      // меч
      const sw = ramp(t, C.sword - 0.2, 1.2);
      sword.visible = t > C.sword - 0.5; sword.rotation.set(Math.sin(t * 0.9) * 0.12, t * 1.6, Math.sin(t * 1.3) * 0.1); bladeU.amt.value = sw * (0.6 + 0.1 * Math.sin(t * 9)); if (t > C.sword - 0.5) { S.post.bloom = 0.5; S.post.bloomThreshold = 0.85; }
      swordFire.u.intensity.value = sw * 0.45; swordGlow.material.opacity = sw * 0.55; swordLight.intensity = sw * 60 * (0.85 + 0.15 * Math.sin(t * 11));
      ash.u.opacity.value = t > C.sword ? 0.5 : 0; gardenGlow.material.opacity = t > C.sword ? 0.35 : 0;

      // ---------- камера ----------
      if (t < C.fruit) {
        cameraPath(camera, [[0, [-6, 3.0, 46], [1, 7.5, 0]], [C.fruit, [-3, 3.6, 30], [1.5, 7.5, 0]]], t);
        handheld(camera, t, 0.004);
      } else if (t < C.where) {
        cameraPath(camera, [[C.fruit, [10.6, 1.9, 8.6], [5.6, 2.3, 2.6]], [C.hide, [12.0, 2.2, 11.5], [6.2, 2.3, 2.4]], [C.where, [17.5, 3.6, 20.5], [9.5, 2.0, 1.5]]], t);
        handheld(camera, t, 0.006);
      } else if (t < C.sword) {
        cameraPath(camera, [[C.where, [-38, 9, 44], [-4, 6, -6]], [C.sword, [-30, 8, 50], [-1, 6.5, -4]]], t);
        handheld(camera, t, 0.003);
      } else {
        cameraPath(camera, [[C.sword, [13, 1.8, GATE_Z + 24], [2, 4.5, GATE_Z]], [S.dur, [12, 1.7, GATE_Z + 27], [4, 4, GATE_Z + 6]]], t);
        handheld(camera, t, 0.004);
      }
    },
  };
}
