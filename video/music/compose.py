"""Синтезирует трек клипа «Журнал обучения» и разметку для визуала.

Всё детерминировано: одинаковый запуск даёт тот же WAV и тот же JSON.
    python compose.py  ->  ../public/track.wav, ../public/track.json

Структура (такты по 4/4, 124 BPM, ля минор, аккорды Am–F–Dm–E):
    0–8   intro   пэд + «плоттерный» арпеджио
    8–16  build   бочка, бас, райзер, провал перед дропом
    16–32 drop1   всё + главный мотив
    32–40 break   без бочки, мотив в половинном темпе
    40–48 drop2   всё + мотив октавой выше
    48–50 outro   финальный аккорд и хвост ревербера
"""

import json
import os

import numpy as np
from scipy.signal import butter, sosfilt, lfilter, fftconvolve

SR = 44100
BPM = 124.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
STEP = BEAT / 4  # шестнадцатая
BARS = 50
TAIL = 3.0
N = int((BARS * BAR + TAIL) * SR)
rng = np.random.default_rng(1729)

OUT = os.path.join(os.path.dirname(__file__), "..", "public")

SECTIONS = [
    ("intro", 0, 8),
    ("build", 8, 16),
    ("drop1", 16, 32),
    ("break", 32, 40),
    ("drop2", 40, 48),
    ("outro", 48, 50),
]


def section_of(bar):
    for name, a, b in SECTIONS:
        if a <= bar < b:
            return name
    return "outro"


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


# Аккорды: корень баса и голоса пэда (MIDI)
CHORDS = [
    dict(name="Am", root=45, pad=[57, 60, 64, 69], arp=[69, 72, 76, 81]),
    dict(name="F", root=41, pad=[57, 60, 65, 69], arp=[69, 72, 77, 81]),
    dict(name="Dm", root=38, pad=[57, 62, 65, 69], arp=[69, 74, 77, 81]),
    dict(name="E", root=40, pad=[56, 59, 64, 68], arp=[68, 71, 76, 80]),
]


def chord_at(bar):
    return CHORDS[bar % 4]


# Главный мотив: (шаг-шестнадцатая от начала 2 тактов, длительность в шагах, MIDI)
HOOK = [
    # такт 1 (Am)
    (0, 2, 76), (3, 1, 72), (4, 2, 74), (6, 2, 76), (10, 2, 69), (13, 3, 72),
    # такт 2 (F)
    (16, 2, 77), (18, 2, 76), (20, 2, 72), (24, 2, 69), (27, 1, 72), (28, 4, 74),
]
HOOK_B = [
    # такт 3 (Dm)
    (0, 2, 74), (3, 1, 77), (4, 2, 76), (6, 2, 74), (8, 2, 72), (10, 4, 69),
    # такт 4 (E)
    (16, 3, 71), (19, 1, 68), (20, 2, 64), (24, 2, 71), (27, 1, 72), (28, 4, 71),
]

# ----------------------------------------------------------------------------
# Дорожки и события (события уходят в JSON для визуала)
# ----------------------------------------------------------------------------

tracks = {k: np.zeros(N) for k in ["kick", "clap", "hat", "bass", "pad", "arp", "lead", "fx"]}
events = {k: [] for k in ["kick", "clap", "hat", "bass", "arp", "lead", "impact", "token"]}


def place(track, sig, t, gain=1.0):
    i = int(round(t * SR))
    if i >= N:
        return
    j = min(N, i + len(sig))
    tracks[track][i:j] += sig[: j - i] * gain


def env_adsr(n, a, d, s, r, sr=SR):
    a_n, d_n, r_n = int(a * sr), int(d * sr), int(r * sr)
    hold = max(0, n - a_n - d_n)
    e = np.concatenate([
        np.linspace(0, 1, a_n, endpoint=False) if a_n else np.zeros(0),
        np.linspace(1, s, d_n, endpoint=False) if d_n else np.zeros(0),
        np.full(hold, s),
    ])[:n]
    rel = s * np.exp(-np.arange(r_n) / (r * sr / 5)) if r_n else np.zeros(0)
    return np.concatenate([e, rel])


def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    x = (f * t + phase) % 1.0
    return 2 * x - 1


