// Финал: тихий тёмно-синий простор, медленные золотые пылинки, слабое свечение горизонта над спокойной водой.
// Тёплый подъём света на последней строке («Благодать… Аминь»), затем покой для титров и затемнение.
export default function build({ THREE, lib, W, H, meta }) {
  const { ramp, lerp, rng } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#04060c', 0.0022);

  const sky = lib.skyDome({ top: '#010208', horizon: '#0c1224', bottom: '#020308', sunDir: [0, -0.04, -1], sunColor: '#ffcf8a', sunSize: 0.02, sunGlow: 0.0, stars: 0.5 });
  scene.add(sky);
  const stars = lib.starfield({ count: 3000, radius: 1500, size: 1.8, minY: 0.03, seed: 31 }); stars.u.opacity.value = 0.35; scene.add(stars);
  const sea = lib.ocean({ size: 1600, seg: 160, deep: '#010205', shallow: '#03060c', sky: '#0c1224', amp: 0.25, choppy: 0.8, sunDir: [0, 0.02, -1], sunColor: '#000' });
  sea.u.fogColor.value.set('#04060c'); sea.u.fogDensity.value = 0.0018; scene.add(sea);

  // полоса света у горизонта (за туманом), и «солнце» под горизонтом к «Аминь»
  const band = lib.glow('#ffb46a', 1, 0); band.position.set(0, 10, -1300); band.scale.set(3200, 140, 1); band.material.fog = false; scene.add(band);
  const sunG = lib.glow('#ffd59a', 1, 0); sunG.position.set(0, -20, -1350); sunG.material.fog = false; scene.add(sunG);

  // золотые пылинки — свой шейдер: медленный дрейф вверх и вбок, мягкое мерцание
  const N = 2400, r = rng(91), pos = new Float32Array(N * 3), sd = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { pos.set([(r() - 0.5) * 240, r() * 70, -10 - r() * 260], i * 3); sd.set([r(), r()], i * 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 2));
  const mu = { time: { value: 0 }, pxr: { value: 1 }, bright: { value: 0.6 } };
  const motes = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: mu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec2 sd; uniform float time, pxr; varying float vA;
      void main(){ vec3 q = position; q.y = mod(q.y + time*(.35+sd.x*.6), 70.); q.x += sin(time*.13+sd.y*50.)*4. + time*.4;
        q.z += cos(time*.1+sd.x*40.)*3.;
        vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv;
        vA = smoothstep(0.,8.,q.y)*smoothstep(70.,55.,q.y)*(.5+.5*sin(time*(.6+sd.x)+sd.y*60.));
        gl_PointSize = (1.5+sd.y*3.5)*pxr*(80./max(-mv.z,1.)); }`,
    fragmentShader: `uniform float bright; varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d); a*=a;
        gl_FragColor = vec4(vec3(1.,.8,.48)*a*vA*bright, 1.); }`,
  }));
  motes.frustumCulled = false; scene.add(motes);

  const C = meta.cues;
  return {
    scene, camera,
    update(t, S) {
      S.fadeIn = 0.8; S.fadeOut = 2.0;
      const dur = S.dur, A = C.amen;
      const warm = Math.min(ramp(t, A - 0.8, 2.5), 1 - ramp(t, A + 6.5, 3.0)); // тёплый подъём на «Аминь»
      const base = 0.35 + 0.15 * ramp(t, 0, 6);
      const hz = new THREE.Color('#0c1224').lerp(new THREE.Color('#4a2c18'), warm * 0.8);
      sky.u.horizon.value.copy(hz); sky.u.top.value.set('#010208').lerp(new THREE.Color('#0a1022'), warm * 0.5);
      sky.u.bottom.value.copy(hz).multiplyScalar(0.25);
      sky.u.sunDir.value.set(0, lerp(-0.08, -0.035, warm), -1).normalize(); sky.u.sunGlow.value = warm * 0.45;
      sky.u.starAmt.value = 0.5 * (1 - warm * 0.6);
      sea.u.skyc.value.copy(hz); sea.u.sunDir.value.set(0, 0.03, -1).normalize();
      sea.u.sunColor.value.set('#ffb070').multiplyScalar(0.04 * base + warm * 0.25);
      sea.u.fogColor.value.copy(hz).multiplyScalar(0.6); scene.fog.color.copy(hz).multiplyScalar(0.6);
      band.material.opacity = 0.16 * base + warm * 0.3; band.scale.set(3600, 90 + warm * 110, 1);
      sunG.material.opacity = warm * 0.3; sunG.scale.set(500 + warm * 300, 160 + warm * 100, 1);
      stars.u.opacity.value = 0.35 * (1 - warm * 0.5); stars.rotation.y = t * 0.002;
      mu.bright.value = 0.55 + warm * 0.6;
      // камера: низко над водой, очень медленный подъём и проплыв вперёд
      camera.position.set(Math.sin(t * 0.03) * 4, lerp(6, 9, ramp(t, 0, dur)), lerp(40, 10, t / dur));
      camera.lookAt(0, lerp(70, 64, ramp(t, 0, dur)), -400);
      S.post.exposure = 0.95; S.post.bloom = 0.6 + warm * 0.3; S.post.bloomThreshold = 0.55; S.post.bloomRadius = 0.8;
      S.post.vignette = 0.5; S.post.grain = 0.04;
    },
  };
}
