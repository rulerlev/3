"""Кинотеатральный звук 5.1, синтезированный с нуля (numpy/scipy) — музыка, атмосферы, фоли, эффекты, голос.
Шины: DIA (голос, центр) · MUS (музыка, стерео + отражения в тылы) · AMB (атмосферы, 4 угла, декоррелированы)
· SFX/FOLEY (точечные источники с азимутом, в т.ч. движущиеся) · LFE (саб, < 120 Гц).
Выход: audio/mix51.wav (L R C LFE Ls Rs) и audio/mix.wav (стерео-даунмикс для наушников/телефона)."""
import json, wave, os, sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import pyloudnorm as pyln

SR = 48000
TL = json.load(open(os.environ.get('TIMELINE', 'data/timeline.json')))
N = int((TL['total'] + 0.5) * SR)
rs = np.random.RandomState(7)
SC = {s['id']: s for s in TL['scenes']}
# каналы 5.1 в порядке WAV: L R C LFE Ls Rs
L, R, C, LFE, LS, RS = range(6)
SPK = [(L, -30), (R, 30), (LS, -110), (RS, 110)]  # «кольцо» для эффектов и атмосфер (центр держим под голос)

mus = np.zeros((2, N), np.float32)        # музыка (стерео)
amb = np.zeros((4, N), np.float32)        # атмосферы: L R Ls Rs
fx = np.zeros((6, N), np.float32)         # точечные эффекты в 5.1 (без LFE)
lfe = np.zeros(N, np.float32)             # посыл в саб
dia = np.zeros(N, np.float32)             # голос рассказчика
quo = np.zeros(N, np.float32)             # цитаты (идут в центр + «собор» по залу)

def T(scene, cue=None, off=0.0):
    s = SC[scene]; return s['start'] + (s['cues'][cue] if cue else 0) + off
def end(scene): s = SC[scene]; return s['start'] + s['dur']
def cue(scene, c): return SC[scene]['cues'][c]

# ---------- DSP ----------
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def tt(n): return np.arange(n) / SR
def env(n, a, r, s=1.0):
    e = np.full(n, s, np.float32); na, nr = min(int(a * SR), n), min(int(r * SR), n)
    if na: e[:na] = np.linspace(0, s, na) ** 1.5
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e
def norm(x): return x / (np.std(x) + 1e-9)
def soft(x, k=3): return np.tanh(x / k) * k
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
def nm(s): return s if not isinstance(s, str) else NOTE[s[:-1]] + 12 * (int(s[-1]) + 1)

def _span(t, n):
    i = int(t * SR); a = max(0, -i); i = max(i, 0); m = min(n - a, N - i); return i, a, m
def gains_for(az):
    """VBAP по кольцу L,R,Ls,Rs. az — градусы (0 — вперёд, + вправо). Возвращает (4, len) или (4,)"""
    az = np.asarray(az, float); az = (az + 180) % 360 - 180
    ring = [(-30, 0), (30, 1), (110, 3), (-110, 2)]  # по часовой: L, R, Rs, Ls
    g = np.zeros((4,) + az.shape)
    for k in range(4):
        a0, i0 = ring[k]; a1, i1 = ring[(k + 1) % 4]
        span = (a1 - a0) % 360; rel = (az - a0) % 360; m = rel <= span
        f = np.where(m, rel / span, 0) * np.pi / 2
        g[i0] += np.where(m, np.cos(f), 0); g[i1] += np.where(m, np.sin(f), 0)
    return g / np.maximum(np.sqrt((g ** 2).sum(0)), 1e-9)
RING_CH = [L, R, LS, RS]

def music(t, x, pan=0.0, gain=1.0):
    i, a, m = _span(t, len(x))
    if m <= 0: return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mus[0, i:i + m] += x[a:a + m] * l * 1.414 * gain; mus[1, i:i + m] += x[a:a + m] * r * 1.414 * gain
def sfx(t, x, az=0.0, az1=None, gain=1.0, sub=0.0, center=0.0):
    """точечный эффект; az1 — конечный азимут (движение); sub — посыл в LFE; center — доля в центр"""
    x = np.asarray(x, np.float32); i, a, m = _span(t, len(x))
    if m <= 0: return
    seg = x[a:a + m] * gain
    if az1 is None: g = gains_for(az)[:, None]
    else: g = gains_for(np.linspace(az, az1, len(x))[a:a + m])
    for k, ch in enumerate(RING_CH): fx[ch, i:i + m] += seg * g[k] * (1 - center * 0.5)
    if center: fx[C, i:i + m] += seg * center
    if sub: lfe[i:i + m] += lp(seg, 110, 4).astype(np.float32) * sub
def ambience(t, x4, gain=1.0):
    """x4: (4, n) — четыре декоррелированных канала L R Ls Rs"""
    i, a, m = _span(t, x4.shape[1])
    if m > 0: amb[:, i:i + m] += x4[:, a:a + m] * gain
def boomsub(t, x, gain=1.0):
    i, a, m = _span(t, len(x))
    if m > 0: lfe[i:i + m] += x[a:a + m] * gain

DUCK_DEPTH, DUCK_SENS, DIP = float(os.environ.get('DUCK_DEPTH', 0.85)), 0.04, float(os.environ.get('DIP', 0.6))
BG_GAIN = float(os.environ.get('BG_GAIN', 0.7))

# ---------- инструменты ----------
def pad(notes, dur, bright=1200, amp=0.06, attack=2.5, release=3.0, detune=0.12, choir=False):
    n = int(dur * SR); t = tt(n); x = np.zeros(n)
    for m in notes:
        f = mtof(nm(m))
        for d in (-detune, 0, detune):
            ph = rs.rand(); ff = f * 2 ** (d / 12) * (1 + 0.002 * np.sin(2 * np.pi * (0.2 + rs.rand() * 0.3) * t)); P = np.cumsum(ff) / SR
            x += (np.sin(2 * np.pi * P + ph * 6.28) + 0.25 * np.sin(4 * np.pi * P)) if choir else (2 * ((P + ph) % 1) - 1)
    if choir: x = sum(bp(x, f0 * 0.85, f0 * 1.15) * g for f0, g in ((700, 1.0), (1150, 0.6), (2600, 0.25))) * 3
    return lp(x, bright, 2) / (len(notes) * 3) * amp * 10 * env(n, attack, release)
def strings(notes, dur, amp=0.05, bright=2500, attack=1.5, release=2.5):
    """смычковые: пила с вибрато и мягким фильтром, ансамблевая расстройка"""
    n = int(dur * SR); t = tt(n); x = np.zeros(n)
    for m in notes:
        f = mtof(nm(m))
        for d in (-0.07, -0.02, 0.03, 0.08):
            vib = 1 + 0.004 * np.sin(2 * np.pi * (5.2 + rs.rand()) * t + rs.rand() * 6) * np.minimum(1, t / 1.2)
            x += 2 * ((np.cumsum(f * 2 ** (d / 12) * vib) / SR + rs.rand()) % 1) - 1
    x = lp(hp(x, 120), bright, 2); x = x + bp(x, 2500, 4000) * 0.5
    return x / (len(notes) * 4) * amp * 8 * env(n, attack, release)
def cello_pulse(note, t0, t1, step=0.25, amp=0.05):
    """остинато низких струнных — для напряжения"""
    t = t0; k = 0
    while t < t1:
        x = strings([note], step * 0.95, amp * (1.0 if k % 4 == 0 else 0.7), bright=900, attack=0.02, release=0.08); music(t, x, 0); t += step; k += 1
def pluck(m, dur=2.5, amp=0.12, harp=False):
    n = int(dur * SR); t = tt(n); f = mtof(nm(m)); x = np.zeros(n)
    for k in range(1, 9):
        x += np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) / k ** (1.3 if harp else 1.1) * np.exp(-t * (1.4 + k * (1.2 if harp else 0.8)))
    return x * np.minimum(1, t / 0.004) * amp
def bell(m, dur=4.0, amp=0.07):
    n = int(dur * SR); t = tt(n); f = mtof(nm(m))
    return sum(np.sin(2 * np.pi * f * r * t) * g * np.exp(-t * d) for r, g, d in ((1, 1, 1.2), (2.76, .45, 2.5), (5.4, .25, 4), (8.93, .12, 6))) * np.minimum(1, t / 0.002) * amp
def drum(amp=0.35, f0=150, f1=55, decay=7):
    n = int(0.9 * SR); t = tt(n); f = f1 + (f0 - f1) * np.exp(-t * 25)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay) + lp(rs.randn(n), 2000) * np.exp(-t * 40) * 0.3) * amp
def taiko(amp=0.5):
    n = int(1.6 * SR); t = tt(n); f = 48 + 70 * np.exp(-t * 18)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2) + lp(rs.randn(n), 900) * np.exp(-t * 22) * 0.5) * amp
def boom(dur=3.0, amp=0.5, f0=70, f1=30):
    n = int(dur * SR); t = tt(n); f = f1 + (f0 - f1) * np.exp(-t * 3)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) + lp(rs.randn(n), 400) * np.exp(-t * 6) * 0.6) * amp
def subdrop(dur=2.5, amp=0.6):
    n = int(dur * SR); t = tt(n); f = 25 + 45 * np.exp(-t * 1.8); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.01, dur * 0.8) * amp
