"""Саундтрек и звуковой дизайн, синтезированные с нуля (numpy/scipy), + сведение с голосом.
Вход: data/timeline.json, audio/lines/*.wav.  Выход: audio/mix.wav (48 кГц, стерео)."""
import json, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
TL = json.load(open('data/timeline.json'))
TOTAL = TL['total'] + 0.5
N = int(TOTAL * SR)
rs = np.random.RandomState(7)
music = np.zeros((2, N), np.float32); sfx = np.zeros((2, N), np.float32); voice = np.zeros(N, np.float32)
SC = {s['id']: s for s in TL['scenes']}

def T(scene, cue=None, off=0.0):
    s = SC[scene]; return s['start'] + (s['cues'][cue] if cue else 0) + off
def end(scene): s = SC[scene]; return s['start'] + s['dur']

# ---------- утилиты ----------
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def env_adsr(n, a, r, sustain=1.0):
    e = np.full(n, sustain, np.float32); na, nr = min(int(a * SR), n), min(int(r * SR), n)
    if na: e[:na] = np.linspace(0, sustain, na) ** 1.5
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e
def put(buf, t, x, pan=0.0, gain=1.0):
    i = int(t * SR); x = np.asarray(x, np.float32) * gain
    if i >= buf.shape[-1] or i + len(x) <= 0: return
    a = max(0, -i); x = x[a:]; i = max(i, 0); n = min(len(x), buf.shape[-1] - i)
    if buf.ndim == 1: buf[i:i + n] += x[:n]; return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + n] += x[:n] * l * 1.414; buf[1, i:i + n] += x[:n] * r * 1.414
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
def nm(s):  # 'D3' -> midi
    return NOTE[s[:-1]] + 12 * (int(s[-1]) + 1)
def tt(n): return np.arange(n) / SR

# ---------- инструменты ----------
def pad(notes, dur, bright=1200, amp=0.06, attack=2.5, release=3.0, detune=0.12, choir=False):
    n = int(dur * SR); t = tt(n); x = np.zeros(n)
    for m in notes:
        f = mtof(nm(m) if isinstance(m, str) else m)
        for d in (-detune, 0, detune):
            ph = rs.rand()
            ff = f * 2 ** (d / 12) * (1 + 0.002 * np.sin(2 * np.pi * (0.2 + rs.rand() * 0.3) * t))
            if choir: x += np.sin(2 * np.pi * np.cumsum(ff) / SR + ph * 6.28) + 0.25 * np.sin(4 * np.pi * np.cumsum(ff) / SR)
            else: x += 2 * ((np.cumsum(ff) / SR + ph) % 1) - 1
    if choir:
        x = sum(bp(x, f0 * 0.85, f0 * 1.15) * g for f0, g in ((700, 1.0), (1150, 0.6), (2600, 0.25))) * 3
    x = lp(x, bright, 2) / (len(notes) * 3) * amp * 10
    return x * env_adsr(n, attack, release)

def pluck(m, dur=2.5, amp=0.12, bright=1.0, harp=False):
    n = int(dur * SR); t = tt(n); f = mtof(m); x = np.zeros(n)
    for k in range(1, 9):
        x += np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * (bright ** k if bright < 1 else 1) / k ** (1.3 if harp else 1.1) * np.exp(-t * (1.4 + k * (1.2 if harp else 0.8)))
    a = np.minimum(1, t / 0.004)
    return x * a * amp

def bell(m, dur=4.0, amp=0.07):
    n = int(dur * SR); t = tt(n); f = mtof(m)
    x = sum(np.sin(2 * np.pi * f * r * t) * g * np.exp(-t * d) for r, g, d in ((1, 1, 1.2), (2.76, .45, 2.5), (5.4, .25, 4), (8.93, .12, 6)))
    return x * np.minimum(1, t / 0.002) * amp

def boom(dur=3.0, amp=0.5, f0=70, f1=32):
    n = int(dur * SR); t = tt(n); f = f1 + (f0 - f1) * np.exp(-t * 3)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    x += lp(rs.randn(n), 400) * np.exp(-t * 6) * 0.6
    return x * amp

def drum(amp=0.35, f0=150, f1=55, decay=7):
    n = int(0.8 * SR); t = tt(n); f = f1 + (f0 - f1) * np.exp(-t * 25)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay) + lp(rs.randn(n), 2000) * np.exp(-t * 40) * 0.3) * amp

