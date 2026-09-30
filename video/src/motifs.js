// Сквозные мотивы: огонёк (spark), метки обреза, миллиметровка, зерно.
import { W, H, PAL, rgba, hash, hash2, clamp, lerp, font, FONT } from './util.js';

// Огонёк: яркое ядро, ореол и несколько детерминированных искр.
// trail — массив точек [{x,y}], от старой к новой.
export function spark(ctx, x, y, t, { size = 1, trail = null, sputter = 1, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (trail && trail.length > 1) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < trail.length; i++) {
      const k = i / trail.length;
      ctx.strokeStyle = rgba('signal', 0.12 + 0.6 * k);
      ctx.lineWidth = (1.5 + 4 * k) * size;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  const flick = 0.85 + 0.15 * hash(Math.floor(t * 60) * 1.37);
  const r = 70 * size * flick;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba('ember', 0.9));
  g.addColorStop(0.12, rgba('signal', 0.55));
  g.addColorStop(0.4, rgba('blood', 0.16));
  g.addColorStop(1, rgba('blood', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // искры
  const n = Math.round(7 * sputter);
  const frame = Math.floor(t * 30);
  for (let i = 0; i < n; i++) {
    const seed = frame * 13.1 + i * 7.7;
    const life = hash(seed);
    const ang = hash(seed + 1) * Math.PI * 2;
    const d = (8 + 46 * life) * size;
    const sx = x + Math.cos(ang) * d;
    const sy = y + Math.sin(ang) * d + life * life * 18 * size;
    ctx.fillStyle = rgba(life < 0.5 ? 'ember' : 'signal', 1 - life);
    ctx.fillRect(sx, sy, 2.2 * size, 2.2 * size);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#FFF4E6';
  ctx.beginPath();
  ctx.arc(x, y, 4.2 * size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Метки обреза по углам (как на типографском листе)
export function cropMarks(ctx, inset, color = 'bone', alpha = 0.8, len = 44) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1.5;
  const pts = [
    [inset, inset, 1, 1],
    [W - inset, inset, -1, 1],
    [inset, H - inset, 1, -1],
    [W - inset, H - inset, -1, -1],
  ];
  ctx.beginPath();
  for (const [x, y, sx, sy] of pts) {
    ctx.moveTo(x - sx * 18, y);
    ctx.lineTo(x + sx * len, y);
    ctx.moveTo(x, y - sy * 18);
    ctx.lineTo(x, y + sy * len);
  }
  ctx.stroke();
  // приводочный крестик
  const cx = W / 2,
    cy = inset * 0.5;
  if (inset > 30) {
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.moveTo(cx - 13, cy);
    ctx.lineTo(cx + 13, cy);
    ctx.moveTo(cx, cy - 13);
    ctx.lineTo(cx, cy + 13);
    ctx.stroke();
  }
  ctx.restore();
}

// Миллиметровка: тонкая сетка + жирная каждые major клеток; reveal 0..1 рисует линии по очереди
export function grid(ctx, { x0 = 0, y0 = 0, x1 = W, y1 = H, step = 40, major = 5, color = 'bone', alpha = 0.08, reveal = 1 } = {}) {
  ctx.save();
  ctx.lineWidth = 1;
  const cols = Math.floor((x1 - x0) / step);
  const rows = Math.floor((y1 - y0) / step);
  for (let i = 0; i <= cols; i++) {
    const k = clamp(reveal * 1.6 - (i / cols) * 0.6);
    if (k <= 0) continue;
    const x = x0 + i * step + 0.5;
    ctx.strokeStyle = rgba(color, alpha * (i % major === 0 ? 2.2 : 1));
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, lerp(y0, y1, k));
    ctx.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    const k = clamp(reveal * 1.6 - (j / rows) * 0.6);
    if (k <= 0) continue;
    const y = y0 + j * step + 0.5;
    ctx.strokeStyle = rgba(color, alpha * (j % major === 0 ? 2.2 : 1));
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(lerp(x0, x1, k), y);
    ctx.stroke();
  }
  ctx.restore();
}

// Моноширинная подпись-сноска
export function label(ctx, text, x, y, { size = 18, color = 'ash', alpha = 1, align = 'left', weight = 400, family = FONT.mono } = {}) {
  ctx.save();
  font(ctx, family, size, weight);
  ctx.fillStyle = rgba(color, alpha);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Зерно: несколько заранее сгенерированных тайлов шума, выбор по номеру кадра
let grainTiles = null;
function makeGrain() {
  grainTiles = [];
  const S = 256;
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const v = Math.floor(hash2(i * 0.731 + k * 91.7, k + 0.3) * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainTiles.push(c);
  }
}

export function grain(ctx, t, amount = 0.07) {
  if (!grainTiles) makeGrain();
  const f = Math.floor(t * 24);
  const tile = grainTiles[f % grainTiles.length];
  const ox = Math.floor(hash(f * 3.1) * 256),
    oy = Math.floor(hash(f * 7.3) * 256);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.translate(-ox, -oy);
  ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}

export function vignette(ctx, strength = 0.55) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Штамп: рамка + текст, «чернильная» неровность через шум по краю
export function stamp(ctx, text, x, y, { size = 64, color = 'signal', angle = -0.12, alpha = 0.9, scale = 1, seed = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  font(ctx, FONT.display, size, 900);
  const tw = ctx.measureText(text).width;
  const pw = tw + size * 0.8,
    ph = size * 1.35;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = rgba(color, 1);
  ctx.lineWidth = size * 0.07;
  ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
  ctx.lineWidth = size * 0.025;
  ctx.strokeRect(-pw / 2 + size * 0.12, -ph / 2 + size * 0.12, pw - size * 0.24, ph - size * 0.24);
  ctx.fillStyle = rgba(color, 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * 0.04);
  // «непропечатка»: выбиваем точки цветом бумаги
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 90; i++) {
    const px = (hash(seed * 31 + i) - 0.5) * pw;
    const py = (hash(seed * 17 + i * 3.3) - 0.5) * ph;
    const r = 1 + hash(seed + i * 9.1) * size * 0.06;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Тряска камеры от импульса
export function shake(ctx, amount, t, seed = 0) {
  if (amount <= 0.001) return;
  const f = Math.floor(t * 60);
  ctx.translate((hash(f + seed) - 0.5) * amount, (hash(f * 1.7 + seed + 5) - 0.5) * amount);
}
