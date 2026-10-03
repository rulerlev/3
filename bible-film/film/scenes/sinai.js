// Синай: гора в грозе и огне → две скрижали с десятью строками → «Не убивай» / «Не кради» →
// пустыня: днём облачный столп, ночью огненный столп ведёт растянувшийся караван.
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, cameraPath, handheld, rng, fbm, noise2 } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#120c0a', 0.003);
  const C = meta.cues;
  const T_TAB = 5.0, T_NIGHT = 24.75;

  const sky = lib.skyDome({ top: '#04060a', horizon: '#2a1a14', bottom: '#080605', sunDir: [0.3, -0.3, -1], sunGlow: 0, stars: 0 });
  scene.add(sky);
  const hemi = new THREE.HemisphereLight('#6d7c99', '#1a120c', 0.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd9a8', 0); sun.position.set(200, 300, 100); scene.add(sun);
  const bolt = new THREE.DirectionalLight('#c8d8ff', 0); bolt.position.set(-100, 300, 50); scene.add(bolt);

  // ================= A: гора в грозе =================
  const gA = new THREE.Group(); scene.add(gA);
  const PEAK = [0, -220];
  const mH = (x, z) => {
    const dx = x - PEAK[0], dz = z - PEAK[1]; const d = Math.hypot(dx, dz);
    const ridge = 1 - Math.abs(noise2(x * 0.012, z * 0.012));
    const ang = Math.atan2(dz, dx); const rid = Math.pow(1 - Math.abs(Math.sin(ang * 3.5 + fbm(x * 0.01, z * 0.01, 3) * 3)), 3);
    const env = Math.exp(-Math.pow(d / 135, 1.35));
    const m = 175 * env * (0.72 + 0.28 * ridge + 0.18 * rid) + (Math.abs(fbm(x * 0.025, z * 0.025, 5)) * 28) * Math.exp(-d / 160);
    return m + fbm(x * 0.006, z * 0.006, 3) * 6;
  };
  const mount = lib.terrain({
    size: 1000, seg: 170, center: [0, -150], heightFn: mH,
    colorFn: (x, z, y, sl) => new THREE.Color('#2c2622').lerp(new THREE.Color('#0e0b0a'), clamp(sl * 1.8)).multiplyScalar(0.7 + 0.5 * noise2(x * 0.05, z * 0.05) * 0.5 + 0.3 * clamp(y / 170)),
  });
  gA.add(mount);
  const peakY = mH(PEAK[0], PEAK[1]);
  // огонь на вершине
  const peakFire = lib.fire({ count: 500, radius: 16, height: 46, size: 260, intensity: 0.7, seed: 21 });
  peakFire.position.set(PEAK[0], peakY - 6, PEAK[1]); gA.add(peakFire);
  const peakGlow = lib.glow('#ff7a30', 110, 0.4); peakGlow.position.set(PEAK[0], peakY + 10, PEAK[1]); gA.add(peakGlow);
  const peakLight = new THREE.PointLight('#ff7a30', 0, 260, 1.5); peakLight.position.set(PEAK[0], peakY + 25, PEAK[1] + 30); gA.add(peakLight);
  // грозовые облака вокруг вершины
  const stormA = lib.cloudLayer({ count: 22, area: [380, 160], y: peakY - 10, scale: [170, 70], seed: 31, color: '#8a7470', opacity: 0.95, center: [0, -200] });
  gA.add(stormA);
  const stormB = lib.cloudLayer({ count: 18, area: [800, 260], y: peakY + 60, scale: [320, 130], seed: 41, color: '#4e4650', opacity: 0.95, center: [0, -300] });
  gA.add(stormB);
  // молнии — ломаные трубки
  const bolts = [];
  const mkBolt = (seed, x0, x1, z) => {
    const r = rng(seed); const pts = []; const n = 14; const yTop = peakY + 90, yBot = mH(x1, z) + 2;
    for (let i = 0; i <= n; i++) { const k = i / n; pts.push(new THREE.Vector3(lerp(x0, x1, k) + (i && i < n ? (r() - .5) * 26 : 0), lerp(yTop, yBot, k), z + (r() - .5) * 10)); }
    const g = new THREE.Group();
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 60, 0.9, 5, false);
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3.4, 4), fog: false })));
    // ответвление
    const b0 = pts[5]; const br = [b0]; for (let i = 1; i < 5; i++) br.push(new THREE.Vector3(b0.x + i * (r() > .5 ? 8 : -8) + (r() - .5) * 8, b0.y - i * 12, b0.z));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(br), 20, 0.5, 4, false), g.children[0].material));
    g.visible = false; gA.add(g); bolts.push(g);
  };
  mkBolt(5, -60, -95, -170); mkBolt(9, 70, 110, -150); mkBolt(13, -10, 40, -120);
  const FLASHES = [[1.15, 0], [2.2, 1], [2.38, 1], [3.75, 2], [4.55, 0]];
  // стан внизу: шатры + костры
  const tentGeo = new THREE.ConeGeometry(1, 1, 4, 1); tentGeo.translate(0, 0.5, 0);
  const tents = new THREE.InstancedMesh(tentGeo, new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 1 }), 320);
  const campPts = [];
  {
    const r = rng(77); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < 320; i++) {
      const x = (r() - .5) * 420, z = 40 + r() * 140 + Math.abs(x) * 0.15; const y = mH(x, z);
      const w = 2.2 + r() * 2; q.setFromEuler(new THREE.Euler(0, r() * 3, 0)); s.set(w, w * (0.7 + r() * 0.3), w * (0.8 + r() * 0.5));
      m.compose(new THREE.Vector3(x, y, z), q, s); tents.setMatrixAt(i, m);
      tents.setColorAt(i, new THREE.Color('#6b5a48').multiplyScalar(0.6 + r() * 0.6));
      if (r() < 0.35) campPts.push(x + 3, y + 1, z + 2);
    }
  }
  gA.add(tents);
  const campGeo = new THREE.BufferGeometry(); campGeo.setAttribute('position', new THREE.Float32BufferAttribute(campPts, 3));
  const camps = new THREE.Points(campGeo, new THREE.PointsMaterial({ map: lib.radialTexture(), color: '#ffa04a', size: 5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  gA.add(camps);
  const smokeA = lib.motes({ count: 500, box: [500, 120, 300], center: [0, 60, -60], size: 30, color: '#ff9a50', speed: 0.5, kind: 'embers', opacity: 0.25 });
  gA.add(smokeA);

  // ================= B: скрижали =================
  const gB = new THREE.Group(); scene.add(gB);
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const LINE_Y = [2.3, 1.86, 1.42, 0.98, 0.54];
  const marksFor = (i) => { // «слова»-глифы; у VI и VIII — ровно два слова
    const r = rng(100 + i * 7); const words = i === 5 || i === 7 ? 2 : 3 + Math.floor(r() * 3);
    return { r, words };
  };
  const drawGlyphLine = (g, x, y, w, i, col, glowPass) => {
    const { r, words } = marksFor(i);
    g.font = `${Math.round(w * 0.085)}px Garamond`; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
    g.fillText(ROMAN[i] + '.', x, y);
    let cx = x + w * 0.2; const hgt = w * 0.05;
    g.lineWidth = w * 0.011;
    for (let k = 0; k < words; k++) {
      const n = 2 + Math.floor(r() * 4);
      for (let j = 0; j < n; j++) {
        const ty = r(); g.beginPath();
        if (ty < 0.35) { g.moveTo(cx, y - hgt); g.lineTo(cx, y + hgt); cx += w * 0.022; }
        else if (ty < 0.6) { g.moveTo(cx, y - hgt); g.lineTo(cx + w * 0.03, y - hgt); g.lineTo(cx + w * 0.03, y + hgt); cx += w * 0.05; }
        else if (ty < 0.8) { g.arc(cx + w * 0.018, y, hgt * 0.8, Math.PI * 0.2, Math.PI * 1.7); cx += w * 0.05; }
        else { g.moveTo(cx, y + hgt); g.lineTo(cx + w * 0.02, y - hgt); g.lineTo(cx + w * 0.04, y + hgt); cx += w * 0.055; }
        g.stroke();
      }
      cx += w * 0.05;
      if (cx > x + w * 0.92) break;
    }
  };
  const tabShape = new THREE.Shape();
  tabShape.moveTo(-1, 0); tabShape.lineTo(1, 0); tabShape.lineTo(1, 2); tabShape.absarc(0, 2, 1, 0, Math.PI, false); tabShape.lineTo(-1, 0);
  const tabGeo = new THREE.ExtrudeGeometry(tabShape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 32 });
  const mkStoneTex = (side) => lib.canvasTexture(512, 820, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = fbm(x * 0.012 + side * 9, y * 0.012, 5) * 0.5 + fbm(x * 0.08, y * 0.08, 2) * 0.15;
      const v = 0.62 + n * 0.45; const i = (y * w + x) * 4;
      img.data[i] = 150 * v; img.data[i + 1] = 136 * v; img.data[i + 2] = 112 * v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // гравировка: светлый край снизу + тёмная борозда
    for (let l = 0; l < 5; l++) {
      const i = side * 5 + l; const y = h - (LINE_Y[l] / 3.2) * h;
      drawGlyphLine(g, w * 0.1, y + 2, w * 0.82, i, 'rgba(230,215,190,0.35)');
      drawGlyphLine(g, w * 0.1, y, w * 0.82, i, 'rgba(40,30,22,0.9)');
    }
  });
  const tablets = []; const glowLines = [];
  [0, 1].forEach((side) => {
    const map = mkStoneTex(side); map.repeat.set(0.5, 1 / 3.2); map.offset.set(0.5, 0); map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.92, color: '#ffffff' });
    const tab = new THREE.Mesh(tabGeo, mat); const grp = new THREE.Group(); grp.add(tab);
    grp.position.set(side ? 1.15 : -1.15, 0, 0); grp.rotation.y = side ? -0.12 : 0.12; grp.rotation.z = side ? -0.03 : 0.03;
    for (let l = 0; l < 5; l++) {
      const i = side * 5 + l;
      const tex = lib.canvasTexture(512, 80, (g, w, h) => { g.shadowColor = '#ffb050'; g.shadowBlur = 10; drawGlyphLine(g, w * 0.04, h / 2, w * 0.92, i, '#ffe2a8'); });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 0.256), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffb766', opacity: 0, fog: false }));
      pl.position.set(0.0, LINE_Y[l], 0.365); grp.add(pl); glowLines[i] = pl;
    }
    gB.add(grp); tablets.push(grp);
  });
  // постамент-скала и плато
  const rockMat = new THREE.MeshStandardMaterial({ color: '#2e2620', roughness: 1, flatShading: true });
  const plateau = lib.terrain({ size: 120, seg: 70, center: [0, -20], heightFn: (x, z) => -0.15 + fbm(x * 0.08, z * 0.08, 4) * 1.2 + Math.max(0, -z - 15) * 0.25 + Math.max(0, Math.abs(x) - 20) * 0.15, color: '#1c1612' });
  gB.add(plateau);
  {
    const r = rng(3);
    for (let i = 0; i < 14; i++) {
      const g = new THREE.DodecahedronGeometry(1, 0); const m = new THREE.Mesh(g, rockMat);
      const a = r() * Math.PI * 2, d = 4 + r() * 14; m.position.set(Math.cos(a) * d, -0.2, Math.sin(a) * d - 3); m.scale.set(0.6 + r() * 1.5, 0.4 + r() * 1.2, 0.6 + r() * 1.5); m.rotation.set(r() * 3, r() * 3, r()); gB.add(m);
    }
  }
  const bFire = lib.fire({ count: 400, radius: 5, height: 7, size: 14, intensity: 0.6, seed: 4 }); bFire.position.set(0, -0.5, -16); gB.add(bFire);
  const bGlow = lib.glow('#ff6a2a', 26, 0.3); bGlow.position.set(0, 3, -18); gB.add(bGlow);
  const bKey = new THREE.PointLight('#ffb46a', 0, 40, 1.2); bKey.position.set(-3, 5, 6); gB.add(bKey);
  const bBack = new THREE.PointLight('#ff6a2a', 0, 40, 1); bBack.position.set(0, 3, -8); gB.add(bBack);
  const bEmbers = lib.motes({ count: 600, box: [30, 14, 24], center: [0, 5, -4], size: 2.4, color: '#ff9a48', speed: 0.6, kind: 'embers', opacity: 0.8 });
  gB.add(bEmbers);
  const bSmoke = lib.cloudLayer({ count: 10, area: [80, 30], y: 10, scale: [50, 22], seed: 61, color: '#2a2220', opacity: 0.7, center: [0, -30] });
  gB.add(bSmoke);

  // ================= C: пустыня, столпы =================
  const gC = new THREE.Group(); scene.add(gC);
  const PIL = new THREE.Vector3(-70, 0, -520);
  const dH = (x, z) => 16 * fbm(x * 0.004, z * 0.004, 4) + 9 * Math.pow(1 - Math.abs(noise2(x * 0.009 + z * 0.004, z * 0.014)), 2) + 2 * fbm(x * 0.03, z * 0.03, 2);
  const dunes = lib.terrain({
    size: 1600, seg: 150, center: [0, -300], heightFn: dH,
    colorFn: (x, z, y, sl) => new THREE.Color('#c9995e').lerp(new THREE.Color('#8a5d36'), clamp(sl * 2.2)).multiplyScalar(0.85 + 0.2 * noise2(x * 0.05, z * 0.05)),
  });
  gC.add(dunes);
  const pathAt = (s) => { // s 0..1 — от зрителя к столпу
    const z = lerp(160, PIL.z + 40, s); const x = lerp(30, PIL.x, s) + Math.sin(s * 7.0) * 55 * (1 - s * 0.6);
    return [x, z];
  };
  // люди-силуэты (дешёвые: одно тело вращения)
  const pplGeo = new THREE.LatheGeometry([[0, 0], [.34, 0], [.3, .5], [.22, 1.05], [.25, 1.3], [.12, 1.44], [.11, 1.52], [.12, 1.62], [.08, 1.72], [0, 1.76]].map(([x, y]) => new THREE.Vector2(x, y)), 7);
  const NP = 700; const ppl = new THREE.InstancedMesh(pplGeo, new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 1 }), NP);
  const pplD = []; { const r = rng(91); for (let i = 0; i < NP; i++) { pplD.push([r(), (r() - .5) * 9, 1.6 + r() * 0.5, r()]); ppl.setColorAt(i, new THREE.Color().setHSL(0.06 + r() * 0.05, 0.3 + r() * 0.2, 0.18 + r() * 0.2)); } }
  gC.add(ppl);
  // шатры-стоянки вдоль пути
  const NT = 260; const ctents = new THREE.InstancedMesh(tentGeo, new THREE.MeshStandardMaterial({ color: '#7a6248', roughness: 1 }), NT);
  { const r = rng(17); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < NT; i++) { const sp = r(); const [x, z] = pathAt(sp); const side = (r() < .5 ? -1 : 1) * (10 + r() * 30); const px = x + side, pz = z + (r() - .5) * 20;
      const w = 2.5 + r() * 2; q.setFromEuler(new THREE.Euler(0, r() * 3, 0)); s.set(w, w * 0.8, w); m.compose(new THREE.Vector3(px, dH(px, pz) - 0.3, pz), q, s); ctents.setMatrixAt(i, m);
      ctents.setColorAt(i, new THREE.Color().setHSL(0.07 + r() * 0.04, 0.35, 0.3 + r() * 0.25)); } }
  gC.add(ctents);
  // столп облачный
  const cloudPillar = new THREE.Group(); cloudPillar.position.copy(PIL); gC.add(cloudPillar);
  { const texs = [lib.cloudTexture(71), lib.cloudTexture(72), lib.cloudTexture(73)]; const r = rng(55);
    for (let i = 0; i < 46; i++) { const y = i * 7 + r() * 6; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texs[i % 3], color: '#f4ece2', transparent: true, depthWrite: false, opacity: 0.85 }));
      const w = 100 + r() * 50 + Math.max(0, y - 220) * 0.7; sp.scale.set(w, w * 0.8, 1); sp.position.set((r() - .5) * 18, y + 10, (r() - .5) * 18); sp.userData = { y, ph: r() * 6, o: 0.75 + r() * 0.25 }; cloudPillar.add(sp); } }
  // столп огненный
  const firePillar = new THREE.Group(); firePillar.position.copy(PIL); gC.add(firePillar);
  const fp1 = lib.fire({ count: 1400, radius: 9, height: 240, size: 420, intensity: 0.55, seed: 33, color1: '#ffd88a', color2: '#ff5a18' }); firePillar.add(fp1);
  const fp2 = lib.fire({ count: 500, radius: 16, height: 60, size: 500, intensity: 0.45, seed: 34 }); firePillar.add(fp2);
  const fpGlow = lib.glow('#ff7a30', 300, 0.3); fpGlow.position.y = 120; firePillar.add(fpGlow);
  const fpGlow2 = lib.glow('#ffbf7a', 110, 0.4); fpGlow2.position.y = 40; firePillar.add(fpGlow2);
  const fpLight = new THREE.PointLight('#ff8a3c', 0, 1400, 1); fpLight.position.set(PIL.x, 120, PIL.z + 60); gC.add(fpLight);
  const stars = lib.starfield({ count: 5000, radius: 1500, size: 2.2, minY: 0.03 }); stars.u.opacity.value = 0; gC.add(stars);
  const sandDust = lib.motes({ count: 600, box: [200, 30, 200], center: [0, 10, 40], size: 4, color: '#ffd8a0', speed: 0.3, opacity: 0.25 });
  gC.add(sandDust);

  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), eul = new THREE.Euler();
  const colA = new THREE.Color(), colB = new THREE.Color();

  return {
    scene, camera,
    update(t, S) {
      const shotA = t < T_TAB, shotC = t >= C.desert, shotB = !shotA && !shotC;
      gA.visible = shotA; gB.visible = shotB; gC.visible = shotC;
      S.post.bloomThreshold = 0.75;
      if (shotA) {
        // вспышки молний
        let fl = 0, which = -1;
        for (const [ft, b] of FLASHES) { const d = t - ft; if (d >= 0 && d < 0.35) { const v = Math.exp(-d * 9) * (0.6 + 0.4 * Math.sin(d * 90)); if (v > fl) { fl = v; which = b; } } }
        bolts.forEach((b, i) => (b.visible = i === which && fl > 0.25));
        bolt.intensity = 0.35 + fl * 3.5;
        sky.u.top.value.set('#080a12').lerp(colA.set('#4a5070'), fl * 0.6);
        sky.u.horizon.value.set('#3e2a26').lerp(colA.set('#7a7088'), fl * 0.5); sky.u.bottom.value.set('#0a0605');
        sky.u.starAmt.value = 0; sky.u.sunGlow.value = 0;
        scene.fog.color.set('#22160f').lerp(colA.set('#3a3848'), fl * 0.5); scene.fog.density = 0.0011;
        stormA.setColor(colA.set('#7a605a').lerp(colB.set('#c0c0d8'), fl * 0.7)); stormB.setColor(colA.set('#3a3440').lerp(colB.set('#9a9ab0'), fl * 0.6));
        stormA.drift(t, 3, 0); stormB.drift(t, -2, 0);
        hemi.intensity = 0.5; hemi.color.set('#6d7c99'); sun.intensity = 0;
        peakLight.intensity = 2500 * (0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3));
        peakGlow.material.opacity = 0.55 + 0.1 * Math.sin(t * 9);
        S.post.flash = fl * 0.08; S.post.exposure = 1.0; S.post.bloom = 0.7;
        cameraPath(camera, [[0, [30, 14, 300], [0, 75, -180]], [T_TAB, [6, 40, 150], [0, 105, -210]]], t);
        handheld(camera, t, 0.004 + fl * 0.01);
      } else if (shotB) {
        // скрижали: строки «выжигаются» по очереди
        const kill = S.since('kill'), steal = S.since('steal');
        for (let i = 0; i < 10; i++) {
          const appear = ramp(t, 5.4 + i * 0.24, 0.5);
          const flare = Math.exp(-Math.max(0, t - 5.4 - i * 0.24 - 0.3) * 2.5) * appear;
          let o = appear * 0.55 + flare * 0.9;
          if (t >= C.kill) { o *= 0.55; if (i === 5) o += 0.85 * ramp(kill, 0, 0.4); if (i === 7) o += 0.85 * ramp(steal, 0, 0.4); }
          if (t >= C.fact) { const p = ramp(t, C.fact + 4.0, 0.6); if (i === 5 || i === 7) o = 0.9 + 0.5 * p * (0.7 + 0.3 * Math.sin(t * 5)); }
          glowLines[i].material.opacity = o;
        }
        sky.u.top.value.set('#050405'); sky.u.horizon.value.set('#3a1a0e'); sky.u.bottom.value.set('#0a0605'); sky.u.starAmt.value = 0;
        scene.fog.color.set('#120a07'); scene.fog.density = 0.03; bEmbers.u.opacity.value = t >= C.kill && t < C.fact ? 0.35 : 0.8;
        hemi.intensity = 0.25; hemi.color.set('#8a7a6a'); sun.intensity = 0; bolt.intensity = 0;
        bKey.intensity = 30 * (0.9 + 0.1 * Math.sin(t * 11)); bBack.intensity = 45;
        bSmoke.drift(t, 1.2, 0);
        S.post.bloom = 0.65; S.post.exposure = 1.0;
        if (t < C.kill) { // общий-средний план, наезд
          cameraPath(camera, [[T_TAB, [-5.5, 3.2, 10.5], [0, 1.6, 0]], [C.kill, [-2.6, 2.4, 7.2], [0, 1.5, 0]]], t);
        } else if (t < C.fact) { // спокойный крупный план, скрижали справа — центр под цитату
          cameraPath(camera, [[C.kill, [-5.2, 2.0, 6.6], [-3.4, 1.6, 0]], [C.fact, [-4.8, 1.9, 6.0], [-3.2, 1.6, 0]]], t);
          S.post.exposure = 0.9;
        } else { // проезд вдоль второй скрижали
          cameraPath(camera, [[C.fact, [2.6, 2.5, 3.6], [1.0, 1.9, 0]], [C.desert, [1.6, 1.4, 3.4], [1.1, 1.1, 0]]], t);
        }
        handheld(camera, t, 0.003);
      } else {
        // пустыня: день → ночь на «Ночью»
        const night = t >= T_NIGHT ? 1 : 0; const nk = ramp(t, T_NIGHT, 1.2);
        sky.u.top.value.set(night ? '#03060f' : '#3f6488'); sky.u.horizon.value.set(night ? '#1c1a24' : '#e8c896'); sky.u.bottom.value.set(night ? '#0a0806' : '#b08a5e');
        sky.u.sunDir.value.set(0.6, night ? -0.2 : 0.35, -0.5).normalize(); sky.u.sunColor.value.set('#fff0d0'); sky.u.sunGlow.value = night ? 0 : 0.8; sky.u.sunSize.value = 0.02;
        sky.u.starAmt.value = night; stars.u.opacity.value = night * 0.9;
        scene.fog.color.set(night ? '#0e0c12' : '#e0c49a'); scene.fog.density = night ? 0.0009 : 0.0006;
        hemi.color.set(night ? '#3a4a70' : '#bcd0e8'); hemi.groundColor.set(night ? '#0a0805' : '#7a5a3a'); hemi.intensity = night ? 0.25 : 0.55;
        sun.color.set('#ffe2b4'); sun.intensity = night ? 0 : 2.2; sun.position.set(400, 90, -250);
        cloudPillar.visible = !night; firePillar.visible = !!night;
        cloudPillar.children.forEach((sp) => { const d = sp.userData; sp.position.y = d.y + 10 + Math.sin(t * 0.3 + d.ph) * 4; sp.material.rotation = t * 0.04 * (d.ph > 3 ? 1 : -1) + d.ph; sp.material.color.set('#f6eee4'); });
        fpLight.intensity = night ? 3000 * (0.9 + 0.1 * Math.sin(t * 7)) : 0;
        fpGlow.material.opacity = 0.3 * nk; fpGlow2.material.opacity = 0.35 * nk;
        fp1.u.intensity.value = 0.55 * (0.3 + 0.7 * nk); fp2.u.intensity.value = 0.45 * nk;
        // люди идут к столпу
        for (let i = 0; i < NP; i++) {
          const [s0, off, h, ph] = pplD[i]; const s = clamp(s0 * 0.94 + t * 0.0012); const [x, z] = pathAt(s); const [x2, z2] = pathAt(s + 0.01);
          const nx = -(z2 - z), nz = x2 - x, nl = Math.hypot(nx, nz) || 1; const px = x + nx / nl * off, pz = z + nz / nl * off;
          const bob = Math.abs(Math.sin(t * 4 + ph * 20)) * 0.08;
          tmpP.set(px, dH(px, pz) - 0.1 + bob, pz); tmpQ.setFromEuler(eul.set(0, Math.atan2(x2 - x, z2 - z), Math.sin(t * 4 + ph * 20) * 0.04)); tmpS.set(h / 1.76 * 1.3, h / 1.76 * 1.3, h / 1.76 * 1.3);
          ppl.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
        }
        ppl.instanceMatrix.needsUpdate = true;
        sandDust.u.opacity.value = night ? 0.15 : 0.25; sandDust.u.color.value.set(night ? '#ff9a50' : '#ffe0b0');
        S.post.exposure = night ? 1.05 : 0.95; S.post.bloom = night ? 0.8 : 0.45; S.post.bloomThreshold = night ? 0.7 : 0.85;
        if (!night) cameraPath(camera, [[C.desert, [150, 70, 250], [-20, 18, -200]], [T_NIGHT, [110, 95, 170], [-50, 50, -380]]], t);
        else cameraPath(camera, [[T_NIGHT, [40, 9, 95], [-55, 70, -500]], [S.dur, [28, 13, 55], [-62, 90, -500]]], t);
        handheld(camera, t, 0.003);
      }
      sky.position.copy(camera.position);
    },
  };
}
