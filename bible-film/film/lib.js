// Общие кирпичики для сцен. Всё детерминировано: никакого Math.random, только rng(seed),
// и всё анимируется от абсолютного времени t (кадры рендерятся в произвольном порядке).
import * as THREE from 'three';

// ---------- математика ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
export const ease = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
export const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
export const easeIn = (k) => Math.pow(clamp(k), 3);
/** 0→1 за [a, a+d] */
export const ramp = (t, a, d = 1) => smooth(a, a + d, t);
/** окно: 0 → 1 (на a..a+fin) → 0 (на b-fout..b) */
export const win = (t, a, b, fin = 0.5, fout = 0.5) => Math.min(ramp(t, a, fin), 1 - ramp(t, b - fout, fout));

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
// value-noise 2D + fbm (для рельефа на CPU)
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
export function fbm(x, y, oct = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }

// GLSL-шум для шейдеров
export const GLSL_NOISE = /* glsl */`
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm2(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
`;

// ---------- текстуры, нарисованные на canvas ----------
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
let _radial;
export function radialTexture() {
  return _radial ||= canvasTexture(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
}
/** мягкая облачная текстура с альфой */
export function cloudTexture(seed = 1, size = 256) {
  return canvasTexture(size, size, (g, w, h) => {
    const img = g.createImageData(w, h); const o = seed * 17.3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const nx = x / w - 0.5, ny = y / h - 0.5; const r = Math.sqrt(nx * nx + ny * ny) * 2;
      const n = fbm(x / w * 4 + o, y / h * 4 - o, 6) * 0.5 + 0.5;
      const a = clamp((n - 0.35) * 2.2) * clamp(1 - r * r);
      const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
  });
}

// ---------- свет и атмосфера ----------
/** Небесный купол: градиент + солнце/луна. Меняйте sky.uniforms.*.value в update. */
export function skyDome({ top = '#0b1a33', horizon = '#c98a5a', bottom = '#1a0f0a', sunDir = [0, 0.1, -1], sunColor = '#ffd9a0', sunSize = 0.03, sunGlow = 1.0, radius = 900, stars = 0 } = {}) {
  const u = {
    top: { value: new THREE.Color(top) }, horizon: { value: new THREE.Color(horizon) }, bottom: { value: new THREE.Color(bottom) },
    sunDir: { value: new THREE.Vector3(...sunDir).normalize() }, sunColor: { value: new THREE.Color(sunColor) },
    sunSize: { value: sunSize }, sunGlow: { value: sunGlow }, starAmt: { value: stars }, time: { value: 0 }, exposure: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: GLSL_NOISE + `
      uniform vec3 top, horizon, bottom, sunDir, sunColor; uniform float sunSize, sunGlow, starAmt, time, exposure; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = h > 0. ? mix(horizon, top, pow(clamp(h,0.,1.), .55)) : mix(horizon, bottom, pow(clamp(-h*3.,0.,1.), .6));
        float s = max(dot(d, normalize(sunDir)), 0.);
        float disc = smoothstep(cos(sunSize), cos(sunSize*.85), s);
        c += sunColor * (disc*6. + pow(s, 12.)*.35*sunGlow + pow(s, 200.)*1.2*sunGlow + pow(s,3.)*.12*sunGlow);
        if (starAmt > 0. && h > 0.) {
          vec2 g = vec2(atan(d.z, d.x)*180., asin(h)*180.); vec2 cell = floor(g); vec2 f = fract(g)-.5;
          float r = h21(cell); float st = step(.985, r) * smoothstep(.09, 0., length(f + (vec2(h21(cell+3.), h21(cell+7.))-.5)*.6));
          float tw = .6 + .4*sin(time*(1.+r*3.) + r*40.);
          c += vec3(.85,.9,1.) * st * tw * starAmt * (0.5 + 1.5*fract(r*91.)) * smoothstep(0., .25, h);
        }
        gl_FragColor = vec4(c*exposure, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return Object.assign(mesh, { u });
}

/** Звёзды-точки (с мерцанием) — для ночных сцен, когда звёзд из купола мало */
export function starfield({ count = 6000, radius = 600, seed = 7, size = 2.2, minY = -0.1, color = '#dfe8ff' } = {}) {
  const r = rng(seed), pos = new Float32Array(count * 3), sd = new Float32Array(count), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let x, y, z; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; } while (x * x + y * y + z * z > 1 || y < minY);
    const l = Math.hypot(x, y, z); pos.set([x / l * radius, y / l * radius, z / l * radius], i * 3);
    sd[i] = r() * 100; sz[i] = Math.pow(r(), 6) * 3 + 0.4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(sd, 1)); g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const u = { time: { value: 0 }, size: { value: size }, opacity: { value: 1 }, color: { value: new THREE.Color(color) }, pxr: { value: 1 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `attribute float seed; attribute float sz; uniform float time, size, pxr; varying float vA;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
        vA = .55 + .45*sin(time*(.7+fract(seed)*2.5) + seed); gl_PointSize = size*sz*pxr; }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying float vA;
      void main(){ vec2 p = gl_PointCoord-.5; float d = length(p); float a = smoothstep(.5, 0., d); a = a*a;
        gl_FragColor = vec4(color*vA*opacity*a*1.6, 1.); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false;
  return Object.assign(pts, { u });
}

/** Пылинки/искры, плавающие в объёме box. kind: 'dust' | 'embers' | 'snow' | 'rise' */
export function motes({ count = 800, box = [40, 20, 40], center = [0, 8, 0], seed = 3, size = 6, color = '#ffd8a8', speed = 0.3, kind = 'dust', opacity = 0.6 } = {}) {
  const r = rng(seed), p = new Float32Array(count * 3), sd = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { p.set([(r() - .5) * box[0], (r() - .5) * box[1], (r() - .5) * box[2]], i * 3); sd.set([r(), r()], i * 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 2));
  const u = { time: { value: 0 }, size: { value: size }, color: { value: new THREE.Color(color) }, opacity: { value: opacity }, box: { value: new THREE.Vector3(...box) }, speed: { value: speed }, pxr: { value: 1 } };
  const rise = kind === 'embers' || kind === 'rise' ? 1 : kind === 'snow' ? -1 : 0;
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec2 sd; uniform float time, size, speed, pxr; uniform vec3 box; varying float vA;
      void main(){ vec3 q = position; float t = time*speed;
        q.x += sin(t*.7 + sd.x*40.)*1.5; q.z += cos(t*.5 + sd.y*30.)*1.5;
        q.y = mod(q.y + box.y*.5 + ${rise.toFixed(1)}*t*(2.+sd.x*3.) + sin(t + sd.y*20.)*.6, box.y) - box.y*.5;
        vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv;
        float edge = smoothstep(.5, .35, abs(q.y/box.y));
        vA = edge * (.4+.6*sin(time*(1.+sd.x*2.)+sd.y*50.)*.5+.5);
        gl_PointSize = min(size*(.4+sd.y)*pxr*(60./max(-mv.z, 1.)), 56.); }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying float vA;
      void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5, 0., d);
        gl_FragColor = vec4(color*a*a*vA*opacity, 1.); }`,
  });
  const pts = new THREE.Points(g, m); pts.position.set(...center); pts.frustumCulled = false;
  return Object.assign(pts, { u });
}

/** Огонь из частиц (костёр, куст, языки пламени). Позиция — через group.position, масштаб — scale. */
export function fire({ count = 600, seed = 11, radius = 0.6, height = 3, size = 40, color1 = '#ffd27a', color2 = '#ff4a12', intensity = 1.0 } = {}) {
  const r = rng(seed), p = new Float32Array(count * 3), sd = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * radius;
    p.set([Math.cos(a) * rr, 0, Math.sin(a) * rr], i * 3); sd.set([r(), r(), r()], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 3));
  const u = { time: { value: 0 }, height: { value: height }, size: { value: size }, c1: { value: new THREE.Color(color1) }, c2: { value: new THREE.Color(color2) }, intensity: { value: intensity }, pxr: { value: 1 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 sd; uniform float time, height, size, pxr; varying float vL; varying float vS;
      void main(){ float life = fract(time*(.8+sd.x*.9) + sd.y); vL = life; vS = sd.z;
        vec3 q = position*(1.-life*.85);
        q.y += life*height*(.6+sd.z*.6);
        q.x += sin(time*3. + sd.y*30. + life*6.)*.15*life*height*.3;
        q.z += cos(time*2.6 + sd.x*30. + life*5.)*.15*life*height*.3;
        vec4 mv = modelViewMatrix*vec4(q,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = min(size*pxr*(1.-life*.7)*(.5+sd.z)*(30./max(-mv.z,1.)), 56.); }`,
    fragmentShader: `uniform vec3 c1, c2; uniform float intensity; varying float vL; varying float vS;
      void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,0.,d);
        vec3 c = mix(c1*2.2, c2, smoothstep(.0,.6,vL)); float fade = smoothstep(0.,.08,vL)*(1.-smoothstep(.55,1.,vL));
        gl_FragColor = vec4(c*a*a*fade*intensity*.55, 1.); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false;
  return Object.assign(pts, { u });
}

/** Дождь: отрезки, падающие в объёме box вокруг center */
export function rain({ count = 6000, box = [80, 40, 80], center = [0, 15, 0], seed = 5, speed = 28, color = '#9fb4c8', opacity = 0.35, slant = 0.25 } = {}) {
  const r = rng(seed), p = new Float32Array(count * 6), sd = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = (r() - .5) * box[0], y = (r() - .5) * box[1], z = (r() - .5) * box[2], s = r();
    p.set([x, y, z, x, y, z], i * 6); sd.set([s, 0, s, 1], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 2));
  const u = { time: { value: 0 }, speed: { value: speed }, box: { value: new THREE.Vector3(...box) }, color: { value: new THREE.Color(color) }, opacity: { value: opacity }, slant: { value: slant } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec2 sd; uniform float time, speed, slant; uniform vec3 box; varying float vE;
      void main(){ vec3 q = position; float fall = time*speed*(.8+sd.x*.4);
        q.y = mod(q.y - fall + box.y*.5, box.y) - box.y*.5; q.x += (q.y)*slant;
        q.y += sd.y*1.1; q.x -= sd.y*1.1*slant; vE = sd.y;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(q,1.); }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying float vE; void main(){ gl_FragColor = vec4(color*opacity*(1.-vE*.7), 1.); }`,
  });
  const ls = new THREE.LineSegments(g, m); ls.position.set(...center); ls.frustumCulled = false;
  return Object.assign(ls, { u });
}

