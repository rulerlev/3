// Превью в браузере + точка входа для офлайн-рендера (window.__render).
import { createEngine } from './engine.js';

const canvas = document.getElementById('c');
const audio = document.getElementById('a');
const info = document.getElementById('info');
const params = new URLSearchParams(location.search);
const renderMode = params.has('render');
if (renderMode) document.body.classList.add('render');

const eng = await createEngine(canvas, '.');

// Офлайн-рендер: скрипт вызывает __render(t) и забирает кадр
window.__engine = eng;
window.__render = (t, quality = 0.93) => {
  eng.render(t);
  return canvas.toDataURL('image/jpeg', quality);
};
window.__ready = true;

if (!renderMode) {
  let t = parseFloat(params.get('t') || '0');
  let playing = false;
  let t0 = 0,
    wall0 = 0;
  const now = () => (playing ? (audio.duration ? audio.currentTime : t0 + (performance.now() - wall0) / 1000) : t);

  const seek = (x) => {
    t = Math.max(0, Math.min(eng.duration, x));
    audio.currentTime = t;
    t0 = t;
    wall0 = performance.now();
  };
  seek(t);

  const toggle = () => {
    if (playing) {
      t = now();
      audio.pause();
      playing = false;
    } else {
      audio.currentTime = t;
      t0 = t;
      wall0 = performance.now();
      audio.play().catch(() => {});
      playing = true;
    }
  };

  addEventListener('keydown', (e) => {
    const cur = now();
    if (e.code === 'Space') toggle();
    else if (e.code === 'ArrowRight') seek(cur + (e.shiftKey ? 5 : 1));
    else if (e.code === 'ArrowLeft') seek(cur - (e.shiftKey ? 5 : 1));
    else if (e.key === ']' || e.key === '[') {
      const tl = eng.timeline;
      const i = tl.indexOf(eng.sceneAt(cur));
      const j = Math.max(0, Math.min(tl.length - 1, i + (e.key === ']' ? 1 : -1)));
      seek(tl[j].start + 0.001);
    } else if (e.key === 'h') document.body.classList.toggle('hide');
    else return;
    e.preventDefault();
  });
  canvas.addEventListener('click', toggle);

  const loop = () => {
    const cur = now();
    const id = eng.render(cur);
    info.textContent = `${cur.toFixed(2)} с · такт ${eng.R.bar(cur).toFixed(2)} · ${id}`;
    requestAnimationFrame(loop);
  };
  loop();
}
