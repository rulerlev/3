// Мелкие помощники: easing, детерминированный шум, работа с ритмом.
// Никакого Math.random: каждый кадр — чистая функция времени.

export const W = 1920;
export const H = 1080;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (k) => k * k * (3 - 2 * k);

export const ease = {
  outExpo: (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
  inExpo: (k) => (k <= 0 ? 0 : Math.pow(2, 10 * k - 10)),
  outCubic: (k) => 1 - Math.pow(1 - k, 3),
  inCubic: (k) => k * k * k,
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outBack: (k) => {
    const c = 1.9;
    return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
  },
  // пружина: быстро прилетает, чуть перелетает, успокаивается
  spring: (k) => (k >= 1 ? 1 : 1 - Math.exp(-7 * k) * Math.cos(11 * k)),
};

// Хеш → [0,1)
export function hash(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export const hash2 = (a, b) => hash(a * 57.31 + b * 113.97);

// Гладкий 1D-шум
export function noise(x) {
  const i = Math.floor(x);
  const f = x - i;
  return lerp(hash(i), hash(i + 1), smooth(f)) * 2 - 1;
}

export const PAL = {
  ink: '#0A0A0B',
  ink2: '#151517',
  graphite: '#5E5B57',
  ash: '#9C978F',
  bone: '#EEE9DF',
  paper: '#E9E3D6',
  signal: '#FF4D12',
  ember: '#FF8A3D',
  blood: '#C21D0B',
};

export function rgba(hex, a = 1) {
  const n = parseInt((PAL[hex] || hex).replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const FONT = {
  display: 'Inter Tight',
  mono: 'IBM Plex Mono',
  serif: 'Cormorant Garamond',
};

export function font(ctx, family, size, weight = 400, style = 'normal') {
  ctx.font = `${style} ${weight} ${size}px "${family}"`;
}

// Ритм: всё, что сцены хотят знать о музыке в момент t
export class Rhythm {
  constructor(data) {
    this.d = data;
    this.bpm = data.bpm;
    this.beatLen = data.beat;
    this.barLen = data.bar;
    this.ev = data.events;
    this.env = data.env;
  }
  beat(t) {
    return t / this.beatLen;
  }
  bar(t) {
    return t / this.barLen;
  }
  tBar(b) {
    return b * this.barLen;
  }
  // 0..1 внутри текущей доли
  beatPhase(t) {
    const b = this.beat(t);
    return b - Math.floor(b);
  }
  // Сколько прошло с последнего события типа kind (Infinity, если не было)
  since(kind, t) {
    const a = this.ev[kind];
    let lo = 0,
      hi = a.length - 1,
      best = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      const v = Array.isArray(a[m]) ? a[m][0] : a[m];
      if (v <= t) {
        best = m;
        lo = m + 1;
      } else hi = m - 1;
    }
    if (best < 0) return Infinity;
    const v = Array.isArray(a[best]) ? a[best][0] : a[best];
    return t - v;
  }
  // Импульс 1 → 0 после события
  hit(kind, t, decay = 8) {
    const s = this.since(kind, t);
    return s === Infinity ? 0 : Math.exp(-s * decay);
  }
  count(kind, t0, t) {
    let n = 0;
    for (const e of this.ev[kind]) {
      const v = Array.isArray(e) ? e[0] : e;
      if (v >= t0 && v <= t) n++;
    }
    return n;
  }
  list(kind, t0, t1) {
    return this.ev[kind].filter((e) => {
      const v = Array.isArray(e) ? e[0] : e;
      return v >= t0 && v < t1;
    });
  }
  envAt(name, t) {
    const e = this.env[name];
    const i = t * this.env.fps;
    const a = Math.floor(i);
    if (a < 0) return e[0];
    if (a >= e.length - 1) return e[e.length - 1];
    return lerp(e[a], e[a + 1], i - a);
  }
}

// Набор текста с трекингом (letter-spacing) по символам
export function spacedText(ctx, str, x, y, tracking = 0) {
  if (!tracking) {
    ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  }
  let cx = x;
  for (const ch of str) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
  return cx - x - tracking;
}

export function spacedWidth(ctx, str, tracking = 0) {
  if (!tracking) return ctx.measureText(str).width;
  let w = 0;
  for (const ch of str) w += ctx.measureText(ch).width + tracking;
  return w - tracking;
}

// Печать строки по времени: сколько символов видно
export function typed(str, t0, cps, t) {
  const n = Math.floor((t - t0) * cps);
  return str.slice(0, clamp(n, 0, str.length));
}
