// Цари: Саул в короне над толпой → долина: два войска, Голиаф и Давид → камень, великан падает →
// ночь: Давид с арфой среди овец → Храм Соломона на горе на рассвете («вершина»), солнце начинает клониться.
export default function build({ THREE, lib, meta }) {
  const { ramp, lerp, clamp, ease, easeIn, easeOut, cameraPath, handheld, rng, fbm, noise2 } = lib;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 3000);
  scene.fog = new THREE.FogExp2('#c08a60', 0.004);
  const C = meta.cues;
  const T_LOW = 11.6, T_HIT = 16.3;
  // камера по ключам; высота позиции — над рельефом hf (если задан)
  const camPath = (keys, t, hf) => {
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, p0, l0] = keys[i], [t1, p1, l1] = keys[Math.min(i + 1, keys.length - 1)]; const k = t1 > t0 ? ease((t - t0) / (t1 - t0)) : 1;
    const x = lerp(p0[0], p1[0], k), z = lerp(p0[2], p1[2], k);
    camera.position.set(x, lerp(p0[1], p1[1], k) + (hf ? hf(x, z) : 0), z); camera.lookAt(lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k), lerp(l0[2], l1[2], k));
  };

  const sky = lib.skyDome({ top: '#2a4468', horizon: '#f0a060', bottom: '#4a3020', sunDir: [0, 0.06, -1], sunColor: '#ffd8a0', sunSize: 0.035, sunGlow: 1.1 });
  scene.add(sky);
  const hemi = new THREE.HemisphereLight('#9ab4d8', '#4a3424', 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffcf98', 2.0); scene.add(sun); scene.add(sun.target);
  const colA = new THREE.Color(), colB = new THREE.Color();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), eul = new THREE.Euler();
  const pplGeo = new THREE.LatheGeometry([[0, 0], [.34, 0], [.3, .5], [.22, 1.05], [.25, 1.3], [.12, 1.44], [.11, 1.52], [.12, 1.62], [.08, 1.72], [0, 1.76]].map(([x, y]) => new THREE.Vector2(x, y)), 7);
  const dustTex = [lib.cloudTexture(81), lib.cloudTexture(82), lib.cloudTexture(83)];
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b04a', metalness: 0.35, roughness: 0.35, emissive: '#5a3a08', emissiveIntensity: 0.6 });
  const bronze = new THREE.MeshStandardMaterial({ color: '#a8743a', metalness: 0.4, roughness: 0.4, emissive: '#2a1404', emissiveIntensity: 0.5 });

  const crowd = (n, seed, place, color = '#4a3424', spears = false) => {
    const g = new THREE.Group(); const r = rng(seed);
    const im = new THREE.InstancedMesh(pplGeo, new THREE.MeshStandardMaterial({ color, roughness: 1 }), n); g.add(im);
    let sp = null; if (spears) { const sg = new THREE.CylinderGeometry(0.025, 0.025, 1, 4); sg.translate(0, 0.5, 0); sp = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 1 }), n); g.add(sp); }
    for (let i = 0; i < n; i++) { const [x, y, z, ry] = place(r, i); const s = 0.9 + r() * 0.25;
      im.setMatrixAt(i, tmpM.compose(tmpP.set(x, y, z), tmpQ.setFromEuler(eul.set(0, ry, 0)), tmpS.set(s, s, s)));
      im.setColorAt(i, new THREE.Color(color).multiplyScalar(0.6 + r() * 0.8));
      if (sp) sp.setMatrixAt(i, tmpM.compose(tmpP.set(x + 0.3, y + 0.2, z), tmpQ.setFromEuler(eul.set((r() - .5) * 0.15, 0, (r() - .5) * 0.15)), tmpS.set(1, 3.0 + r() * 0.6, 1)));
    }
    return g;
  };

  // ================= 1: Саул =================
  const g1 = new THREE.Group(); scene.add(g1);
  const h1 = (x, z) => fbm(x * 0.01, z * 0.01, 4) * 6 + Math.max(0, 1 - Math.hypot(x, z + 4) / 9) * 2.2;
  g1.add(lib.terrain({ size: 600, seg: 120, heightFn: h1, colorFn: (x, z, y, sl) => new THREE.Color('#6a5434').lerp(new THREE.Color('#3a3a22'), clamp(noise2(x * 0.03, z * 0.03) + 0.4)).multiplyScalar(0.7) }));
  const saul = lib.figure({ height: 2.35, robe: '#3a1a22', hoodColor: '#3a1a22', hood: false, skin: '#7a5034', seed: 7, belt: '#c8a040' });
  saul.position.set(0, h1(0, -4), -4); g1.add(saul);
  const crown = new THREE.Group();
  { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.09, 16, 1, true), gold); crown.add(band);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), gold); sp.position.set(Math.cos(a) * 0.145, 0.09, Math.sin(a) * 0.145); crown.add(sp); } }
  crown.position.y = 2.35 / 1.8 * 1.74; saul.add(crown);
  const crownGlow = lib.glow('#ffd890', 1.4, 0.5); crownGlow.position.y = 2.32; saul.add(crownGlow);
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.9, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#5a1418', roughness: 0.9, side: THREE.DoubleSide })); cloak.position.set(0, 0.95 + 0.25, -0.08); saul.add(cloak);
  const sword = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.02), new THREE.MeshStandardMaterial({ color: '#c0c0c8', metalness: 0.6, roughness: 0.3 })); sword.position.set(0, -0.9, 0.05); saul.parts.arms[1].add(sword);
  g1.add(crowd(240, 11, (r) => { const a = (r() - .5) * 2.6 + Math.PI / 2; const d = 4.5 + Math.sqrt(r()) * 22; const x = Math.cos(a) * d, z = -4 + Math.sin(a) * d; return [x, h1(x, z) - 0.05, z, Math.atan2(-x, -4 - z)]; }));
  const motes1 = lib.motes({ count: 400, box: [40, 10, 30], center: [0, 4, 6], size: 3, color: '#ffd8a0', speed: 0.3, opacity: 0.5 }); g1.add(motes1);

  // ================= 2/3: долина Эла =================
  const g2 = new THREE.Group(); scene.add(g2);
  const h2 = (x, z) => 24 * lib.smooth(4, 62, Math.abs(x)) + Math.max(0, Math.abs(x) - 70) * 0.08 + fbm(x * 0.012, z * 0.012, 4) * 4 * Math.min(1, Math.abs(x) / 15) + Math.min(1, Math.abs(x) / 6) * 0.6 - 0.6;
  g2.add(lib.terrain({ size: 700, seg: 140, heightFn: h2, colorFn: (x, z, y, sl) => new THREE.Color('#9a7a4a').lerp(new THREE.Color('#5a5a30'), clamp(noise2(x * 0.02, z * 0.02) * 0.9 + 0.3)).lerp(new THREE.Color('#6a5038'), clamp(sl * 2)).multiplyScalar(0.8) }));
  const brook = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 600), new THREE.MeshStandardMaterial({ color: '#7a8a9a', roughness: 0.2, metalness: 0.3 })); brook.rotation.x = -Math.PI / 2; brook.position.set(0, -0.5, 0); g2.add(brook);
  const armyPlace = (side) => (r) => { const x = side * (40 + r() * 22), z = (r() - .5) * 120; return [x, h2(x, z) - 0.05, z, side > 0 ? -Math.PI / 2 : Math.PI / 2]; };
  g2.add(crowd(420, 21, armyPlace(1), '#3a2a2a', true));
  g2.add(crowd(380, 22, armyPlace(-1), '#5a4430', true));
  // Голиаф
  const GX = 8, DX = -8;
  const goliPivot = new THREE.Group(); goliPivot.position.set(GX, h2(GX, 0), 0); g2.add(goliPivot);
  const goli = lib.figure({ height: 4.8, robe: '#3a2c22', skin: '#6a4a30', hood: false, seed: 31, belt: '#7a5a2a' }); goli.rotation.y = -Math.PI / 2; goliPivot.add(goli);
  { const s = 4.8 / 1.8;
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), bronze); helm.position.y = 1.62 * s; goli.add(helm);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.03 * s, 0.1 * s, 0.32 * s), new THREE.MeshStandardMaterial({ color: '#7a1a10', roughness: 0.8 })); crest.position.y = 1.78 * s; goli.add(crest);
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * s, 0.24 * s, 0.5 * s, 16), bronze); chest.position.y = 1.15 * s; goli.add(chest);
    const greave = [-1, 1].map((k) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.06 * s, 0.35 * s, 8), bronze); m.position.set(k * 0.12 * s, 0.2 * s, 0.18 * s); goli.add(m); return m; });
    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.03 * s, 2.6 * s, 6), new THREE.MeshStandardMaterial({ color: '#3a2a1a', roughness: 0.9 })); spear.position.set(0, 0.2 * s, 0.05 * s); goli.parts.arms[1].add(spear);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.25 * s, 6), bronze); tip.position.set(0, 1.5 * s + 0.2 * s, 0.05 * s); goli.parts.arms[1].add(tip);
    goli.parts.arms[1].rotation.set(-0.15, 0, 0.1);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.32 * s, 0.04 * s, 20), bronze); shield.rotation.x = Math.PI / 2; shield.position.set(-0.05 * s, -0.4 * s, 0.1 * s); goli.parts.arms[0].add(shield);
    goli.parts.arms[0].rotation.set(-0.5, 0, -0.25); void greave; }
  // Давид
  const david = lib.figure({ height: 1.55, robe: '#8a6a44', skin: '#9a6a4a', hood: false, seed: 41, belt: '#5a3a1a' });
  david.position.set(DX, h2(DX, 0), 0); david.rotation.y = Math.PI / 2; g2.add(david);
  const sling = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 3), new THREE.MeshBasicMaterial({ color: '#3a2a1a' })); sling.position.y = -0.95; david.parts.arms[1].add(sling);
  const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: '#4a3a2a' })); pouch.position.y = -1.3; david.parts.arms[1].add(pouch);
  const stone = lib.glow('#fff0c8', 0.6, 1); g2.add(stone);
  const trail = []; for (let i = 0; i < 16; i++) { const g = lib.glow('#ffd28a', 0.9 - i * 0.04, 0); g2.add(g); trail.push(g); }
  const hitFlash = lib.glow('#fff2d0', 6, 0); g2.add(hitFlash);
  const fallDust = []; { const r = rng(9); for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex[i % 3], color: '#b89a72', transparent: true, depthWrite: false, opacity: 0 })); sp.userData = { x: GX - 0.5 - r() * 4.5, z: (r() - .5) * 4, r: r() }; g2.add(sp); fallDust.push(sp); } }
  const stonePos = (t) => { const k = clamp((t - 15.85) / (T_HIT - 15.85)); const a = new THREE.Vector3(DX + 0.3, h2(DX, 0) + 1.9, 0.2), b = new THREE.Vector3(GX - 0.15, h2(GX, 0) + 4.45, 0);
    return a.lerp(b, k).add(new THREE.Vector3(0, Math.sin(k * Math.PI) * 0.8, 0)); };

  // ================= 4: Давид с арфой ночью =================
  const g4 = new THREE.Group(); scene.add(g4);
  const h4 = (x, z) => 7 * Math.exp(-Math.pow((z - 8) / 16, 2)) + 34 * lib.smooth(-50, -240, z) + fbm(x * 0.012, z * 0.012, 4) * 4 - Math.max(0, z - 20) * 0.08;
  g4.add(lib.terrain({ size: 700, seg: 130, center: [0, -150], heightFn: h4, colorFn: (x, z, y, sl) => new THREE.Color('#3a4a3a').lerp(new THREE.Color('#2a2a24'), clamp(noise2(x * 0.04, z * 0.04) + 0.3)) }));
  const DV = [2, 0, 8]; const dY = h4(DV[0], DV[2]);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), new THREE.MeshStandardMaterial({ color: '#4a4640', roughness: 1, flatShading: true })); rock.scale.set(0.8, 0.5, 0.7); rock.position.set(DV[0] + 2.4, h4(DV[0] + 2.4, DV[2] - 0.4) + 0.1, DV[2] - 0.4); void rock;
  const harpist = lib.figure({ height: 1.65, robe: '#6a5038', skin: '#9a6a4a', hood: false, seed: 51, belt: '#3a2a1a' });
  harpist.position.set(DV[0], dY - 0.05, DV[2]); harpist.rotation.y = 0.3; g4.add(harpist);
  const lyre = new THREE.Group();
  { const wood = new THREE.MeshStandardMaterial({ color: '#7a4a24', roughness: 0.6 });
    [-1, 1].forEach((s) => { const arm = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 5, 12, Math.PI * 0.6), wood); arm.position.set(s * 0.12, 0.1, 0); arm.rotation.z = s > 0 ? -0.3 : Math.PI + 0.3 - Math.PI * 0.6 + Math.PI * 0.6; lyre.add(arm); });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 5), wood); bar.rotation.z = Math.PI / 2; bar.position.y = 0.36; lyre.add(bar);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.08), wood); body.position.y = -0.05; lyre.add(body);
    for (let i = 0; i < 6; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.4, 3), new THREE.MeshBasicMaterial({ color: '#e8d8b0' })); st.position.set(-0.1 + i * 0.04, 0.16, 0.02); lyre.add(st); } }
  lyre.position.set(0.05, 1.05, 0.28); lyre.rotation.set(-0.3, 0, 0.25); harpist.add(lyre);
  harpist.parts.arms[0].rotation.set(-0.9, 0, -0.35); harpist.parts.arms[1].rotation.set(-1.0, 0, 0.3);
  const camp = lib.fire({ count: 200, radius: 0.3, height: 1.1, size: 9, intensity: 0.6, seed: 61 }); camp.position.set(DV[0] + 1.3, h4(DV[0] + 1.3, DV[2] - 0.6) - 0.05, DV[2] - 0.6); g4.add(camp);
  const campLight = new THREE.PointLight('#ff9a50', 0, 25, 1.6); campLight.position.set(camp.position.x, camp.position.y + 0.8, camp.position.z); g4.add(campLight);
  const campGlow = lib.glow('#ff9040', 4, 0.5); campGlow.position.set(camp.position.x, camp.position.y + 0.5, camp.position.z); g4.add(campGlow);
  // овцы
  const NS = 46; const sheepBody = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshStandardMaterial({ color: '#e8e2d4', roughness: 1 }), NS);
  const sheepHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 1 }), NS);
  const sheepD = []; { const r = rng(71); for (let i = 0; i < NS; i++) { const left = r() < 0.75; const x = left ? DV[0] - 2.2 - r() * 18 : DV[0] + 8 + r() * 10, z = DV[2] - 3 + r() * (left ? 13 : 9); sheepD.push([x, z, r() * 6.28, r()]); sheepBody.setColorAt(i, new THREE.Color('#e8e2d4').multiplyScalar(0.75 + r() * 0.3)); } }
  g4.add(sheepBody, sheepHead);
  const stars4 = lib.starfield({ count: 6000, radius: 1400, size: 2.6, minY: 0.02 }); g4.add(stars4);
  const moonGlow = lib.glow('#cfe0ff', 160, 0.35); g4.add(moonGlow);

  // ================= 5: Храм на рассвете =================
  const g5 = new THREE.Group(); scene.add(g5);
  const h5 = (x, z) => 46 * Math.exp(-Math.pow(Math.hypot(x, z) / 85, 2)) + fbm(x * 0.01, z * 0.01, 4) * 10 + Math.max(0, Math.hypot(x, z) - 260) * 0.1;
  g5.add(lib.terrain({ size: 1100, seg: 150, heightFn: h5, colorFn: (x, z, y, sl) => new THREE.Color('#8a7050').lerp(new THREE.Color('#5a5a38'), clamp(noise2(x * 0.02, z * 0.02) + 0.3)).lerp(new THREE.Color('#6a5840'), clamp(sl * 2)).multiplyScalar(0.75) }));
  const TY = h5(0, 0) + 1; const stoneMat = new THREE.MeshStandardMaterial({ color: '#d8c4a0', roughness: 0.85 });
  const temple = new THREE.Group(); temple.position.set(0, TY, 0); g5.add(temple);
  { const box = (w, h, d, x, y, z, m = stoneMat) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); temple.add(b); return b; };
    box(80, 6, 60, 0, -6, 0); // платформа
    box(64, 0.6, 46, 0, 0, 0, new THREE.MeshStandardMaterial({ color: '#c8b494', roughness: 0.9 }));
    [[-32, 0, 0.8, 46], [32, 0, 0.8, 46], [0, -23, 64, 0.8], [0, 23, 64, 0.8]].forEach(([x, z, w, d]) => box(w, 3, d, x, 0, z)); // стены двора
    box(11, 13, 30, 0, 0.6, -6); // святилище
    box(11.6, 1.2, 30.6, 0, 13.6, -6, gold); // золотой карниз
    box(16, 20, 5, 0, 0.6, 11); // притвор
    box(16.6, 1.4, 5.6, 0, 20.6, 11, gold);
    box(5, 8, 0.4, 0, 0.6, 13.6, gold); // двери
    [-5.5, 5.5].forEach((x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 14, 16), bronze); p.position.set(x, 7.6, 16.5); temple.add(p); const cap = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), bronze); cap.position.set(x, 15.2, 16.5); temple.add(cap); });
    box(5, 2.2, 5, -8, 0.6, 19, bronze); // жертвенник
    const sea = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.0, 1.6, 20), bronze); sea.position.set(10, 1.4, 18); temple.add(sea);
  }
  const altarSmoke = lib.motes({ count: 120, box: [3, 16, 3], center: [-8, TY + 10, 19], size: 18, color: '#d8c8b0', speed: 0.25, kind: 'rise', opacity: 0.18 }); g5.add(altarSmoke);
  // город на склонах + стены
  const NH = 520; const houses = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#cbb48e', roughness: 0.95 }), NH);
  { const r = rng(5); let n = 0; while (n < NH) { const x = (r() - .3) * 260, z = 30 + r() * 170; const d = Math.hypot(x, z); if (d < 55 || d > 190) continue; const w = 4 + r() * 5;
    houses.setMatrixAt(n, tmpM.compose(tmpP.set(x, h5(x, z) - 0.5, z), tmpQ.setFromEuler(eul.set(0, r() * 0.5 - 0.25, 0)), tmpS.set(w, 3 + r() * 4, w * (0.7 + r() * 0.5)))); houses.setColorAt(n, new THREE.Color('#cbb48e').multiplyScalar(0.7 + r() * 0.35)); n++; } }
  g5.add(houses);
  const NWALL = 60; const cwall = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), stoneMat, NWALL);
  for (let i = 0; i < NWALL; i++) { const a = Math.PI * (0.05 + 0.9 * i / NWALL); const R = 200; const x = Math.cos(a) * R * 1.1 - 20, z = Math.sin(a) * R * 0.95 + 10; const a2 = Math.PI * (0.05 + 0.9 * (i + 1) / NWALL); const x2 = Math.cos(a2) * R * 1.1 - 20, z2 = Math.sin(a2) * R * 0.95 + 10;
    const L = Math.hypot(x2 - x, z2 - z); cwall.setMatrixAt(i, tmpM.compose(tmpP.set((x + x2) / 2, h5((x + x2) / 2, (z + z2) / 2) - 1, (z + z2) / 2), tmpQ.setFromEuler(eul.set(0, -Math.atan2(z2 - z, x2 - x), 0)), tmpS.set(L + 1, i % 6 === 0 ? 14 : 10, 4))); }
  g5.add(cwall);
  const clouds5 = lib.cloudLayer({ count: 14, area: [900, 400], y: 140, scale: [260, 70], seed: 17, color: '#ffc8a0', opacity: 0.5, center: [0, -300] }); g5.add(clouds5);
  const templeGlow = lib.glow('#ffd890', 60, 0); templeGlow.position.set(0, TY + 14, 8); g5.add(templeGlow);

  return {
    scene, camera,
    update(t, S) {
      const shot = t < C.goliath ? 1 : t < C.harp ? 2 : t < C.temple ? 4 : 5;
      g1.visible = shot === 1; g2.visible = shot === 2; g4.visible = shot === 4; g5.visible = shot === 5;
      S.post.bloomThreshold = 0.8; S.post.bloom = 0.55; S.post.exposure = 1.0;
      if (shot === 1) {
        const dim = ramp(t, 5.4, 1.4);
        sky.u.top.value.set('#30486e').lerp(colA.set('#1a2030'), dim); sky.u.horizon.value.set('#f4a45c').lerp(colA.set('#b0583a'), dim); sky.u.bottom.value.set('#4a3020');
        sky.u.sunDir.value.set(0.02, 0.05 - dim * 0.02, -1).normalize(); sky.u.sunColor.value.set('#ffd0a0'); sky.u.sunSize.value = 0.022; sky.u.sunGlow.value = 0.75 - dim * 0.3; sky.u.starAmt.value = 0;
        scene.fog.color.set('#a8704a').lerp(colA.set('#4a3028'), dim); scene.fog.density = 0.004; S.post.exposure = 0.92;
        hemi.color.set('#9ab4d8'); hemi.groundColor.set('#3a2a1a'); hemi.intensity = 0.5 - dim * 0.2; sun.color.set('#ffc890'); sun.intensity = 1.6 - dim * 0.8; sun.position.set(0, 30, -200); sun.target.position.set(0, 0, 0);
        crownGlow.material.opacity = 0.55 * (1 - dim * 0.8);
        saul.parts.arms[1].rotation.set(lerp(-0.2, -2.6, ramp(t, 2.6, 1.2)), 0, 0.15);
        S.post.bloomThreshold = 0.75;
        camPath([[0, [2.5, 1.75, 27], [0, h1(0, -4) + 2.4, -4]], [C.goliath, [1.2, 1.7, 15], [0, h1(0, -4) + 2.7, -4]]], t, h1);
        handheld(camera, t, 0.005);
      } else if (shot === 2) {
        sky.u.top.value.set('#3a5a84'); sky.u.horizon.value.set('#f0c08a'); sky.u.bottom.value.set('#6a5038'); sky.u.sunDir.value.set(0.7, 0.18, -0.6).normalize(); sky.u.sunColor.value.set('#fff0d0'); sky.u.sunSize.value = 0.03; sky.u.sunGlow.value = 0.9; sky.u.starAmt.value = 0;
        scene.fog.color.set('#d8b890'); scene.fog.density = 0.0035;
        hemi.color.set('#a8c0e0'); hemi.groundColor.set('#5a4430'); hemi.intensity = 0.7; sun.color.set('#ffdcaa'); sun.intensity = 2.4; sun.position.set(140, 50, -100); sun.target.position.set(0, 0, 0);
        // Давид раскручивает пращу
        const whirl = ramp(t, 13.3, 0.5) * (1 - ramp(t, 15.85, 0.15));
        const throwK = ramp(t, 15.8, 0.15);
        const ang = t * 13;
        david.parts.arms[1].rotation.set(lerp(-0.2, -2.8, whirl) + whirl * Math.sin(ang) * 0.35 + throwK * 1.6 * (1 - ramp(t, 16.4, 0.8)), 0, whirl * Math.cos(ang) * 0.3);
        david.parts.arms[0].rotation.set(lerp(0, -0.9, ramp(t, 13.3, 0.6)), 0, 0);
        sling.visible = pouch.visible = true;
        // камень
        const fly = t >= 15.85 && t < T_HIT + 0.02;
        stone.visible = fly; trail.forEach((g, i) => { const tt = t - i * 0.012; g.visible = fly && tt >= 15.85; if (g.visible) { g.position.copy(stonePos(tt)); g.material.opacity = (1 - i / 16) * 0.8; } });
        if (fly) stone.position.copy(stonePos(t));
        hitFlash.position.set(GX - 0.1, h2(GX, 0) + 4.45, 0); hitFlash.material.opacity = t > T_HIT ? Math.exp(-(t - T_HIT) * 6) * 0.9 : 0;
        // Голиаф падает вперёд (к Давиду)
        const fall = easeIn(clamp((t - T_HIT - 0.15) / 1.05)); const wob = ramp(t, T_HIT, 0.15) * (1 - ramp(t, T_HIT + 0.3, 0.2));
        goliPivot.rotation.z = fall * 1.5 - wob * 0.08; goliPivot.position.y = h2(GX, 0) - fall * 0.3;
        goli.parts.arms[0].rotation.x = lerp(-0.5, -1.6, fall); goli.parts.arms[1].rotation.x = lerp(-0.15, -1.2, ramp(t, T_HIT, 0.6));
        goli.parts.arms[1].rotation.z = 0.1 + ramp(t, T_HIT, 0.5) * 0.4;
        const impact = T_HIT + 1.2;
        fallDust.forEach((sp) => { const d = sp.userData; const k = clamp((t - impact - d.r * 0.15) / 2.2); sp.position.set(d.x, h2(d.x, d.z) + 0.6 + k * 1.8, d.z); const s = 2 + easeOut(k) * 6; sp.scale.set(s, s * 0.6, 1); sp.material.opacity = t > impact ? ramp(t, impact, 0.15) * (1 - k) * 0.85 : 0; });
        const shake = ramp(t, impact, 0.08) * (1 - ramp(t, impact + 0.1, 0.8));
        S.post.bloom = 0.6 + hitFlash.material.opacity * 0.4;
        if (t < T_LOW) { // общий план долины
          camPath([[C.goliath, [-6, 9, 46], [0, 4.5, 0]], [T_LOW, [-2, 6, 34], [0, 3.5, 0]]], t, h2);
        } else if (t < C.throw) { // низкий ракурс из-за спины Давида
          camPath([[T_LOW, [DX - 4.5, 0.6, 2.6], [GX, h2(GX, 0) + 3.4, 0]], [C.throw, [DX - 3.2, 0.5, 2.0], [GX, h2(GX, 0) + 3.7, 0]]], t, h2);
        } else { // сбоку: полёт камня и падение
          camPath([[C.throw, [0, 1.6, 21], [0.5, 2.2, 0]], [C.harp, [1.5, 1.3, 17.5], [1.5, 1.8, 0]]], t, h2);
        }
        handheld(camera, t * (1 + shake * 10), 0.004 + shake * 0.03);
      } else if (shot === 4) {
        sky.u.top.value.set('#020512'); sky.u.horizon.value.set('#141c34'); sky.u.bottom.value.set('#05060a'); sky.u.sunDir.value.set(-1.1, 0.42, -1).normalize(); sky.u.sunColor.value.set('#c8d8ff'); sky.u.sunSize.value = 0.02; sky.u.sunGlow.value = 0.22; sky.u.starAmt.value = 1.2;
        moonGlow.position.copy(sky.u.sunDir.value).multiplyScalar(800).add(camera.position); moonGlow.material.opacity = 0.08;
        scene.fog.color.set('#0a1020'); scene.fog.density = 0.006;
        hemi.color.set('#5a70a8'); hemi.groundColor.set('#0a0a0c'); hemi.intensity = 0.9; sun.color.set('#a8c0ff'); sun.intensity = 1.1; sun.position.set(-150, 120, -300); sun.target.position.set(0, 0, 0);
        campLight.intensity = 7 * (0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.1)); campGlow.material.opacity = 0.22 + 0.05 * Math.sin(t * 9);
        // перебирает струны
        harpist.parts.arms[1].rotation.set(-1.0 + Math.sin(t * 5) * 0.08, 0, 0.3 + Math.sin(t * 3.3) * 0.05);
        for (let i = 0; i < NS; i++) { const [x, z, ph, r] = sheepD[i]; const y = h4(x, z); const graze = Math.sin(t * (0.5 + r) + ph);
          sheepBody.setMatrixAt(i, tmpM.compose(tmpP.set(x, y + 0.36, z), tmpQ.setFromEuler(eul.set(0, ph, 0)), tmpS.set(0.6, 0.55, 0.9)));
          sheepHead.setMatrixAt(i, tmpM.compose(tmpP.set(x + Math.sin(ph) * 0.46, y + 0.3 + graze * 0.12, z + Math.cos(ph) * 0.46), tmpQ, tmpS.set(0.8, 0.95, 1.1))); }
        sheepBody.instanceMatrix.needsUpdate = true; sheepHead.instanceMatrix.needsUpdate = true;
        S.post.exposure = 1.05; S.post.bloom = 0.7; S.post.bloomThreshold = 0.7;
        // к цитате — камера уходит вниз-назад, Давид в левой трети, центр — тихое звёздное небо
        S.quote.y = 0.42;
        camPath([[C.harp, [DV[0] + 2.0, 0.8, DV[2] + 6.5], [DV[0] + 0.2, dY + 1.3, DV[2]]], [24.6, [DV[0] + 4.0, 0.7, DV[2] + 12.0], [DV[0] - 3.0, dY + 2.4, DV[2] - 6]], [C.temple, [DV[0] + 5.0, 0.6, DV[2] + 15], [DV[0] - 5, dY + 4.0, DV[2] - 14]]], t, h4);
        handheld(camera, t, 0.003);
      } else {
        const sink = ramp(t, 35.6, 3.2);
        sky.u.top.value.set('#4a6a9a').lerp(colA.set('#2a2a48'), sink); sky.u.horizon.value.set('#ffc080').lerp(colA.set('#e06a3a'), sink); sky.u.bottom.value.set('#7a5a40');
        sky.u.sunDir.value.set(-0.55, lerp(0.09, 0.0, sink), 0.8).normalize(); sky.u.sunColor.value.set('#ffe0a8').lerp(colA.set('#ff8a50'), sink); sky.u.sunSize.value = 0.035; sky.u.sunGlow.value = 1.1; sky.u.starAmt.value = 0;
        scene.fog.color.set('#e0b088').lerp(colA.set('#9a5a40'), sink); scene.fog.density = 0.0022;
        hemi.color.set('#b0c8e8').lerp(colA.set('#7a6a90'), sink); hemi.groundColor.set('#5a4430'); hemi.intensity = 0.55 - sink * 0.15;
        sun.color.set('#ffd8a0').lerp(colA.set('#ff8048'), sink); sun.intensity = 2.8 - sink * 1.3; sun.position.set(-260, lerp(70, 25, sink), 380); sun.target.position.set(0, 40, 0);
        templeGlow.material.opacity = 0.2 * ramp(t, 32.5, 2) * (1 - sink * 0.6); S.post.exposure = lerp(0.55, 1.0, ramp(t, C.temple, 1.6));
        clouds5.drift(t, 2, 0); clouds5.setColor(colB.set('#ffd0a8').lerp(colA.set('#c06048'), sink));
        S.post.bloomThreshold = 0.78; S.post.bloom = 0.6;
        camPath([[C.temple, [75, h5(75, 265) + 3, 265], [0, TY + 10, 0]], [35.0, [48, TY + 36, 135], [0, TY + 9, 0]], [S.dur, [40, TY + 31, 120], [0, TY + 6, -4]]], t);
        handheld(camera, t, 0.003);
      }
      sky.position.copy(camera.position);
    },
  };
}
