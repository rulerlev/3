// Рождество: «В начале было Слово» (космос, тёплая точка света) → эхо Бытия (тёмная вода) →
// «Слово стало плотию» (свет падает на землю, как звезда) → Вифлеем: хлев, ясли, звезда над городом.
export default function build({ THREE, lib, W, H, meta }) {
  const { ramp, lerp, clamp, cameraPath, handheld, rng } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 4000);
  scene.fog = new THREE.FogExp2('#05070a', 0.004);
  const C = meta.cues;
  const T_ECHO = C.echo, T_FLESH = C.flesh, T_MANGER = C.manger, T_WIDE = C.manger + 6.2;

  const sky = lib.skyDome({ top: '#010205', horizon: '#030406', bottom: '#010203', sunDir: [0, -0.02, -1], sunColor: '#ffd9a8', sunSize: 0.02, sunGlow: 0, stars: 0, radius: 1800 });
  scene.add(sky);
  const amb = new THREE.HemisphereLight('#6d8ab8', '#0b0806', 0.3); scene.add(amb);
  const moon = new THREE.DirectionalLight('#9fb6e0', 0.5); moon.position.set(-60, 80, 40); scene.add(moon);

  // ---------------- A. Космос ----------------
  const A = new THREE.Group(); scene.add(A);
  const LIGHT_POS = new THREE.Vector3(0, 0, -420);
  const nebU = { time: { value: 0 }, k: { value: 1 }, lightDir: { value: new THREE.Vector3(0, 0, -1) } };
  const neb = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), new THREE.ShaderMaterial({
    uniforms: nebU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: lib.GLSL_NOISE + `uniform float time, k; uniform vec3 lightDir; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); vec2 p = vec2(atan(d.x, -d.z), asin(d.y));
        float n = fbm2(p*vec2(1.7,2.3) + vec2(3.1, 1.7) + time*.004);
        float n2 = fbm2(p*4.3 + n*2.2 - vec2(0., time*.006));
        vec3 c = vec3(.001,.0015,.005);
        c += vec3(.012,.012,.04)*smoothstep(.4,.9,n);
        c += vec3(.07,.035,.012)*pow(smoothstep(.55,1.,n2),3.);
        float s = max(dot(d, normalize(lightDir)), 0.);
        c += vec3(1.,.6,.25)*(pow(s, 40.)*.12 + pow(s, 10.)*.025);
        // тёмная полоса пыли
        c *= 1. - .6*smoothstep(.5,.75, fbm2(p*vec2(3.,6.)+7.))*smoothstep(.4,.0,abs(p.y+.15));
        gl_FragColor = vec4(c*k, 1.); }`,
  }));
  neb.renderOrder = -9; neb.frustumCulled = false; A.add(neb);
  const starsA = lib.starfield({ count: 7000, radius: 1400, size: 2.2, minY: -1, seed: 21 }); A.add(starsA);
  // золотые частицы, летящие навстречу
  const streamU = { time: { value: 0 }, pxr: { value: 1 }, opacity: { value: 1 } };
  {
    const N = 2600, r = rng(77), p = new Float32Array(N * 3), sd = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2, rr = 6 + Math.pow(r(), 0.7) * 140;
      p.set([Math.cos(a) * rr, Math.sin(a) * rr * 0.75, r() * 700], i * 3); sd.set([r(), r()], i * 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 2));
    const m = new THREE.ShaderMaterial({
      uniforms: streamU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute vec2 sd; uniform float time, pxr; varying float vA;
        void main(){ vec3 q = position; q.z = mod(q.z + time*(14.+sd.x*10.), 700.) - 520.;
          q.xy *= .55 + .45*(q.z+520.)/700.;
          vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv;
          float lz = (q.z+520.)/700.; vA = smoothstep(0.,.25,lz)*smoothstep(1.,.8,lz)*(.5+.5*sin(time*2.+sd.y*60.));
          gl_PointSize = (2.+sd.y*5.)*pxr*(260./max(-mv.z,1.)); }`,
      fragmentShader: `uniform float opacity; varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d);
          gl_FragColor = vec4(vec3(1.,.78,.42)*a*a*vA*opacity*1.3, 1.); }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.userData.manualTime = false; A.add(pts);
    pts.u = streamU;
  }
  const wordCore = lib.glow('#fff1d0', 10, 1); wordCore.position.copy(LIGHT_POS); A.add(wordCore);
  const wordHalo = lib.glow('#ffb860', 60, 0.5); wordHalo.position.copy(LIGHT_POS); A.add(wordHalo);
  const wordHalo2 = lib.glow('#ff9a40', 220, 0.18); wordHalo2.position.copy(LIGHT_POS); A.add(wordHalo2);
  const spikes = [0, 1].map((i) => { const s = lib.glow('#ffe2b0', 1, 0.5); s.position.copy(LIGHT_POS); s.material.rotation = i ? Math.PI / 2 : 0; A.add(s); return s; });

  // ---------------- B. Эхо: тёмная вода ----------------
  const B = new THREE.Group(); scene.add(B);
  const sea = lib.ocean({ size: 1400, seg: 190, deep: '#010205', shallow: '#03070c', sky: '#06080c', amp: 0.8, choppy: 1.1, foam: 0.08, sunDir: [0, 0.01, -1], sunColor: '#3a2c20' });
  sea.u.fogColor.value.set('#07080c'); sea.u.fogDensity.value = 0.0022; B.add(sea);
  const horizonGlow = lib.glow('#ffcf90', 260, 0.18); horizonGlow.position.set(0, 3, -900); horizonGlow.scale.set(600, 40, 1); B.add(horizonGlow);
  const horizonPt = lib.glow('#fff0d0', 9, 0.7); horizonPt.position.set(0, 2, -900); B.add(horizonPt);
  const mistB = lib.motes({ count: 1200, box: [260, 26, 260], center: [0, 9, -80], size: 7, color: '#8ea4c4', speed: 0.25, opacity: 0.35 }); B.add(mistB);

  // ---------------- C. Свет нисходит: ночные холмы ----------------
  const Cg = new THREE.Group(); scene.add(Cg);
  const hillH = (x, z) => { const far = clamp((-z - 120) / 500); return -6 + lib.fbm(x * 0.004, z * 0.004, 5) * 60 * (0.3 + far) + far * 40; };
  const hills = lib.terrain({
    size: 1600, seg: 140, center: [0, -500],
    heightFn: hillH,
    colorFn: (x, z, y, sl) => new THREE.Color().setHSL(0.6, 0.22, 0.09 + clamp(y / 140) * 0.08 + sl * 0.04),
  });
  Cg.add(hills);
  const starsC = lib.starfield({ count: 6000, radius: 1500, size: 2.3, minY: 0.0, seed: 33 }); Cg.add(starsC);
  const townLights = new THREE.Group(); Cg.add(townLights);
  { const r = rng(5); for (let i = 0; i < 14; i++) { const gl = lib.glow('#ffb36a', 4 + r() * 4, 0.6); gl.position.set(150 + (r() - 0.5) * 50, 0, -640 + (r() - 0.5) * 40); gl.position.y = hillH(gl.position.x, gl.position.z) + 2 + r() * 3; townLights.add(gl); } }
  const FALL0 = new THREE.Vector3(-260, 300, -760), FALL1 = new THREE.Vector3(150, hillH(150, -640) + 6, -640);
  const fallPos = (s) => { const k = Math.pow(clamp(s), 1.6); const p = FALL0.clone().lerp(FALL1, k); p.y += Math.sin(k * Math.PI) * 40; return p; };
  const trail = []; for (let i = 0; i < 64; i++) { const g = lib.glow(i === 0 ? '#fff4dc' : '#ffcf8a', 1, 1); Cg.add(g); trail.push(g); }
  const landGlow = lib.glow('#ffc070', 120, 0); landGlow.position.copy(FALL1); Cg.add(landGlow);

  // ---------------- D. Вифлеем ----------------
  const D = new THREE.Group(); scene.add(D);
  const groundH = (x, z) => { const rise = clamp((-z - 6) / 50); return rise * rise * 14 + lib.fbm(x * 0.03, z * 0.03, 4) * 1.6 * (0.3 + rise) - 0.05 + clamp((Math.abs(x) - 30) / 60) * 10; };
  const ground = lib.terrain({ size: 260, seg: 120, center: [0, -40], heightFn: groundH,
    colorFn: (x, z, y, sl) => new THREE.Color('#2a2420').lerp(new THREE.Color('#463a2c'), clamp(lib.noise2(x * 0.2, z * 0.2) * 0.5 + 0.5)).multiplyScalar(0.9) });
  D.add(ground);
  const clay = new THREE.MeshStandardMaterial({ color: '#8a6e52', roughness: 0.95 });
  const clay2 = new THREE.MeshStandardMaterial({ color: '#76604a', roughness: 0.95 });
  const winMat = new THREE.MeshBasicMaterial({ color: '#ffad55' });
  const winMat2 = new THREE.MeshBasicMaterial({ color: '#c97a35' });
  const town = new THREE.Group(); D.add(town);
  {
    const r = rng(42); const box = new THREE.BoxGeometry(1, 1, 1); const dome = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const win = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 46; i++) {
      const x = (r() - 0.5) * 64, z = -16 - r() * 38 - Math.abs(x) * 0.1; const y0 = groundH(x, z);
      const w = 3 + r() * 4, h = 2.4 + r() * 3, d = 3 + r() * 3;
      const m = new THREE.Mesh(box, r() < 0.5 ? clay : clay2); m.scale.set(w, h, d); m.position.set(x, y0 + h / 2 - 0.3, z); m.rotation.y = (r() - 0.5) * 0.3; town.add(m);
      const roof = new THREE.Mesh(box, clay2);
      roof.scale.set((w + 0.3) / w, 0.25 / h, (d + 0.3) / d); roof.position.set(0, 0.5 + 0.12 / h, 0); m.add(roof);
      if (r() < 0.15) { const dm = new THREE.Mesh(dome, clay); dm.scale.set(Math.min(w, d) * 0.35 / w, Math.min(w, d) * 0.35 / h, Math.min(w, d) * 0.35 / d); dm.position.set(0, 0.5, 0); m.add(dm); }
      const nw = r() < 0.75 ? 1 + Math.floor(r() * 2) : 0;
      for (let k = 0; k < nw; k++) {
        const wm = new THREE.Mesh(win, r() < 0.6 ? winMat : winMat2); wm.scale.set(0.5 / w, 0.7 / h, 1); wm.position.set((k - (nw - 1) / 2) * 0.35, -0.05 + (r() - 0.5) * 0.2, 0.502); m.add(wm);
      }
    }
  }
  // хлев
  const wood = new THREE.MeshStandardMaterial({ color: '#3b2a1c', roughness: 0.95 });
  const thatch = new THREE.MeshStandardMaterial({ color: '#5a4630', roughness: 1 });
  const straw = new THREE.MeshStandardMaterial({ color: '#7a6038', roughness: 1, emissive: '#3a2408', emissiveIntensity: 0.15 });
  const stable = new THREE.Group(); D.add(stable);
  const addBox = (grp, mat, sx, sy, sz, x, y, z, ry = 0, rz = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); grp.add(m); return m; };
  addBox(stable, wood, 6.4, 2.7, 0.2, 0, 1.35, -1.9);
  addBox(stable, wood, 0.2, 2.2, 3.8, -3.1, 1.1, 0);
  addBox(stable, wood, 0.2, 1.1, 3.8, 3.1, 0.55, 0);
  [[-3.1, 1.8], [3.1, 1.8]].forEach(([x, z]) => addBox(stable, wood, 0.18, 2.8, 0.18, x, 1.4, z));
  addBox(stable, wood, 6.6, 0.16, 0.16, 0, 2.75, 1.8);
  addBox(stable, thatch, 7.4, 0.22, 4.8, 0, 3.05, -0.1, 0, 0, -0.18);
  const strawFloor = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.6, 0.06, 24), straw); strawFloor.scale.set(1, 1, 0.6); strawFloor.position.set(0, 0.02, -0.1); stable.add(strawFloor);
  // ясли
  const manger = new THREE.Group(); manger.position.set(0, 0, 0.1); stable.add(manger);
  addBox(manger, wood, 1.3, 0.08, 0.6, 0, 0.42, 0);
  addBox(manger, wood, 1.3, 0.32, 0.06, 0, 0.6, 0.3, 0, 0, 0.0, 0.25);
  addBox(manger, wood, 1.3, 0.32, 0.06, 0, 0.6, -0.3, 0, 0, -0.25);
  [[-0.55, 0.22], [0.55, 0.22], [-0.55, -0.22], [0.55, -0.22]].forEach(([x, z]) => addBox(manger, wood, 0.07, 0.45, 0.07, x, 0.2, z));
  const strawTop = addBox(manger, straw, 1.2, 0.12, 0.62, 0, 0.62, 0);
  const baby = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 4, 8), new THREE.MeshStandardMaterial({ color: '#efe3cc', emissive: '#ffdca0', emissiveIntensity: 0.25, roughness: 0.8 }));
  baby.rotation.z = Math.PI / 2; baby.position.set(0.05, 0.74, 0); manger.add(baby);
  const babyGlow = lib.glow('#ffe2a8', 1.3, 0.5); babyGlow.position.set(0, 0.85, 0); manger.add(babyGlow);
  const babyLight = new THREE.PointLight('#ffcf8a', 3, 6, 2); babyLight.position.set(0, 1.1, 0.3); manger.add(babyLight);
  // фонарь
  const lantern = new THREE.Group(); lantern.position.set(1.9, 2.15, 1.75); stable.add(lantern);
  addBox(lantern, new THREE.MeshBasicMaterial({ color: '#ffc070' }), 0.12, 0.2, 0.12, 0, 0, 0);
  const lanternGlow = lib.glow('#ffb860', 2.2, 0.9); lantern.add(lanternGlow);
  const lanternGlow2 = lib.glow('#ff9a40', 5, 0.12); lantern.add(lanternGlow2);
  const lanternLight = new THREE.PointLight('#ffa858', 14, 14, 1.6); lantern.add(lanternLight);
  // Мария и Иосиф
  const mary = lib.figure({ height: 1.7, robe: '#2a3f66', hoodColor: '#3a5689', skin: '#8a5a3c', belt: '#2a3f66', seed: 3 });
  mary.position.set(-0.95, -0.5, 0.45); mary.rotation.y = 1.25; mary.parts.arms.forEach((a) => (a.rotation.x = -0.75)); mary.parts.head.rotation.x = 0.4; stable.add(mary);
  if (mary.parts.hood) mary.parts.hood.rotation.x = -0.1;
  const joseph = lib.figure({ height: 1.85, robe: '#4e3828', hoodColor: '#5e4836', skin: '#7a4e34', staff: true, seed: 8 });
  joseph.position.set(1.25, 0, -0.55); joseph.rotation.y = -0.9; stable.add(joseph);
  // осёл в тени
  const donkey = new THREE.Group(); donkey.position.set(-2.4, 0, -1.25); donkey.rotation.y = 0.15; donkey.scale.setScalar(1.1); stable.add(donkey);
  { const dm = new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 1 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.8, 4, 10), dm); body.rotation.z = Math.PI / 2; body.position.y = 0.95; donkey.add(body);
    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 8), dm); neck.position.set(0.68, 1.3, 0); neck.rotation.z = -0.8; donkey.add(neck);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.4, 4, 8), dm); head.position.set(1.02, 1.4, 0); head.rotation.z = 1.9; donkey.add(head);
    [-0.12, 0.12].forEach((z) => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 5), dm); e.position.set(0.86, 1.72, z); e.rotation.z = 0.35; donkey.add(e); });
    [[-0.45, 0.17], [-0.45, -0.17], [0.45, 0.17], [0.45, -0.17]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.7, 6), dm); l.position.set(x, 0.38, z); donkey.add(l); }); }
  // звезда над городом и луч
  const STAR = new THREE.Vector3(-2, 25, -8);
  const star = new THREE.Group(); star.position.copy(STAR); D.add(star);
  const starCore = lib.glow('#fffaf0', 2.2, 1); star.add(starCore);
  const starHalo = lib.glow('#cfe0ff', 10, 0.4); star.add(starHalo);
  const starHalo2 = lib.glow('#ffe0b0', 34, 0.1); star.add(starHalo2);
  const starSpk = [0, 1, 2, 3].map((i) => { const s = lib.glow('#f4f0ff', 1, 0.55); s.material.rotation = i * Math.PI / 4; star.add(s); return s; });
  const beam = lib.lightBeam({ radiusTop: 0.4, radiusBottom: 4.5, length: 26, color: '#e8e2d0', opacity: 0.1 });
  beam.position.copy(STAR); beam.lookAt(0, 0, 0); beam.rotateX(-Math.PI / 2); D.add(beam);
  const starsD = lib.starfield({ count: 5000, radius: 1500, size: 2.0, minY: 0.02, seed: 9 }); D.add(starsD);
  const dustD = lib.motes({ count: 300, box: [8, 4, 5], center: [0, 1.8, 0], size: 0.8, color: '#ffd8a0', speed: 0.15, opacity: 0.3 }); D.add(dustD);

  const groups = [A, B, Cg, D];
  const tmp = new THREE.Vector3();
  return {
    scene, camera,
    update(t, S) {
      const shot = t < T_ECHO ? 0 : t < T_FLESH ? 1 : t < T_MANGER ? 2 : 3;
      groups.forEach((g, i) => (g.visible = i === shot));
      const P = S.post;
      if (shot === 0) {
        // космос: тёплая точка приближается
        scene.fog.density = 0; sky.visible = false; amb.intensity = 0; moon.intensity = 0;
        const k = (t) / T_ECHO;
        const camZ = lerp(260, -60, lib.ease(k * 0.9));
        camera.position.set(Math.sin(t * 0.13) * 6, Math.cos(t * 0.11) * 3, camZ);
        // точка света — выше центра, цитата ниже
        camera.lookAt(LIGHT_POS.x, LIGHT_POS.y - 0.26 * (camZ - LIGHT_POS.z) * 0.36, LIGHT_POS.z);
        camera.rotation.z += Math.sin(t * 0.1) * 0.02;
        const pulse = 1 + Math.sin(t * 2.1) * 0.06;
        const grow = 1 + ramp(t, 4.5, 2.6) * 1.2;
        wordCore.scale.setScalar(9 * pulse * grow); wordHalo.scale.setScalar(55 * grow); wordHalo2.scale.setScalar(240 * grow);
        wordHalo.material.opacity = 0.45 * ramp(t, 0, 2); wordHalo2.material.opacity = 0.16 * ramp(t, 0, 3);
        spikes.forEach((s, i) => { s.scale.set((i ? 50 : 95) * grow * pulse, 1.8 * grow, 1); });
        nebU.k.value = 0.8 + ramp(t, 0, 5) * 0.4; streamU.opacity.value = ramp(t, 0.2, 2);
        starsA.rotation.z = t * 0.01;
        P.exposure = 1.0; P.bloom = 0.9; P.bloomThreshold = 0.55; P.bloomRadius = 0.7; P.vignette = 0.5; P.tint = [1.02, 0.99, 0.95];
        S.quote.y = 0.66;
      } else if (shot === 1) {
        // эхо Бытия: тёмная вода, слабый свет на горизонте
        sky.visible = true; scene.fog.density = 0.0035; scene.fog.color.set('#07080c');
        const ls = t - T_ECHO, k = ls / (T_FLESH - T_ECHO);
        const dawn = ramp(ls, 2.5, 3.5);
        sky.u.top.value.set('#010206').lerp(new THREE.Color('#040812'), dawn);
        sky.u.horizon.value.set('#07070a').lerp(new THREE.Color('#1a140f'), dawn);
        sky.u.bottom.value.set('#010102'); sky.u.sunDir.value.set(0, -0.03, -1).normalize();
        sky.u.sunColor.value.set('#ffcf90').multiplyScalar(0.25); sky.u.sunGlow.value = 0.15 + dawn * 0.35; sky.u.sunSize.value = 0.01; sky.u.starAmt.value = 0.2;
        horizonGlow.material.opacity = 0.06 + dawn * 0.1; horizonPt.material.opacity = 0.2 + dawn * 0.35;
        sea.u.skyc.value.set('#06070a').lerp(new THREE.Color('#141010'), dawn); sea.u.sunColor.value.set('#ffcf90').multiplyScalar(0.05 + dawn * 0.08);
        sea.u.sunDir.value.set(0, 0.02, -1).normalize(); sea.u.fogColor.value.copy(sky.u.horizon.value).multiplyScalar(0.7);
        scene.fog.color.copy(sea.u.fogColor.value);
        cameraPath(camera, [[0, [0, 3.2, 70], [0, 4.5, -300]], [6, [0, 3.0, 40], [0, 5.5, -300]]], ls);
        handheld(camera, t, 0.006);
        P.exposure = 1.0; P.bloom = 0.7; P.bloomThreshold = 0.6; P.vignette = 0.45; P.tint = [0.98, 0.99, 1.03];
      } else if (shot === 2) {
        // свет нисходит
        sky.visible = true; scene.fog.density = 0.0016; scene.fog.color.set('#18213a');
        const ls = t - T_FLESH;
        sky.u.top.value.set('#03060f'); sky.u.horizon.value.set('#26304a'); sky.u.bottom.value.set('#05070c');
        sky.u.sunGlow.value = 0; sky.u.starAmt.value = 0.6; sky.u.sunDir.value.set(0, -0.3, -1);
        amb.intensity = 0.5; amb.color.set('#7a95c8'); moon.intensity = 0.9;
        const fallK = (ls + 0.2) / 2.9;
        for (let i = 0; i < trail.length; i++) {
          const s = fallK - i * 0.0055; const g = trail[i];
          g.visible = s > 0 && fallK < 1.25;
          if (!g.visible) continue;
          g.position.copy(fallPos(Math.min(s, 1)));
          const fade = Math.pow(1 - i / trail.length, 1.6) * (1 - ramp(fallK, 1.0, 0.2));
          g.scale.setScalar((i === 0 ? 48 : 18) * (1 - i / trail.length * 0.7)); g.material.opacity = fade * (i === 0 ? 1 : 0.4);
        }
        landGlow.material.opacity = ramp(fallK, 0.98, 0.12) * 0.9 * (1 - ramp(fallK, 1.1, 0.5) * 0.4);
        landGlow.scale.setScalar(90 + ramp(fallK, 0.98, 0.4) * 80);
        townLights.children.forEach((g) => (g.material.opacity = 0.35 + ramp(fallK, 0.98, 0.3) * 0.4));
        cameraPath(camera, [[0, [-60, 70, 140], [20, 90, -700]], [4.7, [-50, 66, 110], [60, 28, -700]]], ls);
        handheld(camera, t, 0.004);
        P.exposure = 1.05; P.bloom = 1.0; P.bloomThreshold = 0.5; P.bloomRadius = 0.7; P.vignette = 0.45; P.tint = [0.96, 0.99, 1.05];
        S.quote.y = 0.36;
      } else {
        // Вифлеем
        sky.visible = true; scene.fog.density = 0.006; scene.fog.color.set('#0b1222');
        const ls = t - T_MANGER;
        sky.u.top.value.set('#040814'); sky.u.horizon.value.set('#1c2740'); sky.u.bottom.value.set('#06080e');
        sky.u.sunGlow.value = 0; sky.u.starAmt.value = 0.8;
        amb.intensity = 0.32; amb.color.set('#6f8cc4'); moon.intensity = 0.55; moon.color.set('#a8bce6');
        const flick = 1 + Math.sin(t * 13.1) * 0.05 + Math.sin(t * 7.3) * 0.05;
        lanternLight.intensity = 14 * flick; lanternGlow.scale.setScalar(2.2 * flick);
        babyGlow.material.opacity = 0.7 + Math.sin(t * 1.3) * 0.08;
        starSpk.forEach((s, i) => s.scale.set(i % 2 ? 7 : 16, 0.35, 1));
        starSpk.forEach((s, i) => (s.material.rotation = i * Math.PI / 4 + t * 0.01));
        beam.u.opacity.value = 0.07 + ramp(t, T_WIDE + 1, 2) * 0.05;
        if (t < T_WIDE) {
          cameraPath(camera, [[0, [1.6, 1.75, 10.0], [0, 1.0, 0]], [T_WIDE - T_MANGER, [0.9, 1.5, 7.8], [-0.1, 0.9, 0]]], ls);
          handheld(camera, t, 0.005);
          scene.fog.density = 0.012;
        } else {
          const lw = t - T_WIDE;
          cameraPath(camera, [[0, [-12, 2.0, 36], [-1, 8, -6]], [S.dur - T_WIDE, [-17, 5, 54], [-2, 13, -10]]], lw);
          handheld(camera, t, 0.004);
        }
        P.exposure = 1.05; P.bloom = 0.85; P.bloomThreshold = 0.55; P.bloomRadius = 0.7; P.vignette = 0.42; P.tint = [1.0, 0.98, 1.0];
      }
    },
  };
}
