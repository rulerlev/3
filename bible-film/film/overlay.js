// 2D-оверлей поверх 3D: кинорамка, HUD «чтения» Библии, субтитры по словам, цитаты, интро, счётчики, титры.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ramp = (t, a, d = 1) => { const k = clamp((t - a) / d); return k * k * (3 - 2 * k); };
const fmt = (n) => n.toLocaleString('ru-RU').replace(/ /g, ' ');
const GOLD = '#e8c47a', DIM = 'rgba(255,255,255,0.38)';

export class Overlay {
  constructor(g, W, H, { timeline, bible, stats, exact }) {
    Object.assign(this, { g, W, H, timeline, bible, stats, exact });
    this.k = W / 1920; this.bar = Math.round(116 * this.k);
    // индекс глав: (код книги, глава) → номер главы во всей Библии и накопленные стихи
    this.chapIndex = {}; let acc = 0;
    bible.chapters.forEach((c, i) => { this.chapIndex[`${c.b} ${c.c}`] = { i, acc }; acc += c.verses; });
    this.totalVerses = acc; this.bookIndex = Object.fromEntries(bible.books.map((b, i) => [b.code, i]));
    this.maxV = Math.max(...bible.chapters.map((c) => c.verses));
  }
  font(px, fam = 'PTSans', style = '') { this.g.font = `${style} ${Math.round(px * this.k)}px ${fam}`.trim(); }

  draw(T, si, t, S) {
    const { g, W, H } = this; const meta = this.timeline.scenes[si];
    S.overlay.forEach((fn) => fn(g, this, t)); // сцена может рисовать своё (под рамкой)
    if (meta.id === 'intro') this.intro(t, S);
    if (meta.id === 'silence') this.silence(t, S);
    if (meta.id === 'outro') this.outro(t, S);
    // кинорамка
    g.fillStyle = '#000'; g.fillRect(0, 0, W, this.bar); g.fillRect(0, H - this.bar, W, this.bar);
    const fadeA = Math.min(ramp(t, 0, S.fadeIn || 0.01), 1 - ramp(t, meta.dur - (S.fadeOut || 0.01), S.fadeOut || 0.01));
    if (S.hud) this.hud(T, si, t, S, meta, meta.id === 'intro' ? ramp(t, 20.5, 1.5) : 1);
    if (S.quote.show) this.quotes(t, S, meta, fadeA);
    if (S.subs) this.subs(t, meta);
  }