def noise_bed(dur, kind='wind', amp=0.05, fade=2.0):
    n = int(dur * SR); w = rs.randn(n)
    if kind == 'wind':
        x = bp(w, 200, 1200); lfo = 0.55 + 0.45 * np.sin(2 * np.pi * 0.11 * tt(n) + rs.rand() * 6) * np.sin(2 * np.pi * 0.037 * tt(n))
        x = x * lfo
    elif kind == 'rain': x = hp(w, 2500) * 0.6 + bp(w, 400, 1500) * 0.4 + (rs.rand(n) > 0.9993) * rs.randn(n) * 3
    elif kind == 'sea': x = lp(w, 700) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.09 * tt(n)) ** 2)
    elif kind == 'roar': x = lp(w, 350, 3) * 2.5 + bp(w, 600, 2500) * 0.3
    elif kind == 'fire':
        x = lp(w, 900) * 0.5 + hp((rs.rand(n) > 0.9985) * rs.randn(n) * 6, 1500)
    elif kind == 'rumble': x = lp(w, 120, 3) * 4
    elif kind == 'night': x = bp(w, 3500, 6000) * (0.3 + 0.7 * (np.sin(2 * np.pi * 9 * tt(n)) > 0.6)) * (np.sin(2 * np.pi * 0.4 * tt(n)) > 0) * 0.5 + lp(w, 300) * 0.3
    else: x = w
    x = x / (np.std(x) + 1e-9); x = np.tanh(x / 3) * 3
    return x * amp * env_adsr(n, fade, fade)

def thunder(amp=0.5):
    n = int(5 * SR); t = tt(n); x = lp(rs.randn(n), 600, 3) * (np.exp(-t * 0.9) * (0.4 + 0.6 * (np.abs(np.sin(t * 13)) ** 4)))
    x[:int(0.15 * SR)] += hp(rs.randn(int(0.15 * SR)), 1500) * np.exp(-tt(int(0.15 * SR)) * 30) * 0.8
    return x / np.abs(x).max() * amp

def whoosh(dur=2.0, amp=0.25, f0=300, f1=3000):
    n = int(dur * SR); w = rs.randn(n); out = np.zeros(n); seg = 2048
    for i in range(0, n, seg):
        k = i / n; fc = f0 * (f1 / f0) ** k; out[i:i + seg] = bp(w[i:i + seg + 0][:seg], fc * 0.7, min(fc * 1.4, 20000))[:len(out[i:i + seg])]
    return lp(out, 6000) * np.sin(np.pi * np.linspace(0, 1, n)) ** 2 * amp * 3

def click(amp=0.05):
    n = int(0.03 * SR); t = tt(n); return (hp(rs.randn(n), 2000) * np.exp(-t * 300) + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 200) * 0.3) * amp

def crackle(dur, amp=0.15):
    n = int(dur * SR); x = np.zeros(n); k = np.linspace(0.3, 1, n)
    imp = (rs.rand(n) > 1 - 0.004 * k) * rs.randn(n) * 4; x = hp(imp, 800) + lp(rs.randn(n), 3000) * 0.3 * k
    return x / (np.abs(x).max() + 1e-9) * amp * env_adsr(n, 0.2, 0.5)

# ---------- партитура ----------
def chords(t0, seq, dur_each, **kw):
    """seq — список аккордов (списки нот 'D3'), идут с перекрытием"""
    for i, ch in enumerate(seq):
        put(music, t0 + i * dur_each, pad([nm(x) for x in ch], dur_each + 3.0, **kw), pan=0)

def arp(t0, t1, notes, step=0.5, amp=0.08, inst='pluck', pan=0.3, harp=False):
    t = t0; i = 0
    while t < t1:
        m = nm(notes[i % len(notes)]); x = pluck(m, 3, amp, harp=harp) if inst == 'pluck' else bell(m, 4, amp)
        put(music, t, x, pan=pan * np.sin(i * 1.7)); t += step; i += 1

Dm = ['D3', 'A3', 'D4', 'F4', 'A4']; Bb = ['A#2', 'F3', 'A#3', 'D4', 'F4']; F = ['F2', 'C3', 'F3', 'A3', 'C4']; C = ['C3', 'G3', 'C4', 'E4', 'G4']
Gm = ['G2', 'D3', 'G3', 'A#3', 'D4']; Am = ['A2', 'E3', 'A3', 'C4', 'E4']; D = ['D3', 'A3', 'D4', 'F#4', 'A4']; G = ['G2', 'D3', 'G3', 'B3', 'D4']
Dsus = ['D3', 'A3', 'D4', 'E4', 'A4']; Bm = ['B2', 'F#3', 'B3', 'D4', 'F#4']; A = ['A2', 'E3', 'A3', 'C#4', 'E4']; Em = ['E3', 'B3', 'E4', 'G4', 'B4']

