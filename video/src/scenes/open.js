// Сцена 1 — «Запуск» (интро, такты 0–8).
// Лист миллиметровки в метках обреза. Огонёк-перо выводит заголовок,
// линейка тикает на каждой ноте арпеджио, в конце огонёк уходит вниз-влево,
// чтобы стать пером графика потерь в следующей сцене.
import { W, H, PAL, rgba, clamp, inv, lerp, ease, font, FONT, spacedText, spacedWidth, typed, hash } from '../util.js';
import { spark, cropMarks, grid, label } from '../motifs.js';

const TITLE = 'ЖУРНАЛ ОБУЧЕНИЯ';

export default {
  id: 'open',
  draw(ctx, t, { local, R }) {
    const bar = R.bar(t); // 0..8
    const beatHit = R.hit('arp', t, 14);

    // медленный наезд камеры
    const zoom = 1 + 0.06 * ease.inOutCubic(inv(0, 8, bar));
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    // лист
    const inset = 72;
    const sheet = ease.outExpo(inv(0.05, 1.2, bar));
    ctx.fillStyle = rgba('ink2', sheet);
    ctx.fillRect(inset, inset, W - inset * 2, H - inset * 2);
    grid(ctx, { x0: inset, y0: inset, x1: W - inset, y1: H - inset, step: 36, major: 5, alpha: 0.07, reveal: ease.outCubic(inv(0.5, 2.5, bar)) });
    cropMarks(ctx, inset, 'bone', 0.75 * sheet);

    // шапка листа
    const head = 'ЖУРНАЛ ОБУЧЕНИЯ · ЗАПУСК № 0001 · ВЕСА: СЛУЧАЙНЫЕ · SEED = 1729';
    label(ctx, typed(head, R.tBar(1), 38, t), inset + 28, inset + 44, { size: 17, color: 'ash' });
    const stamp = `t = ${t.toFixed(2)} с`;
    label(ctx, stamp, W - inset - 28, inset + 44, { size: 17, color: 'graphite', align: 'right', alpha: sheet });

    // линейка внизу: тики на ноты арпеджио
    const ry = H - inset - 70;
    const rx0 = inset + 28,
      rx1 = W - inset - 28;
    const rulerIn = ease.outExpo(inv(2, 3, bar));
    if (rulerIn > 0) {
      ctx.strokeStyle = rgba('bone', 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx0, ry + 0.5);
      ctx.lineTo(lerp(rx0, rx1, rulerIn), ry + 0.5);
      ctx.stroke();
      const arps = R.list('arp', 0, t + 1e-6);
      const n = arps.length;
      // лента тиков: последние 96 событий, сдвигается влево
      for (let i = Math.max(0, n - 96); i < n; i++) {
        const age = n - 1 - i;
        const x = rx1 - age * ((rx1 - rx0) / 96);
        if (x < rx0) continue;
        const h = i % 16 === 0 ? 26 : i % 4 === 0 ? 16 : 9;
        ctx.strokeStyle = age === 0 ? rgba('signal', 0.6 + 0.4 * beatHit) : rgba('bone', 0.4);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, ry);
        ctx.lineTo(x + 0.5, ry - h - (age === 0 ? 14 * beatHit : 0));
        ctx.stroke();
      }
      label(ctx, 'шаг', rx0, ry + 28, { size: 15, color: 'graphite', alpha: rulerIn });
      label(ctx, `${String(n).padStart(6, '0')}`, rx1, ry + 28, { size: 15, color: 'ash', align: 'right', alpha: rulerIn });
    }

    // заголовок: огонёк ведёт перо слева направо, текст проявляется за ним
    font(ctx, FONT.display, 150, 900);
    const tracking = -2;
    const tw = spacedWidth(ctx, TITLE, tracking);
    const tx = (W - tw) / 2;
    const ty = H / 2 + 20;
    const write = ease.inOutCubic(inv(2, 5.5, bar));
    const penX = tx + tw * write;

    if (write > 0) {
      // «контур» ещё не написанного
      ctx.save();
      ctx.strokeStyle = rgba('bone', 0.1);
      ctx.lineWidth = 1;
      let cx = tx;
      for (const ch of TITLE) {
        ctx.strokeText(ch, cx, ty);
        cx += ctx.measureText(ch).width + tracking;
      }
      ctx.restore();
      // проявленная часть
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, penX, H);
      ctx.clip();
      ctx.fillStyle = PAL.bone;
      spacedText(ctx, TITLE, tx, ty, tracking);
      ctx.restore();
    }

    // подзаголовок
    const sub = ease.outExpo(inv(5.5, 6.2, bar));
    if (sub > 0) {
      ctx.save();
      ctx.globalAlpha = sub;
      font(ctx, FONT.serif, 54, 500, 'italic');
      ctx.fillStyle = PAL.ash;
      ctx.textAlign = 'center';
      ctx.fillText('опыт в семи таблицах', W / 2, ty + 90 + (1 - sub) * 20);
      ctx.restore();
    }
    // сноски
    const notes = [
      [6.0, 'loss = 4.61  (≈ ln 100: модель не знает ничего)'],
      [6.5, 'обучение: 1 эпоха, 0 выходных'],
      [7.0, 'ответственный: огонёк'],
    ];
    notes.forEach(([b, s], i) => {
      const a = ease.outExpo(inv(b, b + 0.3, bar));
      if (a > 0) label(ctx, s, inset + 28, ty + 190 + i * 26, { size: 16, color: i === 0 ? 'signal' : 'graphite', alpha: a });
    });

    // огонёк: появляется в центре на 1-м такте, пишет, затем ныряет в левый нижний угол
    const appear = ease.outBack(inv(1.2, 2, bar));
    if (appear > 0) {
      let x, y;
      if (bar < 2) {
        x = W / 2;
        y = ty - 55;
      } else if (bar < 5.5) {
        x = penX;
        y = ty - 55 + Math.sin(bar * 9.1) * 40 * (1 - Math.abs(write * 2 - 1));
      } else {
        const k = ease.inOutCubic(inv(7, 8, bar));
        x = lerp(tx + tw, inset + 180, k);
        y = lerp(ty - 55, H - inset - 150, k) - Math.sin(k * Math.PI) * 180;
      }
      const trail = [];
      for (let i = 12; i >= 0; i--) {
        const tb = t - i * 0.018;
        const b2 = R.bar(tb);
        let px, py;
        if (b2 < 2) {
          px = W / 2;
          py = ty - 55;
        } else if (b2 < 5.5) {
          const w2 = ease.inOutCubic(inv(2, 5.5, b2));
          px = tx + tw * w2;
          py = ty - 55 + Math.sin(b2 * 9.1) * 40 * (1 - Math.abs(w2 * 2 - 1));
        } else {
          const k = ease.inOutCubic(inv(7, 8, b2));
          px = lerp(tx + tw, inset + 180, k);
          py = lerp(ty - 55, H - inset - 150, k) - Math.sin(k * Math.PI) * 180;
        }
        trail.push({ x: px, y: py });
      }
      spark(ctx, x, y, t, { size: appear * (1 + 0.25 * beatHit), trail, sputter: 0.6 + beatHit });
    }
  },
};