def riser(dur=3.0, amp=0.2):
    """нарастание перед ударом: шум с поднимающимся фильтром + тон"""
    n = int(dur * SR); w = rs.randn(n); out = np.zeros(n); seg = 2400
    for i in range(0, n, seg):
        k = i / n; fc = 300 * (12000 / 300) ** k; out[i:i + seg] = bp(w[i:i + seg], fc * 0.6, min(fc * 1.5, 22000))
    t = tt(n); tone = np.sin(2 * np.pi * np.cumsum(200 + 600 * (t / dur) ** 2) / SR) * 0.15
    return (out * 2 + tone) * (t / dur) ** 2 * amp
def swell(dur=3.0, amp=0.2):
    """обратная тарелка"""
    n = int(dur * SR); t = tt(n); x = hp(rs.randn(n), 4000) * (t / dur) ** 3; x[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR)); return x * amp
def noise(dur, kind='wind', amp=0.05, fade=2.0, seed=None):
    r = np.random.RandomState(seed) if seed is not None else rs
    n = int(dur * SR); w = r.randn(n); t = tt(n); ph = r.rand() * 6
    if kind == 'wind': x = bp(w, 180, 1100) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.11 * t + ph) * np.sin(2 * np.pi * 0.037 * t + ph * 2))
    elif kind == 'gust': x = bp(w, 300, 2400) * np.clip(np.sin(2 * np.pi * 0.07 * t + ph), 0, 1) ** 3
    elif kind == 'rain': x = hp(w, 2500) * 0.6 + bp(w, 400, 1500) * 0.4 + (r.rand(n) > 0.9993) * r.randn(n) * 3
    elif kind == 'sea': x = lp(w, 700) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.08 * t + ph) ** 2) + hp(w, 3000) * 0.15 * np.sin(2 * np.pi * 0.08 * t + ph) ** 8
    elif kind == 'lap': x = bp(w, 200, 1800) * np.clip(np.sin(2 * np.pi * 0.4 * t + ph), 0, 1) ** 6 + lp(w, 300) * 0.3
    elif kind == 'roar': x = lp(w, 350, 3) * 2.5 + bp(w, 600, 2500) * 0.3
    elif kind == 'fire': x = lp(w, 900) * 0.5 + hp((r.rand(n) > 0.9985) * r.randn(n) * 6, 1500)
    elif kind == 'rumble': x = lp(w, 120, 3) * 4
    elif kind == 'night': x = bp(w, 3500, 6000) * (0.3 + 0.7 * (np.sin(2 * np.pi * 9 * t + ph) > 0.6)) * (np.sin(2 * np.pi * 0.4 * t + ph) > 0) * 0.5 + lp(w, 300) * 0.3
    elif kind == 'room': x = lp(w, 250) * 0.6 + np.sin(2 * np.pi * 55 * t) * 0.05
    elif kind == 'desert': x = bp(w, 600, 3000) * 0.4 + lp(w, 200) * 0.6
    else: x = w
    return soft(norm(x)) * amp * env(n, fade, fade)
def bed(t, dur, kind, amp, fade=2.0):
    """атмосфера на 4 угла: каждый угол — свой шум (декорреляция = объём)"""
    x4 = np.stack([noise(dur, kind, amp, fade, seed=1000 + int(t * 10) * 7 + k) for k in range(4)]); ambience(t, x4)
def thunder(amp=0.5):
    n = int(5 * SR); t = tt(n); x = lp(rs.randn(n), 600, 3) * (np.exp(-t * 0.9) * (0.4 + 0.6 * (np.abs(np.sin(t * 13 + rs.rand() * 5)) ** 4)))
    x[:int(0.15 * SR)] += hp(rs.randn(int(0.15 * SR)), 1500) * np.exp(-tt(int(0.15 * SR)) * 30) * 0.8
    return x / np.abs(x).max() * amp
def whoosh(dur=2.0, amp=0.25, f0=300, f1=3000):
    n = int(dur * SR); w = rs.randn(n); out = np.zeros(n); seg = 2048
    for i in range(0, n, seg):
        fc = f0 * (f1 / f0) ** (i / n); out[i:i + seg] = bp(w[i:i + seg], fc * 0.7, min(fc * 1.4, 20000))
    return lp(out, 6000) * np.sin(np.pi * np.linspace(0, 1, n)) ** 2 * amp * 3
def click(amp=0.05):
    n = int(0.03 * SR); t = tt(n); return (hp(rs.randn(n), 2000) * np.exp(-t * 300) + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 200) * 0.3) * amp
def crackle(dur, amp=0.15):
    n = int(dur * SR); k = np.linspace(0.3, 1, n); imp = (rs.rand(n) > 1 - 0.004 * k) * rs.randn(n) * 4
    x = hp(imp, 800) + lp(rs.randn(n), 3000) * 0.3 * k; return x / (np.abs(x).max() + 1e-9) * amp * env(n, 0.2, 0.5)
def rubble(dur=3.0, amp=0.4):
    """обвал камней: много глухих ударов + шум"""
    n = int(dur * SR); x = lp(rs.randn(n), 500) * np.exp(-tt(n) * 1.2) * 0.4
    for _ in range(60):
        p = int(rs.rand() ** 1.5 * (n - SR * 0.4)); d = drum(0.3 * rs.rand(), 90 + rs.rand() * 120, 40, 12 + rs.rand() * 20); x[p:p + len(d)] += d[:n - p]
    return x * amp
def shofar(dur=1.6, amp=0.2, m='A3'):
    """рог-шофар: медная пила с подъёмом высоты и форматами"""
    n = int(dur * SR); t = tt(n); f = mtof(nm(m)) * (0.94 + 0.06 * np.minimum(1, t / 0.25)) * (1 + 0.006 * np.sin(2 * np.pi * 5 * t))
    x = 2 * ((np.cumsum(f) / SR) % 1) - 1; x = bp(x, 300, 1800) * 1.5 + bp(x, 2000, 3500) * 0.4
    return lp(x, 2500) * env(n, 0.12, 0.4) * amp
def bird(amp=0.04):
    n = int(rs.uniform(0.08, 0.25) * SR); t = tt(n); f0 = rs.uniform(2500, 5000); f = f0 * (1 + 0.25 * np.sin(2 * np.pi * rs.uniform(8, 30) * t)) * (1 + rs.uniform(-0.3, 0.3) * t / t[-1])
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / t[-1]) ** 2 * amp
def birds(t0, dur, rate=1.5, amp=0.03):
    k = 0; t = t0
    while t < t0 + dur:
        b = bird(amp); [sfx(t + j * len(b) / SR * 1.4, b, az=rs.uniform(-180, 180)) for j in range(rs.randint(1, 4))]; t += rs.exponential(1 / rate)
def bleat(amp=0.06):
    n = int(0.7 * SR); t = tt(n); f = 330 * (1 + 0.05 * np.sin(2 * np.pi * 7 * t))
    x = 2 * ((np.cumsum(f) / SR) % 1) - 1; x = bp(x, 400, 900) + bp(x, 1600, 2400) * 0.6
    return x * np.sin(np.pi * t / t[-1]) ** 0.7 * amp
def crowd(dur, amp=0.06, mood='murmur', seed=0):
    """гул толпы: сотни «слогов» из форматно отфильтрованного шума"""
    r = np.random.RandomState(seed); n = int(dur * SR); x = np.zeros(n)
    vowels = [(700, 1200), (400, 2000), (300, 900), (500, 1700)]
    for _ in range(int(dur * (40 if mood != 'cheer' else 70))):
        ln = int(r.uniform(0.08, 0.3) * SR); p = r.randint(0, max(1, n - ln)); f1, f2 = vowels[r.randint(4)]; k = r.uniform(0.8, 1.3)
        s = bp(r.randn(ln), f1 * k * 0.8, f1 * k * 1.2) + 0.5 * bp(r.randn(ln), f2 * k * 0.9, f2 * k * 1.1)
        x[p:p + ln] += s * np.sin(np.pi * np.arange(ln) / ln) * r.uniform(0.3, 1)
    if mood == 'cheer': x = x * 1.4 + hp(r.randn(n), 1500) * 0.15
    if mood == 'angry': x = lp(x, 1200) * 1.5 + lp(r.randn(n), 300) * 0.4
    return soft(norm(x)) * amp * env(n, 1.0, 1.0)
def steps(t0, dur, rate=1.8, amp=0.05, az=0, az1=None, surface='sand'):
    n = int(dur * rate)
    for k in range(n):
        ln = int(0.12 * SR); s = (bp(rs.randn(ln), 300, 2500) if surface == 'sand' else lp(rs.randn(ln), 900)) * np.exp(-tt(ln) * 35) * rs.uniform(0.6, 1)
        a = az if az1 is None else az + (az1 - az) * k / max(n - 1, 1); sfx(t0 + k / rate + rs.uniform(-0.03, 0.03), s, az=a, gain=amp * 10)
def heartbeat(t0, t1, bpm=56, amp=0.4):
    t = t0
    while t < t1:
        for d, g in ((0, 1), (0.28, 0.7)): x = boom(0.5, amp * g, 60, 35); boomsub(t + d, x, 1.0); sfx(t + d, x * 0.3, 0, center=0.5)
        t += 60 / bpm