# intro: дрон + редкие ноты + клавиши печатной машинки (синхронно с overlay.intro)
put(music, 0.0, pad([nm('D2'), nm('A2')], 26, bright=500, amp=0.07, attack=4, release=4))
for t0, s in [(1.0, 'Одна книга.'), (3.4, '66 книг. 1 189 глав. 31 169 стихов.'), (7.4, 'Около сорока авторов. Пятнадцать веков.'),
              (11.6, 'Мы пройдём её целиком — от первой строки до последней.'), (15.6, 'Вот она — за пятнадцать минут.')]:
    for i, ch in enumerate(s):
        if ch != ' ': put(sfx, t0 + i / 26 + 0.004 * rs.randn(), click(0.035 + 0.01 * rs.rand()), pan=-0.3 + i / len(s) * 0.4)
for i, m in enumerate(['A4', 'F4', 'D5', 'E5', 'C5', 'A4']): put(music, 2 + i * 3.1, pluck(nm(m), 4, 0.05), pan=0.2 * (-1) ** i)
put(music, 19.3, pad(Dsus, 7.5, bright=2500, amp=0.07, attack=1.0, release=2.5, choir=True)); put(sfx, 19.2, boom(4, 0.35))
put(music, 19.4, bell(nm('D5'), 5, 0.06), 0.2); put(music, 19.4, bell(nm('A5'), 5, 0.04), -0.2)

# creation
s = 'creation'; put(music, T(s), pad([nm('D2'), nm('A2'), nm('D3')], SC[s]['cues']['light'] + 2.5, bright=300, amp=0.09, attack=3, release=2))
put(sfx, T(s), noise_bed(SC[s]['cues']['light'] + 2, 'sea', 0.03))
put(sfx, T(s, 'light', 1.9), boom(5, 0.5, 90, 30)); put(sfx, T(s, 'light', 0.6), whoosh(1.5, 0.15, 200, 6000))
chords(T(s, 'light', 2.0), [D, G, Bm, A, D], 4.8, bright=2200, amp=0.075)
put(music, T(s, 'light', 2.0), pad(D, 6, bright=4000, amp=0.05, attack=0.3, release=4, choir=True))
arp(T(s, 'days'), T(s, 'man'), ['D5', 'A4', 'F#5', 'E5', 'B4', 'A5'], 0.42, 0.045, 'bell')
put(sfx, T(s, 'days'), noise_bed(end(s) - T(s, 'days'), 'sea', 0.025))

# eden
s = 'eden'; chords(T(s), [G, D, Em, C], (SC[s]['cues']['hide']) / 4, bright=1800, amp=0.07)
arp(T(s, None, 0.5), T(s, 'hide'), ['G4', 'B4', 'D5', 'G5', 'D5', 'B4'], 0.36, 0.05, harp=True)
put(sfx, T(s), noise_bed(SC[s]['dur'], 'night', 0.012)); put(sfx, T(s, 'fruit', 3.0), drum(0.15, 300, 120, 12))
chords(T(s, 'hide'), [Em, Am, Em, ['B2', 'F#3', 'A3', 'D#4']], (end(s) - T(s, 'hide')) / 4, bright=700, amp=0.075)
put(sfx, T(s, 'hide'), noise_bed(end(s) - T(s, 'hide'), 'wind', 0.03)); put(sfx, T(s, 'sword'), noise_bed(6, 'fire', 0.06)); put(sfx, T(s, 'sword'), boom(3, 0.3))

# flood
s = 'flood'; chords(T(s), [Dm, Bb], SC[s]['cues']['storm'] / 2, bright=500, amp=0.08)
put(sfx, T(s), noise_bed(SC[s]['cues']['storm'] + 1, 'wind', 0.035))
st = T(s, 'storm'); rb = T(s, 'rainbow')
put(sfx, st, noise_bed(rb - st + 1.5, 'rain', 0.07)); put(sfx, st, noise_bed(rb - st + 1.5, 'sea', 0.08))
chords(st, [Dm, Gm, Bb, A], (rb - st) / 4, bright=900, amp=0.09)
for k in range(int((rb - st) / 0.75)): put(music, st + k * 0.75, drum(0.2 if k % 4 == 0 else 0.11, 110, 45), pan=0)
for tt_ in (st + 1.2, st + 4.5, st + 7.0): put(sfx, tt_, thunder(0.45), pan=rs.rand() - 0.5)
chords(rb, [F, C, ['A#2', 'F3', 'A#3', 'D4', 'G4'], F], (T(s, 'babel') - rb) / 4, bright=2500, amp=0.07)
put(music, rb, pad(F, T(s, 'babel') - rb, bright=3500, amp=0.04, attack=3, choir=True))
arp(rb + 1, T(s, 'babel'), ['F5', 'C5', 'A4', 'G5', 'C5'], 0.55, 0.04, 'bell')
bb = T(s, 'babel'); chords(bb, [Am, ['A2', 'D#3', 'A3', 'C4']], (end(s) - bb) / 2, bright=1200, amp=0.07)
for k in range(8): put(music, bb + k * 0.45, drum(0.12 + k * 0.02, 140, 60), pan=0)
put(sfx, bb + 4.0, whoosh(3, 0.3, 4000, 200)); put(sfx, bb + 3.8, crackle(3, 0.15))

