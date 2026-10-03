// Служение: Галилея утром → хождение по воде (ночь) → вечер среди людей (истории) → Нагорная проповедь
// (золотой час) → гробница Лазаря в сумерках → «Иисус прослезился» → Лазарь выходит → холодный город с факелами.
export default function build({ THREE, lib, W, H, meta }) {
  const { ramp, lerp, clamp, cameraPath, handheld, rng, walkPose } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 4000);
  scene.fog = new THREE.FogExp2('#c8b8a0', 0.004);
  const C = meta.cues;
  const T1 = C.water, T2 = C.water + 2.85, T3 = C.blessed, T4 = C.tomb, T5 = C.wept, T6 = C.lazarus, T7 = C.lazarus + 3.85;
  const T2B = T2 + 4.6;

  const sky = lib.skyDome({ radius: 2000 }); scene.add(sky);
  const setSky = (top, hor, bot, sd, sc, size, glow, stars = 0) => {
    sky.u.top.value.set(top); sky.u.horizon.value.set(hor); sky.u.bottom.value.set(bot); sky.u.sunDir.value.set(...sd).normalize();
    sky.u.sunColor.value.set(sc); sky.u.sunSize.value = size; sky.u.sunGlow.value = glow; sky.u.starAmt.value = stars;
  };
  const hemi = new THREE.HemisphereLight('#bcd0e8', '#3a2c20', 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd8a8', 2); scene.add(sun); scene.add(sun.target);

  // ---------- общие кирпичики ----------
  const robeCols = ['#5a4636', '#6b5440', '#4a3a30', '#7a6248', '#3e3a36', '#6a5a4a', '#8a7258', '#5c4a3e', '#4e4238', '#7a5a40'];
  function crowd({ count, seed, place, palette = robeCols, skinK = 0.45 }) {
    const r = rng(seed); const grp = new THREE.Group();
    const profS = [[0, 0], [0.36, 0], [0.33, 0.25], [0.27, 0.7], [0.22, 1.05], [0.25, 1.32], [0.19, 1.42], [0.08, 1.48], [0, 1.48]].map(([x, y]) => new THREE.Vector2(x, y));
    const profC = [[0, 0], [0.46, 0], [0.47, 0.1], [0.4, 0.2], [0.24, 0.27], [0.2, 0.55], [0.23, 0.78], [0.17, 0.87], [0.07, 0.92], [0, 0.92]].map(([x, y]) => new THREE.Vector2(x, y));
    const data = []; for (let i = 0; i < count; i++) { const p = place(i, r); p.ph = r() * 20; p.s = p.s || (0.9 + r() * 0.2); p.c1 = r(); p.c2 = r(); p.c3 = r(); data.push(p); }
    const kinds = [data.filter((d) => !d.seated), data.filter((d) => d.seated)];
    const mk = (prof, n) => { const b = new THREE.InstancedMesh(new THREE.LatheGeometry(prof, 9), new THREE.MeshStandardMaterial({ roughness: 0.92 }), Math.max(n, 1)); b.count = n; b.frustumCulled = false; grp.add(b); return b; };
    const bodies = [mk(profS, kinds[0].length), mk(profC, kinds[1].length)];
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.9 }), count); head.frustumCulled = false; grp.add(head);
    const c = new THREE.Color(); let hi = 0;
    kinds.forEach((list, k) => list.forEach((d, i) => {
      c.set(palette[Math.floor(d.c1 * palette.length)]).multiplyScalar(0.8 + d.c2 * 0.4); bodies[k].setColorAt(i, c);
      if (d.c3 < skinK) c.set('#7a4e34'); else c.multiplyScalar(1.15); head.setColorAt(hi++, c);
    }));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const pose = (t, amt = 1) => {
      let hi = 0;
      kinds.forEach((list, k) => list.forEach((d, i) => {
        const sw = Math.sin(t * 1.1 + d.ph) * 0.025 * amt; const s = d.s; const lean = d.lean || 0, ry = d.ry || 0;
        e.set(lean, ry, sw); q.setFromEuler(e); sc.set(s, s, s); v.set(d.x, d.y, d.z); m4.compose(v, q, sc); bodies[k].setMatrixAt(i, m4);
        const hh = ((k ? 0.92 : 1.48) + 0.1) * s;
        v.set(d.x - Math.sin(sw) * hh * Math.cos(ry) + Math.sin(ry) * lean * hh, d.y + hh, d.z + Math.sin(sw) * hh * Math.sin(ry) + Math.cos(ry) * lean * hh);
        sc.set(s, s * 1.12, s); m4.compose(v, q, sc); head.setMatrixAt(hi++, m4);
      }));
      bodies.forEach((b) => (b.instanceMatrix.needsUpdate = true)); head.instanceMatrix.needsUpdate = true;
    };
    pose(0); return Object.assign(grp, { pose, data });
  }
  const jesusFig = (glow = 0) => lib.figure({ height: 1.82, robe: '#e9e3d6', hoodColor: '#f2ede2', skin: '#9a6a4a', belt: '#b8a888', glow, seed: 11 });
  function boatMesh() {
    const g = new THREE.Group(); const wood = new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.9 });
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), wood); hull.scale.set(3.6, 0.9, 1.15); hull.position.y = 0.45; g.add(hull);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 28), wood); rim.rotation.x = Math.PI / 2; rim.scale.set(3.6, 1.15, 1); rim.position.y = 0.46; g.add(rim);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4.6, 6), wood); mast.position.set(0.6, 2.6, 0); g.add(mast);
    const sailG = new THREE.BufferGeometry(); sailG.setAttribute('position', new THREE.Float32BufferAttribute([0.6, 4.8, 0, 0.6, 1.0, 0, -1.8, 1.1, 0], 3)); sailG.computeVertexNormals();
    const sail = new THREE.Mesh(sailG, new THREE.MeshStandardMaterial({ color: '#cbbb9c', roughness: 1, side: THREE.DoubleSide })); g.add(sail);
    return g;
  }
  const clay = new THREE.MeshStandardMaterial({ color: '#8a6e52', roughness: 0.95 });
  const clay2 = new THREE.MeshStandardMaterial({ color: '#76604a', roughness: 0.95 });
  function houses(grp, n, seed, region, hFn = () => 0, opts = {}) {
    const r = rng(seed); const box = new THREE.BoxGeometry(1, 1, 1); const winG = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < n; i++) {
      const [x, z, ry] = region(i, r); const w = (opts.w || 4) + r() * 3, h = (opts.h || 3) + r() * (opts.hv || 3), d = (opts.d || 4) + r() * 3;
      const m = new THREE.Mesh(box, opts.mat ? opts.mat[i % opts.mat.length] : (r() < 0.5 ? clay : clay2)); m.scale.set(w, h, d); m.position.set(x, hFn(x, z) + h / 2 - 0.3, z); m.rotation.y = ry; grp.add(m);
      const roof = new THREE.Mesh(box, m.material); roof.scale.set((w + 0.3) / w, 0.22 / h, (d + 0.3) / d); roof.position.y = 0.5; m.add(roof);
      if (opts.win && r() < 0.6) { const wm = new THREE.Mesh(winG, opts.win); wm.scale.set(0.5 / w, 0.7 / h, 1); wm.position.set((r() - 0.5) * 0.5, -0.05, 0.502); m.add(wm); }
    }
  }
  // скала с гробницей (передняя грань в z = 0)
  function tombRock(seed, opts = {}) {
    const g = new THREE.Group(); const Wd = opts.w || 22, Hh = opts.h || 9;
    const geo = new THREE.BoxGeometry(Wd, Hh, 8, 40, 18, 6); const p = geo.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const n = lib.fbm(v.x * 0.18 + seed, v.y * 0.22 + v.z * 0.1, 4);
      const top = clamp((v.y + Hh / 2) / Hh);
      v.z += n * 0.9 + (v.z > 0 ? 0 : 0); v.x += lib.fbm(v.y * 0.2, v.z * 0.2 + seed, 3) * 1.2;
      v.y += lib.fbm(v.x * 0.15, v.z * 0.15 + seed * 2, 4) * 2.2 * top * top;
      if (v.z > 3.9) { const dx = Math.abs(v.x), dy = v.y + Hh / 2; if (dx < 2.6 && dy < 4.2) v.z -= (1 - Math.max(dx / 2.6, dy / 4.2)) * 0.6; }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    { const cols = new Float32Array(p.count * 3); const base = new THREE.Color(opts.color || '#8a7a66'), cc = new THREE.Color();
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = 0.7 + 0.25 * lib.noise2(x * 0.5, y * 0.5 + z * 0.3) + 0.12 * Math.sin(y * 3.1 + lib.noise2(x * 0.2, 0) * 3) - clamp(-y / Hh * 0.6);
        cc.copy(base).multiplyScalar(k); cols.set([cc.r, cc.g, cc.b], i * 3); }
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); }
    const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); rock.position.set(0, Hh / 2 - 0.4, -4); g.add(rock);
    const sh = new THREE.Shape(); sh.moveTo(-0.95, 0); sh.lineTo(0.95, 0); sh.lineTo(0.95, 1.7); sh.absarc(0, 1.7, 0.95, 0, Math.PI, false); sh.lineTo(-0.95, 0);
    const doorMat = new THREE.MeshBasicMaterial({ color: '#000000' });
    const door = new THREE.Mesh(new THREE.ShapeGeometry(sh, 16), doorMat); door.position.set(0, 0, 0.55); g.add(door);
    const frame = new THREE.Mesh(new THREE.ShapeGeometry(sh, 16), new THREE.MeshStandardMaterial({ color: '#5a4e40', roughness: 1 })); frame.scale.set(1.35, 1.18, 1); frame.position.set(0, -0.05, 0.5); g.add(frame);
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.45, 28), new THREE.MeshStandardMaterial({ color: '#7a6c5a', roughness: 1 }));
    stone.rotation.x = Math.PI / 2; stone.position.set(0, 1.5, 1.0); g.add(stone);
    const groove = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.3, 1.2), new THREE.MeshStandardMaterial({ color: '#5e5244', roughness: 1 })); groove.position.set(1.2, -0.1, 1.0); g.add(groove);
    return Object.assign(g, { door, doorMat, stone });
  }

  // ================= 1. Галилея: утро =================
  const sea = lib.ocean({ size: 1200, seg: 150, deep: '#2a4a5a', shallow: '#4a7a80', sky: '#d8c8b0', amp: 0.15, choppy: 0.8, foam: 0, sunDir: [-0.5, 0.12, -1], sunColor: '#ffe0b0' });
  sea.u.fogDensity.value = 0.003; scene.add(sea);
  const lakeH = (x, z) => {
    const near = Math.min(-0.7 + z * 0.13, 0.85 + (z - 12) * 0.03) + lib.fbm(x * 0.05, z * 0.05, 3) * 0.5;
    const farK = clamp((-z - 200) / 120); const far = -3 + farK * (18 + lib.fbm(x * 0.006, z * 0.006, 5) * 40) + farK * clamp((-z - 330) / 200) * 30;
    return Math.max(near, far, -3.5);
  };
  const lakeLand = lib.terrain({ size: 1400, seg: 140, center: [0, -250], heightFn: lakeH,
    colorFn: (x, z, y, sl) => (z > -50 ? new THREE.Color('#9c8a6a').lerp(new THREE.Color('#5d6a3a'), clamp((y - 0.6) / 2)) : new THREE.Color('#58663e').lerp(new THREE.Color('#7a6a4c'), clamp(sl * 2 + lib.noise2(x * 0.02, z * 0.02) * 0.3))) });
  scene.add(lakeLand);
  const G1 = new THREE.Group(); scene.add(G1);
  const walkers = [];
  { const cols = ['#5a4636', '#6b5440', '#7a6248', '#4e4238', '#8a7258', '#5c4a3e'];
    const j = jesusFig(); G1.add(j); walkers.push(j);
    for (let i = 0; i < 6; i++) { const f = lib.figure({ height: 1.7 + (i % 3) * 0.06, robe: cols[i], seed: 20 + i, hood: i % 2 === 0, staff: i === 3 }); G1.add(f); walkers.push(f); } }
  const boat1 = boatMesh(); boat1.position.set(-4, -0.05, -34); boat1.rotation.y = 0.3; G1.add(boat1);
  { const f1 = lib.figure({ height: 1.7, robe: '#4a3a30', seed: 31, hood: false }); f1.position.set(-0.8, 0.2, 0); boat1.add(f1); const f2 = lib.figure({ height: 1.75, robe: '#6a5a4a', seed: 32 }); f2.position.set(1.6, 0.2, 0.2); f2.rotation.y = 1.4; f2.parts.arms.forEach((a) => (a.rotation.x = -1.0)); boat1.add(f2); }
  const mist1 = lib.motes({ count: 400, box: [120, 8, 80], center: [0, 3, -40], size: 14, color: '#fff2dc', speed: 0.15, opacity: 0.25 }); G1.add(mist1);

  // ================= 2a. Ночь, по воде =================
  const G2 = new THREE.Group(); scene.add(G2);
  const boat2 = boatMesh(); boat2.position.set(44.5, -0.1, -66); boat2.rotation.y = -0.35; G2.add(boat2);
  const disc = []; for (let i = 0; i < 4; i++) { const f = lib.figure({ height: 1.72, robe: ['#3a3029', '#4a3a30', '#2e2a28', '#4e4238'][i], seed: 40 + i, hood: i !== 1 }); f.position.set(-1.8 + i * 1.1, 0.25, (i % 2) * 0.3 - 0.15); f.rotation.y = Math.PI * 0.85 - i * 0.1; boat2.add(f); disc.push(f); }
  const lantern2 = new THREE.Group(); lantern2.position.set(2.2, 1.6, 0.2); boat2.add(lantern2);
  lantern2.add(lib.glow('#ffb860', 1.6, 0.95)); lantern2.add(lib.glow('#ff9a40', 6, 0.18));
  const lanternL2 = new THREE.PointLight('#ffa050', 18, 18, 1.6); lantern2.add(lanternL2);
  const walkerW = jesusFig(0.35); walkerW.parts.robeMat.emissive.set('#cfd8ff'); walkerW.parts.robeMat.emissiveIntensity = 0.25; G2.add(walkerW);
  const poolMat = new THREE.MeshBasicMaterial({ map: (() => { const t = lib.glow().material.map; return t; })(), color: '#9fb8e0', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), poolMat); pool.rotation.x = -Math.PI / 2; pool.scale.set(7, 7, 1); G2.add(pool);
  const walkLight = new THREE.PointLight('#cfdcff', 10, 14, 1.6); G2.add(walkLight);
  const mist2 = lib.motes({ count: 500, box: [50, 3, 60], center: [50, 1.0, -90], size: 3, color: '#a9bcd8', speed: 0.2, opacity: 0.3 }); G2.add(mist2);
  const stars2 = lib.starfield({ count: 4000, radius: 1800, size: 2.2, minY: 0.03, seed: 12 }); G2.add(stars2);

  // ================= 2b. Вечер: трапеза и истории =================
  const G3 = new THREE.Group(); scene.add(G3);
  const yardH = (x, z) => lib.fbm(x * 0.05, z * 0.05, 3) * 0.3;
  G3.add(lib.terrain({ size: 160, seg: 60, heightFn: yardH, color: '#4a3a2c' }));
  houses(G3, 22, 7, (i, r) => { const a = i / 22 * Math.PI * 2 + r() * 0.2; const R = 16 + r() * 8; return [Math.cos(a) * R, Math.sin(a) * R, -a + Math.PI / 2]; }, yardH, { h: 3, hv: 3, win: new THREE.MeshBasicMaterial({ color: '#ff9c48' }) });
  const fire3 = lib.fire({ count: 400, radius: 0.4, height: 1.3, size: 12, intensity: 0.7 }); fire3.position.set(0, 0.05, 0); G3.add(fire3);
  const fireL3 = new THREE.PointLight('#ff9040', 12, 26, 1.5); fireL3.position.set(0, 1.0, 0); G3.add(fireL3);
  const fireGlow3 = lib.glow('#ff9a40', 4, 0.18); fireGlow3.position.set(0, 0.8, 0); G3.add(fireGlow3);
  const listeners = crowd({ count: 120, seed: 5, place: (i, r) => {
    const ring = i < 26 ? 0 : 1; const a = (i < 26 ? i / 26 : (i - 26) / 94) * Math.PI * 2 + r() * 0.15;
    const R = ring === 0 ? 3.0 + r() * 0.6 : 5 + r() * 6;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    if (R < 11 && a > 0.95 && a < 2.05) return { x: 0, y: -50, z: 0, ry: 0 }; // проход к камере
    return { x, y: yardH(x, z), z, ry: Math.atan2(-x, -z) + (r() - 0.5) * 0.4, seated: ring === 0 || r() < 0.35 };
  } });
  G3.add(listeners);
  const teller = jesusFig(); teller.position.set(-1.6, 0, -1.2); teller.rotation.y = 0.75; G3.add(teller);
  const table = new THREE.Group(); table.position.set(1.4, 0, -1.5); G3.add(table);
  { const wood = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.9 }); const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.8), wood); top.position.y = 0.4; table.add(top);
    const bread = new THREE.MeshStandardMaterial({ color: '#b08048', roughness: 0.8 }); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6), bread); b.scale.y = 0.55; b.position.set(-0.5 + i * 0.4, 0.48, 0.05 * i); table.add(b); }
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.16, 10), new THREE.MeshStandardMaterial({ color: '#8a6a3a', roughness: 0.5, metalness: 0.3 })); cup.position.set(0.6, 0.52, 0); table.add(cup);
    [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), wood); l.position.set(x, 0.2, z); table.add(l); }); }
  const embers3 = lib.motes({ count: 120, box: [2, 5, 2], center: [0, 2.6, 0], size: 1.2, color: '#ffb060', speed: 0.6, kind: 'embers', opacity: 0.8 }); G3.add(embers3);
  const stars3 = lib.starfield({ count: 2500, radius: 1800, size: 2, minY: 0.15, seed: 13 }); G3.add(stars3);

  // ================= 3. Нагорная проповедь =================
  const G4 = new THREE.Group(); scene.add(G4);
  const mountH = (x, z) => { const k = clamp((-z + 4) / 46); return k * k * (3 - 2 * k) * 16 - Math.abs(x) * 0.02 * k + lib.fbm(x * 0.04, z * 0.04, 4) * 1.2 - clamp((-z - 46) / 30) * 6; };
  G4.add(lib.terrain({ size: 600, seg: 150, center: [0, -60], heightFn: mountH,
    colorFn: (x, z, y, sl) => new THREE.Color('#6a6a32').lerp(new THREE.Color('#9a8a48'), clamp(lib.noise2(x * 0.08, z * 0.08) * 0.5 + 0.5)).lerp(new THREE.Color('#5a4a30'), sl * 1.5) }));
  const sermonCrowd = crowd({ count: 340, seed: 9, place: (i, r) => {
    const z = -3 - Math.pow(r(), 0.85) * 26; const spread = 7 + (-z) * 0.4; const x = (r() - 0.5) * 2 * spread;
    return { x, y: mountH(x, z) - 0.05, z, ry: Math.PI + Math.atan2(x, 46 + z) * 0.5 + (r() - 0.5) * 0.3, seated: r() < 0.85 };
  } });
  G4.add(sermonCrowd);
  const preacher = jesusFig(0.5); preacher.position.set(0, mountH(0, -42) - 0.05, -42); G4.add(preacher);
  const tree = (x, z, s, grp, hFn, col = '#3a4024') => { const t = new THREE.Group(); t.position.set(x, hFn(x, z), z); t.scale.setScalar(s); grp.add(t);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 2.4, 6), new THREE.MeshStandardMaterial({ color: '#3a2c20', roughness: 1 })); tr.position.y = 1.2; tr.rotation.z = 0.15; t.add(tr);
    const fm = new THREE.MeshStandardMaterial({ color: col, roughness: 1 }); [[0, 2.8, 0, 1.4], [0.9, 2.5, 0.3, 1.0], [-0.8, 2.6, -0.2, 1.1], [0.2, 3.3, -0.3, 0.9]].forEach(([a, b, c2, rr]) => { const s2 = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 1), fm); s2.position.set(a, b, c2); s2.scale.y = 0.7; t.add(s2); });
    return t; };
  [[-14, -38, 1.3], [-22, -20, 1.4], [24, -26, 1.2], [-9, -55, 1.0]].forEach(([x, z, s]) => tree(x, z, s, G4, mountH));
  const motes4 = lib.motes({ count: 600, box: [60, 16, 50], center: [0, 8, -24], size: 4, color: '#ffd890', speed: 0.2, opacity: 0.5 }); G4.add(motes4);

  // ================= 4–6. Гробница Лазаря =================
  const G5 = new THREE.Group(); scene.add(G5);
  const tombH = (x, z) => lib.fbm(x * 0.04, z * 0.04, 4) * 0.8 + clamp((z - 30) / 40) * 3;
  G5.add(lib.terrain({ size: 240, seg: 90, center: [0, 20], heightFn: tombH,
    colorFn: (x, z) => new THREE.Color('#5a4c3a').lerp(new THREE.Color('#6e6040'), clamp(lib.noise2(x * 0.1, z * 0.1) * 0.5 + 0.5)) }));
  const tomb = tombRock(3, { w: 16, h: 7, color: '#9a8670' }); G5.add(tomb);
  { const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4e4434', roughness: 1 })); hill.scale.set(34, 10, 16); hill.position.set(0, 0, -16); G5.add(hill); }
  [[-14, 4, 1.1, '#2e3420'], [13, 6, 1.3, '#2e3420'], [-9, -2, 0.9, '#343a24']].forEach(([x, z, s, c]) => tree(x, z, s, G5, tombH, c));
  // кипарисы
  [[-18, -3, 7], [18, -2, 8], [-21, 1, 6]].forEach(([x, z, h]) => { const cy = new THREE.Mesh(new THREE.ConeGeometry(0.9, h, 8), new THREE.MeshStandardMaterial({ color: '#1e2618', roughness: 1 })); cy.position.set(x, h / 2, z); G5.add(cy); });
  const mourners = []; const mournCols = ['#6a5446', '#5a4a40', '#74604e', '#4e443c', '#665a50', '#5e4c3e', '#7a6656'];
  for (let i = 0; i < 7; i++) {
    const f = lib.figure({ height: 1.65 + (i % 3) * 0.07, robe: mournCols[i], seed: 50 + i, hood: true });
    const a = i / 7; f.position.set(-5.5 + Math.cos(a * 3) * 1.8 + i * 0.35, 0, 5.2 + Math.sin(a * 5) * 1.2); f.rotation.y = -0.4 + Math.sin(i) * 0.4;
    f.parts.head.rotation.x = 0.4; if (f.parts.hood) f.parts.hood.rotation.x = 0.0; if (i % 3 === 0) f.parts.arms[0].rotation.x = -1.4;
    G5.add(f); mourners.push(f);
  }
  const jt = jesusFig(); jt.position.set(4.2, tombH(4.2, 7.5), 7.5); jt.rotation.y = -2.6; G5.add(jt);
  const tombGlow = lib.glow('#ffd8a0', 4, 0); tombGlow.position.set(0, 1.4, 0.8); G5.add(tombGlow);
  const tombBeam = lib.lightBeam({ radiusTop: 0.9, radiusBottom: 5, length: 16, color: '#ffe0b0', opacity: 0 }); tombBeam.position.set(0, 1.4, 0.6); tombBeam.rotation.x = -Math.PI / 2 - 0.12; G5.add(tombBeam);
  const tombL = new THREE.PointLight('#ffd8a0', 0, 18, 1.5); tombL.position.set(0, 1.6, 2.0); G5.add(tombL);
  const lazarus = new THREE.Group(); G5.add(lazarus);
  { const wrap = new THREE.MeshStandardMaterial({ color: '#d8d0bc', roughness: 1, emissive: '#3a3020', emissiveIntensity: 0.3 });
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 1.2, 4, 12), wrap); b.position.y = 0.86; lazarus.add(b);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), wrap); hd.position.y = 1.72; hd.scale.y = 1.15; lazarus.add(hd);
    for (let i = 0; i < 6; i++) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.265, 0.018, 4, 18), new THREE.MeshStandardMaterial({ color: '#b8ae98', roughness: 1 })); band.rotation.x = Math.PI / 2 + 0.25; band.position.y = 0.4 + i * 0.22; lazarus.add(band); } }
  const drops = (() => {
    const N = 60, r = rng(66), p = new Float32Array(N * 3), sd = new Float32Array(N);
    for (let i = 0; i < N; i++) { p.set([(r() - 0.5) * 14, r() * 8, (r() - 0.5) * 8], i * 3); sd[i] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 1));
    const u = { time: { value: 0 }, pxr: { value: 1 }, opacity: { value: 0 } };
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float sd; uniform float time, pxr; varying float vA; void main(){ vec3 q = position; q.y = mod(q.y - time*(1.4+sd*.8), 8.);
        vA = smoothstep(0.,1.,q.y)*smoothstep(8.,6.5,q.y)*(.4+.6*fract(sd*37.)); vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv; gl_PointSize = (2.+sd*3.)*pxr*(14./max(-mv.z,1.)); }`,
      fragmentShader: `uniform float opacity; varying float vA; void main(){ vec2 c = gl_PointCoord-.5; c.x *= 2.2; float a = smoothstep(.5,0.,length(c)); gl_FragColor = vec4(vec3(.8,.88,1.)*a*vA*opacity, 1.); }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.u = u; return pts; })();
  drops.position.set(4, 0, 7); G5.add(drops);

  // ================= 7. Холодный город, факелы =================
  const G6 = new THREE.Group(); scene.add(G6);
  G6.add(lib.terrain({ size: 260, seg: 50, heightFn: (x, z) => lib.fbm(x * 0.05, z * 0.05, 2) * 0.2, color: '#2a2a2e' }));
  const stoneMat = [new THREE.MeshStandardMaterial({ color: '#6e6a66', roughness: 1 }), new THREE.MeshStandardMaterial({ color: '#5a5754', roughness: 1 })];
  houses(G6, 34, 17, (i, r) => { const side = i % 2 ? 1 : -1; const z = -i * 2.4 + r() * 2; return [side * (8.5 + r() * 3), z, (r() - 0.5) * 0.1]; }, () => 0, { h: 6, hv: 6, w: 4, d: 4, mat: stoneMat, win: new THREE.MeshBasicMaterial({ color: '#d0702c' }) });
  houses(G6, 16, 19, (i, r) => [(r() - 0.5) * 70, -50 - r() * 40, (r() - 0.5) * 0.3], () => 0, { h: 8, hv: 10, w: 6, d: 6, mat: stoneMat });
  // храм вдали
  { const tm = stoneMat[0]; const base = new THREE.Mesh(new THREE.BoxGeometry(30, 6, 20), tm); base.position.set(0, 3, -110); G6.add(base);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(14, 18, 12), tm); hall.position.set(0, 15, -112); G6.add(hall);
    for (let i = 0; i < 6; i++) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 12, 8), tm); col.position.set(-6 + i * 2.4, 12, -105.5); G6.add(col); } }
  const torches = []; [[-4.4, 2.6, -6], [4.6, 2.6, -14], [-4.4, 2.6, -24], [1.8, 0.8, -30]].forEach(([x, y, z], i) => {
    const tg = new THREE.Group(); tg.position.set(x, y, z); G6.add(tg);
    const f = lib.fire({ count: 160, radius: 0.15, height: 0.9, size: 22, seed: 70 + i, intensity: 1.2 }); tg.add(f);
    const gl = lib.glow('#ff8a30', 3.2, 0.35); gl.position.y = 0.4; tg.add(gl);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.8, 5), new THREE.MeshStandardMaterial({ color: '#2a1c12' })); stick.position.y = -0.4; tg.add(stick);
    if (i < 3) { const L = new THREE.PointLight('#ff8838', 26, 16, 1.6); L.position.y = 0.6; tg.add(L); torches.push(L); }
  });
  const council = [];
  for (let i = 0; i < 8; i++) {
    const f = lib.figure({ height: 1.75 + (i % 3) * 0.05, robe: ['#1e1e26', '#2a2430', '#24242a', '#302a2a'][i % 4], seed: 80 + i, hood: true, hoodColor: i % 3 === 0 ? '#3a3448' : null });
    const a = i / 8 * Math.PI * 2; f.position.set(1.4 + Math.cos(a) * 2.1, 0, -27 + Math.sin(a) * 1.6); f.rotation.y = -a - Math.PI / 2; G6.add(f); council.push(f);
  }
  { const br = lib.fire({ count: 260, radius: 0.35, height: 1.0, size: 16, seed: 91, intensity: 1.0 }); br.position.set(1.4, 0.7, -27); G6.add(br);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 0.5, 10), new THREE.MeshStandardMaterial({ color: '#2a2420' })); bowl.position.set(1.4, 0.45, -27); G6.add(bowl);
    const bl = new THREE.PointLight('#ff8a3a', 20, 12, 1.5); bl.position.set(1.4, 1.6, -27); G6.add(bl); torches.push(bl);
    const r = rng(93); for (let i = 0; i < 12; i++) { const g = lib.glow('#ff8a30', 2.5, 0.5); g.position.set((r() - 0.5) * 60, 2 + r() * 10, -45 - r() * 60); G6.add(g); } }
  const stars6 = lib.starfield({ count: 2500, radius: 1800, size: 2, minY: 0.1, seed: 14 }); G6.add(stars6);

  const groups = [G1, G2, G3, G4, G5, G6];
  const show = (i) => groups.forEach((g, k) => (g.visible = k === i));
  const tmpC = new THREE.Color();
  return {
    scene, camera,
    update(t, S) {
      const P = S.post; P.ca = 0.0015;
      if (t < T1) {
        // ---- Галилея утром
        show(0); sea.visible = lakeLand.visible = true;
        setSky('#5f88b8', '#f0caa0', '#b8a888', [-0.55, 0.1, -1], '#fff0d0', 0.03, 0.9);
        scene.fog.color.set('#d2c4ae'); scene.fog.density = 0.0016;
        sea.u.deep.value.set('#1e4252'); sea.u.shallow.value.set('#3f7078'); sea.u.skyc.value.set('#b8b8b0'); sea.u.amp.value = 0.12;
        sea.u.sunDir.value.set(-0.55, 0.1, -1).normalize(); sea.u.sunColor.value.set('#ffe0b0'); sea.u.fogColor.value.set('#d2c4ae'); sea.u.fogDensity.value = 0.0016;
        hemi.color.set('#c8d8ec'); hemi.groundColor.set('#5a4a36'); hemi.intensity = 1.0; sun.color.set('#ffe0b8'); sun.intensity = 2.2; sun.position.set(-60, 30, -100); sun.target.position.set(0, 0, 0);
        walkers.forEach((f, i) => {
          const x = -7 + t * 1.05 - i * 1.15 - (i > 0 ? 0.9 : 0) + [0, 0.3, -0.2, 0.5, 0, -0.4, 0.2][i], z = 9.2 + [0, 0.9, -0.6, 1.4, 0.3, -0.2, 1.1][i];
          f.position.set(x, lakeH(x, z), z); f.rotation.y = Math.PI / 2 - 0.05; walkPose(f, t * 0.85 + i * 0.27, 0.9);
        });
        boat1.position.y = -0.05 + Math.sin(t * 1.2) * 0.05; boat1.rotation.z = Math.sin(t * 0.9) * 0.03;
        const jx = -7 + t * 1.05;
        camera.position.set(-12 + t * 0.95, 3.0, 22); camera.lookAt(-8.5 + t * 1.05, 1.5, 3);
        handheld(camera, t, 0.006);
        P.exposure = 0.95; P.bloom = 0.5; P.bloomThreshold = 0.8; P.tint = [1.02, 1.0, 0.96]; P.sat = 0.95; P.vignette = 0.35;
      } else if (t < T2) {
        // ---- ночь: хождение по воде
        show(1); sea.visible = lakeLand.visible = true;
        const ls = t - T1;
        setSky('#02040b', '#1a2236', '#03050a', [0.35, 0.25, -1], '#d8e4ff', 0.018, 0.35, 0.7);
        scene.fog.color.set('#0e1626'); scene.fog.density = 0.004;
        sea.u.deep.value.set('#01040a'); sea.u.shallow.value.set('#0a1a26'); sea.u.skyc.value.set('#1a2438'); sea.u.amp.value = 0.32;
        sea.u.sunDir.value.set(0.35, 0.25, -1).normalize(); sea.u.sunColor.value.set('#9fb4d8').multiplyScalar(0.28); sea.u.fogColor.value.set('#0e1626'); sea.u.fogDensity.value = 0.004;
        hemi.color.set('#5a72a0'); hemi.groundColor.set('#0a0a10'); hemi.intensity = 0.35; sun.color.set('#9fb4e0'); sun.intensity = 0.5; sun.position.set(80, 60, -200);
        const k = ls / (T2 - T1);
        const wp = new THREE.Vector3(lerp(55, 52, k), 0.12 + Math.sin(t * 1.2) * 0.04, lerp(-98, -86, k));
        walkerW.position.copy(wp); walkerW.rotation.y = Math.atan2(45 - wp.x, -66 - wp.z); walkPose(walkerW, t * 0.6, 0.6);
        pool.position.set(wp.x, 0.35, wp.z); walkLight.position.set(wp.x, 2.2, wp.z + 1.5);
        boat2.position.y = -0.1 + Math.sin(t * 1.4) * 0.08; boat2.rotation.z = Math.sin(t * 1.1) * 0.05; boat2.rotation.x = Math.sin(t * 0.8) * 0.03;
        lanternL2.intensity = 18 * (1 + Math.sin(t * 11) * 0.05);
        cameraPath(camera, [[0, [51, 1.4, -48], [50.5, 2.2, -120]], [T2 - T1, [50.5, 1.3, -51], [50.5, 2.0, -120]]], ls);
        handheld(camera, t, 0.012);
        P.exposure = 1.05; P.bloom = 0.9; P.bloomThreshold = 0.55; P.tint = [0.95, 0.99, 1.06]; P.vignette = 0.5;
      } else if (t < T3) {
        // ---- вечер: трапеза, истории, толпы
        show(2); sea.visible = lakeLand.visible = false;
        const ls = t - T2;
        setSky('#141c34', '#b0603a', '#1a1410', [0.8, -0.02, -1], '#ff9050', 0.03, 0.6, 0.35);
        scene.fog.color.set('#2a2028'); scene.fog.density = 0.012;
        hemi.color.set('#4a5a88'); hemi.groundColor.set('#1a120c'); hemi.intensity = 0.45; sun.intensity = 0.4; sun.color.set('#ff9a60'); sun.position.set(60, 10, -60);
        fireL3.intensity = 12 * (1 + Math.sin(t * 9.3) * 0.07 + Math.sin(t * 14.1) * 0.05);
        listeners.pose(t, 0.6);
        teller.parts.arms[1].rotation.x = -0.9 + Math.sin(t * 1.3) * 0.25; teller.parts.arms[1].rotation.z = -0.3; teller.parts.arms[0].rotation.x = -0.3 + Math.sin(t * 0.9 + 1) * 0.15;
        if (t < T2B) cameraPath(camera, [[0, [2.2, 2.3, 10.5], [-0.6, 0.9, -1]], [T2B - T2, [0.6, 2.1, 9.0], [-1.0, 1.0, -1]]], ls);
        else cameraPath(camera, [[0, [-12, 6, 15], [0, 0.8, 0]], [T3 - T2B, [-15, 9, 13], [0, 0.5, -1]]], t - T2B);
        handheld(camera, t, 0.006);
        P.exposure = 1.05; P.bloom = 0.75; P.bloomThreshold = 0.6; P.tint = [1.03, 0.98, 0.95]; P.vignette = 0.45;
      } else if (t < T4) {
        // ---- Нагорная проповедь, золотой час
        show(3); sea.visible = lakeLand.visible = false;
        const ls = t - T3;
        setSky('#3a5a88', '#ffae66', '#7a5a3a', [0.2, 0.24, -1], '#ffe2b0', 0.03, 0.8);
        scene.fog.color.set('#d89a68'); scene.fog.density = 0.005;
        hemi.color.set('#d0c0b0'); hemi.groundColor.set('#4a3a20'); hemi.intensity = 0.55; sun.color.set('#ffc890'); sun.intensity = 2.6; sun.position.set(0, 25, -200); sun.target.position.set(0, 0, 0);
        sermonCrowd.pose(t, 0.5);
        preacher.parts.arms.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * (0.5 + Math.sin(t * 0.6) * 0.05); a.rotation.x = -0.3; });
        cameraPath(camera, [[0, [2.5, 10.5, 6], [0, 15.2, -42]], [T4 - T3, [1.0, 11.0, 0], [0, 15.6, -42]]], ls);
        handheld(camera, t, 0.005);
        S.quote.y = 0.66;
        P.exposure = 0.95; P.bloom = 0.6; P.bloomThreshold = 0.75; P.tint = [1.05, 0.99, 0.92]; P.vignette = 0.45;
      } else if (t < T7) {
        // ---- гробница Лазаря: сумерки → плач → «Лазарь, выйди»
        show(4); sea.visible = lakeLand.visible = false;
        const open = ramp(t, T6 + 0.6, 2.2), shine = ramp(t, T6 + 1.2, 1.6), out = ramp(t, T6 + 2.6, 1.3);
        setSky('#1e2240', '#c8704a', '#1a1414', [-0.4, 0.02, -1], '#ffb070', 0.03, 0.7, 0.15);
        scene.fog.color.set('#3a3040'); scene.fog.density = 0.012;
        hemi.color.set('#8090c0'); hemi.groundColor.set('#3a2a1e'); hemi.intensity = 0.9; sun.color.set('#ffa070'); sun.intensity = 1.9; sun.position.set(-40, 10, 30); sun.target.position.set(0, 0, 0);
        tomb.stone.position.x = lerp(0, 3.4, open); tomb.stone.rotation.y = -open * 2.2;
        tomb.doorMat.color.set('#000').lerp(tmpC.set('#d8a060'), shine * 0.7);
        tombGlow.material.opacity = shine * 0.3; tombGlow.scale.setScalar(3 + shine * 2);
        tombBeam.u.opacity.value = shine * 0.16; tombL.intensity = shine * 14;
        lazarus.visible = t > T6 + 2.4; lazarus.position.set(0, 0, lerp(-1.0, 1.6, out)); lazarus.rotation.x = Math.sin(t * 2) * 0.02;
        jt.parts.head.rotation.x = t < T6 ? 0.5 : 0.1; if (jt.parts.hood) jt.parts.hood.rotation.x = t < T6 ? -0.15 : -0.35;
        jt.parts.arms[1].rotation.x = t > T6 + 0.4 ? -lerp(0, 1.5, ramp(t, T6 + 0.4, 0.8)) : 0;
        drops.u.opacity.value = ramp(t, T5 + 0.2, 1) * (1 - ramp(t, T6 - 0.4, 0.6));
        if (t < T5) {
          cameraPath(camera, [[0, [13, 2.8, 27], [-0.5, 2.6, 0]], [T5 - T4, [11, 2.6, 24], [-1, 2.5, 0]]], t - T4);
          P.exposure = 1.0;
        } else if (t < T6) {
          // крупнее, тихо: фигура слева, голова склонена
          cameraPath(camera, [[0, [8.6, 2.1, 14.0], [5.4, 1.7, 6.0]], [T6 - T5, [8.2, 2.05, 13.3], [5.1, 1.7, 5.6]]], t - T5);
          P.exposure = 0.9; scene.fog.density = 0.02;
        } else {
          cameraPath(camera, [[0, [8.5, 2.1, 18], [1.0, 1.9, 0]], [T7 - T6, [7.2, 2.0, 16.5], [0.6, 1.8, 0]]], t - T6);
          P.exposure = 1.0;
        }
        handheld(camera, t, 0.005);
        P.bloom = 0.7 + shine * 0.3; P.bloomThreshold = 0.6; P.tint = [1.0, 0.97, 1.0]; P.vignette = 0.48;
      } else {
        // ---- холодный город
        show(5); sea.visible = lakeLand.visible = false;
        const ls = t - T7;
        setSky('#050a18', '#2a3a5e', '#040508', [0.3, 0.4, -1], '#cfd8ff', 0.012, 0.3, 0.5);
        scene.fog.color.set('#16223a'); scene.fog.density = 0.016;
        hemi.color.set('#5a6c9e'); hemi.groundColor.set('#0a0a10'); hemi.intensity = 0.9; sun.color.set('#9ab0e8'); sun.intensity = 1.0; sun.position.set(30, 60, -40); sun.target.position.set(0, 0, -20);
        torches.forEach((L, i) => (L.intensity = 26 * (1 + Math.sin(t * 10 + i * 2) * 0.08)));
        cameraPath(camera, [[0, [0.5, 4.5, 8], [0.6, 2.2, -28]], [S.dur - T7, [0.8, 3.0, -6], [1.2, 1.6, -28]]], ls);
        handheld(camera, t, 0.006);
        P.exposure = 1.0; P.bloom = 0.8; P.bloomThreshold = 0.55; P.tint = [0.94, 0.98, 1.08]; P.sat = 0.85; P.vignette = 0.55;
      }
    },
  };
}