def lion(amp=0.3):
    n = int(2.2 * SR); t = tt(n); f = 90 + 40 * np.sin(np.pi * t / t[-1])
    x = (2 * ((np.cumsum(f) / SR) % 1) - 1) * 0.5 + lp(rs.randn(n), 600) * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t))
    return lp(x, 1200) * np.sin(np.pi * t / t[-1]) ** 0.6 * amp
def whale(amp=0.08):
    n = int(4 * SR); t = tt(n); f = 180 + 120 * np.sin(np.pi * t / 4) + 40 * np.sin(2 * np.pi * 0.7 * t)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)) * np.sin(np.pi * t / t[-1]) ** 1.5 * amp
def creak(amp=0.08):
    n = int(rs.uniform(0.6, 1.4) * SR); t = tt(n); f = rs.uniform(80, 160) * (1 + 0.3 * t / t[-1]); x = ((np.cumsum(f) / SR) % 1 < 0.08).astype(float)
    return bp(x, 400, 2500) * np.sin(np.pi * t / t[-1]) * amp * 3
def tear(dur=3.0, amp=0.3):
    n = int(dur * SR); x = np.zeros(n); dens = np.linspace(0.002, 0.03, n)
    imp = (rs.rand(n) < dens) * rs.randn(n); x = bp(imp, 1500, 7000) * 3 + bp(rs.randn(n), 600, 3000) * np.linspace(0.1, 0.6, n)
    return x / np.abs(x).max() * amp * env(n, 0.05, 0.3)

# ---------- музыкальные помощники ----------
def chords(t0, seq, each, strings_too=False, **kw):
    for i, ch in enumerate(seq):
        music(t0 + i * each, pad(ch, each + 3.0, **kw))
        if strings_too: music(t0 + i * each, strings(ch[1:4], each + 2.0, amp=kw.get('amp', 0.06) * 0.6), pan=0)
def arp(t0, t1, notes, step=0.5, amp=0.08, inst='pluck', pan=0.3, harp=False):
    t = t0; i = 0
    while t < t1:
        x = pluck(notes[i % len(notes)], 3, amp, harp=harp) if inst == 'pluck' else bell(notes[i % len(notes)], 4, amp)
        music(t, x, pan * np.sin(i * 1.7)); t += step; i += 1
def hit(t, amp=0.5, sub=0.6):
    """кинематографичный удар: таико + саб + обратная тарелка перед ним"""
    music(t - 2.0, swell(2.0, 0.12)); x = taiko(amp); music(t, x * 0.6); sfx(t, x * 0.4, 0, center=0.3); boomsub(t, subdrop(2.5, sub))

Dm = ['D3', 'A3', 'D4', 'F4', 'A4']; Bb = ['A#2', 'F3', 'A#3', 'D4', 'F4']; F = ['F2', 'C3', 'F3', 'A3', 'C4']; C_ = ['C3', 'G3', 'C4', 'E4', 'G4']
Gm = ['G2', 'D3', 'G3', 'A#3', 'D4']; Am = ['A2', 'E3', 'A3', 'C4', 'E4']; D = ['D3', 'A3', 'D4', 'F#4', 'A4']; G = ['G2', 'D3', 'G3', 'B3', 'D4']
Dsus = ['D3', 'A3', 'D4', 'E4', 'A4']; Bm = ['B2', 'F#3', 'B3', 'D4', 'F#4']; A = ['A2', 'E3', 'A3', 'C#4', 'E4']; Em = ['E3', 'B3', 'E4', 'G4', 'B4']
Edim = ['C#3', 'G3', 'A#3', 'E4']; Fsus = ['F2', 'C3', 'F3', 'G3', 'C4']; Ebm = ['D#3', 'A#3', 'D#4', 'F#4']

# ======================= ПАРТИТУРА =======================
# INTRO — дрон, печатная машинка (синхронно с overlay.intro), титульный удар
put_lines = [(1.0, 'Одна книга.'), (3.4, '66 книг. 1 189 глав. 31 169 стихов.'), (7.4, 'Около сорока авторов. Пятнадцать веков.'),
             (11.6, 'Мы пройдём её целиком — от первой строки до последней.'), (15.6, 'Вот она — за пятнадцать минут.')]
music(0, pad(['D2', 'A2'], 26, bright=500, amp=0.07, attack=4, release=4)); bed(0, 20, 'room', 0.012)
for t0, s in put_lines:
    for i, ch in enumerate(s):
        if ch != ' ': sfx(t0 + i / 26 + 0.004 * rs.randn(), click(0.035 + 0.01 * rs.rand()), az=-25 + i / len(s) * 50, center=0.4)
for i, m in enumerate(['A4', 'F4', 'D5', 'E5', 'C5', 'A4']): music(2 + i * 3.1, pluck(m, 4, 0.045), 0.2 * (-1) ** i)
music(16.5, riser(3.0, 0.08)); hit(19.4, 0.55, 0.7)
music(19.3, pad(Dsus, 7.5, bright=2500, amp=0.07, attack=1.0, release=2.5, choir=True)); music(19.4, strings(['D3', 'A3', 'D4', 'F#4'], 7, 0.06, attack=0.8))
music(19.4, bell('D5', 5, 0.06), 0.2); music(19.4, bell('A5', 5, 0.04), -0.2)

# CREATION
s = 'creation'; Lc = cue(s, 'light')
music(T(s), pad(['D2', 'A2', 'D3'], Lc + 2.5, bright=300, amp=0.09, attack=3, release=2)); bed(T(s), Lc + 2.5, 'sea', 0.035); bed(T(s), Lc + 2, 'wind', 0.012)
music(T(s, 'light', -1.2), riser(3.2, 0.12)); hit(T(s, 'light', 2.0), 0.6, 0.9); sfx(T(s, 'light', 0.6), whoosh(1.6, 0.15, 200, 6000), -90, 90)
chords(T(s, 'light', 2.0), [D, G, Bm, A, D], 4.8, strings_too=True, bright=2200, amp=0.075)
music(T(s, 'light', 2.0), pad(D, 6, bright=4000, amp=0.05, attack=0.3, release=4, choir=True))
arp(T(s, 'days'), T(s, 'man'), ['D5', 'A4', 'F#5', 'E5', 'B4', 'A5'], 0.42, 0.045, 'bell')
bed(T(s, 'days'), end(s) - T(s, 'days'), 'sea', 0.03); birds(T(s, 'days', 3), 6, 1.2, 0.02); birds(T(s, 'man'), end(s) - T(s, 'man'), 0.6, 0.015)

# EDEN
s = 'eden'; h = cue(s, 'hide')
chords(T(s), [G, D, Em, C_], h / 4, strings_too=True, bright=1800, amp=0.065)
arp(T(s, None, 0.5), T(s, 'hide'), ['G4', 'B4', 'D5', 'G5', 'D5', 'B4'], 0.36, 0.05, harp=True)
bed(T(s), h + 1, 'night', 0.012); birds(T(s), h, 2.5, 0.03); bed(T(s), SC[s]['dur'], 'wind', 0.012)
sfx(T(s, 'fruit', 1.5), noise(2.0, 'wind', 0.05, 0.3), az=-60, az1=30)  # шёпот-шорох змея
sfx(T(s, 'fruit', 3.2), drum(0.15, 300, 120, 12), 10)
chords(T(s, 'hide'), [Em, Am, Em, ['B2', 'F#3', 'A3', 'D#4']], (end(s) - T(s, 'hide')) / 4, bright=700, amp=0.075)
bed(T(s, 'hide'), end(s) - T(s, 'hide'), 'wind', 0.035); sfx(T(s, 'where', 0.0), boom(3, 0.2, 50, 30), 0, sub=0.4)
sfx(T(s, 'sword'), noise(6, 'fire', 0.08, 0.5), az=20); sfx(T(s, 'sword', 0.2), whoosh(1.2, 0.2, 400, 2500), -40, 40); boomsub(T(s, 'sword'), subdrop(2.5, 0.5))
steps(T(s, 'sword', 1.5), 4, 1.6, 0.03, az=0, az1=-20)