# abraham
s = 'abraham'; tr = T(s, 'tribes'); eg = T(s, 'egypt')
put(sfx, T(s), noise_bed(eg - T(s), 'night', 0.02)); put(sfx, T(s), noise_bed(eg - T(s), 'fire', 0.025))
chords(T(s), [Dsus, Bb, F, C], (tr - T(s)) / 4, bright=1500, amp=0.065)
arp(T(s, 'stars'), tr + 2, ['A5', 'D6', 'E6', 'A5', 'F#6', 'D6'], 0.3, 0.03, 'bell')
chords(tr, [D, Bm, G, A], (eg - tr) / 4, bright=2200, amp=0.07)
for k in range(12): put(music, tr + 1.0 + k * 0.6, bell(nm(['D5', 'E5', 'F#5', 'A5', 'B5', 'D6'][k % 6]), 3, 0.045), pan=(k - 6) / 7)
chords(eg, [['E3', 'B3', 'E4', 'F4', 'B4'], Am, ['E3', 'G#3', 'B3', 'F4']], (end(s) - eg) / 3, bright=1400, amp=0.07)
arp(eg, end(s), ['E4', 'F4', 'G#4', 'B4', 'C5', 'B4', 'G#4', 'F4'], 0.3, 0.05, harp=True)
put(sfx, eg, noise_bed(end(s) - eg, 'wind', 0.02))

# exodus
s = 'exodus'; c = SC[s]['cues']
put(sfx, T(s, 'bush'), noise_bed(c['plagues'] - c['bush'], 'fire', 0.06)); put(sfx, T(s), noise_bed(c['plagues'], 'wind', 0.02))
chords(T(s), [Dm, ['D3', 'A3', 'D4', 'E4', 'A4'], Bb, Dm], c['plagues'] / 4, bright=1300, amp=0.07)
put(music, T(s, 'bush', 5.0), pad(Dm, 8, bright=3000, amp=0.04, choir=True))
pl = T(s, 'plagues'); sh = T(s, 'shore')
chords(pl, [Dm, Gm, ['C#3', 'G3', 'A#3', 'E4'], Dm], (sh - pl) / 4, bright=800, amp=0.08)
for k in range(int((sh - pl) / 0.5)): put(music, pl + k * 0.5, drum(0.16 if k % 2 == 0 else 0.08, 130, 50), pan=0)
put(sfx, pl, noise_bed(sh - pl, 'rumble', 0.04))
chords(sh, [Dm, Bb, Gm, A], (T(s, 'part') - sh) / 4 + 0.2, bright=1200, amp=0.085)
for k in range(int((T(s, 'part') - sh) / 0.375)): put(music, sh + k * 0.375, drum(0.08 + 0.15 * k / 14, 120, 50), pan=0)
pt = T(s, 'part'); put(sfx, pt - 0.3, whoosh(4, 0.35, 150, 4000)); put(sfx, pt, boom(5, 0.55, 80, 28)); put(sfx, pt, noise_bed(end(s) - pt, 'roar', 0.09))
chords(pt, [D, G, D, A, D], (end(s) - pt) / 5 + 0.3, bright=3000, amp=0.085)
put(music, pt, pad(D, end(s) - pt, bright=4500, amp=0.06, attack=1.5, choir=True))

