// Офлайн-рендер: поднимает статический сервер, открывает страницу в headless Chromium,
// вызывает __render(t) для каждого кадра и отдаёт JPEG-кадры в ffmpeg (x264 + AAC).
//
//   node render.mjs video  [--fps 30] [--from 0] [--to 99.8] [--out out/clip.mp4]
//   node render.mjs stills [--at 5,20,40] [--out out/stills]
//   node render.mjs sheet  [--out out/sheet.jpg]      — контактный лист по сценам
//
// Путь к ffmpeg: переменная FFMPEG (по умолчанию «ffmpeg»).
// Путь к Chromium: CHROME (по умолчанию /opt/pw-browsers/chromium-*/chrome-linux/chrome).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const mode = argv[0] || 'video';
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wav': 'audio/wav', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        rsp.writeHead(404);
        return rsp.end();
      }
      rsp.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = '/opt/pw-browsers';
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).sort().reverse()) {
      const c = path.join(base, d, 'chrome-linux', 'chrome');
      if (d.startsWith('chromium-') && fs.existsSync(c)) return c;
    }
  }
  return undefined; // playwright сам найдёт свой браузер
}

const srv = await serve();
const url = `http://127.0.0.1:${srv.address().port}/index.html?render`;
const browser = await chromium.launch({ executablePath: findChrome(), args: ['--disable-gpu', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
const duration = await page.evaluate(() => window.__engine.duration);

const grab = async (t, q = 0.93) => {
  const data = await page.evaluate(([t, q]) => window.__render(t, q), [t, q]);
  return Buffer.from(data.split(',')[1], 'base64');
};

const FF = process.env.FFMPEG || 'ffmpeg';

if (mode === 'stills') {
  const out = path.resolve(ROOT, opt('out', 'out/stills'));
  fs.mkdirSync(out, { recursive: true });
  const ats = opt('at', '2,10,20,28,35,42,50,58,66,74,82,88,94,98').split(',').map(Number);
  for (const t of ats) {
    const f = path.join(out, `t${t.toFixed(2).padStart(6, '0')}.jpg`);
    fs.writeFileSync(f, await grab(t));
    console.log(f);
  }
} else if (mode === 'sheet') {
  // по 6 кадров на сцену, склейка через ffmpeg tile
  const out = path.resolve(ROOT, opt('out', 'out/sheet.jpg'));
  const tmp = path.join(path.dirname(out), 'sheet-tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const tl = await page.evaluate(() => window.__engine.timeline.map((s) => [s.id, s.start, s.end]));
  let n = 0;
  for (const [id, a, b] of tl) {
    for (let i = 0; i < 6; i++) {
      const t = a + ((b - a) * (i + 0.5)) / 6;
      fs.writeFileSync(path.join(tmp, `${String(n++).padStart(3, '0')}.jpg`), await grab(t, 0.85));
    }
  }
  await run(FF, ['-y', '-loglevel', 'error', '-i', path.join(tmp, '%03d.jpg'), '-vf', 'scale=480:-1,tile=6x' + tl.length, '-frames:v', '1', out]);
  fs.rmSync(tmp, { recursive: true });
  console.log(out);
} else {
  const fps = Number(opt('fps', 30));
  const from = Number(opt('from', 0));
  const to = Math.min(duration, Number(opt('to', duration)));
  const out = path.resolve(ROOT, opt('out', 'out/clip.mp4'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn(FF, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-ss', String(from), '-t', String(to - from), '-i', path.join(ROOT, 'public/track.wav'),
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', opt('preset', 'medium'), '-crf', opt('crf', '18'), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round((to - from) * fps);
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const buf = await grab(from + i / fps);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % (fps * 5) === 0) {
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`\rкадр ${i}/${frames} · ${(i / el || 0).toFixed(1)} к/с · прошло ${el.toFixed(0)} с   `);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(`\nготово: ${out} (${((Date.now() - t0) / 1000).toFixed(0)} с)`);
}

await browser.close();
srv.close();

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('close', (c) => (c ? rej(new Error(`${cmd} exit ${c}`)) : res()));
  });
}
