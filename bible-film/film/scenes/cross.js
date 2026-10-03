// Страсти: вход в Иерусалим (пальмовые ветви, осёл) → та же площадь ночью, «распни» →
// Тайная вечеря → Голгофа, затмение, ветер → «Совершилось!» (молния) → завеса в храме разрывается.
export default function build({ THREE, lib, W, H, meta }) {
  const { ramp, lerp, clamp, cameraPath, handheld, rng, walkPose } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 4000);
  scene.fog = new THREE.FogExp2('#d8b890', 0.006);
  const C = meta.cues;
  const T1 = C.crowd, T2 = C.supper, T3 = C.golgotha, T4 = C.finished, T5 = C.veil;

  const sky = lib.skyDome({ radius: 2000 }); scene.add(sky);
  const setSky = (top, hor, bot, sd, sc, size, glow, stars = 0) => {
    sky.u.top.value.set(top); sky.u.horizon.value.set(hor); sky.u.bottom.value.set(bot); sky.u.sunDir.value.set(...sd).normalize();
    sky.u.sunColor.value.set(sc); sky.u.sunSize.value = size; sky.u.sunGlow.value = glow; sky.u.starAmt.value = stars;
  };
  const hemi = new THREE.HemisphereLight('#c8d4e8', '#5a4430', 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe0b0', 2.5); scene.add(sun); scene.add(sun.target);
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 }); sun.shadow.bias = -0.0008;

  const robeCols = ['#6a5440', '#7a6248', '#5a4636', '#8a7258', '#6b5a4a', '#7c5a40', '#5e5048', '#8e6a4a', '#4e5a6a', '#6a3a30'];
  // толпа из инстансов: тела + головы (+ поднятые руки)
  function crowd({ count, seed, place, palette = robeCols, arms = false, skinK = 0.5 }) {
    const r = rng(seed); const grp = new THREE.Group();
    const prof = [[0, 0], [0.36, 0], [0.33, 0.25], [0.27, 0.7], [0.22, 1.05], [0.25, 1.32], [0.19, 1.42], [0.08, 1.48], [0, 1.48]].map(([x, y]) => new THREE.Vector2(x, y));
    const body = new THREE.InstancedMesh(new THREE.LatheGeometry(prof, 9), new THREE.MeshStandardMaterial({ roughness: 0.92 }), count);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.9 }), count);
    body.frustumCulled = head.frustumCulled = false; body.castShadow = head.castShadow = true; grp.add(body, head);
    let armM = null;
    if (arms) { const ag = new THREE.CylinderGeometry(0.05, 0.07, 0.68, 6); ag.translate(0, 0.34, 0); armM = new THREE.InstancedMesh(ag, new THREE.MeshStandardMaterial({ roughness: 0.9 }), count * 2); armM.frustumCulled = false; grp.add(armM); }
    const data = []; const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const p = place(i, r); p.ph = r() * 20; p.s = p.s || (0.9 + r() * 0.2); p.up = r(); data.push(p);
      c.set(palette[Math.floor(r() * palette.length)]).multiplyScalar(0.75 + r() * 0.45); body.setColorAt(i, c);
      if (armM) { armM.setColorAt(i * 2, c); armM.setColorAt(i * 2 + 1, c); }
      if (r() < skinK) c.set('#7a4e34'); else c.multiplyScalar(1.1); head.setColorAt(i, c);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), off = new THREE.Vector3();
    const pose = (t, amt = 1, armAmt = 1, jump = 0) => {
      for (let i = 0; i < count; i++) {
        const d = data[i]; const s = d.s; const sw = Math.sin(t * 1.3 + d.ph) * 0.03 * amt; const ry = d.ry || 0;
        const jy = jump * Math.max(0, Math.sin(t * 5 + d.ph)) * 0.12;
        e.set(0, ry, sw); q.setFromEuler(e); sc.set(s, s, s); v.set(d.x, d.y + jy, d.z); m4.compose(v, q, sc); body.setMatrixAt(i, m4);
        v.set(d.x - Math.sin(sw) * 1.58 * s * Math.cos(ry), d.y + jy + 1.58 * s, d.z + Math.sin(sw) * 1.58 * s * Math.sin(ry)); sc.set(s, s * 1.12, s); m4.compose(v, q, sc); head.setMatrixAt(i, m4);
        if (armM) for (let k = 0; k < 2; k++) {
          const side = k ? 1 : -1; const raise = armAmt * (d.up < 0.75 ? 1 : 0.2);
          const shake = Math.sin(t * (5 + d.up * 3) + d.ph + k) * 0.25 * raise;
          e.set(Math.sin(t * 4 + d.ph * 2) * 0.15 * raise, ry, side * (lerp(2.9, 0.35, raise) + shake * 0.5)); q.setFromEuler(e);
          off.set(side * 0.24 * s, 1.36 * s, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
          v.set(d.x + off.x, d.y + jy + off.y, d.z + off.z); sc.set(s, s, s); m4.compose(v, q, sc); armM.setMatrixAt(i * 2 + k, m4);
        }
      }
      body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true; if (armM) armM.instanceMatrix.needsUpdate = true;
    };
    pose(0); return Object.assign(grp, { pose, data });
  }
  function donkey(col = '#7a7068') {
    const g = new THREE.Group(); const dm = new THREE.MeshStandardMaterial({ color: col, roughness: 1 }); const dk = new THREE.MeshStandardMaterial({ color: '#3a3430', roughness: 1 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.9, 4, 10), dm); body.rotation.x = Math.PI / 2; body.position.y = 1.0; g.add(body);
    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.5, 4, 8), dm); neck.position.set(0, 1.35, 0.72); neck.rotation.x = 0.75; g.add(neck);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.42, 4, 8), dm); head.position.set(0, 1.5, 1.05); head.rotation.x = 2.0; g.add(head);
    [-0.1, 0.1].forEach((x) => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.38, 5), dk); e.position.set(x * 1.4, 1.86, 0.88); e.rotation.set(-0.3, 0, x * 2.5); g.add(e); });
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.6, 4), dk); tail.position.set(0, 0.9, -0.78); tail.rotation.x = -0.3; g.add(tail);
    const legs = [[-0.18, 0.45], [0.18, 0.45], [-0.18, -0.45], [0.18, -0.45]].map(([x, z]) => {
      const piv = new THREE.Group(); piv.position.set(x, 0.85, z); g.add(piv);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.85, 6), dm); l.position.y = -0.42; piv.add(l);
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 6), dk); hoof.position.y = -0.84; piv.add(hoof); return piv; });
    const cloak = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.8), new THREE.MeshStandardMaterial({ color: '#7a2a24', roughness: 1 })); cloak.position.y = 1.33; g.add(cloak);
    g.legs = legs; return g;
  }
  // камень с кладкой по мировым координатам
  function stoneMat(color, bw = 1.3, bh = 0.6, contrast = 0.22) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;\nfloat sh21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }')
        .replace('#include <color_fragment>', `#include <color_fragment>
          { vec3 an = abs(vWN); float u = an.x > an.z ? vWP.z : vWP.x; vec2 p = vec2(u / ${bw.toFixed(2)}, vWP.y / ${bh.toFixed(2)});
            if (an.y > .7) p = vWP.xz / vec2(${bw.toFixed(2)}, ${(bw * 0.7).toFixed(2)});
            p.x += floor(p.y) * .5; vec2 cell = floor(p), f = fract(p);
            float mortar = smoothstep(.0, .05, f.x) * smoothstep(1., .95, f.x) * smoothstep(.0, .08, f.y) * smoothstep(1., .92, f.y);
            float k = (1. - ${contrast.toFixed(2)}) + ${contrast.toFixed(2)} * sh21(cell) ; k *= .78 + .22*mortar;
            k *= .9 + .1*sh21(floor(vWP.xy*7.));
            diffuseColor.rgb *= k; }`);
    };
    return m;
  }
  const jesusFig = (glow = 0) => lib.figure({ height: 1.82, robe: '#e9e3d6', hoodColor: '#f2ede2', skin: '#9a6a4a', belt: '#b8a888', glow, seed: 11 });
  const sand = stoneMat('#c8a878'); const sand2 = stoneMat('#b39268');

  // ================= Иерусалим: ворота =================
  const city = new THREE.Group(); scene.add(city);
  const roadH = (x, z) => lib.fbm(x * 0.04, z * 0.04, 3) * 0.25;
  city.add(lib.terrain({ size: 300, seg: 70, center: [0, 20], heightFn: roadH, colorFn: (x, z) => new THREE.Color(Math.abs(x) < 3.2 ? '#a88a64' : '#8a7454').multiplyScalar(0.85 + 0.15 * lib.noise2(x * 0.3, z * 0.3)) }));
  {
    const gs = new THREE.Shape(); gs.moveTo(-7, 0); gs.lineTo(7, 0); gs.lineTo(7, 13); gs.lineTo(-7, 13); gs.lineTo(-7, 0);
    const hole = new THREE.Path(); hole.moveTo(-2.4, 0); hole.lineTo(-2.4, 4.6); hole.absarc(0, 4.6, 2.4, Math.PI, 0, true); hole.lineTo(2.4, 0); hole.lineTo(-2.4, 0); gs.holes.push(hole);
    const gate = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: 6, bevelEnabled: false, curveSegments: 16 }), sand); gate.position.set(0, 0, -24); city.add(gate);
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(5, 7.5), new THREE.MeshBasicMaterial({ color: '#1a120c' })); dark.position.set(0, 3.5, -21); city.add(dark);
    [-1, 1].forEach((sd) => { const tw = new THREE.Mesh(new THREE.BoxGeometry(5, 16, 7.5), sand2); tw.position.set(sd * 9.2, 8, -21.3); city.add(tw); });
    const box = new THREE.BoxGeometry(1, 1, 1);
    [-1, 1].forEach((sd) => { const wl = new THREE.Mesh(box, sand); wl.scale.set(70, 10.5, 4.5); wl.position.set(sd * 46.5, 5.25, -22); city.add(wl); });
    const merl = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.2, 4.6), sand2, 120); let n = 0; const m4 = new THREE.Matrix4();
    for (let x = -80; x <= 80; x += 2.2) { if (Math.abs(x) < 6.8) continue; const top = Math.abs(x) < 11.7 ? 16 : 10.5; if (Math.abs(x) > 6.7 && Math.abs(x) < 7.0) continue; m4.makeTranslation(x, top + 0.6, Math.abs(x) < 11.7 ? -21.3 : -22); merl.setMatrixAt(n++, m4); }
    for (let x = -6.6; x <= 6.6; x += 2.2) { m4.makeTranslation(x, 13.6, -21); merl.setMatrixAt(n++, m4); }
    merl.count = n; city.add(merl);
    // крыши города за стеной
    const r = rng(12); for (let i = 0; i < 30; i++) { const h = 8 + r() * 12; const m = new THREE.Mesh(box, r() < 0.5 ? sand : sand2); m.scale.set(5 + r() * 6, h, 5 + r() * 6); m.position.set((r() - 0.5) * 120, h / 2, -32 - r() * 50); city.add(m); }
    const tower = new THREE.Mesh(new THREE.BoxGeometry(12, 30, 12), sand); tower.position.set(-18, 15, -70); city.add(tower);
  }
  // пальмы у дороги
  const palmTex = lib.canvasTexture(128, 512, (g, w, h) => {
    g.strokeStyle = '#4a6a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 10); g.stroke();
    for (let y = 30; y < h - 20; y += 9) { const L = 50 * Math.sin((y / h) * Math.PI) + 8; g.strokeStyle = y % 2 ? '#5a7a30' : '#4f7028'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 - L, y + 22); g.stroke(); g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + L, y + 22); g.stroke(); }
  });
  const frondMat = new THREE.MeshStandardMaterial({ map: palmTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
  const day = new THREE.Group(); city.add(day);
  [[-8, -6], [8.5, -9], [-10, 6], [11, 4]].forEach(([x, z], i) => {
    const pt = new THREE.Group(); pt.position.set(x, 0, z); day.add(pt);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 8, 7), new THREE.MeshStandardMaterial({ color: '#6a5238', roughness: 1 })); trunk.position.y = 4; trunk.rotation.z = (i % 2 ? 0.08 : -0.08); pt.add(trunk);
    for (let k = 0; k < 9; k++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4.4), frondMat); f.geometry.translate(0, 2.2, 0); f.position.y = 8; f.rotation.set(0, k / 9 * Math.PI * 2, 1.1 + (k % 2) * 0.3, 'YXZ'); pt.add(f); }
  });
  const sideCrowd = crowd({ count: 150, seed: 3, place: (i, r) => { const sd = i % 2 ? 1 : -1; const z = 14 - r() * 34; const x = sd * (3.3 + r() * 4 + Math.max(0, -z - 14) * 0.05); return { x, y: roadH(x, z), z, ry: -sd * Math.PI / 2 + (r() - 0.5) * 0.8 }; } });
  day.add(sideCrowd);
  const fronds = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 1.6).translate(0, 0.8, 0), frondMat, 90); fronds.frustumCulled = false; day.add(fronds);
  const frondData = sideCrowd.data.filter((d, i) => i % 5 !== 0).slice(0, 90);
  const cloaks = new THREE.Group(); day.add(cloaks);
  { const r = rng(4); const cols = ['#7a2a24', '#4a5a7a', '#8a6a3a', '#5a3a5a', '#6a6a4a']; for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshStandardMaterial({ color: cols[i % 5], roughness: 1 })); m.rotation.set(-Math.PI / 2, 0, (r() - 0.5) * 0.8); m.position.set((r() - 0.5) * 3, 0.05, 10 - i * 3.2); cloaks.add(m); } }
  const ass = donkey(); day.add(ass);
  const rider = jesusFig(); rider.position.set(0, 0.62, -0.05); rider.parts.arms.forEach((a) => (a.rotation.x = -0.6)); ass.add(rider);
  const followers = []; for (let i = 0; i < 5; i++) { const f = lib.figure({ height: 1.72, robe: robeCols[(i * 3) % robeCols.length], seed: 60 + i, hood: i % 2 === 0 }); day.add(f); followers.push(f); }
  const dustDay = lib.motes({ count: 400, box: [30, 8, 40], center: [0, 3, -2], size: 1.2, color: '#ffe0b0', speed: 0.2, opacity: 0.4 }); day.add(dustDay);

  // ночь: та же площадь, факелы, толпа «распни»
  const night = new THREE.Group(); city.add(night);
  const mob = crowd({ count: 170, seed: 8, arms: true, palette: ['#3a2e2a', '#4a3a30', '#2e2624', '#54402e', '#3e3430', '#5a3428'], place: (i, r) => { const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 9; const x = Math.cos(a) * rr * 1.2, z = -6 + Math.sin(a) * rr; return { x, y: roadH(x, z), z, ry: Math.atan2(-x * 0.3, 18 - z) + (r() - 0.5) * 0.5 }; } });
  night.add(mob);
  const torchLs = []; [[-4, -2], [3.5, -8], [5, 1], [-2, -11], [-6, -7], [1, 3]].forEach(([x, z], i) => {
    const tg = new THREE.Group(); tg.position.set(x, 2.6, z); night.add(tg);
    tg.add(lib.fire({ count: 120, radius: 0.12, height: 0.8, size: 9, seed: 30 + i, intensity: 0.75, color2: '#ff3a0a' }));
    const g = lib.glow('#ff5a20', 3, 0.16); g.position.y = 0.4; tg.add(g);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 5), new THREE.MeshStandardMaterial({ color: '#1a120c' })); st.position.y = -1.2; tg.add(st);
    if (i < 3) { const L = new THREE.PointLight('#ff5a24', 22, 22, 1.5); L.position.y = 0.6; tg.add(L); torchLs.push(L); }
  });
  const embersN = lib.motes({ count: 300, box: [20, 10, 20], center: [0, 5, -4], size: 2, color: '#ff7a30', kind: 'embers', speed: 0.5, opacity: 0.8 }); night.add(embersN);

  city.traverse((o) => { if (o.isMesh && !(o.material && o.material.alphaTest)) { o.castShadow = true; o.receiveShadow = true; } });

  // ================= Тайная вечеря =================
  const supper = new THREE.Group(); scene.add(supper);
  {
    const wallM = stoneMat('#7a6048', 1.0, 0.5, 0.3); const box = new THREE.BoxGeometry(1, 1, 1);
    const floor = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: '#4a3828', roughness: 1 })); floor.scale.set(24, 0.2, 16); floor.position.set(0, -0.1, -2); supper.add(floor);
    const back = new THREE.Mesh(box, wallM); back.scale.set(24, 9, 0.4); back.position.set(0, 4.5, -6); supper.add(back);
    [-1, 1].forEach((sd) => { const w = new THREE.Mesh(box, wallM); w.scale.set(0.4, 9, 16); w.position.set(sd * 12, 4.5, -2); supper.add(w); });
    const ceil = new THREE.Mesh(box, wallM); ceil.scale.set(24, 0.3, 16); ceil.position.set(0, 9, -2); supper.add(ceil);
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 1 })); b.scale.set(0.35, 0.4, 16); b.position.set(-10 + i * 4, 8.7, -2); supper.add(b); }
    // окна: ночная синева
    [-6, 0, 6].forEach((x) => { const ws = new THREE.Shape(); ws.moveTo(-0.8, 0); ws.lineTo(0.8, 0); ws.lineTo(0.8, 1.6); ws.absarc(0, 1.6, 0.8, 0, Math.PI, false); ws.lineTo(-0.8, 0);
      const w = new THREE.Mesh(new THREE.ShapeGeometry(ws, 12), new THREE.MeshBasicMaterial({ color: '#0f1c38' })); w.position.set(x, 2.3, -5.78); w.scale.setScalar(0.8); supper.add(w); });
  }
  const tableG = new THREE.Group(); supper.add(tableG);
  { const wood = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.8 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(11, 0.14, 1.4), wood); top.position.set(0, 0.75, 0); tableG.add(top);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.5, 1.45), new THREE.MeshStandardMaterial({ color: '#c8b898', roughness: 1 })); cloth.position.set(0, 0.55, 0.01); tableG.add(cloth); }
  const disciples = [];
  for (let i = 0; i < 13; i++) {
    const x = (i - 6) * 0.82; const isJ = i === 6;
    const f = isJ ? jesusFig() : lib.figure({ height: 1.7 + (i % 3) * 0.05, robe: robeCols[(i * 7) % robeCols.length], seed: 100 + i, hood: i % 3 !== 1 });
    f.position.set(x, -0.35, -1.0 - (isJ ? 0.05 : 0)); f.rotation.y = isJ ? 0 : (x < 0 ? 0.25 : -0.25) + Math.sin(i * 3) * 0.2;
    f.parts.arms.forEach((a, k) => (a.rotation.x = -0.5 - 0.3 * Math.sin(i + k)));
    supper.add(f); disciples.push(f);
  }
  const candles = []; const candleLs = [];
  [-4.2, -2.1, 1.9, 4.0].forEach((x, i) => {
    const cg = new THREE.Group(); cg.position.set(x, 0.82, 0.2); supper.add(cg);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), new THREE.MeshStandardMaterial({ color: '#efe0c0', emissive: '#ffb060', emissiveIntensity: 0.3 })); c.position.y = 0.15; cg.add(c);
    const fl = lib.glow('#ffc070', 0.35, 1); fl.position.y = 0.38; cg.add(fl); const fl2 = lib.glow('#ff9a40', 1.6, 0.25); fl2.position.y = 0.38; cg.add(fl2); candles.push([fl, fl2]);
    if (i === 1 || i === 2) { const L = new THREE.PointLight('#ffb060', 6, 9, 1.6); L.position.y = 0.6; cg.add(L); candleLs.push(L); }
  });
  const breadCup = new THREE.Group(); breadCup.position.set(0, 0.84, 0.25); supper.add(breadCup);
  { const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8), new THREE.MeshStandardMaterial({ color: '#c8904c', roughness: 0.8, emissive: '#ffb060', emissiveIntensity: 0.25 })); loaf.scale.set(1.3, 0.5, 0.9); loaf.position.set(-0.32, 0.05, 0); breadCup.add(loaf);
    const cupProf = [[0, 0], [0.09, 0], [0.04, 0.03], [0.03, 0.14], [0.11, 0.2], [0.12, 0.32], [0.11, 0.32], [0.1, 0.22], [0, 0.2]].map(([x, y]) => new THREE.Vector2(x, y));
    const cup = new THREE.Mesh(new THREE.LatheGeometry(cupProf, 16), new THREE.MeshStandardMaterial({ color: '#c8a050', roughness: 0.35, metalness: 0.6, emissive: '#ff9a40', emissiveIntensity: 0.3 })); cup.position.set(0.3, 0, 0); breadCup.add(cup); }
  const bcGlow = lib.glow('#ffd090', 1.5, 0.45); bcGlow.position.set(0, 0.15, 0); breadCup.add(bcGlow);
  { const lamp = new THREE.Group(); lamp.position.set(0, 3.4, -0.6); supper.add(lamp);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: 0.6, metalness: 0.4 })); lamp.add(bowl);
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 5.5, 4), new THREE.MeshBasicMaterial({ color: '#1a120a' })); ch.position.y = 2.75; lamp.add(ch);
    { const lg = lib.glow('#ffc070', 0.5, 1); lg.position.y = 0.08; lamp.add(lg); } lamp.add(lib.glow('#ff9a40', 3.5, 0.2));
    const L = new THREE.PointLight('#ffb060', 9, 14, 1.4); L.position.y = -0.1; lamp.add(L); candleLs.push(L); }
  const supperDust = lib.motes({ count: 300, box: [12, 6, 8], center: [0, 3, -1], size: 1.5, color: '#ffd8a0', speed: 0.12, opacity: 0.4 }); supper.add(supperDust);

  // ================= Голгофа =================
  const golg = new THREE.Group(); scene.add(golg);
  const hillH = (x, z) => { const d = Math.hypot(x * 0.8, z + 20); return Math.max(0, 14 - d * d * 0.012) + lib.fbm(x * 0.03, z * 0.03, 4) * 2.5; };
  golg.add(lib.terrain({ size: 500, seg: 120, center: [0, -60], heightFn: hillH, colorFn: (x, z, y) => new THREE.Color('#3a3026').lerp(new THREE.Color('#5a4a38'), clamp(lib.noise2(x * 0.1, z * 0.1) * 0.5 + 0.5)) }));
  const silM = new THREE.MeshStandardMaterial({ color: '#141010', roughness: 1 });
  const crossAt = (x, z, h, sc) => {
    const g = new THREE.Group(); g.position.set(x, hillH(x, z) - 0.3, z); g.scale.setScalar(sc); golg.add(g);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, h, 0.3), silM); post.position.y = h / 2; g.add(post);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.28, 0.28), silM); beam.position.y = h - 1.0; g.add(beam);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.1, 4, 8), silM); body.position.set(0, h - 2.0, 0.25); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), silM); head.position.set(0.05, h - 1.05, 0.3); g.add(head);
    [-1, 1].forEach((sd) => { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 1.0, 4, 6), silM); arm.rotation.z = sd * (Math.PI / 2 - 0.25); arm.position.set(sd * 0.62, h - 1.1, 0.25); g.add(arm); });
    return g;
  };
  crossAt(0, -20, 6.2, 1.0); crossAt(-5.5, -18, 5.2, 0.9); crossAt(5.5, -18.5, 5.2, 0.9);
  // затмение: тёмный диск + корона
  const SUN_DIR = new THREE.Vector3(0.32, 0.3, -1).normalize();
  const eclipse = new THREE.Group(); eclipse.position.copy(SUN_DIR).multiplyScalar(1500); golg.add(eclipse);
  const corona = lib.glow('#ffd8a8', 220, 0.8); eclipse.add(corona); const corona2 = lib.glow('#ffb070', 600, 0.25); eclipse.add(corona2); corona.material.fog = corona2.material.fog = false;
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ color: '#060404', fog: false, depthWrite: false })); moonDisc.renderOrder = 2; moonDisc.position.copy(SUN_DIR).multiplyScalar(-6); eclipse.add(moonDisc);
  const clouds = lib.cloudLayer({ count: 22, area: [900, 500], y: 140, scale: [260, 90], seed: 21, color: '#3a3030', opacity: 0.6, center: [0, -500] }); clouds.children.forEach((c) => (c.material.fog = false)); golg.add(clouds);
  const wind = (() => {
    const N = 1400, r = rng(55), p = new Float32Array(N * 3), sd = new Float32Array(N);
    for (let i = 0; i < N; i++) { p.set([(r() - 0.5) * 120, r() * 16, -40 + r() * 70], i * 3); sd[i] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 1));
    const u = { time: { value: 0 }, pxr: { value: 1 }, opacity: { value: 0.5 }, color: { value: new THREE.Color('#b89a7a') } };
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float sd; uniform float time, pxr; varying float vA; void main(){ vec3 q = position; q.x = mod(q.x + time*(9.+sd*8.) + 60., 120.) - 60.; q.y += sin(time*1.5+sd*30.)*.6;
        vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv; vA = smoothstep(60.,45.,abs(q.x))*(.3+.7*fract(sd*13.)); gl_PointSize = (1.5+sd*2.5)*pxr*(40./max(-mv.z,1.)); }`,
      fragmentShader: `uniform float opacity; uniform vec3 color; varying float vA; void main(){ vec2 c = gl_PointCoord-.5; c.y *= 3.; float a = smoothstep(.5,0.,length(c)); gl_FragColor = vec4(color*a*vA*opacity, 1.); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.u = u; return pts; })();
  golg.add(wind);
  const bolt = (() => { const r = rng(77); const pts = []; let x = 0, y = 0; for (let i = 0; i < 18; i++) { pts.push(new THREE.Vector3(x, y, 0)); x += (r() - 0.5) * 22; y -= 9 + r() * 6; }
    const g = new THREE.Group(); const m = new THREE.LineBasicMaterial({ color: '#e8eeff', transparent: true, opacity: 1, fog: false });
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m));
    const br = []; let bx = pts[6].x, by = pts[6].y; br.push(new THREE.Vector3(bx, by, 0)); for (let i = 0; i < 6; i++) { bx += 4 + r() * 10; by -= 6 + r() * 6; br.push(new THREE.Vector3(bx, by, 0)); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(br), m)); g.m = m; return g; })();
  bolt.position.set(-90, 210, -260); golg.add(bolt);
  const boltGlow = lib.glow('#c8d4ff', 260, 0); boltGlow.material.fog = false; boltGlow.position.set(-80, 150, -262); golg.add(boltGlow);

  // ================= Храм: завеса =================
  const temple = new THREE.Group(); scene.add(temple);
  const VW = 13, VH = 20;
  {
    const stone = stoneMat('#6a5a48', 2.0, 1.0, 0.25); const box = new THREE.BoxGeometry(1, 1, 1);
    const floor = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: '#3e342a', roughness: 0.7 })); floor.scale.set(40, 0.2, 60); floor.position.set(0, -0.1, 10); temple.add(floor);
    [-1, 1].forEach((sd) => { const back = new THREE.Mesh(box, stone); back.scale.set(12.5, 30, 0.6); back.position.set(sd * 14.25, 15, -0.9); temple.add(back); });
    const backTop = new THREE.Mesh(box, stone); backTop.scale.set(16, 8, 0.6); backTop.position.set(0, 26, -0.9); temple.add(backTop);
    for (let i = 0; i < 5; i++) [-1, 1].forEach((sd) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 24, 14), stone); c.position.set(sd * 10, 12, 4 + i * 7); temple.add(c);
      const cap = new THREE.Mesh(box, stone); cap.scale.set(2.6, 0.8, 2.6); cap.position.set(sd * 10, 24.2, 4 + i * 7); temple.add(cap);
      const lamp = lib.glow('#ffb060', 2.2, 0.55); lamp.position.set(sd * 8.8, 5, 4.6 + i * 7); temple.add(lamp); });
    const lintel = new THREE.Mesh(box, stone); lintel.scale.set(VW + 4, 2.2, 1.6); lintel.position.set(0, VH + 1.1, 0.2); temple.add(lintel);
    [-1, 1].forEach((sd) => { const p = new THREE.Mesh(box, stone); p.scale.set(2, VH, 1.6); p.position.set(sd * (VW / 2 + 1), VH / 2, 0.2); temple.add(p); });
  }
  const behindU = { time: { value: 0 }, k: { value: 0 } };
  const behind = new THREE.Mesh(new THREE.PlaneGeometry(VW + 2, VH + 2), new THREE.ShaderMaterial({ uniforms: behindU, fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: lib.GLSL_NOISE + `uniform float time, k; varying vec2 vUv; void main(){ vec2 p = vUv - vec2(.5,.62); float r = length(p*vec2(1.3,1.));
      float a = atan(p.y, p.x); float rays = .75 + .25*vnoise(vec2(a*9., time*.3)) ;
      vec3 c = mix(vec3(.95,.72,.42), vec3(.32,.18,.08), smoothstep(.0,.65,r)) * rays;
      c += vec3(1.,.85,.6)*smoothstep(.25,0.,r)*.35;
      gl_FragColor = vec4(c*k, 1.); }` }));
  behind.position.set(0, VH / 2, -3.5); behind.scale.set(1.3, 1.2, 1); behind.u = behindU; temple.add(behind);
  const veilU = { time: { value: 0 }, tear: { value: 0 }, open: { value: 0 }, light: { value: 0 } };
  const veilHalf = (side) => {
    const geo = new THREE.PlaneGeometry(VW / 2 + 0.6, VH, 50, 70); geo.translate(side * (VW / 4 - 0.3), VH / 2, 0);
    const u = { ...veilU, side: { value: side } };
    const m = new THREE.ShaderMaterial({ uniforms: u, side: THREE.DoubleSide, fog: false,
      vertexShader: lib.GLSL_NOISE + `uniform float time, tear, open, side; varying vec2 vP; varying float vSh; varying float vOpen;
        void main(){ vec3 p = position; vP = p.xy;
          float yN = p.y / ${VH.toFixed(1)}; float front = 1. - tear*1.08;          // разрыв идёт сверху вниз
          float torn = smoothstep(front, front + .12, yN);                              // 1 = уже порвано
          float edgeW = 1. - clamp(abs(p.x)/(${(VW / 2).toFixed(1)}), 0., 1.);          // ближе к центру сильнее
          float pull = torn * open * edgeW * (yN - front + .35) * 3.0;
          p.x += side * pull; p.z += torn * open * edgeW * (.8 + .8 * sin(yN*7. + time*.8));
          float fold = sin(p.x*2.6 + sin(p.y*.3)*1.5)*.18 + sin(p.x*7.1)*.05; p.z += fold + sin(time*.7 + p.y*.2)*.04;
          vSh = .72 + .28*sin(p.x*2.6 + sin(p.y*.3)*1.5 + 1.2); vOpen = torn;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
      fragmentShader: lib.GLSL_NOISE + `uniform float tear, light, side; varying vec2 vP; varying float vSh; varying float vOpen;
        void main(){ float yN = vP.y / ${VH.toFixed(1)};
          float jag = (vnoise(vec2(yN*26., 1.))-.5)*.5 + (vnoise(vec2(yN*90., 4.))-.5)*.18;
          float cut = side * (vP.x - jag);
          if (cut < 0. && vOpen > .01) discard;                 // зубчатый край разрыва
          if (side > 0. && cut < 0.) discard;
          vec3 base = vec3(.36,.035,.04);
          float pat = smoothstep(.45,.5, abs(fract(vP.x*.5 + vP.y*.5)-.5)) * smoothstep(.45,.5, abs(fract(vP.x*.5 - vP.y*.5)-.5));
          base = mix(base, vec3(.5,.07,.06), pat*.35);
          float band = smoothstep(.015,.0, abs(yN-.93)-.025) + smoothstep(.015,.0, abs(yN-.07)-.02);
          base = mix(base, vec3(.62,.44,.16), band*.85);
          float rim = smoothstep(.35, 0., abs(cut)) * vOpen;
          vec3 c = base*vSh*(.55 + .45*fbm2(vP*vec2(.6, .15)));
          c += vec3(1.,.65,.3)*rim*light*.9;
          gl_FragColor = vec4(c, 1.); }` });
    const mesh = new THREE.Mesh(geo, m); mesh.u = u; mesh.userData.manualTime = false; return mesh;
  };
  const veilL = veilHalf(-1), veilR = veilHalf(1); veilR.position.z = -0.02; temple.add(veilL, veilR);
  const veilBeams = []; [[0, 0.1, 9, 26, 0.0], [-0.6, 0.05, 6, 22, 0.15], [0.7, 0.12, 6, 24, -0.18]].forEach(([x, tilt, rb, len, yaw]) => {
    const b = lib.lightBeam({ radiusTop: 0.8, radiusBottom: rb, length: len, color: '#ffd8a0', opacity: 0 }); b.position.set(x, VH * 0.6, 0.3); b.rotation.set(-Math.PI / 2 + 0.35 + tilt, yaw, 0); temple.add(b); veilBeams.push(b); });
  const gapGlow = lib.glow('#ffcf90', 18, 0); gapGlow.position.set(0, VH * 0.6, 0.5); temple.add(gapGlow);
  const templeL = new THREE.PointLight('#ffc888', 0, 60, 1.2); templeL.position.set(0, 8, 3); temple.add(templeL);
  const quakeDust = lib.motes({ count: 900, box: [26, 24, 24], center: [0, 12, 10], size: 2.5, color: '#e8c898', kind: 'snow', speed: 0.6, opacity: 0 }); temple.add(quakeDust);

  const groups = [city, supper, golg, temple];
  const show = (g) => groups.forEach((x) => (x.visible = x === g));
  const tmpV = new THREE.Vector3();
  return {
    scene, camera,
    update(t, S) {
      const P = S.post;
      sun.castShadow = false;
      if (t < T2) {
        show(city);
        const isDay = t < T1; day.visible = isDay; night.visible = !isDay;
        if (isDay) {
          setSky('#5a8ac8', '#f0d6a8', '#c8a878', [0.5, 0.35, -1], '#fff2d8', 0.03, 0.8);
          scene.fog.color.set('#e8d4b0'); scene.fog.density = 0.0018;
          hemi.color.set('#b8cce8'); hemi.groundColor.set('#6a4a30'); hemi.intensity = 0.75; sun.color.set('#ffe6c0'); sun.intensity = 3.0; sun.position.set(30, 34, 10); sun.target.position.set(0, 0, -6); sun.castShadow = true;
          const z = lerp(-19, -2, t / T1);
          ass.position.set(0, roadH(0, z), z); ass.rotation.y = 0;
          ass.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 5.5 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.35));
          ass.position.y += Math.abs(Math.sin(t * 5.5)) * 0.04;
          followers.forEach((f, i) => { const fz = z - 2.2 - Math.floor(i / 2) * 1.3; f.position.set((i % 2 ? 0.9 : -0.9), roadH(0, fz), fz); f.rotation.y = 0; walkPose(f, t * 0.9 + i * 0.3, 0.8); });
          sideCrowd.pose(t, 1.5, 0, 0.5);
          const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
          frondData.forEach((d, i) => { const wv = Math.sin(t * 6 + d.ph * 3) * 0.6; e.set(0, (d.ry || 0) + Math.PI / 2 * Math.sign(d.x), wv * 0.6 + Math.sign(-d.x) * 0.3, 'YXZ');
            q.setFromEuler(e); v.set(d.x - Math.sign(d.x) * 0.15, d.y + 1.55 * d.s + Math.abs(wv) * 0.1, d.z); sc.setScalar(d.s); m4.compose(v, q, sc); fronds.setMatrixAt(i, m4); });
          fronds.instanceMatrix.needsUpdate = true;
          cameraPath(camera, [[0, [2.0, 2.0, 20], [0, 6.0, -20]], [T1, [1.2, 1.7, 13], [0, 4.2, -12]]], t);
          handheld(camera, t, 0.008);
          P.exposure = 0.95; P.bloom = 0.45; P.bloomThreshold = 0.85; P.tint = [1.04, 1.0, 0.94]; P.vignette = 0.38;
        } else {
          const ls = t - T1;
          setSky('#0a0406', '#3a120a', '#080404', [0, -0.3, -1], '#000', 0.01, 0, 0.2);
          scene.fog.color.set('#1c0a08'); scene.fog.density = 0.02;
          hemi.color.set('#3a2a3a'); hemi.groundColor.set('#100808'); hemi.intensity = 0.35; sun.intensity = 0.25; sun.color.set('#6a7aa8'); sun.position.set(-20, 30, -40);
          mob.pose(t, 1.2, ramp(ls, 0.0, 0.8) * 0.6 + ramp(ls, 2.8, 0.6) * 0.4, 0.4 + ramp(ls, 2.8, 0.5) * 0.6);
          torchLs.forEach((L, i) => (L.intensity = 22 * (1 + Math.sin(t * 9 + i * 2.1) * 0.1 + Math.sin(t * 15.3 + i) * 0.05)));
          cameraPath(camera, [[0, [2, 6.5, 16], [0, 1.6, -6]], [T2 - T1, [1, 5.2, 12.5], [0, 1.8, -6]]], ls);
          handheld(camera, t, 0.012);
          P.exposure = 0.95; P.bloom = 0.6; P.bloomThreshold = 0.7; P.tint = [1.04, 0.95, 0.92]; P.sat = 0.85; P.vignette = 0.55; P.contrast = 1.06;
        }
      } else if (t < T3) {
        show(supper);
        const ls = t - T2;
        setSky('#0a1020', '#101828', '#05060a', [0, -1, 0], '#000', 0.01, 0);
        scene.fog.color.set('#120c08'); scene.fog.density = 0.02;
        hemi.color.set('#4a5a80'); hemi.groundColor.set('#1a100a'); hemi.intensity = 0.3; sun.intensity = 0.0;
        candles.forEach(([a, b], i) => { const f = 1 + Math.sin(t * 11 + i * 2) * 0.08 + Math.sin(t * 17 + i) * 0.05; a.scale.setScalar(0.32 * f); b.scale.setScalar(1.5 * f); });
        candleLs.forEach((L, i) => (L.intensity = 6 * (1 + Math.sin(t * 9 + i * 3) * 0.08)));
        bcGlow.material.opacity = 0.35 + ramp(ls, 1.0, 1.5) * 0.25;
        cameraPath(camera, [[0, [0.8, 2.0, 9.0], [0, 1.35, -1]], [T3 - T2, [0.3, 1.85, 6.6], [0, 1.3, -1]]], ls);
        handheld(camera, t, 0.005);
        P.exposure = 1.05; P.bloom = 0.8; P.bloomThreshold = 0.6; P.tint = [1.05, 0.98, 0.92]; P.vignette = 0.5;
      } else if (t < T5) {
        show(golg);
        const ls = t - T3; const dark = ramp(t, T3 + 3.8, 3.5); const fin = t >= T4;
        const top = new THREE.Color('#5a4a48').lerp(new THREE.Color('#0c0a0e'), dark);
        const hor = new THREE.Color('#c08050').lerp(new THREE.Color('#3a1c14'), dark);
        if (fin) { top.set('#040306'); hor.set('#0e0806'); }
        // молния
        const L1 = fin ? Math.max(0, 1 - Math.abs(t - (T4 + 0.32)) / 0.09) + 0.6 * Math.max(0, 1 - Math.abs(t - (T4 + 0.5)) / 0.06) : 0;
        top.lerp(new THREE.Color('#5a6688'), L1 * 0.8); hor.lerp(new THREE.Color('#8a90b0'), L1 * 0.6);
        setSky('#000', '#000', '#000', SUN_DIR.toArray(), '#000', 0.01, 0);
        sky.u.top.value.copy(top); sky.u.horizon.value.copy(hor); sky.u.bottom.value.copy(hor).multiplyScalar(0.4);
        scene.fog.color.copy(hor).multiplyScalar(0.8); scene.fog.density = 0.0035;
        hemi.color.set('#8a7a7a'); hemi.groundColor.set('#2a1a10'); hemi.intensity = lerp(0.6, 0.12, dark) + L1 * 0.8; sun.intensity = lerp(1.2, 0.1, dark); sun.color.set('#ffb070'); sun.position.copy(SUN_DIR).multiplyScalar(100);
        eclipse.visible = !fin; corona.material.opacity = lerp(0.9, 0.6, dark); corona2.material.opacity = lerp(0.3, 0.12, dark);
        moonDisc.lookAt(0, 0, 0);
        clouds.drift(t, 6, 0); clouds.setOpacity(lerp(0.5, 1, dark)); clouds.setColor(fin ? '#14121a' : new THREE.Color('#5a4a40').lerp(new THREE.Color('#1a1418'), dark));
        wind.u.opacity.value = 0.5 * (1 - dark * 0.5); wind.u.color.value.set(fin ? '#4a4a5a' : '#b89a7a');
        bolt.visible = fin && L1 > 0.05; bolt.m.opacity = L1; boltGlow.material.opacity = L1 * 0.5;
        if (!fin) {
          cameraPath(camera, [[0, [-5, 3.0, 44], [0, 13.5, -20]], [T4 - T3, [-3, 3.4, 34], [0, 14.0, -20]]], ls);
          handheld(camera, t, 0.006 + dark * 0.004);
          P.exposure = 1.0; P.bloom = 0.7; P.bloomThreshold = 0.65; P.tint = [1.05, 0.96, 0.9]; P.vignette = 0.5;
        } else {
          cameraPath(camera, [[0, [0, 2.0, 50], [0, 21, -20]], [T5 - T4, [0, 2.2, 47], [0, 21.5, -20]]], t - T4);
          handheld(camera, t, 0.004);
          P.exposure = 1.0; P.bloom = 0.9; P.bloomThreshold = 0.5; P.tint = [0.95, 0.97, 1.05]; P.vignette = 0.6;
          P.flash = L1 * 0.08; S.quote.y = 0.36;
        }
      } else {
        show(temple);
        const ls = t - T5; const tearK = ramp(t, T5 + 1.2, 3.6); const openK = ramp(t, T5 + 1.6, 4.5);
        setSky('#000', '#000', '#000', [0, -1, 0], '#000', 0.01, 0); sky.visible = false;
        scene.fog.color.set('#0e0806'); scene.fog.density = 0.012;
        hemi.color.set('#5a4a40'); hemi.groundColor.set('#100a08'); hemi.intensity = 0.35; sun.intensity = 0;
        veilU.tear.value = tearK; veilU.open.value = openK; veilU.light.value = ramp(t, T5 + 1.2, 1);
        const lightK = Math.min(1, tearK * 1.4) * (0.6 + 0.4 * openK);
        behindU.k.value = 0.55 + 0.4 * lightK;
        veilBeams.forEach((b, i) => (b.u.opacity.value = lightK * (i ? 0.07 : 0.11)));
        gapGlow.material.opacity = lightK * 0.12; gapGlow.position.y = VH * (1 - tearK * 0.5); gapGlow.scale.setScalar(10 + lightK * 14);
        templeL.intensity = lightK * 90;
        const quake = ramp(t, T5 + 1.1, 0.4) * (1 - ramp(t, T5 + 5.2, 1.5));
        quakeDust.u.opacity.value = quake * 0.6 + lightK * 0.2;
        cameraPath(camera, [[0, [0, 3.0, 34], [0, 9.5, 0]], [S.dur - T5, [0, 2.4, 25], [0, 9.0, 0]]], ls);
        camera.position.x += lib.noise2(t * 9, 1.3) * 0.25 * quake; camera.position.y += lib.noise2(t * 11, 5.1) * 0.2 * quake;
        handheld(camera, t, 0.006 + quake * 0.03);
        P.exposure = 0.9; P.bloom = 0.5 + lightK * 0.2; P.bloomThreshold = 0.8; P.tint = [1.04, 0.97, 0.92]; P.vignette = 0.5;
        P.flash = ramp(t, T5 + 1.15, 0.1) * (1 - ramp(t, T5 + 1.25, 0.5)) * 0.25;
      }
      if (!(t >= T5)) sky.visible = true;
    },
  };
}