# sinai
s = 'sinai'; c = SC[s]['cues']; put(sfx, T(s), noise_bed(c['desert'], 'rumble', 0.05))
for tt_ in (T(s, None, 1.0), T(s, None, 4.5), T(s, None, 7.2)): put(sfx, tt_, thunder(0.5), pan=rs.rand() - 0.5)
chords(T(s), [Dm, ['D3', 'G3', 'A#3', 'D4'], Dm], c['kill'] / 3 + 0.5, bright=900, amp=0.08)
put(music, T(s, 'kill'), boom(4, 0.3, 60, 30)); put(music, T(s, 'steal'), boom(4, 0.3, 60, 30))
chords(T(s, 'kill'), [Dsus, Dsus], (c['desert'] - c['kill']) / 2, bright=1200, amp=0.06)
de = T(s, 'desert'); chords(de, [Dm, F, C], (end(s) - de) / 3, bright=1600, amp=0.07); put(sfx, de, noise_bed(end(s) - de, 'wind', 0.04)); put(sfx, de, noise_bed(end(s) - de, 'fire', 0.03))

# judges
s = 'judges'; c = SC[s]['cues']; je = T(s, 'jericho')
for k in range(3): put(music, je + 0.5 + k * 1.6, pad([nm('D3'), nm('A3')], 1.4, bright=1800, amp=0.12, attack=0.1, release=0.6))
put(sfx, je + 5.0, boom(4, 0.55)); put(sfx, je + 5.0, crackle(3, 0.2)); put(sfx, je + 5.0, noise_bed(3, 'rumble', 0.12, 0.3))
chords(je, [Dm, Dm], c['cycle'] / 2, bright=900, amp=0.06)
cy = T(s, 'cycle'); chords(cy, [Am, F, C, G, Am, F, C, G], (end(s) - cy) / 8, bright=1400, amp=0.065)
loop_line = SC[s]['lines'][2]
starts = [loop_line['words'][0]['s']] + [w['s'] for i, w in enumerate(loop_line['words'][1:], 1) if loop_line['words'][i - 1]['w'].endswith('.')]
for k, st_ in enumerate(starts): put(music, T(s) + st_, bell(nm(['A4', 'C5', 'E5', 'G5', 'A5', 'E5'][k % 6]), 3, 0.06), pan=(k - 2.5) / 3)
for k in range(int((end(s) - cy) / 0.8)): put(music, cy + k * 0.8, drum(0.07, 160, 70), pan=0)

# kings
s = 'kings'; c = SC[s]['cues']; go = T(s, 'goliath'); th = T(s, 'throw'); ha = T(s, 'harp'); te = T(s, 'temple')
chords(T(s), [Dm, Bb, F], c['goliath'] / 3, bright=1400, amp=0.07)
chords(go, [Dm, Bb, C, A], (th - go) / 4, bright=1100, amp=0.085)
for k in range(int((th - go) / 0.5)): put(music, go + k * 0.5, drum(0.1 + 0.1 * (k % 4 == 0), 110, 45), pan=0)
put(sfx, th - 0.2, whoosh(1.0, 0.35, 400, 5000)); put(sfx, th + 0.7, boom(3, 0.5, 60, 25)); put(sfx, th + 1.5, noise_bed(2, 'rumble', 0.1, 0.3))
chords(ha, [D, Bm, G, A, D], (te - ha) / 5, bright=1500, amp=0.055)
arp(ha + 0.3, te, ['D4', 'F#4', 'A4', 'D5', 'A4', 'F#4', 'B3', 'D4', 'G4', 'B4', 'G4', 'D4'], 0.28, 0.06, harp=True)
put(sfx, ha, noise_bed(te - ha, 'night', 0.02))
chords(te, [D, G, D], (end(s) - te) / 3 + 0.3, bright=3200, amp=0.08); put(music, te, pad(D, end(s) - te, bright=4000, amp=0.05, choir=True))
for k in range(4): put(music, te + k * 1.8, bell(nm(['D5', 'A5', 'F#5', 'D6'][k]), 4, 0.05))

