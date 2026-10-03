// 400 лет тишины: тёмная каменная ниша, одинокий масляный светильник медленно гаснет, пыль в воздухе.
// Центр кадра держим тёмным — там оверлей рисует счётчик «400 лет без пророков».
export default function build({ THREE, lib, W, H, meta }) {
  const { ramp, lerp, rng, noise2 } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, W / H, 0.05, 200);
  scene.background = new THREE.Color('#020101');
  scene.fog = new THREE.FogExp2('#030202', 0.06);

  // каменная стена (текстура кладки на canvas)
  const R = rng(5);
  const stoneTex = lib.canvasTexture(1024, 512, (g, w, h) => {
    g.fillStyle = '#2a2018'; g.fillRect(0, 0, w, h);
    const rows = 7; const rh = h / rows;
    for (let y = 0; y < rows; y++) {
      let x = -(y % 2) * 60 - R() * 40;
      while (x < w) {
        const bw = 120 + R() * 110; const v = 0.75 + R() * 0.35;
        g.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(124 * v)},${Math.round(96 * v)})`;
        g.fillRect(x + 4, y * rh + 4, bw - 8, rh - 8);
        for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${R() * 0.12})`; g.fillRect(x + R() * bw, y * rh + R() * rh, 3 + R() * 14, 2 + R() * 6); }
        x += bw;
      }
    }
  });
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping; stoneTex.repeat.set(4.5, 3);
  const wallMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95, color: '#9a8a78' });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), wallMat); wall.position.set(0, 2.5, -0.75); scene.add(wall);
  // полка-уступ
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(9, 0.25, 1.6), new THREE.MeshStandardMaterial({ color: '#5a4836', roughness: 0.9 }));
  ledge.position.set(0, -0.125, -0.4); ledge.receiveShadow = true; scene.add(ledge);

  // глиняный светильник (тело вращения, сплюснутое, с носиком)
  const LX = 1.05, LZ = 0.05;
  const clay = new THREE.MeshStandardMaterial({ color: '#7a4a2c', roughness: 0.8 });
  const prof = [[0, 0], [0.09, 0.0], [0.15, 0.03], [0.17, 0.07], [0.14, 0.1], [0.06, 0.11], [0.05, 0.13], [0, 0.13]].map(([x, y]) => new THREE.Vector2(x, y));
  const lamp = new THREE.Group(); lamp.position.set(LX, 0, LZ); scene.add(lamp);
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), clay); body.castShadow = true; lamp.add(body);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 12), clay); spout.rotation.z = Math.PI / 2 - 0.25; spout.position.set(-0.19, 0.085, 0); lamp.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 16, Math.PI * 1.3), clay); handle.position.set(0.17, 0.1, 0); lamp.add(handle);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.04, 6), new THREE.MeshBasicMaterial({ color: '#160c06' })); wick.position.set(-0.26, 0.135, 0); lamp.add(wick);

  const flame = lib.fire({ count: 140, seed: 3, radius: 0.012, height: 0.13, size: 2.2, color1: '#ffe2a0', color2: '#ff6a1a', intensity: 1.2 });
  flame.position.set(LX - 0.26, 0.15, LZ); scene.add(flame);
  const core = lib.glow('#ffd590', 0.12, 0.9); core.position.set(LX - 0.26, 0.2, LZ); scene.add(core);
  const halo = lib.glow('#ff9a40', 1.4, 0.35); halo.position.set(LX - 0.26, 0.2, LZ); scene.add(halo);
  const light = new THREE.PointLight('#ffae5a', 1.2, 6, 2); light.position.set(LX - 0.26, 0.32, LZ + 0.08);
  light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.bias = -0.002; scene.add(light);
  const amb = new THREE.HemisphereLight('#2a3550', '#0c0806', 0.06); scene.add(amb);

  // свёрнутый свиток рядом
  const scroll = new THREE.Group(); scroll.position.set(1.65, 0.06, 0.15); scroll.rotation.y = -0.35; scene.add(scroll);
  const parch = new THREE.MeshStandardMaterial({ color: '#b89a6a', roughness: 0.85 });
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 20), parch); roll.rotation.z = Math.PI / 2; roll.castShadow = true; scroll.add(roll);
  [-1, 1].forEach((s) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8), new THREE.MeshStandardMaterial({ color: '#3a2414' })); k.rotation.z = Math.PI / 2; k.position.x = s * 0.33; scroll.add(k); });
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.008, 6, 20), new THREE.MeshStandardMaterial({ color: '#5a1c12' })); tie.rotation.y = Math.PI / 2; scroll.add(tie);

  // пыль в свете и тонкий дымок
  const dust = lib.motes({ count: 160, box: [6, 4.6, 4.6], center: [LX - 0.3, 0.75, 0.1], size: 0.5, color: '#ffcf96', speed: 0.12, kind: 'dust', opacity: 0.5 });
  dust.scale.setScalar(0.3);
  scene.add(dust);
  const smoke = lib.fire({ count: 90, seed: 9, radius: 0.01, height: 1.1, size: 5, color1: '#3a3028', color2: '#14100c', intensity: 0.0 });
  smoke.position.set(LX - 0.26, 0.28, LZ); scene.add(smoke);

  return {
    scene, camera,
    update(t, S) {
      const dur = S.dur;
      const dim = lerp(1, 0.32, ramp(t, 1.5, dur - 2.5));
      const flick = 0.9 + 0.1 * noise2(t * 6, 1.7) + 0.05 * noise2(t * 17, 4.2);
      const k = dim * flick;
      light.intensity = 1.3 * k; core.material.opacity = 0.85 * (0.6 + 0.4 * k); halo.material.opacity = 0.3 * k;
      halo.scale.setScalar(1.0 + 0.5 * k);
      flame.u.intensity.value = 1.15 * (0.55 + 0.45 * dim); flame.scale.set(1, 0.7 + 0.3 * dim, 1);
      smoke.u.intensity.value = 0.25 * ramp(t, 3, 4);
      dust.u.opacity.value = 0.45 * dim;
      // камера: медленный проезд, светильник — в правой нижней трети
      camera.position.set(lerp(-0.25, 0.05, t / dur), lerp(0.62, 0.55, t / dur), lerp(3.2, 2.75, lib.ease(t / dur)));
      camera.lookAt(lerp(0.2, 0.35, t / dur), 0.62, -0.5);
      lib.handheld(camera, t, 0.003);
      S.post.exposure = 0.95; S.post.bloom = 0.7; S.post.bloomThreshold = 0.6; S.post.bloomRadius = 0.7;
      S.post.vignette = 0.55; S.post.contrast = 1.06; S.post.grain = 0.05; S.post.sat = 0.9;
    },
  };
}