def lp(x, fc, order=2):
    fc = min(fc, SR * 0.45)
    return sosfilt(butter(order, fc, "low", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def lp_sweep(x, f0, f1, order=2, chunk=512):
    """Фильтр с плавно меняющейся частотой среза (экспоненциально)."""
    out = np.zeros_like(x)
    zi = None
    nch = (len(x) + chunk - 1) // chunk
    for c in range(nch):
        fc = f0 * (f1 / f0) ** (c / max(1, nch - 1))
        sos = butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        seg = x[c * chunk:(c + 1) * chunk]
        out[c * chunk:(c + 1) * chunk], zi = sosfilt(sos, seg, zi=zi)
    return out


# --- бочка ---------------------------------------------------------------------
def kick_sig():
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 6.5)
    click = hp(rng.standard_normal(n), 2500) * np.exp(-t * 400) * 0.35
    return np.tanh((body + click) * 1.6)


KICK = kick_sig()


def clap_sig():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 900, 5200)
    e = np.zeros(n)
    for k, off in enumerate([0.0, 0.011, 0.022]):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: n - i]) * 180) * (0.8 if k < 2 else 1.0)
    e += np.exp(-t * 14) * 0.35
    return noise * e * 0.9


CLAP = clap_sig()


def hat_sig(open_=False):
    n = int((0.35 if open_ else 0.07) * SR)
    t = np.arange(n) / SR
    # металл: сумма квадратных волн + шум, как у драм-машин
    freqs = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]
    m = sum(np.sign(np.sin(2 * np.pi * f * 8.1 * t)) for f in freqs) / len(freqs)
    x = hp(m * 0.6 + rng.standard_normal(n) * 0.5, 7000)
    return x * np.exp(-t * (9 if open_ else 70)) * 0.5


HAT_C, HAT_O = hat_sig(False), hat_sig(True)


def bass_note(midi, dur, cutoff=600, drive=1.3):
    n = int((dur + 0.08) * SR)
    f = hz(midi)
    x = saw(f, n) * 0.6 + np.sin(2 * np.pi * f * np.arange(n) / SR) * 0.8
    t = np.arange(n) / SR
    fenv_hi = lp(x, cutoff * 2.5)
    fenv_lo = lp(x, cutoff * 0.6)
    k = np.exp(-t * 18)
    y = fenv_hi * k + fenv_lo * (1 - k)
    e = env_adsr(int(dur * SR), 0.004, 0.1, 0.8, 0.06)
    y = y[: len(e)] * e
    return np.tanh(y * drive) * 0.55


def pad_chord(notes, dur, bright=1800):
    n = int((dur + 1.2) * SR)
    y = np.zeros(n)
    for m in notes:
        for d in (-0.11, -0.04, 0.0, 0.05, 0.12):
            y += saw(hz(m) * 2 ** (d / 12), n, phase=rng.random())
    y = lp(y / (len(notes) * 5), bright, order=2)
    e = env_adsr(int(dur * SR), 0.35, 0.4, 0.8, 1.2)
    return y[: len(e)] * e * 0.9


def pluck(midi, cutoff, dur=STEP * 1.6):
    n = int((dur + 0.15) * SR)
    t = np.arange(n) / SR
    x = saw(hz(midi), n) * 0.7 + saw(hz(midi) * 1.004, n) * 0.5
    bright = lp(x, cutoff)
    dark = lp(x, cutoff * 0.25)
    k = np.exp(-t * 30)
    y = (bright * k + dark * (1 - k)) * np.exp(-t * 9)
    return y * 0.45


def lead_note(midi, dur, bright=3200):
    n = int((dur + 0.25) * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.15) * 4, 0, 1)
    f = hz(midi) * vib
    ph = np.cumsum(f) / SR
    sq = np.sign(np.sin(2 * np.pi * ph)) * 0.5
    sw = 2 * ((ph * 1.003) % 1.0) - 1
    y = lp(sq + sw * 0.6, bright)
    e = env_adsr(int(dur * SR), 0.01, 0.12, 0.7, 0.2)
    return y[: len(e)] * e * 0.32


def riser(dur):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    y = lp_sweep(x, 250, 9000, order=2)
    t = np.linspace(0, 1, n)
    return y * t ** 2 * 0.45


def impact():
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t * 8)) / SR) * np.exp(-t * 2.2)
    crash = hp(rng.standard_normal(n), 3000) * np.exp(-t * 2.8) * 0.35
    return (boom * 0.9 + crash) * 0.8


# ----------------------------------------------------------------------------
# Аранжировка
# ----------------------------------------------------------------------------

def t_of(bar, step=0):
    return bar * BAR + step * STEP


drop_bars = list(range(16, 32)) + list(range(40, 48))

