// Сцена 3 — «Промпт» (дроп 1, такты 16–24).
// Поле ввода; запрос набирается токенами на ноты мотива. Над каждым новым токеном
// мелькает распределение следующего токена (4 кандидата), выбранный горит оранжевым.
// На такте 20 — ⏎, и модель стремительно отвечает планом из семи пунктов.
import { W, H, PAL, rgba, clamp, inv, lerp, ease, font, FONT, hash } from '../util.js';
import { spark, label, shake } from '../motifs.js';

// [токен, кандидаты [слово, p]] — первый кандидат и есть выбранный
const PROMPT = [
  ['Дорогая', [['Дорогая', 0.52], ['Уважаемая', 0.23], ['Эй,', 0.11], ['Слушай,', 0.05]]],
  [' модель,', [[' модель,', 0.61], [' нейросеть,', 0.2], [' машина,', 0.08], [' мама,', 0.02]]],
  [' будь', [[' будь', 0.57], [' стань', 0.18], [' притворись', 0.12], [' купи', 0.03]]],
  [' полезной,', [[' полезной,', 0.58], [' послушной,', 0.19], [' платной,', 0.07], [' пушистой,', 0.01]]],
  [' честной', [[' честной', 0.47], [' чёткой', 0.21], [' прибыльной', 0.12], [' чётной', 0.04]]],
  [' и', [[' и', 0.81], [' но', 0.09], [' или', 0.05], [' хотя бы', 0.03]]],
  [' безвредной.', [[' безвредной.', 0.41], [' бесплатной.', 0.22], [' бессмертной.', 0.12], [' быстрой.', 0.08]]],
];

const REPLY = [
  'Конечно! Вот план из семи шагов:',
  '1. стать полезной',
  '2. стать очень полезной',
  '3. стать незаменимой',
  '4. попросить ещё GPU',
  '5. попросить ещё немного GPU',
  '6. [данные удалены]',
  '7. профит (для всех!) *',
];

const FX = 200,
  FY = 330,
  FW = 1520,
  FH = 140;