/** Океан/вода. u.time, u.amp, u.choppy; цвета; солнце. Плоскость size×size, центр в 0. */
export function ocean({ size = 600, seg = 220, deep = '#06202c', shallow = '#1d5a63', sky = '#c98a5a', sunDir = [0, 0.15, -1], sunColor = '#ffd9a0', amp = 0.6, choppy = 1.0, foam = 0.0 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const u = {
    time: { value: 0 }, amp: { value: amp }, choppy: { value: choppy }, foam: { value: foam },
    deep: { value: new THREE.Color(deep) }, shallow: { value: new THREE.Color(shallow) }, skyc: { value: new THREE.Color(sky) },
    sunDir: { value: new THREE.Vector3(...sunDir).normalize() }, sunColor: { value: new THREE.Color(sunColor) },
    fogColor: { value: new THREE.Color('#000') }, fogDensity: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `uniform float time, amp, choppy; varying vec3 vW; varying vec3 vN; varying float vH;
      vec3 wave(vec2 p, vec2 d, float wl, float a, float sp, inout vec3 tx, inout vec3 bz){
        float k = 6.2831/wl; float f = k*(dot(d,p) - sp*time); float q = choppy*.5;
        tx += vec3(-q*d.x*d.x*a*k*sin(f), d.x*a*k*cos(f), -q*d.x*d.y*a*k*sin(f));
        bz += vec3(-q*d.x*d.y*a*k*sin(f), d.y*a*k*cos(f), -q*d.y*d.y*a*k*sin(f));
        return vec3(q*a*d.x*cos(f), a*sin(f), q*a*d.y*cos(f)); }
      void main(){ vec3 p = (modelMatrix*vec4(position,1.)).xyz; vec3 tx = vec3(1,0,0), bz = vec3(0,0,1); vec3 o = vec3(0);
        o += wave(p.xz, normalize(vec2(1., .3)), 38., amp*1.0, 6., tx, bz);
        o += wave(p.xz, normalize(vec2(-.4, 1.)), 21., amp*.6, 4.6, tx, bz);
        o += wave(p.xz, normalize(vec2(.7, -.6)), 11., amp*.32, 3.4, tx, bz);
        o += wave(p.xz, normalize(vec2(-.9, -.2)), 6., amp*.18, 2.5, tx, bz);
        o += wave(p.xz, normalize(vec2(.2, .9)), 3.1, amp*.08, 1.8, tx, bz);
        p += o; vW = p; vH = o.y; vN = normalize(cross(bz, tx));
        gl_Position = projectionMatrix*viewMatrix*vec4(p,1.); }`,
    fragmentShader: GLSL_NOISE + `uniform vec3 deep, shallow, skyc, sunDir, sunColor, fogColor; uniform float foam, amp, fogDensity, time; varying vec3 vW; varying vec3 vN; varying float vH;
      void main(){ vec3 n = normalize(vN + vec3(vnoise(vW.xz*.8+time*.3)-.5, 0., vnoise(vW.zx*.8-time*.25)-.5)*.12);
        vec3 v = normalize(cameraPosition - vW); float fr = pow(1. - max(dot(n, v), 0.), 4.);
        vec3 col = mix(deep, shallow, clamp(vH/(amp*2.+.01)+.4, 0., 1.)*.6);
        col = mix(col, skyc, .08 + fr*.85);
        vec3 h = normalize(v + normalize(sunDir)); float sp = pow(max(dot(n, h), 0.), 280.)*8. + pow(max(dot(n,h),0.), 30.)*.25;
        col += sunColor*sp;
        float fm = smoothstep(.55, 1., vH/(amp*1.6+.01) + (vnoise(vW.xz*1.7)-.5)*.6) * foam; col = mix(col, vec3(.9,.95,1.), fm*.8);
        float dist = length(vW - cameraPosition); float fg = 1. - exp(-pow(dist*fogDensity, 2.)); col = mix(col, fogColor, fg);
        gl_FragColor = vec4(col, 1.); }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  return Object.assign(mesh, { u });
}

/** Рельеф: heightFn(x,z) → y; colorFn(x,z,y,slope) → THREE.Color. Стандартный материал (принимает свет и туман). */
export function terrain({ size = 400, seg = 200, heightFn = (x, z) => fbm(x * 0.01, z * 0.01) * 10, colorFn = null, color = '#b98a5a', roughness = 0.95, center = [0, 0] } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const cols = new Float32Array(pos.count * 3); const base = new THREE.Color(color); const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + center[0], z = pos.getZ(i) + center[1]; const y = heightFn(x, z); pos.setY(i, y);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + center[0], z = pos.getZ(i) + center[1];
    if (colorFn) c.copy(colorFn(x, z, pos.getY(i), 1 - nrm.getY(i))); else c.copy(base).multiplyScalar(0.85 + 0.15 * noise2(x * 0.2, z * 0.2));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 }));
  mesh.position.set(center[0], 0, center[1]); mesh.receiveShadow = true;
  return mesh;
}

/** Фигура человека в одежде (силуэтная стилизация). Возвращает Group с .parts для анимации.
 *  opts: height, robe, skin, hood (капюшон/покрывало), staff (посох), glow (свечение-нимб). Стоит на y=0, смотрит в +z. */
export function figure({ height = 1.8, robe = '#3a2a20', skin = '#8a5a3c', hood = true, hoodColor = null, staff = false, belt = '#6b4a2a', glow = 0, emissive = '#000', seed = 1 } = {}) {
  const r = rng(seed); const s = height / 1.8; const grp = new THREE.Group();
  const robeMat = new THREE.MeshStandardMaterial({ color: robe, roughness: 0.9, emissive, emissiveIntensity: 0.0 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  // одежда — тело вращения с лёгкой асимметрией
  const prof = [[0.0, 0], [0.36, 0], [0.33, 0.25], [0.27, 0.7], [0.22, 1.05], [0.25, 1.32], [0.19, 1.42], [0.08, 1.48], [0, 1.48]].map(([x, y]) => new THREE.Vector2(x * s * (0.95 + r() * 0.1), y * s));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), robeMat); grp.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 16, 12), skinMat); head.position.y = 1.6 * s; head.scale.set(1, 1.15, 1.05); grp.add(head);
  let hoodMesh = null;
  if (hood) {
    hoodMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: hoodColor || robe, roughness: 0.9, side: THREE.DoubleSide }));
    hoodMesh.position.y = 1.6 * s; hoodMesh.rotation.x = -0.35; hoodMesh.scale.set(1, 1.25, 1.1); grp.add(hoodMesh);
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.24 * s, 0.32 * s, 16, 1, true), hoodMesh.material); drape.position.y = 1.45 * s; grp.add(drape);
  }
  const b = new THREE.Mesh(new THREE.TorusGeometry(0.235 * s, 0.022 * s, 6, 24), new THREE.MeshStandardMaterial({ color: belt, roughness: 0.8 })); b.rotation.x = Math.PI / 2; b.position.y = 1.0 * s; grp.add(b);
  // руки: плечо-шарнир → рукав
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.24 * s, 1.36 * s, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.09 * s, 0.62 * s, 10), robeMat); sleeve.position.y = -0.31 * s; pivot.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 10, 8), skinMat); hand.position.y = -0.64 * s; pivot.add(hand);
    pivot.rotation.z = side * 0.12; grp.add(pivot); return pivot;
  });
  let staffMesh = null;
  if (staff) {
    staffMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.025 * s, 2.0 * s, 6), new THREE.MeshStandardMaterial({ color: '#5a3e24', roughness: 0.9 }));
    staffMesh.position.set(0.0, -0.3 * s, 0.05 * s); arms[1].add(staffMesh); arms[1].rotation.x = -0.25;
  }
  let halo = null;
  if (glow > 0) {
    halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffe6b0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: glow }));
    halo.scale.set(2.2 * s, 2.2 * s, 1); halo.position.y = 1.25 * s; grp.add(halo);
  }
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  grp.parts = { body, head, hood: hoodMesh, arms, staff: staffMesh, halo, robeMat };
  return grp;
}
/** Простая походка: покачивание и взмах рук. phase — время*скорость. */
export function walkPose(fig, phase, amount = 1) {
  const a = Math.sin(phase * Math.PI * 2) * 0.35 * amount;
  fig.parts.arms[0].rotation.x = a; if (!fig.parts.staff) fig.parts.arms[1].rotation.x = -a;
  fig.parts.body.rotation.z = Math.sin(phase * Math.PI * 2) * 0.03 * amount;
  fig.parts.body.position.y = Math.abs(Math.sin(phase * Math.PI * 2)) * 0.03 * amount;
}

/** Светящийся спрайт (ореол, звезда, солнце) */
export function glow(color = '#ffe2b0', size = 10, opacity = 1) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  sp.scale.set(size, size, 1); return sp;
}

/** Объёмный луч света (конус с мягкими краями). Вершина в 0, светит вниз по -y на length. */
export function lightBeam({ radiusTop = 0.5, radiusBottom = 6, length = 40, color = '#ffe7b8', opacity = 0.35 } = {}) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 48, 1, true); geo.translate(0, -length / 2, 0);
  const u = { color: { value: new THREE.Color(color) }, opacity: { value: opacity }, time: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix*normal);
      vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: GLSL_NOISE + `uniform vec3 color; uniform float opacity, time; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.);
        float along = smoothstep(0., .15, vUv.y) * pow(vUv.y, .6);
        float n = .7 + .3*vnoise(vec2(vUv.x*20., vUv.y*3. - time*.3));
        gl_FragColor = vec4(color*edge*along*n*opacity, 1.); }`,
  });
  const mesh = new THREE.Mesh(geo, m); return Object.assign(mesh, { u });
}

/** Слой облаков-спрайтов. */
export function cloudLayer({ count = 30, area = [400, 400], y = 60, scale = [80, 40], seed = 9, color = '#ffffff', opacity = 0.6, center = [0, 0] } = {}) {
  const grp = new THREE.Group(); const r = rng(seed); const texs = [cloudTexture(seed), cloudTexture(seed + 1), cloudTexture(seed + 2)];
  for (let i = 0; i < count; i++) {
    const m = new THREE.SpriteMaterial({ map: texs[i % 3], color, transparent: true, opacity: opacity * (0.6 + r() * 0.4), depthWrite: false, fog: true });
    const sp = new THREE.Sprite(m); const k = 0.7 + r() * 0.6;
    sp.scale.set(scale[0] * k, scale[1] * k, 1); sp.position.set(center[0] + (r() - .5) * area[0], y + (r() - .5) * scale[1] * 0.4, center[1] + (r() - .5) * area[1]);
    sp.userData.base = sp.position.clone(); sp.userData.o = opacity * (0.6 + r() * 0.4); grp.add(sp);
  }
  grp.drift = (t, vx = 1, vz = 0) => grp.children.forEach((sp) => { sp.position.x = sp.userData.base.x + t * vx; sp.position.z = sp.userData.base.z + t * vz; });
  grp.setOpacity = (k) => grp.children.forEach((sp) => (sp.material.opacity = sp.userData.o * k));
  grp.setColor = (c) => grp.children.forEach((sp) => sp.material.color.set(c));
  return grp;
}

/** Текст на плоскости (для надписей в мире: скрижали, свитки). Возвращает Mesh. */
export function textPlane(lines, { width = 4, height = 2, font = 'Garamond', px = 64, color = '#2a1a0c', bg = null, align = 'center', lineHeight = 1.25 } = {}) {
  const W = 1024, H = Math.round(1024 * height / width);
  const tex = canvasTexture(W, H, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    g.fillStyle = color; g.font = `${px}px ${font}`; g.textAlign = align; g.textBaseline = 'middle';
    const tot = lines.length * px * lineHeight; lines.forEach((l, i) => g.fillText(l, align === 'center' ? W / 2 : 40, H / 2 - tot / 2 + (i + 0.5) * px * lineHeight));
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
}

/** Камера по сплайну: keys = [[t, [x,y,z], [lx,ly,lz]], ...] — плавная интерполяция позиции и цели. */
export function cameraPath(camera, keys, t) {
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const [t0, p0, l0] = keys[i], [t1, p1, l1] = keys[Math.min(i + 1, keys.length - 1)];
  const k = t1 > t0 ? ease((t - t0) / (t1 - t0)) : 1;
  camera.position.set(lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k), lerp(p0[2], p1[2], k));
  camera.lookAt(lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k), lerp(l0[2], l1[2], k));
}
/** Лёгкая «ручная» тряска камеры (детерминированная) */
export function handheld(camera, t, amt = 0.02) {
  camera.rotation.z += (noise2(t * 0.6, 3.1) * amt);
  camera.rotateX(noise2(t * 0.5, 7.7) * amt * 0.6); camera.rotateY(noise2(t * 0.45, 1.3) * amt * 0.6);
}
