// Сцена 6 — «Датацентр» (дроп 2, такты 40–47).
// Изометрическое поле серверных стоек: ряды появляются на бочку, диоды мигают на хэты,
// огонёк бежит фитилём по кабельному лотку. Камера отъезжает, счётчик стоек растёт.
// Такты 46–47: всё стягивается в одну точку.
import { W, H, PAL, rgba, clamp, inv, lerp, ease, font, FONT, hash, hash2 } from '../util.js';
import { spark, label, shake } from '../motifs.js';

const WORDS = [
  [40, 'ВЫЧИСЛЕНИЯ'],
  [42, 'ЭНЕРГИЯ'],
  [44, 'ЕЩЁ ВЫЧИСЛЕНИЯ'],
  [45.5, 'ГОТОВО?'],
];

// изометрия: клетка (i,j) → экран
function iso(i, j, z, s) {
  return [(i - j) * s * 0.866, (i + j) * s * 0.5 - z * s];
}

export default {
  id: 'datacenter',
  draw(ctx, t, { R, local }) {
    const bar = R.bar(t) - 40; // 0..7
    const kick = R.hit('kick', t, 9);
    const hatN = R.count('hat', R.tBar(40), t);

    // отъезд камеры: масштаб клетки уменьшается
    const s = lerp(120, 34, ease.inOutCubic(inv(0, 6, bar)));
    const collapse = ease.inExpo(inv(6, 7, bar));
    const kicks = R.count('kick', R.tBar(40), t);
    const rows = Math.min(40, 2 + kicks); // сколько рядов уже стоит

    ctx.save();
    shake(ctx, 16 * kick * (1 - collapse), t, 5);
    ctx.translate(W / 2, H * 0.28);
    ctx.scale(1 - collapse * 0.98, 1 - collapse * 0.98);

    // пол-сетка
    ctx.strokeStyle = rgba('bone', 0.06);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) {
      const [ax, ay] = iso(k, 0, 0, s),
        [bx, by] = iso(k, 40, 0, s);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      const [cx, cy] = iso(0, k, 0, s),
        [dx, dy] = iso(40, k, 0, s);
      ctx.moveTo(cx, cy);
      ctx.lineTo(dx, dy);
    }
    ctx.stroke();

    // стойки: ряды по диагонали i+j = r, рисуем от дальних к ближним
    const hRack = 2.2;
    for (let r = 0; r < rows * 2; r++) {
      for (let i = 0; i <= r; i++) {
        const j = r - i;
        if (i >= rows || j >= rows || i % 2 || j % 3 === 2) continue;
        const birth = R.tBar(40) + Math.max(i, j) * R.beatLen - R.beatLen;
        const up = ease.outBack(clamp((t - birth) / (R.beatLen * 0.7)));
        if (up <= 0) continue;
        const z = hRack * up;
        const [x0, y0] = iso(i, j, 0, s);
        const [x1, y1] = iso(i + 1, j, 0, s);
        const [x2, y2] = iso(i + 1, j + 1, 0, s);
        const [x3, y3] = iso(i, j + 1, 0, s);
        const zz = z * s;
        // левая грань
        ctx.fillStyle = PAL.ink2;
        ctx.beginPath();
        ctx.moveTo(x3, y3);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, y2 - zz);
        ctx.lineTo(x3, y3 - zz);
        ctx.closePath();
        ctx.fill();
        // правая грань
        ctx.fillStyle = '#101012';
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x1, y1 - zz);
        ctx.lineTo(x2, y2 - zz);
        ctx.closePath();
        ctx.fill();
        // крышка
        ctx.fillStyle = '#1C1C1F';
        ctx.beginPath();
        ctx.moveTo(x0, y0 - zz);
        ctx.lineTo(x1, y1 - zz);
        ctx.lineTo(x2, y2 - zz);
        ctx.lineTo(x3, y3 - zz);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba('bone', 0.22);
        ctx.stroke();
        // диоды на левой грани
        const leds = 5;
        for (let q = 0; q < leds; q++) {
          const on = hash2(i * 7 + j * 13 + q, hatN) > 0.55;
          const kz = (q + 0.6) / (leds + 0.4);
          const lx = lerp(x3, x2, 0.2),
            ly = lerp(y3, y2, 0.2) - zz * kz;
          ctx.fillStyle = on ? rgba('signal', 0.95) : rgba('graphite', 0.5);
          ctx.fillRect(lx, ly, Math.max(2, s * 0.05), Math.max(1.5, s * 0.025));
          if (on && s > 60) {
            ctx.fillStyle = rgba('signal', 0.15);
            ctx.fillRect(lx - 3, ly - 3, s * 0.05 + 6, s * 0.025 + 6);
          }
        }
      }
    }

    // кабельный лоток и огонёк-фитиль: бежит зигзагом по проходам
    const path = [];
    for (let k = 0; k < 14; k++) {
      const i = k % 2 ? 1.5 : 1.5 + 2 * k;
      path.push(iso(1 + k * 2 + 0.5, k % 2 ? 0.5 + k * 2 : 2.5 + k * 2, 0, s));
    }
    const fuseK = inv(0, 6, bar);
    const segs = path.length - 1;
    const pos = fuseK * segs;
    ctx.strokeStyle = rgba('signal', 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for (let k = 1; k <= Math.floor(pos); k++) ctx.lineTo(path[k][0], path[k][1]);
    const fi = Math.min(segs - 1, Math.floor(pos));
    const ff = pos - fi;
    const sx = lerp(path[fi][0], path[fi + 1][0], ff),
      sy = lerp(path[fi][1], path[fi + 1][1], ff);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.restore();

    // огонёк: в экранных координатах
    const sc = 1 - collapse * 0.98;
    const fx = W / 2 + sx * sc,
      fy = H * 0.28 + sy * sc;
    const cx = lerp(fx, W / 2, collapse),
      cy = lerp(fy, H / 2, collapse);
    spark(ctx, cx, cy, t, { size: 1 + kick * 0.5 + collapse * 1.5, sputter: 1.5 });

    // слова поверх
    let wi = -1;
    for (let k = 0; k < WORDS.length; k++) if (bar + 40 >= WORDS[k][0]) wi = k;
    if (wi >= 0 && collapse < 1) {
      const [b0, word] = WORDS[wi];
      const age = t - R.tBar(b0);
      const k = ease.outExpo(clamp(age / 0.25));
      font(ctx, FONT.display, 170, 900);
      ctx.textAlign = 'left';
      ctx.fillStyle = rgba(wi === 3 ? 'signal' : 'bone', k * (1 - collapse));
      ctx.fillText(word, 110 + (1 - k) * -80, H - 150);
    }

    // счётчик стоек и loss-камео
    const racks = Math.round(Math.pow(2, clamp(kicks, 0, 16)));
    label(ctx, `стоек: ${racks.toLocaleString('ru-RU')}`, W - 110, 120, { size: 22, color: 'bone', align: 'right', alpha: 1 - collapse });
    label(ctx, 'loss −0.01  ← так не бывает', W - 110, 156, { size: 20, color: 'signal', align: 'right', alpha: 1 - collapse });
    label(ctx, 'потребление: да', W - 110, 188, { size: 18, color: 'ash', align: 'right', alpha: 1 - collapse });

    // затемнение вокруг точки при схлопывании
    if (collapse > 0) {
      ctx.fillStyle = rgba('ink', collapse * 0.9);
      ctx.fillRect(0, 0, W, H);
      spark(ctx, W / 2, H / 2, t, { size: 1 + collapse * 2, sputter: 2 });
    }
  },
};