# prophets
s = 'prophets'; c = SC[s]['cues']
chords(T(s), [Dm, ['C#3', 'A3', 'E4']], c['prophets'] / 2, bright=900, amp=0.07); put(sfx, T(s, 'split', 1.0), boom(3, 0.4)); put(sfx, T(s, 'split', 1.0), crackle(1.5, 0.2))
chords(T(s, 'prophets'), [Dm, Gm, Dm, A, Dm, Bb], (c['fire'] - c['prophets']) / 6, bright=1100, amp=0.07); put(sfx, T(s, 'prophets'), noise_bed(c['isaiah'] - c['prophets'], 'wind', 0.04))
put(music, T(s, 'isaiah'), pad(Dm, 9, bright=2500, amp=0.04, choir=True))
fi = T(s, 'fire'); put(sfx, fi, noise_bed(c['bones'] - c['fire'], 'fire', 0.09)); put(sfx, fi, noise_bed(c['bones'] - c['fire'], 'rumble', 0.05))
chords(fi, [Dm, Bb, Gm, A], (c['bones'] - c['fire']) / 4, bright=700, amp=0.085)
for k in range(int((c['bones'] - c['fire']) / 0.6)): put(music, fi + k * 0.6, drum(0.12, 100, 40), pan=0)
bo = T(s, 'bones'); chords(bo, [['D3', 'G#3', 'D4'], ['D3', 'A3', 'C4']], (c['alive'] - c['bones']) / 2, bright=600, amp=0.07); put(sfx, bo, noise_bed(c['alive'] - c['bones'] + 1, 'wind', 0.03))
al = T(s, 'alive'); put(sfx, al - 0.5, whoosh(4, 0.3, 200, 3000)); chords(al, [D, G, A], (c['return'] - c['alive']) / 3, bright=2500, amp=0.08)
put(music, al, pad(D, c['return'] - c['alive'] + 1, bright=4000, amp=0.055, attack=1.5, choir=True))
rt = T(s, 'return'); chords(rt, [Dsus, Bb], (end(s) - rt) / 2 + 1, bright=1200, amp=0.055)

# silence: почти тишина — одна нота
s = 'silence'; put(music, T(s), pad([nm('D3'), nm('A3')], SC[s]['dur'], bright=400, amp=0.04, attack=1, release=5))
for k in range(4): put(sfx, T(s) + 1.5 + k * 1.8, click(0.02))

# nativity
s = 'nativity'; c = SC[s]['cues']
chords(T(s), [Dsus, ['A#2', 'F3', 'A#3', 'D4', 'A4']], c['flesh'] / 2, bright=1500, amp=0.06)
arp(T(s, 'word'), T(s, 'manger'), ['D6', 'A5', 'E6', 'A5', 'F#6', 'A5'], 0.5, 0.03, 'bell')
put(sfx, T(s, 'flesh'), whoosh(3, 0.15, 6000, 300))
mg = T(s, 'manger'); chords(mg, [D, G, D, A, D], (end(s) - mg) / 5 + 0.3, bright=2000, amp=0.06)
arp(mg, end(s), ['D5', 'F#5', 'A5', 'D6', 'A5', 'F#5'], 0.45, 0.04, 'bell'); put(music, mg, pad(D, end(s) - mg, bright=3500, amp=0.04, choir=True))
put(sfx, mg, noise_bed(end(s) - mg, 'night', 0.015))

# ministry
s = 'ministry'; c = SC[s]['cues']
chords(T(s), [D, A, Bm, G, D, A], c['tomb'] / 6, bright=2000, amp=0.06); put(sfx, T(s), noise_bed(c['tomb'], 'sea', 0.025))
arp(T(s, 'galilee'), T(s, 'tomb'), ['D4', 'A4', 'D5', 'E5', 'F#5', 'E5', 'D5', 'A4'], 0.32, 0.045)
tb = T(s, 'tomb'); chords(tb, [Bm, Em, Bm, ['F#2', 'C#3', 'F#3', 'A#3']], (c['lazarus'] - c['tomb']) / 4, bright=900, amp=0.06)
for k, m in enumerate(['B4', 'A4', 'F#4', 'E4']): put(music, T(s, 'wept') + k * 0.9, pluck(nm(m), 3, 0.05))
la = T(s, 'lazarus'); put(sfx, la + 1.5, boom(3, 0.3)); chords(la, [D, A], 2.2, bright=3000, amp=0.07)
put(music, la, pad(D, 4.5, bright=4000, amp=0.05, attack=0.5, choir=True)); chords(la + 4.4, [Dm, ['C#3', 'G3', 'A#3', 'E4']], (end(s) - la - 4.4) / 2, bright=600, amp=0.07)

