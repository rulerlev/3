// Воскресение: синий предрассветный сад, женщины с лампадами, камень отвален →
// из пустой гробницы льётся свет, встаёт солнце («Его нет здесь») → ученики бегут по холмам, длинные тени.
export default function build({ THREE, lib, W, H, meta }) {
  const { ramp, lerp, clamp, cameraPath, handheld, rng, walkPose } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 4000);
  scene.fog = new THREE.FogExp2('#2a3a5a', 0.012);
  const C = meta.cues;
  const T1 = C.risen, T2 = C.go;

  const sky = lib.skyDome({ radius: 2000 }); scene.add(sky);
  const setSky = (top, hor, bot, sd, sc, size, glow, stars = 0) => {
    sky.u.top.value.set(top); sky.u.horizon.value.set(hor); sky.u.bottom.value.set(bot); sky.u.sunDir.value.set(...sd).normalize();
    sky.u.sunColor.value.set(sc); sky.u.sunSize.value = size; sky.u.sunGlow.value = glow; sky.u.starAmt.value = stars;
  };
  const hemi = new THREE.HemisphereLight('#7a90c0', '#1a1a20', 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd0a0', 0); scene.add(sun); scene.add(sun.target);
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 200 }); sun.shadow.bias = -0.0006;

  const tree = (x, z, s, grp, hFn, col = '#2e3420') => { const t = new THREE.Group(); t.position.set(x, hFn(x, z), z); t.scale.setScalar(s); grp.add(t);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 2.4, 6), new THREE.MeshStandardMaterial({ color: '#3a2c20', roughness: 1 })); tr.position.y = 1.2; tr.rotation.z = 0.15; t.add(tr);
    const fm = new THREE.MeshStandardMaterial({ color: col, roughness: 1 }); [[0, 2.8, 0, 1.4], [0.9, 2.5, 0.3, 1.0], [-0.8, 2.6, -0.2, 1.1], [0.2, 3.3, -0.3, 0.9]].forEach(([a, b, c2, rr]) => { const s2 = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 1), fm); s2.position.set(a, b, c2); s2.scale.y = 0.7; t.add(s2); });
    return t; };

  // ================= сад и гробница =================
  const garden = new THREE.Group(); scene.add(garden);
  const gH = (x, z) => lib.fbm(x * 0.04, z * 0.04, 4) * 0.7 + clamp((-z - 8) / 30) * 6 + clamp((Math.abs(x) - 18) / 30) * 4;
  garden.add(lib.terrain({ size: 300, seg: 110, center: [0, 10], heightFn: gH,
    colorFn: (x, z, y, sl) => { const path = Math.exp(-Math.pow((x - 1.2 - Math.sin(z * 0.15) * 1.0) / 1.4, 2)) * (z > 0 ? 1 : 0); return new THREE.Color('#4a5236').lerp(new THREE.Color('#6a5a40'), clamp(lib.noise2(x * 0.15, z * 0.15) * 0.5 + 0.5) * 0.6 + path * 0.6); } }));
  // скала
  const Wd = 18, Hh = 8;
  {
    const geo = new THREE.BoxGeometry(Wd, Hh, 8, 40, 18, 6); const p = geo.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const n = lib.fbm(v.x * 0.18 + 5, v.y * 0.22 + v.z * 0.1, 4); const top = clamp((v.y + Hh / 2) / Hh);
      v.z += n * 0.9; v.x += lib.fbm(v.y * 0.2, v.z * 0.2 + 5, 3) * 1.2; v.y += lib.fbm(v.x * 0.15, v.z * 0.15 + 10, 4) * 2.2 * top * top;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const cols = new Float32Array(p.count * 3); const base = new THREE.Color('#9a8a74'), cc = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 0.72 + 0.25 * lib.noise2(x * 0.5, y * 0.5 + z * 0.3) + 0.1 * Math.sin(y * 3.1 + lib.noise2(x * 0.2, 0) * 3) - clamp(-y / Hh * 0.6); cc.copy(base).multiplyScalar(k); cols.set([cc.r, cc.g, cc.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); rock.position.set(0, Hh / 2 - 0.4, -4); rock.castShadow = rock.receiveShadow = true; garden.add(rock);
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#3e4430', roughness: 1 })); hill.scale.set(30, 11, 14); hill.position.set(0, 0, -14); garden.add(hill);
  }
  const doorShape = new THREE.Shape(); doorShape.moveTo(-0.95, 0); doorShape.lineTo(0.95, 0); doorShape.lineTo(0.95, 1.7); doorShape.absarc(0, 1.7, 0.95, 0, Math.PI, false); doorShape.lineTo(-0.95, 0);
  const doorMat = new THREE.MeshBasicMaterial({ color: '#000' });
  const door = new THREE.Mesh(new THREE.ShapeGeometry(doorShape, 16), doorMat); door.position.set(0, 0, 0.75); garden.add(door);
  const frame = new THREE.Mesh(new THREE.ShapeGeometry(doorShape, 16), new THREE.MeshStandardMaterial({ color: '#6a5e50', roughness: 1 })); frame.scale.set(1.35, 1.18, 1); frame.position.set(0, -0.05, 0.7); garden.add(frame);
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.45, 28), new THREE.MeshStandardMaterial({ color: '#857664', roughness: 1 })); stone.rotation.set(Math.PI / 2, 0, 0); stone.rotateY(0.25); stone.position.set(3.3, 1.55, 1.25); stone.castShadow = true; garden.add(stone);
  const groove = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 1.2), new THREE.MeshStandardMaterial({ color: '#5e5244', roughness: 1 })); groove.position.set(1.4, -0.08, 1.2); garden.add(groove);
  [[-12, 5, 1.2], [11, 8, 1.4], [-8, 14, 1.0], [14, 18, 1.1], [-16, 20, 1.3]].forEach(([x, z, s]) => tree(x, z, s, garden, gH));
  [[-14, -1, 8], [13.5, 0, 9], [-17, 3, 7], [17, 5, 7.5]].forEach(([x, z, h]) => { const cy = new THREE.Mesh(new THREE.ConeGeometry(0.9, h, 8), new THREE.MeshStandardMaterial({ color: '#1e2618', roughness: 1 })); cy.position.set(x, gH(x, z) + h / 2, z); cy.castShadow = true; garden.add(cy); });
  { const r = rng(9); const bm = new THREE.MeshStandardMaterial({ color: '#2a3420', roughness: 1 }); for (let i = 0; i < 26; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + r() * 0.6, 0), bm); const x = (r() - 0.5) * 30, z = 3 + r() * 22; if (Math.abs(x - 1.2) < 2.5) continue; b.position.set(x, gH(x, z) + 0.2, z); b.scale.y = 0.6; garden.add(b); } }
  // женщины с лампадами
  const women = []; const lamps = [];
  ['#3a4660', '#5a2e2e', '#4e4236'].forEach((col, i) => {
    const f = lib.figure({ height: 1.66 + i * 0.03, robe: col, hoodColor: ['#4a5878', '#6a3a3a', '#625440'][i], seed: 200 + i, hood: true }); f.rotation.order = 'YXZ'; garden.add(f); women.push(f);
    const lamp = new THREE.Group(); lamp.position.set(0.06, -0.6, 0.12); f.parts.arms[1].add(lamp);
    const lg = lib.glow('#ffb860', 0.9, 0.9); lamp.add(lg); const lg2 = lib.glow('#ff9a40', 3.2, 0.18); lamp.add(lg2);
    if (i !== 1) { const L = new THREE.PointLight('#ffa858', 3.5, 9, 1.6); lamp.add(L); lamps.push(L); }
    f.parts.arms[1].rotation.x = -0.75;
  });
  // свет из гробницы
  const tombGlow = lib.glow('#ffd8a0', 5, 0); tombGlow.position.set(0, 1.4, 1.0); garden.add(tombGlow);
  const beams = [[0.12, 0, 3.6, 13, 1], [0.32, 0.38, 2.8, 11, 0.7], [0.32, -0.38, 2.8, 11, 0.7], [0.55, 0.15, 2.4, 10, 0.55], [0.55, -0.2, 2.4, 10, 0.55], [0.05, 0.6, 2.2, 9, 0.5], [0.05, -0.6, 2.2, 9, 0.5]].map(([up, yaw, rb, len, w]) => {
    const b = lib.lightBeam({ radiusTop: 0.55, radiusBottom: rb, length: len, color: '#ffe0b0', opacity: 0 }); b.position.set(0, 1.4, 0.6);
    b.rotation.order = 'YXZ'; b.rotation.set(-Math.PI / 2 - up, yaw, 0); b.userData.w = w; garden.add(b); return b; });
  const tombL = new THREE.PointLight('#ffd0a0', 0, 22, 1.4); tombL.position.set(0, 1.5, 2.6); garden.add(tombL);
  const beamDust = lib.motes({ count: 400, box: [8, 4, 10], center: [0, 1.8, 5], size: 1.4, color: '#fff0d0', speed: 0.15, opacity: 0 }); garden.add(beamDust);
  const stars = lib.starfield({ count: 3000, radius: 1800, size: 2, minY: 0.12, seed: 17 }); garden.add(stars);

  // ================= бег по холмам =================
  const hills = new THREE.Group(); scene.add(hills);
  const hH = (x, z) => lib.fbm(x * 0.012, z * 0.012, 5) * 14 + Math.sin(x * 0.02) * 3 + clamp((-z - 60) / 200) * 30;
  const hillMesh = lib.terrain({ size: 700, seg: 150, center: [0, -150], heightFn: hH,
    colorFn: (x, z, y, sl) => new THREE.Color('#7a6a38').lerp(new THREE.Color('#a8904a'), clamp(lib.noise2(x * 0.05, z * 0.05) * 0.5 + 0.5)).lerp(new THREE.Color('#5a5030'), sl * 1.2) });
  hills.add(hillMesh);
  const runners = [];
  for (let i = 0; i < 6; i++) {
    const f = lib.figure({ height: 1.72 + (i % 3) * 0.05, robe: ['#6a5440', '#7a6248', '#4e5a6a', '#8a7258', '#5a4636', '#6a3a30'][i], seed: 300 + i, hood: i % 2 === 1 });
    f.rotation.order = 'YXZ'; hills.add(f); runners.push(f);
  }
  const runOff = [[0, 0], [-2.2, 1.4], [-3.6, -1.0], [-5.4, 0.8], [-6.8, -0.5], [-8.6, 1.2]];
  const hTrees = []; [[-30, -40, 1.4], [26, -55, 1.2], [60, -20, 1.5], [-55, -10, 1.3]].forEach(([x, z, s]) => hTrees.push(tree(x, z, s, hills, hH, '#4a5028')));
  const hillMotes = lib.motes({ count: 500, box: [80, 12, 60], center: [0, 8, -10], size: 2.5, color: '#ffe0a8', speed: 0.2, opacity: 0.5 }); hills.add(hillMotes);

  const runPath = (t) => { const x = -26 + (t - T2) * 4.4; const z = -2 + Math.sin(x * 0.04) * 3; return [x, z]; };
  const tmpC = new THREE.Color();
  return {
    scene, camera,
    update(t, S) {
      const P = S.post; sun.castShadow = false;
      if (t < T2) {
        garden.visible = true; hills.visible = false;
        const dawn = ramp(t, T1 - 0.6, 4.2); // восход
        const light = ramp(t, T1 - 1.0, 1.4);  // свет из гробницы
        const top = new THREE.Color('#0a1430').lerp(new THREE.Color('#3a5a8a'), dawn);
        const hor = new THREE.Color('#5a6e94').lerp(new THREE.Color('#ffb070'), dawn);
        setSky('#000', '#000', '#000', [0.8, lerp(-0.04, 0.12, dawn), 0.6], '#ffe2b0', 0.03, dawn * 1.0, (1 - dawn) * 0.5);
        sky.u.top.value.copy(top); sky.u.horizon.value.copy(hor); sky.u.bottom.value.copy(hor).multiplyScalar(0.35);
        scene.fog.color.copy(new THREE.Color('#34486e').lerp(new THREE.Color('#b88a68'), dawn)); scene.fog.density = lerp(0.014, 0.011, dawn);
        stars.u.opacity.value = 1 - dawn;
        hemi.color.set('#7a90c0').lerp(tmpC.set('#e0c0a0'), dawn); hemi.groundColor.set('#1a1a22').lerp(tmpC.set('#4a3a28'), dawn); hemi.intensity = lerp(1.1, 0.8, dawn);
        sun.color.set('#ffc080'); sun.intensity = dawn * 3.2; sun.position.set(80, lerp(-6, 12, dawn), 22); sun.target.position.set(0, 0, 0); sun.castShadow = dawn > 0.01;
        doorMat.color.set('#000').lerp(tmpC.set('#f0b070'), light * 0.85);
        tombGlow.material.opacity = light * 0.45; tombGlow.scale.setScalar(5 + light * 4 + Math.sin(t * 2) * 0.2);
        beams.forEach((b, i) => (b.u.opacity.value = light * 0.34 * b.userData.w * (0.85 + 0.15 * Math.sin(t * 1.3 + i * 1.7))));
        tombL.intensity = light * 30; beamDust.u.opacity.value = light * 0.55;
        lamps.forEach((L, i) => (L.intensity = 3.5 * (1 + Math.sin(t * 10 + i * 3) * 0.08) * (1 - dawn * 0.5)));
        // женщины идут к гробнице, потом останавливаются; одна закрывает глаза рукой
        const walkK = clamp(t / (T1 - 0.4));
        women.forEach((f, i) => {
          const z = lerp(17 + i * 1.3, 6.2 + i * 0.6, lib.easeOut(walkK)); const x = 1.2 + Math.sin(z * 0.15) * 1.0 + (i - 1) * 0.95 + lib.ease(walkK) * 1.9;
          f.position.set(x, gH(x, z), z); f.rotation.y = Math.PI + (i - 1) * 0.12; walkPose(f, t * 0.7 + i * 0.4, 0.7 * (1 - walkK * walkK));
          f.parts.arms[1].rotation.x = -0.75;
          if (t > T1 - 0.6 && i === 0) { const k = ramp(t, T1 - 0.6, 0.8); f.parts.arms[0].rotation.x = -lerp(0, 2.3, k); f.parts.arms[0].rotation.z = -lerp(0.12, 0.6, k) * -1; }
          f.rotation.x = t > T1 ? -0.08 * ramp(t, T1, 1) : 0;
        });
        if (t < T1) {
          cameraPath(camera, [[0, [2.2, 2.0, 27], [0.4, 1.8, 0]], [T1, [1.6, 1.8, 15], [0.2, 1.7, 0]]], t);
          handheld(camera, t, 0.006);
          P.exposure = 1.05; P.bloom = 0.8; P.bloomThreshold = 0.6; P.tint = [0.94, 0.98, 1.06]; P.vignette = 0.5;
        } else {
          // боковой план: дверь слева внизу, свет и рассвет; спокойный центр под цитату
          cameraPath(camera, [[0, [-1.5, 1.6, 27], [0.3, 4.6, 0]], [T2 - T1, [-1.0, 1.5, 23], [0.3, 4.6, 0]]], t - T1);
          handheld(camera, t, 0.004);
          P.exposure = 0.95; P.bloom = 0.6; P.bloomThreshold = 0.75; P.tint = [1.04, 0.99, 0.94]; P.vignette = 0.45;
          S.quote.y = 0.32;
        }
      } else {
        garden.visible = false; hills.visible = true;
        const ls = t - T2;
        const sd = [-0.15, 0.07, -1];
        setSky('#3a5a8a', '#ffb070', '#8a6a48', sd, '#ffe6b8', 0.03, 1.1);
        scene.fog.color.set('#e0b080'); scene.fog.density = 0.003;
        hemi.color.set('#d8c8b8'); hemi.groundColor.set('#5a4428'); hemi.intensity = 0.55;
        const [cx, cz] = runPath(t);
        sun.color.set('#ffc890'); sun.intensity = 3.2; sun.castShadow = true;
        sun.position.set(cx - 0.15 * 140, hH(cx, cz) + 0.07 * 140 * 0.9, cz - 140); sun.target.position.set(cx, hH(cx, cz), cz);
        runners.forEach((f, i) => {
          const [ox, oz] = runOff[i]; const x = cx + ox, z = cz + oz + Math.sin(t * 0.7 + i) * 0.2; const y = hH(x, z);
          const x2 = x + 0.5, y2 = hH(x2, cz + oz);
          f.position.set(x, y, z); f.rotation.y = Math.PI / 2 + Math.atan2(0, 1) - 0.05; f.rotation.x = 0.22 - Math.atan2(y2 - y, 0.5) * 0.3;
          walkPose(f, t * 1.55 + i * 0.37, 1.7); f.parts.arms.forEach((a) => (a.rotation.x *= 1.3));
        });
        const camX = cx + 7 - ls * 0.6, camZ = cz + 15; const ry = hH(cx, cz);
        const camY = Math.max(hH(camX, camZ) + 1.2, ry + 2.2);
        camera.position.set(camX, camY, camZ); camera.lookAt(cx - 3, ry + 1.3, cz - 4);
        handheld(camera, t, 0.01);
        P.exposure = 0.95; P.bloom = 0.55; P.bloomThreshold = 0.8; P.tint = [1.05, 1.0, 0.93]; P.vignette = 0.42;
      }
    },
  };
}