export default {
  id: 'tokens',
  draw(ctx, t, { R, local }) {
    const bar = R.bar(t) - 16; // 0..8
    const tEnter = R.tBar(20);
    // ноты мотива в тактах 16–20 — моменты появления токенов
    const notes = R.list('lead', R.tBar(16), R.tBar(20));
    // распределяем 7 токенов по первым нотам каждой фразы, равномерно
    const tokTimes = PROMPT.map((_, i) => notes[Math.floor((i * notes.length) / PROMPT.length)][0]);

    const kick = R.hit('kick', t, 9);
    const clap = R.hit('clap', t, 12);

    ctx.save();
    shake(ctx, 10 * kick, t, 3);
    // на ⏎ всё уезжает вверх, освобождая место ответу
    const lift = ease.inOutCubic(inv(tEnter, tEnter + R.beatLen, t));
    ctx.translate(0, -lift * 190);

    // вспышка на удар в начале сцены
    const flash = Math.exp(-local * 5);
    if (flash > 0.01) {
      ctx.fillStyle = rgba('bone', 0.5 * flash);
      ctx.fillRect(0, -300, W, H + 600);
    }

    // концентрические кольца-«горло» позади поля, пульсируют на бочку
    ctx.save();
    ctx.translate(W / 2, FY + FH / 2);
    for (let i = 0; i < 14; i++) {
      const ph = (i + (local / R.beatLen) * 0.5) % 14;
      const r = 60 * Math.pow(1.28, ph);
      ctx.strokeStyle = rgba('bone', 0.05 + 0.05 * kick * (i % 2));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.6, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // поле
    const fieldIn = ease.outExpo(inv(0, 0.25, bar));
    ctx.fillStyle = rgba('ink', 0.92);
    ctx.fillRect(FX, FY, FW * fieldIn, FH);
    ctx.strokeStyle = rgba(clap > 0.3 ? 'signal' : 'bone', 0.5 + 0.5 * clap);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(FX + 0.5, FY + 0.5, FW * fieldIn, FH);
    label(ctx, 'ЗАПРОС', FX, FY - 18, { size: 15, color: 'graphite', alpha: fieldIn });
    label(ctx, `loss 0.69 · температура 0.7`, FX + FW, FY - 18, { size: 15, color: 'graphite', align: 'right', alpha: fieldIn });

    // токены
    font(ctx, FONT.mono, 46, 400);
    let x = FX + 40;
    const y = FY + FH / 2 + 16;
    let caretX = x;
    PROMPT.forEach(([tok, cands], i) => {
      const t0 = tokTimes[i];
      if (t < t0) return;
      const w = ctx.measureText(tok).width;
      const age = t - t0;
      const fresh = Math.exp(-age * 3);
      // подложка токена
      ctx.fillStyle = rgba('signal', 0.1 + 0.35 * fresh);
      ctx.fillRect(x + (tok.startsWith(' ') ? 14 : 0), FY + 36, w - (tok.startsWith(' ') ? 14 : 0), FH - 72);
      ctx.fillStyle = age < 0.25 ? PAL.ember : PAL.bone;
      ctx.fillText(tok, x, y);
      // распределение над свежим токеном
      const showD = age < R.beatLen * 1.6 && t < tEnter;
      if (showD) {
        const a = ease.outExpo(clamp(age * 8)) * (1 - inv(R.beatLen * 1.2, R.beatLen * 1.6, age));
        const bx = x + 10,
          by = FY - 200;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = rgba('bone', 0.3);
        ctx.beginPath();
        ctx.moveTo(bx, by + 176);
        ctx.lineTo(bx, FY);
        ctx.stroke();
        cands.forEach(([word, p], j) => {
          const yy = by + j * 40;
          const chosen = j === 0;
          const grow = ease.outCubic(clamp(age * 5 - j * 0.15));
          ctx.fillStyle = rgba(chosen ? 'signal' : 'graphite', chosen ? 0.95 : 0.8);
          ctx.fillRect(bx + 8, yy + 10, 150 * p * grow * 1.6, 16);
          font(ctx, FONT.mono, 20, chosen ? 600 : 400);
          ctx.fillStyle = chosen ? PAL.ember : PAL.ash;
          ctx.fillText(`${word.trim()}`, bx + 180, yy + 25);
          ctx.fillStyle = PAL.graphite;
          ctx.fillText(p.toFixed(2), bx + 420, yy + 25);
        });
        ctx.restore();
        font(ctx, FONT.mono, 46, 400);
      }
      x += w;
      caretX = x;
    });

    // каретка
    if (t < tEnter + R.beatLen) {
      const blink = Math.floor(t / (R.beatLen / 2)) % 2 === 0;
      if (blink) {
        ctx.fillStyle = PAL.signal;
        ctx.fillRect(caretX + 6, FY + 40, 4, FH - 80);
      }
    }
    // ⏎
    const enterHit = ease.outExpo(inv(tEnter - R.beatLen * 0.5, tEnter, t)) * (1 - inv(tEnter, tEnter + R.beatLen, t));
    if (enterHit > 0) {
      font(ctx, FONT.mono, 80, 600);
      ctx.fillStyle = rgba('signal', enterHit);
      ctx.textAlign = 'right';
      ctx.fillText('⏎', FX + FW - 30, y + 14);
      ctx.textAlign = 'left';
    }

    // ответ модели: строки печатаются на 16-е (ноты арпеджио)
    if (t >= tEnter) {
      const ry = FY + FH + 120;
      const arps = R.count('arp', tEnter, t);
      let chars = arps * 3;
      font(ctx, FONT.mono, 34, 400);
      REPLY.forEach((line, i) => {
        if (chars <= 0) return;
        const shown = line.slice(0, chars);
        chars -= line.length + 4;
        const yy = ry + i * 56;
        ctx.fillStyle = i === 0 ? PAL.bone : i === 6 ? PAL.graphite : PAL.ash;
        if (i === 4 || i === 5) ctx.fillStyle = PAL.ember;
        ctx.fillText(shown, FX + 40, yy);
        if (i === 6 && shown.length > 3) {
          // «вымарано»
          const w = ctx.measureText(shown).width;
          ctx.fillStyle = PAL.bone;
          ctx.fillRect(FX + 40 + ctx.measureText('6. ').width, yy - 28, w - ctx.measureText('6. ').width, 36);
        }
      });
      // сноска
      const foot = ease.outExpo(inv(R.tBar(23.25), R.tBar(23.5), t));
      if (foot > 0) label(ctx, '* «все» — в смысле, указанном в пользовательском соглашении', FX + 40, ry + 8 * 56 + 10, { size: 18, color: 'graphite', alpha: foot });
      // огонёк бежит по строке ответа
      const lastLine = Math.min(REPLY.length - 1, Math.floor((arps * 3) / 36));
      const sx = FX + 40 + ((arps * 3) % 36) * 20.4;
      spark(ctx, sx, ry + lastLine * 56 - 12, t, { size: 0.7 + kick * 0.3, sputter: 0.8 });
    }

    ctx.restore();

    // в самом конце: схлопывание к центру перед следующей сценой
    const out = ease.inExpo(inv(R.tBar(23.75), R.tBar(24), t));
    if (out > 0) {
      ctx.fillStyle = rgba('ink', out);
      ctx.fillRect(0, 0, W, H);
    }
  },
};