# FLOOD
s = 'flood'; st, rb, bb = T(s, 'storm'), T(s, 'rainbow'), T(s, 'babel')
chords(T(s), [Dm, Bb], cue(s, 'storm') / 2, bright=500, amp=0.08); bed(T(s), cue(s, 'storm') + 1, 'wind', 0.04)
cello_pulse('D2', T(s, None, 2.0), st, 0.25, 0.035)
bed(st, rb - st + 1.5, 'rain', 0.08); bed(st, rb - st + 1.5, 'sea', 0.09); bed(st, rb - st, 'gust', 0.05)
chords(st, [Dm, Gm, Bb, A], (rb - st) / 4, strings_too=True, bright=900, amp=0.09)
for k in range(int((rb - st) / 0.75)): music(st + k * 0.75, drum(0.2 if k % 4 == 0 else 0.11, 110, 45));
for k in range(int((rb - st) / 1.5)): boomsub(st + k * 1.5, boom(1.2, 0.25, 60, 35))
for tt_, az in ((st + 1.2, -70), (st + 4.5, 140), (st + 7.0, 35)): sfx(tt_, thunder(0.5), az, sub=0.7)
for k in range(4): sfx(st + 1 + k * 1.9, creak(0.07), rs.uniform(-40, 40))
chords(rb, [F, C_, ['A#2', 'F3', 'A#3', 'D4', 'G4'], F], (bb - rb) / 4, strings_too=True, bright=2500, amp=0.07)
music(rb, pad(F, bb - rb, bright=3500, amp=0.04, attack=3, choir=True)); arp(rb + 1, bb, ['F5', 'C5', 'A4', 'G5', 'C5'], 0.55, 0.04, 'bell')
bed(rb, bb - rb, 'lap', 0.03); birds(rb + 3, bb - rb - 3, 0.8, 0.02)
chords(bb, [Am, ['A2', 'D#3', 'A3', 'C4']], (end(s) - bb) / 2, bright=1200, amp=0.07); bed(bb, end(s) - bb, 'desert', 0.03)
for k in range(8): music(bb + k * 0.45, drum(0.12 + k * 0.02, 140, 60))
sfx(bb + 3.8, crackle(3, 0.18), -20); sfx(bb + 4.0, whoosh(3, 0.3, 4000, 200), 0, 170); hit(bb + 4.0, 0.4, 0.5)
for k in range(10): sfx(bb + 4.2 + k * 0.15, crowd(0.8, 0.02, seed=k), az=rs.uniform(-180, 180))  # разноязыкий гомон разлетается

# ABRAHAM
s = 'abraham'; tr, eg = T(s, 'tribes'), T(s, 'egypt')
bed(T(s), eg - T(s), 'night', 0.025); sfx(T(s), noise(eg - T(s), 'fire', 0.03, 1.0), az=-15)
chords(T(s), [Dsus, Bb, F, C_], (tr - T(s)) / 4, bright=1500, amp=0.065)
arp(T(s, 'stars'), tr + 2, ['A5', 'D6', 'E6', 'A5', 'F#6', 'D6'], 0.3, 0.03, 'bell'); music(T(s, 'stars'), strings(['A4', 'D5', 'E5'], tr - T(s, 'stars') + 2, 0.035, bright=5000, attack=3))
chords(tr, [D, Bm, G, A], (eg - tr) / 4, strings_too=True, bright=2200, amp=0.07)
for k in range(12): music(tr + 1.0 + k * 0.6, bell(['D5', 'E5', 'F#5', 'A5', 'B5', 'D6'][k % 6], 3, 0.045), (k - 6) / 7)
chords(eg, [['E3', 'B3', 'E4', 'F4', 'B4'], Am, ['E3', 'G#3', 'B3', 'F4']], (end(s) - eg) / 3, bright=1400, amp=0.07)
arp(eg, end(s), ['E4', 'F4', 'G#4', 'B4', 'C5', 'B4', 'G#4', 'F4'], 0.3, 0.05, harp=True); bed(eg, end(s) - eg, 'desert', 0.03)
steps(eg + 1, end(s) - eg - 2, 1.4, 0.02, az=-50, az1=40)

# JOSEPH
s = 'joseph'
chords(T(s), [['E3', 'B3', 'E4', 'F4', 'B4'], Am, Dm, Am], cue(s, 'embrace') / 4, bright=1300, amp=0.065); bed(T(s), SC[s]['dur'], 'room', 0.02)
music(T(s, None, 0.5), strings(['E3', 'B3', 'F4'], cue(s, 'embrace'), 0.035, bright=1500, attack=3))
em = T(s, 'embrace'); chords(em, [F, C_, Dm, ['A#2', 'F3', 'A#3', 'D4', 'F4'], F], (end(s) - em) / 5 + 0.3, strings_too=True, bright=2600, amp=0.07)
music(em, strings(['F4', 'A4', 'C5', 'F5'], 8, 0.05, bright=4000, attack=2)); arp(T(s, 'good'), end(s), ['C5', 'F5', 'A5', 'G5', 'F5', 'C5'], 0.45, 0.035, 'bell')

# EXODUS
s = 'exodus'; c = SC[s]['cues']; pl, sh, pt = T(s, 'plagues'), T(s, 'shore'), T(s, 'part')
sfx(T(s, 'bush'), noise(c['plagues'] - c['bush'], 'fire', 0.08, 1.0), az=8, center=0.3); bed(T(s), c['plagues'], 'wind', 0.02)
chords(T(s), [Dm, ['D3', 'A3', 'D4', 'E4', 'A4'], Bb, Dm], c['plagues'] / 4, bright=1300, amp=0.07)
music(T(s, 'bush', 5.0), pad(Dm, 8, bright=3000, amp=0.045, choir=True)); boomsub(T(s, 'bush', 6.0), subdrop(3, 0.4))
chords(pl, [Dm, Gm, Edim, Dm], (sh - pl) / 4, bright=800, amp=0.08); cello_pulse('D2', pl, sh, 0.25, 0.045)
for k in range(int((sh - pl) / 0.5)): music(pl + k * 0.5, drum(0.16 if k % 2 == 0 else 0.08, 130, 50))
bed(pl, sh - pl, 'rumble', 0.035); sfx(pl + 3, noise(4, 'gust', 0.08), -120, 120)  # саранча/ветер через зал
bed(sh, pt - sh, 'sea', 0.06); bed(sh, pt - sh, 'gust', 0.04); sfx(sh + 0.5, crowd(pt - sh, 0.05, 'murmur', 3), 0, center=0.1)
for k in range(int((pt - sh) / 0.6)): sfx(sh + k * 0.6, drum(0.05, 200, 120, 15), az=170 + rs.uniform(-20, 20))  # колесницы позади зрителя
chords(sh, [Dm, Bb, Gm, A], (pt - sh) / 4 + 0.2, strings_too=True, bright=1200, amp=0.085); cello_pulse('D2', sh, pt, 0.1875, 0.05)
for k in range(int((pt - sh) / 0.375)): music(sh + k * 0.375, drum(0.08 + 0.15 * k / 14, 120, 50))
music(pt - 3.0, riser(3.0, 0.15)); hit(pt, 0.7, 1.0)
sfx(pt - 0.3, whoosh(4, 0.35, 150, 4000), 0, 0); sfx(pt, noise(end(s) - pt, 'roar', 0.12, 1.0), az=-90); sfx(pt, noise(end(s) - pt, 'roar', 0.12, 1.0), az=90)  # стены воды слева и справа
sfx(pt, noise(end(s) - pt, 'roar', 0.06, 1.0), az=-120); sfx(pt, noise(end(s) - pt, 'roar', 0.06, 1.0), az=120)
for k in range(int((end(s) - pt) / 1.2)): boomsub(pt + k * 1.2, boom(1.4, 0.18, 45, 28))
chords(pt, [D, G, D, A, D], (end(s) - pt) / 5 + 0.3, strings_too=True, bright=3000, amp=0.085)
music(pt, pad(D, end(s) - pt, bright=4500, amp=0.06, attack=1.5, choir=True)); steps(T(s, 'walk'), end(s) - T(s, 'walk') - 1, 2.2, 0.03, az=-10, az1=10)

# SINAI
s = 'sinai'; c = SC[s]['cues']; de = T(s, 'desert')
bed(T(s), c['desert'], 'rumble', 0.05); bed(T(s), c['desert'], 'wind', 0.03)
for tt_, az in ((T(s, None, 1.0), -40), (T(s, None, 4.5), 120), (T(s, None, 7.2), 20)): sfx(tt_, thunder(0.55), az, sub=0.8)
sfx(T(s, None, 2.2), shofar(2.4, 0.08, 'A3'), 0, center=0.2)  # «трубный звук весьма сильный»
chords(T(s), [Dm, ['D3', 'G3', 'A#3', 'D4'], Dm], c['kill'] / 3 + 0.5, bright=900, amp=0.08)
hit(T(s, 'kill'), 0.4, 0.5); hit(T(s, 'steal'), 0.4, 0.5)
chords(T(s, 'kill'), [Dsus, Dsus], (c['desert'] - c['kill']) / 2, bright=1200, amp=0.06)
chords(de, [Dm, F, C_], (end(s) - de) / 3, bright=1600, amp=0.07); bed(de, end(s) - de, 'desert', 0.04); sfx(de, noise(end(s) - de, 'fire', 0.06), az=0, center=0.2)

# JUDGES
s = 'judges'; c = SC[s]['cues']; je, cy = T(s, 'jericho'), T(s, 'cycle')
for k in range(3): sfx(je + 0.5 + k * 1.6, shofar(1.5, 0.12, ['A3', 'A3', 'D4'][k]), az=[-60, 60, 0][k])
music(je + 3.5, riser(1.5, 0.1)); hit(je + 5.0, 0.6, 0.9); sfx(je + 5.0, rubble(3.5, 0.5), -40); sfx(je + 5.3, rubble(3.0, 0.4), 60); sfx(je + 5.6, rubble(2.5, 0.3), 160)
bed(je + 5, 3, 'rumble', 0.08, 0.3); chords(je, [Dm, Dm], c['cycle'] / 2, bright=900, amp=0.06)
chords(cy, [Am, F, C_, G, Am, F, C_, G], (end(s) - cy) / 8, bright=1400, amp=0.065); bed(cy, end(s) - cy, 'wind', 0.02)
lw = SC[s]['lines'][2]; starts = [lw['words'][0]['s']] + [w['s'] for i, w in enumerate(lw['words'][1:], 1) if lw['words'][i - 1]['w'].endswith('.')]
ring = [-30, 30, 110, -110, -30, 30]
for k, s0 in enumerate(starts): music(T(s) + s0, bell(['A4', 'C5', 'E5', 'G5', 'A5', 'E5'][k % 6], 3, 0.06), (k - 2.5) / 3); sfx(T(s) + s0, bell(['A5', 'C6', 'E6', 'G6', 'A6', 'E6'][k % 6], 3, 0.02), ring[k % 6])  # звон обходит зал по кругу
for k in range(int((end(s) - cy) / 0.8)): music(cy + k * 0.8, drum(0.07, 160, 70))

