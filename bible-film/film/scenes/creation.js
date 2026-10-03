// Сотворение: тьма над водой → «да будет свет» → рассвет, суша, звёзды → человек на берегу.
export default function build({ THREE, lib, W, H, meta }) {
  const { ramp, lerp, cameraPath, handheld } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#05070a', 0.004);

  const sky = lib.skyDome({ top: '#010205', horizon: '#030406', bottom: '#010203', sunDir: [0, -0.02, -1], sunColor: '#ffe9c4', sunSize: 0.035, sunGlow: 0, stars: 0 });
  scene.add(sky);
  const sea = lib.ocean({ size: 1000, seg: 330, deep: '#010306', shallow: '#04090e', sky: '#020304', amp: 0.9, choppy: 0.9, foam: 0.0, sunDir: [0, 0.02, -1], sunColor: '#000' });
  sea.u.fogColor.value.set('#05070a'); sea.u.fogDensity.value = 0.0025; scene.add(sea);

  // «Дух Божий носился над водою» — бледное сияние и туман над водой
  const spirit = lib.glow('#cfe0ff', 60, 0.0); spirit.position.set(0, 18, -140); scene.add(spirit);
  const mist = lib.motes({ count: 1600, box: [260, 30, 260], center: [0, 10, -80], size: 7, color: '#9fb6d8', speed: 0.25, opacity: 0.0 });
  scene.add(mist);

  // суша: далёкие холмы, встающие из воды
  const land = lib.terrain({
    size: 900, seg: 160, center: [0, -420],
    heightFn: (x, z) => { const d = Math.max(0, (-z - 260) / 160); return Math.min(d, 1) * (lib.fbm(x * 0.006, z * 0.006, 5) * 38 + 22) - 18; },
    colorFn: (x, z, y, sl) => new THREE.Color().setHSL(0.27 - y * 0.001, 0.35, 0.08 + Math.max(0, y) * 0.004 + sl * 0.05).lerp(new THREE.Color('#2a2418'), sl * 0.8),
  });
  land.position.y = -40; scene.add(land);

  const stars = lib.starfield({ count: 7000, radius: 1500, size: 2.4, minY: 0.02 }); stars.u.opacity.value = 0; scene.add(stars);
  const sunLight = new THREE.DirectionalLight('#ffdcae', 0); sunLight.position.set(0, 30, -300); scene.add(sunLight);
  const amb = new THREE.HemisphereLight('#8ab0d8', '#0a0806', 0.0); scene.add(amb);

  // человек на берегу (последний день)
  const man = lib.figure({ height: 1.8, robe: '#3d3328', hood: false, skin: '#9a6a4a', seed: 4 });
  man.position.set(4, 0.6, 18); man.rotation.y = Math.PI; man.visible = false; scene.add(man);
  const shore = lib.terrain({ size: 80, seg: 80, center: [0, 30], heightFn: (x, z) => -0.4 + (z - 10) * 0.05 + lib.fbm(x * 0.1, z * 0.1, 3) * 0.4, color: '#4a3c2c' });
  shore.visible = false; scene.add(shore);

  const C = meta.cues;
  return {
    scene, camera,
    update(t, S) {
      const L = C.light, D = C.days, M = C.man;
      const light = ramp(t, L + 2.2, 1.6), dawn = ramp(t, L + 3.2, 7), day = ramp(t, D, 6);
      // небо: чёрное → вспышка → рассвет → ночь со звёздами (дни) → тёплый закат (человек)
      const nightK = ramp(t, D + 3.5, 3) * (1 - ramp(t, M - 1.5, 2.5));
      const top = new THREE.Color('#010205').lerp(new THREE.Color('#1d3a66'), dawn).lerp(new THREE.Color('#040814'), nightK).lerp(new THREE.Color('#2a3a5a'), ramp(t, M - 1.5, 3));
      const hor = new THREE.Color('#030406').lerp(new THREE.Color('#f2a35e'), dawn).lerp(new THREE.Color('#1b2033'), nightK).lerp(new THREE.Color('#f0a060'), ramp(t, M - 1.5, 3));
      sky.u.top.value.copy(top); sky.u.horizon.value.copy(hor); sky.u.bottom.value.copy(hor).multiplyScalar(0.3);
      const evening = ramp(t, M - 1.5, 3);
      const sunY = lerp(-0.05, 0.05, dawn) - nightK * 0.2 + evening * 0.1;
      sky.u.sunDir.value.set(evening * -0.55, sunY, -1).normalize(); sky.u.sunGlow.value = light * lerp(1.1, 0.7, evening) * (1 - nightK * 0.8);
      sky.u.starAmt.value = nightK * 1.2; stars.u.opacity.value = nightK; stars.rotation.y = t * 0.004;
      sea.u.deep.value.set('#010306').lerp(new THREE.Color('#06202c'), dawn * (1 - nightK * 0.7));
      sea.u.shallow.value.set('#04090e').lerp(new THREE.Color('#2a6470'), dawn * (1 - nightK * 0.7));
      sea.u.skyc.value.copy(hor); sea.u.sunColor.value.set('#ffd6a0').multiplyScalar(light * (1 - nightK * 0.9));
      sea.u.sunDir.value.copy(sky.u.sunDir.value); sea.u.amp.value = lerp(1.1, 0.45, dawn); sea.u.fogColor.value.copy(hor).multiplyScalar(0.8);
      scene.fog.color.copy(hor).multiplyScalar(0.8);
      spirit.material.opacity = (ramp(t, 3, 4) * (1 - light)) * 0.35; spirit.position.x = Math.sin(t * 0.3) * 30;
      mist.u.opacity.value = 0.5 * (1 - light * 0.7);
      land.position.y = lerp(-40, 0, ramp(t, D + 0.5, 5));
      sunLight.intensity = light * 2.5 * (1 - nightK * 0.8); amb.intensity = 0.15 + dawn * 0.5;

      // вспышка «да будет свет»
      S.post.flash = ramp(t, L + 2.0, 0.25) * (1 - ramp(t, L + 2.3, 2.2)) * 0.85;
      S.post.exposure = lerp(0.8, 1.0, dawn) - evening * 0.12; S.post.bloom = 0.45 + light * 0.35; S.post.bloomThreshold = 0.85;
      S.quote.y = t > M ? 0.36 : 0.42;

      man.visible = shore.visible = t > M - 0.5;
      // камера: низко над водой → поднимается на рассвете → на берег за спину человеку
      if (t < M - 0.5) {
        cameraPath(camera, [[0, [0, 3, 60], [0, 4, -200]], [L + 2, [0, 3.5, 40], [0, 6, -200]], [D, [0, 9, 20], [0, 10, -200]], [M, [0, 14, 0], [0, 8, -300]]], t);
      } else {
        cameraPath(camera, [[M - 0.5, [-3, 2.2, 26], [4, 1.6, 0]], [S.dur, [-1.5, 1.9, 23.5], [4, 2.0, -40]]], t);
      }
      handheld(camera, t, 0.006);
    },
  };
}