# cross
s = 'cross'; c = SC[s]['cues']
chords(T(s), [D, G, A], c['crowd'] / 3, bright=2500, amp=0.06); put(sfx, T(s), noise_bed(c['crowd'], 'wind', 0.015))
for k in range(int(c['crowd'] / 0.5)): put(music, T(s) + k * 0.5, drum(0.06, 220, 120, 14), pan=0.3)
cr = T(s, 'crowd'); chords(cr, [Dm, ['D3', 'G#3', 'B3', 'F4']], (c['supper'] - c['crowd']) / 2, bright=700, amp=0.08); put(sfx, cr, noise_bed(c['supper'] - c['crowd'], 'fire', 0.04))
for k in range(int((c['supper'] - c['crowd']) / 0.5)): put(music, cr + k * 0.5, drum(0.12, 110, 45), pan=0)
su = T(s, 'supper'); chords(su, [Dm, Bb, Gm, A], (c['golgotha'] - c['supper']) / 4, bright=900, amp=0.06)
go = T(s, 'golgotha'); chords(go, [Dm, Gm, ['C#3', 'G3', 'A#3', 'E4']], (c['finished'] - c['golgotha']) / 3, bright=500, amp=0.08); put(sfx, go, noise_bed(c['finished'] - c['golgotha'], 'wind', 0.05))
for k in range(int((c['finished'] - c['golgotha']) / 0.85)): put(music, go + k * 0.85, drum(0.16, 80, 35, 4), pan=0)
fn = T(s, 'finished'); put(sfx, fn + 1.6, thunder(0.6)); put(sfx, fn + 1.6, boom(5, 0.5, 60, 25))
ve = T(s, 'veil'); put(sfx, ve + 0.3, crackle(3.5, 0.25)); put(sfx, ve, noise_bed(end(s) - ve, 'rumble', 0.1, 0.5))
put(music, ve, pad([nm('D2'), nm('A2'), nm('D3')], end(s) - ve, bright=400, amp=0.08))

# resurrection
s = 'resurrection'; c = SC[s]['cues']
chords(T(s), [Dsus, Bm, G], c['risen'] / 3, bright=1200, amp=0.05); put(sfx, T(s), noise_bed(c['risen'], 'night', 0.02))
ri = T(s, 'risen'); put(sfx, ri - 0.3, whoosh(2.5, 0.2, 300, 6000)); put(sfx, ri, boom(4, 0.35, 80, 40))
chords(ri, [D, A, Bm, G, D], (end(s) - ri) / 5 + 0.5, bright=4000, amp=0.09)
put(music, ri, pad(D, end(s) - ri + 1, bright=5000, amp=0.07, attack=1.0, choir=True))
arp(ri, end(s) + 1, ['D5', 'A5', 'F#5', 'D6', 'A5', 'E6'], 0.25, 0.035, 'bell')

# church
s = 'church'; c = SC[s]['cues']
put(sfx, T(s, 'fire'), whoosh(3, 0.3, 200, 2500)); put(sfx, T(s, 'fire', 2.0), noise_bed(6, 'fire', 0.05)); put(sfx, T(s), noise_bed(c['unbabel'], 'wind', 0.04))
chords(T(s), [D, G, D, A], c['unbabel'] / 4, bright=2500, amp=0.07)
ub = T(s, 'unbabel'); chords(ub, [G, D, A, D], (c['paul'] - c['unbabel']) / 4, bright=3000, amp=0.07)
arp(ub, T(s, 'paul'), ['D5', 'G5', 'A5', 'B5', 'D6', 'B5', 'A5', 'G5'], 0.18, 0.03, 'bell')
pa = T(s, 'paul'); chords(pa, [D, Bm, G, A, D, Bm], (c['love'] - c['paul']) / 6, bright=2000, amp=0.065); put(sfx, pa, noise_bed(c['love'] - c['paul'], 'sea', 0.025))
for k in range(int((c['love'] - c['paul']) / 0.5)): put(music, pa + k * 0.5, drum(0.07, 180, 90, 10), pan=0)
arp(pa, T(s, 'love'), ['D4', 'A4', 'F#4', 'A4'], 0.25, 0.04)
lo = T(s, 'love'); chords(lo, [G, D, A, D], (end(s) - lo) / 4 + 0.3, bright=1600, amp=0.06); put(music, lo, pad(D, end(s) - lo, bright=3000, amp=0.035, choir=True))

# revelation
s = 'revelation'; c = SC[s]['cues']
chords(T(s), [Dm, ['D3', 'A3', 'D4', 'E4']], c['new'] / 2, bright=800, amp=0.07); put(sfx, T(s), noise_bed(c['new'], 'sea', 0.05)); put(sfx, T(s), noise_bed(c['new'], 'wind', 0.03))
nw = T(s, 'new'); chords(nw, [Dm, Bb, Gm, A], (c['tears'] - c['new']) / 4, bright=1000, amp=0.09)
for k in range(7): put(music, nw + k * 0.95, drum(0.18, 90, 35, 4), pan=0); put(sfx, nw + k * 0.95, boom(2, 0.15))
for tt_ in (nw + 1.0, nw + 4.2): put(sfx, tt_, thunder(0.45), pan=rs.rand() - 0.5)
te_ = T(s, 'tears'); chords(te_, [D, G, D, A], (c['tree'] - c['tears']) / 4, bright=3500, amp=0.07); put(music, te_, pad(D, c['tree'] - c['tears'], bright=4500, amp=0.05, choir=True))
trr = T(s, 'tree'); chords(trr, [G, D, Bm, A, G, D], (end(s) - trr) / 6 + 0.3, bright=3000, amp=0.075)
arp(trr, end(s), ['D5', 'A5', 'F#5', 'D6', 'B5', 'A5', 'F#5', 'E5'], 0.35, 0.04, 'bell'); put(sfx, trr, noise_bed(end(s) - trr, 'sea', 0.02))
put(music, T(s, 'allnew'), pad(D, end(s) - T(s, 'allnew') + 2, bright=5000, amp=0.06, choir=True)); put(sfx, T(s, 'allnew'), boom(4, 0.3, 80, 40))