# RUTH
s = 'ruth'; vw = T(s, 'vow'); fd = T(s, 'field')
chords(T(s), [Am, F, C_, G], cue(s, 'vow') / 4, bright=1500, amp=0.06); bed(T(s), SC[s]['dur'], 'desert', 0.02); steps(T(s, None, 0.5), cue(s, 'vow') - 1, 1.6, 0.02, az=-20, az1=20)
chords(vw, [F, C_, Dm, ['A#2', 'F3', 'A#3', 'D4', 'F4'], F, C_], (fd - vw) / 6, strings_too=True, bright=2200, amp=0.06)
music(vw, strings(['A4', 'C5', 'F5'], fd - vw, 0.035, bright=4500, attack=3))
chords(fd, [G, D, Em, C_, D], (end(s) - fd) / 5 + 0.3, bright=2400, amp=0.06); arp(fd, end(s), ['G4', 'B4', 'D5', 'B4'], 0.32, 0.04, harp=True)
birds(fd, end(s) - fd, 1.5, 0.025); bed(fd, end(s) - fd, 'wind', 0.02)

# KINGS
s = 'kings'; c = SC[s]['cues']; go, th, ha, te = T(s, 'goliath'), T(s, 'throw'), T(s, 'harp'), T(s, 'temple')
chords(T(s), [Dm, Bb, F], c['goliath'] / 3, bright=1400, amp=0.07); sfx(T(s), crowd(c['goliath'], 0.035, seed=5), 0)
for k in range(2): sfx(T(s, None, 1 + k * 2), shofar(1.4, 0.07, 'D4'), az=-40 + 80 * k)
chords(go, [Dm, Bb, C_, A], (th - go) / 4, strings_too=True, bright=1100, amp=0.085); cello_pulse('D2', go, th, 0.25, 0.05)
for k in range(int((th - go) / 0.5)): music(go + k * 0.5, drum(0.1 + 0.1 * (k % 4 == 0), 110, 45))
sfx(go + 1, crowd(th - go - 1, 0.04, 'angry', 6), az=-60); sfx(go + 1, crowd(th - go - 1, 0.04, 'angry', 7), az=60)
for k in range(5): steps(go + 2 + k * 1.2, 1, 1, 0.08, az=10, surface='ground'); boomsub(go + 2 + k * 1.2, boom(0.8, 0.3, 50, 30))  # тяжёлые шаги великана
sfx(th - 0.2, whoosh(1.0, 0.4, 400, 5000), -30, 30); hit(th + 0.7, 0.7, 1.0); sfx(th + 0.8, rubble(1.8, 0.35), 20)
sfx(th + 1.3, crowd(3, 0.07, 'cheer', 8), -110); sfx(th + 1.3, crowd(3, 0.07, 'cheer', 9), 110)
chords(ha, [D, Bm, G, A, D], (te - ha) / 5, bright=1500, amp=0.05)
arp(ha + 0.3, te, ['D4', 'F#4', 'A4', 'D5', 'A4', 'F#4', 'B3', 'D4', 'G4', 'B4', 'G4', 'D4'], 0.28, 0.06, harp=True)
bed(ha, te - ha, 'night', 0.025); [sfx(ha + 1 + k * 2.7, bleat(0.05), rs.uniform(-160, 160)) for k in range(int((te - ha) / 2.7))]
chords(te, [D, G, D], (end(s) - te) / 3 + 0.3, strings_too=True, bright=3200, amp=0.08); music(te, pad(D, end(s) - te, bright=4000, amp=0.05, choir=True))
for k in range(4): music(te + k * 1.8, bell(['D5', 'A5', 'F#5', 'D6'][k], 4, 0.05))

# ELIJAH
s = 'elijah'; c = SC[s]['cues']; al, fi, ch = T(s, 'altars'), T(s, 'fire'), T(s, 'chariot')
chords(T(s), [Dm, Gm, Dm, A], c['altars'] / 4, bright=1000, amp=0.07); bed(T(s), c['fire'], 'wind', 0.035)
sfx(T(s, None, 0.5), crowd(c['fire'] - 0.5, 0.045, 'murmur', 11), 0)
for k in range(int((fi - al) / 0.7)): sfx(al + k * 0.7, crowd(0.5, 0.03, 'cheer', 20 + k), az=rs.uniform(-60, 60))  # крики жрецов
for k in range(3): sfx(al + 6 + k * 1.3, noise(1.0, 'lap', 0.06, 0.1), az=15)  # вода на жертвенник
cello_pulse('D2', al, fi, 0.25, 0.04); music(fi - 3, riser(3, 0.15)); hit(fi, 0.8, 1.0)
sfx(fi - 0.4, whoosh(1.4, 0.4, 6000, 300), 0, 0); sfx(fi, noise(7, 'fire', 0.12, 0.3), -30); sfx(fi, noise(7, 'fire', 0.12, 0.3), 30); sfx(fi, noise(5, 'roar', 0.06), 0, center=0.2)
chords(fi, [D, G, A, D], (ch - fi) / 4, strings_too=True, bright=3000, amp=0.08); music(fi, pad(D, ch - fi, bright=4000, amp=0.05, choir=True))
sfx(fi + 3, crowd(4, 0.06, 'cheer', 30), -100); sfx(fi + 3, crowd(4, 0.06, 'cheer', 31), 100)
sfx(ch, noise(5, 'roar', 0.12, 1.0), az=0, az1=180, sub=0.4); sfx(ch, noise(5, 'fire', 0.1, 1.0), az=10, az1=170)  # колесница проносится над головой вперёд → назад
for k in range(10): sfx(ch + k * 0.25, drum(0.08, 260, 140, 18), az=-20 + k * 20)  # копыта
chords(ch, [Bm, G, D, A], (end(s) - ch) / 4 + 0.3, bright=2500, amp=0.07)

# WISDOM
s = 'wisdom'; c = SC[s]['cues']; jb, sm, ps, ec, sg = T(s, 'job'), T(s, 'storm'), T(s, 'psalms'), T(s, 'eccl'), T(s, 'song')
chords(T(s), [Dsus, Bb], c['job'] / 2, bright=1500, amp=0.055); arp(T(s), jb, ['D5', 'A4', 'E5', 'A4'], 0.6, 0.03, 'bell'); bed(T(s), c['job'], 'room', 0.015)
chords(jb, [Dm, Gm, Edim], (sm - jb) / 3, bright=800, amp=0.07); bed(jb, ps - jb, 'wind', 0.04); music(jb + 2, strings(['D3', 'F3', 'A3'], sm - jb, 0.04, bright=1200, attack=3))
music(sm - 2, riser(2, 0.1)); hit(sm, 0.55, 0.8); bed(sm, ps - sm, 'gust', 0.08)
for tt_, az in ((sm + 0.3, -100), (sm + 3.0, 60)): sfx(tt_, thunder(0.5), az, sub=0.7)
sfx(sm, noise(ps - sm, 'roar', 0.05), az=-90, az1=270)  # вихрь кружит по залу
chords(ps, [D, A, Bm, G], (ec - ps) / 4, strings_too=True, bright=2500, amp=0.065); arp(ps, ec, ['D4', 'F#4', 'A4', 'D5', 'F#5', 'D5', 'A4', 'F#4'], 0.25, 0.045, harp=True)
chords(ec, [Am, Em, Am, Em], (sg - ec) / 4, bright=900, amp=0.06); bed(ec, sg - ec, 'desert', 0.04)
for k in range(int((sg - ec) / 1.0)): sfx(ec + k, click(0.03), az=0, center=0.6)  # тиканье времени
chords(sg, [F, C_, Dm, ['A#2', 'F3', 'A#3', 'D4', 'F4']], (end(s) - sg) / 4 + 0.3, bright=2600, amp=0.06)
music(sg, strings(['A4', 'C5', 'F5'], end(s) - sg, 0.04, bright=4500, attack=1.5)); birds(sg, end(s) - sg, 1.2, 0.02)

