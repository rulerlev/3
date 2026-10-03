// Книги мудрости: келья со свитками → Иов на пепелище → вихрь и рождение Земли («Где был ты…») →
// арфа под звёздами (Псалмы) → песочные часы в пустыне, тонущий дворец («Суета сует») → сад на рассвете (Песнь Песней).
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, rng, fbm, noise2, cameraPath, handheld, smooth } = lib;
  const C = meta.cues;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#1a120c', 0.03);
  const col = (c) => new THREE.Color(c);
  const cA = new THREE.Color();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), eul = new THREE.Euler();
  const T_COSMOS = C.storm + 2.6;

  const sky = lib.skyDome({ top: '#0b1a33', horizon: '#c98a5a', bottom: '#1a0f0a', sunDir: [0, 0.1, -1], sunSize: 0.03, sunGlow: 0.8 });
  scene.add(sky);
  const hemi = new THREE.HemisphereLight('#8a9ab8', '#2a2018', 0.4); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd0a0', 1.5); scene.add(sun); scene.add(sun.target);
  const setSky = (top, hor, bot, dir, sc, size, gl, stars = 0) => {
    sky.u.top.value.set(top); sky.u.horizon.value.set(hor); sky.u.bottom.value.set(bot);
    sky.u.sunDir.value.set(...dir).normalize(); sky.u.sunColor.value.set(sc); sky.u.sunSize.value = size; sky.u.sunGlow.value = gl; sky.u.starAmt.value = stars;
  };

  // ветер: частицы, несущиеся по x (песок, пепел)
  function wind({ count = 1500, box = [60, 6, 40], center = [0, 2, 0], color = '#c8a878', size = 4, speed = 6, opacity = 0.5, seed = 4 } = {}) {
    const r = rng(seed), p = new Float32Array(count * 3), sd = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) { p.set([(r() - .5) * box[0], (r() - .5) * box[1] * Math.pow(r(), 1.5), (r() - .5) * box[2]], i * 3); sd.set([r(), r()], i * 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 2));
    const u = { time: { value: 0 }, size: { value: size }, color: { value: col(color) }, opacity: { value: opacity }, box: { value: new THREE.Vector3(...box) }, speed: { value: speed }, pxr: { value: 1 } };
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec2 sd; uniform float time, size, speed, pxr; uniform vec3 box; varying float vA;
        void main(){ vec3 q = position; q.x = mod(q.x + time*speed*(.6+sd.x) + box.x*.5, box.x) - box.x*.5;
          q.y += sin(time*2. + sd.y*40. + q.x*.3)*.25; q.z += sin(time*1.3 + sd.x*30.)*.3;
          vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv;
          vA = smoothstep(.5,.4,abs(q.x/box.x)) * (.5+.5*sd.y);
          gl_PointSize = size*(.4+sd.y)*pxr*(30./max(-mv.z,.5)); }`,
      fragmentShader: `uniform vec3 color; uniform float opacity; varying float vA;
        void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d); gl_FragColor = vec4(color*a*vA*opacity, 1.); }` });
    const pts = new THREE.Points(g, m); pts.position.set(...center); pts.frustumCulled = false; return Object.assign(pts, { u });
  }

  // ================= A. Келья со свитками =================
  const gA = new THREE.Group(); scene.add(gA);
  const wallTex = lib.canvasTexture(512, 512, (g, w, h) => { const r = rng(5); g.fillStyle = '#4a3a2a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 * 40; x < w; x += 80) { g.fillStyle = `rgba(${90 + r() * 40},${70 + r() * 30},${50 + r() * 20},0.6)`; g.fillRect(x + 2, y + 2, 76, 28); } });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(3, 2);
  const wallM = new THREE.MeshStandardMaterial({ map: wallTex, color: '#a08a70', roughness: 1 });
  const woodM = new THREE.MeshStandardMaterial({ color: '#4a2e1a', roughness: 0.8 });
  const room = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 14), wallM); room.material.side = THREE.BackSide; room.position.set(0, 4, -1); gA.add(room);
  // стеллажи со свитками у задней стены
  const shelfN = 5, cellsX = 14;
  const shelves = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), woodM, shelfN + cellsX + 1);
  { let n = 0; for (let i = 0; i < shelfN; i++) shelves.setMatrixAt(n++, tmpM.compose(tmpP.set(0, 0.5 + i * 1.15, -7.3), tmpQ.identity(), tmpS.set(12.6, 0.08, 1.2)));
    for (let i = 0; i <= cellsX; i++) shelves.setMatrixAt(n++, tmpM.compose(tmpP.set(-6.3 + i * 0.9, 2.8, -7.3), tmpQ.identity(), tmpS.set(0.07, 4.7, 1.2))); }
  gA.add(shelves);
  const NSC = 210; const scrollG = new THREE.CylinderGeometry(0.11, 0.11, 1.0, 10); scrollG.rotateX(Math.PI / 2);
  const scrolls = new THREE.InstancedMesh(scrollG, new THREE.MeshStandardMaterial({ color: '#d8c49a', roughness: 0.9 }), NSC);
  { const r = rng(9); let n = 0; for (let s = 0; s < shelfN - 1; s++) for (let c = 0; c < cellsX; c++) { const k = 2 + Math.floor(r() * 3); for (let j = 0; j < k && n < NSC; j++) {
    const x = -6.3 + c * 0.9 + 0.2 + (j % 3) * 0.25 + (r() - .5) * 0.04, y = 0.65 + s * 1.15 + 0.11 + Math.floor(j / 3) * 0.2;
    scrolls.setMatrixAt(n, tmpM.compose(tmpP.set(x, y, -7.2 + r() * 0.15), tmpQ.setFromEuler(eul.set(0, (r() - .5) * 0.2, 0)), tmpS.set(1, 1, 0.9 + r() * 0.2)));
    scrolls.setColorAt(n, col('#d8c49a').multiplyScalar(0.5 + r() * 0.6)); n++; } } scrolls.count = n; }
  gA.add(scrolls);
  // стол и раскрывающийся свиток
  const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.6), woodM); table.position.set(0, 1.0, -1.5); gA.add(table);
  [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), woodM); l.position.set(x, 0.5, -1.5 + z); gA.add(l); });
  const parch = lib.canvasTexture(1024, 384, (g, w, h) => { const r = rng(14);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#c8ad7a'); gr.addColorStop(0.5, '#e4cf9e'); gr.addColorStop(1, '#c4a774'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(50,28,12,0.85)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let colN = 0; colN < 5; colN++) for (let ln = 0; ln < 13; ln++) { let x = 40 + colN * 200 + 160; const y = 46 + ln * 23;
      while (x > 40 + colN * 200 + r() * 20) { const cw = 7 + r() * 7; g.beginPath(); const k = Math.floor(r() * 4);
        if (k === 0) { g.moveTo(x, y - 7); g.lineTo(x - cw, y - 7); g.lineTo(x - cw, y + 5); } else if (k === 1) { g.moveTo(x, y - 7); g.lineTo(x, y + 6); g.moveTo(x - cw, y - 7); g.lineTo(x, y - 7); }
        else if (k === 2) { g.moveTo(x - cw, y - 7); g.lineTo(x, y - 7); g.lineTo(x, y + 6); g.lineTo(x - cw, y + 6); } else { g.moveTo(x - cw * .5, y - 7); g.lineTo(x - cw * .5, y + 2); }
        g.stroke(); x -= cw + 4; if (r() < 0.12) x -= 8; } }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,60,30,${r() * 0.08})`; g.beginPath(); g.arc(r() * w, r() * h, 10 + r() * 60, 0, 7); g.fill(); } });
  const PW = 2.4;
  const sheetG = new THREE.PlaneGeometry(1, 0.9); sheetG.translate(0.5, 0, 0); sheetG.rotateX(-Math.PI / 2);
  const sheet = new THREE.Mesh(sheetG, new THREE.MeshStandardMaterial({ map: parch, roughness: 0.85, emissive: '#3a2410', emissiveIntensity: 0.25 })); sheet.position.set(-PW / 2, 1.075, -1.5); gA.add(sheet);
  const rollG = new THREE.CylinderGeometry(0.075, 0.075, 1.0, 16); rollG.rotateX(Math.PI / 2);
  const rollM = new THREE.MeshStandardMaterial({ color: '#c8b080', roughness: 0.85 });
  const rollL = new THREE.Mesh(rollG, rollM); rollL.position.set(-PW / 2 - 0.05, 1.13, -1.5); gA.add(rollL);
  const rollR = new THREE.Mesh(rollG, rollM); rollR.position.set(-PW / 2, 1.13, -1.5); gA.add(rollR);
  [rollL, rollR].forEach((rl) => [-0.55, 0.55].forEach((z) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), woodM); k.rotation.x = Math.PI / 2; k.position.z = z; rl.add(k); }));
  // свечи
  const candles = [[1.15, -1.95, 0.45], [1.45, -1.2, 0.3], [-1.45, -2.05, 0.38]].map(([x, z, h], i) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, h, 10), new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.6, emissive: '#5a3a10', emissiveIntensity: 0.4 })); c.position.set(x, 1.06 + h / 2, z); gA.add(c);
    const f = lib.fire({ count: 50, radius: 0.02, height: 0.16, size: 3.2, seed: 20 + i, intensity: 1.1 }); f.position.set(x, 1.07 + h, z); gA.add(f);
    const gl = lib.glow('#ffb860', 0.9, 0.55); gl.position.set(x, 1.15 + h, z); gA.add(gl); return gl; });
  const candleL = new THREE.PointLight('#ffa850', 6, 12, 1.6); candleL.position.set(0.8, 1.9, -1.5); gA.add(candleL);
  const shelfL = new THREE.PointLight('#ff9a50', 3, 9, 1.5); shelfL.position.set(1.5, 2.5, -5.2); gA.add(shelfL);
  // окно и лучи
  const winG = lib.glow('#ffe0b0', 3.5, 0.6); winG.position.set(-7.9, 5.2, -3); gA.add(winG);
  const winP = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), new THREE.MeshBasicMaterial({ color: '#ffe2b8' })); winP.rotation.y = Math.PI / 2; winP.position.set(-7.95, 5.2, -3); gA.add(winP);
  const beams = [0, 1, 2].map((i) => { const b = lib.lightBeam({ radiusTop: 0.7, radiusBottom: 1.6, length: 11, color: '#ffd8a0', opacity: 0.32 - i * 0.06 }); b.position.set(-7.9, 5.3 - i * 0.3, -3 + (i - 1) * 0.35); b.rotation.set(0.05 * (i - 1), 0, 1.0 + i * 0.04); gA.add(b); return b; });
  const dust = lib.motes({ count: 380, box: [8, 3.5, 2.2], center: [-3.6, 3.0, -3], size: 0.7, color: '#ffe0b0', speed: 0.12, opacity: 0.9, seed: 31 }); gA.add(dust);
  const winSun = new THREE.DirectionalLight('#ffd8a8', 1.2); winSun.position.set(-8, 6, -3); winSun.target.position.set(0, 1, -1.5); gA.add(winSun, winSun.target);

  // ================= B/C1. Пепелище Иова + вихрь =================
  const gB = new THREE.Group(); scene.add(gB);
  const hB = (x, z) => (fbm(x * 0.012, z * 0.012, 4) * 7 + Math.max(0, -z - 80) * 0.05) * smooth(10, 45, Math.hypot(x, z));
  gB.add(lib.terrain({ size: 600, seg: 150, center: [0, -150], heightFn: hB, colorFn: (x, z, y, sl) => col('#4a4642').lerp(col('#2a2826'), clamp(noise2(x * 0.08, z * 0.08) * 0.8 + 0.4)) }));
  const heap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 1, flatShading: true }));
  { const p = heap.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) * (0.9 + 0.25 * noise2(x * 3, z * 3))); } heap.geometry.computeVertexNormals(); }
  heap.scale.set(2.4, 0.95, 2.0); gB.add(heap);
  const ruinM = new THREE.MeshStandardMaterial({ color: '#6a625a', roughness: 1, flatShading: true });
  { const r = rng(41); const blocks = []; const walls = [[-9, -6, 0.35, 9], [6, -12, -0.4, 11], [-22, -30, 0.1, 14], [14, -40, 0.8, 10], [-4, -60, 0, 16], [30, -20, 1.4, 8]];
    walls.forEach(([x0, z0, a, len]) => { const cs = Math.cos(a), sn = Math.sin(a); for (let i = 0; i < len; i++) { const top = Math.max(0, Math.floor((1 - Math.abs(i / len - 0.4) * 1.6) * 6 * (0.4 + r() * 0.8))); for (let j = 0; j <= top; j++) { if (r() < 0.12) continue; const x = x0 + cs * i * 0.85, z = z0 - sn * i * 0.85; blocks.push([x, hB(x, z) + 0.25 + j * 0.5, z, a + (r() - .5) * 0.08]); } } });
    for (let i = 0; i < 40; i++) { const x = (r() - .5) * 60, z = -r() * 60; blocks.push([x, hB(x, z) + 0.1, z, r() * 3]); }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.82, 0.48, 0.6), ruinM, blocks.length);
    blocks.forEach(([x, y, z, a], i) => { im.setMatrixAt(i, tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(eul.set((r() - .5) * 0.1, a, (r() - .5) * 0.1)), tmpS.set(1, 1, 1))); im.setColorAt(i, col('#7a726a').multiplyScalar(0.6 + r() * 0.5)); });
    gB.add(im); }
  // мёртвое дерево
  { const tm = new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 1 }); const tr = new THREE.Group(); tr.position.set(5, hB(5, -4), -4); gB.add(tr);
    const seg = (x, y, z, l, rx, rz, r0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 0.6, r0, l, 6), tm); m.geometry.translate(0, l / 2, 0); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); tr.add(m); return m; };
    seg(0, 0, 0, 3.2, 0, 0.1, 0.18); seg(-0.2, 2.2, 0, 1.6, 0.2, 0.8, 0.08); seg(-0.25, 2.8, 0, 1.4, -0.3, -0.7, 0.07); seg(-0.3, 3.0, 0, 1.0, 0, 0.3, 0.05); }
  const job = lib.figure({ height: 1.75, robe: '#3a3632', skin: '#7a5a44', hood: false, seed: 13, belt: '#2a2420' });
  job.position.set(0, 0.9 - 0.55, 0); job.rotation.y = 0.5; job.parts.body.rotation.x = 0.18; job.parts.head.position.z = 0.12; job.parts.head.position.y -= 0.1;
  job.parts.arms[0].rotation.set(-0.8, 0, -0.1); job.parts.arms[1].rotation.set(-0.9, 0, 0.1); gB.add(job);
  const ash = wind({ count: 1400, box: [70, 5, 50], center: [0, 1.8, -10], color: '#a8a098', size: 2.2, speed: 5, opacity: 0.45, seed: 5 }); gB.add(ash);
  const cloudsB = lib.cloudLayer({ count: 20, area: [700, 400], y: 70, scale: [200, 70], seed: 3, color: '#5a5a62', opacity: 0.8, center: [0, -260] }); gB.add(cloudsB);
  // вихрь
  const vortexU = { time: { value: 0 }, op: { value: 0 }, flash: { value: 0 } };
  const vortexG = new THREE.CylinderGeometry(34, 2.5, 150, 64, 30, true); vortexG.translate(0, 75, 0);
  const vortex = new THREE.Mesh(vortexG, new THREE.ShaderMaterial({ uniforms: vortexU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `uniform float time; varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec3 p = position; float k = uv.y;
      p.x += sin(k*6. + time*1.5)*4.*k + sin(k*2.+time*.6)*3.; p.z += cos(k*5. + time*1.2)*3.*k;
      vec4 mv = modelViewMatrix*vec4(p,1.); vec3 n = normalize(normalMatrix*normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: lib.GLSL_NOISE + `uniform float time, op, flash; varying vec2 vUv; varying float vF;
      void main(){ vec2 q = vec2(vUv.x*6. + vUv.y*5. - time*.9, vUv.y*4. - time*.25);
        float n = fbm2(q*vec2(1.,2.)); float s = smoothstep(.35,.75,n);
        float edge = smoothstep(.0,.5,vF) * smoothstep(0.,.08,vUv.y) * smoothstep(1.,.75,vUv.y);
        vec3 c = mix(vec3(.08,.09,.11), vec3(.42,.44,.5), s); c += vec3(.75,.8,1.)*flash*s*smoothstep(.55,.9,n);
        gl_FragColor = vec4(c, op*edge*(.45+.55*s)); }` }));
  vortex.position.set(0, 0, -45); gB.add(vortex);
  const vortexGlow = lib.glow('#cfd8ff', 60, 0); vortexGlow.position.set(0, 30, -45); gB.add(vortexGlow);

  // ================= C2. Космос: основания земли =================
  const gC = new THREE.Group(); scene.add(gC);
  const PR = 60;
  const planetU = { time: { value: 0 }, form: { value: 0 }, sunW: { value: new THREE.Vector3(1, 0.5, 0.3).normalize() } };
  const planet = new THREE.Mesh(new THREE.SphereGeometry(PR, 96, 64), new THREE.ShaderMaterial({ uniforms: planetU,
    vertexShader: `varying vec3 vO; varying vec3 vN; varying vec3 vW; void main(){ vO = normalize(position); vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: lib.GLSL_NOISE + `uniform float time, form; uniform vec3 sunW; varying vec3 vO; varying vec3 vN; varying vec3 vW;
      float tri(vec3 p){ return (fbm2(p.xy*2.3+3.) + fbm2(p.yz*2.3+7.) + fbm2(p.zx*2.3+11.))/3.; }
      void main(){ vec3 p = vO; float h = tri(p*1.6 + vec3(0., time*.01, 0.));
        float cr = abs(tri(p*4. + vec3(time*.03)) - .5); float crack = smoothstep(.04, .0, cr);
        vec3 molten = mix(vec3(.06,.025,.015), vec3(.22,.08,.03), h) + vec3(1.,.38,.08)*crack*(1.-form*.9)*1.4;
        float land = smoothstep(.49,.53,h);
        vec3 earth = mix(vec3(.03,.1,.2), vec3(.05,.17,.28), h*1.5); earth = mix(earth, mix(vec3(.18,.2,.09), vec3(.32,.26,.16), smoothstep(.55,.7,h)), land);
        float cl = smoothstep(.55,.75, tri(p*3. + vec3(time*.02,0.,0.))); earth = mix(earth, vec3(.75,.78,.8), cl*.6*form);
        vec3 n = normalize(vN); float dif = max(dot(n, sunW), 0.);
        vec3 c = mix(molten*(.35+dif), earth*(.08+dif*1.3), form) + vec3(1.,.38,.08)*crack*(1.-form)*.7;
        vec3 v = normalize(cameraPosition - vW); float fr = pow(1.-max(dot(n,v),0.), 3.);
        c += mix(vec3(.9,.4,.15), vec3(.35,.6,1.), form) * fr * (.25 + dif*.9);
        gl_FragColor = vec4(c, 1.); }` }));
  gC.add(planet);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(PR * 1.06, 64, 32), new THREE.ShaderMaterial({ uniforms: { form: planetU.form, sunW: planetU.sunW }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float form; uniform vec3 sunW; varying vec3 vN; varying vec3 vW; void main(){ vec3 v = normalize(cameraPosition - vW); float d = max(dot(-normalize(vN), v), 0.);
      float a = pow(smoothstep(0., .45, d), 2.) * smoothstep(.62, .3, d); float s = .3 + .7*max(dot(-normalize(vN), sunW)*.5+.5, 0.);
      gl_FragColor = vec4(mix(vec3(1.,.5,.2), vec3(.4,.65,1.), form)*a*s*.9, 1.); }` }));
  gC.add(atmo);
  // столпы света — «основания»
  const pillars = []; { const r = rng(77); for (let i = 0; i < 9; i++) {
    const th = (i / 9 - 0.5) * 2.4 + (r() - .5) * 0.15, ph = 0.75 + r() * 0.35; const n = new THREE.Vector3(Math.sin(th) * Math.sin(ph), Math.cos(ph), Math.cos(th) * Math.sin(ph)).normalize();
    const b = lib.lightBeam({ radiusTop: 0.7, radiusBottom: 1.6, length: 26 + r() * 22, color: '#ffd9a0', opacity: 0 }); b.position.copy(n).multiplyScalar(PR * 0.995);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), n); b.userData = { d: r() * 1.5 }; gC.add(b); pillars.push(b); } }
  // аккреционное кольцо
  const ringN = 9000; const ringG = new THREE.BufferGeometry(); { const r = rng(55); const p = new Float32Array(ringN * 3), sd = new Float32Array(ringN * 2);
    for (let i = 0; i < ringN; i++) { const rad = PR * (1.5 + Math.pow(r(), 1.6) * 2.2); p.set([rad, (r() - .5) * 2.2 * (rad / PR - 1), r() * Math.PI * 2], i * 3); sd.set([r(), r()], i * 2); }
    ringG.setAttribute('position', new THREE.BufferAttribute(p, 3)); ringG.setAttribute('sd', new THREE.BufferAttribute(sd, 2)); }
  const ringU = { time: { value: 0 }, op: { value: 1 }, pxr: { value: 1 }, pull: { value: 0 } };
  const ring = new THREE.Points(ringG, new THREE.ShaderMaterial({ uniforms: ringU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec2 sd; uniform float time, pxr, pull; varying float vA; varying float vH; void main(){ float rad = position.x*(1.-pull*.25*sd.x); float a = position.z + time*(9./rad);
      vec3 q = vec3(cos(a)*rad, position.y, sin(a)*rad); vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv; vA = .4+.6*sd.y; vH = sd.x;
      gl_PointSize = (1.+sd.y*2.6)*pxr*(220./max(-mv.z,1.)); }`,
    fragmentShader: `uniform float op; varying float vA; varying float vH; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d);
      gl_FragColor = vec4(mix(vec3(1.,.62,.3), vec3(.75,.8,1.), vH)*a*a*vA*op*.55, 1.); }` }));
  ring.rotation.set(0.32, 0, 0.16); ring.frustumCulled = false; gC.add(ring);
  const starsC = lib.starfield({ count: 7000, radius: 1400, size: 2.3, minY: -1, seed: 9 }); gC.add(starsC);
  const sunC = lib.glow('#ffd8a0', 240, 0.75); sunC.position.set(900, 420, -900); gC.add(sunC);
  const nebula = []; { const tx = [lib.cloudTexture(61), lib.cloudTexture(62)]; const r = rng(66); for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx[i % 2], color: i % 2 ? '#3a2a6a' : '#6a3a2a', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.position.set((r() - .5) * 1600, 200 + r() * 500, -900 - r() * 200); sp.scale.set(700, 400, 1); gC.add(sp); nebula.push(sp); } }

  // ================= D. Псалмы: арфа под звёздами =================
  const gD = new THREE.Group(); scene.add(gD);
  const hD = (x, z) => 9 * Math.exp(-(x * x + z * z) / 900) + fbm(x * 0.01, z * 0.01, 4) * 8 - 6 + Math.max(0, -z - 150) * 0.12;
  gD.add(lib.terrain({ size: 900, seg: 140, center: [0, -200], heightFn: hD, colorFn: (x, z, y) => col('#1a2430').lerp(col('#0a1018'), clamp(noise2(x * 0.03, z * 0.03) + 0.5)) }));
  const HY = hD(0, 0);
  const harp = new THREE.Group(); harp.position.set(0, HY, 0); gD.add(harp);
  const goldM = new THREE.MeshStandardMaterial({ color: '#d8a848', metalness: 0.6, roughness: 0.3, emissive: '#6a4410', emissiveIntensity: 0.5 });
  const tube = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 40, r, 8), goldM);
  harp.add(tube([[0.9, 0.05, 0], [0.92, 1.2, 0], [0.86, 2.5, 0], [0.8, 3.2, 0]], 0.07)); // колонна
  const neckPts = [[0.8, 3.2, 0], [0.3, 3.05, 0], [-0.2, 2.6, 0], [-0.6, 2.4, 0], [-0.9, 2.55, 0]]; harp.add(tube(neckPts, 0.06));
  const boxPts = [[-0.9, 2.55, 0], [-0.4, 1.4, 0], [0.1, 0.4, 0], [0.9, 0.05, 0]]; harp.add(tube(boxPts, 0.11));
  const neckC = new THREE.CatmullRomCurve3(neckPts.map((p) => new THREE.Vector3(...p))), boxC = new THREE.CatmullRomCurve3(boxPts.map((p) => new THREE.Vector3(...p)));
  const strings = []; const NSTR = 15;
  for (let i = 0; i < NSTR; i++) { const k = (i + 1) / (NSTR + 1); const top = neckC.getPoint(1 - k), x = top.x;
    let bot = boxC.getPoint(0.5); { let best = 1e9; for (let j = 0; j <= 60; j++) { const p = boxC.getPoint(j / 60); const d = Math.abs(p.x - x); if (d < best) { best = d; bot = p; } } }
    const len = top.y - bot.y; if (len <= 0.05) continue;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 4), new THREE.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(x, bot.y + len / 2, 0); harp.add(m); strings.push(m); }
  const harpGlow = lib.glow('#ffc870', 6, 0.4); harpGlow.position.set(0, HY + 1.6, 0); gD.add(harpGlow);
  const ringM = []; for (let i = 0; i < 6; i++) { const u = { op: { value: 0 } };
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 128, 1), new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float op; void main(){ gl_FragColor = vec4(vec3(1.,.72,.32)*op, 1.); }` }));
    m.rotation.x = -Math.PI / 2; m.userData.u = u; gD.add(m); ringM.push(m); }
  const notes = lib.motes({ count: 500, box: [16, 14, 16], center: [0, HY + 6, 0], size: 2.4, color: '#ffd890', speed: 0.35, kind: 'rise', opacity: 0.8, seed: 81 }); gD.add(notes);
  const starsD = lib.starfield({ count: 8000, radius: 1400, size: 2.6, minY: 0.0, seed: 17 }); gD.add(starsD);
  const milky = []; { const tx = lib.cloudTexture(71); const r = rng(72); for (let i = 0; i < 10; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, color: '#4a5a8a', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    const a = i / 10; sp.position.set(lerp(-900, 700, a), 250 + Math.sin(a * 3) * 120 + r() * 60, -1000); sp.scale.set(420, 200, 1); sp.material.rotation = -0.4; gD.add(sp); milky.push(sp); } }

  // ================= E/F. Пустыня: песочные часы, следы, дворец в дюнах =================
  const gE = new THREE.Group(); scene.add(gE);
  const hE = (x, z) => { const d = Math.sin(x * 0.045 + fbm(x * 0.01, z * 0.01, 3) * 2.5 + z * 0.015) * 3.2 + fbm(x * 0.02, z * 0.02, 4) * 5; return d * smooth(22, 70, Math.hypot(x, z * 0.8)) + Math.max(0, -z - 200) * 0.03; };
  gE.add(lib.terrain({ size: 900, seg: 180, center: [0, -250], heightFn: hE, colorFn: (x, z, y, sl) => col('#b88a58').lerp(col('#e0b47a'), clamp(y / 8 + 0.5)).lerp(col('#8a5e38'), clamp(sl * 3)).multiplyScalar(0.9 + 0.1 * noise2(x * 0.5, z * 0.5)) }));
  // песочные часы
  const hg = new THREE.Group(); hg.position.set(0.0, hE(0, 0), 0); gE.add(hg);
  const hgWood = new THREE.MeshStandardMaterial({ color: '#4a2c16', roughness: 0.6 });
  [0.03, 0.97].forEach((y) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24), hgWood); d.position.y = y; hg.add(d); });
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.9, 8), hgWood); p.position.set(Math.cos(a) * 0.25, 0.5, Math.sin(a) * 0.25); hg.add(p); }
  const glassProf = []; for (let i = 0; i <= 24; i++) { const y = 0.06 + i / 24 * 0.88; const k = Math.abs(y - 0.5) / 0.44; glassProf.push(new THREE.Vector2(0.03 + 0.17 * Math.pow(Math.sin(Math.min(k, 1) * Math.PI * 0.62 + 0.0), 1.2), y)); }
  const glass = new THREE.Mesh(new THREE.LatheGeometry(glassProf, 32), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying float vF; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vec3 n = normalize(normalMatrix*normal); vF = 1.-abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vF; void main(){ gl_FragColor = vec4(vec3(1.,.9,.75)*(pow(vF,3.)*.55 + .02), 1.); }` }));
  hg.add(glass);
  const sandM = new THREE.MeshStandardMaterial({ color: '#e0b070', roughness: 1, emissive: '#5a3a14', emissiveIntensity: 0.3 });
  const topSand = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 24), sandM); topSand.rotation.x = Math.PI; hg.add(topSand);
  const botSand = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.2, 24), sandM); hg.add(botSand);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.4, 4), sandM); stream.position.y = 0.3; hg.add(stream);
  // следы
  const NF = 46; const footG = new THREE.CircleGeometry(0.5, 12); footG.rotateX(-Math.PI / 2);
  const feet = new THREE.InstancedMesh(footG, new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true }), NF);
  const footD = []; for (let i = 0; i < NF; i++) { const s = i % 2 ? 1 : -1; const z = -1.0 - i * 0.62; const x = 0.9 + Math.sin(i * 0.07) * 2.0 + s * 0.17; footD.push([x, z]); }
  feet.material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { erase: { value: 0 } },
    vertexShader: `attribute float fi; varying vec2 vU; varying float vI; void main(){ vU = uv; vI = fi; gl_Position = projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float erase; varying vec2 vU; varying float vI; void main(){ vec2 p = vU-.5; float d = length(p*vec2(1.8,1.)); float a = smoothstep(.5,.25,d)*.6*(1.-smoothstep(erase-.06, erase+.02, vI));
      gl_FragColor = vec4(vec3(.32,.18,.08), a); }` });
  { const fi = new Float32Array(NF); for (let i = 0; i < NF; i++) { const [x, z] = footD[i]; fi[i] = 1 - i / NF; feet.setMatrixAt(i, tmpM.compose(tmpP.set(x, hE(x, z) + 0.06, z), tmpQ.setFromEuler(eul.set(0, 0.05, 0)), tmpS.set(0.32, 1, 0.5))); }
    feet.geometry = footG.clone(); feet.geometry.setAttribute('fi', new THREE.InstancedBufferAttribute(fi, 1)); }
  gE.add(feet);
  // дворец
  const palace = new THREE.Group(); palace.position.set(0, 0, -150); gE.add(palace);
  { const pm = new THREE.MeshStandardMaterial({ color: '#c8a880', roughness: 0.95 }); const r = rng(91);
    const add = (geo, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, pm); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); palace.add(m); return m; };
    add(new THREE.BoxGeometry(70, 4, 26), 0, 2, 0);
    for (let i = 0; i < 12; i++) { const x = -30 + i * 5.4; const h = [22, 22, 15, 22, 9, 22, 22, 18, 6, 22, 13, 22][i]; add(new THREE.CylinderGeometry(1.1, 1.3, h, 14), x, 4 + h / 2, 9); add(new THREE.BoxGeometry(2.8, 1, 2.8), x, 4.5 + h, 9); }
    add(new THREE.BoxGeometry(17, 2.2, 3), -24.6, 28, 9); add(new THREE.BoxGeometry(11, 2.2, 3), 13, 28, 9); add(new THREE.BoxGeometry(6, 2.2, 3), 27, 28, 9, 0, 0.06);
    add(new THREE.BoxGeometry(46, 30, 4), -6, 19, -6); add(new THREE.BoxGeometry(14, 22, 4), 22, 15, -6, 0, -0.05);
    add(new THREE.CylinderGeometry(1.1, 1.3, 20, 14), 4, 5.5, 22, Math.PI / 2 - 0.1, 0.4);
    // арка-проём в стене
    const arch = add(new THREE.BoxGeometry(8, 16, 5), -6, 12, -6); arch.material = new THREE.MeshBasicMaterial({ color: '#2a1608' });
    for (let i = 0; i < 20; i++) add(new THREE.BoxGeometry(2 + r() * 3, 1.2 + r() * 1.5, 2 + r() * 2), (r() - .5) * 80, 1 + r(), 14 + r() * 16, r(), r());
  }
  const sandWind = wind({ count: 2400, box: [90, 4, 60], center: [0, 1.2, -18], color: '#e8c088', size: 1.6, speed: 7, opacity: 0.4, seed: 7 }); gE.add(sandWind);
  const sandWindFar = wind({ count: 1200, box: [300, 18, 160], center: [0, 6, -140], color: '#d8a878', size: 9, speed: 18, opacity: 0.16, seed: 8 }); gE.add(sandWindFar);
  const hazeE = lib.cloudLayer({ count: 12, area: [600, 200], y: 8, scale: [240, 30], seed: 21, color: '#e0b080', opacity: 0.35, center: [0, -170] }); gE.add(hazeE);

  // ================= G. Сад на рассвете =================
  const gG = new THREE.Group(); scene.add(gG);
  const hG = (x, z) => fbm(x * 0.02, z * 0.02, 4) * 3 + Math.max(0, -z - 90) * 0.1 + 1.5 * Math.exp(-((x - 4) ** 2 + (z + 40) ** 2) / 300);
  gG.add(lib.terrain({ size: 600, seg: 150, center: [0, -150], heightFn: hG, colorFn: (x, z) => col('#3a5a24').lerp(col('#5a7a30'), clamp(noise2(x * 0.06, z * 0.06) * 0.6 + 0.5)).multiplyScalar(0.7) }));
  const TREE = [4, -40];
  const fig = new THREE.Group(); fig.position.set(TREE[0], hG(...TREE), TREE[1]); gG.add(fig);
  { const bark = new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 1 }); const leaf = new THREE.MeshStandardMaterial({ color: '#2a4a1c', roughness: 0.9 }); const leaf2 = new THREE.MeshStandardMaterial({ color: '#3a5a22', roughness: 0.9 });
    const br = (x, y, z, l, rx, rz, r0) => { const g = new THREE.CylinderGeometry(r0 * 0.55, r0, l, 7); g.translate(0, l / 2, 0); const m = new THREE.Mesh(g, bark); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); fig.add(m); };
    br(0, 0, 0, 3.5, 0, 0.08, 0.5); br(-0.2, 3, 0, 3.5, 0.3, 0.9, 0.3); br(0, 3.1, 0, 3.6, -0.4, -0.8, 0.3); br(0, 3.2, 0, 3.2, 0.6, 0.1, 0.25); br(0, 3.2, 0, 3, -0.7, 0.2, 0.25);
    const r = rng(101); const cg = new THREE.IcosahedronGeometry(1, 3);
    for (let i = 0; i < 34; i++) { const a = r() * Math.PI * 2, d = r() * 5.2; const m = new THREE.Mesh(cg, i % 3 ? leaf : leaf2); m.position.set(Math.cos(a) * d, 5.6 + r() * 2.6 - d * 0.25, Math.sin(a) * d); const s = 1.4 + r() * 1.4; m.scale.set(s, s * 0.7, s); fig.add(m); } }
  const lovers = [0, 1].map((i) => { const f = lib.figure({ height: 1.7 - i * 0.1, robe: i ? '#e8c0b8' : '#6a4a8a', skin: '#9a6a4a', hood: i === 1, hoodColor: '#e8d0c0', seed: 111 + i }); f.position.set(TREE[0] - 0.4 + i * 0.75, hG(TREE[0], TREE[1] + 2) - 0.02, TREE[1] + 2.5); f.rotation.y = i ? -1.3 : 1.3; gG.add(f); return f; });
  lovers[0].parts.arms[0].rotation.set(-0.5, 0, -0.5); lovers[1].parts.arms[1].rotation.set(-0.5, 0, 0.5);
  // лилии
  const NL = 900; const lilyG = (() => { const parts = []; for (let i = 0; i < 6; i++) { const g = new THREE.PlaneGeometry(0.07, 0.2).toNonIndexed(); g.translate(0, 0.1, 0); g.rotateX(-0.55 - (i % 2) * 0.25); g.rotateY(i / 6 * Math.PI * 2); parts.push(g); }
    const n = parts.reduce((a, g) => a + g.attributes.position.count, 0); const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    parts.forEach((g) => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; });
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); gg.translate(0, 0.6, 0); return gg; })();
  const lilies = new THREE.InstancedMesh(lilyG, new THREE.MeshStandardMaterial({ color: '#f4ece0', roughness: 0.6, emissive: '#6a4a3a', emissiveIntensity: 0.3, side: THREE.DoubleSide }), NL);
  const stemG = new THREE.CylinderGeometry(0.012, 0.015, 0.6, 3); stemG.translate(0, 0.3, 0);
  const stems = new THREE.InstancedMesh(stemG, new THREE.MeshStandardMaterial({ color: '#2a4a1a', roughness: 1 }), NL);
  const lilyD = []; { const r = rng(121); let n = 0; while (n < NL) { const x = (r() - .5) * 46, z = 14 - r() * 52; if (Math.abs(x - 0.3 - z * 0.05) < 1.2) continue; const s = 0.7 + r() * 0.6; lilyD.push([x, z, s, r() * 6, r() * 0.3]);
    lilies.setColorAt(n, col(r() < 0.25 ? '#f0b8c0' : '#f8f0e4').multiplyScalar(0.8 + r() * 0.3)); n++; } }
  gG.add(lilies, stems);
  // арка из лоз на переднем плане
  { const vm = new THREE.MeshStandardMaterial({ color: '#2a3a18', roughness: 1 }); const lm = new THREE.MeshStandardMaterial({ color: '#3a6a24', roughness: 0.8, side: THREE.DoubleSide });
    const r = rng(131); const leafG = new THREE.CircleGeometry(0.18, 5); const NLV = 700; const lv = new THREE.InstancedMesh(leafG, lm, NLV); let n = 0;
    for (let k = 0; k < 4; k++) { const x0 = k < 2 ? -3.6 : 3.6; const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12; pts.push(new THREE.Vector3(x0 + Math.sin(a * 9 + k) * 0.25 + (k % 2) * 0.2, hG(x0, 6) + Math.sin(a * Math.PI) * 0 + a * 5.2, 6 + (k % 2) * 0.3)); }
      const top = []; if (k === 0) for (let i = 0; i <= 16; i++) { const a = i / 16; top.push(new THREE.Vector3(lerp(-3.6, 3.6, a), hG(0, 6) + 5.2 + Math.sin(a * Math.PI) * 1.6 + Math.sin(a * 20) * 0.12, 6 + Math.sin(a * 7) * 0.2)); }
      [pts, top].forEach((pp) => { if (pp.length < 2) return; const cv = new THREE.CatmullRomCurve3(pp); gG.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 40, 0.05, 5), vm));
        for (let i = 0; i < 100 && n < NLV; i++) { const p = cv.getPoint(r()); lv.setMatrixAt(n, tmpM.compose(tmpP.set(p.x + (r() - .5) * 0.5, p.y + (r() - .5) * 0.4, p.z + (r() - .5) * 0.4), tmpQ.setFromEuler(eul.set(r() * 6, r() * 6, r() * 6)), tmpS.setScalar(0.7 + r() * 0.8))); lv.setColorAt(n, col('#3a6a24').multiplyScalar(0.6 + r() * 0.7)); n++; } }); }
    lv.count = n; gG.add(lv);
    const bl = lib.motes({ count: 1, box: [1, 1, 1] }); void bl; }
  const petals = lib.motes({ count: 700, box: [40, 10, 50], center: [0, 3, -12], size: 2.2, color: '#ffd0c8', speed: 0.3, kind: 'dust', opacity: 0.7, seed: 141 }); gG.add(petals);
  const mistG = lib.cloudLayer({ count: 10, area: [300, 120], y: 2, scale: [120, 14], seed: 151, color: '#ffd8c0', opacity: 0.3, center: [0, -90] }); gG.add(mistG);

  const groups = [gA, gB, gC, gD, gE, gG];
  const show = (g) => groups.forEach((x) => (x.visible = x === g));

  return {
    scene, camera,
    update(t, S) {
      const P = S.post; P.bloom = 0.55; P.bloomThreshold = 0.8; P.exposure = 1.0; P.sat = 1.0;
      sky.visible = true; scene.fog.density = 0.004; sun.intensity = 1.5; hemi.intensity = 0.4;
      if (t < C.job) { // ---- келья
        show(gA); sky.visible = false;
        scene.fog.color.set('#140c06'); scene.fog.density = 0.035;
        hemi.color.set('#7a6a58'); hemi.groundColor.set('#1a120a'); hemi.intensity = 0.35; sun.intensity = 0;
        const fl = 0.85 + 0.1 * Math.sin(t * 9.3) * Math.sin(t * 5.7 + 1) + 0.05 * Math.sin(t * 17);
        candleL.intensity = 7 * fl; candles.forEach((g, i) => (g.material.opacity = 0.5 * (fl + 0.05 * Math.sin(t * 11 + i))));
        const un = lib.easeOut(clamp((t - 1.2) / 5.5));
        const w = 0.03 + un * (PW - 0.03); sheet.scale.set(w, 1, 1); parch.repeat.set(w / PW, 1); parch.offset.set(1 - w / PW, 0);
        rollR.position.x = -PW / 2 + w; rollR.rotation.z = -w / 0.075;
        beams.forEach((b, i) => (b.u.opacity.value = (0.3 - i * 0.06) * (0.85 + 0.15 * Math.sin(t * 0.5 + i))));
        P.bloom = 0.65; P.bloomThreshold = 0.72; P.exposure = 1.05;
        cameraPath(camera, [[0, [3.2, 2.9, 4.8], [-0.3, 1.2, -2.2]], [C.job, [1.0, 2.5, 1.2], [-0.4, 1.05, -1.7]]], t);
        handheld(camera, t, 0.004);
      } else if (t < T_COSMOS) { // ---- Иов, затем вихрь
        show(gB);
        const st = ramp(t, C.storm - 1.5, 2.5);
        setSky(cA.set('#3a3c46').lerp(col('#14161c'), st).getStyle(), col('#a08c74').lerp(col('#3a3a40'), st).getStyle(), '#2a2826', [0.5, 0.06, -1], '#e8c8a0', 0.0005, 0.5 * (1 - st));
        scene.fog.color.set('#6a625a').lerp(col('#2a2a2e'), st); scene.fog.density = 0.009 + st * 0.004;
        hemi.color.set('#9aa0aa'); hemi.groundColor.set('#2a2622'); hemi.intensity = 0.65 - st * 0.3; sun.color.set('#d8d0c4'); sun.intensity = 0.9 - st * 0.6; sun.position.set(80, 40, -200); sun.target.position.set(0, 0, 0);
        cloudsB.drift(t, 4, 0); cloudsB.setColor(cA.set('#6a6a72').lerp(col('#202228'), st));
        ash.u.speed.value = 5 + st * 8; ash.u.opacity.value = 0.45 + st * 0.3;
        // Иов: медленно поднимает голову к буре
        const look = ramp(t, C.storm + 0.3, 1.5); job.parts.head.position.z = lerp(0.12, -0.02, look); job.parts.body.rotation.x = lerp(0.18, 0.05, look);
        const desc = ramp(t, C.storm - 0.6, 2.4);
        vortex.visible = t > C.storm - 1; vortexU.op.value = desc * 0.95; vortex.scale.set(1, lerp(0.15, 1, desc), 1); vortex.position.y = lerp(110, 0, desc);
        const lf = Math.max(0, Math.sin(t * 13.7) * Math.sin(t * 5.3) - 0.55) * 2.2 * desc; vortexU.flash.value = lf; vortexGlow.material.opacity = lf * 0.35;
        P.sat = 0.65; P.exposure = 0.95; P.contrast = 1.12; P.tint = [1.02, 0.99, 0.96];
        if (t < C.storm) {
          cameraPath(camera, [[C.job, [-6.0, 1.1, 8.4], [1.2, 1.5, -3]], [C.storm, [-3.4, 0.8, 4.4], [0.4, 1.3, -2]]], t);
          handheld(camera, t, 0.004);
        } else {
          cameraPath(camera, [[C.storm, [-3.5, 0.9, 7], [0, 6, -30]], [T_COSMOS, [-2.0, 0.7, 6], [0, 32, -45]]], t);
          handheld(camera, t * 2, 0.01 + desc * 0.01);
        }
        P.flash = Math.max(0, lf - 0.6) * 0.12 + ramp(t, T_COSMOS - 0.35, 0.35) * 0.5;
        S.quote.y = 0.4;
      } else if (t < C.psalms) { // ---- космос: Земля обретает основания
        show(gC); sky.visible = false; scene.fog.density = 0;
        const k = t - T_COSMOS; const form = ramp(t, T_COSMOS + 0.8, 4.2); planetU.form.value = form;
        pillars.forEach((b) => (b.u.opacity.value = ramp(t, T_COSMOS + 1.6 + b.userData.d, 1.6) * 0.45 * (1 - ramp(t, C.psalms - 1.2, 1))));
        ringU.op.value = 1 - form * 0.55; ringU.pull.value = form; ring.rotation.y = k * 0.03;
        planet.rotation.y = k * 0.05;
        P.flash = (1 - ramp(t, T_COSMOS, 0.6)) * 0.5; P.bloom = 0.7; P.bloomThreshold = 0.6; P.exposure = 1.0; P.vignette = 0.5;
        // рывок прочь от поверхности → спокойный общий план (планета в нижней трети)
        const rush = lib.easeOut(clamp(k / 2.2));
        camera.position.set(lerp(0, -18, rush), lerp(PR + 6, 26, rush), lerp(8, 205, rush) - k * 1.2);
        camera.lookAt(0, lerp(PR - 10, 74, rush), lerp(-60, 0, rush));
        handheld(camera, t, 0.002 + (1 - rush) * 0.01);
        S.quote.y = 0.4;
      } else if (t < C.eccl) { // ---- Псалмы
        show(gD);
        setSky('#030714', '#1a2440', '#05060a', [-0.6, 0.35, -1], '#c8d8ff', 0.012, 0.06, 1.3);
        scene.fog.color.set('#0a1224'); scene.fog.density = 0.006;
        hemi.color.set('#4a5a8a'); hemi.groundColor.set('#05060a'); hemi.intensity = 0.7; sun.color.set('#a8b8ff'); sun.intensity = 0.6; sun.position.set(-150, 120, -200); sun.target.position.set(0, 0, 0);
        const k = t - C.psalms; const beat = (x) => Math.pow(Math.max(0, Math.cos(x * Math.PI * 2 / 1.6)), 6);
        strings.forEach((s, i) => { s.material.color.set('#ffd890').multiplyScalar(0.4 + 0.9 * beat(k - i * 0.05)); s.position.z = Math.sin(t * 40 + i) * 0.006 * beat(k - i * 0.05); });
        ringM.forEach((m, i) => { const ph = (k / 1.6 - i * (1 / 1.0) / 1 + 10) % 6; const age = (k + 10 - i * 1.6) % (6 * 1.6) / 1.6; const R = 1 + age * 9; m.scale.set(R, R, R); m.position.set(0, HY + 0.15 + age * 0.15, 0); m.userData.u.op.value = k > i * 1.6 - 0.01 ? Math.exp(-age * 0.5) * 0.75 * smooth(0, 0.2, age) : 0; void ph; });
        harpGlow.material.opacity = 0.25 + 0.35 * beat(k);
        P.bloom = 0.85; P.bloomThreshold = 0.55; P.exposure = 1.05;
        cameraPath(camera, [[C.psalms, [6.5, HY + 2.4, 8.5], [0, HY + 1.6, 0]], [C.eccl, [-4.5, HY + 1.6, 9.5], [0, HY + 2.2, 0]]], t);
        handheld(camera, t, 0.003);
      } else if (t < C.song) { // ---- Екклесиаст: часы → дворец в песках
        show(gE); hg.visible = true;
        setSky('#5a6a88', '#f0b070', '#8a6040', [0.35, 0.05, -1], '#ffd0a0', 0.03, 0.95);
        scene.fog.color.set('#d8a878'); scene.fog.density = 0.0055;
        hemi.color.set('#c0c8d8'); hemi.groundColor.set('#6a4a2a'); hemi.intensity = 0.6; sun.color.set('#ffc890'); sun.intensity = 2.2; sun.position.set(100, 25, -300); sun.target.position.set(0, 0, 0);
        hazeE.drift(t, 6, 0);
        const sand = clamp(lerp(0.25, 0.85, (t - C.eccl) / (C.song - C.eccl)));
        topSand.scale.setScalar(Math.max(0.01, Math.cbrt(1 - sand))); topSand.position.y = 0.62 + 0.14 * Math.cbrt(1 - sand) * 0.0 + 0.04;
        botSand.scale.set(Math.cbrt(sand) * 1.05, Math.cbrt(sand), Math.cbrt(sand) * 1.05); botSand.position.y = 0.06 + 0.1 * Math.cbrt(sand);
        stream.scale.y = 1; stream.position.y = 0.36;
        feet.material.uniforms.erase.value = lerp(-0.1, 1.05, ramp(t, C.eccl - 0.5, C.vanity - C.eccl + 3));
        palace.position.y = lerp(-1, -9, ramp(t, C.vanity - 3, C.song - C.vanity + 3));
        P.sat = 0.82; P.tint = [1.04, 0.98, 0.92]; P.bloom = 0.5; P.bloomThreshold = 0.8;
        if (t < C.vanity) {
          cameraPath(camera, [[C.eccl, [-1.3, hE(0, 0) + 0.45, 1.6], [0.3, hE(0, 0) + 0.5, -3]], [C.vanity, [-1.0, hE(0, 0) + 0.65, 2.3], [1.0, hE(0, 0) + 0.4, -8]]], t);
          handheld(camera, t, 0.003);
        } else {
          cameraPath(camera, [[C.vanity, [6, 3.2, 15], [0, 7, -150]], [C.song, [4, 5.5, 30], [0, 8, -150]]], t);
          handheld(camera, t, 0.002);
          S.quote.y = 0.42; hg.visible = false; scene.fog.density = 0.003;
        }
      } else { // ---- Песнь Песней: сад на рассвете
        show(gG);
        const k = ramp(t, C.song, 5);
        setSky('#3a4a86', cA.set('#f09078').lerp(col('#ffb888'), k).getStyle(), '#4a3a30', [0.22, 0.015 + k * 0.03, -1], '#ffe0b8', 0.028, 0.6);
        scene.fog.color.set('#d89a88'); scene.fog.density = 0.0045;
        hemi.color.set('#d0c0e0'); hemi.groundColor.set('#3a4a24'); hemi.intensity = 0.75; sun.color.set('#ffc8a0'); sun.intensity = 1.8; sun.position.set(20, 30, -300); sun.target.position.set(0, 0, 0);
        mistG.drift(t, 1.5, 0);
        for (let i = 0; i < NL; i++) { const [x, z, s, ph, tl] = lilyD[i]; const y = hG(x, z); const sw = Math.sin(t * 1.3 + ph) * 0.06;
          tmpQ.setFromEuler(eul.set(tl + sw, ph, sw)); tmpP.set(x, y, z); tmpS.setScalar(s);
          lilies.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS)); stems.setMatrixAt(i, tmpM); }
        lilies.instanceMatrix.needsUpdate = true; stems.instanceMatrix.needsUpdate = true;
        P.bloom = 0.6; P.bloomThreshold = 0.8; P.exposure = 0.95; P.sat = 1.1; P.tint = [1.03, 0.99, 0.97];
        cameraPath(camera, [[C.song, [0.4, hG(0, 14) + 1.4, 14], [TREE[0], hG(...TREE) + 3, TREE[1]]], [S.dur, [1.2, hG(1, -8) + 1.5, -8], [TREE[0], hG(...TREE) + 3.4, TREE[1]]]], t);
        handheld(camera, t, 0.003);
      }
      sky.position.copy(camera.position);
    },
  };
}
