// Пророки: золотая корона раскалывается надвое → пророки на ветреных холмах в грозу → свиток при лампе (Ис 53:5) →
// Иерусалим горит, пленников уводят → долина сухих костей → дух входит, кости встают светящимися людьми → рассвет, стены отстраивают.
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, ease, easeIn, easeOut, handheld, rng, fbm, noise2, win } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.05, 3000);
  scene.fog = new THREE.FogExp2('#05060a', 0.02);
  const C = meta.cues;
  const T_CLOSE = 12.2, T_TEMPLE = 31.0;

  const camPath = (keys, t, hf) => {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, p0, l0] = keys[i], [t1, p1, l1] = keys[Math.min(i + 1, keys.length - 1)]; const k = t1 > t0 ? ease((t - t0) / (t1 - t0)) : 1;
    const x = lerp(p0[0], p1[0], k), z = lerp(p0[2], p1[2], k);
    camera.position.set(x, lerp(p0[1], p1[1], k) + (hf ? hf(x, z) : 0), z); camera.lookAt(lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k), lerp(l0[2], l1[2], k));
  };
  const sky = lib.skyDome({ top: '#05070c', horizon: '#141018', bottom: '#050404', sunDir: [0.3, 0.3, -1], sunGlow: 0, stars: 0 });
  scene.add(sky);
  const hemi = new THREE.HemisphereLight('#8090b0', '#1a1410', 0.5); scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffd8a8', 1); scene.add(key); scene.add(key.target);
  const colA = new THREE.Color(), colB = new THREE.Color();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), eul = new THREE.Euler();
  const pplGeo = new THREE.LatheGeometry([[0, 0], [.34, 0], [.3, .5], [.22, 1.05], [.25, 1.3], [.12, 1.44], [.11, 1.52], [.12, 1.62], [.08, 1.72], [0, 1.76]].map(([x, y]) => new THREE.Vector2(x, y)), 8);
  const cloudTex = [lib.cloudTexture(61), lib.cloudTexture(62), lib.cloudTexture(63)];
  const gold = new THREE.MeshStandardMaterial({ color: '#e8b648', metalness: 0.3, roughness: 0.3, emissive: '#6a4208', emissiveIntensity: 0.7, side: THREE.DoubleSide });
  const glyphs = (g, x, y, w, seed, col, lw) => { // абстрактные «строки письма»
    const r = rng(seed); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; let cx = x;
    while (cx < x + w) { const n = 2 + Math.floor(r() * 5); for (let j = 0; j < n && cx < x + w; j++) { const h = lw * 3.2; g.beginPath(); const ty = r();
      if (ty < 0.4) { g.moveTo(cx, y - h); g.lineTo(cx, y + h); cx += lw * 2.2; } else if (ty < 0.7) { g.moveTo(cx, y - h); g.lineTo(cx + lw * 3, y - h); g.lineTo(cx + lw * 3, y + h); cx += lw * 4.5; } else { g.arc(cx + lw * 1.5, y, h * 0.7, 0.3, 5.2); cx += lw * 4.5; } g.stroke(); }
      cx += lw * 4; }
  };

  // ================= 1: корона раскалывается =================
  const g1 = new THREE.Group(); scene.add(g1);
  const slabMat = new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 0.95, flatShading: true });
  const slabs = [-1, 1].map((s) => { const geo = new THREE.BoxGeometry(1.3, 0.5, 1.7, 3, 2, 3); const p = geo.attributes.position; for (let v = 0; v < p.count; v++) p.setY(v, p.getY(v) + noise2(p.getX(v) * 3 + s * 7, p.getZ(v) * 3) * 0.03); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, slabMat); m.position.set(s * 0.65, 0.25, 0); g1.add(m); return m; });
  const floor1 = lib.terrain({ size: 40, seg: 40, heightFn: (x, z) => fbm(x * 0.3, z * 0.3, 3) * 0.15 - 0.02, color: '#1a1714' }); g1.add(floor1);
  const crownHalves = [0, 1].map((h) => {
    const g = new THREE.Group();
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.4, 0.26, 24, 1, true, Math.PI / 2 + h * Math.PI, Math.PI), gold); band.position.y = 0.13; g.add(band);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 24, Math.PI), gold); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 2 + h * Math.PI; rim.position.y = 0.01; g.add(rim);
    for (let i = 0; i < 4; i++) { const a = Math.PI / 2 + h * Math.PI + (i + 0.5) / 4 * Math.PI; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), gold); sp.position.set(Math.sin(a) * 0.41, 0.36, Math.cos(a) * 0.41); g.add(sp);
      const jw = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: '#a01a20', emissive: '#4a0508', roughness: 0.2 })); jw.position.set(Math.sin(a) * 0.43, 0.12, Math.cos(a) * 0.43); g.add(jw); }
    g.position.y = 0.5; g1.add(g); return g;
  });
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1.0), new THREE.MeshBasicMaterial({ color: '#ffb060', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide }));
  crack.rotation.y = Math.PI / 2; crack.position.set(0, 0.45, 0); crack.scale.set(1, 1, 1); g1.add(crack);
  const crackGlow = lib.glow('#ff9a40', 2.5, 0); crackGlow.position.set(0, 0.55, 0); g1.add(crackGlow);
  const beam1 = lib.lightBeam({ radiusTop: 0.3, radiusBottom: 2.2, length: 9, color: '#ffe0b0', opacity: 0.25 }); beam1.position.set(0, 9, 0); g1.add(beam1);
  const spot = new THREE.SpotLight('#ffe0b8', 40, 20, 0.45, 0.6, 1.5); spot.position.set(0.5, 8, 1.5); spot.target.position.set(0, 0.4, 0); g1.add(spot, spot.target);
  const dust1 = lib.motes({ count: 300, box: [4, 5, 4], center: [0, 2.5, 0], size: 1.2, color: '#ffe0b0', speed: 0.2, opacity: 0.6 }); g1.add(dust1);

  // ================= 2: пророки на холмах =================
  const g2 = new THREE.Group(); scene.add(g2);
  const PP = [[-11, -12], [4, -26], [17, -9]];
  const h2 = (x, z) => fbm(x * 0.02, z * 0.02, 4) * 8 + PP.reduce((s, [px, pz]) => s + 6 * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / 70), 0) - Math.max(0, z - 10) * 0.1;
  g2.add(lib.terrain({ size: 500, seg: 140, center: [0, -60], heightFn: h2, colorFn: (x, z, y, sl) => new THREE.Color('#3a3a2a').lerp(new THREE.Color('#2a241c'), clamp(sl * 2 + noise2(x * 0.08, z * 0.08) * 0.3)) }));
  const prophets = PP.map(([x, z], i) => {
    const f = lib.figure({ height: 1.8, robe: ['#3a2c22', '#2c2a30', '#3a3024'][i], skin: '#7a5236', seed: 300 + i, staff: i !== 1, belt: '#2a1a10' });
    f.position.set(x, h2(x, z) - 0.05, z); f.rotation.y = [0.5, 0.1, -0.6][i]; g2.add(f);
    const cloak = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.3, 2, 6), new THREE.MeshStandardMaterial({ color: '#2a1e18', roughness: 1, side: THREE.DoubleSide })); cloak.position.set(0, 0.75, -0.25); f.add(cloak); f.userData.cloak = cloak;
    const scroll = new THREE.Group(); const sm = new THREE.MeshStandardMaterial({ color: '#c8b088', roughness: 0.8 });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), new THREE.MeshStandardMaterial({ color: '#d8c098', roughness: 0.9, side: THREE.DoubleSide })); scroll.add(paper);
    [-1, 1].forEach((s) => { const rl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.46, 8), sm); rl.position.set(s * 0.17, 0, 0); scroll.add(rl); });
    scroll.rotation.x = 0; scroll.position.set(0, -0.72, 0.12); f.parts.arms[0].add(scroll); f.userData.scroll = scroll;
    f.parts.arms[0].rotation.set(-1.2, 0, -0.2);
    const rim = lib.glow('#d8e0ff', 5, 0); rim.position.set(x, h2(x, z) + 1.4, z - 1.5); g2.add(rim); f.userData.rim = rim;
    return f;
  });
  const storm = lib.cloudLayer({ count: 26, area: [700, 300], y: 70, scale: [220, 90], seed: 71, color: '#3a3c48', opacity: 0.95, center: [0, -200] }); g2.add(storm);
  const storm2 = lib.cloudLayer({ count: 16, area: [600, 200], y: 40, scale: [160, 50], seed: 72, color: '#2a2a34', opacity: 0.8, center: [0, -160] }); g2.add(storm2);
  // ветер: летящие горизонтальные штрихи (свой вариант lib.rain — у того переполнение буфера sd при count > 1)
  const wind = (() => { const n = 1400, r = rng(5), p = new Float32Array(n * 6), sd = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { const x = (r() - .5) * 90, y = r() * 24, z = (r() - .5) * 90, q = r(); p.set([x, y, z, x, y, z], i * 6); sd.set([q, 0, q, 1], i * 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 2));
    const m = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec2 sd; uniform float time; varying float vE; void main(){ vec3 q = position; q.x = mod(q.x + time*(18.+sd.x*14.) + 45., 90.) - 45.; q.x -= sd.y*(1.5+sd.x*2.); q.y += sin(time*2.+sd.x*30.)*.3; vE = sd.y;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(q,1.); }`,
      fragmentShader: `varying float vE; void main(){ gl_FragColor = vec4(vec3(.72,.7,.64)*.13*(1.-vE), 1.); }` });
    const ls = new THREE.LineSegments(g, m); ls.position.set(0, h2(0, -15) - 2, -15); ls.frustumCulled = false; return ls; })(); g2.add(wind);
  const windDust = lib.motes({ count: 500, box: [80, 12, 60], center: [0, 4, -10], size: 3, color: '#c8b8a0', speed: 1.4, opacity: 0.3 }); g2.add(windDust);
  const hopeBeam = lib.lightBeam({ radiusTop: 6, radiusBottom: 40, length: 160, color: '#ffe0a8', opacity: 0 }); hopeBeam.position.set(-60, 150, -260); hopeBeam.rotation.z = -0.15; g2.add(hopeBeam);

  // ================= 3: свиток при лампе =================
  const g3 = new THREE.Group(); scene.add(g3);
  const parchTex = lib.canvasTexture(1024, 384, (g, w, h) => {
    const img = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = fbm(x * 0.01, y * 0.02, 4) * 0.5 + 0.5; const i = (y * w + x) * 4; img.data[i] = 200 * (0.75 + n * 0.3); img.data[i + 1] = 172 * (0.75 + n * 0.3); img.data[i + 2] = 120 * (0.75 + n * 0.3); img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    for (let col = 0; col < 3; col++) for (let l = 0; l < 9; l++) glyphs(g, 60 + col * 320, 50 + l * 33, 260, 500 + col * 20 + l, 'rgba(40,24,12,0.85)', 3.2);
  });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 2), new THREE.MeshStandardMaterial({ color: '#2a1e16', roughness: 0.9 })); desk.position.set(0, -0.15, 0); g3.add(desk);
  const parch = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.66, 30, 1), new THREE.MeshStandardMaterial({ map: parchTex, roughness: 0.9 }));
  { const p = parch.geometry.attributes.position; for (let v = 0; v < p.count; v++) p.setZ(v, Math.sin(p.getX(v) * 3) * 0.015); parch.geometry.computeVertexNormals(); }
  parch.rotation.x = -Math.PI / 2; parch.position.set(-0.1, 0.012, 0); g3.add(parch);
  [-1, 1].forEach((s) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 12), new THREE.MeshStandardMaterial({ color: '#b89a70', roughness: 0.8 })); r.rotation.x = Math.PI / 2; r.position.set(-0.1 + s * 0.95, 0.06, 0); g3.add(r);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), new THREE.MeshStandardMaterial({ color: '#4a3020' })); knob.rotation.x = Math.PI / 2; knob.position.copy(r.position); g3.add(knob); });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshStandardMaterial({ color: '#7a4a2a', roughness: 0.8 })); lamp.scale.set(1.4, 0.55, 1); lamp.position.set(1.25, 0.06, -0.25); g3.add(lamp);
  const flame = lib.fire({ count: 90, radius: 0.012, height: 0.16, size: 0.9, intensity: 0.9, seed: 41 }); flame.position.set(1.36, 0.12, -0.25); g3.add(flame);
  const flameGlow = lib.glow('#ffb060', 0.9, 0.5); flameGlow.position.set(1.36, 0.2, -0.25); g3.add(flameGlow);
  const lampLight = new THREE.PointLight('#ffa860', 0, 6, 1.6); lampLight.position.set(1.3, 0.35, -0.2); g3.add(lampLight);
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.004, 0.4, 5), new THREE.MeshStandardMaterial({ color: '#3a2a1a' })); pen.rotation.set(0.2, 0, 1.2); pen.position.set(0.55, 0.04, 0.22); g3.add(pen);
  const dust3 = lib.motes({ count: 200, box: [4, 2, 2], center: [0.5, 1, -0.5], size: 0.5, color: '#ffd0a0', speed: 0.12, opacity: 0.35 }); g3.add(dust3);
  const win3 = lib.glow('#5a70b0', 5, 0.12); win3.position.set(-1.8, 1.6, -3.5); g3.add(win3);

  // ================= 4: Иерусалим горит =================
  const g4 = new THREE.Group(); scene.add(g4);
  const h4 = (x, z) => 26 * Math.exp(-Math.pow(Math.hypot(x, z + 40) / 60, 2)) + fbm(x * 0.012, z * 0.012, 4) * 6;
  g4.add(lib.terrain({ size: 700, seg: 120, center: [0, -100], heightFn: h4, colorFn: (x, z, y) => new THREE.Color('#1c1410').multiplyScalar(0.8 + 0.4 * noise2(x * 0.05, z * 0.05)) }));
  const charMat = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 1, emissive: '#3a1404', emissiveIntensity: 0.6 });
  const NH = 260; const houses4 = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), charMat, NH);
  { const r = rng(9); let n = 0; while (n < NH) { const x = (r() - .5) * 150, z = -40 + (r() - .5) * 110; const d = Math.hypot(x, z + 40); if (d < 12 || d > 75) continue; const w = 3 + r() * 4;
    houses4.setMatrixAt(n, tmpM.compose(tmpP.set(x, h4(x, z) - 0.5, z), tmpQ.setFromEuler(eul.set(0, r() * 0.5, (r() < 0.15 ? 0.3 : 0))), tmpS.set(w, 2.5 + r() * 4 * (r() < 0.3 ? 0.5 : 1), w * (0.7 + r() * 0.5)))); houses4.setColorAt(n, new THREE.Color('#ffffff').multiplyScalar(0.5 + r() * 0.6)); n++; } }
  g4.add(houses4);
  const TY4 = h4(0, -40);
  const temple4 = new THREE.Group(); temple4.position.set(0, TY4, -40); g4.add(temple4);
  const tMat = new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.9, emissive: '#4a1a04', emissiveIntensity: 0.5 });
  const tBox = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tMat); b.position.set(x, y + h / 2, z); temple4.add(b); return b; };
  tBox(40, 3, 30, 0, -2.5, 0); const hall = tBox(9, 11, 22, 0, 0.5, -4); const porch = tBox(13, 16, 4, 0, 0.5, 9);
  const tPillars = [-4.5, 4.5].map((x) => { const pv = new THREE.Group(); pv.position.set(x, 0.5, 13); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 11, 12), tMat); c.position.y = 5.5; pv.add(c); temple4.add(pv); return pv; });
  const fires4 = []; { const r = rng(33); const spots = [[0, -40, 12, 1.6], [-3, -32, 9, 1.2], [4, -46, 9, 1.2]]; for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = 18 + r() * 45; spots.push([Math.cos(a) * d, -40 + Math.sin(a) * d * 0.8, 6 + r() * 6, 0.8 + r() * 0.5]); }
    spots.forEach(([x, z, hgt, k], i) => { const f = lib.fire({ count: 140, radius: 2.5 * k, height: hgt, size: 60 * k, intensity: 0.75, seed: 200 + i, color1: '#ffcf7a', color2: '#ff3a0a' }); const y = i < 3 ? TY4 + 3 : h4(x, z); f.position.set(x, y, z); g4.add(f);
      const gl = lib.glow('#ff6a20', 22 * k, 0.35); gl.position.set(x, y + hgt * 0.4, z); g4.add(gl); fires4.push({ f, gl, i }); }); }
  const fireLight = new THREE.PointLight('#ff6a2a', 0, 220, 1.2); fireLight.position.set(0, TY4 + 14, -30); g4.add(fireLight);
  const embers4 = lib.motes({ count: 1500, box: [160, 60, 120], center: [0, TY4 + 20, -40], size: 14, color: '#ff8a3a', speed: 0.9, kind: 'embers', opacity: 0.8 }); g4.add(embers4);
  const smoke4 = new THREE.Group(); g4.add(smoke4);
  { const r = rng(12); for (let i = 0; i < 26; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex[i % 3], color: '#3a2420', transparent: true, depthWrite: false, opacity: 0.75 })); const x = (r() - .5) * 120, z = -40 + (r() - .5) * 60; sp.userData = { x, z, y0: TY4 + 10 + r() * 20, s: 40 + r() * 40, ph: r() * 10 }; smoke4.add(sp); } }
  const NC = 34; const captives = new THREE.InstancedMesh(pplGeo, new THREE.MeshStandardMaterial({ color: '#0c0806', roughness: 1 }), NC); captives.frustumCulled = false; g4.add(captives);
  const spearG = new THREE.CylinderGeometry(0.025, 0.025, 3.2, 4); spearG.translate(0, 1.6, 0); const guards = new THREE.InstancedMesh(spearG, new THREE.MeshBasicMaterial({ color: '#080504' }), 6); guards.frustumCulled = false; g4.add(guards);
  const capD = []; { const r = rng(55); for (let i = 0; i < NC; i++) capD.push([i * 1.6 + r() * 1.4, (r() - .5) * 3.0, 0.8 + r() * 0.3, r()]); }
  const h4Line = (x) => h4(x, 50);

  // ================= 5/6: долина костей =================
  const g5 = new THREE.Group(); scene.add(g5);
  const h5 = (x, z) => 12 * lib.smooth(14, 60, Math.abs(x)) + fbm(x * 0.03, z * 0.03, 4) * 1.6 + 20 * lib.smooth(-60, -200, z);
  g5.add(lib.terrain({ size: 400, seg: 150, center: [0, -60], heightFn: h5, colorFn: (x, z, y, sl) => new THREE.Color('#6a6050').lerp(new THREE.Color('#3a342a'), clamp(sl * 2 + noise2(x * 0.1, z * 0.1) * 0.3)) }));
  const NF = 56, BPF = 13; const clusters = [];
  { const r = rng(77); for (let c = 0; c < NF; c++) { const x = (r() - .5) * 28, z = 8 - r() * 56; clusters.push({ x, z, y: h5(x, z), ry: r() * 6.28 }); } }
  clusters.sort((a, b) => a.x - b.x);
  const NBN = NF * BPF; const boneGeo = new THREE.CapsuleGeometry(0.035, 0.42, 3, 6);
  const boneMat = new THREE.MeshStandardMaterial({ color: '#e8e0cc', roughness: 0.6, emissive: '#000000' });
  const bones = new THREE.InstancedMesh(boneGeo, boneMat, NBN); bones.frustumCulled = false; g5.add(bones);
  const skulls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 10, 8), boneMat, NF); skulls.frustumCulled = false; g5.add(skulls);
  const boneD = []; { const r = rng(88); for (let c = 0; c < NF; c++) for (let b = 0; b < BPF; b++) { const cl = clusters[c];
    const sx = cl.x + (r() - .5) * 1.8, sz = cl.z + (r() - .5) * 1.8; const ang = r() * Math.PI; const len = 0.6 + r() * 0.9;
    const ay = 0.15 + (b / BPF) * 1.45; const ax = (b % 3 - 1) * 0.12, az = (r() - .5) * 0.06;
    boneD.push({ c, s: [sx, h5(sx, sz) + 0.03, sz], ry: ang, len, a: [cl.x + ax, cl.y + ay, cl.z + az], d: r() }); } }
  const glowFigMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const risen = new THREE.InstancedMesh(pplGeo, glowFigMat, NF); risen.frustumCulled = false; g5.add(risen);
  for (let c = 0; c < NF; c++) risen.setColorAt(c, new THREE.Color(0, 0, 0));
  const risenGlow = clusters.map((cl) => { const g = lib.glow('#ffe2a8', 2.2, 0); g.position.set(cl.x, cl.y + 1.0, cl.z); g5.add(g); return g; });
  const stars5 = lib.starfield({ count: 5000, radius: 1400, size: 2.4, minY: 0.05 }); g5.add(stars5);
  const valleyDust = lib.motes({ count: 500, box: [60, 6, 80], center: [0, 1.5, -25], size: 4, color: '#c8d0e0', speed: 0.3, opacity: 0.2 }); g5.add(valleyDust);
  // «ветер света»
  const waveU = { x: { value: -100 }, amt: { value: 0 } };
  const wave = new THREE.Mesh(new THREE.PlaneGeometry(140, 18), new THREE.ShaderMaterial({ uniforms: waveU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: lib.GLSL_NOISE + `uniform float x, amt, time; varying vec2 vUv; varying vec3 vW;
      void main(){ float d = vW.x - x; float band = exp(-d*d/18.) + .35*exp(-max(d,0.)*max(d,0.)/2.) * step(-60., d) * smoothstep(0., -40., d)*0.;
        float n = .6 + .4*fbm2(vec2(vW.x*.08 - time*.6, vW.y*.15 + vW.z*.05));
        float v = smoothstep(0., .25, vUv.y) * (1. - smoothstep(.45, 1., vUv.y));
        gl_FragColor = vec4(vec3(1., .88, .62)*band*n*v*amt*.55, 1.); }` }));
  wave.rotation.y = Math.PI / 2; wave.position.set(0, 4, -25); g5.add(wave);
  const waveMotes = lib.motes({ count: 900, box: [6, 4, 80], center: [0, 1.6, -22], size: 3.5, color: '#ffe0a8', speed: 1.2, kind: 'rise', opacity: 0 }); g5.add(waveMotes);
  const T_WAVE0 = 40.6, WAVE_V = 8.5; const waveX = (t) => -22 + (t - T_WAVE0) * WAVE_V;

  // ================= 7: возвращение, рассвет =================
  const g7 = new THREE.Group(); scene.add(g7);
  const h7 = (x, z) => 18 * Math.exp(-Math.pow(Math.hypot(x, z + 30) / 55, 2)) + fbm(x * 0.012, z * 0.012, 4) * 6;
  g7.add(lib.terrain({ size: 700, seg: 120, center: [0, -100], heightFn: h7, colorFn: (x, z, y, sl) => new THREE.Color('#8a7050').lerp(new THREE.Color('#6a6a40'), clamp(noise2(x * 0.03, z * 0.03) + 0.3)).multiplyScalar(0.8) }));
  const wallMat7 = new THREE.MeshStandardMaterial({ color: '#d8c4a0', roughness: 0.9 });
  const WR7 = 36, NW7 = 48, ROWS = 5; const wall7 = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), wallMat7, NW7 * ROWS); wall7.frustumCulled = false; g7.add(wall7);
  const wall7D = []; { const r = rng(14); for (let i = 0; i < NW7; i++) for (let j = 0; j < ROWS; j++) { const a = Math.PI * 0.08 + (i + 0.5) / NW7 * Math.PI * 1.84; const x = Math.cos(a) * WR7, z = -30 + Math.sin(a) * WR7 * 0.9; wall7D.push({ a, x, z, j, y: h7(x, z) - 0.6 + j * 1.5, tb: (j < 2 ? 40 : 45.8 + (j - 2) * 1.7) + (i / NW7) * 1.5 + r() * 0.15 }); wall7.setColorAt(i * ROWS + j, new THREE.Color('#d8c4a0').multiplyScalar(0.8 + r() * 0.25)); } }
  const TY7 = h7(0, -30);
  { const box = (w, h, d, x, y, z, m = wallMat7) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, TY7 + y + h / 2, z - 30); g7.add(b); return b; };
    box(30, 2, 22, 0, -1.5, 0); box(7, 8, 16, 0, 0.5, -2); box(10, 11, 3.5, 0, 0.5, 7.5);
    const pole = new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 1 });
    for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 13, 5), pole); p.position.set(-5.5 + (i % 3) * 5.5, TY7 + 6.5, -30 + 10 + (i < 3 ? 0 : -18)); g7.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 0.2), pole); beam.position.set(0, TY7 + 12, -20); g7.add(beam); }
  const NWK = 60; const workers = new THREE.InstancedMesh(pplGeo, new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 1 }), NWK); workers.frustumCulled = false; g7.add(workers);
  const carried = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), wallMat7, NWK); carried.frustumCulled = false; g7.add(carried);
  const wkD = []; { const r = rng(66); for (let i = 0; i < NWK; i++) { wkD.push([Math.PI * 0.15 + r() * Math.PI * 1.7, WR7 + 3 + r() * 6, r(), r() < 0.6]); workers.setColorAt(i, new THREE.Color().setHSL(0.06 + r() * 0.05, 0.3, 0.2 + r() * 0.2)); } }
  const birds = lib.motes({ count: 30, box: [120, 20, 60], center: [0, 40, -60], size: 3, color: '#2a2018', speed: 0.4, opacity: 0.0 }); g7.add(birds);
  const morningHaze = lib.cloudLayer({ count: 10, area: [600, 200], y: 30, scale: [220, 50], seed: 19, color: '#ffd8b8', opacity: 0.35, center: [0, -200] }); g7.add(morningHaze);

  return {
    scene, camera,
    update(t, S) {
      const shot = t < C.prophets ? 1 : t < C.isaiah ? 2 : t < C.fire ? 3 : t < C.bones ? 4 : t < C.return ? 5 : 7;
      g1.visible = shot === 1; g2.visible = shot === 2; g3.visible = shot === 3; g4.visible = shot === 4; g5.visible = shot === 5; g7.visible = shot === 7;
      S.post.bloomThreshold = 0.8; S.post.bloom = 0.55; S.post.exposure = 1.0; key.castShadow = false;
      if (shot === 1) {
        const split = ease(ramp(t, 1.7, 1.6)), crackK = ramp(t, 1.25, 0.5), tarnish = ramp(t, 3.3, 3.0);
        sky.u.top.value.set('#020203'); sky.u.horizon.value.set('#0a0706'); sky.u.bottom.value.set('#020202'); sky.u.sunGlow.value = 0; sky.u.starAmt.value = 0;
        scene.fog.color.set('#050403'); scene.fog.density = 0.06;
        hemi.color.set('#6a6070'); hemi.groundColor.set('#100c08'); hemi.intensity = 0.25; key.intensity = 0;
        crownHalves.forEach((g, i) => { const s = i ? 1 : -1; g.position.x = s * (0.02 + split * 0.42); g.rotation.z = -s * split * 0.16; g.position.y = 0.5 - split * 0.03; });
        slabs.forEach((m, i) => { const s = i ? 1 : -1; m.position.x = s * (0.65 + split * 0.14); m.rotation.z = -s * split * 0.05; });
        crack.material.opacity = crackK * (1 - ramp(t, 3.0, 1.5)) * 0.7; crack.scale.x = 1 + split * 2.5; crack.scale.y = 0.85 - split * 0.35;
        crackGlow.material.opacity = crackK * (1 - ramp(t, 3.2, 2)) * 0.6;
        gold.color.set('#e8b648').lerp(colA.set('#5a4a3a'), tarnish * 0.8); gold.emissiveIntensity = 0.7 * (1 - tarnish * 0.85);
        spot.intensity = 40 * (1 - tarnish * 0.6); beam1.u.opacity.value = 0.25 * (1 - tarnish * 0.7);
        S.post.flash = ramp(t, 1.2, 0.05) * (1 - ramp(t, 1.3, 0.5)) * 0.15;
        camPath([[0, [0.4, 0.95, 2.7], [0, 0.6, 0]], [1.7, [0.2, 0.85, 2.3], [0, 0.6, 0]], [3.4, [-0.3, 1.0, 2.6], [0, 0.55, 0]], [C.prophets, [-1.6, 2.6, 4.6], [0, 0.4, 0]]], t);
        handheld(camera, t, 0.003 + ramp(t, 1.25, 0.1) * (1 - ramp(t, 1.5, 1)) * 0.02);
      } else if (shot === 2) {
        const names = [9.17, 10.07, 11.17];
        let fl = 0; names.forEach((nt) => { const d = t - nt; if (d >= 0 && d < 0.6) fl = Math.max(fl, Math.exp(-d * 7) * (0.7 + 0.3 * Math.sin(d * 70))); });
        const hope = ramp(t, 15.4, 2.0);
        sky.u.top.value.set('#141822').lerp(colA.set('#7a8aa8'), fl * 0.5); sky.u.horizon.value.set('#4a4848').lerp(colA.set('#a08a70'), hope * 0.5).lerp(colB.set('#a0a8c0'), fl * 0.5); sky.u.bottom.value.set('#14120e');
        sky.u.sunDir.value.set(-0.25, 0.35, -1).normalize(); sky.u.sunColor.value.set('#ffe0b0'); sky.u.sunGlow.value = hope * 0.5; sky.u.sunSize.value = 0.0; sky.u.starAmt.value = 0;
        scene.fog.color.set('#2a2a2e').lerp(colA.set('#5a5048'), hope * 0.4); scene.fog.density = 0.006;
        hemi.color.set('#8a94b0'); hemi.groundColor.set('#1a160e'); hemi.intensity = 0.8 + fl * 2.5; key.color.set('#c0c8e0'); key.intensity = 0.8 + fl * 3; key.position.set(-50, 60, -80); key.target.position.set(0, 0, -15);
        storm.drift(t, 9, 0); storm2.drift(t, 14, 0); storm.setColor(colA.set('#3a3c48').lerp(colB.set('#a0a4b8'), fl * 0.7));
        prophets.forEach((f, i) => { const nk = ramp(t, names[i] - 0.1, 0.4); f.userData.rim.material.opacity = (Math.max(0, t - names[i]) < 0.6 ? fl : 0) * 0.6 + nk * 0.12;
          const wv = Math.sin(t * 6 + i * 2) * 0.5 + Math.sin(t * 9.3 + i) * 0.3; f.userData.cloak.rotation.x = 0.5 + wv * 0.25; f.userData.cloak.rotation.y = wv * 0.2; f.parts.body.rotation.z = wv * 0.02;
          f.parts.arms[0].rotation.x = lerp(-1.2, -2.6, nk) + wv * 0.05; f.userData.scroll.rotation.x = lerp(0, 1.2, nk); });
        hopeBeam.u.opacity.value = hope * 0.35;
        S.post.flash = fl * 0.08; S.post.exposure = 1.0; S.post.sat = 0.85; S.post.bloom = 0.5;
        if (t < T_CLOSE) camPath([[C.prophets, [0, 1.7, 23], [3, 5, -14]], [T_CLOSE, [3, 1.6, 18], [4, 5.5, -15]]], t, h2);
        else { const [px, pz] = PP[1]; camPath([[T_CLOSE, [px - 4.5, 0.9, pz + 7.5], [px, h2(px, pz) + 2.4, pz]], [C.isaiah, [px - 2.8, 0.7, pz + 5.0], [px - 0.5, h2(px, pz) + 2.8, pz - 3]]], t, h2); }
        handheld(camera, t, 0.006);
      } else if (shot === 3) {
        sky.u.top.value.set('#020306'); sky.u.horizon.value.set('#06080e'); sky.u.bottom.value.set('#020202'); sky.u.sunGlow.value = 0; sky.u.starAmt.value = 0;
        scene.fog.color.set('#04050a'); scene.fog.density = 0.12;
        hemi.color.set('#40507a'); hemi.groundColor.set('#0a0806'); hemi.intensity = 0.35; key.intensity = 0;
        lampLight.intensity = 3.0 * (0.9 + 0.1 * Math.sin(t * 13) * Math.sin(t * 7.7)); flameGlow.material.opacity = 0.4 + 0.06 * Math.sin(t * 11);
        S.post.exposure = 0.95; S.post.bloom = 0.6; S.post.bloomThreshold = 0.7; S.quote.y = 0.42;
        camPath([[C.isaiah, [-0.9, 1.15, 1.75], [-0.25, 0.42, -0.6]], [C.fire, [0.2, 1.05, 1.6], [0.35, 0.4, -0.6]]], t);
        handheld(camera, t, 0.002);
      } else if (shot === 4) {
        sky.u.top.value.set('#0a0406'); sky.u.horizon.value.set('#5a1a0c'); sky.u.bottom.value.set('#140604'); sky.u.sunGlow.value = 0; sky.u.starAmt.value = 0;
        scene.fog.color.set('#2a0e08'); scene.fog.density = 0.006;
        hemi.color.set('#8a3a20'); hemi.groundColor.set('#0a0404'); hemi.intensity = 0.5; key.intensity = 0;
        fireLight.intensity = 2500 * (0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3));
        fires4.forEach(({ gl, i }) => { gl.material.opacity = 0.3 + 0.08 * Math.sin(t * (5 + i) + i); });
        smoke4.children.forEach((sp) => { const d = sp.userData; const k = ((t * 0.08 + d.ph) % 1); sp.position.set(d.x + k * 25, d.y0 + k * 40, d.z); const s = d.s * (0.6 + k); sp.scale.set(s, s * 0.7, 1); sp.material.opacity = 0.7 * Math.sin(k * Math.PI); sp.material.color.set('#3a2420').lerp(colA.set('#8a3a18'), (1 - k) * 0.5); });
        // пленники уходят влево
        for (let i = 0; i < NC; i++) { const [o, zo, s, ph] = capD[i]; const x = 34 - o * 1.0 - (t - C.fire) * 1.3, z = 50 + zo; const y = h4Line(x) - 0.05 + Math.abs(Math.sin(t * 3.4 + ph * 9)) * 0.04;
          captives.setMatrixAt(i, tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(eul.set(0.18, -Math.PI / 2, Math.sin(t * 3.4 + ph * 9) * 0.03)), tmpS.setScalar(s))); }
        captives.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < 6; i++) { const o = capD[i * 6][0] + 0.7; const x = 34 - o - (t - C.fire) * 1.3 + 0.4, z = 48.6; guards.setMatrixAt(i, tmpM.compose(tmpP.set(x, h4Line(x) + 0.6, z), tmpQ.setFromEuler(eul.set(0, 0, 0.12)), tmpS.setScalar(1))); }
        guards.instanceMatrix.needsUpdate = true;
        // храм рушится
        const col = easeIn(clamp((t - 32.4) / 1.4));
        tPillars.forEach((p, i) => { p.rotation.z = (i ? -1 : 1) * col * 1.4; p.rotation.x = col * 0.3; });
        porch.rotation.x = col * 0.25; porch.position.y = 0.5 + 8 - col * 5; hall.position.y = 0.5 + 5.5 - col * 3; hall.rotation.z = col * 0.08;
        S.post.exposure = 1.0; S.post.bloom = 0.8; S.post.bloomThreshold = 0.65; S.post.sat = 1.1;
        if (t < T_TEMPLE) camPath([[C.fire, [4, 0.9, 72], [0, TY4 - 2, -30]], [T_TEMPLE, [-1, 1.0, 69], [-2, TY4 - 1, -30]]], t, h4);
        else camPath([[T_TEMPLE, [16, TY4 + 4, 18], [0, TY4 + 7, -32]], [C.bones, [12, TY4 + 3, 12], [0, TY4 + 5, -34]]], t);
        const shake = ramp(t, 33.4, 0.1) * (1 - ramp(t, 33.6, 1));
        handheld(camera, t * (1 + shake * 6), 0.004 + shake * 0.02);
      } else if (shot === 5) {
        const alive = t >= C.alive;
        sky.u.top.value.set('#03060e'); sky.u.horizon.value.set('#1a2236'); sky.u.bottom.value.set('#06070a'); sky.u.sunDir.value.set(0.35, 0.32, -1).normalize(); sky.u.sunColor.value.set('#dfe8ff'); sky.u.sunSize.value = 0.02; sky.u.sunGlow.value = 0.25; sky.u.starAmt.value = 0.9;
        scene.fog.color.set('#0e1420'); scene.fog.density = 0.012;
        hemi.color.set('#6a80b0'); hemi.groundColor.set('#0a0a0c'); hemi.intensity = 1.0; key.color.set('#b8c8f0'); key.intensity = 1.6; key.position.set(30, 40, -90); key.target.position.set(0, 0, -20);
        const wx = waveX(t); waveU.x.value = wx; waveU.amt.value = alive ? ramp(t, T_WAVE0 - 0.4, 0.6) * (1 - ramp(t, 44.6, 0.6)) : 0;
        waveMotes.position.x = wx; waveMotes.u.opacity.value = waveU.amt.value * 0.7;
        let riseSum = 0;
        for (let i = 0; i < NBN; i++) {
          const b = boneD[i]; const cl = clusters[b.c]; const tr = T_WAVE0 + (cl.x + 22) / WAVE_V; const k = alive ? ease(clamp((t - tr - b.d * 0.3) / 1.5)) : 0;
          tmpP.set(lerp(b.s[0], b.a[0], k), lerp(b.s[1], b.a[1], k) + Math.sin(k * Math.PI) * (0.8 + b.d), lerp(b.s[2], b.a[2], k));
          tmpQ.setFromEuler(eul.set(Math.PI / 2, b.ry, 0)); tmpQ2.setFromEuler(eul.set(0, cl.ry, 0)); tmpQ.slerp(tmpQ2, k);
          const vanish = alive ? 1 - ramp(t, tr + 1.4, 0.8) : 1; tmpS.set(1, b.len * (1 - k * 0.4), 1).multiplyScalar(Math.max(0.001, vanish));
          bones.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
        }
        bones.instanceMatrix.needsUpdate = true;
        for (let c = 0; c < NF; c++) { const cl = clusters[c]; const tr = T_WAVE0 + (cl.x + 22) / WAVE_V; const k = alive ? ease(clamp((t - tr) / 1.5)) : 0; const vanish = alive ? 1 - ramp(t, tr + 1.4, 0.8) : 1;
          skulls.setMatrixAt(c, tmpM.compose(tmpP.set(lerp(cl.x + 0.5, cl.x, k), lerp(cl.y + 0.08, cl.y + 1.62, k) + Math.sin(k * Math.PI) * 0.8, cl.z), tmpQ.identity(), tmpS.set(1, 1.15, 1.1).multiplyScalar(Math.max(0.001, vanish))));
          const fk = alive ? ramp(t, tr + 1.1, 1.0) : 0; riseSum += fk;
          risen.setMatrixAt(c, tmpM.compose(tmpP.set(cl.x, cl.y, cl.z), tmpQ.setFromEuler(eul.set(0, cl.ry, 0)), tmpS.set(1, 1, 1).multiplyScalar(0.98)));
          risen.setColorAt(c, colA.setRGB(1.0, 0.84, 0.6).multiplyScalar(fk * (0.8 + 0.1 * Math.sin(t * 2 + c))));
          risenGlow[c].material.opacity = fk * 0.25 + (alive ? Math.max(0, 1 - Math.abs(t - tr - 0.5)) * 0.35 : 0); }
        skulls.instanceMatrix.needsUpdate = true; risen.instanceMatrix.needsUpdate = true; risen.instanceColor.needsUpdate = true;
        boneMat.emissive.setRGB(0.25, 0.2, 0.12).multiplyScalar(waveU.amt.value * 0.6);
        valleyDust.u.opacity.value = 0.2 + waveU.amt.value * 0.2;
        S.post.exposure = 1.0; S.post.bloom = 0.7 + (riseSum / NF) * 0.2; S.post.bloomThreshold = 0.7; S.post.sat = 0.9;
        if (!alive) camPath([[C.bones, [-5, 0.6, 12], [1, 0.2, -6]], [C.alive, [2, 1.1, 8], [0, 0.4, -16]]], t, h5);
        else { S.quote.y = 0.36; camPath([[C.alive, [0, 6.5, 24], [0, 0.0, -26]], [C.return, [0, 5.4, 19], [0, 0.6, -26]]], t, h5); }
        handheld(camera, t, 0.003);
      } else {
        const sunUp = ramp(t, C.return, 5);
        sky.u.top.value.set('#4a5a80').lerp(colA.set('#6a88b0'), sunUp); sky.u.horizon.value.set('#ff9a6a').lerp(colA.set('#ffc890'), sunUp); sky.u.bottom.value.set('#6a4a40');
        sky.u.sunDir.value.set(0.7, lerp(0.0, 0.07, sunUp), -0.7).normalize(); sky.u.sunColor.value.set('#ffd8a0'); sky.u.sunSize.value = 0.03; sky.u.sunGlow.value = 0.9; sky.u.starAmt.value = 0;
        scene.fog.color.set('#e0a888').lerp(colA.set('#f0cca8'), sunUp); scene.fog.density = 0.0022;
        hemi.color.set('#a0b8e0'); hemi.groundColor.set('#5a4430'); hemi.intensity = 0.6; key.color.set('#ffd0a0'); key.intensity = 1.2 + sunUp * 1.2; key.position.set(250, lerp(25, 60, sunUp), -250); key.target.position.set(0, 0, -30);
        wall7D.forEach((w, i) => { const k = easeOut(clamp((t - w.tb) / 0.7)); const cx = Math.cos(w.a), cz = Math.sin(w.a);
          wall7.setMatrixAt(i, tmpM.compose(tmpP.set(w.x, w.y, w.z), tmpQ.setFromEuler(eul.set(0, -w.a + Math.PI / 2, 0)), tmpS.set(2 * Math.PI * WR7 / NW7 * 1.02, 1.55 * Math.max(0.001, k), 3.0))); void cx; void cz; });
        wall7.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < NWK; i++) { const [a0, rr, ph, carry] = wkD[i]; const a = a0 + Math.sin(t * 0.35 + ph * 6) * 0.06; const x = Math.cos(a) * rr, z = -30 + Math.sin(a) * rr * 0.9;
          const y = h7(x, z) - 0.05 + Math.abs(Math.sin(t * 4 + ph * 10)) * 0.04; const face = Math.cos(t * 0.35 + ph * 6) > 0 ? -a : -a + Math.PI;
          workers.setMatrixAt(i, tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(eul.set(carry ? 0.15 : 0, face, 0)), tmpS.setScalar(1)));
          carried.setMatrixAt(i, tmpM.compose(tmpP.set(x, carry ? y + 1.85 : -50, z), tmpQ, tmpS.setScalar(1))); }
        workers.instanceMatrix.needsUpdate = true; carried.instanceMatrix.needsUpdate = true;
        morningHaze.drift(t, 1.5, 0);
        S.post.exposure = lerp(0.85, 1.0, sunUp); S.post.bloom = 0.55; S.post.bloomThreshold = 0.82; S.post.sat = 1.0; S.fadeOut = 1.6;
        camPath([[C.return, [34, 9, 34], [0, TY7 + 1, -30]], [S.dur, [20, 14, 62], [0, TY7 + 3, -32]]], t, h7);
        handheld(camera, t, 0.003);
      }
      sky.position.copy(camera.position);
    },
  };
}