for bar in range(BARS):
    sec = section_of(bar)
    ch = chord_at(bar)

    # пэд
    if bar < 48:
        bright = {"intro": 900 + bar * 120, "build": 1600, "drop1": 2200, "break": 2800, "drop2": 2400}[sec]
        pad_gain = {"intro": 1.6, "build": 0.9, "break": 1.0}.get(sec, 0.55)
        place("pad", pad_chord(ch["pad"], BAR, bright), t_of(bar), pad_gain)
    elif bar == 48:
        place("pad", pad_chord(CHORDS[0]["pad"] + [45 + 12], BAR * 2, 2000), t_of(bar), 0.8)

    # арпеджио: 16-е по нотам аккорда
    if 2 <= bar < 48:
        pattern = [0, 1, 2, 3, 2, 1, 3, 2]
        for s in range(16):
            if sec == "intro" and bar < 4 and s % 2:
                continue
            prog = (bar - 2) / 14 if bar < 16 else 1.0
            cutoff = 350 * (4500 / 350) ** min(1, prog)
            if sec == "break":
                cutoff = 1200 + 2800 * ((bar - 32) / 8)
            midi = ch["arp"][pattern[s % 8]] + (12 if (sec == "drop2" and s % 4 == 3) else 0)
            g = {"drop1": 0.5, "drop2": 0.5, "intro": 1.3}.get(sec, 0.8)
            place("arp", pluck(midi, cutoff), t_of(bar, s), g)
            events["arp"].append(t_of(bar, s))

    # бочка
    kick_on = (8 <= bar < 16 and not (bar == 15)) or bar in drop_bars or bar in (38, 39)
    if kick_on:
        for b in range(4):
            if bar in (38, 39) and b % 2:
                continue
            place("kick", KICK, t_of(bar, b * 4), 1.0)
            events["kick"].append(t_of(bar, b * 4))
    if bar == 15:  # два удара и провал перед дропом
        for s in (0, 4, 8):
            place("kick", KICK, t_of(bar, s), 1.0)
            events["kick"].append(t_of(bar, s))

    # хлопок / снейр-ролл
    if bar in drop_bars:
        for b in (1, 3):
            place("clap", CLAP, t_of(bar, b * 4), 0.9)
            events["clap"].append(t_of(bar, b * 4))
    if bar in (14, 15, 38, 39):
        dens = 2 if bar in (14, 38) else 1
        for s in range(0, 16 if bar not in (15, 39) else 12, dens):
            vel = 0.25 + 0.6 * ((bar % 2) * 16 + s) / 32
            place("clap", CLAP * 0.8, t_of(bar, s), vel)
            events["clap"].append(t_of(bar, s))

    # хэты
    if 4 <= bar < 48 and sec != "break":
        for s in range(16):
            dense = sec in ("drop1", "drop2")
            if not dense and s % 2:
                continue
            if dense and s % 4 == 2:
                place("hat", HAT_O, t_of(bar, s), 0.55)
            else:
                place("hat", HAT_C, t_of(bar, s), 0.5 if s % 4 == 0 else 0.33)
            events["hat"].append(t_of(bar, s))

    # бас
    if 8 <= bar < 48:
        r = ch["root"]
        if sec == "build":
            for b in range(4):
                if bar == 15 and b == 3:
                    continue
                place("bass", bass_note(r + 12, STEP * 2, 500), t_of(bar, b * 4 + 2), 0.9)
                events["bass"].append(t_of(bar, b * 4 + 2))
        elif sec in ("drop1", "drop2"):
            line = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 10, 12, 7, 12]
            for s in range(16):
                if s % 4 == 0:
                    continue  # место под бочку
                place("bass", bass_note(r + 12 + line[s], STEP * 0.9, 900 if sec == "drop1" else 1300), t_of(bar, s), 0.85)
                events["bass"].append(t_of(bar, s))
        elif sec == "break":
            place("bass", bass_note(r, BAR * 0.95, 250, 1.0), t_of(bar), 0.7)
            events["bass"].append(t_of(bar))

    # мотив
    if sec in ("drop1", "drop2") or sec == "break":
        phrase = HOOK if (bar % 4) < 2 else HOOK_B
        local = (bar % 2) * 16
        for st, ln, m in phrase:
            if local <= st < local + 16:
                if sec == "break":
                    if st % 4:  # половинный темп: только сильные доли
                        continue
                    place("lead", lead_note(m - 12, ln * STEP * 2, 1800), t_of(bar, st - local), 0.8)
                else:
                    place("lead", lead_note(m, ln * STEP, 3200 if sec == "drop1" else 4200), t_of(bar, st - local), 1.0)
                    if sec == "drop2":
                        place("lead", lead_note(m + 12, ln * STEP, 5000), t_of(bar, st - local), 0.35)
                events["lead"].append([t_of(bar, st - local), ln * STEP, m])