# outro: тихая тема на «пианино» и финальный аккорд
s = 'outro'; c = SC[s]['cues']
chords(T(s), [D, Bm, G, A, D, Bm, G, A], (c['amen']) / 8, bright=1500, amp=0.05)
theme = ['F#5', 'E5', 'D5', 'A4', 'B4', 'D5', 'E5', 'A4', 'G4', 'F#4', 'E4', 'D4']
for k, m in enumerate(theme): put(music, T(s) + 1.0 + k * (c['amen'] - 2) / len(theme), pluck(nm(m), 4, 0.055), pan=0.15)
am = T(s, 'amen'); put(music, am, pad(D, end(s) - am + 1, bright=3000, amp=0.07, attack=2, release=8)); put(music, am, pad(D, end(s) - am, bright=4500, amp=0.05, attack=2.5, release=8, choir=True))
put(music, am, bell(nm('D5'), 6, 0.05)); put(music, am + 0.3, bell(nm('A5'), 6, 0.035)); put(music, am + 0.6, bell(nm('F#5'), 6, 0.03))

# ---------- голос ----------
def read_wav(p):
    with wave.open(p) as w: return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
for sc in TL['scenes']:
    for l in sc['lines']:
        put(voice, sc['start'] + l['at'], read_wav(l['wav']) * (0.9 if l['v'] == 'q' else 1.0))

# ---------- сведение ----------
print('reverb...')
ir_n = int(3.2 * SR); irt = tt(ir_n)
ir = np.stack([rs.randn(ir_n) * np.exp(-irt * 2.1), rs.randn(ir_n) * np.exp(-irt * 2.1)]); ir = lp(ir, 5000) ; ir /= np.abs(ir).sum(axis=1, keepdims=True) / 18
wet = np.stack([fftconvolve(music[i] + sfx[i] * 0.4, ir[i])[:N] for i in range(2)]).astype(np.float32)
music_bus = music * 0.75 + wet * 0.35
# дакинг музыки под голос
env = np.convolve(np.abs(voice), np.ones(2400) / 2400, 'same'); env = np.maximum.accumulate(env[::-1])[::-1] * 0 + env
att = np.zeros_like(env); a_up, a_dn = np.exp(-1 / (0.05 * SR)), np.exp(-1 / (0.6 * SR)); v = 0.0
step = 480
for i in range(0, N, step):
    x = env[i]; v = x if x > v else v * a_dn ** step; att[i:i + step] = v
duck = 1 - 0.55 * np.clip(att / 0.08, 0, 1)
def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
vm = np.abs(voice) > 0.01
pk = np.abs(sfx).max(axis=0); idx = np.argsort(pk)[::-1][:2000:200]; print('sfx peaks at', sorted(set(round(i / SR, 1) for i in idx)))
print('voice rms (speech)', rms_db(voice[vm]), 'music rms', rms_db(music_bus), 'sfx rms', rms_db(sfx), 'music peak', np.abs(music_bus).max(), 'sfx peak', np.abs(sfx).max())
sfx = np.tanh(sfx / 0.6) * 0.6
mix = music_bus * duck + sfx * (0.6 + 0.4 * duck) + voice[None, :] * 0.95
mix = hp(mix, 25)
# мягкий лимитер
peak = np.abs(mix).max(); print('peak before', peak)
mix = np.tanh(mix / 0.9) * 0.9
rms = np.sqrt(np.mean(mix ** 2)); target = 10 ** (-15.5 / 20); mix *= min(target / rms, 0.98 / np.abs(mix).max())
print('rms dB', 20 * np.log10(np.sqrt(np.mean(mix ** 2))), 'peak', np.abs(mix).max())
out = (np.clip(mix, -1, 1).T * 32767).astype(np.int16)
with wave.open('audio/mix.wav', 'w') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('wrote audio/mix.wav', out.shape[0] / SR, 's')
