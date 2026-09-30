// Сцена 2 — «Плато» (билд, такты 8–16).
// Оси графика потерь, огонёк тянет шумное плато слева направо, бочка даёт всплески.
// Райзер: камера наезжает на перо, тряска растёт. Провал перед дропом: кривая обрывается вниз.
import { W, H, PAL, rgba, clamp, inv, lerp, ease, font, FONT, noise, hash } from '../util.js';
import { spark, label, shake } from '../motifs.js';

const X0 = 250,
  X1 = 1700,
  Y0 = 150,
  Y1 = 860;

// значение loss на «шаге» u∈[0,1] до обрыва
function lossAt(u, R, tAtU) {
  const base = 4.61 - 0.9 * Math.pow(u, 0.5) - 0.25 * u;
  const n = noise(u * 60) * 0.08 + noise(u * 230) * 0.04;
  // всплески от бочки
  const kick = R.hit('kick', tAtU, 10) * 0.35;
  return base + n + kick;
}
const yOf = (loss) => lerp(Y1, Y0, (Math.log(loss) - Math.log(0.01)) / (Math.log(40) - Math.log(0.01)));

export default {
  id: 'loss',
  draw(ctx, t, { R }) {
    const bar = R.bar(t) - 8; // 0..8
    const tDrawStart = R.tBar(8.25);
    const tDrawEnd = R.tBar(15.75);
    const tGap = R.tBar(15 + 0.75); // провал: последняя доля такта 15
    const u = clamp((t - tDrawStart) / (tDrawEnd - tDrawStart));
    const dropK = ease.inExpo(inv(R.tBar(15.75), R.tBar(16), t));

    // камера: наезд на перо во время райзера (такты 12–16)
    const riser = ease.inCubic(inv(4, 7.75, bar));
    const penLoss = lossAt(u, R, t);
    const penX = lerp(X0, X1, u);
    const penY = lerp(yOf(penLoss), Y1 + 900, dropK);
    const zoom = 1 + 0.9 * riser;
    const fx = lerp(W / 2, penX, riser * 0.8);
    const fy = lerp(H / 2, penY, riser * 0.8);
    ctx.save();
    shake(ctx, 14 * riser * (0.3 + R.hit('clap', t, 10)) + 22 * R.hit('kick', t, 12) * (bar < 7.75 ? 1 : 0), t);
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-fx, -fy - dropK * 500);

    // оси
    const axes = ease.outExpo(inv(0, 0.6, bar));
    ctx.strokeStyle = rgba('bone', 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X0, lerp(Y1, Y0, axes));
    ctx.lineTo(X0, Y1);
    ctx.lineTo(lerp(X0, X1, axes), Y1);
    ctx.stroke();
    // деления по лог-шкале
    const ticks = [0.01, 0.1, 1, 10];
    ticks.forEach((v, i) => {
      const a = ease.outExpo(inv(0.3 + i * 0.1, 0.7 + i * 0.1, bar));
      if (a <= 0) return;
      const y = yOf(v);
      ctx.strokeStyle = rgba('bone', 0.1 * a);
      ctx.beginPath();
      ctx.moveTo(X0, y + 0.5);
      ctx.lineTo(X1, y + 0.5);
      ctx.stroke();
      label(ctx, String(v), X0 - 16, y + 6, { size: 16, color: 'ash', align: 'right', alpha: a });
    });
    for (let i = 0; i <= 10; i++) {
      const a = ease.outExpo(inv(0.4 + i * 0.03, 0.8 + i * 0.03, bar));
      const x = lerp(X0, X1, i / 10);
      ctx.strokeStyle = rgba('bone', 0.6 * a);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, Y1);
      ctx.lineTo(x + 0.5, Y1 + 10);
      ctx.stroke();
      label(ctx, `${i * 10}k`, x, Y1 + 34, { size: 14, color: 'graphite', align: 'center', alpha: a });
    }
    label(ctx, 'loss (лог.)', X0, Y0 - 30, { size: 17, color: 'ash', alpha: axes });
    label(ctx, 'шаг обучения', X1, Y1 + 70, { size: 17, color: 'ash', align: 'right', alpha: axes });

    // кривая
    if (u > 0) {
      ctx.save();
      ctx.lineJoin = 'round';
      const steps = Math.max(2, Math.floor(u * 700));
      const path = new Path2D();
      for (let i = 0; i <= steps; i++) {
        const uu = (i / steps) * u;
        const tu = lerp(tDrawStart, tDrawEnd, uu);
        const y = yOf(lossAt(uu, R, tu));
        const x = lerp(X0, X1, uu);
        i ? path.lineTo(x, y) : path.moveTo(x, y);
      }
      if (dropK > 0) path.lineTo(penX, penY);
      ctx.strokeStyle = rgba('signal', 0.18);
      ctx.lineWidth = 7;
      ctx.stroke(path);
      ctx.strokeStyle = rgba('ember', 0.95);
      ctx.lineWidth = 1.8;
      ctx.stroke(path);
      ctx.restore();

      // показание у пера
      if (dropK < 0.3) {
        label(ctx, `loss ${penLoss.toFixed(3)}`, penX + 26, penY - 22, { size: 18, color: 'signal', alpha: 1 - dropK * 3 });
      }
    }

    // сухие пометки на плато
    const notes = [
      [2, 'плато. модель думает.', 0.2],
      [4, 'плато. модель всё ещё думает.', 0.45],
      [6, '(мы тоже)', 0.68],
    ];
    for (const [b, s, uu] of notes) {
      const a = ease.outExpo(inv(b, b + 0.25, bar));
      if (a <= 0) continue;
      const x = lerp(X0, X1, uu);
      const y = yOf(lossAt(uu, R, 0)) - 70;
      ctx.strokeStyle = rgba('bone', 0.35 * a);
      ctx.beginPath();
      ctx.moveTo(x, y + 10);
      ctx.lineTo(x, y + 48);
      ctx.stroke();
      label(ctx, s, x - 4, y, { size: 18, color: 'bone', alpha: 0.85 * a });
    }

    // огонёк
    if (u > 0 || bar < 0.4) {
      const trail = [];
      for (let i = 14; i >= 0; i--) {
        const tb = t - i * 0.016;
        const uu = clamp((tb - tDrawStart) / (tDrawEnd - tDrawStart));
        const dk = ease.inExpo(inv(R.tBar(15.75), R.tBar(16), tb));
        trail.push({ x: lerp(X0, X1, uu), y: lerp(yOf(lossAt(uu, R, tb)), Y1 + 900, dk) });
      }
      const px = u > 0 ? penX : lerp(250, X0, ease.outCubic(inv(0, 0.25, bar)));
      const py = u > 0 ? penY : lerp(H - 222, yOf(4.61), ease.outCubic(inv(0, 0.25, bar)));
      spark(ctx, px, py, t, { size: 1 + riser * 0.4 + R.hit('kick', t, 10) * 0.4, trail, sputter: 1 + riser * 2 });
    }
    ctx.restore();

    // провал: всё замирает — только подпись
    if (t >= tGap) {
      const a = ease.outExpo(inv(tGap, tGap + 0.1, t));
      ctx.fillStyle = rgba('ink', 0.55 * a);
      ctx.fillRect(0, 0, W, H);
      font(ctx, FONT.display, 96, 900);
      ctx.fillStyle = rgba('bone', a);
      ctx.textAlign = 'center';
      ctx.fillText('ВНЕЗАПНО', W / 2, H / 2 + 34);
      label(ctx, 'loss ↓↓↓', W / 2, H / 2 + 100, { size: 22, color: 'signal', align: 'center', alpha: a });
    }
  },
};
