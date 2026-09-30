// Сцена 4 — «Масштаб» (дроп 1, такты 24–32).
// Каждые два такта на сильную долю влетает новое число параметров, крупнее прежнего.
// Фон — сетка квадратов, которая делится пополам на каждую бочку. На такте 30 кадр
// инвертируется в бумагу, такт 31 — заикание «ЕЩЁ» на шестнадцатые.
import { W, H, PAL, rgba, clamp, inv, lerp, ease, font, FONT, hash, hash2 } from '../util.js';
import { spark, label, shake } from '../motifs.js';

const SLAMS = [
  { bar: 24, big: '7·10⁹', note: '¹ масштаб решает всё' },
  { bar: 26, big: '7·10¹⁰', note: '² кроме того, что не решает' },
  { bar: 28, big: '10¹²', note: '³ см. сноску 1' },
  { bar: 30, big: '10¹⁴', note: '⁴ сноски тоже масштабируются' },
];

export default {
  id: 'scale',
  draw(ctx, t, { R }) {
    const bar = R.bar(t);
    const kick = R.hit('kick', t, 9);
    const hat = R.hit('hat', t, 25);
    const inverted = bar >= 30 && bar < 31;
    this.light = inverted;
    const fg = inverted ? 'ink' : 'bone';
    if (inverted) {
      ctx.fillStyle = PAL.paper;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.save();
    shake(ctx, 26 * kick, t, 11);

    // сетка квадратов: уровень деления = число бочек с начала сцены
    const kicks = R.count('kick', R.tBar(24), t);
    const level = Math.min(7, Math.floor(kicks / 8) + 3);
    const cells = Math.pow(2, level);
    const cw = W / cells,
      ch = H / Math.max(1, cells / 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(fg, 0.07 + 0.08 * kick);
    ctx.beginPath();
    for (let i = 1; i < cells; i++) {
      const x = Math.round(i * cw) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let j = 1; j < cells / 2; j++) {
      const y = Math.round(j * ch) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    // активные клетки на хэты
    const nh = R.count('hat', R.tBar(24), t);
    for (let k = 0; k < 6; k++) {
      const s = nh * 6 + k;
      const cx = Math.floor(hash(s * 1.3) * cells);
      const cy = Math.floor(hash(s * 2.7) * Math.max(1, cells / 2));
      ctx.fillStyle = rgba('signal', (0.08 + 0.25 * hat) * (k === 0 ? 2 : 1));
      ctx.fillRect(cx * cw + 1, cy * ch + 1, cw - 2, ch - 2);
    }

    // текущий «слэм»
    let si = 0;
    for (let i = 0; i < SLAMS.length; i++) if (bar >= SLAMS[i].bar) si = i;
    const s = SLAMS[si];
    const tS = R.tBar(s.bar);
    const age = t - tS;
    const inK = ease.spring(clamp(age / (R.beatLen * 1.2)));
    const growth = 1 + (age / (R.barLen * 2)) * 0.12; // медленно пухнет
    const baseSize = [300, 330, 380, 420][si];
    const size = baseSize * growth * lerp(2.6, 1, inK);
    const rot = lerp(0.35 * (si % 2 ? -1 : 1), -0.03 * (si - 1.5), inK);

    ctx.save();
    ctx.translate(W / 2, H / 2 - 30);
    ctx.rotate(rot);
    font(ctx, FONT.display, size, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // «эхо» предыдущего числа
    if (si > 0 && age < R.beatLen) {
      ctx.globalAlpha = 1 - age / R.beatLen;
      ctx.fillStyle = rgba('signal', 0.6);
      font(ctx, FONT.display, size * 0.6, 900);
      ctx.fillText(SLAMS[si - 1].big, 0, 0);
      ctx.globalAlpha = 1;
      font(ctx, FONT.display, size, 900);
    }
    ctx.fillStyle = rgba(fg, clamp(age * 12));
    ctx.fillText(s.big, 0, 0);
    ctx.restore();

    // подпись «параметров» и сноска
    label(ctx, 'ПАРАМЕТРОВ¹', W / 2, H / 2 + 200, { size: 30, color: inverted ? 'ink' : 'signal', align: 'center', weight: 600 });
    SLAMS.slice(0, si + 1).forEach((q, i) => {
      const a = ease.outExpo(inv(R.tBar(q.bar) + R.beatLen, R.tBar(q.bar) + R.beatLen * 1.5, t));
      label(ctx, q.note, 120, H - 230 + i * 30, { size: 18, color: inverted ? 'graphite' : 'ash', alpha: a });
    });
    label(ctx, 'loss 0.07', W - 120, H - 140, { size: 18, color: 'signal', align: 'right' });

    // огонёк на орбите вокруг числа
    const ang = (t / R.barLen) * Math.PI * 2 * 0.5;
    const ox = W / 2 + Math.cos(ang) * 720,
      oy = H / 2 - 30 + Math.sin(ang) * 330;
    const trail = [];
    for (let i = 16; i >= 0; i--) {
      const a2 = ((t - i * 0.02) / R.barLen) * Math.PI;
      trail.push({ x: W / 2 + Math.cos(a2) * 720, y: H / 2 - 30 + Math.sin(a2) * 330 });
    }
    spark(ctx, ox, oy, t, { size: 1 + kick * 0.5, trail });

    // такт 31: заикание «ЕЩЁ»
    if (bar >= 31) {
      const n = R.count('hat', R.tBar(31), t);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(0, 0, W, H);
      font(ctx, FONT.display, 150, 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const row = i % 6,
          col = Math.floor(i / 6);
        const x = W / 2 + (col - 0.5) * 620 * (n > 6 ? 1 : 0) + (row % 2 ? 40 : -40);
        const y = 120 + row * 170;
        ctx.fillStyle = i === n - 1 ? PAL.signal : rgba('bone', 0.25 + 0.75 * (i / n));
        ctx.fillText('ЕЩЁ', x, y);
      }
    }
    ctx.restore();

    // вспышка на каждый слэм
    const fl = Math.exp(-age * 9);
    if (fl > 0.02) {
      ctx.fillStyle = rgba(inverted ? 'ink' : 'bone', 0.35 * fl);
      ctx.fillRect(0, 0, W, H);
    }
  },
};