  // ---------- HUD: «где мы в Библии» ----------
  cursor(si, t) {
    // плавно ведём курсор от главы текущей сцены к главе следующей
    const sc = this.timeline.scenes; const a = this.chapIndex[`${sc[si].book} ${sc[si].chapter}`];
    const nb = sc[Math.min(si + 1, sc.length - 1)]; const b = si + 1 < sc.length ? this.chapIndex[`${nb.book} ${nb.chapter}`] : { i: this.bible.chapters.length - 1, acc: this.totalVerses - 1 };
    let k = clamp(t / sc[si].dur); if (sc[si].id === 'intro') k = 0; if (sc[si].id === 'outro') k = 1;
    const ci = a.i + (b.i - a.i) * k; const ch = this.bible.chapters[Math.min(this.bible.chapters.length - 1, Math.floor(ci))];
    const verse = Math.round(a.acc + (b.acc - a.acc) * k) + 1;
    return { ci, ch, verse };
  }
  hud(T, si, t, S, meta, alpha) {
    if (alpha <= 0) return; const { g, W, k } = this; const bar = this.bar; g.save(); g.globalAlpha = alpha;
    const { ci, ch, verse } = this.cursor(si, t);
    // штрихкод из 1189 глав — высота = число стихов
    const x0 = 64 * k, x1 = W - 64 * k, yb = bar - 30 * k, hmax = 34 * k, n = this.bible.chapters.length, w = (x1 - x0) / n;
    this.bible.chapters.forEach((c, i) => {
      const h = Math.max(1.5 * k, Math.sqrt(c.verses / this.maxV) * hmax);
      g.fillStyle = i <= ci ? (i < 929 ? 'rgba(232,196,122,0.85)' : 'rgba(170,205,255,0.85)') : 'rgba(255,255,255,0.13)';
      g.fillRect(x0 + i * w, yb - h, Math.max(w - 0.35 * k, 0.6), h);
    });
    const cx = x0 + ci * w; g.fillStyle = '#fff'; g.fillRect(cx, yb - hmax - 6 * k, 1.5 * k, hmax + 12 * k);
    this.font(13, 'PTMono'); g.fillStyle = 'rgba(255,255,255,0.45)'; g.textBaseline = 'top';
    g.textAlign = 'left'; g.fillText('ВЕТХИЙ ЗАВЕТ · 929 ГЛАВ', x0, yb + 8 * k);
    g.textAlign = 'right'; g.fillText('НОВЫЙ ЗАВЕТ · 260 ГЛАВ', x1, yb + 8 * k);
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x0 + 929 * w, yb - hmax, 1 * k, hmax + 4 * k);
    // плашка в кадре (левый верх)
    const book = this.bible.books[this.bookIndex[ch.b]]; const px = 64 * k, py = bar + 30 * k;
    g.textAlign = 'left'; this.font(15, 'PTMono'); g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText(`КНИГА ${String(this.bookIndex[ch.b] + 1).padStart(2, '0')} / 66`, px, py);
    this.font(26, 'GaramondSC'); g.fillStyle = 'rgba(255,240,215,0.92)'; g.fillText(book.name, px, py + 22 * k);
    this.font(15, 'PTMono'); g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText(`ГЛАВА ${ch.c} · СТИХ ${fmt(verse)} / ${fmt(this.totalVerses)}`, px, py + 58 * k);
    // правый верх: таймкод
    g.textAlign = 'right'; const mm = Math.floor(T / 60), ss = Math.floor(T % 60), ff = Math.floor((T % 1) * 30);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillText(`${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`, W - px, py);
    g.fillStyle = 'rgba(232,196,122,0.8)'; g.fillText('● ЧТЕНИЕ', W - px, py + 22 * k);
    g.restore();
  }

  // ---------- субтитры рассказчика (по словам) ----------
  subs(t, meta) {
    const { g, W, H, k } = this; const line = meta.lines.find((l) => l.v === 'n' && t >= l.start - 0.15 && t <= l.end + 0.45);
    if (!line) return; const a = Math.min(ramp(t, line.start - 0.15, 0.2), 1 - ramp(t, line.end + 0.2, 0.25));
    this.font(30, 'PTSans'); g.textBaseline = 'middle'; g.textAlign = 'left';
    const words = line.words; const space = g.measureText(' ').width; const maxW = W - 300 * k;
    const rows = [[]]; let rw = 0;
    words.forEach((w) => { const ww = g.measureText(w.w).width; if (rw + ww > maxW && rows.at(-1).length) { rows.push([]); rw = 0; } rows.at(-1).push({ ...w, ww }); rw += ww + space; });
    const lh = 38 * k; const y0 = H - this.bar / 2 - (rows.length - 1) * lh / 2;
    g.save(); g.globalAlpha = a;
    rows.forEach((row, ri) => {
      const tw = row.reduce((s, w) => s + w.ww + space, -space); let x = W / 2 - tw / 2;
      row.forEach((w) => { const on = clamp((t - w.s) / 0.12); g.fillStyle = on > 0 ? `rgba(255,255,255,${0.38 + 0.62 * on})` : DIM; g.fillText(w.w, x, y0 + ri * lh); x += w.ww + space; });
    });
    g.restore();
  }

  // ---------- цитаты (крупно, по центру кадра) ----------
  quotes(t, S, meta, fadeA) {
    const { g, W, H, k } = this; const line = meta.lines.find((l) => l.v === 'q' && t >= l.start - 0.3 && t <= l.end + 1.6);
    if (!line) return; const Q = S.quote;
    const a = Math.min(ramp(t, line.start - 0.3, 0.4), 1 - ramp(t, line.end + 0.9, 0.7)) * fadeA;
    const len = line.t.length; const px = (len < 25 ? 76 : len < 60 ? 60 : len < 100 ? 50 : 44) * Q.scale;
    this.font(px, 'Garamond', 'italic'); g.textBaseline = 'middle'; g.textAlign = 'left';
    const words = line.words; const space = g.measureText(' ').width; const maxW = (len < 60 ? 1100 : 1350) * k;
    const rows = [[]]; let rw = 0;
    words.forEach((w) => { const ww = g.measureText(w.w).width; if (rw + ww > maxW && rows.at(-1).length) { rows.push([]); rw = 0; } rows.at(-1).push({ ...w, ww }); rw += ww + space; });
    const lh = px * 1.3 * k; const cy = this.bar + (H - 2 * this.bar) * Q.y; const y0 = cy - (rows.length - 1) * lh / 2 - 18 * k;
    // мягкое затемнение под текстом
    g.save(); g.globalAlpha = a * 0.55; const grd = g.createRadialGradient(W / 2, cy, 0, W / 2, cy, 900 * k);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, cy - 420 * k, W, 840 * k); g.restore();
    g.save(); g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 24 * k;
    rows.forEach((row, ri) => {
      const tw = row.reduce((s, w) => s + w.ww + space, -space); let x = W / 2 - tw / 2;
      row.forEach((w) => {
        const on = ramp(t, w.s - 0.12, 0.35); g.globalAlpha = a * (0.0 + on);
        g.fillStyle = '#fff6e6'; g.fillText(w.w, x, y0 + ri * lh + (1 - on) * 8 * k); x += w.ww + space;
      });
    });
    g.globalAlpha = a * ramp(t, line.start + 0.2, 0.6); g.shadowBlur = 10 * k; this.font(17, 'PTMono'); g.textAlign = 'center'; g.fillStyle = GOLD;
    const label = `${line.refName.toUpperCase()}`.split('').join(' ');
    g.fillText(`— ${label} —`, W / 2, y0 + (rows.length - 1) * lh + px * k * 0.95);
    g.restore();
  }

  // ---------- интро: печатная машинка ----------
  intro(t, S) {
    const { g, W, H, k } = this;
    const L = [
      [1.0, 'Одна книга.'],
      [3.4, '66 книг. 1 189 глав. 31 169 стихов.'],
      [7.4, 'Около сорока авторов. Пятнадцать веков.'],
      [11.6, 'Мы пройдём её целиком — от первой строки до последней.'],
      [15.6, 'Вот она — за десять минут.'],
    ];
    const cps = 26; this.font(25, 'PTMono'); g.textAlign = 'left'; g.textBaseline = 'middle';
    const x = 260 * k, y0 = H / 2 - 110 * k;
    const outA = 1 - ramp(t, 19.0, 1.2);
    L.forEach(([st, s], i) => {
      const n = Math.floor(clamp((t - st) * cps, 0, s.length)); if (t < st) return;
      const y = y0 + i * 52 * k; const txt = s.slice(0, n);
      // «рассыпание» строк в пыль при уходе
      const dis = ramp(t, 18.2 + i * 0.12, 1.4);
      g.save(); g.globalAlpha = outA * (i === L.length - 1 ? 1 : 0.62 + 0.38 * (t < (L[i + 1]?.[0] ?? 99) ? 1 : 0));
      g.fillStyle = i === L.length - 1 ? GOLD : '#e9e4da'; g.fillText(txt, x - dis * 40 * k, y);
      if (dis > 0) { for (let p = 0; p < 60; p++) { const r = Math.sin(p * 91.7 + i * 13.1) * 0.5 + 0.5, r2 = Math.sin(p * 17.3 + i) * 0.5 + 0.5;
        g.fillStyle = `rgba(233,228,218,${(1 - dis) * 0.8})`; g.fillRect(x + r * g.measureText(txt).width - dis * (80 + r2 * 300) * k, y + (r2 - 0.5) * 30 * k - dis * r * 60 * k, 2 * k, 2 * k); } }
      const last = L.findLastIndex(([s0]) => t >= s0);
      if (i === last && Math.floor(t * 2.2) % 2 === 0 && outA > 0.5) { g.fillStyle = GOLD; g.fillRect(x + g.measureText(txt).width + 4 * k, y - 14 * k, 13 * k, 27 * k); }
      g.restore();
    });
    // титул
    const ta = Math.min(ramp(t, 19.6, 1.8), 1 - ramp(t, 24.6, 1.2));
    if (ta > 0) {
      g.save(); g.globalAlpha = ta; g.textAlign = 'center';
      g.shadowColor = 'rgba(255,200,120,0.6)'; g.shadowBlur = 40 * k;
      const sp = (1 - ramp(t, 19.6, 5)) * 40 + 18; this.font(150, 'GaramondSC'); g.fillStyle = '#f3dcae';
      const word = 'Библия'; const letters = word.split(''); const widths = letters.map((c) => g.measureText(c).width);
      const tot = widths.reduce((a, b) => a + b, 0) + sp * k * (letters.length - 1); let lx = W / 2 - tot / 2; g.textAlign = 'left';
      letters.forEach((c, i) => { g.fillText(c, lx, H / 2 - 20 * k); lx += widths[i] + sp * k; });
      g.shadowBlur = 0; g.textAlign = 'center'; this.font(19, 'PTMono'); g.fillStyle = 'rgba(255,255,255,0.65)';
      g.fillText('СИНОДАЛЬНЫЙ ПЕРЕВОД  ·  66 КНИГ  ·  ОТ «В НАЧАЛЕ» ДО «АМИНЬ»', W / 2, H / 2 + 90 * k);
      g.restore();
    }
  }

  // ---------- 400 лет тишины ----------
  silence(t, S) {
    const { g, W, H, k } = this; const dur = this.timeline.scenes.find((s) => s.id === 'silence').dur;
    const a = Math.min(ramp(t, 1.0, 1.2), 1 - ramp(t, dur - 1.6, 1.2)); if (a <= 0) return;
    const yrs = Math.round(400 * ramp(t, 1.0, dur - 3.5));
    g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
    this.font(170, 'Garamond'); g.fillStyle = '#efe6d6'; g.fillText(String(yrs), W / 2, H / 2 - 40 * k);
    this.font(20, 'PTMono'); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillText('Л Е Т   Б Е З   П Р О Р О К О В', W / 2, H / 2 + 70 * k);
    // линия-таймлайн: Малахия → Матфей
    const x0 = 560 * k, x1 = W - 560 * k, y = H / 2 + 130 * k; g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x0, y, x1 - x0, 1.5 * k);
    g.fillStyle = GOLD; g.fillRect(x0, y, (x1 - x0) * yrs / 400, 1.5 * k);
    this.font(14, 'PTMono'); g.fillStyle = 'rgba(255,255,255,0.5)'; g.textAlign = 'left'; g.fillText('МАЛАХИЯ', x0, y + 22 * k);
    g.textAlign = 'right'; g.fillText('МАТФЕЙ', x1, y + 22 * k); g.restore();
  }

  // ---------- финал: вся Библия как график + цифры + титры ----------
  outro(t, S) {
    const { g, W, H, k } = this; const meta = this.timeline.scenes.find((s) => s.id === 'outro'); const c = meta.cues;
    const T0 = c.bars - 0.3, A = Math.min(ramp(t, T0, 0.8), 1 - ramp(t, c.last - 0.2, 1.0));
    const groups = [['GEN', 'Закон', '#e8c47a'], ['JOS', 'История', '#d99a6c'], ['JOB', 'Мудрость', '#c9d48a'], ['ISA', 'Пророки', '#e07a6a'],
      ['MAT', 'Евангелия', '#a8cdf5'], ['ACT', 'Деяния', '#8fd1c4'], ['ROM', 'Послания', '#b9a8f0'], ['REV', 'Откровение', '#f0f0f0']];
    const gStart = groups.map(([b]) => this.chapIndex[`${b} 1`].i);
    const colorOf = (i) => { let j = 0; while (j < gStart.length - 1 && i >= gStart[j + 1]) j++; return groups[j][2]; };
    if (A > 0) {
      g.save(); g.globalAlpha = A;
      const n = this.bible.chapters.length, x0 = 120 * k, x1 = W - 120 * k, base = H / 2 + 150 * k, hmax = 300 * k, w = (x1 - x0) / n;
      const grow = ramp(t, T0, 9.0);
      this.bible.chapters.forEach((ch, i) => {
        const appear = clamp((grow * n - i) / 40); if (appear <= 0) return;
        const h = (ch.verses / this.maxV) * hmax * appear; g.fillStyle = colorOf(i); g.globalAlpha = A * (0.35 + 0.65 * appear);
        g.fillRect(x0 + i * w, base - h, Math.max(w - 0.3 * k, 0.7), h);
      });
      g.globalAlpha = A; this.font(14, 'PTMono'); g.textBaseline = 'top';
      groups.forEach(([b, name, col], j) => {
        const i0 = gStart[j], i1 = j + 1 < groups.length ? gStart[j + 1] : n; const xm = x0 + (i0 + i1) / 2 * w;
        if (grow * n < i0) return; g.fillStyle = col; g.textAlign = 'center';
        g.fillText(name.toUpperCase(), Math.min(Math.max(xm, x0 + 50 * k), x1 - 50 * k), base + 14 * k + (j % 2) * 20 * k);
      });
      // счётчики
      const cnt = (v, d0) => Math.round(v * ramp(t, d0, 2.4));
      const items = [[cnt(66, c.bars), 'книг'], [cnt(1189, c.bars + 1.6), 'глав'], [cnt(31169, c.bars + 3.4), 'стихов'], [cnt(this.stats.words, c.bars + 5.2), 'слов']];
      g.textBaseline = 'alphabetic'; items.forEach(([v, lbl], j) => {
        const x = W / 2 + (j - 1.5) * 330 * k; g.textAlign = 'center';
        this.font(74, 'Garamond'); g.fillStyle = '#f6ecd8'; g.fillText(fmt(v), x, this.bar + 170 * k);
        this.font(16, 'PTMono'); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillText(lbl.toUpperCase(), x, this.bar + 202 * k);
      });
      // частотные плашки
      const ca = ramp(t, c.counts, 0.8);
      if (ca > 0) {
        g.globalAlpha = A * ca; const chips = [[`«ГОСПОДЬ»`, fmt(this.exact.lord)], [`«НЕ БОЙСЯ / НЕ БОЙТЕСЬ»`, fmt(this.exact.fear_not)], [`«ЛЮБОВЬ»`, fmt(this.exact.love)], [`«АМИНЬ»`, fmt(this.exact.amen)]];
        chips.forEach(([a, b], j) => {
          const x = W / 2 + (j - 1.5) * 380 * k, y = this.bar + 262 * k; const on = ramp(t, c.counts + j * 0.9, 0.5); g.globalAlpha = A * ca * on;
          g.strokeStyle = 'rgba(232,196,122,0.6)'; g.lineWidth = 1.2 * k; g.strokeRect(x - 170 * k, y - 26 * k, 340 * k, 52 * k);
          this.font(15, 'PTMono'); g.fillStyle = 'rgba(255,255,255,0.7)'; g.textAlign = 'left'; g.fillText(a, x - 156 * k, y + 6 * k);
          this.font(26, 'PTSans', 'bold'); g.fillStyle = GOLD; g.textAlign = 'right'; g.fillText(b, x + 156 * k, y + 9 * k);
        });
      }
      g.restore();
    }
    // титры
    const ca = Math.min(ramp(t, meta.dur - 8.5, 1.2), 1 - ramp(t, meta.dur - 1.6, 1.4));
    if (ca > 0) {
      g.save(); g.globalAlpha = ca; g.textAlign = 'center'; g.textBaseline = 'middle';
      this.font(64, 'GaramondSC'); g.fillStyle = '#f3dcae'; g.fillText('Библия', W / 2, H / 2 - 120 * k);
      this.font(18, 'PTMono'); g.fillStyle = 'rgba(255,255,255,0.72)';
      ['ТЕКСТ — СИНОДАЛЬНЫЙ ПЕРЕВОД, 66 КНИГ (EBIBLE.ORG, PUBLIC DOMAIN)', 'ВСЕ ЦИТАТЫ — ДОСЛОВНО ИЗ ФАЙЛА · ЦИФРЫ ПОСЧИТАНЫ ПО ВСЕМ 31 169 СТИХАМ',
        'ИЗОБРАЖЕНИЕ, МУЗЫКА И ЗВУК — СГЕНЕРИРОВАНЫ КОДОМ · ГОЛОС — ОФЛАЙН-СИНТЕЗ RHVOICE', 'THREE.JS · FFMPEG · PYTHON · БЕЗ ГЕНЕРАТИВНЫХ ВИДЕО- И ГОЛОСОВЫХ API']
        .forEach((s, i) => g.fillText(s, W / 2, H / 2 - 20 * k + i * 38 * k));
      g.restore();
    }
  }
}
