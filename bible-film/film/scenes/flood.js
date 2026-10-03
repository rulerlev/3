// Потоп: Каин и Авель (багровое небо) → буря, ковчег на волнах, молнии → радуга над ковчегом на горе →
// Вавилонская башня на закате, рассыпающаяся на светящиеся частицы (смешение языков).
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, rng, fbm, cameraPath, handheld } = lib;
  const C = meta.cues;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#3a1008', 0.01);
  const col = (c) => new THREE.Color(c);
  function look(keys, t) {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, a] = keys[i], [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
    const k = t1 > t0 ? lib.smooth(0, 1, (t - t0) / (t1 - t0)) : 0; const o = {};
    for (const n in a) o[n] = typeof a[n] === 'number' ? lerp(a[n], b[n], k) : col(a[n]).lerp(col(b[n]), k);
    return o;
  }
  const T_CRACK = 32.5; // «смешивает» ≈ 32.8

  // ---------- общее ----------
  const sky = lib.skyDome({ top: '#1a0606', horizon: '#a02a10', bottom: '#200806', sunDir: [0.3, 0.02, -1], sunColor: '#ff6a30', sunSize: 0.04, sunGlow: 0.6 });
  scene.add(sky);
  const sun = new THREE.DirectionalLight('#ff8a5a', 1.0); sun.position.set(60, 40, -100); scene.add(sun);
  const hemi = new THREE.HemisphereLight('#a05040', '#100604', 0.4); scene.add(hemi);
  const clouds = lib.cloudLayer({ count: 24, area: [700, 500], y: 70, scale: [180, 70], seed: 4, color: '#5a1a10', opacity: 0.75, center: [0, -200] });
  scene.add(clouds);
  const placeClouds = (ox, oy, oz, vx, vz, t, spread = 0) => clouds.children.forEach((sp) => { const b = sp.userData.base; const sg = Math.sign(b.x || 1); sp.position.set(b.x + t * vx + sg * spread, b.y, b.z + t * vz); clouds.position.set(ox, oy, oz); });

  // ================= A. Каин и Авель =================
  const gA = new THREE.Group(); scene.add(gA);
  const hA = (x, z) => { const h = fbm(x * 0.03, z * 0.03, 5) * 3 + Math.max(0, -z - 60) * 0.08 + fbm(x * 0.2, z * 0.2, 2) * 0.3; return lerp(h, -0.4 + fbm(x * 0.2, z * 0.2, 2) * 0.2, lib.smooth(14, 4, Math.hypot(x - 0.5, z - 5))); };
  const landA = lib.terrain({
    size: 300, seg: 120, center: [0, -60],
    heightFn: (x, z) => hA(x, z),
    colorFn: (x, z, y, sl) => col('#2a1610').lerp(col('#4a2a1c'), clamp(fbm(x * 0.1, z * 0.1, 3) + 0.5)).lerp(col('#120806'), sl * 1.5),
  });
  gA.add(landA);
  const abel = lib.figure({ height: 1.8, robe: '#8a7a64', skin: '#8a5a3c', hood: false, seed: 2 });
  abel.rotation.x = -Math.PI / 2; abel.position.y = 0.3; abel.parts.arms[0].rotation.z = -1.2; const abelG = new THREE.Group(); abelG.add(abel); abelG.position.set(0.4, hA(0.4, 3.4), 3.4); abelG.rotation.y = -2.0; gA.add(abelG);
  const abelLight = new THREE.PointLight('#ff8a50', 4, 12, 1.5); abelLight.position.set(2.2, 2.2, 6.0); gA.add(abelLight);
  const cain = lib.figure({ height: 1.85, robe: '#241812', skin: '#5a3a28', hood: true, seed: 5 }); gA.add(cain);
  // жертвенник с дымом
  const stoneM = new THREE.MeshStandardMaterial({ color: '#4a3a30', roughness: 1 });
  const altar = new THREE.Group(); altar.position.set(4.2, hA(4.2, -0.5), -0.5); gA.add(altar);
  [[1.6, 0.5, 1.2, 0.25], [1.3, 0.45, 1.0, 0.7], [1.1, 0.4, 0.9, 1.12]].forEach(([w, h, d, y], i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneM); b.position.y = y; b.rotation.y = i * 0.2; altar.add(b); });
  const altFire = lib.fire({ count: 160, radius: 0.35, height: 1.4, size: 22, seed: 3 }); altFire.position.y = 1.3; altar.add(altFire);
  const smokeTex = lib.cloudTexture(31, 128); const smoke = [];
  for (let i = 0; i < 9; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: '#1a0c0a', transparent: true, opacity: 0.5, depthWrite: false })); altar.add(sp); smoke.push(sp); }
  const altLight = new THREE.PointLight('#ff7a30', 30, 30, 1.6); altLight.position.set(0, 2.2, 0.5); altar.add(altLight);
  const embersA = lib.motes({ count: 500, box: [40, 12, 40], center: [0, 4, -6], size: 3, color: '#ff7040', speed: 0.6, kind: 'embers', opacity: 0.8, seed: 12 }); gA.add(embersA);

  // ================= B/C. Океан, ковчег, гора =================
  const gS = new THREE.Group(); scene.add(gS);
  const sea = lib.ocean({ size: 700, seg: 230, deep: '#05121a', shallow: '#1a3a44', sky: '#3a4450', amp: 1.7, choppy: 1.3, foam: 0.5 });
  gS.add(sea);
  const WAV = [[1, 0.3, 38, 1.0, 6], [-0.4, 1, 21, 0.6, 4.6], [0.7, -0.6, 11, 0.32, 3.4], [-0.9, -0.2, 6, 0.18, 2.5], [0.2, 0.9, 3.1, 0.08, 1.8]].map(([dx, dz, wl, a, sp]) => { const l = Math.hypot(dx, dz); return [dx / l, dz / l, 2 * Math.PI / wl, a, sp]; });
  const waveY = (x, z, t, amp) => { let y = 0; for (const [dx, dz, k, a, sp] of WAV) y += amp * a * Math.sin(k * (dx * x + dz * z - sp * t)); return y; };

  // ковчег
  const plank = lib.canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#5a3c22'; g.fillRect(0, 0, w, h); const r = rng(3);
    for (let y = 0; y < h; y += 12) { g.fillStyle = `rgba(20,10,4,${0.5 + r() * 0.3})`; g.fillRect(0, y, w, 2); for (let x = r() * 80; x < w; x += 60 + r() * 90) g.fillRect(x, y, 2, 12); g.fillStyle = `rgba(120,80,40,${r() * 0.25})`; g.fillRect(0, y + 2, w, 9); }
  });
  plank.wrapS = plank.wrapT = THREE.RepeatWrapping; plank.repeat.set(4, 1);
  const woodM = new THREE.MeshStandardMaterial({ map: plank, color: '#c0a080', roughness: 0.9 });
  const ark = new THREE.Group(); gS.add(ark);
  const hullG = new THREE.BoxGeometry(32, 5, 7.5, 24, 4, 6); { const p = hullG.attributes.position;
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const e = Math.abs(x) / 16; const taper = 1 - Math.pow(e, 3) * 0.75; z *= taper * (y < 0 ? 0.75 + 0.25 * (y + 2.5) / 2.5 : 1); y += Math.pow(e, 2.5) * 2.2 * (y < 0 ? 1 : 0.6); p.setXYZ(i, x, y, z); }
    hullG.computeVertexNormals(); }
  const hull = new THREE.Mesh(hullG, woodM); hull.position.y = 1.2; ark.add(hull);
  const house = new THREE.Mesh(new THREE.BoxGeometry(19, 3.2, 5.6), woodM); house.position.y = 5.2; ark.add(house);
  const roofG = new THREE.CylinderGeometry(3.6, 3.6, 20, 3, 1); roofG.rotateZ(Math.PI / 2); roofG.rotateX(-Math.PI / 2); roofG.scale(1, 0.6, 1.0);
  const roof = new THREE.Mesh(roofG, new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.95 })); roof.position.y = 7.6; ark.add(roof);
  const winM = new THREE.MeshBasicMaterial({ color: '#ffb060' }); const wins = [];
  for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), winM); w.position.set(-7 + i * 3.5, 5.6, 2.82); ark.add(w); const g = lib.glow('#ffa040', 2.6, 0.5); g.position.copy(w.position).add(new THREE.Vector3(0, 0, 0.2)); ark.add(g); wins.push(g); }
  const arkLight = new THREE.PointLight('#ffa050', 0, 30, 2); arkLight.position.set(0, 6, 5); ark.add(arkLight);

  // дождь (своя копия lib.rain: в lib размер массива sd неверный)
  function makeRain({ count = 6000, box = [80, 40, 80], center = [0, 15, 0], seed = 5, speed = 28, color = '#9fb4c8', opacity = 0.35, slant = 0.25 } = {}) {
    const r = rng(seed), p = new Float32Array(count * 6), sd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { const x = (r() - .5) * box[0], y = (r() - .5) * box[1], z = (r() - .5) * box[2], s = r(); p.set([x, y, z, x, y, z], i * 6); sd.set([s, 0, s, 1], i * 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 2));
    const u = { time: { value: 0 }, speed: { value: speed }, box: { value: new THREE.Vector3(...box) }, color: { value: new THREE.Color(color) }, opacity: { value: opacity }, slant: { value: slant } };
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec2 sd; uniform float time, speed, slant; uniform vec3 box; varying float vE;
        void main(){ vec3 q = position; float fall = time*speed*(.8+sd.x*.4); q.y = mod(q.y - fall + box.y*.5, box.y) - box.y*.5; q.x += q.y*slant;
          q.y += sd.y*1.6; q.x -= sd.y*1.6*slant; vE = sd.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(q,1.); }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; varying float vE; void main(){ gl_FragColor = vec4(color*opacity*(1.-vE*.7), 1.); }` });
    const ls = new THREE.LineSegments(g, m); ls.position.set(...center); ls.frustumCulled = false; return Object.assign(ls, { u });
  }
  const rainFx = makeRain({ count: 7000, box: [90, 50, 90], center: [0, 20, 20], speed: 34, color: '#a8b8c8', opacity: 0.32, slant: 0.35 }); gS.add(rainFx);
  // молния
  const boltPts = []; { const r = rng(17); let x = 0, y = 110; while (y > 0) { boltPts.push(new THREE.Vector3(x, y, 0)); x += (r() - 0.5) * 14; y -= 6 + r() * 8; } boltPts.push(new THREE.Vector3(x, -2, 0)); }
  const bolt = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(boltPts, false, 'catmullrom', 0.1), 80, 0.45, 4), new THREE.MeshBasicMaterial({ color: '#e8f0ff' }));
  bolt.position.set(-70, 0, -240); gS.add(bolt);
  const boltGlow = lib.glow('#b0c8ff', 160, 0); boltGlow.position.set(-70, 70, -238); gS.add(boltGlow);
  const FLASH = [8.25, 8.55, 11.4, 13.25];

  // гора Арарат
  const peakH = (x, z) => { const d = Math.hypot(x * 0.8, z); return 34 * Math.exp(-d * d / 1800) + (fbm(x * 0.045, z * 0.045, 5) * 9 + Math.abs(fbm(x * 0.02 + 7, z * 0.02, 3)) * 10) * Math.exp(-d * d / 5000) - 6 + Math.exp(-Math.pow(d - 60, 2) / 900) * 8; };
  const mount = lib.terrain({
    size: 260, seg: 140, heightFn: peakH, center: [0, 0],
    colorFn: (x, z, y, sl) => col('#3a3428').lerp(col('#6a5a40'), clamp(y / 30)).lerp(col('#2a2a22'), sl * 1.4).lerp(col('#4a5a2a'), clamp((5 - y) / 6) * 0.5),
  });
  const mountG = new THREE.Group(); mountG.position.set(0, 0, -95); mountG.add(mount); gS.add(mountG);
  const ARK_REST = new THREE.Vector3(4, peakH(4, 6) + 0.6, -95 + 6);
  const sunBeams = []; const beamDir = new THREE.Vector3(-0.35, -0.8, 0.3).normalize();
  for (let i = 0; i < 5; i++) { const b = lib.lightBeam({ radiusTop: 3, radiusBottom: 14 + i * 3, length: 160, color: '#ffe0b0', opacity: 0 }); b.position.set(30 + i * 22, 110, -170 + i * 8); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), beamDir); gS.add(b); sunBeams.push(b); }
  // радуга
  const bowU = { opacity: { value: 0 } };
  const bow = new THREE.Mesh(new THREE.RingGeometry(200, 225, 96, 1, 0, Math.PI), new THREE.ShaderMaterial({
    uniforms: bowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float opacity; varying vec3 vP;
      vec3 spec(float x){ return clamp(vec3(abs(x*6.-3.)-1., 2.-abs(x*6.-2.), 2.-abs(x*6.-4.)), 0., 1.); }
      void main(){ float r = (length(vP.xy) - 200.)/25.; vec3 c = spec(1.-r)*vec3(1.,.9,1.);
        float a = smoothstep(0., .15, r)*smoothstep(1., .82, r); float h = smoothstep(-5., 60., vP.y);
        gl_FragColor = vec4(c*a*h*opacity, 1.); }`,
  }));
  bow.position.set(20, -75, -400); bow.lookAt(-15, -75, 30); gS.add(bow);
  const bow2 = new THREE.Mesh(bow.geometry, bow.material.clone()); bow2.material.uniforms = { opacity: { value: 0 } }; bow2.scale.setScalar(1.2); bow2.position.copy(bow.position); bow2.quaternion.copy(bow.quaternion); gS.add(bow2);
  const dove = new THREE.Group(); { const wm = new THREE.MeshBasicMaterial({ color: '#f4f0e8', side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), wm); body.scale.set(1, 0.7, 2); dove.add(body);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.6), wm); w.position.x = s * 0.7; w.rotation.x = -Math.PI / 2; w.name = 'w' + s; dove.add(w); } }
  gS.add(dove);

  // ================= D. Вавилонская башня =================
  const gB = new THREE.Group(); gB.position.set(0, 0, -500); scene.add(gB);
  const plain = lib.terrain({
    size: 900, seg: 110, center: [0, 0],
    heightFn: (x, z) => fbm(x * 0.008, z * 0.008, 4) * 8 * lib.smooth(60, 200, Math.hypot(x, z)) + fbm(x * 0.05, z * 0.05, 2) * 0.6,
    colorFn: (x, z, y, sl) => col('#7a5032').lerp(col('#a07040'), clamp(fbm(x * 0.03, z * 0.03, 3) + 0.5)).lerp(col('#4a3020'), sl),
  });
  gB.add(plain);
  const archTex = lib.canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#c89a68'; g.fillRect(0, 0, w, h); const r = rng(8);
    for (let y = 0; y < h; y += 8) for (let x = (y / 8 % 2) * 10; x < w; x += 20) { g.fillStyle = `rgba(${90 + r() * 40},${60 + r() * 30},${30 + r() * 20},0.25)`; g.fillRect(x, y, 19, 7); }
    for (let i = 0; i < 8; i++) { const x = i * 64 + 32; g.fillStyle = '#2a160c'; g.beginPath(); g.moveTo(x - 13, h - 18); g.lineTo(x - 13, 58); g.arc(x, 58, 13, Math.PI, 0); g.lineTo(x + 13, h - 18); g.fill(); }
    g.fillStyle = 'rgba(40,20,10,0.6)'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 10, w, 10);
  });
  archTex.wrapS = THREE.RepeatWrapping;
  const crackTex = lib.canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); const r = rng(77); g.strokeStyle = '#fff'; g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 50; y += (r() - 0.3) * 30; g.lineTo(x, y); } g.stroke(); }
  });
  crackTex.wrapS = THREE.RepeatWrapping;
  const tiers = []; const TN = 11; let ty = 0; const towerPts = [];
  for (let i = 0; i < TN; i++) {
    const r0 = 30 - i * 2.55, r1 = r0 - 1.4, h = 8.5;
    const m = new THREE.MeshStandardMaterial({ map: archTex.clone(), color: '#e0b890', roughness: 0.95, transparent: true, emissive: '#ffb050', emissiveMap: crackTex, emissiveIntensity: 0 });
    m.map.repeat.set(Math.round(r0 / 3), 1); m.map.needsUpdate = true;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 48, 1, true), m); cyl.position.y = ty + h / 2; gB.add(cyl);
    const cap = new THREE.Mesh(new THREE.RingGeometry(r1 - 2.6, r1 + 0.01, 48, 1), new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 1, transparent: true, side: THREE.DoubleSide }));
    cap.rotation.x = -Math.PI / 2; cap.position.y = ty + h; gB.add(cap);
    // спиральный пандус
    const hp = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2 + i * 0.7; const rr = lerp(r0, r1, k / 24) + 1.1; hp.push(new THREE.Vector3(Math.cos(a) * rr, ty + k / 24 * h + 0.6, Math.sin(a) * rr)); }
    const ramp_ = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 48, 1.0, 4), new THREE.MeshStandardMaterial({ color: '#a07a50', roughness: 1, transparent: true }));
    ramp_.scale.y = 1; gB.add(ramp_);
    tiers.push({ mats: [m, cap.material, ramp_.material], y0: ty, h, r0, r1 });
    ty += h;
  }
  const TOWER_H = ty;
  // частицы «языков»
  const PN = 9000; const pp = new Float32Array(PN * 3), pd = new Float32Array(PN * 3), pc = new Float32Array(PN * 3), ps = new Float32Array(PN * 2);
  { const r = rng(99); const pal = ['#ffd27a', '#7ae0ff', '#ff8aa8', '#b89aff', '#9aff9a', '#ffb070'].map(col);
    const gdir = pal.map((_, g) => { const a = g / 6 * Math.PI * 2 + 0.4; return new THREE.Vector3(Math.cos(a), 0.12 + (g % 2) * 0.25, Math.sin(a)).normalize(); });
    for (let i = 0; i < PN; i++) {
      const ti = Math.min(TN - 1, Math.floor(Math.pow(r(), 1.2) * TN)); const T = tiers[ti]; const a = r() * Math.PI * 2, v = r();
      const rr = lerp(T.r0, T.r1, v); const y = T.y0 + v * T.h; pp.set([Math.cos(a) * rr, y, Math.sin(a) * rr], i * 3);
      const g = Math.floor(r() * 6); const d = gdir[g].clone().multiplyScalar(0.8).add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.5)).add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.35));
      pd.set([d.x, d.y, d.z], i * 3); pc.set([pal[g].r, pal[g].g, pal[g].b], i * 3); ps.set([r(), 1 - y / (TN * 8.5)], i * 2);
    } }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('dir', new THREE.BufferAttribute(pd, 3)); pg.setAttribute('col', new THREE.BufferAttribute(pc, 3)); pg.setAttribute('sd', new THREE.BufferAttribute(ps, 2));
  const partU = { time: { value: 0 }, sc: { value: 0 }, pxr: { value: 1 }, op: { value: 0 } };
  const parts = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: partU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 dir; attribute vec3 col; attribute vec2 sd; uniform float time, sc, pxr; varying vec3 vC; varying float vA;
      void main(){ float s = clamp((sc - sd.y*1.2 - sd.x*.3)/3.2, 0., 1.); float e = s*s*(3.-2.*s);
        vec3 p = position + dir*(e*60. + s*8.) + vec3(sin(time*1.3+sd.x*40.), cos(time*1.1+sd.x*30.)*.6, sin(time*.9+sd.x*20.))*s*5.;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = min((4. + 4.*sd.x)*pxr*(160./max(-mv.z,1.)), 12.);
        vA = smoothstep(0., .04, s) * (1. - smoothstep(.75, 1., s)*.7); vC = col; }`,
    fragmentShader: `uniform float op; varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d); gl_FragColor = vec4(vC*a*a*vA*op*1.4, 1.); }`,
  }));
  parts.frustumCulled = false; gB.add(parts);
  const cloudsB = lib.cloudLayer({ count: 22, area: [240, 240], y: 86, scale: [110, 40], seed: 21, color: '#ffb890', opacity: 0.8, center: [0, 0] });
  gB.add(cloudsB);
  const people = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 1.7, 5), new THREE.MeshStandardMaterial({ color: '#2a1a12' }), 160);
  { const r = rng(4); const m4 = new THREE.Matrix4(); for (let i = 0; i < 160; i++) { const a = r() * Math.PI * 2, d = 34 + r() * 40; m4.makeTranslation(Math.cos(a) * d, 0.85, Math.sin(a) * d); people.setMatrixAt(i, m4); } }
  gB.add(people);
  const dustB = lib.motes({ count: 600, box: [140, 40, 140], center: [0, 15, 30], size: 5, color: '#ffc890', speed: 0.2, opacity: 0.5, seed: 33 }); gB.add(dustB);

  // ---------- образы ----------
  const LA = { top: '#140405', hor: '#b0301a', bot: '#1a0606', sunC: '#ff5a20', sunY: 0.015, glow: 0.7, fog: '#3a0e08', fogD: 0.012, sunI: 1.2, sunL: '#ff6a40', hemi: 0.35, cl: '#4a1410', clO: 0.85, exp: 1.0, sat: 1.0 };
  const LB = { top: '#0c1218', hor: '#34404c', bot: '#05080a', sunC: '#8090a0', sunY: 0.1, glow: 0.0, fog: '#222c36', fogD: 0.006, sunI: 0.9, sunL: '#90a0b8', hemi: 1.4, cl: '#1a2028', clO: 0.95, exp: 1.0, sat: 0.7 };
  const LC = { top: '#28508a', hor: '#f4b080', bot: '#2a3a44', sunC: '#ffe0b0', sunY: 0.13, glow: 0.8, fog: '#b09a88', fogD: 0.0018, sunI: 2.0, sunL: '#ffe0b8', hemi: 0.6, cl: '#8a8a94', clO: 0.7, exp: 0.95, sat: 1.0 };
  const LC2 = { ...LC, top: '#1e3e70', hor: '#e8a070', fog: '#a08a80', exp: 0.9 };
  const LD = { top: '#2a2440', hor: '#ff8a48', bot: '#3a2018', sunC: '#ffb060', sunY: 0.035, glow: 1.0, fog: '#c07858', fogD: 0.0022, sunI: 1.8, sunL: '#ffb070', hemi: 0.45, cl: '#ffb890', clO: 0.8, exp: 1.0, sat: 1.05 };
  const LD2 = { ...LD, top: '#1a1a34', hor: '#c85a40', sunY: 0.0, sunI: 1.2, exp: 0.95 };
  const looks = [[0, LA], [C.storm - 0.01, LA], [C.storm, LB], [C.rainbow - 0.01, LB], [C.rainbow, { ...LB, sat: 0.8 }], [C.rainbow + 2.5, LC], [C.rainbow + 9, LC2], [C.babel - 0.01, LC2], [C.babel, LD], [36, LD2]];

  return {
    scene, camera,
    update(t, S) {
      const Lk = look(looks, t);
      const shot = t < C.storm ? 0 : t < C.rainbow ? 1 : t < C.babel ? 2 : 3;
      gA.visible = shot === 0; gS.visible = shot === 1 || shot === 2; gB.visible = shot === 3;
      sky.u.top.value.copy(Lk.top); sky.u.horizon.value.copy(Lk.hor); sky.u.bottom.value.copy(Lk.bot);
      sky.u.sunColor.value.copy(Lk.sunC); sky.u.sunGlow.value = Lk.glow;
      scene.fog.color.copy(Lk.fog); scene.fog.density = Lk.fogD;
      sun.intensity = Lk.sunI; sun.color.copy(Lk.sunL); hemi.intensity = Lk.hemi;
      clouds.setColor(Lk.cl); clouds.setOpacity(Lk.clO);
      S.post.exposure = Lk.exp; S.post.sat = Lk.sat; S.post.bloom = 0.6; S.post.bloomThreshold = 0.8;

      if (shot === 0) {
        sky.u.sunDir.value.set(-0.2, Lk.sunY, -1).normalize(); sun.position.set(-40, 20, -100);
        placeClouds(0, -20, 0, 6, 1, t);
        const k = t / C.storm; cain.position.set(-2.5 - k * 2, 0, -9 - k * 7); cain.position.y = hA(cain.position.x, cain.position.z); cain.rotation.y = Math.PI + 0.25;
        lib.walkPose(cain, t * 0.8, 1);
        smoke.forEach((sp, i) => { const k = (t * 0.12 + i / smoke.length) % 1; sp.position.set(Math.sin(k * 5 + i) * 0.6 + k * 3, 1.8 + k * 16, -k * 2); sp.scale.setScalar(2 + k * 9); sp.material.opacity = 0.55 * Math.sin(k * Math.PI); });
        altLight.intensity = 30 * (0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3));
        S.post.contrast = 1.1; S.post.tint = [1.05, 0.95, 0.9];
        cameraPath(camera, [[0, [-2.5, 2.6, 11.5], [1.0, -0.4, -6]], [C.storm, [-2.1, 2.5, 10.8], [0.6, 0.0, -7]]], t);
        handheld(camera, t, 0.006);
      } else if (shot === 1) {
        // буря
        const st = t - C.storm;
        sea.u.amp.value = 1.8; sea.u.choppy.value = 1.35; sea.u.foam.value = 0.05;
        sea.u.deep.value.set('#04101a'); sea.u.shallow.value.set('#20404a'); sea.u.skyc.value.set('#5a6878'); sea.u.sunColor.value.set('#1a222a');
        sea.u.sunDir.value.set(0, 0.3, -1).normalize(); sea.u.fogColor.value.copy(Lk.fog); sea.u.fogDensity.value = 0.006;
        sky.u.sunDir.value.set(0, 0.3, -1).normalize();
        placeClouds(0, -30, 120, 14, 3, t);
        mountG.visible = false; bow.visible = bow2.visible = false; dove.visible = false; rainFx.visible = true; sunBeams.forEach((b) => (b.visible = false));
        const ax = st * 2.2 - 12, az = 0;
        const y = waveY(ax, az, t, 1.8), yF = waveY(ax + 12, az, t, 1.8), yB = waveY(ax - 12, az, t, 1.8), yL = waveY(ax, az - 3.5, t, 1.8), yR = waveY(ax, az + 3.5, t, 1.8);
        ark.position.set(ax, y * 0.8 - 1.3, az); ark.rotation.set(Math.atan2(yR - yL, 7) * 0.8, 0, Math.atan2(yF - yB, 24) * 0.9);
        wins.forEach((g, i) => (g.material.opacity = 0.55 + 0.1 * Math.sin(t * 3 + i)));
        arkLight.intensity = 6;
        // молнии
        let fl = 0; for (const f of FLASH) { const d = t - f; if (d > 0 && d < 0.35) fl = Math.max(fl, Math.exp(-d * 14) * (d < 0.08 ? 1 : 0.6)); }
        S.post.flash = fl * 0.28; bolt.visible = fl > 0.15; boltGlow.material.opacity = fl * 0.8;
        if (t < 10) bolt.position.set(150, 0, -200); else bolt.position.set(40, 0, -250); boltGlow.position.set(bolt.position.x, 70, bolt.position.z + 2);
        sky.u.top.value.lerp(col('#6a7a9a'), fl * 0.6); sky.u.horizon.value.lerp(col('#9aa8c0'), fl * 0.6); hemi.intensity += fl * 1.5;
        S.post.contrast = 1.08;
        rainFx.position.set(camera.position.x, 20, camera.position.z - 20);
        cameraPath(camera, [[C.storm, [ax - 34, 8, 44], [ax, 4, 0]], [C.rainbow, [ax - 8, 10, 52], [ax + 3, 4.5, 0]]], t);
        handheld(camera, t, 0.025);
      } else if (shot === 2) {
        // радуга и ковчег на горе
        const st = t - C.rainbow;
        sea.u.amp.value = lerp(0.9, 0.3, ramp(st, 0, 4)); sea.u.choppy.value = 1.0; sea.u.foam.value = lerp(0.12, 0.0, ramp(st, 0, 3));
        sea.u.deep.value.set('#0a2630'); sea.u.shallow.value.set('#2a5a62'); sea.u.skyc.value.copy(Lk.hor).multiplyScalar(0.8); sea.u.sunColor.value.set('#ffd8a0');
        sky.u.sunDir.value.set(0.55, Lk.sunY, -1).normalize(); sea.u.sunDir.value.copy(sky.u.sunDir.value); sun.position.set(110, 40, -200);
        sea.u.fogColor.value.copy(Lk.fog); sea.u.fogDensity.value = Lk.fogD;
        mountG.visible = true; rainFx.visible = false; bolt.visible = false; boltGlow.material.opacity = 0;
        mountG.position.y = lerp(-3, 0, ramp(st, 0, 8));
        ark.position.copy(ARK_REST); ark.position.y += mountG.position.y; ark.rotation.set(0.04, 0.5, -0.05); arkLight.intensity = 0;
        wins.forEach((g) => (g.material.opacity = 0.2));
        // облака расходятся
        placeClouds(0, 0, -60, 0, 0, t, st * 9);
        clouds.setOpacity(lerp(1, 0.55, ramp(st, 0, 6)));
        const sb = ramp(st, 0.5, 4); sunBeams.forEach((b, i) => { b.visible = true; b.u.opacity.value = sb * 0.07 * (0.8 + 0.2 * Math.sin(t * 0.5 + i)); });
        bow.visible = bow2.visible = true; const bo = ramp(st, 1.6, 3.5); bowU.opacity.value = bo * 0.42; bow2.material.uniforms.opacity.value = bo * 0.12;
        dove.visible = true; const dp = st * 0.35; dove.position.set(-30 + st * 3.2, 30 + Math.sin(dp * 3) * 2, -40 - st * 1.5); dove.rotation.y = Math.PI / 2 - 0.3;
        dove.children.forEach((c) => { if (c.name) c.rotation.z = (c.name === 'w1' ? 1 : -1) * Math.sin(t * 9) * 0.6; });
        S.post.flash = 0;
        if (t < 18.5) cameraPath(camera, [[C.rainbow, [6, 4, 70], [0, 18, -90]], [18.5, [4, 4.5, 58], [0, 19, -90]]], t);
        else cameraPath(camera, [[18.5, [-34, 6, 18], [6, 26, -110]], [C.babel, [-24, 9, 4], [4, 26, -110]]], t);
        handheld(camera, t, 0.004);
      } else {
        // Вавилон
        const st = t - C.babel;
        sky.u.sunDir.value.set(0.7, Lk.sunY, -1).normalize(); sun.position.set(300, 60, -900);
        placeClouds(0, 40, -500, 3, 0, t); clouds.setOpacity(0.35); clouds.setColor('#a06070');
        const crack = ramp(t, T_CRACK, 0.8); const sc = Math.max(0, t - T_CRACK - 0.5);
        tiers.forEach((T, i) => {
          const order = (TN - 1 - i) / (TN - 1); const fade = ramp(sc, order * 1.2 + 0.3, 1.0);
          T.mats[0].emissiveIntensity = crack * 2.2 * (1 - fade); T.mats.forEach((m) => { m.opacity = 1 - fade; m.visible = fade < 0.99; m.depthWrite = fade < 0.05; });
        });
        partU.sc.value = sc; partU.op.value = sc > 0 ? 1 : 0;
        cloudsB.drift(t, 2, 0);
        S.post.flash = 0; S.post.bloom = 0.7 + crack * 0.2; S.post.bloomThreshold = 0.75;
        cameraPath(camera, [[C.babel, [125, 5, -330], [0, 40, -500]], [T_CRACK, [112, 6, -345], [0, 48, -500]], [36, [130, 8, -320], [0, 52, -500]]], t);
        handheld(camera, t, 0.004);
      }
    },
  };
}
