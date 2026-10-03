// Откровение: Патмос ночью → печати, падающие звёзды, буря → рассвет нового мира → (цитата) тихое море
// → Новый Иерусалим: хрустальный город, река жизни и древо жизни → камера отъезжает: сад → «Се, творю все новое».
export default function build({ THREE, lib, W, H, meta }) {
  const { ramp, lerp, clamp, rng, fbm, noise2, smooth, cameraPath, handheld } = lib;
  const C = meta.cues;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#05070c', 0.003);
  const col = (c) => new THREE.Color(c);
  const add = (p, o) => (p.add(o), o);

  // ---------- общее небо (следует за камерой) ----------
  const sky = add(scene, lib.skyDome({ top: '#02040c', horizon: '#1a2a48', bottom: '#020308', sunDir: [0.05, -0.1, 1], sunColor: '#ffd9a0', sunSize: 0.028, sunGlow: 0, stars: 1.0, radius: 1200 }));
  const stars = add(scene, lib.starfield({ count: 5000, radius: 1100, size: 2.2, minY: 0.02, seed: 41 }));

  // ================= МОРЕ И ОСТРОВ =================
  const isle = add(scene, new THREE.Group());
  const sea = add(isle, lib.ocean({ size: 1800, seg: 150, deep: '#01040a', shallow: '#04101a', sky: '#0c1424', amp: 0.7, choppy: 1.0, foam: 0.15, sunDir: [0.05, 0.1, 1], sunColor: '#000' }));
  const islandH = (x, z) => { // плато, приподнятое к южному краю, обрывается утёсом к камере
    const n = fbm(x * 0.04, z * 0.04, 4);
    const e = Math.hypot(x / 44, z / 28) * (1 + n * 0.18);
    const inside = z > 0 ? 1 - smooth(0.86, 1.0, e) : 1 - smooth(0.55, 1.05, e);
    const rock = fbm(x * 0.12 + 5, z * 0.12, 4) * 2.5;
    return inside * (12 + 0.5 * (z + 28) + rock) - 6 * (1 - inside) + 1.0;
  };
  const island = add(isle, lib.terrain({
    size: 260, seg: 150, heightFn: islandH,
    colorFn: (x, z, y, sl) => col('#6a6050').lerp(col('#3a342c'), clamp(sl * 1.6)).lerp(col('#7a6e58'), clamp((y - 20) / 12) * 0.5).multiplyScalar(0.8 + 0.2 * noise2(x * 0.3, z * 0.3)),
  }));
  island.material.roughness = 1;
  // Иоанн на краю утёса
  const FX = 2, FZ = 22; const FY = islandH(FX, FZ);
  const john = add(isle, lib.figure({ height: 1.8, robe: '#2e2a26', hood: true, seed: 7 })); john.position.set(FX, FY - 0.05, FZ); john.rotation.y = 0.15;
  john.parts.head.rotation.x = -0.35; john.parts.hood.rotation.x = -0.7;
  john.scale.setScalar(2.4);
  const moonL = add(isle, new THREE.DirectionalLight('#9ab4e0', 1.2)); moonL.position.set(-200, 160, -500);
  const hemiS = add(isle, new THREE.HemisphereLight('#3a4a6a', '#080606', 0.25));
  const CAM0 = [-50, 5, 205]; const moon = add(isle, lib.glow('#dce6ff', 26, 0.55));
  moon.position.set(FX - 5, FY + 9, FZ).sub(new THREE.Vector3(...CAM0)).normalize().multiplyScalar(820).add(new THREE.Vector3(...CAM0)); moon.material.fog = false;
  const moonHalo = add(isle, lib.glow('#6a80b0', 260, 0.22)); moonHalo.position.copy(moon.position); moonHalo.material.fog = false;
  // буря: тёмные облака, семь светил, молнии, падающие звёзды
  const clouds = add(isle, lib.cloudLayer({ count: 34, area: [1600, 900], y: 230, scale: [380, 170], seed: 21, color: '#2a2a36', opacity: 0.9, center: [0, 620] }));
  clouds.children.forEach((c) => (c.material.fog = false));
  const seals = []; for (let i = 0; i < 7; i++) {
    const g = add(isle, lib.glow('#fff2d8', 60, 0)); g.position.set(-330 + i * 110, 300 + Math.sin(i / 6 * Math.PI) * 90, 820); g.material.fog = false;
    const h = add(isle, lib.glow('#ffcf80', 240, 0)); h.position.copy(g.position); h.material.fog = false; seals.push([g, h]);
  }
  const bolts = [[1.05, -300, 0.2], [1.85, 220, 0.25], [2.6, -60, 0.18], [3.35, 380, 0.22], [4.0, -420, 0.2]].map(([dt, x, d]) => { const g = add(isle, lib.glow('#c8d4ff', 500, 0)); g.position.set(x, 260, 700); g.material.fog = false; return { g, dt, d }; });
  const babylon = add(isle, lib.glow('#ff5a20', 700, 0)); babylon.position.set(300, 10, 1100); babylon.scale.set(900, 240, 1); babylon.material.fog = false;
  const NFS = 70, fr = rng(66); const fsP = new Float32Array(NFS * 6), fsV = new Float32Array(NFS * 6), fsT = new Float32Array(NFS * 2), fsH = new Float32Array(NFS * 2);
  for (let i = 0; i < NFS; i++) {
    const x = (fr() - 0.5) * 1000, y = 320 + fr() * 200, z = 600 + fr() * 500; const vx = (fr() - 0.3) * 160, vy = -(240 + fr() * 200);
    const t0 = 1.3 + fr() * 3.6;
    fsP.set([x, y, z, x, y, z], i * 6); fsV.set([vx, vy, 0, vx, vy, 0], i * 6); fsT.set([t0, t0], i * 2); fsH.set([0, 1], i * 2);
  }
  const fsG = new THREE.BufferGeometry(); fsG.setAttribute('position', new THREE.BufferAttribute(fsP, 3)); fsG.setAttribute('vel', new THREE.BufferAttribute(fsV, 3));
  fsG.setAttribute('t0', new THREE.BufferAttribute(fsT, 1)); fsG.setAttribute('head', new THREE.BufferAttribute(fsH, 1));
  const fsU = { lt: { value: 0 }, op: { value: 1 } };
  const falling = add(isle, new THREE.LineSegments(fsG, new THREE.ShaderMaterial({
    uniforms: fsU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `attribute vec3 vel; attribute float t0, head; uniform float lt; varying float vA;
      void main(){ float a = lt - t0; vec3 p = position + vel*max(a,0.) - vel*(1.-head)*.14;
        vA = step(0., a)*(1.-smoothstep(.9, 1.4, a))*(.25 + .75*head);
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `uniform float op; varying float vA; void main(){ gl_FragColor = vec4(vec3(1.,.85,.6)*vA*op*1.5, 1.); }`,
  })));
  falling.frustumCulled = false;
  const sunDisc = add(isle, lib.glow('#ffd8a0', 220, 0)); sunDisc.material.fog = false;
  const mist = add(isle, lib.motes({ count: 900, box: [300, 30, 400], center: [0, 12, 380], size: 14, color: '#ffe0c0', speed: 0.15, kind: 'rise', opacity: 0 }));

  // ================= НОВЫЙ ИЕРУСАЛИМ И САД =================
  const GX = 6000;
  const gard = add(scene, new THREE.Group()); gard.position.set(GX, 0, 0);
  const riverX = (z) => 16 * Math.sin(z * 0.011 + 0.6) + 6 * Math.sin(z * 0.029);
  const CZ = -430; // центр города
  const gH = (x, z) => {
    const dr = Math.abs(x - riverX(z)); const base = fbm(x * 0.012, z * 0.012, 4) * 3.2 + Math.max(0, Math.abs(x) - 120) * 0.12 + fbm(x * 0.004 + 3, z * 0.004, 3) * 8;
    const flat = smooth(90, 150, Math.hypot(x, (z - CZ) * 1.2)); // площадка под город
    return lerp(-2.4, base * flat + 0.2, smooth(4.5, 13, dr));
  };
  const ground = add(gard, lib.terrain({
    size: 1100, seg: 150, center: [0, -200], heightFn: gH,
    colorFn: (x, z, y) => { const n = fbm(x * 0.05, z * 0.05, 3); return col('#3a5a22').lerp(col('#8a9a3a'), clamp(n * 0.8 + 0.45)).lerp(col('#2a3a1a'), clamp(-n)).lerp(col('#4a4030'), clamp(-y / 2)); },
  }));
  ground.position.set(0, 0, -200);
  // река света
  const RZ0 = CZ + 75, RZ1 = 340, RN = 260; const rpos = [], ruv = [], ridx = [];
  for (let i = 0; i <= RN; i++) {
    const z = lerp(RZ0, RZ1, i / RN), x = riverX(z), w = 6.5 + 1.5 * Math.sin(i * 0.2);
    rpos.push(x - w, -0.9, z, x + w, -0.9, z); ruv.push(-1, i / RN, 1, i / RN);
    if (i < RN) { const k = i * 2; ridx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const rG = new THREE.BufferGeometry(); rG.setAttribute('position', new THREE.Float32BufferAttribute(rpos, 3)); rG.setAttribute('ruv', new THREE.Float32BufferAttribute(ruv, 2)); rG.setIndex(ridx);
  const rU = { time: { value: 0 }, bright: { value: 1 } };
  const river = add(gard, new THREE.Mesh(rG, new THREE.ShaderMaterial({
    uniforms: rU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec2 ruv; varying vec2 vUv; varying float vD; void main(){ vUv = ruv; vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: lib.GLSL_NOISE + `uniform float time, bright; varying vec2 vUv; varying float vD;
      void main(){ float e = 1. - vUv.x*vUv.x; float flow = vUv.y*90. - time*1.6;
        float n = fbm2(vec2(vUv.x*3., flow*.5)); float bands = .55 + .45*sin(flow*2. + n*6.);
        vec3 c = mix(vec3(.2,.6,.85), vec3(1.,.88,.6), n*.7 + bands*.25);
        float fade = smoothstep(1., .9, vUv.y)*.85 + .15;
        gl_FragColor = vec4(c*e*(.45 + .55*bands*n)*bright*fade*exp(-vD*.0015)*.95, 1.); }`,
  })));
  river.frustumCulled = false;
  // город: стены, ворота, хрустальные башни
  const city = add(gard, new THREE.Group()); city.position.set(0, 0, CZ);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#4a7a8a', emissive: '#1a3a48', emissiveIntensity: 0.5, roughness: 0.12, metalness: 0.75 });
  const goldMat = new THREE.MeshBasicMaterial({ color: '#ffe0a0' });
  const CW = 150, WHt = 30;
  [[0, CW / 2, CW, 4], [0, -CW / 2, CW, 4], [CW / 2, 0, 4, CW], [-CW / 2, 0, 4, CW]].forEach(([x, z, w, d]) => {
    const m = add(city, new THREE.Mesh(new THREE.BoxGeometry(w, WHt, d), wallMat)); m.position.set(x, WHt / 2, z);
    const band = add(city, new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1.2, d + 1), goldMat)); band.position.set(x, WHt + 0.6, z);
    const band2 = add(city, new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6), goldMat)); band2.position.set(x, 3, z);
    const n = 13; for (let i = 0; i <= n; i++) { const k = i / n - 0.5; const pl = add(city, new THREE.Mesh(new THREE.BoxGeometry(w > d ? 0.9 : w + 0.8, WHt + 6, w > d ? d + 0.8 : 0.9), goldMat)); pl.position.set(x + (w > d ? k * w : 0), (WHt + 6) / 2, z + (w > d ? 0 : k * d)); pl.scale.y = 1; }
  });
  const gateTex = lib.canvasTexture(128, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe8b0'); gr.addColorStop(1, '#fff8e8'); g.fillStyle = gr; g.beginPath(); g.moveTo(14, h); g.lineTo(14, h * 0.32); g.arc(w / 2, h * 0.32, w / 2 - 14, Math.PI, 0); g.lineTo(w - 14, h); g.fill(); });
  const gateMat = new THREE.MeshBasicMaterial({ map: gateTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: '#ffffff' });
  const gateGlows = [];
  [-48, 0, 48].forEach((x) => {
    const gm = add(city, new THREE.Mesh(new THREE.PlaneGeometry(11, 22), gateMat)); gm.position.set(x, 11, CW / 2 + 2.2);
    const gg = add(city, lib.glow('#ffe4a8', 60, 0.5)); gg.position.set(x, 12, CW / 2 + 6); gateGlows.push(gg);
  });
  [-48, 0, 48].forEach((z) => [-1, 1].forEach((s) => { const gm = add(city, new THREE.Mesh(new THREE.PlaneGeometry(11, 22), gateMat)); gm.position.set(s * (CW / 2 + 2.2), 11, z); gm.rotation.y = s * Math.PI / 2; }));
  const crystal = new THREE.MeshStandardMaterial({ color: '#cfe0f4', emissive: '#ffcf80', emissiveIntensity: 0.7, roughness: 0.08, metalness: 0.7, flatShading: true });
  const cr = rng(17); const prism = new THREE.CylinderGeometry(1, 1, 1, 6); prism.translate(0, 0.5, 0); const tip = new THREE.ConeGeometry(1, 1, 6); tip.translate(0, 0.5, 0);
  const NT = 46; const towers = new THREE.InstancedMesh(prism, crystal, NT), tips = new THREE.InstancedMesh(tip, crystal, NT);
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), e3 = new THREE.Euler();
  for (let i = 0; i < NT; i++) {
    const a = cr() * Math.PI * 2, d = i === 0 ? 0 : 12 + Math.sqrt(cr()) * 55; const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = i === 0 ? 115 : 34 + (1 - d / 70) * 70 * (0.5 + cr() * 0.5), r = i === 0 ? 6 : 2.5 + cr() * 3.5;
    qq.setFromEuler(e3.set(0, cr() * 3, 0));
    m4.compose(new THREE.Vector3(x, 0, z), qq, new THREE.Vector3(r, h, r)); towers.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, h, z), qq, new THREE.Vector3(r, r * 3.5, r)); tips.setMatrixAt(i, m4);
  }
  city.add(towers, tips);
  const cityHalo = add(city, lib.glow('#ffe6b0', 700, 0.2)); cityHalo.position.set(0, 60, 0); cityHalo.material.fog = false;
  const cityCore = add(city, lib.glow('#fff4dc', 160, 0.3)); cityCore.position.set(0, 120, 0); cityCore.material.fog = false;
  const cityL = add(city, new THREE.PointLight('#ffe0a8', 0, 0, 0)); // запасной (не используется)
  cityL.visible = false;
  // свет сада
  const sunG = add(gard, new THREE.DirectionalLight('#ffd49a', 2.0)); sunG.position.set(40, 60, -300); sunG.target.position.set(0, 0, 0); gard.add(sunG.target);
  const hemiG = add(gard, new THREE.HemisphereLight('#bcd2e8', '#3a2a14', 0.65));
  const fillG = add(gard, new THREE.DirectionalLight('#ffe2b8', 0.5)); fillG.position.set(10, 25, 80);

  // ---------- древо жизни (как в Эдеме: узловатый ствол, широкая крона из золотисто-зелёных точек, светящиеся плоды) ----------
  function taperTube(pts, r0, r1, seg = 24, rad = 7, gn = 0) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, seg, 1, rad, false); const pos = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      const c = curve.getPointAt(i / seg); const r = lerp(r0, r1, Math.pow(i / seg, 0.8));
      for (let j = 0; j <= rad; j++) { const idx = i * (rad + 1) + j; const k = 1 + gn * noise2(i * 0.7 + pts[0][0] * 3, j * 1.3); v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r * k).add(c); pos.setXYZ(idx, v.x, v.y, v.z); }
    }
    g.computeVertexNormals(); return g;
  }
  const mergeGeos = (geos) => {
    const posA = [], norA = [], idx = []; let off = 0;
    for (const g of geos) { const p = g.attributes.position, nn = g.attributes.normal; for (let i = 0; i < p.count; i++) { posA.push(p.getX(i), p.getY(i), p.getZ(i)); norA.push(nn.getX(i), nn.getY(i), nn.getZ(i)); } for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); off += p.count; }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(norA, 3)); m.setIndex(idx); return m;
  };
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
  const massU = { time: { value: 0 }, pxr: { value: 1 }, wind: { value: 0.2 }, map: { value: leafAtlas }, lightC: { value: col('#ffd9a0') }, ambC: { value: col('#405030') }, fogC: { value: col('#e8c890') }, fogD: { value: 0.0022 } };
  const massMat = new THREE.ShaderMaterial({
    uniforms: massU,
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
  const glowU = { time: { value: 0 }, wind: { value: 0.3 }, size: { value: 5 }, pxr: { value: 1 }, bright: { value: 1 }, fogD: { value: 0.0022 } };
  const glowMat = new THREE.ShaderMaterial({
    uniforms: glowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 col; attribute float sd; uniform float time, wind, size, pxr, bright, fogD; varying vec3 vC;
      void main(){ vec3 p = position; p.x += (sin(time*1.4 + p.z*.25 + sd*5.)*.6 + sin(time*3.1 + sd*30.)*.25) * wind * .3;
        p.z += cos(time*1.1 + p.x*.3 + sd*4.) * wind * .2; p.y += sin(time*2.3 + sd*17.)*wind*.15;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv; float d = -mv.z;
        gl_PointSize = min(size*(.5+sd)*pxr*(60./max(d,1.)), 22.);
        vC = col*bright*(.7+.3*sin(time*1.7+sd*40.))*exp(-pow(d*fogD, 2.)); }`,
    fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,.0,d); gl_FragColor = vec4(vC*a*a*.55, 1.); }`,
  });
  const barkMat = new THREE.MeshStandardMaterial({ color: '#3b2a1c', roughness: 0.95 });
  const masses = [], glows = [], fruitsP = [];
  function makeTree(seed, cx, cz, S, big) {
    const R = rng(seed); const geos = []; const tipsT = []; const y0 = gH(cx, cz);
    const T = (p) => [cx + p[0] * S, y0 + p[1] * S, cz + p[2] * S];
    geos.push(taperTube([[0, -0.5, 0], [0.3, 2, 0.2], [-0.2, 4.5, -0.1], [0.4, 6.8, 0.2]].map(T), 1.7 * S, 0.95 * S, big ? 20 : 10, big ? 10 : 6, big ? 0.22 : 0.1));
    const nRoots = big ? 6 : 3;
    for (let i = 0; i < nRoots; i++) { const a = i / nRoots * Math.PI * 2 + R() * 0.5; const d = 3.5 + R() * 2; geos.push(taperTube([[0, 1.6, 0], [Math.cos(a) * 1.4, 0.4, Math.sin(a) * 1.4], [Math.cos(a) * d, -0.3, Math.sin(a) * d]].map(T), 0.75 * S, 0.12 * S, big ? 10 : 5, big ? 6 : 4)); }
    const branch = (p0, dir, len, r0, depth) => {
      const pts = [p0]; let p = new THREE.Vector3(...p0), d = new THREE.Vector3(...dir).normalize();
      for (let i = 0; i < 3; i++) { d.x += (R() - 0.5) * 0.5; d.z += (R() - 0.5) * 0.5; d.y += (R() - 0.4) * 0.25; d.normalize(); p = p.clone().addScaledVector(d, len / 3); pts.push([p.x, p.y, p.z]); }
      geos.push(taperTube(pts.map(T), r0 * S, r0 * 0.45 * S, big ? 10 : 6, big ? 6 : 4, big ? 0.15 : 0));
      if (depth > 0) for (let k = 0; k < 2; k++) branch([p.x, p.y, p.z], [d.x + (R() - 0.5) * 1.2, d.y + 0.2, d.z + (R() - 0.5) * 1.2], len * 0.6, r0 * 0.45, depth - 1);
      else tipsT.push(new THREE.Vector3(...T([p.x, p.y, p.z])));
    };
    const nb = big ? 6 : 4;
    for (let i = 0; i < nb; i++) { const a = i / nb * Math.PI * 2 + 0.4 + R() * 0.3; branch([0.3, 6.3, 0.1], [Math.cos(a), 0.75, Math.sin(a)], 7.5, 0.75, big ? 1 : 0); }
    gard.add(new THREE.Mesh(mergeGeos(geos), barkMat));
    const nm = big ? 26 : 14, ng = big ? 9000 : 320, sp = big ? 1 : 1.5;
    tipsT.forEach((tp) => { for (let i = 0; i < nm; i++) { let x, y, z; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1);
      const c = col('#4a6a20').lerp(col('#9aa83a'), R() * 0.8); masses.push([tp.x + x * 3.6 * S * sp, tp.y + (0.6 + y * 1.9) * S, tp.z + z * 3.6 * S * sp, (1.6 + R() * 1.4) * S, c.r, c.g, c.b]); } });
    for (let i = 0; i < ng; i++) {
      const tp = tipsT[i % tipsT.length]; let x, y, z; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1);
      const s = (3.4 + R() * 1.2) * S; const c = col('#d8e070').lerp(col('#ffc850'), R()).lerp(col('#7ec04a'), R() * 0.6);
      glows.push([tp.x + x * s * 1.25 * sp, tp.y + 0.7 * S + y * s * 0.7, tp.z + z * s * 1.25 * sp, c.r, c.g, c.b, R()]);
    }
    const nf = big ? 30 : 4;
    for (let i = 0; i < nf; i++) { const tp = tipsT[i % tipsT.length]; const a = R() * Math.PI * 2, rr = (1.5 + R() * 2.2) * S; fruitsP.push([tp.x + Math.cos(a) * rr, tp.y - (0.6 + R() * 1.2) * S, tp.z + Math.sin(a) * rr, S]); }
  }
  const TZ = 25, TX = riverX(TZ) - 19; // древо жизни на левом берегу
  makeTree(77, TX, TZ, 1.0, true);
  // сад: деревья вдоль реки (по обоим берегам)
  const tr = rng(303); const gardenTrees = [];
  for (let i = 0; i < 22; i++) {
    const z = lerp(-250, 230, i / 21) + (tr() - 0.5) * 20; if (Math.abs(z - TZ) < 40) continue; const side = i % 2 ? 1 : -1;
    const x = riverX(z) + side * (16 + tr() * 30); gardenTrees.push([x, z]); makeTree(500 + i, x, z, 0.5 + tr() * 0.25, false);
  }
  for (let i = 0; i < 6; i++) { const z = lerp(-200, 260, tr()), side = tr() > 0.5 ? 1 : -1; const x = riverX(z) + side * (55 + tr() * 70); makeTree(800 + i, x, z, 0.45 + tr() * 0.2, false); }
  // крона: массы + свечение
  { const n = masses.length, p = new Float32Array(n * 3), c = new Float32Array(n * 3), s = new Float32Array(n * 2); const r = rng(n + 3);
    masses.forEach((e, i) => { p.set([e[0], e[1], e[2]], i * 3); c.set([e[4], e[5], e[6]], i * 3); s.set([e[3], Math.floor(r() * 4) + r() * 0.9], i * 2); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('col', new THREE.BufferAttribute(c, 3)); g.setAttribute('sd', new THREE.BufferAttribute(s, 2));
    const pts = add(gard, new THREE.Points(g, massMat)); pts.frustumCulled = false; }
  { const n = glows.length, p = new Float32Array(n * 3), c = new Float32Array(n * 3), s = new Float32Array(n);
    glows.forEach((e, i) => { p.set([e[0], e[1], e[2]], i * 3); c.set([e[3], e[4], e[5]], i * 3); s[i] = e[6]; });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('col', new THREE.BufferAttribute(c, 3)); g.setAttribute('sd', new THREE.BufferAttribute(s, 1));
    const pts = add(gard, new THREE.Points(g, glowMat)); pts.frustumCulled = false; }
  const fruitGeo = new THREE.SphereGeometry(0.2, 12, 10); const fruitMat = new THREE.MeshBasicMaterial({ color: col('#ffcf6a').multiplyScalar(1.6) });
  const fruitIM = add(gard, new THREE.InstancedMesh(fruitGeo, fruitMat, fruitsP.length)); const fruitGlows = [];
  fruitsP.forEach(([x, y, z, S], i) => { m4.compose(new THREE.Vector3(x, y, z), qq.identity(), new THREE.Vector3(S, S, S)); fruitIM.setMatrixAt(i, m4);
    if (S > 0.9) { const g = add(gard, lib.glow('#ffc060', 1.6, 0.55)); g.position.set(x, y, z); fruitGlows.push(g); } });
  // цветы и травинки-искры у реки
  const NFL = 5000, flr = rng(9); const flP = new Float32Array(NFL * 3), flC = new Float32Array(NFL * 3), flS = new Float32Array(NFL);
  const flCols = ['#fff4e0', '#ffc8d8', '#ffe08a', '#c8e0ff', '#ffd0a0'].map(col);
  for (let i = 0; i < NFL; i++) { const z = lerp(-280, 330, flr()); const side = flr() > 0.5 ? 1 : -1; const x = riverX(z) + side * (8 + Math.pow(flr(), 1.5) * 90);
    flP.set([x, gH(x, z) + 0.25, z], i * 3); const c = flCols[i % 5]; flC.set([c.r, c.g, c.b], i * 3); flS[i] = flr(); }
  const flG = new THREE.BufferGeometry(); flG.setAttribute('position', new THREE.BufferAttribute(flP, 3)); flG.setAttribute('col', new THREE.BufferAttribute(flC, 3)); flG.setAttribute('sd', new THREE.BufferAttribute(flS, 1));
  const flowerU = { time: { value: 0 }, wind: { value: 0.05 }, size: { value: 2.2 }, pxr: { value: 1 }, bright: { value: 0.8 }, fogD: { value: 0.0022 } };
  const flowers = add(gard, new THREE.Points(flG, new THREE.ShaderMaterial({ uniforms: flowerU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: glowMat.vertexShader, fragmentShader: glowMat.fragmentShader })));
  flowers.frustumCulled = false;
  const gardMotes = add(gard, lib.motes({ count: 1400, box: [260, 40, 500], center: [0, 15, -40], size: 9, color: '#ffe6b0', speed: 0.2, kind: 'rise', opacity: 0.5 }));

  // ================= UPDATE =================
  const nightTop = col('#03060f'), nightHor = col('#1c2c4c');
  return {
    scene, camera,
    update(t, S) {
      const P = S.post; P.vignette = 0.42; P.grain = 0.045; P.ca = 0.0015;
      const CUT = C.tree + 0.55; const inGarden = t >= CUT; // держим море, пока гаснет цитата
      isle.visible = !inGarden; gard.visible = inGarden;
      let dip = 1; [C.tears, CUT].forEach((c) => { dip = Math.min(dip, smooth(0, 0.35, Math.abs(t - c))); });

      if (!inGarden) {
        const storm = Math.min(ramp(t, C.new - 0.6, 1.2), 1 - ramp(t, C.new + 4.3, 2.4));      // буря
        const dawn = ramp(t, C.new + 4.0, 3.0);                                                 // рассвет нового мира
        const lt = t - C.new; fsU.lt.value = lt; fsU.op.value = storm;
        // небо
        const top = nightTop.clone().lerp(col('#06060c'), storm).lerp(col('#2a4270'), dawn);
        const hor = nightHor.clone().lerp(col('#20141c'), storm).lerp(col('#c88a64'), dawn);
        sky.u.top.value.copy(top); sky.u.horizon.value.copy(hor); sky.u.bottom.value.copy(hor).multiplyScalar(0.3);
        const sunY = lerp(-0.06, 0.035, ramp(t, C.new + 4.4, 5));
        sky.u.sunDir.value.set(-0.45, sunY, 1).normalize(); sky.u.sunGlow.value = dawn * 0.55; sky.u.sunColor.value.set('#ffd8a0');
        sky.u.starAmt.value = 1.0 * (1 - storm) * (1 - dawn); stars.u.opacity.value = 0.9 * (1 - storm * 0.8) * (1 - dawn);
        clouds.setOpacity(storm * 0.95); clouds.drift(t, 6, -2);
        moon.material.opacity = 0.5 * (1 - storm) * (1 - dawn); moonHalo.material.opacity = 0.16 * (1 - storm) * (1 - dawn);
        seals.forEach(([g, h], i) => { const k = ramp(t, C.new + 0.05 + i * 0.22, 0.35) * (1 - ramp(t, C.new + 4.4, 1.6)); const fl = 1 + 0.6 * Math.max(0, 1 - (t - C.new - i * 0.22) * 2.5);
          g.material.opacity = k * 0.95; g.scale.setScalar(55 * Math.min(fl, 1.6)); h.material.opacity = k * 0.25; });
        let bolt = 0; bolts.forEach(({ g, dt, d }) => { const a = lt - dt; const k = a > 0 && a < d ? (1 - a / d) * (0.6 + 0.4 * Math.sin(a * 90)) : 0; g.material.opacity = k * 0.6 * storm; bolt = Math.max(bolt, k); });
        babylon.material.opacity = Math.min(ramp(t, C.new + 2.1, 0.6), 1 - ramp(t, C.new + 3.6, 1.2)) * 0.45;
        sunDisc.position.copy(sky.u.sunDir.value).multiplyScalar(1000).add(camera.position); sunDisc.material.opacity = dawn * 0.22 * smooth(-0.03, 0.02, sunY); sunDisc.scale.setScalar(150);
        // море
        sea.position.set(Math.round(camera.position.x / 10) * 10, 0, Math.round(camera.position.z / 10) * 10);
        sea.u.skyc.value.copy(hor); sea.u.deep.value.set('#01040a').lerp(col('#0a2238'), dawn); sea.u.shallow.value.set('#04101a').lerp(col('#2a4a60'), dawn);
        if (dawn > 0.01) { sea.u.sunDir.value.copy(sky.u.sunDir.value); sea.u.sunColor.value.set('#ffcf98').multiplyScalar(dawn * 0.6); } else { sea.u.sunDir.value.copy(moon.position).sub(camera.position).normalize(); sea.u.sunColor.value.set('#9ab4e0').multiplyScalar(0.6 * (1 - storm)); }
        sea.u.amp.value = lerp(0.7, 1.1, storm) * (1 - dawn * 0.65); sea.u.foam.value = 0.15 + storm * 0.2;
        const fogC = hor.clone().multiplyScalar(0.5); scene.fog.color.copy(fogC); scene.fog.density = 0.0025; sea.u.fogColor.value.copy(fogC); sea.u.fogDensity.value = 0.0018;
        moonL.color.set('#9ab4e0').lerp(col('#ffd0a0'), dawn); moonL.position.set(lerp(-200, 400, dawn), lerp(160, 40, dawn), lerp(-500, 900, dawn)); moonL.intensity = 1.3 * (1 - storm * 0.6) + bolt * 2 + dawn * 0.6;
        hemiS.intensity = 0.35 + dawn * 0.3;
        mist.u.opacity.value = ramp(t, C.tears - 1, 2) * 0.5;
        P.flash = bolt * 0.12;
        // камера
        if (t < C.new) {
          camera.fov = 24; camera.updateProjectionMatrix();
          cameraPath(camera, [[0, CAM0, [FX + 2, FY - 6, FZ]], [C.new, [-36, 7, 165], [FX + 1, FY - 2, FZ]]], t);
          handheld(camera, t, 0.002);
        } else if (t < C.tears) {
          camera.fov = 38; camera.updateProjectionMatrix();
          cameraPath(camera, [[C.new, [FX + 3.6, FY + 2.6, FZ - 17], [FX + 30, FY + 125, FZ + 500]], [C.new + 4.3, [FX + 3.8, FY + 2.9, FZ - 15.5], [FX + 30, FY + 115, FZ + 500]], [C.tears, [FX + 4.2, FY + 3.6, FZ - 14], [FX + 30, FY + 30, FZ + 500]]], t);
          handheld(camera, t, 0.01 * (1 - dawn) + 0.003);
        } else {
          camera.fov = 38; camera.updateProjectionMatrix();
          const k = (t - C.tears) / (CUT - C.tears);
          camera.position.set(lerp(-20, -8, k), lerp(4, 6, k), lerp(130, 175, k)); camera.lookAt(lerp(40, 46, k), lerp(34, 38, k), 900);
          S.quote.y = 0.42;
        }
        P.exposure = lerp(1.0, 0.82, dawn); P.bloom = 0.6 + storm * 0.2; P.bloomThreshold = 0.6; P.bloomRadius = 0.7;
        P.tint = [lerp(1, 1.04, dawn), 1, lerp(1.04, 0.95, dawn)]; P.sat = lerp(0.9, 1.0, dawn);
        sky.position.copy(camera.position); stars.position.copy(camera.position);
      } else {
        const gk = ramp(t, C.garden, 4), fin = ramp(t, C.allnew - 0.5, 4);
        rU.bright.value = 0.6 + fin * 0.15;
        sky.u.top.value.set('#2e4a7a').lerp(col('#3a5280'), fin); sky.u.horizon.value.set('#e8a868').lerp(col('#f0b878'), fin); sky.u.bottom.value.set('#4a3420');
        sky.u.sunDir.value.set(0.25, 0.1, -1).normalize(); sky.u.sunGlow.value = 0.45 + fin * 0.25; sky.u.starAmt.value = 0; stars.u.opacity.value = 0;
        scene.fog.color.set('#b88a58').lerp(col('#c89a62'), fin); scene.fog.density = 0.0013 - gk * 0.0004;
        massU.fogC.value.copy(scene.fog.color); massU.fogD.value = scene.fog.density; glowU.fogD.value = flowerU.fogD.value = scene.fog.density;
        glowU.bright.value = 1.0 + fin * 0.3;
        fruitGlows.forEach((g, i) => { g.material.opacity = 0.5 * (0.85 + 0.15 * Math.sin(t * 1.5 + i)); });
        cityHalo.material.opacity = 0.18 + fin * 0.1; gateGlows.forEach((g) => (g.material.opacity = 0.5));
        sunG.intensity = 2.0 + fin * 0.3; hemiG.intensity = 0.6 + fin * 0.15;
        const g0 = GX;
        cameraPath(camera, [
          [C.tree, [g0 + TX + 34, 4.0, TZ + 50], [g0 + TX - 14, 16, TZ - 150]],
          [C.garden, [g0 + TX + 29, 5.5, TZ + 38], [g0 + TX - 10, 16, TZ - 150]],
          [C.allnew, [g0 + TX + 64, 26, TZ + 150], [g0 + 0, 16, -260]],
          [S.dur, [g0 + TX + 74, 34, TZ + 190], [g0 + 0, 22, -280]],
        ], t);
        handheld(camera, t, 0.003);
        P.exposure = 0.88 - fin * 0.05; P.contrast = 1.08; P.bloom = 0.6 + fin * 0.15; P.bloomThreshold = 0.7; P.bloomRadius = 0.75; P.tint = [1.03, 1, 0.94]; P.sat = 1.05;
        S.quote.y = 0.46;
        sky.position.copy(camera.position); stars.position.copy(camera.position);
      }
      P.exposure *= lerp(0.15, 1, dip);
      if (inGarden) P.exposure *= lerp(0.4, 1, ramp(t, CUT, 0.7)); // цитата про слёзы ещё гаснет поверх нового кадра
      S.fadeOut = 2.2;
    },
  };
}
