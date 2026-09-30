// Ядро: грузит разметку трека и шрифты, выбирает сцену по времени, накладывает пост-обработку.
import { W, H, PAL, Rhythm, clamp } from './util.js';
import { grain, vignette } from './motifs.js';
import { buildTimeline } from './timeline.js';

const FONTS = [
  ['Inter Tight', 'InterTight-normal-300.ttf', 300, 'normal'],
  ['Inter Tight', 'InterTight-normal-500.ttf', 500, 'normal'],
  ['Inter Tight', 'InterTight-normal-700.ttf', 700, 'normal'],
  ['Inter Tight', 'InterTight-normal-900.ttf', 900, 'normal'],
  ['IBM Plex Mono', 'IBMPlexMono-normal-400.ttf', 400, 'normal'],
  ['IBM Plex Mono', 'IBMPlexMono-normal-600.ttf', 600, 'normal'],
  ['Cormorant Garamond', 'CormorantGaramond-italic-500.ttf', 500, 'italic'],
];

export async function createEngine(canvas, base = '.') {
  const data = await (await fetch(`${base}/public/track.json`)).json();
  await Promise.all(
    FONTS.map(async ([fam, file, weight, style]) => {
      const f = new FontFace(fam, `url(${base}/fonts/${file})`, { weight: String(weight), style });
      await f.load();
      document.fonts.add(f);
    }),
  );
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  const R = new Rhythm(data);
  const timeline = buildTimeline(R);
  const duration = data.duration;

  function sceneAt(t) {
    for (const s of timeline) if (t >= s.start && t < s.end) return s;
    return timeline[timeline.length - 1];
  }

  function render(t) {
    t = clamp(t, 0, duration - 1e-6);
    const s = sceneAt(t);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(0, 0, W, H);
    const local = t - s.start;
    const k = local / (s.end - s.start);
    s.draw(ctx, t, { local, k, start: s.start, end: s.end, R, scene: s });
    ctx.restore();
    ctx.save();
    vignette(ctx, s.light ? 0.28 : 0.5);
    grain(ctx, t, s.light ? 0.1 : 0.08);
    ctx.restore();
    return s.id;
  }

  return { render, duration, timeline, R, ctx, sceneAt };
}