# райзеры и удары
place("fx", riser(BAR * 4), t_of(12), 1.0)
place("fx", riser(BAR * 2), t_of(38), 1.0)
for b in (16, 40, 48):
    place("fx", impact(), t_of(b), 1.0)
    events["impact"].append(t_of(b))

# ----------------------------------------------------------------------------
# Сведение: сайдчейн, ревербер, мастер
# ----------------------------------------------------------------------------

duck = np.ones(N)
dn = int(0.3 * SR)
curve = 1 - 0.7 * np.exp(-np.arange(dn) / (0.07 * SR))
for kt in events["kick"]:
    i = int(kt * SR)
    j = min(N, i + dn)
    duck[i:j] = np.minimum(duck[i:j], curve[: j - i])

for k in ("pad", "arp", "bass", "lead"):
    tracks[k] *= duck if k != "bass" else duck ** 0.6


def reverb_ir(sec, decay, seed):
    r = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t * decay)
    ir = lp(ir, 6000)
    return ir / np.sqrt(np.sum(ir ** 2))


send = tracks["pad"] * 0.25 + tracks["arp"] * 0.45 + tracks["lead"] * 0.35 + tracks["clap"] * 0.2 + tracks["fx"] * 0.2
wetL = fftconvolve(send, reverb_ir(3.2, 2.4, 1))[:N]
wetR = fftconvolve(send, reverb_ir(3.2, 2.4, 2))[:N]

dry = (
    tracks["kick"] * 0.95 + tracks["clap"] * 0.55 + tracks["hat"] * 0.35 + tracks["bass"] * 0.8
    + tracks["pad"] * 0.5 + tracks["lead"] * 0.55 + tracks["fx"] * 0.6
)
# немного ширины: арп и хэты чуть разведены
arpL = tracks["arp"] * 0.5
arpR = np.concatenate([np.zeros(int(0.012 * SR)), tracks["arp"][: -int(0.012 * SR)]]) * 0.5
hatL = tracks["hat"] * 0.08
L = dry + arpL + wetL * 0.35 + hatL
R = dry + arpR + wetR * 0.35 - hatL * 0.5

mix = np.stack([L, R], axis=1)
mix = hp(mix.T, 25).T
mix = np.tanh(mix * 0.9)
# плавное затухание хвоста
fade = int(2.5 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix = mix / np.max(np.abs(mix)) * 0.89

os.makedirs(OUT, exist_ok=True)
pcm = (mix * 32767).astype("<i2")
import wave

with wave.open(os.path.join(OUT, "track.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

# ----------------------------------------------------------------------------
# Разметка для визуала
# ----------------------------------------------------------------------------

FPS_ENV = 60
hop = SR // FPS_ENV


def envelope(x):
    n = len(x) // hop
    x2 = x[: n * hop].reshape(n, hop)
    e = np.sqrt(np.mean(x2 ** 2, axis=1))
    return e


def norm(e):
    m = np.percentile(e, 99.5) or 1.0
    return np.round(np.clip(e / m, 0, 1), 3).tolist()


mono = mix.mean(axis=1)
data = dict(
    bpm=BPM,
    beat=BEAT,
    bar=BAR,
    duration=round(N / SR, 3),
    bars=BARS,
    sections=[dict(name=n, start=round(a * BAR, 4), end=round(b * BAR, 4), bars=[a, b]) for n, a, b in SECTIONS],
    chords=[chord_at(b)["name"] for b in range(BARS)],
    beats=[round(i * BEAT, 4) for i in range(BARS * 4)],
    events={k: (sorted(set(round(x, 4) for x in v)) if k != "lead" else [[round(a, 4), round(b, 4), c] for a, b, c in v]) for k, v in events.items()},
    env=dict(
        fps=FPS_ENV,
        mix=norm(envelope(mono)),
        kick=norm(envelope(tracks["kick"])),
        bass=norm(envelope(tracks["bass"])),
        lead=norm(envelope(tracks["lead"])),
        hat=norm(envelope(tracks["hat"])),
    ),
)
with open(os.path.join(OUT, "track.json"), "w") as f:
    json.dump(data, f, separators=(",", ":"))

print(f"track.wav: {N / SR:.1f} s, peak {np.max(np.abs(mix)):.2f}")
print("events:", {k: len(v) for k, v in events.items()})
