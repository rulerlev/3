// Сцена 7 — «Финал» (такт 47 — конец).
// Точка-огонёк растёт, на такте 48 удар: «loss = NaN» во весь кадр.
// Потом метки обреза смыкаются обратно, появляется кнопка «Сгенерировать заново»,
// курсор жмёт — и последний кадр совпадает с первым (клип зацикливается).
import { W, H, PAL, rgba, clamp, inv, lerp, ease, font, FONT, hash } from '../util.js';
import { spark, label, cropMarks, grid, shake } from '../motifs.js';

export default {
  id: 'outro',
  draw(ctx, t, { R, end }) {
    const bar = R.bar(t); // 47..~51.5
    const tImpact = R.tBar(48);
    const imp = t >= tImpact ? Math.exp(-(t - tImpact) * 3) : 0;

    // такт 47: точка набухает, подтягиваются тонкие лучи
    if (t < tImpact) {
      const k = inv(47, 48, bar);
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2 + k * 0.6;
        const r0 = lerp(900, 60, ease.inCubic(k)),
          r1 = r0 + 120 * (1 - k);
        ctx.strokeStyle = rgba(i % 6 ? 'bone' : 'signal', 0.12 + 0.4 * k);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0);
        ctx.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1);
        ctx.stroke();
      }
      spark(ctx, W / 2, H / 2, t, { size: 3 + 3 * ease.inExpo(k), sputter: 3 });
      return;
    }

    // удар: вспышка и NaN
    ctx.save();
    shake(ctx, 40 * imp, t, 77);
    const nanOut = ease.inOutCubic(inv(49.2, 49.8, bar));
    const nanA = 1 - nanOut;
    if (nanA > 0) {
      font(ctx, FONT.display, lerp(420, 330, ease.outExpo(clamp((t - tImpact) * 2))), 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba('signal', nanA);
      ctx.fillText('NaN', W / 2, H / 2 - 40);
      label(ctx, 'loss = NaN · обучение завершено · причина: да', W / 2, H / 2 + 170, { size: 26, color: 'bone', align: 'center', alpha: nanA * clamp((t - tImpact) * 2) });
    }
    ctx.restore();
    if (imp > 0.01) {
      ctx.fillStyle = rgba('ember', 0.85 * imp * imp);
      ctx.fillRect(0, 0, W, H);
    }

    // возврат к первому кадру: лист, метки, кнопка
    const back = ease.inOutCubic(inv(49.4, 50.2, bar));
    if (back > 0) {
      const inset = lerp(-60, 72, back);
      ctx.fillStyle = rgba('ink2', back);
      ctx.fillRect(inset, inset, W - inset * 2, H - inset * 2);
      grid(ctx, { x0: 72, y0: 72, x1: W - 72, y1: H - 72, step: 36, major: 5, alpha: 0.07 * back, reveal: 1 });
      cropMarks(ctx, inset, 'bone', 0.75 * back);

      // кнопка «↻ Сгенерировать заново»
      const btnIn = ease.outBack(inv(50.1, 50.5, bar));
      const pressT = R.tBar(51);
      const pressed = t >= pressT && t < pressT + 0.18;
      const bw = 560,
        bh = 96;
      const bx = W / 2 - bw / 2,
        by = H / 2 - bh / 2;
      if (btnIn > 0) {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        const sc = btnIn * (pressed ? 0.95 : 1);
        ctx.scale(sc, sc);
        ctx.translate(-W / 2, -H / 2);
        ctx.fillStyle = pressed ? PAL.signal : PAL.ink;
        ctx.strokeStyle = rgba('bone', 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 48);
        ctx.fill();
        ctx.stroke();
        font(ctx, FONT.display, 38, 700);
        ctx.fillStyle = pressed ? PAL.ink : PAL.bone;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↻  Сгенерировать заново', W / 2, H / 2 + 2);
        ctx.restore();

        // курсор подъезжает и жмёт
        const cm = ease.inOutCubic(inv(50.4, 51, bar));
        const cx = lerp(W * 0.78, W / 2 + 150, cm),
          cy = lerp(H * 0.82, H / 2 + 20, cm);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1.6, 1.6);
        ctx.fillStyle = PAL.bone;
        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 24);
        ctx.lineTo(6, 18);
        ctx.lineTo(11, 28);
        ctx.lineTo(15, 26);
        ctx.lineTo(10, 16);
        ctx.lineTo(18, 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      // титры
      const cred = ease.outExpo(inv(50.2, 50.6, bar));
      label(ctx, 'музыка, код и картинка сгенерированы · Claude Code · 2026', W / 2, H - 72 - 40, { size: 17, color: 'graphite', align: 'center', alpha: cred });

      // после нажатия: гасим всё до чистого листа (как в первом кадре)
      const reset = ease.outExpo(inv(pressT, pressT + 0.25, t));
      if (reset > 0) {
        ctx.fillStyle = rgba('ink', reset);
        ctx.fillRect(0, 0, W, H);
      }
    }
  },
};
