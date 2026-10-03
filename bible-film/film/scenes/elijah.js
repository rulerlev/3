// Илия: гора Кармил над морем — толпа, сотни тёмных жрецов Ваала против одного пророка →
// два жертвенника: жрецы пляшут и кричат, солнце садится; Илия трижды заливает свой жертвенник водой →
// огненный столп с неба: вспышка, ударная волна, искры, вода во рву испаряется (цитата — центр спокойный) →
// огненная колесница с огненными конями в вихре уносит Илию в небо, плащ падает вниз.
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, rng, fbm, noise2, smooth, cameraPath, handheld, easeOut, easeIn } = lib;
  const C = meta.cues;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 4000);
  scene.fog = new THREE.FogExp2('#c08060', 0.0025);
  const col = (c) => new THREE.Color(c);
  function look(keys, t) {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, a] = keys[i], [t1, b] = keys[Math.min(i + 1, keys.length - 1)];
    const k = t1 > t0 ? smooth(0, 1, (t - t0) / (t1 - t0)) : 0; const o = {};
    for (const n in a) o[n] = typeof a[n] === 'number' ? lerp(a[n], b[n], k) : col(a[n]).lerp(col(b[n]), k);
    return o;
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const SUN = V(0.15, 0.12, -1).normalize();
  const TF = C.fire + 0.85; // удар огня (слово «огонь»)

  // ---------- рельеф: плато Кармила, обрыв к морю (-z) ----------
  const hC = (x, z) => {
    const r = Math.hypot(x, z + 2); const flat = smooth(30, 60, r);
    const drop = smooth(-45, -230, z + 18 * Math.sin(x * 0.012));
    const inland = smooth(40, 320, z) * (20 + fbm(x * 0.006, z * 0.006, 3) * 30);
    return (fbm(x * 0.012, z * 0.012, 4) * 5 * flat + fbm(x * 0.2, z * 0.2, 2) * 0.12) * (1 - drop) - drop * 150 + inland + Math.abs(x) * 0.02 * flat;
  };
  const land = lib.terrain({ size: 1500, seg: 165, center: [0, -250], heightFn: hC, roughness: 1,
    colorFn: (x, z, y, sl) => { const n = noise2(x * 0.06, z * 0.06) * 0.5 + 0.5;
      return col('#6a6036').lerp(col('#8a7a4e'), n * 0.6).lerp(col('#6e5e50'), clamp(sl * 2.2)).lerp(col('#4a3e36'), clamp((-y - 20) / 80)).multiplyScalar(0.85 + n * 0.25); } });
  scene.add(land);
  const sea = lib.ocean({ size: 2600, seg: 110, deep: '#0a1a28', shallow: '#244050', sky: '#e09060', amp: 0.4, choppy: 0.8, sunDir: SUN.toArray(), sunColor: '#ffc080' });
  sea.position.set(0, -146, -1000); scene.add(sea);
  const sky = lib.skyDome({ top: '#2a4470', horizon: '#f0a060', bottom: '#3a2418', sunDir: SUN.toArray(), sunColor: '#ffc880', sunSize: 0.03, sunGlow: 1.0, radius: 1800 });
  scene.add(sky);
  const stars = lib.starfield({ count: 3000, radius: 1700, size: 2.2, minY: 0.05, seed: 9 }); stars.u.opacity.value = 0; scene.add(stars);
  const sun = new THREE.DirectionalLight('#ffc890', 2.6); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 300 }); sun.shadow.bias = -0.0008;
  const hemi = new THREE.HemisphereLight('#8aa0c8', '#4a3424', 0.7); scene.add(hemi);
  const clouds = lib.cloudLayer({ count: 22, area: [1400, 900], y: 220, scale: [260, 90], seed: 5, color: '#ffd0b0', opacity: 0.45, center: [0, -600] }); scene.add(clouds);

  // =====================================================================
  // КАРМИЛ: толпы, жертвенники
  // =====================================================================
  const gC = new THREE.Group(); scene.add(gC);
  const AB = V(-8, 0, -4), AE = V(8, 0, -4); AB.y = hC(AB.x, AB.z); AE.y = hC(AE.x, AE.z);

  // толпа инстансами: тело (Lathe) + голова + руки
  function crowd({ count, seed, place, palette, arms = false, skin = '#6a4630' }) {
    const r = rng(seed); const grp = new THREE.Group();
    const prof = [[0, 0], [0.36, 0], [0.31, 0.4], [0.24, 1.0], [0.26, 1.32], [0.19, 1.42], [0.08, 1.48], [0, 1.48]].map(([x, y]) => new THREE.Vector2(x, y));
    const body = new THREE.InstancedMesh(new THREE.LatheGeometry(prof, 7), new THREE.MeshStandardMaterial({ roughness: 0.95 }), count);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 7, 5), new THREE.MeshStandardMaterial({ roughness: 0.9 }), count);
    body.frustumCulled = head.frustumCulled = false; body.castShadow = true; grp.add(body, head);
    let armM = null;
    if (arms) { const ag = new THREE.CylinderGeometry(0.05, 0.075, 0.66, 5); ag.translate(0, -0.33, 0); armM = new THREE.InstancedMesh(ag, body.material, count * 2); armM.frustumCulled = false; grp.add(armM); }
    const data = []; const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const p = place(i, r); p.ph = r() * 20; p.s = p.s || (0.9 + r() * 0.2); p.u = r(); p.v = r(); data.push(p);
      c.set(palette[Math.floor(r() * palette.length)]).multiplyScalar(0.7 + r() * 0.5); body.setColorAt(i, c); if (armM) { armM.setColorAt(i * 2, c); armM.setColorAt(i * 2 + 1, c); }
      head.setColorAt(i, r() < 0.6 ? c.set(skin).multiplyScalar(0.8 + r() * 0.3) : c.multiplyScalar(1.1));
    }
    const mB = new THREE.Matrix4(), mT = new THREE.Matrix4(), mR = new THREE.Matrix4(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), sc = V(1, 1, 1), v = V(0, 0, 0);
    const o = {};
    const pose = (fn) => {
      for (let i = 0; i < count; i++) {
        const d = data[i]; o.x = d.x; o.y = d.y; o.z = d.z; o.ry = d.ry || 0; o.pitch = 0; o.jy = 0; o.ax = 0; o.az = 0.15; o.az2 = null; fn(d, o, i);
        e.set(o.pitch, o.ry, 0, 'YXZ'); q.setFromEuler(e); sc.set(d.s, d.s, d.s); v.set(o.x, o.y + o.jy, o.z); mB.compose(v, q, sc); body.setMatrixAt(i, mB);
        mT.makeTranslation(0, 1.6, 0); m.multiplyMatrices(mB, mT); mT.makeScale(1, 1.12, 1); m.multiply(mT); head.setMatrixAt(i, m);
        if (armM) for (let k = 0; k < 2; k++) { const side = k ? 1 : -1; mT.makeTranslation(side * 0.24, 1.36, 0); e.set(o.ax, 0, side * (k && o.az2 != null ? o.az2 : o.az), 'XYZ'); mR.makeRotationFromEuler(e); m.multiplyMatrices(mB, mT).multiply(mR); armM.setMatrixAt(i * 2 + k, m); }
      }
      body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true; if (armM) armM.instanceMatrix.needsUpdate = true;
    };
    return Object.assign(grp, { pose, data });
  }
  const NP = 130;
  const priests = crowd({ count: NP, seed: 11, arms: true, palette: ['#2a1414', '#3a1a16', '#1e1418', '#4a1e18', '#2a2020', '#341418'], skin: '#5a3a28',
    place: (i, r) => { const ring = Math.floor(Math.sqrt(r()) * 4); const R = 3.2 + ring * 1.6 + r() * 0.6; const a = r() * Math.PI * 2;
      const gx = -20 + r() * 12, gz = -13 + r() * 16; return { R, a, gx, gz, y: 0 }; } });
  gC.add(priests);
  const NI = 230;
  const people = crowd({ count: NI, seed: 12, palette: ['#6a5440', '#7a6248', '#5a4636', '#8a7258', '#6b5a4a', '#7c5a40', '#4e5a6a', '#6a3a30', '#8a7a68'],
    place: (i, r) => { let x, z; do { x = (r() - 0.5) * 64; z = 11 + r() * 16 + Math.abs(x) * 0.08; } while (Math.abs(x - 6) < 2.4 && z < 22); return { x, z, y: hC(x, z), ry: Math.atan2(-x * 0.5, -(z + 4)) + (r() - 0.5) * 0.5 }; } });
  gC.add(people);
  // жертвенник из камней + дрова + жертва
  const stoneG = new THREE.BoxGeometry(0.62, 0.52, 0.62);
  function altar(P, seed, stoneMat) {
    const g = new THREE.Group(); g.position.copy(P); const r = rng(seed);
    const stones = new THREE.Group(); g.add(stones);
    for (let l = 0; l < 3; l++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { if (l === 2 && i === 1 && j === 1) continue;
      const s = new THREE.Mesh(stoneG, stoneMat); s.position.set((i - 1) * 0.6 + (r() - 0.5) * 0.06, 0.26 + l * 0.5, (j - 1) * 0.6 + (r() - 0.5) * 0.06); s.rotation.set((r() - 0.5) * 0.12, (r() - 0.5) * 0.3, (r() - 0.5) * 0.12); s.scale.setScalar(0.92 + r() * 0.16); s.castShadow = true; stones.add(s); }
    const wood = new THREE.Group(); g.add(wood); const wm = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 1 });
    for (let l = 0; l < 3; l++) for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.0, 6), wm); w.rotation.z = Math.PI / 2; if (l % 2) w.rotation.y = Math.PI / 2; const o = (i - 1.5) * 0.4; if (l % 2) w.position.set(o, 1.58 + l * 0.13, 0); else w.position.set(0, 1.58 + l * 0.13, o); wood.add(w); }
    const off = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshStandardMaterial({ color: '#5a2418', roughness: 0.8 })); off.scale.set(1.3, 0.5, 0.6); off.position.y = 2.15; wood.add(off);
    gC.add(g); return { g, stones, wood };
  }
  const stoneMB = new THREE.MeshStandardMaterial({ color: '#7a6a58', roughness: 0.95 });
  const stoneME = new THREE.MeshStandardMaterial({ color: '#7a6e60', roughness: 0.95, emissive: '#ff5010', emissiveIntensity: 0 });
  const altB = altar(AB, 3, stoneMB), altE = altar(AE, 4, stoneME);
  // ров с водой вокруг жертвенника Илии
  const trench = new THREE.Mesh(new THREE.RingGeometry(1.75, 2.45, 48), new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 1 })); trench.rotation.x = -Math.PI / 2; trench.position.set(AE.x, AE.y + 0.03, AE.z); gC.add(trench);
  const waterU = { time: { value: 0 }, level: { value: 0 }, sky: { value: col('#e09060') }, sunDir: { value: SUN.clone() }, sunCol: { value: col('#ffc080') }, glow: { value: 0 } };
  const water = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.4, 48, 2), new THREE.ShaderMaterial({ uniforms: waterU, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: lib.GLSL_NOISE + `uniform float time, level, glow; uniform vec3 sky, sunDir, sunCol; varying vec3 vW;
      void main(){ vec3 v = normalize(cameraPosition - vW); float fr = pow(1. - max(v.y, 0.), 3.);
        vec2 q = vW.xz*6.; float n = vnoise(q + time*1.3) + vnoise(q*1.7 - time);
        vec3 c = mix(vec3(.04,.07,.1), sky, .35 + fr*.6);
        float glint = pow(smoothstep(1.3, 1.95, n), 3.) * (.6 + fr);
        c += sunCol*glint*1.4 + vec3(1.,.5,.2)*glow*(.4 + glint*2.);
        gl_FragColor = vec4(c, level*(.85)); }` }));
  water.rotation.x = -Math.PI / 2; water.position.set(AE.x, AE.y + 0.07, AE.z); gC.add(water);
  // Илия
  const elijah = lib.figure({ height: 1.86, robe: '#7a6248', skin: '#7a5034', hood: true, hoodColor: '#4a3a2a', belt: '#2a1a10', staff: true, seed: 90 });
  gC.add(elijah); elijah.parts.arms.forEach((a) => (a.rotation.order = 'YXZ'));
  const jar = new THREE.Group(); { const jm = new THREE.MeshStandardMaterial({ color: '#9a5a38', roughness: 0.8 }); const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), jm); b.scale.set(1, 1.25, 1); jar.add(b); const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.18, 8), jm); nk.position.y = 0.28; jar.add(nk); }
  gC.add(jar);
  // струя воды: частицы по параболе
  const NS = 500; const strP = new Float32Array(NS * 3), strS = new Float32Array(NS); { const r = rng(15); for (let i = 0; i < NS; i++) { strP.set([r() - 0.5, r() - 0.5, r() - 0.5], i * 3); strS[i] = r(); } }
  const strG = new THREE.BufferGeometry(); strG.setAttribute('position', new THREE.BufferAttribute(strP, 3)); strG.setAttribute('sd', new THREE.BufferAttribute(strS, 1));
  const strU = { time: { value: 0 }, mouth: { value: V(0, 0, 0) }, vel: { value: V(0, 0, 0) }, on: { value: 0 }, pxr: { value: 1 } };
  const stream = new THREE.Points(strG, new THREE.ShaderMaterial({ uniforms: strU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float sd; uniform float time, on, pxr; uniform vec3 mouth, vel; varying float vA;
      void main(){ float a = fract(time*1.6 + sd); float T = a*.55; vec3 p = mouth + vel*T + vec3(0., -4.9*T*T, 0.) + position*vec3(.06,.02,.06)*(1.+a*2.);
        vA = on * smoothstep(0., .05, a) * (1. - smoothstep(.85, 1., a)); vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv; gl_PointSize = pxr*(6. + 4.*fract(sd*13.))*(10./max(-mv.z,1.)); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d); gl_FragColor = vec4(vec3(.75,.85,1.)*a*vA*.55, 1.); }` }));
  stream.frustumCulled = false; gC.add(stream);
  // огненный столп, ударная волна, пламя, искры, пар
  function fireColumn(rTop, rBot, len, c1, c2) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, len, 32, 24, true); geo.translate(0, -len / 2, 0);
    const u = { opacity: { value: 0 }, time: { value: 0 }, c1: { value: col(c1) }, c2: { value: col(c2) } };
    const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: lib.GLSL_NOISE + `uniform vec3 c1, c2; uniform float opacity, time; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
          float n = fbm2(vec2(vUv.x*9., vUv.y*14. + time*9.)); float top = smoothstep(1., .55, vUv.y); float bot = smoothstep(0., .02, vUv.y);
          vec3 c = mix(c2, c1, smoothstep(.35, .8, n)*edge);
          gl_FragColor = vec4(c*edge*(.45 + .9*n)*top*bot*opacity, 1.); }` });
    const mesh = new THREE.Mesh(geo, m); mesh.frustumCulled = false; return Object.assign(mesh, { u });
  }
  const column = fireColumn(5.5, 2.4, 260, '#ffd890', '#ff6a18'); column.position.set(AE.x, AE.y + 260, AE.z); gC.add(column);
  const core = fireColumn(1.8, 1.0, 260, '#fff4d8', '#ffb050'); core.position.copy(column.position); gC.add(core);
  const shockU = { r: { value: 0 }, op: { value: 0 } };
  const shock = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: shockU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv*2.-1.; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float r, op; varying vec2 vUv; void main(){ float d = length(vUv); float ring = exp(-pow((d - .9)*14., 2.)) + .25*exp(-pow((d-.75)*6.,2.)); gl_FragColor = vec4(vec3(1.,.6,.25)*ring*op, 1.); }' }));
  shock.rotation.x = -Math.PI / 2; shock.position.set(AE.x, AE.y + 0.3, AE.z); gC.add(shock);
  const flameE = lib.fire({ count: 900, radius: 1.1, height: 5.5, size: 70, seed: 31, intensity: 0 }); flameE.position.set(AE.x, AE.y + 1.6, AE.z); gC.add(flameE);
  const flameCore = lib.fire({ count: 300, radius: 0.6, height: 3, size: 60, seed: 32, color1: '#fff2c8', color2: '#ff9030', intensity: 0 }); flameCore.position.copy(flameE.position); gC.add(flameCore);
  const impactGlow = lib.glow('#ffc070', 30, 0); impactGlow.position.set(AE.x, AE.y + 3, AE.z); gC.add(impactGlow);
  const altarGlow = lib.glow('#ff8030', 12, 0); altarGlow.position.set(AE.x, AE.y + 2.4, AE.z); gC.add(altarGlow);
  const fireL = new THREE.PointLight('#ff9040', 0, 90, 1.3); fireL.position.set(AE.x, AE.y + 4, AE.z); gC.add(fireL);
  // взрыв искр: баллистика от момента удара
  const NE = 1400; const eP = new Float32Array(NE * 3), eS = new Float32Array(NE * 2); { const r = rng(21); for (let i = 0; i < NE; i++) { const a = r() * 6.283, u = r() * 2 - 1, sp = 3 + Math.pow(r(), 2) * 14; const s = Math.sqrt(1 - u * u);
    eP.set([Math.cos(a) * s * sp, Math.abs(u) * sp * 0.9 + 3, Math.sin(a) * s * sp], i * 3); eS.set([r(), r()], i * 2); } }
  const eG = new THREE.BufferGeometry(); eG.setAttribute('position', new THREE.BufferAttribute(eP, 3)); eG.setAttribute('sd', new THREE.BufferAttribute(eS, 2));
  const eU = { time: { value: 0 }, t0: { value: TF }, origin: { value: V(AE.x, AE.y + 2, AE.z) }, pxr: { value: 1 } };
  const burst = new THREE.Points(eG, new THREE.ShaderMaterial({ uniforms: eU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec2 sd; uniform float time, t0, pxr; uniform vec3 origin; varying float vA; varying float vL;
      void main(){ float T = time - t0 - sd.x*.25; float life = 2.2 + sd.y*2.5; vL = clamp(T/life, 0., 1.);
        float dr = 1. - exp(-T*1.2); vec3 p = origin + position*dr/1.2 + vec3(0., -2.2*T*T*.5, 0.);
        p.y = max(p.y, origin.y - 1.9);
        vA = step(0., T) * (1. - vL); vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv; gl_PointSize = pxr*(3. + 5.*sd.y)*(30./max(-mv.z,1.))*(1.-vL*.6); }`,
    fragmentShader: `varying float vA; varying float vL; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d); vec3 c = mix(vec3(1.,.85,.5), vec3(1.,.35,.08), vL); gl_FragColor = vec4(c*a*vA*1.3, 1.); }` }));
  burst.frustumCulled = false; gC.add(burst);
  const steam = lib.motes({ count: 700, box: [6, 10, 6], center: [AE.x, AE.y + 4.5, AE.z], size: 22, color: '#e8d8d0', speed: 0.5, kind: 'rise', opacity: 0, seed: 23 }); gC.add(steam);
  const embersE = lib.motes({ count: 260, box: [10, 18, 10], center: [AE.x, AE.y + 8, AE.z], size: 3.5, color: '#ff9a40', speed: 0.6, kind: 'embers', opacity: 0, seed: 24 }); gC.add(embersE);
  const dustC = lib.motes({ count: 500, box: [60, 12, 40], center: [0, 4, 0], size: 3, color: '#ffd8b0', speed: 0.12, opacity: 0.35, seed: 25 }); gC.add(dustC);

  // =====================================================================
  // ВИХРЬ И ОГНЕННАЯ КОЛЕСНИЦА
  // =====================================================================
  const gW = new THREE.Group(); scene.add(gW);
  const WC = V(70, 0, 30); WC.y = hC(WC.x, WC.z); // ось вихря
  // путь колесницы (τ — сек от начала кадра). То же в GLSL.
  const CH_T0 = C.chariot;
  const chPath = (tau, out = V(0, 0, 0)) => { const a = 0.5 * tau - 2.2; const R = 16 - tau * 1.1; return out.set(WC.x + Math.cos(a) * R, WC.y + 4 + tau * 1.6 + tau * tau * 0.75, WC.z + Math.sin(a) * R); };
  const CH_GLSL = `vec3 chPath(float tau){ float a = .5*tau - 2.2; float R = 16. - tau*1.1; return vec3(${WC.x.toFixed(3)} + cos(a)*R, ${(WC.y + 4).toFixed(3)} + tau*1.6 + tau*tau*.75, ${WC.z.toFixed(3)} + sin(a)*R); }`;
  // огненная «кожа»
  const fireSkinU = { time: { value: 0 }, k: { value: 1 } };
  const fireSkin = new THREE.ShaderMaterial({ uniforms: fireSkinU,
    vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: lib.GLSL_NOISE + `uniform float time, k; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){ float n = fbm2(vP.xy*3.5 + vec2(0., -time*3.)) + .5*vnoise(vP.zy*5. - time*4.);
        float rim = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.);
        vec3 c = mix(vec3(.55,.08,.02), vec3(1.,.55,.15), smoothstep(.35, .9, n)); c = mix(c, vec3(1.3,1.05,.7), smoothstep(.85, 1.2, n) + rim*.6);
        gl_FragColor = vec4(c*k*1.15, 1.); }` });
  function horse() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), fireSkin); body.scale.set(0.42, 0.5, 1.05); body.position.y = 1.55; g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.3, 1.0, 8), fireSkin); neck.position.set(0, 2.05, 0.95); neck.rotation.x = 0.75; g.add(neck);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.62, 8), fireSkin); head.position.set(0, 2.42, 1.42); head.rotation.x = 1.95; g.add(head);
    const legs = [];
    for (const [x, z] of [[0.22, 0.75], [-0.22, 0.75], [0.22, -0.72], [-0.22, -0.72]]) { const p = new THREE.Group(); p.position.set(x, 1.35, z); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 1.3, 6), fireSkin); l.position.y = -0.62; p.add(l); g.add(p); legs.push(p); }
    const mane = lib.fire({ count: 160, radius: 0.25, height: 1.6, size: 34, seed: 70 + legs.length, intensity: 1.2 }); mane.position.set(0, 2.2, 0.7); g.add(mane);
    const tail = lib.fire({ count: 120, radius: 0.2, height: 1.4, size: 30, seed: 75, intensity: 1.2 }); tail.position.set(0, 1.6, -1.05); g.add(tail);
    g.legs = legs; return g;
  }
  const chariot = new THREE.Group(); gW.add(chariot);
  const horses = [horse(), horse()]; horses[0].position.set(-0.75, 0, 2.6); horses[1].position.set(0.75, 0, 2.6); chariot.add(...horses);
  const cart = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.0, 14, 1, true, -Math.PI / 2, Math.PI), fireSkin); cart.position.set(0, 1.25, -0.2); chariot.add(cart);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), fireSkin); pole.rotation.x = Math.PI / 2; pole.position.set(0, 1.0, 1.3); chariot.add(pole);
  const wheels = [-1, 1].map((s) => { const w = new THREE.Group(); w.add(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 6, 20), fireSkin)); for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 0.04), fireSkin); sp.rotation.z = i / 6 * Math.PI; w.add(sp); } w.rotation.y = Math.PI / 2; w.position.set(s * 0.95, 0.65, -0.3); chariot.add(w); return w; });
  const prophet = lib.figure({ height: 1.8, robe: '#5a4636', skin: '#7a5034', hood: true, hoodColor: '#3a2a20', seed: 91 }); prophet.position.set(0, 0.65, -0.35); chariot.add(prophet);
  prophet.parts.arms.forEach((a) => (a.rotation.x = -0.9));
  const chFire = lib.fire({ count: 420, radius: 1.0, height: 3.0, size: 60, seed: 77, intensity: 1.0 }); chFire.position.set(0, 0.6, -0.3); chariot.add(chFire);
  const chGlow = lib.glow('#ff9040', 22, 0.55); chGlow.position.set(0, 1.6, 1); chariot.add(chGlow);
  const chLight = new THREE.PointLight('#ff8a3a', 400, 160, 1.2); chLight.position.set(0, 2, 0.5); chariot.add(chLight);
  // огненный шлейф (те же формулы пути в шейдере)
  const NT = 1500; const tP = new Float32Array(NT * 3), tS = new Float32Array(NT * 2); { const r = rng(41); for (let i = 0; i < NT; i++) { tP.set([r() - 0.5, r() - 0.5, r() - 0.5], i * 3); tS.set([r(), r()], i * 2); } }
  const tG = new THREE.BufferGeometry(); tG.setAttribute('position', new THREE.BufferAttribute(tP, 3)); tG.setAttribute('sd', new THREE.BufferAttribute(tS, 2));
  const trailU = { time: { value: 0 }, T0: { value: CH_T0 }, pxr: { value: 1 } };
  const trail = new THREE.Points(tG, new THREE.ShaderMaterial({ uniforms: trailU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: CH_GLSL + `attribute vec2 sd; uniform float time, T0, pxr; varying float vA; varying float vL;
      void main(){ float tau = time - T0; float age = fract(sd.x + time*.7)*1.8; float te = tau - age; vL = age/1.8;
        vec3 p = chPath(te) + position*(1.2 + age*3.) + vec3(0., -age*1.2 + 1.2, 0.);
        vA = step(0., te)*(1. - vL); vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv; gl_PointSize = pxr*(4. + 8.*sd.y)*(40./max(-mv.z,1.)); }`,
    fragmentShader: `varying float vA; varying float vL; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d); vec3 c = mix(vec3(1.,.8,.4), vec3(.9,.25,.05), vL); gl_FragColor = vec4(c*a*a*vA*.9, 1.); }` }));
  trail.frustumCulled = false; gW.add(trail);
  // вихрь: пылевая воронка, подсвеченная огнём
  const NV = 2600; const vP = new Float32Array(NV * 3); { const r = rng(51); for (let i = 0; i < NV; i++) vP.set([r(), r() * 6.283, r()], i * 3); }
  const vG = new THREE.BufferGeometry(); vG.setAttribute('position', new THREE.BufferAttribute(vP, 3));
  const vortU = { time: { value: 0 }, T0: { value: CH_T0 }, chPos: { value: V(0, 0, 0) }, center: { value: WC.clone() }, op: { value: 0 }, pxr: { value: 1 } };
  const vortex = new THREE.Points(vG, new THREE.ShaderMaterial({ uniforms: vortU, transparent: true, depthWrite: false,
    vertexShader: `uniform float time, op, pxr; uniform vec3 chPos, center; varying float vA; varying float vF;
      void main(){ float h = position.x; float y = h*95.; float R = mix(5., 34., pow(h, 1.25)) * (.8 + .4*position.z);
        float a = position.y + time*(1.5 - h*.9) + sin(time*.7 + position.z*20.)*.2;
        vec3 p = center + vec3(cos(a)*R, y + sin(time + position.z*9.)*1.5, sin(a)*R);
        float d = length(p - chPos); vF = exp(-d*d/700.);
        vA = op*smoothstep(0., .08, h)*(1. - smoothstep(.85, 1., h));
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv; gl_PointSize = pxr*(14. + 22.*position.z)*(60./max(-mv.z,1.)); }`,
    fragmentShader: `varying float vA; varying float vF; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d);
        vec3 c = mix(vec3(.24,.2,.24), vec3(1.,.5,.2), vF); gl_FragColor = vec4(c, a*a*vA*(.16 + vF*.25)); }` }));
  vortex.frustumCulled = false; gW.add(vortex);
  // плащ
  const cloakG = new THREE.PlaneGeometry(1.3, 1.5, 8, 8); const cloakBase = cloakG.attributes.position.array.slice();
  const cloak = new THREE.Mesh(cloakG, new THREE.MeshStandardMaterial({ color: '#4a3a2a', roughness: 1, side: THREE.DoubleSide })); gW.add(cloak);
  // Елисей
  const elisha = lib.figure({ height: 1.75, robe: '#5a4a3a', skin: '#7a5034', hood: true, seed: 92 });
  const EP = V(WC.x - 6, 0, WC.z + 12); EP.y = hC(EP.x, EP.z); elisha.position.copy(EP); gW.add(elisha); elisha.parts.arms.forEach((a) => (a.rotation.order = 'YXZ'));

  // ---------- образы ----------
  const L0 = { top: '#2c4a78', hor: '#f0aa6a', bot: '#3a2a20', fog: '#c89070', fogD: 0.0022, sunY: 0.12, glow: 1.0, sun: 2.6, hemi: 0.75, exp: 0.95, stars: 0, cl: '#ffd8b8' };
  const L1 = { ...L0, hor: '#f08a4a', fog: '#b87050', sunY: 0.055, glow: 1.1, sun: 2.2, exp: 0.92, cl: '#ffb890' };
  const L2 = { top: '#1e2a50', hor: '#d0603a', bot: '#2a1810', fog: '#7a4a40', fogD: 0.0024, sunY: 0.0, glow: 0.9, sun: 1.2, hemi: 0.5, exp: 0.9, stars: 0, cl: '#e88a70' };
  const L3 = { top: '#0e1430', hor: '#7a3a34', bot: '#120a08', fog: '#3a2428', fogD: 0.0026, sunY: -0.05, glow: 0.35, sun: 0.25, hemi: 0.32, exp: 0.95, stars: 0.4, cl: '#8a5a5a' };
  const L4 = { top: '#0a0e24', hor: '#4a2a3a', bot: '#0a0606', fog: '#2a1c24', fogD: 0.0018, sunY: -0.08, glow: 0.2, sun: 0.1, hemi: 0.25, exp: 0.95, stars: 0.8, cl: '#6a4a5a' };
  const looks = [[0, L0], [C.altars - 0.01, L0], [C.altars, L1], [15.9, L2], [C.fire - 0.01, L2], [C.fire, L3], [C.chariot - 0.01, L3], [C.chariot, L4], [meta.dur, L4]];
  const tmp = V(0, 0, 0), tmp2 = V(0, 0, 0);

  return {
    scene, camera,
    update(t, S) {
      const Lk = look(looks, t); const chariotShot = t >= C.chariot;
      gC.visible = !chariotShot; gW.visible = chariotShot;
      SUN.set(0.15, Lk.sunY, -1).normalize();
      sky.u.top.value.copy(Lk.top); sky.u.horizon.value.copy(Lk.hor); sky.u.bottom.value.copy(Lk.bot); sky.u.sunDir.value.copy(SUN); sky.u.sunGlow.value = Lk.glow; sky.u.starAmt.value = Lk.stars * 0.5;
      stars.u.opacity.value = Lk.stars;
      scene.fog.color.copy(Lk.fog); scene.fog.density = Lk.fogD;
      sea.u.skyc.value.copy(Lk.hor).multiplyScalar(0.6); sea.u.sunDir.value.copy(SUN); sea.u.sunColor.value.set('#ffb070').multiplyScalar(Lk.glow * 0.8); sea.u.fogColor.value.copy(Lk.fog); sea.u.fogDensity.value = Lk.fogD * 0.6;
      sun.intensity = Lk.sun; hemi.intensity = Lk.hemi; clouds.setColor(Lk.cl); clouds.drift(t, 1.5, 0);
      sun.position.set(SUN.x * 150, Math.max(SUN.y, 0.05) * 150, SUN.z * 150); sun.target.position.set(0, 0, 0);
      S.post.exposure = Lk.exp; S.post.bloom = 0.6; S.post.bloomThreshold = 0.8; S.post.tint = [1.03, 0.98, 0.92]; S.post.vignette = 0.42;

      if (!chariotShot) {
        const wAlt = t >= C.altars;
        // --- жрецы: стоят толпой → пляшут кругом у своего жертвенника → падают ниц после огня
        const fall = ramp(t, TF + 1.4, 1.5);
        priests.pose((d, o, i) => {
          if (!wAlt) { o.x = d.gx; o.z = d.gz; o.y = hC(d.gx, d.gz); o.ry = Math.PI / 2 + Math.sin(d.ph) * 0.3; o.az = 0.15 + 0.1 * Math.sin(t * 0.8 + d.ph); o.ax = -0.2 * d.u; if (d.u < 0.25) { o.az = 2.4 + Math.sin(t * 3 + d.ph) * 0.2; } }
          else {
            const a = d.a + t * (0.35 + d.v * 0.1) * (1 - ramp(t, C.fire, 2)); o.x = AB.x + Math.cos(a) * d.R; o.z = AB.z + Math.sin(a) * d.R; o.y = hC(o.x, o.z);
            o.ry = -a + (d.u < 0.5 ? Math.PI : 0) * 0.0 - Math.PI / 2 + Math.sin(t * 2 + d.ph) * 0.4;
            const frenzy = 1 - ramp(t, 17.5, 2.5) * 0.6; const dance = (1 - fall);
            o.jy = Math.max(0, Math.sin(t * 5.5 + d.ph)) * 0.25 * frenzy * dance; o.pitch = (Math.sin(t * 2.7 + d.ph) * 0.15 - 0.1) * dance;
            o.az = lerp(0.2, 2.6 + Math.sin(t * 6 + d.ph) * 0.3, frenzy * dance); o.ax = Math.sin(t * 4 + d.ph) * 0.4 * frenzy * dance;
            if (fall > 0) { o.pitch += -1.1 * fall; o.y -= 0.5 * fall; o.az = lerp(o.az, 0.3, fall); o.ax = lerp(o.ax, 1.3, fall); o.ry += Math.PI * fall * 0; }
          }
        });
        // --- народ: стоит, после огня падает ниц
        const kneel = ramp(t, TF + 1.8, 2.0);
        people.pose((d, o, i) => { const k = clamp(kneel * 1.4 - d.u * 0.4); o.pitch = 0.85 * k + Math.sin(t * 0.9 + d.ph) * 0.02; o.y = d.y - 0.5 * k; o.jy = 0; });
        // --- Илия
        elijah.rotation.set(0, 0, 0); elijah.parts.arms.forEach((a, s) => { a.rotation.set(0, 0, (s ? 1 : -1) * 0.12); });
        jar.visible = false; strU.on.value = 0;
        if (!wAlt) { elijah.position.set(6, hC(6, -1), -1); elijah.rotation.y = -Math.PI / 2 - 0.2; }
        else {
          elijah.position.set(AE.x - 1.7, hC(AE.x - 1.7, AE.z + 1.1), AE.z + 1.1); elijah.rotation.y = 2.1;
          const pour = ramp(t, 15.8, 0.6) * (1 - ramp(t, 19.8, 0.5));
          if (pour > 0) {
            elijah.rotation.y = Math.atan2(AE.x - elijah.position.x, AE.z - elijah.position.z);
            elijah.parts.arms.forEach((a) => { a.rotation.x = -2.5 * pour; });
            const pulse = Math.max(ramp(t, 16.4, 0.15) * (1 - ramp(t, 17.3, 0.2)), ramp(t, 17.65, 0.15) * (1 - ramp(t, 18.5, 0.2)), ramp(t, 18.85, 0.15) * (1 - ramp(t, 19.6, 0.2)));
            const fw = tmp.set(Math.sin(elijah.rotation.y), 0, Math.cos(elijah.rotation.y));
            jar.visible = true; jar.position.copy(elijah.position).addScaledVector(fw, 0.72 * pour + 0.1).add(tmp2.set(0, lerp(1.0, 2.62, pour), 0));
            jar.rotation.set(0, elijah.rotation.y, 0); jar.rotateX(lerp(0, 1.9, pulse * 0.5 + 0.5 * pour));
            strU.on.value = pulse; strU.mouth.value.copy(jar.position).addScaledVector(fw, 0.28).add(tmp2.set(0, 0.05, 0)); strU.vel.value.copy(fw).multiplyScalar(1.6);
          } else if (t >= C.fire) {
            // молитва, затем отступает от огня, руки к небу
            const up = ramp(t, C.fire - 0.2, 0.6); elijah.parts.arms.forEach((a, s) => { a.rotation.x = -0.4 * up; a.rotation.z = (s ? 1 : -1) * lerp(0.12, 2.5, up); });
            elijah.position.x -= 0.8 * ramp(t, TF, 0.8); elijah.rotation.y = 1.9;
          }
        }
        // --- вода во рву: наполнение → испарение
        const lvl = ramp(t, 16.6, 3.2) * (1 - ramp(t, TF + 0.3, 7.0));
        waterU.level.value = lvl; waterU.sky.value.copy(Lk.hor); waterU.sunDir.value.copy(SUN);
        // --- огонь с неба
        const desc = ramp(t, TF - 0.55, 0.55), colK = desc * (1 - ramp(t, TF + 0.7, 1.8));
        column.scale.y = core.scale.y = Math.max(0.001, easeIn(desc) * 0.999 + 0.001); column.visible = core.visible = colK > 0.001;
        column.u.opacity.value = 1.2 * colK; core.u.opacity.value = 1.6 * colK; column.scale.x = column.scale.z = 1 + 0.5 * ramp(t, TF, 0.3) * (1 - ramp(t, TF + 0.6, 1));
        const imp = ramp(t, TF - 0.05, 0.1) * (1 - ramp(t, TF + 0.15, 1.6));
        impactGlow.material.opacity = imp * 0.9; impactGlow.scale.setScalar(30 + 40 * ramp(t, TF, 0.6));
        S.post.flash = ramp(t, TF - 0.04, 0.06) * (1 - ramp(t, TF + 0.05, 0.6)) * 0.55;
        const sw = clamp((t - TF) / 1.6); shockU.r.value = sw; shock.scale.setScalar(2 + easeOut(sw) * 70); shockU.op.value = (t > TF ? 1 : 0) * (1 - sw) * 1.4; shock.visible = t > TF && sw < 1;
        const burn = ramp(t, TF - 0.05, 0.25); const settle = lerp(1.5, 0.85, ramp(t, TF + 1.0, 3)) * (1 - 0.35 * ramp(t, 27.5, 3));
        flameE.u.intensity.value = burn * settle; flameCore.u.intensity.value = burn * settle * 0.8; flameE.visible = flameCore.visible = burn > 0.001;
        flameE.u.height.value = lerp(9, 5.5, ramp(t, TF + 0.4, 2.5));
        altarGlow.material.opacity = burn * 0.55 * (0.9 + 0.1 * Math.sin(t * 9));
        fireL.intensity = burn * settle * 260 * (0.9 + 0.1 * Math.sin(t * 13)) + imp * 900;
        stoneME.emissiveIntensity = ramp(t, TF + 1.5, 4) * 0.9;
        altE.wood.scale.setScalar(Math.max(0.001, 1 - ramp(t, 23.6, 2.4))); altE.wood.visible = t < 26.1;
        altE.stones.scale.y = lerp(1, 0.3, ramp(t, 25.6, 3.2)); altE.stones.scale.x = altE.stones.scale.z = lerp(1, 0.8, ramp(t, 25.6, 3.2));
        flameE.position.y = flameCore.position.y = AE.y + lerp(1.6, 0.6, ramp(t, 25.6, 3.2));
        steam.u.opacity.value = 0.35 * ramp(t, TF + 0.3, 0.8) * (1 - ramp(t, 28.0, 2.2)); steam.visible = steam.u.opacity.value > 0.001;
        embersE.u.opacity.value = 0.9 * burn; embersE.visible = burn > 0;
        waterU.glow.value = burn * lvl;
        burst.visible = t > TF - 0.3 && t < TF + 6;

        if (t < 3.9) {
          // общий план: с моря на гору
          S.quote.y = 0.5;
          cameraPath(camera, [[0, [-70, 26, -150], [0, 2, -2]], [3.9, [-54, 20, -128], [0, 1, -2]]], t);
        } else if (t < C.altars) {
          // жрецы (слева) против одного (справа), за ними закат над морем
          cameraPath(camera, [[3.9, [-3.0, 1.6, 9.5], [-4.5, 3.4, -40]], [C.altars, [-2.0, 1.75, 7.0], [-4.0, 3.4, -40]]], t);
        } else if (t < 15.9) {
          // пляска жрецов вокруг жертвенника, солнце садится
          cameraPath(camera, [[C.altars, [AB.x + 9, 2.1, AB.z + 9.5], [AB.x - 1, 1.8, AB.z - 4]], [15.9, [AB.x + 6.5, 1.8, AB.z + 10.5], [AB.x - 1.5, 1.9, AB.z - 4]]], t);
        } else if (t < C.fire) {
          // Илия заливает жертвенник водой — вода блестит во рву
          cameraPath(camera, [[15.9, [AE.x + 3.6, 2.4, AE.z + 4.6], [AE.x - 0.4, 1.5, AE.z]], [C.fire, [AE.x + 2.8, 2.2, AE.z + 4.0], [AE.x - 0.3, 1.6, AE.z]]], t);
        } else {
          // огонь с неба: общий план из-за толпы, потом медленный отъезд
          S.quote.y = 0.3;
          const shake = Math.max(0, 1 - (t - TF) / 1.2) * (t > TF ? 1 : 0);
          cameraPath(camera, [[C.fire, [AE.x - 3.0, 2.6, 30], [AE.x - 1.0, 9.5, AE.z]], [TF, [AE.x - 3.0, 2.6, 29.5], [AE.x - 1.0, 9.5, AE.z]], [C.chariot, [AE.x - 4.0, 3.2, 35], [AE.x - 1.0, 9.0, AE.z]]], t);
          camera.position.x += Math.sin(t * 47) * 0.12 * shake; camera.position.y += Math.sin(t * 61) * 0.1 * shake;
        }
        handheld(camera, t, 0.004);
      } else {
        // --- колесница
        const tau = t - CH_T0;
        chPath(tau, chariot.position); chPath(tau + 0.08, tmp); chariot.lookAt(tmp);
        horses.forEach((h, j) => h.legs.forEach((l, k) => (l.rotation.x = Math.sin(t * 9 + k * 1.3 + j * 0.6) * 0.75)));
        wheels.forEach((w) => (w.children.forEach((c) => (c.rotation.x = 0)), w.rotation.x = t * 6));
        prophet.parts.arms.forEach((a, s) => (a.rotation.x = -0.9 + Math.sin(t * 3 + s) * 0.05));
        vortU.chPos.value.copy(chariot.position); vortU.op.value = ramp(t, CH_T0 - 0.2, 1.0);
        const fk = ramp(t, CH_T0, 0.6); fireSkinU.k.value = fk;
        // плащ: срывается и, кружась, падает к Елисею
        const cl = clamp((tau - 3.6) / 3.6);
        const top = chPath(Math.min(tau, 3.6), tmp2).clone().add(V(0, 1.4, 0));
        const dst = V(EP.x + 0.3, EP.y + 2.6, EP.z - 0.3);
        cloak.position.set(lerp(top.x, dst.x, easeOut(cl) * 0.7 + cl * 0.3), lerp(top.y, dst.y, 1 - Math.pow(1 - cl, 1.6)), lerp(top.z, dst.z, easeOut(cl) * 0.7 + cl * 0.3));
        cloak.position.x += Math.sin(tau * 2.2) * 1.4 * cl * (1 - cl) * 2; cloak.position.z += Math.cos(tau * 1.7) * 1.0 * cl * (1 - cl) * 2;
        cloak.rotation.set(Math.sin(tau * 2.3) * 0.8, tau * 1.2, Math.cos(tau * 1.9) * 0.6);
        cloak.visible = tau > 3.6; { const p = cloakG.attributes.position; for (let i = 0; i < p.count; i++) { const x = cloakBase[i * 3], y = cloakBase[i * 3 + 1]; p.setZ(i, Math.sin(x * 3 + tau * 7) * 0.12 + Math.sin(y * 4 + tau * 5) * 0.1); } p.needsUpdate = true; cloakG.computeVertexNormals(); }
        // Елисей тянется вверх
        elisha.rotation.y = Math.atan2(chariot.position.x - EP.x, chariot.position.z - EP.z);
        const reach = ramp(t, CH_T0 + 2.5, 1.5); elisha.parts.arms.forEach((a, s) => { a.rotation.x = -2.6 * reach; a.rotation.y = (s ? -1 : 1) * 0.3 * reach; });
        elisha.parts.body.rotation.x = -0.12 * reach;
        // камера: от Елисея — низко, вверх за колесницей
        S.fadeOut = 1.2;
        const camP = V(EP.x - 2.2, EP.y + 1.3, EP.z + 4.2);
        const lk = chPath(Math.max(tau - 0.4, 0), V()).lerp(V(WC.x, WC.y + 20, WC.z), 0.25);
        lk.y = lerp(lk.y, EP.y + 6, 0.15);
        camera.position.copy(camP).add(V(-tau * 0.5, tau * 0.25, tau * 0.9)); camera.lookAt(lk);
        S.post.exposure = Lk.exp; S.post.bloom = 0.75; S.post.bloomThreshold = 0.75;
        handheld(camera, t, 0.006);
      }
    },
  };
}