# PROPHETS
s = 'prophets'; c = SC[s]['cues']
chords(T(s), [Dm, ['C#3', 'A3', 'E4']], c['prophets'] / 2, bright=900, amp=0.07); sfx(T(s, 'split', 1.0), rubble(2, 0.3), 0); boomsub(T(s, 'split', 1.0), subdrop(2, 0.5))
chords(T(s, 'prophets'), [Dm, Gm, Dm, A, Dm, Bb], (c['fire'] - c['prophets']) / 6, strings_too=True, bright=1100, amp=0.065); bed(T(s, 'prophets'), c['isaiah'] - c['prophets'], 'wind', 0.045)
music(T(s, 'isaiah'), pad(Dm, 9, bright=2500, amp=0.04, choir=True))
fi = T(s, 'fire'); bed(fi, c['bones'] - c['fire'], 'fire', 0.08); bed(fi, c['bones'] - c['fire'], 'rumble', 0.05); hit(fi + 0.5, 0.5, 0.7)
sfx(fi + 1, crowd(5, 0.04, 'angry', 40), az=-140); sfx(fi + 3, rubble(3, 0.3), 70)
chords(fi, [Dm, Bb, Gm, A], (c['bones'] - c['fire']) / 4, bright=700, amp=0.085)
for k in range(int((c['bones'] - c['fire']) / 0.6)): music(fi + k * 0.6, drum(0.12, 100, 40))
bo = T(s, 'bones'); chords(bo, [['D3', 'G#3', 'D4'], ['D3', 'A3', 'C4']], (c['alive'] - c['bones']) / 2, bright=600, amp=0.07); bed(bo, c['alive'] - c['bones'] + 1, 'wind', 0.035)
for k in range(12): sfx(bo + 2 + k * 0.35, click(0.05), az=rs.uniform(-150, 150))  # стук костей
al_ = T(s, 'alive'); sfx(al_ - 0.5, whoosh(4, 0.35, 200, 3000), az=-180, az1=180); music(al_ - 2, riser(2, 0.1)); hit(al_ + 0.5, 0.5, 0.7)
chords(al_, [D, G, A], (c['return'] - c['alive']) / 3, strings_too=True, bright=2500, amp=0.08); music(al_, pad(D, c['return'] - c['alive'] + 1, bright=4000, amp=0.055, attack=1.5, choir=True))
rt = T(s, 'return'); chords(rt, [Dsus, Bb], (end(s) - rt) / 2 + 1, bright=1200, amp=0.055); bed(rt, end(s) - rt, 'desert', 0.02)
for k in range(8): sfx(rt + 1 + k * 0.7, drum(0.04, 900, 600, 30), az=rs.uniform(-60, 60))  # стройка: стук молотков

# DANIEL
s = 'daniel'; c = SC[s]['cues']; jo, fu, li, an, es = T(s, 'jonah'), T(s, 'furnace'), T(s, 'lions'), T(s, 'angel'), T(s, 'esther')
chords(T(s), [Am, Em], c['jonah'] / 2, bright=1500, amp=0.055)
bed(jo, fu - jo, 'sea', 0.09); bed(jo, (fu - jo) * 0.6, 'gust', 0.05); bed(jo, (fu - jo) * 0.6, 'rain', 0.04)
for k in range(3): sfx(jo + 0.5 + k * 1.6, creak(0.08), rs.uniform(-60, 60))
sfx(jo + (fu - jo) * 0.55, whoosh(1.5, 0.3, 2000, 150), 0, 0); boomsub(jo + (fu - jo) * 0.6, subdrop(3, 0.5)); sfx(jo + (fu - jo) * 0.62, whale(0.08), -60, 60)
chords(jo, [Dm, Bb, Gm, A], (fu - jo) / 4, strings_too=True, bright=900, amp=0.075)
chords(fu, [Dm, Edim, Dm], (li - fu) / 3, bright=1100, amp=0.075); sfx(fu, noise(li - fu, 'roar', 0.09, 0.5), -40); sfx(fu, noise(li - fu, 'fire', 0.1, 0.5), 40); boomsub(fu, boom(3, 0.4))
music(fu + 3, pad(D, li - fu - 3, bright=3500, amp=0.04, choir=True))
chords(li, [Am, ['A2', 'D#3', 'A3', 'C4'], Am], (an - li) / 3, bright=700, amp=0.07); bed(li, an - li + 2, 'night', 0.02)
sfx(li + 1.5, lion(0.25), -110, sub=0.4); sfx(li + 3.5, lion(0.2), 120, sub=0.3)
music(an - 1, riser(1.5, 0.08)); chords(an, [D, A, D], (es - an) / 3 + 0.3, strings_too=True, bright=3500, amp=0.07); music(an, pad(D, es - an, bright=4500, amp=0.05, choir=True))
chords(es, [Gm, Dm, A, Dm], (end(s) - es) / 4 + 0.3, bright=1500, amp=0.065); bed(es, end(s) - es, 'room', 0.02)
steps(es + 0.5, 4, 1.4, 0.03, az=-40, az1=0, surface='ground'); music(es, strings(['D4', 'F4', 'A4'], end(s) - es, 0.035, attack=2))

# SILENCE — почти тишина: одна нота и «часы»
s = 'silence'; music(T(s), pad(['D3', 'A3'], SC[s]['dur'], bright=400, amp=0.04, attack=1, release=5)); bed(T(s), SC[s]['dur'], 'room', 0.008)
for k in range(4): sfx(T(s) + 1.5 + k * 1.8, click(0.02), 0, center=0.7)

# NATIVITY
s = 'nativity'; c = SC[s]['cues']; mg = T(s, 'manger')
chords(T(s), [Dsus, ['A#2', 'F3', 'A#3', 'D4', 'A4']], c['flesh'] / 2, bright=1500, amp=0.06)
arp(T(s, 'word'), mg, ['D6', 'A5', 'E6', 'A5', 'F#6', 'A5'], 0.5, 0.03, 'bell'); music(T(s, 'word'), strings(['D5', 'A5'], c['manger'], 0.03, bright=6000, attack=4))
bed(T(s, 'echo'), c['flesh'] - c['echo'], 'sea', 0.03); sfx(T(s, 'flesh'), whoosh(3, 0.15, 6000, 300), az=0, az1=0, center=0.5)
chords(mg, [D, G, D, A, D], (end(s) - mg) / 5 + 0.3, strings_too=True, bright=2000, amp=0.06)
arp(mg, end(s), ['D5', 'F#5', 'A5', 'D6', 'A5', 'F#5'], 0.45, 0.04, 'bell'); music(mg, pad(D, end(s) - mg, bright=3500, amp=0.04, choir=True))
bed(mg, end(s) - mg, 'night', 0.018); [sfx(mg + 2 + k * 3.1, bleat(0.03), rs.uniform(-150, 150)) for k in range(4)]

# MINISTRY
s = 'ministry'; c = SC[s]['cues']
chords(T(s), [D, A, Bm, G, D, A], c['tomb'] / 6, strings_too=True, bright=2000, amp=0.06); bed(T(s), c['water'], 'lap', 0.035); birds(T(s), c['water'], 1.0, 0.02)
arp(T(s, 'galilee'), T(s, 'tomb'), ['D4', 'A4', 'D5', 'E5', 'F#5', 'E5', 'D5', 'A4'], 0.32, 0.045)
bed(T(s, 'water'), c['blessed'] - c['water'], 'sea', 0.05); bed(T(s, 'water'), 6, 'gust', 0.03)
sfx(T(s, 'blessed', -1), crowd(c['tomb'] - c['blessed'] + 1, 0.03, 'murmur', 50), 0); bed(T(s, 'blessed'), c['tomb'] - c['blessed'], 'wind', 0.015)
tb = T(s, 'tomb'); chords(tb, [Bm, Em, Bm, ['F#2', 'C#3', 'F#3', 'A#3']], (c['lazarus'] - c['tomb']) / 4, bright=900, amp=0.06); bed(tb, c['lazarus'] - c['tomb'], 'wind', 0.02)
for k, m in enumerate(['B4', 'A4', 'F#4', 'E4']): music(T(s, 'wept') + k * 0.9, pluck(m, 3, 0.05))
la = T(s, 'lazarus'); sfx(la + 1.2, rubble(1.5, 0.2), 0); boomsub(la + 1.5, subdrop(2, 0.4)); chords(la, [D, A], 2.2, bright=3000, amp=0.07)
music(la, pad(D, 4.5, bright=4000, amp=0.05, attack=0.5, choir=True)); chords(la + 4.4, [Dm, Edim], (end(s) - la - 4.4) / 2, bright=600, amp=0.07)
sfx(la + 5, crowd(end(s) - la - 5, 0.035, 'angry', 51), az=-150); cello_pulse('D2', la + 4.4, end(s), 0.375, 0.03)

# PARABLES
s = 'parables'; c = SC[s]['cues']; fr, ru, emb = T(s, 'far'), T(s, 'run'), T(s, 'embrace')
chords(T(s), [G, Em, C_, D], c['far'] / 4, bright=2000, amp=0.055); arp(T(s), fr, ['G4', 'B4', 'D5', 'B4'], 0.4, 0.035, harp=True)
chords(fr, [Em, Am, Em, Bm, Em], (ru - fr) / 5, bright=900, amp=0.06); bed(fr, ru - fr, 'desert', 0.035); steps(fr + 4, ru - fr - 4, 1.2, 0.025, az=-30, az1=0)
chords(ru, [G, D, Em, C_], (emb - ru) / 4 + 0.2, strings_too=True, bright=2600, amp=0.07); steps(ru + 2, emb - ru - 1, 3.2, 0.04, az=40, az1=0)  # отец бежит
music(emb, strings(['G4', 'B4', 'D5', 'G5'], end(s) - emb, 0.055, bright=5000, attack=1.2)); chords(emb, [G, D, Em, C_, G], (end(s) - emb) / 5 + 0.3, bright=3000, amp=0.075)
music(emb, pad(G, end(s) - emb, bright=4000, amp=0.04, choir=True)); bed(emb, end(s) - emb, 'night', 0.012)
sfx(T(s, 'found', 2.0), crowd(4, 0.04, 'cheer', 60), az=-120, az1=-60)  # «и начали веселиться»

