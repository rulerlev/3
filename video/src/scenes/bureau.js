// Сцена 5 — «Заявка» (брейк, такты 32–40).
// Инверсия в бумагу: бланк на выделение вычислительных мощностей.
// Поля заполняются машинописью на ноты арпеджио, на сильные доли тактов ложатся штампы,
// на барабанной дроби (такты 38–39) — лавина «ОДОБРЕНО» и последний, косой «БЕЗОПАСНО?».
import { W, H, PAL, rgba, clamp, inv, lerp, ease, font, FONT, hash } from '../util.js';
import { label, stamp, shake } from '../motifs.js';

const FIELDS = [
  ['Заявитель', 'Лаборатория «Градиент»'],
  ['Объём', '100 000 GPU'],
  ['Срок', 'вчера'],
  ['Цель', '«исследования»'],
  ['Риски', 'см. приложение (отсутствует)'],
  ['Текущий loss', '0.00  (подозрительно)'],
];

const CHECKS = ['этика', 'безопасность', 'юристы', 'мама'];

export default {
  id: 'bureau',
  light: true,
  draw(ctx, t, { R, local }) {
    const bar = R.bar(t) - 32; // 0..8
    ctx.fillStyle = PAL.paper;
    ctx.fillRect(0, 0, W, H);

    // лёгкий дрейф камеры вниз по листу
    const drift = ease.inOutCubic(inv(0, 8, bar)) * 160;
    const roll = R.hit('kick', t, 10) + R.hit('clap', t, 14) * 0.6;
    ctx.save();
    shake(ctx, 12 * roll, t, 21);
    ctx.translate(0, -drift);
    ctx.rotate(-0.012);

    const PX = 330,
      PY = 70,
      PW = 1260;
    // линовка
    ctx.strokeStyle = rgba('graphite', 0.14);
    ctx.lineWidth = 1;
    for (let y = PY + 260; y < PY + 1250; y += 44) {
      ctx.beginPath();
      ctx.moveTo(PX, y + 0.5);
      ctx.lineTo(PX + PW, y + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba('ink', 0.85);
    ctx.lineWidth = 2;
    ctx.strokeRect(PX, PY, PW, 1250);

    // шапка
    font(ctx, FONT.mono, 18, 400);
    ctx.fillStyle = PAL.graphite;
    ctx.fillText('ФОРМА 7-Б · ЭКЗЕМПЛЯР 1 ИЗ 1 · ХРАНИТЬ ВЕЧНО', PX + 40, PY + 50);
    ctx.textAlign = 'right';
    ctx.fillText('№ 42', PX + PW - 40, PY + 50);
    ctx.textAlign = 'left';
    font(ctx, FONT.display, 64, 900);
    ctx.fillStyle = PAL.ink;
    ctx.fillText('ЗАЯВКА', PX + 40, PY + 140);
    font(ctx, FONT.serif, 40, 500, 'italic');
    ctx.fillStyle = PAL.graphite;
    ctx.fillText('на выделение вычислительных мощностей', PX + 40, PY + 195);

    // поля
    const arps = R.count('arp', R.tBar(32), t);
    let budget = arps * 2; // символов напечатано
    FIELDS.forEach(([k, v], i) => {
      const y = PY + 300 + i * 88;
      font(ctx, FONT.mono, 20, 400);
      ctx.fillStyle = PAL.graphite;
      ctx.fillText(k.toUpperCase(), PX + 40, y);
      ctx.strokeStyle = rgba('ink', 0.6);
      ctx.beginPath();
      ctx.moveTo(PX + 330, y + 8.5);
      ctx.lineTo(PX + PW - 40, y + 8.5);
      ctx.stroke();
      const shown = v.slice(0, clamp(budget, 0, v.length));
      budget -= v.length + 3;
      font(ctx, FONT.mono, 34, 600);
      ctx.fillStyle = i === 5 ? PAL.signal : PAL.ink;
      ctx.fillText(shown, PX + 340, y);
    });

    // «согласовано»: галочки на удары бочки в тактах 38–39
    const cy = PY + 300 + FIELDS.length * 88 + 40;
    font(ctx, FONT.mono, 20, 400);
    ctx.fillStyle = PAL.graphite;
    ctx.fillText('СОГЛАСОВАНО', PX + 40, cy);
    const kicksLate = R.count('kick', R.tBar(38), t);
    CHECKS.forEach((c, i) => {
      const x = PX + 330 + i * 230;
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, cy - 24, 28, 28);
      font(ctx, FONT.mono, 26, 400);
      ctx.fillStyle = PAL.ink;
      ctx.fillText(c, x + 44, cy);
      if (i < kicksLate && i < 3) {
        ctx.strokeStyle = PAL.signal;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x + 4, cy - 12);
        ctx.lineTo(x + 12, cy - 2);
        ctx.lineTo(x + 34, cy - 36);
        ctx.stroke();
      }
    });
    label(ctx, 'подпись ответственного: ____________  (огонёк)', PX + 40, cy + 90, { size: 22, color: 'graphite' });

    // штампы на сильные доли
    const stamps = [
      { bar: 33, text: 'ПРИНЯТО', x: 1320, y: 330, a: -0.18, color: 'ink' },
      { bar: 35, text: 'СРОЧНО', x: 560, y: 560, a: 0.1, color: 'blood' },
      { bar: 37, text: 'ОДОБРЕНО', x: 1180, y: 820, a: -0.08, color: 'signal' },
    ];
    for (const s of stamps) {
      const tt = R.tBar(s.bar);
      if (t < tt) continue;
      const k = ease.outExpo(clamp((t - tt) / 0.09));
      stamp(ctx, s.text, s.x, s.y, { size: 84, color: s.color, angle: s.a, scale: lerp(1.8, 1, k), alpha: 0.85 * k, seed: s.bar });
    }
    ctx.restore();

    // дробь: лавина «ОДОБРЕНО», последний — «БЕЗОПАСНО?»
    const claps = R.list('clap', R.tBar(38), R.tBar(40));
    let n = 0;
    for (const c of claps) {
      if (c > t) break;
      n++;
    }
    for (let i = 0; i < n; i++) {
      const last = i === claps.length - 1;
      const x = 200 + hash(i * 3.1) * (W - 400);
      const y = 150 + hash(i * 7.9) * (H - 300);
      const k = ease.outExpo(clamp((t - claps[i]) / 0.07));
      if (last) continue;
      stamp(ctx, 'ОДОБРЕНО', x, y, { size: 60 + hash(i) * 30, color: 'signal', angle: (hash(i * 5.5) - 0.5) * 0.7, scale: lerp(1.6, 1, k), alpha: 0.75 * k, seed: i + 40 });
    }
    if (n === claps.length && n > 0) {
      const tl = claps[claps.length - 1];
      const k = ease.outExpo(clamp((t - tl) / 0.1));
      stamp(ctx, 'БЕЗОПАСНО?', W / 2, H / 2, { size: 130, color: 'ink', angle: -0.21, scale: lerp(2.2, 1, k), alpha: 0.92 * k, seed: 99 });
    }
  },
};
