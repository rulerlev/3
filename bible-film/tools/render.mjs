// Рендер фильма: headless Chromium (Playwright) рисует кадр t → JPEG → ffmpeg.
// node tools/render.mjs --preview 30,600,1200        — PNG-превью отдельных кадров (номера кадров или s:секунды)
// node tools/render.mjs --workers 4 --out OUT_DIR     — весь фильм по сегментам
import { createRequire } from 'module';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve('playwright', { paths: ['/opt/node22/lib/node_modules', '/opt/node-tools/node_modules'] }));

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => (x.startsWith('--') ? a.concat([[x.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1] ?? true]]) : a), []));
const W = +(args.w || 1920), H = +(args.h || 1080);
const OUT = path.resolve(args.out || '/tmp/bible-render');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r)); const PORT = server.address().port;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${PORT}/film/index.html?w=${W}&h=${H}`);
  await page.waitForFunction(() => window.ready || window.initError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.initError); if (err) throw new Error(err);
  return page;
}
const launch = () => chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });

async function grab(page, f, q = 0.93) {
  await page.evaluate((f) => window.renderFrame(f), f);
  const url = await page.evaluate((q) => window.grab(q), q);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

if (args.preview) {
  const browser = await launch(); const page = await openPage(browser);
  const fps = 24; const list = String(args.preview).split(',').map((s) => (s.startsWith('s') ? Math.round(parseFloat(s.slice(1)) * fps) : +s));
  for (const f of list) { const t0 = Date.now(); const buf = await grab(page, f, 0.9); fs.writeFileSync(path.join(OUT, `f${String(f).padStart(6, '0')}.jpg`), buf); console.log('frame', f, `t=${(f / fps).toFixed(2)}s`, Date.now() - t0, 'ms'); }
  await browser.close(); server.close();
  if (args.sheet) { // контактный лист из превью
    const files = list.map((f) => path.join(OUT, `f${String(f).padStart(6, '0')}.jpg`)); const cols = Math.min(3, files.length), rows = Math.ceil(files.length / cols);
    const inputs = files.flatMap((f) => ['-i', f]); const lay = files.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join('|');
    const sc = files.map((_, i) => `[${i}:v]scale=640:360[v${i}]`).join(';'); const ins = files.map((_, i) => `[v${i}]`).join('');
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', `${sc};${ins}xstack=inputs=${files.length}:layout=${lay}:fill=black`, '-frames:v', '1', path.join(OUT, String(args.sheet))], { stdio: 'inherit' });
    await new Promise((r) => ff.on('close', r)); console.log('sheet', path.join(OUT, String(args.sheet)));
  }
  process.exit(0);
}

// полный рендер: сегменты не пересекают границы сцен (правка сцены → перерендер только её сегментов)
const probe = await launch(); const pp = await openPage(probe); const FRAMES = await pp.evaluate(() => window.FRAMES); await probe.close();
const TLD = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/timeline.json'))); const FPS = TLD.fps;
const only = args.scenes ? String(args.scenes).split(',') : null; const SEG = +(args.seg || 240), WORKERS = +(args.workers || 3);
const segs = []; let from = 0, to = 0;
TLD.scenes.forEach((sc, i) => {
  const a = Math.round(sc.start * FPS), b = i + 1 < TLD.scenes.length ? Math.round(TLD.scenes[i + 1].start * FPS) : FRAMES;
  if (only && !only.includes(sc.id)) return;
  for (let f = a; f < b; f += SEG) segs.push([f, Math.min(f + SEG, b), sc.id]);
});
to = segs.reduce((s, [a, b]) => s + b - a, 0);
if (args.force && only) for (const [a] of segs) { const f = path.join(OUT, `seg_${String(a).padStart(6, '0')}.mp4`); if (fs.existsSync(f)) fs.unlinkSync(f); }
console.log(`${to} frames of ${FRAMES}, ${segs.length} segments, ${WORKERS} workers`);
let done = 0; const tStart = Date.now();
async function worker(id) {
  const browser = await launch(); let page = await openPage(browser);
  while (segs.length) {
    const [a, b, sid] = segs.shift(); const file = path.join(OUT, `seg_${String(a).padStart(6, '0')}.mp4`);
    if (fs.existsSync(file)) { done += b - a; continue; }
    const tmp = file + '.part.mp4';
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '24', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-threads', '1', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) { const buf = await grab(page, f); if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r)); done++; }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r)); fs.renameSync(tmp, file);
    const el = (Date.now() - tStart) / 1000; console.log(`[w${id}] ${sid} ${a}-${b} done · ${done}/${to} · ${(done / el).toFixed(2)} fps · eta ${((to - done) / (done / el) / 60).toFixed(1)} min`);
  }
  await browser.close();
}
await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));
server.close(); console.log('render done in', ((Date.now() - tStart) / 60000).toFixed(1), 'min');