# CROSS
s = 'cross'; c = SC[s]['cues']; cr, su, gg, fn, ve = T(s, 'crowd'), T(s, 'supper'), T(s, 'golgotha'), T(s, 'finished'), T(s, 'veil')
chords(T(s), [D, G, A], c['crowd'] / 3, bright=2500, amp=0.06)
sfx(T(s, None, 0.5), crowd(c['crowd'] - 0.5, 0.06, 'cheer', 70), az=-110); sfx(T(s, None, 0.5), crowd(c['crowd'] - 0.5, 0.06, 'cheer', 71), az=110); sfx(T(s, None, 0.5), crowd(c['crowd'] - 0.5, 0.04, 'cheer', 72), az=0)
for k in range(int(c['crowd'] / 0.5)): music(T(s) + k * 0.5, drum(0.06, 220, 120, 14), 0.3)
steps(T(s, None, 1.0), c['crowd'] - 2, 1.5, 0.03, az=-20, az1=20, surface='ground')  # ослик
chords(cr, [Dm, ['D3', 'G#3', 'B3', 'F4']], (su - cr) / 2, bright=700, amp=0.08); sfx(cr, crowd(su - cr, 0.08, 'angry', 73), az=-60); sfx(cr, crowd(su - cr, 0.08, 'angry', 74), az=60); sfx(cr, crowd(su - cr, 0.05, 'angry', 75), az=180)
bed(cr, su - cr, 'fire', 0.03); cello_pulse('D2', cr, su, 0.25, 0.05)
for k in range(int((su - cr) / 0.5)): music(cr + k * 0.5, drum(0.12, 110, 45))
chords(su, [Dm, Bb, Gm, A], (gg - su) / 4, bright=900, amp=0.06); bed(su, gg - su, 'room', 0.025); sfx(su, noise(gg - su, 'fire', 0.015), az=0, center=0.2)
chords(gg, [Dm, Gm, Edim], (fn - gg) / 3, strings_too=True, bright=500, amp=0.08); bed(gg, fn - gg, 'wind', 0.06); heartbeat(gg, fn, 50, 0.35)
music(fn - 0.2, pad(['D2', 'A2'], 2, bright=200, amp=0.02)); sfx(fn + 1.6, thunder(0.65), 0, sub=1.0); hit(fn + 1.6, 0.6, 1.0)
sfx(ve + 0.3, tear(3.5, 0.35), az=0, center=0.5); bed(ve, end(s) - ve, 'rumble', 0.12, 0.5); boomsub(ve, boom(5, 0.6, 40, 22))
sfx(ve + 1, rubble(3, 0.3), -120); sfx(ve + 1.4, rubble(3, 0.3), 120); music(ve, pad(['D2', 'A2', 'D3'], end(s) - ve, bright=400, amp=0.08))

# RESURRECTION
s = 'resurrection'; c = SC[s]['cues']; ri = T(s, 'risen')
chords(T(s), [Dsus, Bm, G], c['risen'] / 3, bright=1200, amp=0.05); bed(T(s), c['risen'], 'night', 0.02); steps(T(s, 'dawn'), c['risen'] - c['dawn'] - 1, 1.3, 0.02, az=-40, az1=-10)
music(ri - 2.5, riser(2.5, 0.12)); sfx(ri - 0.3, whoosh(2.5, 0.2, 300, 6000), az=0, az1=180); hit(ri, 0.55, 0.8)
chords(ri, [D, A, Bm, G, D], (end(s) - ri) / 5 + 0.5, strings_too=True, bright=4000, amp=0.09)
music(ri, pad(D, end(s) - ri + 1, bright=5000, amp=0.07, attack=1.0, choir=True)); music(ri, strings(['D5', 'F#5', 'A5'], end(s) - ri + 1, 0.05, bright=6000, attack=1.5))
arp(ri, end(s) + 1, ['D5', 'A5', 'F#5', 'D6', 'A5', 'E6'], 0.25, 0.035, 'bell'); birds(ri + 2, end(s) - ri, 3.0, 0.03)
steps(T(s, 'go'), end(s) - T(s, 'go') - 1, 3.4, 0.03, az=-60, az1=60)

# CHURCH
s = 'church'; c = SC[s]['cues']; ub, pa, lo = T(s, 'unbabel'), T(s, 'paul'), T(s, 'love')
bed(T(s), c['fire'] + 1, 'room', 0.02); sfx(T(s, 'fire'), noise(4.5, 'roar', 0.09, 1.0), az=0, az1=720, sub=0.3)  # «шум с неба» — два круга по залу
sfx(T(s, 'fire'), noise(4.5, 'gust', 0.1, 1.0), az=180, az1=900); sfx(T(s, 'fire', 2.0), noise(6, 'fire', 0.05), az=0, center=0.3)
chords(T(s), [D, G, D, A], c['unbabel'] / 4, strings_too=True, bright=2500, amp=0.07)
chords(ub, [G, D, A, D], (pa - ub) / 4, bright=3000, amp=0.07); arp(ub, pa, ['D5', 'G5', 'A5', 'B5', 'D6', 'B5', 'A5', 'G5'], 0.18, 0.03, 'bell')
for k in range(8): sfx(ub + k * 0.6, crowd(1.2, 0.02, seed=90 + k), az=rs.uniform(-180, 180) * (1 - k / 8))  # языки сходятся к центру
chords(pa, [D, Bm, G, A, D, Bm], (lo - pa) / 6, bright=2000, amp=0.065); bed(pa, lo - pa, 'sea', 0.03)
for k in range(int((lo - pa) / 0.5)): music(pa + k * 0.5, drum(0.07, 180, 90, 10))
arp(pa, lo, ['D4', 'A4', 'F#4', 'A4'], 0.25, 0.04); [sfx(pa + 2 + k * 3, creak(0.04), rs.uniform(-90, 90)) for k in range(3)]
chords(lo, [G, D, A, D], (end(s) - lo) / 4 + 0.3, bright=1600, amp=0.06); music(lo, pad(D, end(s) - lo, bright=3000, amp=0.035, choir=True)); bed(lo, end(s) - lo, 'room', 0.015)

# REVELATION
s = 'revelation'; c = SC[s]['cues']; nw, te_, trr, aln = T(s, 'new'), T(s, 'tears'), T(s, 'tree'), T(s, 'allnew')
chords(T(s), [Dm, ['D3', 'A3', 'D4', 'E4']], c['new'] / 2, bright=800, amp=0.07); bed(T(s), c['new'], 'sea', 0.06); bed(T(s), c['new'], 'wind', 0.035)
chords(nw, [Dm, Bb, Gm, A], (te_ - nw) / 4, strings_too=True, bright=1000, amp=0.09); cello_pulse('D2', nw, te_ - 1, 0.1875, 0.05)
for k in range(7): music(nw + k * 0.95, taiko(0.3)); boomsub(nw + k * 0.95, subdrop(1.0, 0.35)); sfx(nw + k * 0.95, shofar(0.8, 0.04, 'D4'), az=[-30, 30, 110, -110, -30, 30, 0][k])  # семь труб по залу
for tt_, az in ((nw + 1.0, -120), (nw + 4.2, 60)): sfx(tt_, thunder(0.5), az, sub=0.8)
music(te_ - 2, riser(2, 0.1)); chords(te_, [D, G, D, A], (trr - te_) / 4, strings_too=True, bright=3500, amp=0.07); music(te_, pad(D, trr - te_, bright=4500, amp=0.05, choir=True))
chords(trr, [G, D, Bm, A, G, D], (end(s) - trr) / 6 + 0.3, strings_too=True, bright=3000, amp=0.075)
arp(trr, end(s), ['D5', 'A5', 'F#5', 'D6', 'B5', 'A5', 'F#5', 'E5'], 0.35, 0.04, 'bell'); bed(trr, end(s) - trr, 'lap', 0.025); birds(trr, end(s) - trr, 1.5, 0.025)
music(aln, pad(D, end(s) - aln + 2, bright=5000, amp=0.06, choir=True)); hit(aln, 0.35, 0.5)

