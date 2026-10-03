// Интро: почти чёрный космос, редкие звёзды и пыль медленно дрейфуют. С ~18 с за краем тёмной планеты
// встаёт тёплый золотой свет — под титулом «Библия» (сам титул и печатный текст рисует оверлей).
export default function build({ THREE, lib, W, H, meta }) {
  const { ramp, lerp, rng } = lib;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#010103');
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 4000);

  // дальние звёзды — очень тусклые
  const stars = lib.starfield({ count: 3200, radius: 1800, size: 1.8, minY: -1, seed: 21, color: '#e8ecff' });
  stars.u.opacity.value = 0.35; scene.add(stars);

  // пыль в объёме перед камерой (свой шейдер: дрейф от времени, мягкие точки)
  const N = 2600, r = rng(77), pos = new Float32Array(N * 3), sd = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { pos.set([(r() - 0.5) * 260, (r() - 0.5) * 140, -r() * 420], i * 3); sd.set([r(), r()], i * 2); }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dg.setAttribute('sd', new THREE.BufferAttribute(sd, 2));
  const du = { time: { value: 0 }, pxr: { value: 1 }, gold: { value: 0 }, opacity: { value: 1 } };
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({
    uniforms: du, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec2 sd; uniform float time, pxr, gold; varying float vA; varying float vG;
      void main(){ vec3 q = position;
        q.z = mod(q.z + time*(2.5+sd.x*2.), 420.) - 420.;            // медленно плывём сквозь пыль
        q.x += sin(time*.11 + sd.y*40.)*3.; q.y += cos(time*.09 + sd.x*30.)*2. + time*.25*gold*(.5+sd.y);
        vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv;
        float near = smoothstep(-420., -300., q.z) * smoothstep(-4., -30., q.z);
        vA = near*(.35+.65*fract(sd.x*13.7)); vG = sd.y;
        gl_PointSize = (2.2+sd.y*3.)*pxr*(70./max(-mv.z,1.)); }`,
    fragmentShader: `uniform float gold, opacity; varying float vA; varying float vG;
      void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d); a*=a;
        vec3 c = mix(vec3(.55,.62,.8), vec3(1.,.78,.45), clamp(gold*(.4+vG),0.,1.));
        gl_FragColor = vec4(c*a*vA*opacity*.55, 1.); }`,
  }));
  dust.frustumCulled = false; scene.add(dust);

  // тёмная планета внизу кадра: край подсвечен золотом с обратной стороны
  const R = 900, PC = new THREE.Vector3(0, -1223, -1320); // край планеты ≈ на 12.8° ниже горизонта камеры
  const pu = { rim: { value: 0 }, sunPos: { value: new THREE.Vector3(0, 0, -3000) } };
  const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), new THREE.ShaderMaterial({
    uniforms: pu,
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float rim; uniform vec3 sunPos; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 v = normalize(cameraPosition - vW); float f = 1. - max(dot(vN, v), 0.);
        float toward = smoothstep(-.2, .9, dot(vN, normalize(sunPos - vW)));
        float r = pow(f, 6.)*toward; vec3 c = vec3(.006,.006,.01) + vec3(1.,.66,.3)*r*rim*1.6 + vec3(.6,.35,.15)*pow(f,2.)*toward*rim*.08;
        gl_FragColor = vec4(c, 1.); }`,
  }));
  planet.position.copy(PC); scene.add(planet);

  // свет за краем: широкое сияние, «солнце», лучи
  const haze = lib.glow('#ffb860', 1, 0); haze.position.set(0, -480, -2300); scene.add(haze);
  const sun = lib.glow('#ffe2a8', 1, 0); sun.position.set(0, -520, -2350); scene.add(sun);
  const band = lib.glow('#ff9a48', 1, 0); band.position.set(0, -490, -2200); scene.add(band);
  const nebA = lib.glow('#1c2a5a', 900, 0.22); nebA.position.set(520, 160, -1600); scene.add(nebA);
  const nebB = lib.glow('#3a1c40', 700, 0.12); nebB.position.set(760, -60, -1700); scene.add(nebB);

  // золотые пылинки, поднимающиеся к финалу
  const motes = lib.motes({ count: 900, box: [220, 90, 160], center: [0, -10, -170], size: 5, color: '#ffcf86', speed: 0.18, kind: 'rise', opacity: 0 });
  scene.add(motes);

  return {
    scene, camera,
    update(t, S) {
      S.fadeIn = 0.3; S.fadeOut = 0.4;
      const g = ramp(t, 17.5, 6.5), g2 = ramp(t, 19.6, 5);
      // камера: почти неподвижна, очень медленный наклон вниз к планете
      camera.position.set(Math.sin(t * 0.05) * 2, lerp(8, 0, ramp(t, 0, 24)), 0);
      camera.lookAt(Math.sin(t * 0.04) * 6, lerp(26, -14, lib.ease(t / 26)), -300);
      stars.rotation.y = t * 0.0025; stars.rotation.z = t * 0.001;
      du.gold.value = g; du.opacity.value = 0.8 + g * 0.4;
      pu.rim.value = 0.05 + g * 0.95;
      haze.scale.set(lerp(600, 2600, g), lerp(200, 900, g), 1); haze.material.opacity = g * 0.28;
      band.scale.set(lerp(800, 3600, g), lerp(40, 160, g), 1); band.material.opacity = g * 0.4;
      sun.scale.set(lerp(80, 360, g2), lerp(80, 360, g2), 1); sun.material.opacity = g2 * 0.75;
      sun.position.y = lerp(-560, -505, g2);
      motes.u.opacity.value = g * 0.55;
      nebA.material.opacity = 0.18 + 0.05 * Math.sin(t * 0.2);
      S.post.exposure = 0.95; S.post.bloom = 0.55 + g * 0.35; S.post.bloomThreshold = 0.55; S.post.bloomRadius = 0.8;
      S.post.vignette = 0.5; S.post.grain = 0.04; S.post.contrast = 1.06;
    },
  };
}
