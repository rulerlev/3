// Притчи: Учитель на склоне в золотой час → блудный сын: уходит из дома, огни города, свиньи в грязи, решает вернуться →
// дорога на закате: отец видит его издали и бежит (цитата) → объятие посреди дороги → дом в огнях, пир («пропадал и нашёлся»).
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, rng, fbm, noise2, cameraPath, handheld, smooth, easeOut } = lib;
  const C = meta.cues;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#c08860', 0.004);
  const col = (c) => new THREE.Color(c);
  const cA = new THREE.Color();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), eul = new THREE.Euler();
  const T_CITY = 8.75, T_PIGS = 10.65, T_RISE = 13.6, T_SEE = 20.4, T_RUN = 22.4, T_SIDE = 23.3;
  const ZS0 = -75, ZM = -55, ZH = -6; // сын в начале дороги, место встречи, отец у дома

  const sky = lib.skyDome({ top: '#2a4468', horizon: '#f0a060', bottom: '#4a3020', sunDir: [0, 0.06, -1], sunColor: '#ffd8a0', sunSize: 0.035, sunGlow: 1.0 });
  scene.add(sky);
  const hemi = new THREE.HemisphereLight('#9ab4d8', '#4a3424', 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffcf98', 2.0); scene.add(sun); scene.add(sun.target);
  const setSky = (top, hor, bot, dir, sc, size, gl, stars = 0) => {
    sky.u.top.value.set(top); sky.u.horizon.value.set(hor); sky.u.bottom.value.set(bot);
    sky.u.sunDir.value.set(...dir).normalize(); sky.u.sunColor.value.set(sc); sky.u.sunSize.value = size; sky.u.sunGlow.value = gl; sky.u.starAmt.value = stars;
  };
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const box = (parent, w, h, d, x, y, z, mat) => mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y + h / 2, z);
  const pplGeo = new THREE.LatheGeometry([[0, 0], [.34, 0], [.3, .5], [.22, 1.05], [.25, 1.3], [.12, 1.44], [.11, 1.52], [.12, 1.62], [.08, 1.72], [0, 1.76]].map(([x, y]) => new THREE.Vector2(x, y)), 7);
  const seatGeo = new THREE.LatheGeometry([[0, 0], [.42, 0], [.36, .25], [.24, .6], [.25, .78], [.12, .9], [.11, .98], [.12, 1.08], [.08, 1.18], [0, 1.22]].map(([x, y]) => new THREE.Vector2(x, y)), 7);
  const sitPose = (f, drop = 0.55) => { f.position.y -= drop; f.parts.arms[0].rotation.set(-0.6, 0, 0.3); f.parts.arms[1].rotation.set(-0.6, 0, -0.3); };

  // ================= A. Склон: Учитель и слушатели =================
  const gA = new THREE.Group(); scene.add(gA);
  const hA = (x, z) => Math.max(0, -z) * 0.14 + fbm(x * 0.02, z * 0.02, 4) * 2.5 + Math.max(0, z - 10) * -0.12;
  gA.add(lib.terrain({ size: 500, seg: 130, center: [0, -60], heightFn: hA, colorFn: (x, z, y) => col('#8a7a3a').lerp(col('#5a6a2a'), clamp(noise2(x * 0.05, z * 0.05) * 0.7 + 0.4)).multiplyScalar(0.85 + 0.15 * noise2(x * 0.4, z * 0.4)) }));
  const lake = lib.ocean({ size: 900, seg: 80, deep: '#2a3a48', shallow: '#4a5a60', sky: '#f0b070', amp: 0.08, choppy: 0.3, sunDir: [0.6, 0.08, 1], sunColor: '#ffc080' });
  lake.position.set(0, -4.5, 300); gA.add(lake);
  const rockA = mesh(new THREE.DodecahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: '#7a6a58', roughness: 1, flatShading: true }), gA, 0, hA(0, 0) + 0.2, 0); rockA.scale.set(1.1, 0.6, 0.9);
  const teacher = lib.figure({ height: 1.8, robe: '#efe6d6', skin: '#9a6a4a', hood: false, seed: 3, belt: '#c8b090' });
  teacher.position.set(0, hA(0, 0) + 0.75, 0); teacher.rotation.y = Math.PI; sitPose(teacher, 0.05); teacher.parts.arms[1].rotation.set(-1.0, 0, -0.4); gA.add(teacher);
  const NLA = 110; const listeners = new THREE.InstancedMesh(seatGeo, new THREE.MeshStandardMaterial({ color: '#6a5038', roughness: 1 }), NLA);
  { const r = rng(11); let n = 0; while (n < NLA) { const a = (r() - .5) * 2.4, d = 3.2 + Math.sqrt(r()) * 16; const x = Math.sin(a) * d, z = -Math.cos(a) * d; if (Math.abs(x) < 1.5 && d < 5) continue;
    listeners.setMatrixAt(n, tmpM.compose(tmpP.set(x, hA(x, z) - 0.05, z), tmpQ.setFromEuler(eul.set(0, Math.atan2(-x, -z), 0)), tmpS.setScalar(0.95 + r() * 0.15)));
    listeners.setColorAt(n, col(['#6a5038', '#8a6a48', '#4a3a30', '#7a4a3a', '#5a5a48'][n % 5]).multiplyScalar(0.7 + r() * 0.5)); n++; } }
  gA.add(listeners);
  const headsA = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.8 }), NLA);
  { const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); const r = rng(14);
    for (let i = 0; i < NLA; i++) { listeners.getMatrixAt(i, m); m.decompose(p, q, sc); headsA.setMatrixAt(i, tmpM.compose(tmpP.set(p.x, p.y + 1.12 * sc.y, p.z), q, tmpS.setScalar(sc.x))); headsA.setColorAt(i, col(r() < 0.5 ? '#8a5a3c' : ['#d8c8a8', '#6a4a3a', '#a08060'][i % 3]).multiplyScalar(0.8 + r() * 0.3)); } }
  gA.add(headsA);
  const NLS = 14; const standers = new THREE.InstancedMesh(pplGeo, listeners.material, NLS);
  { const r = rng(12); for (let i = 0; i < NLS; i++) { const a = (r() - .5) * 2.6, d = 16 + r() * 8; const x = Math.sin(a) * d, z = -Math.cos(a) * d; standers.setMatrixAt(i, tmpM.compose(tmpP.set(x, hA(x, z) - 0.05, z), tmpQ.setFromEuler(eul.set(0, Math.atan2(-x, -z), 0)), tmpS.setScalar(1))); standers.setColorAt(i, col('#5a4a38').multiplyScalar(0.7 + r() * 0.5)); } }
  gA.add(standers);
  const treesA = new THREE.Group(); gA.add(treesA);
  const olive = (parent, x, y, z, s, seed) => { const r = rng(seed); const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); parent.add(g);
    const bark = new THREE.MeshStandardMaterial({ color: '#4a3a2a', roughness: 1 }), lf = new THREE.MeshStandardMaterial({ color: '#5a6a3a', roughness: 1 });
    mesh(new THREE.CylinderGeometry(0.18, 0.32, 2.6, 7).translate(0, 1.3, 0), bark, g).rotation.z = (r() - .5) * 0.3;
    for (let i = 0; i < 7; i++) { const m = mesh(new THREE.IcosahedronGeometry(1, 2), lf, g, (r() - .5) * 3, 2.8 + r() * 1.2, (r() - .5) * 3); m.scale.set(1.2 + r() * 0.6, 0.7 + r() * 0.3, 1.2 + r() * 0.6); } return g; };
  [[-14, -8], [12, -20], [-22, -26], [24, -6], [-8, -34]].forEach(([x, z], i) => olive(treesA, x, hA(x, z) - 0.1, z, 1 + (i % 2) * 0.3, 21 + i));
  const motesA = lib.motes({ count: 500, box: [40, 10, 40], center: [0, 4, -8], size: 2.2, color: '#ffe0a0', speed: 0.2, opacity: 0.6, seed: 13 }); gA.add(motesA);

  // ================= F. Ферма и дорога =================
  const gF = new THREE.Group(); scene.add(gF);
  const roadX = (z) => Math.sin(z * 0.012) * 6 * smooth(-8, -40, z);
  const hF = (x, z) => { const base = fbm(x * 0.01, z * 0.01, 4) * 6 * smooth(10, 50, Math.hypot(x, z)) + Math.max(0, -z - 260) * 0.08; const rd = Math.abs(x - roadX(z)); return base * lerp(0.6, 1, smooth(2, 18, rd)) - (rd < 1.8 ? 0.06 : 0); };
  gF.add(lib.terrain({ size: 900, seg: 200, center: [0, -260], heightFn: hF, colorFn: (x, z, y) => { const rd = Math.abs(x - roadX(z)); const grass = col('#7a7a3a').lerp(col('#5a6a2e'), clamp(noise2(x * 0.03, z * 0.03) * 0.8 + 0.4)).lerp(col('#a08a50'), clamp(noise2(x * 0.01 + 5, z * 0.01) * 0.8));
    return grass.lerp(col('#a08060'), smooth(2.4, 1.2, rd) * (z < -2 ? 1 : 0)).multiplyScalar(0.85 + 0.15 * noise2(x * 0.5, z * 0.5)); } }));
  const stoneTex = lib.canvasTexture(256, 256, (g, w, h) => { const r = rng(33); g.fillStyle = '#6a5a48'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 21) for (let x = (y / 21) % 2 * 18 - 18; x < w; x += 36) { const c = 140 + r() * 50; g.fillStyle = `rgb(${c},${c * 0.86},${c * 0.68})`; g.fillRect(x + 2, y + 2, 32 + r() * 4, 17); } });
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping; stoneTex.repeat.set(3, 1.2);
  const stoneM = new THREE.MeshStandardMaterial({ map: stoneTex, color: '#b8a488', roughness: 0.95 }), roofM = new THREE.MeshStandardMaterial({ color: '#6a4030', roughness: 0.9 }), woodM = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.9 });
  const house = new THREE.Group(); house.position.set(0, hF(0, 2), 2); gF.add(house);
  box(house, 11, 4.2, 7, 0, -0.3, 0, stoneM);
  { const sh = new THREE.Shape(); sh.moveTo(-6.1, 0); sh.lineTo(0, 2.8); sh.lineTo(6.1, 0); sh.lineTo(-6.1, 0); const rg = new THREE.ExtrudeGeometry(sh, { depth: 7.8, bevelEnabled: false }); rg.translate(0, 0, -3.9); mesh(rg, roofM, house, 0, 3.9, 0); }
  box(house, 5, 3, 5, -9, -0.3, 1, stoneM); { const sh = new THREE.Shape(); sh.moveTo(-2.8, 0); sh.lineTo(2.8, 1.4); sh.lineTo(2.8, 0); const rg = new THREE.ExtrudeGeometry(sh, { depth: 5.6, bevelEnabled: false }); rg.translate(0, 0, -2.8); mesh(rg, roofM, house, -9, 2.7, 1); }
  const door = box(house, 1.4, 2.3, 0.1, 0.8, -0.3, -3.52, new THREE.MeshStandardMaterial({ color: '#ffb060', emissive: '#ff9a40', emissiveIntensity: 0.0, roughness: 1 }));
  const winMat = new THREE.MeshStandardMaterial({ color: '#2a1a10', emissive: '#ffa850', emissiveIntensity: 0, roughness: 1 });
  [[-3.2, 1.4, -3.52], [3.4, 1.4, -3.52], [-1.8, 1.4, -3.52], [-9, 1.0, -1.52], [-5.52, 1.4, 1.5], [5.52, 1.4, -1]].forEach(([x, y, z], i) => { const w = mesh(new THREE.PlaneGeometry(0.9, 0.9), winMat, house, x, y, z); w.rotation.y = i >= 4 ? (x > 0 ? Math.PI / 2 : -Math.PI / 2) : Math.PI; if (i === 3) w.position.z = -1.53; });
  const winGlows = [[-3.2, 1.4, -3.9], [3.4, 1.4, -3.9], [-1.8, 1.4, -3.9], [-9, 1.0, -1.9], [0.8, 0.9, -3.9]].map(([x, y, z]) => { const g = lib.glow('#ffa850', 2.6, 0); g.position.set(x, y, z); house.add(g); return g; });
  // ограда, деревья, колодец
  { const r = rng(31); const NP = 60; const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.07, 1.2, 5).translate(0, 0.6, 0), woodM, NP * 2);
    for (let i = 0; i < NP; i++) { const z = -4 - i * 2.4; [-1, 1].forEach((s, j) => { const x = roadX(z) + s * 2.6; posts.setMatrixAt(i * 2 + j, tmpM.compose(tmpP.set(x, hF(x, z) - 0.05, z), tmpQ.setFromEuler(eul.set((r() - .5) * 0.15, 0, (r() - .5) * 0.15)), tmpS.set(1, 0.8 + r() * 0.3, 1))); }); }
    gF.add(posts);
    [[-16, -10], [14, -14], [-24, 6], [20, 8], [-26, -40], [22, -70], [-30, -110], [26, -150], [-20, -26]].forEach(([x, z], i) => olive(gF, x, hF(x, z) - 0.1, z, 1.1 + (i % 3) * 0.25, 41 + i));
    const well = mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.9, 14), stoneM, gF, 6.5, hF(6.5, -7) + 0.45, -7); void well; }
  // отец и сын (дорога)
  const father = lib.figure({ height: 1.78, robe: '#5a5a6a', skin: '#9a6a4a', hood: true, hoodColor: '#7a7a8a', seed: 51, belt: '#3a2a20' }); gF.add(father);
  const son = lib.figure({ height: 1.72, robe: '#6a5040', skin: '#9a6a4a', hood: false, seed: 52, belt: '#3a2a1a' }); gF.add(son);
  const bag = new THREE.Group(); son.add(bag); mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: '#8a6a40', roughness: 1 }), bag, 0.05, 1.2, -0.28); mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4), woodM, bag, 0.12, 1.42, -0.1).rotation.x = 0.5;
  const sonTired = lib.figure({ height: 1.72, robe: '#3a3028', skin: '#8a5a3c', hood: false, seed: 53, belt: '#2a1a10' }); gF.add(sonTired);
  // праздник
  const feast = new THREE.Group(); gF.add(feast);
  { const r = rng(61); const tbl = box(feast, 9, 0.12, 1.3, -2, 0.85, -11, woodM); void tbl; box(feast, 9, 0.85, 0.1, -2, 0, -11, woodM);
    const NS = 22; const seated = new THREE.InstancedMesh(seatGeo, new THREE.MeshStandardMaterial({ color: '#6a5038', roughness: 1 }), NS);
    for (let i = 0; i < NS; i++) { const s = i % 2 ? 1 : -1; const x = -6.2 + Math.floor(i / 2) * 0.82, z = -11 + s * 1.05; seated.setMatrixAt(i, tmpM.compose(tmpP.set(x, hF(x, z) - 0.05, z), tmpQ.setFromEuler(eul.set(0, s > 0 ? Math.PI : 0, 0)), tmpS.setScalar(1 + r() * 0.1))); seated.setColorAt(i, col(['#7a3a2a', '#4a5a6a', '#8a7a5a', '#5a3a4a'][i % 4]).multiplyScalar(0.7 + r() * 0.5)); }
    feast.add(seated);
    const NC = 18; const cand = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffd090' }), NC); for (let i = 0; i < NC; i++) cand.setMatrixAt(i, tmpM.compose(tmpP.set(-6 + i * 0.47, 1.05, -11 + (i % 2 ? 0.25 : -0.25)), tmpQ.identity(), tmpS.setScalar(1))); feast.add(cand);
    for (let i = 0; i < 5; i++) { const g = lib.glow('#ffc070', 2.4, 0.5); g.position.set(-6 + i * 2, 1.3, -11); feast.add(g); } }
  const poles = [[-9, -6], [-9, -16], [5, -16], [5, -6], [-3, -19]]; poles.forEach(([x, z]) => box(feast, 0.12, 4.2, 0.12, x, hF(x, z) - 0.1, z, woodM));
  const lanterns = []; { const segs = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [4, 1], [4, 2]]; segs.forEach(([a, b]) => { const [x1, z1] = poles[a], [x2, z2] = poles[b]; for (let k = 1; k < 9; k++) { const u = k / 9; const g = lib.glow(k % 3 ? '#ffc070' : '#ff9a60', 1.5, 0.85); g.position.set(lerp(x1, x2, u), 4.0 - Math.sin(u * Math.PI) * 0.9, lerp(z1, z2, u)); feast.add(g); lanterns.push(g); } }); }
  const bonfire = lib.fire({ count: 400, radius: 0.7, height: 2.4, size: 26, seed: 71, intensity: 0.8 }); bonfire.position.set(6.5, hF(6.5, -12), -12); feast.add(bonfire);
  const bonGlow = lib.glow('#ff9040', 9, 0.45); bonGlow.position.set(6.5, hF(6.5, -12) + 1.2, -12); feast.add(bonGlow);
  const feastL = new THREE.PointLight('#ffa050', 0, 40, 1.4); feastL.position.set(0, 4, -12); feast.add(feastL);
  const dancers = []; { const cols = ['#8a2a2a', '#d8c8a8', '#3a4a7a', '#7a5a2a', '#5a2a4a', '#c8a060', '#2a5a4a']; for (let i = 0; i < 7; i++) { const f = lib.figure({ height: 1.6 + (i % 3) * 0.1, robe: cols[i], skin: '#9a6a4a', hood: i % 2 === 0, seed: 81 + i }); feast.add(f); dancers.push(f); } }
  const embersF = lib.motes({ count: 250, box: [4, 10, 4], center: [6.5, 5, -12], size: 2.5, color: '#ffa050', speed: 0.6, kind: 'embers', opacity: 0.9, seed: 72 }); feast.add(embersF);
  const starsF = lib.starfield({ count: 4000, radius: 1400, size: 2.2, minY: 0.05, seed: 73 }); gF.add(starsF);
  const motesF = lib.motes({ count: 600, box: [60, 12, 80], center: [0, 4, -40], size: 2.5, color: '#ffd8a0', speed: 0.2, opacity: 0.5, seed: 74 }); gF.add(motesF);
  const sunGlowF = lib.glow('#ffb070', 120, 0); gF.add(sunGlowF);

  // ================= C. Город ночью =================
  const gC = new THREE.Group(); scene.add(gC);
  mesh(new THREE.PlaneGeometry(60, 200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.6, metalness: 0.1 }), gC, 0, 0, -60);
  const NB = 40; const bld = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 0.95 }), NB);
  const winPts = []; { const r = rng(91); for (let i = 0; i < NB; i++) { const s = i % 2 ? 1 : -1; const z = 10 - Math.floor(i / 2) * 7.5; const w = 6 + r() * 3, h = 6 + r() * 9, x = s * (6 + w / 2 + r() * 0.5);
    bld.setMatrixAt(i, tmpM.compose(tmpP.set(x, 0, z), tmpQ.identity(), tmpS.set(w, h, 6.8))); bld.setColorAt(i, col('#6a4a34').multiplyScalar(0.6 + r() * 0.6));
    for (let k = 0; k < 6; k++) if (r() < 0.6) winPts.push(x - s * (w / 2 + 0.05), 1.5 + r() * (h - 2), z + (r() - .5) * 5.5); } }
  gC.add(bld);
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(winPts, 3)); gC.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffb050', size: 1.3, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, map: lib.radialTexture() }))); }
  const cityLan = []; { const r = rng(92); for (let i = 0; i < 70; i++) { const z = -1 - Math.floor(i / 12) * 5; const u = (i % 12) / 11; const g = lib.glow(i % 4 ? '#ffb060' : '#ff7050', 0.8, 0.9); g.position.set(lerp(-6, 6, u), 6.2 - Math.sin(u * Math.PI) * 1.4 + (r() - .5) * 0.2, z + (r() - .5) * 0.6); gC.add(g); cityLan.push(g); } }
  const NCR = 46; const crowd = new THREE.InstancedMesh(pplGeo, new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 1 }), NCR); const crowdD = [];
  { const r = rng(93); for (let i = 0; i < NCR; i++) { const x = (r() - .5) * 10, z = 2 - r() * 26; if (Math.hypot(x, z + 2) < 1.6) { i--; continue; } crowdD.push([x, z, r() * 6, 0.9 + r() * 0.2]); crowd.setColorAt(i, col(['#7a2a2a', '#4a3a6a', '#8a6a3a', '#2a4a4a', '#6a3a5a'][i % 5]).multiplyScalar(0.6 + r() * 0.6)); } }
  gC.add(crowd);
  const sonCity = lib.figure({ height: 1.72, robe: '#8a2a3a', skin: '#9a6a4a', hood: false, seed: 94, belt: '#e0b04a' }); sonCity.position.set(0, 0, -2); gC.add(sonCity);
  const cup = mesh(new THREE.CylinderGeometry(0.06, 0.03, 0.14, 8), new THREE.MeshStandardMaterial({ color: '#e0b04a', metalness: 0.6, roughness: 0.3 }), sonCity.parts.arms[1], 0, -0.7, 0); void cup;
  const cityL = new THREE.PointLight('#ff9a50', 60, 30, 1.4); cityL.position.set(1.5, 4, 0); gC.add(cityL);
  const coins = lib.motes({ count: 120, box: [3, 3, 3], center: [0, 1.5, -2], size: 2, color: '#ffd870', speed: 0.6, kind: 'snow', opacity: 0.9, seed: 95 }); gC.add(coins);

  // ================= P. Свиньи и грязь =================
  const gP = new THREE.Group(); scene.add(gP);
  const hP = (x, z) => fbm(x * 0.03, z * 0.03, 4) * 1.5 + Math.max(0, -z - 40) * 0.06;
  gP.add(lib.terrain({ size: 400, seg: 120, center: [0, -100], heightFn: hP, colorFn: (x, z) => col('#5a4430').lerp(col('#6a5434'), clamp(noise2(x * 0.1, z * 0.1) + 0.5)).lerp(col('#6a6a44'), smooth(14, 30, Math.hypot(x, z))), roughness: 0.85 }));
  const puddles = []; { const r = rng(101); for (let i = 0; i < 9; i++) { const p = mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4a4a4c', roughness: 0.45, metalness: 0.0 }), gP); const x = (r() - .5) * 18, z = 6 - r() * 16; p.position.set(x, hP(x, z) + 0.04, z); p.scale.set(1 + r() * 1.5, 1, 0.6 + r()); puddles.push(p); } }
  const pigM = new THREE.MeshStandardMaterial({ color: '#b08070', roughness: 0.8 }), pigDark = new THREE.MeshStandardMaterial({ color: '#5a3a2a', roughness: 1 });
  const sphG = new THREE.SphereGeometry(1, 14, 10);
  const pigs = []; for (let i = 0; i < 8; i++) { const r = rng(111 + i); const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
    const b = mesh(sphG, pigM, inner, 0, 0.5, 0); b.scale.set(0.62, 0.38, 0.4);
    const head = new THREE.Group(); head.position.set(0.58, 0.55, 0); inner.add(head); const hd = mesh(sphG, pigM, head, 0.08, 0, 0); hd.scale.set(0.24, 0.22, 0.22);
    const sn = mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 10), pigM, head, 0.32, -0.03, 0); sn.rotation.z = Math.PI / 2;
    [-1, 1].forEach((s) => { const e = mesh(new THREE.ConeGeometry(0.07, 0.14, 5), pigM, head, 0.05, 0.2, s * 0.12); e.rotation.set(s * 0.5, 0, -0.5); });
    const legs = [[0.35, 0.18], [0.35, -0.18], [-0.35, 0.18], [-0.35, -0.18]].map(([x, z]) => { const pv = new THREE.Group(); pv.position.set(x, 0.32, z); inner.add(pv); mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.3, 6).translate(0, -0.15, 0), pigM, pv); return pv; });
    const mudPatch = mesh(sphG, pigDark, inner, -0.2, 0.36, 0); mudPatch.scale.set(0.45, 0.2, 0.41);
    g.userData = { x: (r() - .5) * 13, z: 5 - r() * 11, a: r() * 6.28, sp: 0.2 + r() * 0.3, ph: r() * 6, legs, head };
    g.scale.setScalar(0.9 + r() * 0.3); gP.add(g); pigs.push(g); }
  const sonPig = lib.figure({ height: 1.72, robe: '#5a4838', skin: '#8a5a3c', hood: true, hoodColor: '#3a2e24', seed: 121, belt: '#2a1a10' }); gP.add(sonPig);
  const logP = mesh(new THREE.CylinderGeometry(0.22, 0.25, 2.4, 8), woodM, gP, 0, 0, 0); logP.rotation.z = Math.PI / 2;
  { const r = rng(131); const NP = 30; const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 1.3, 5).translate(0, 0.65, 0), woodM, NP); const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.08, 0.06), woodM, NP);
    for (let i = 0; i < NP; i++) { const a = i / NP * Math.PI * 2; const x = Math.cos(a) * 14, z = Math.sin(a) * 13; posts.setMatrixAt(i, tmpM.compose(tmpP.set(x, hP(x, z) - 0.1, z), tmpQ.setFromEuler(eul.set((r() - .5) * 0.2, 0, (r() - .5) * 0.2)), tmpS.setScalar(1)));
      const a2 = (i + 1) / NP * Math.PI * 2; const x2 = Math.cos(a2) * 14, z2 = Math.sin(a2) * 13; rails.setMatrixAt(i, tmpM.compose(tmpP.set((x + x2) / 2, hP(x, z) + 0.9, (z + z2) / 2), tmpQ.setFromEuler(eul.set(0, -Math.atan2(z2 - z, x2 - x), (r() - .5) * 0.15)), tmpS.set(Math.hypot(x2 - x, z2 - z), 1, 1))); }
    gP.add(posts, rails); }
  function makeRain({ count, box: bx, center, seed, speed, color, opacity, slant }) {
    const r = rng(seed), p = new Float32Array(count * 6), sd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { const x = (r() - .5) * bx[0], y = (r() - .5) * bx[1], z = (r() - .5) * bx[2], s = r(); p.set([x, y, z, x, y, z], i * 6); sd.set([s, 0, s, 1], i * 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 2));
    const u = { time: { value: 0 }, speed: { value: speed }, box: { value: new THREE.Vector3(...bx) }, color: { value: col(color) }, opacity: { value: opacity }, slant: { value: slant } };
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec2 sd; uniform float time, speed, slant; uniform vec3 box; varying float vE;
        void main(){ vec3 q = position; float fall = time*speed*(.8+sd.x*.4); q.y = mod(q.y - fall + box.y*.5, box.y) - box.y*.5; q.x += q.y*slant; q.y += sd.y*.8; q.x -= sd.y*.8*slant; vE = sd.y;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(q,1.); }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; varying float vE; void main(){ gl_FragColor = vec4(color*opacity*(1.-vE*.7), 1.); }` });
    const ls = new THREE.LineSegments(g, m); ls.position.set(...center); ls.frustumCulled = false; return Object.assign(ls, { u });
  }
  const drizzle = makeRain({ count: 3000, box: [40, 20, 40], center: [0, 8, -6], seed: 141, speed: 14, color: '#8a9098', opacity: 0.25, slant: 0.12 }); gP.add(drizzle);
  const cloudsP = lib.cloudLayer({ count: 16, area: [500, 300], y: 50, scale: [160, 60], seed: 142, color: '#5a5a60', opacity: 0.85, center: [0, -150] }); gP.add(cloudsP);
  const hopeBeam = lib.lightBeam({ radiusTop: 4, radiusBottom: 14, length: 90, color: '#ffd8a0', opacity: 0 }); hopeBeam.position.set(30, 70, -80); hopeBeam.rotation.z = -0.35; gP.add(hopeBeam);

  // позиции отца и сына на дороге (общие для кадров run/embrace)
  const sonZ = (t) => t < C.embrace ? lerp(ZS0, ZM - 0.4, clamp((t - C.run) / (C.embrace - C.run))) : ZM - 0.22;
  const fatherZ = (t) => { if (t < T_RUN) return ZH; if (t >= C.embrace) return ZM + 0.22; const k = clamp((t - T_RUN) / (C.embrace - T_RUN)); return lerp(ZH, ZM + 0.4, Math.pow(k, 1.35)); };
  const groups = [gA, gF, gC, gP];
  const show = (g) => groups.forEach((x) => (x.visible = x === g));

  return {
    scene, camera,
    update(t, S) {
      const P = S.post; P.bloom = 0.55; P.bloomThreshold = 0.8; P.exposure = 1.0;
      sky.visible = true;
      if (t < C.far) { // ---- склон
        show(gA);
        setSky('#3a5a88', '#f8b070', '#5a4030', [-0.55, 0.075, -1], '#ffd8a0', 0.03, 0.9);
        scene.fog.color.set('#e0a878'); scene.fog.density = 0.0045;
        hemi.color.set('#a8b8d8'); hemi.groundColor.set('#5a4430'); hemi.intensity = 0.75; sun.color.set('#ffc890'); sun.intensity = 2.6; sun.position.set(-150, 22, -280); sun.target.position.set(0, 0, 0);
        teacher.parts.arms[1].rotation.set(-1.0 + Math.sin(t * 0.9) * 0.15, 0, -0.4);
        P.exposure = 0.98; P.bloomThreshold = 0.78;
        cameraPath(camera, [[0, [3.4, hA(0, 0) + 2.6, 9.5], [-2, hA(0, -14) + 2.4, -14]], [C.far, [2.4, hA(0, 0) + 2.2, 7.4], [-2, hA(0, -14) + 2.6, -14]]], t);
        handheld(camera, t, 0.003);
      } else if (t < T_CITY || (t >= C.run)) { // ---- ферма / дорога
        show(gF);
        const leave = t < T_CITY;
        const dusk = !leave && t < C.found; const night = t >= C.found;
        const nk = night ? ramp(t, C.found - 0.5, 1.5) : 0;
        father.visible = son.visible = true; sonTired.visible = false; feast.visible = night; bag.visible = leave;
        if (leave) {
          setSky('#3a6090', '#f0b880', '#6a5030', [0.9, 0.1, -0.2], '#ffe0b0', 0.03, 0.9);
          scene.fog.color.set('#d8c0a0'); scene.fog.density = 0.004;
          hemi.color.set('#b0c8e8'); hemi.groundColor.set('#5a4a30'); hemi.intensity = 0.7; sun.color.set('#ffd0a0'); sun.intensity = 2.2; sun.position.set(220, 25, -50); sun.target.position.set(0, 0, 0);
          winMat.emissiveIntensity = 0; door.material.emissiveIntensity = 0.0; winGlows.forEach((g) => (g.material.opacity = 0));
          const wk = t - C.far; son.position.set(roadX(-4.5 - wk * 1.3) , hF(0, -4.5 - wk * 1.3), -4.5 - wk * 1.3); son.position.x = roadX(son.position.z) + 0.3; son.rotation.y = Math.PI * 0 + 0; lib.walkPose(son, wk * 0.9, 1);
          son.rotation.y = 0; son.rotation.y = Math.PI; // спиной к дому — идёт в -z
          father.position.set(0.8, hF(0.8, -3.2), -3.2 + 2); father.position.z = -1.9; father.rotation.y = Math.PI; father.parts.arms[1].rotation.set(lerp(0, -1.3, ramp(t, 7.2, 0.8)), 0, -0.2); lib.walkPose(father, 0, 0);
          P.sat = 1.0; motesF.u.opacity.value = 0.4; starsF.visible = false; sunGlowF.material.opacity = 0;
          cameraPath(camera, [[C.far, [-7.5, 1.5, -17], [0.5, 2.6, -2]], [T_CITY, [-7.0, 1.4, -19.5], [0.5, 2.4, -4]]], t);
          son.position.y = hF(son.position.x, son.position.z);
          handheld(camera, t, 0.003);
        } else {
          // закат → ночь
          const sd = night ? cA.set('#0a1430') : cA.set('#2a3a6a');
          setSky(sd.getStyle(), night ? '#c86a40' : '#ff9a58', '#3a2418', [0, night ? -0.02 : 0.025, -1], '#ffb070', 0.04, night ? 0.4 : 1.0, night ? 0.6 : 0);
          scene.fog.color.set(night ? '#3a2430' : '#e08860'); scene.fog.density = night ? 0.004 : 0.0045;
          hemi.color.set(night ? '#5a6a9a' : '#c09090'); hemi.groundColor.set('#3a2418'); hemi.intensity = night ? 0.45 : 0.55;
          sun.color.set('#ffa060'); sun.intensity = night ? 0.25 : 2.0; sun.position.set(0, 12, -300); sun.target.position.set(0, 0, ZM);
          const glowK = night ? 1 : 0.55; winMat.emissiveIntensity = 1.6 * glowK; door.material.emissiveIntensity = night ? 1.2 : 0.4; winGlows.forEach((g) => (g.material.opacity = 0.55 * glowK));
          starsF.visible = night; starsF.u.opacity.value = nk; motesF.u.opacity.value = night ? 0 : 0.55;
          sunGlowF.position.set(0, 18, -700); sunGlowF.material.opacity = night ? 0 : 0.25;
          // фигуры
          const zs = sonZ(t), zf = fatherZ(t);
          son.position.set(roadX(zs) + 0.0, hF(roadX(zs), zs), zs); son.rotation.y = 0;
          father.position.set(roadX(zf) + 0.0, hF(roadX(zf), zf), zf); father.rotation.y = Math.PI;
          const embr = t >= C.embrace && !night;
          if (t < C.embrace) {
            lib.walkPose(son, (t - C.run) * 0.75, 0.7); son.parts.body.rotation.x = 0.12; son.parts.head.position.z = 0.05;
            const run = ramp(t, T_RUN, 0.6);
            lib.walkPose(father, t < T_RUN ? 0 : (t - T_RUN) * 1.7, 1.0 + run * 1.2); father.parts.body.rotation.x = run * 0.22;
            father.parts.arms[1].rotation.z = -0.12; father.parts.arms[0].rotation.z = 0.12;
            if (t < T_RUN) { const see = ramp(t, T_SEE, 1.0); father.parts.arms[1].rotation.set(-see * 1.4, 0, -0.2); father.parts.head.position.z = see * 0.03; }
          } else {
            // объятие
            [son, father].forEach((f) => { lib.walkPose(f, 0, 0); f.parts.body.rotation.x = 0; });
            father.parts.arms[0].rotation.set(-1.25, 0, 0.75); father.parts.arms[1].rotation.set(-1.25, 0, -0.75);
            son.parts.arms[0].rotation.set(-1.1, 0, 0.85); son.parts.arms[1].rotation.set(-1.1, 0, -0.85); son.parts.head.position.z = 0.1; son.parts.body.rotation.x = 0.12;
            if (night) { son.position.set(-1.5, hF(-1.5, -9), -9); son.rotation.y = 0.5; father.position.set(-0.9, hF(-0.9, -8.6), -8.6); father.rotation.y = 0.5 + Math.PI * 0.75; father.parts.arms[0].rotation.set(-0.2, 0, -0.1); father.parts.arms[1].rotation.set(-1.0, 0, -0.5); son.parts.arms[0].rotation.set(-0.1, 0, 0.1); son.parts.arms[1].rotation.set(-0.1, 0, -0.1); }
          }
          void embr;
          if (night) {
            feastL.intensity = 60 * (0.9 + 0.1 * Math.sin(t * 9)); bonGlow.material.opacity = 0.4 + 0.06 * Math.sin(t * 11);
            lanterns.forEach((g, i) => (g.material.opacity = 0.75 + 0.2 * Math.sin(t * 2 + i)));
            dancers.forEach((d, i) => { const a = t * 0.9 * (i % 2 ? 1 : -1) + i / 7 * Math.PI * 2; const R = 2.6 + (i % 2) * 0.7; d.position.set(1.5 + Math.cos(a) * R, hF(1.5, -15), -15 + Math.sin(a) * R * 0.8); d.rotation.y = -a + (i % 2 ? 0 : Math.PI); lib.walkPose(d, t * 1.4 + i * 0.3, 1.3); d.parts.arms[0].rotation.z = 0.6 + Math.sin(t * 3 + i) * 0.3; d.parts.arms[1].rotation.z = -0.6 - Math.sin(t * 3 + i) * 0.3; });
            P.exposure = 1.05; P.bloom = 0.7; P.bloomThreshold = 0.7;
            cameraPath(camera, [[C.found, [-15, 5.2, -36], [-0.5, 3.2, -9]], [S.dur, [-12, 4.4, -31], [0, 3.2, -9]]], t);
            S.quote.y = 0.3;
            handheld(camera, t, 0.002);
          } else if (t < T_SIDE) { // от дома вдоль дороги: отец на переднем плане, сын — точка вдали
            P.exposure = 0.95; P.bloom = 0.6; P.bloomThreshold = 0.78;
            cameraPath(camera, [[C.run, [-2.4, hF(-2.4, -3.6) + 1.55, -3.6], [roadX(-80), 3.6, -80]], [T_SIDE, [-2.0, hF(-2.0, -4.4) + 1.5, -4.4], [roadX(-80), 3.4, -80]]], t);
            S.quote.y = 0.38;
            handheld(camera, t, 0.002);
          } else if (t < C.embrace) { // сбоку: отец бежит
            P.exposure = 0.95; P.bloom = 0.6; P.bloomThreshold = 0.78;
            const zmid = (fatherZ(t) + sonZ(t)) / 2; const cx = roadX(zmid) + 24;
            camera.position.set(cx, hF(cx, zmid + 4) + 1.0, zmid + 4); camera.lookAt(roadX(zmid), hF(roadX(zmid), zmid) + 3.2, zmid);
            S.quote.y = 0.36;
            handheld(camera, t, 0.004);
          } else { // объятие: камера медленно облетает
            P.exposure = 0.95; P.bloom = 0.65; P.bloomThreshold = 0.74;
            const a = lerp(0.55, 1.35, (t - C.embrace) / (C.found - C.embrace)); const mx = roadX(ZM), my = hF(mx, ZM);
            camera.position.set(mx + Math.cos(a) * 5.2, my + 1.5, ZM + Math.sin(a) * 5.2); camera.lookAt(mx, my + 1.45, ZM);
            handheld(camera, t, 0.002);
          }
        }
      } else if (t < T_PIGS) { // ---- город
        show(gC); sky.visible = true;
        setSky('#04060e', '#1a1424', '#05040a', [0, 0.3, -1], '#000', 0, 0, 0.8);
        scene.fog.color.set('#24141a'); scene.fog.density = 0.012;
        hemi.color.set('#6a5a8a'); hemi.groundColor.set('#3a2010'); hemi.intensity = 0.8; sun.intensity = 0;
        for (let i = 0; i < NCR; i++) { const [x, z, ph, s] = crowdD[i]; const b = Math.abs(Math.sin(t * 4 + ph)) * 0.12; crowd.setMatrixAt(i, tmpM.compose(tmpP.set(x + Math.sin(t * 1.3 + ph) * 0.3, b, z), tmpQ.setFromEuler(eul.set(0, t * (ph > 3 ? 1.5 : -1.5) + ph, Math.sin(t * 4 + ph) * 0.08)), tmpS.setScalar(s))); }
        crowd.instanceMatrix.needsUpdate = true;
        sonCity.rotation.y = Math.sin(t * 1.2) * 0.5; sonCity.parts.arms[1].rotation.set(-2.6 + Math.sin(t * 4) * 0.15, 0, 0); sonCity.parts.arms[0].rotation.set(-0.3, 0, -0.6 - Math.sin(t * 4) * 0.2);
        cityLan.forEach((g, i) => (g.material.opacity = 0.75 + 0.2 * Math.sin(t * 3 + i)));
        P.exposure = 1.0; P.bloom = 0.8; P.bloomThreshold = 0.68; P.sat = 1.1;
        cameraPath(camera, [[T_CITY, [2.6, 2.0, 5.5], [0, 1.6, -3]], [T_PIGS, [1.4, 1.8, 3.6], [0, 1.6, -3]]], t);
        handheld(camera, t, 0.005);
      } else { // ---- свиньи, решение, путь домой
        show(gP);
        const hope = ramp(t, T_RISE - 0.5, 2.5);
        setSky(cA.set('#3a3e48').lerp(col('#4a5a78'), hope).getStyle(), cA.set('#6a6460').lerp(col('#c09070'), hope).getStyle(), '#2a2420', [0.4, 0.12, -1], '#ffd8a0', 0.0005, 0.15 + hope * 0.3);
        scene.fog.color.set('#5a5650').lerp(col('#a08060'), hope); scene.fog.density = 0.012 - hope * 0.004;
        hemi.color.set('#a8acb4'); hemi.groundColor.set('#4a3a2a'); hemi.intensity = 1.0; sun.color.set('#ffd8a0'); sun.intensity = 0.7 + hope * 1.3; sun.position.set(60, 40, -120); sun.target.position.set(0, 0, 0);
        cloudsP.drift(t, 3, 0); hopeBeam.u.opacity.value = hope * 0.12; drizzle.u.opacity.value = 0.25 * (1 - hope);
        pigs.forEach((g, i) => { const d = g.userData; const a = d.a + Math.sin(t * 0.2 + d.ph) * 0.8; const w = Math.sin(t * 0.3 + d.ph) * 1.2; g.position.set(d.x + Math.cos(a) * w, 0, d.z + Math.sin(a) * w); g.position.y = hP(g.position.x, g.position.z);
          g.rotation.y = -a + Math.PI / 2 * Math.sign(Math.cos(t * 0.3 + d.ph)); d.head.rotation.z = -0.3 + Math.sin(t * 2.5 + d.ph) * 0.2; d.legs.forEach((l, j) => (l.rotation.z = Math.sin(t * 5 + d.ph + j * Math.PI) * 0.25 * Math.abs(Math.cos(t * 0.3 + d.ph)))); void i; });
        // сын: сидит на бревне → встаёт → идёт
        const LX = 0.6, LZ = 6.0; logP.position.set(LX, hP(LX, LZ) + 0.2, LZ);
        const up = ramp(t, T_RISE, 1.2); const wk = Math.max(0, t - T_RISE - 1.2);
        sonPig.rotation.y = lerp(-0.4, 2.78, up);
        sonPig.position.set(LX + 0.1 + Math.sin(sonPig.rotation.y) * wk * 1.1, 0, LZ - 0.05 + Math.cos(sonPig.rotation.y) * wk * 1.1); sonPig.position.y = hP(sonPig.position.x, sonPig.position.z) - lerp(0.5, 0, up);
        sonPig.parts.body.rotation.x = lerp(0.3, 0.05, up); sonPig.parts.head.position.z = lerp(0.1, 0, up);
        if (wk > 0) lib.walkPose(sonPig, wk * 0.8, 0.9); else { sonPig.parts.arms[0].rotation.set(lerp(-0.9, 0, up), 0, 0.3); sonPig.parts.arms[1].rotation.set(lerp(-0.9, 0, up), 0, -0.3); }
        P.sat = lerp(0.55, 0.95, hope); P.exposure = 0.95; P.contrast = 1.08;
        const gy = hP(LX, LZ); if (t < T_RISE) cameraPath(camera, [[T_PIGS, [LX + 4.4, gy + 1.25, LZ + 5.4], [LX - 1.8, gy + 0.55, LZ - 3.0]], [T_RISE, [LX + 3.8, gy + 1.15, LZ + 4.7], [LX - 1.8, gy + 0.6, LZ - 3.0]]], t);
        else cameraPath(camera, [[T_RISE, [-1.6, hP(-1.6, 10.5) + 1.4, 10.5], [3, 1.5, -6]], [C.run, [-1.2, hP(-1.2, 9.5) + 1.6, 9.5], [3.5, 2.0, -8]]], t);
        handheld(camera, t, 0.004);
      }
      sky.position.copy(camera.position);
    },
  };
}