# OUTRO — тихая тема и финальный аккорд
s = 'outro'; c = SC[s]['cues']; am = T(s, 'amen')
chords(T(s), [D, Bm, G, A, D, Bm, G, A], c['amen'] / 8, bright=1500, amp=0.05); bed(T(s), SC[s]['dur'], 'room', 0.008)
theme = ['F#5', 'E5', 'D5', 'A4', 'B4', 'D5', 'E5', 'A4', 'G4', 'F#4', 'E4', 'D4']
for k, m in enumerate(theme): music(T(s) + 1.0 + k * (c['amen'] - 2) / len(theme), pluck(m, 4, 0.055), 0.15)
music(am, pad(D, end(s) - am + 1, bright=3000, amp=0.07, attack=2, release=8)); music(am, pad(D, end(s) - am, bright=4500, amp=0.05, attack=2.5, release=8, choir=True))
music(am, strings(['D4', 'F#4', 'A4', 'D5'], end(s) - am, 0.05, attack=2.5, release=8)); boomsub(am, subdrop(4, 0.3))
for k, m in enumerate(['D5', 'A5', 'F#5']): music(am + k * 0.3, bell(m, 6, 0.05 - k * 0.008), (k - 1) * 0.4)

# ======================= ГОЛОС =======================
def read_wav(p):
    with wave.open(p) as w: return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
for sc in TL['scenes']:
    for l in sc['lines']:
        x = read_wav(l['wav']); i, a, m = _span(sc['start'] + l['at'], len(x))
        (quo if l['v'] == 'q' else dia)[i:i + m] += x[a:a + m] * (0.92 if l['v'] == 'q' else 1.0)

# ======================= СВЕДЕНИЕ =======================
print('reverbs...', flush=True)
def ir(sec, seed, lpf=5000, pre=0.0):
    r = np.random.RandomState(seed); n = int(sec * SR); t = tt(n)
    x = r.randn(n) * np.exp(-t * 6.9 / sec) * np.minimum(1, t / 0.01); x = lp(x, lpf); x = np.concatenate([np.zeros(int(pre * SR)), x])
    return x / np.sqrt((x ** 2).sum())
def conv(x, h): return fftconvolve(x, h)[:N].astype(np.float32)
hall = [ir(3.2, s_) for s_ in (11, 12, 13, 14)]             # музыкальный зал
cath = [ir(4.5, s_, 4000, 0.03) for s_ in (21, 22, 23, 24)]  # «собор» для цитат
room = [ir(1.1, s_, 6000) for s_ in (31, 32, 33, 34)]        # отражения эффектов

out = np.zeros((6, N), np.float32)
# музыка: фронт L/R + центр чуть-чуть, тылы — реверберация (зал «обнимает»)
msum = (mus[0] + mus[1]) * 0.5
out[L] += mus[0] * 0.8; out[R] += mus[1] * 0.8; out[C] += msum * 0.12
wetL, wetR, wetSL, wetSR = conv(mus[0], hall[0]), conv(mus[1], hall[1]), conv(msum, hall[2]), conv(msum, hall[3])
out[L] += wetL * 0.35; out[R] += wetR * 0.35; out[LS] += wetSL * 0.45 + np.roll(mus[0], int(0.018 * SR)) * 0.18; out[RS] += wetSR * 0.45 + np.roll(mus[1], int(0.021 * SR)) * 0.18
lfe += lp(msum, 90, 4).astype(np.float32) * 0.35
# атмосферы
for k, ch in enumerate(RING_CH): out[ch] += amb[k]
# эффекты + их отражения
fxsum = fx[L] + fx[R] + fx[LS] + fx[RS] + fx[C]
for k, ch in enumerate(RING_CH): out[ch] += fx[ch] + conv(fxsum, room[k]) * 0.12
out[C] += fx[C]
# дакинг музыки и атмосфер под голос (центр остаётся чистым)
speech = dia + quo
envv = np.convolve(np.abs(speech), np.ones(2400) / 2400, 'same')
att = np.zeros_like(envv); v = 0.0; step = 480; dn = np.exp(-step / (0.7 * SR))
for i in range(0, N, step): x = envv[i]; v = x if x > v else v * dn; att[i:i + step] = v
LOOK = int(0.15 * SR)  # упреждение: фон уходит до первого слога
dk = np.clip(np.concatenate([att[LOOK:], np.zeros(LOOK)]) / DUCK_SENS, 0, 1)
dk = np.maximum(dk, np.clip(att / DUCK_SENS, 0, 1)).astype(np.float32)
duck = (1 - DUCK_DEPTH * dk).astype(np.float32)
for ch in (L, R, C, LS, RS):
    out[ch] *= duck
    out[ch] -= bp(out[ch], 800, 4000).astype(np.float32) * (DIP * dk)  # «вырез» в полосе речи только под голосом
out[[L, R, C, LS, RS]] *= BG_GAIN
bg = out.copy()  # всё, кроме голоса — для проверки разборчивости
# голос: рассказчик — центр (+лёгкий фантом в L/R для «тела»); цитаты — центр + собор по всему залу
out[C] += dia * 1.0; out[L] += dia * 0.08; out[R] += dia * 0.08
out[C] += quo * 0.95; out[L] += quo * 0.22; out[R] += quo * 0.22
for k, ch in enumerate(RING_CH): out[ch] += conv(quo, cath[k]) * (0.28 if ch in (LS, RS) else 0.2)
out[LFE] = lfe * duck * 0.9; bg[LFE] = out[LFE]
# ---------- разборчивость: голос vs фон по каждой реплике (в стерео-даунмиксе) ----------
def dmx(o): return 0.5 * ((o[L] + 0.707 * o[C] + 0.707 * o[LS]) + (o[R] + 0.707 * o[C] + 0.707 * o[RS]))
vb, bb = dmx(out) - dmx(bg), dmx(bg)
def band(x): return bp(x, 300, 4000)  # полоса разборчивости речи
vb_, bb_ = band(vb), band(bb)
rep = []
for sc in TL['scenes']:
    for l in sc['lines']:
        a, b = int((sc['start'] + l['start']) * SR), int((sc['start'] + l['end']) * SR)
        sv, sb = vb_[a:b], bb_[a:b]; m = np.abs(sv) > 0.005
        if m.sum() < SR * 0.2: continue
        snr = 10 * np.log10(np.mean(sv[m] ** 2) / (np.mean(sb[m] ** 2) + 1e-12))
        rep.append((snr, sc['id'], l['t'][:50]))
rep.sort(); snrs = np.array([r[0] for r in rep])
print(f'SNR голос/фон, дБ: медиана {np.median(snrs):.1f}, мин {snrs.min():.1f}, реплик < 10 дБ: {(snrs < 10).sum()} из {len(snrs)}')
for r in rep[:6]: print(f'  {r[0]:5.1f} дБ  {r[1]:12s} {r[2]}')
if os.environ.get('SNR_ONLY'): sys.exit(0)
del bg, vb, bb, vb_, bb_, mus, amb, fx, dia, quo, wetL, wetR, wetSL, wetSR, speech, envv, att
import gc; gc.collect()
for ch in range(6): out[ch] = hp(out[ch], 20 if ch == LFE else 30).astype(np.float32)

# ---------- мастеринг ----------
def limiter(x, ceil=0.93):
    """просмотровый лимитер с быстрой атакой и плавным отпусканием по общему пику всех каналов"""
    pk = np.abs(x).max(axis=0); g = np.minimum(1, ceil / np.maximum(pk, 1e-9))
    w = int(0.004 * SR); gmin = -np.convolve(np.pad(-g, (w, w), mode='edge'), np.ones(2 * w + 1) / (2 * w + 1), 'valid')
    gmin = np.minimum(g, gmin); rel = np.exp(-1 / (0.15 * SR)); sm = np.empty_like(gmin); v = 1.0
    blk = 64
    for i in range(0, len(gmin), blk):
        tgt = gmin[i:i + blk].min(); v = tgt if tgt < v else 1 - (1 - v) * rel ** blk; sm[i:i + blk] = min(v, tgt) if tgt < v else v
    return x * sm[None, :]
meter = pyln.Meter(SR)
# 5.1: −20 LUFS (кинотеатральный диапазон, громкие удары остаются громкими)
o51 = out; out = None
lufs = meter.integrated_loudness(np.stack([o51[L], o51[R], o51[C], o51[LS], o51[RS]]).T)
# стерео: ITU даунмикс + «ширина» тылов, −15 LUFS для телефона/наушников (считаем до лимитера 5.1)
st = np.stack([o51[L] + 0.707 * o51[C] + 0.707 * o51[LS] - 0.09 * o51[RS] + 0.45 * o51[LFE],
               o51[R] + 0.707 * o51[C] + 0.707 * o51[RS] - 0.09 * o51[LS] + 0.45 * o51[LFE]]).astype(np.float32)
lufs2 = meter.integrated_loudness(st.T); st *= 10 ** ((-15 - lufs2) / 20); st = limiter(st, 0.9).astype(np.float32)
o51 *= 10 ** ((-20 - lufs) / 20); o51 = limiter(o51, 0.93).astype(np.float32)
print('5.1 LUFS', round(meter.integrated_loudness(np.stack([o51[L], o51[R], o51[C], o51[LS], o51[RS]]).T), 1), 'peak', round(float(np.abs(o51).max()), 3))
print('stereo LUFS', round(meter.integrated_loudness(st.T), 1), 'peak', round(float(np.abs(st).max()), 3))
def write(path, x):
    y = (np.clip(x, -1, 1).T * 32767).astype(np.int16)
    with wave.open(path, 'w') as w: w.setnchannels(x.shape[0]); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes())
write('audio/mix51.wav', o51); write('audio/mix.wav', st)
print('wrote audio/mix51.wav + audio/mix.wav', N / SR, 's')
