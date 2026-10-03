"""Озвучка всех реплик оффлайн-синтезатором RHVoice + раскладка по времени -> data/timeline.json."""
import json, re, subprocess, os, wave
import numpy as np
SR = 48000
os.makedirs('audio/lines', exist_ok=True)
script = json.load(open('data/script.json'))
books = {b['code']: b for b in json.load(open('data/bible.json'))['books']}

def speakable(t):
    t = t.replace('«', '').replace('»', '').replace('…', ', ')
    t = re.sub(r'\s—\s', ', ', t)
    return t

def synth(text, path, quote):
    raw = path + '.raw.wav'
    rate = '84' if quote else '96'
    subprocess.run(['RHVoice-test', '-p', 'aleksandr-hq', '-r', rate, '-q', 'max',
                    '-R', '24000', '-o', raw], input=speakable(text).encode(), check=True, capture_output=True)
    fx = ['gain', '-6', 'highpass', '70', 'equalizer', '180', '1q', '+2.5', 'equalizer', '3200', '1.5q', '+1.5', 'treble', '-2', '8000']
    fx += ['pitch', '-120', 'reverb', '38', '50', '80', '100', '18', '0'] if quote else ['reverb', '14', '50', '40', '100', '8', '0']
    subprocess.run(['sox', raw, '-r', str(SR), '-c', '1', '-b', '16', path, *fx, 'norm', '-3'], check=True)
    os.remove(raw)

def read_wav(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768

def trim_bounds(x):
    env = np.convolve(np.abs(x), np.ones(480) / 480, 'same')
    idx = np.where(env > 0.01)[0]
    return (idx[0] / SR, idx[-1] / SR) if len(idx) else (0, len(x) / SR)

def word_times(text, x, t0, t1):
    """Слова раскладываются по фразам, найденным по паузам в сигнале; внутри фразы — по числу гласных."""
    words = re.findall(r'\S+', text)
    env = np.convolve(np.abs(x), np.ones(960) / 960, 'same')[::480]  # шаг 10 мс
    loud = env > 0.012
    # паузы >= 140 мс внутри речи
    gaps, run = [], 0
    for i, v in enumerate(loud):
        if not v: run += 1
        else:
            if run >= 14 and i / 100 > t0 + 0.1: gaps.append(((i - run) / 100, i / 100))
            run = 0
    phrases, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r'[.,;:!?—…]$', w) or w == '—': phrases.append(cur); cur = []
    if cur: phrases.append(cur)
    weight = lambda w: len(re.findall(r'[аеёиоуыэюяАЕЁИОУЫЭЮЯ]', w)) + 0.6
    spans = []
    if len(gaps) == len(phrases) - 1:
        b = [t0] + [g for gp in gaps for g in gp] + [t1]
        spans = [(b[2 * i], b[2 * i + 1]) for i in range(len(phrases))]
    else:
        tot = sum(weight(w) for p in phrases for w in p); t = t0
        for p in phrases:
            d = (t1 - t0) * sum(weight(w) for w in p) / tot; spans.append((t, t + d)); t += d
    out = []
    for p, (a, bnd) in zip(phrases, spans):
        tot = sum(weight(w) for w in p); t = a
        for w in p:
            d = (bnd - a) * weight(w) / tot; out.append(dict(w=w, s=round(t, 3), e=round(t + d, 3))); t += d
    return out

timeline = dict(fps=24, scenes=[])
T = 0.0
for sc in script['scenes']:
    t = sc.get('pre', 0.5); lines = []; cues = {}
    for i, l in enumerate(sc['lines']):
        path = f"audio/lines/{sc['id']}_{i:02d}.wav"
        if not os.path.exists(path): synth(l['t'], path, l['v'] == 'q')
        x = read_wav(path); a, b = trim_bounds(x)
        start = t - a
        words = [dict(w=w['w'], s=round(start + w['s'], 3), e=round(start + w['e'], 3)) for w in word_times(l['t'], x, a, b)]
        lines.append(dict(v=l['v'], t=l['t'], ref=l.get('ref'), refName=(f"{books[l['ref'].split()[0]]['name']} {l['ref'].split()[1]}" if l.get('ref') else None),
                          wav=path, at=round(start, 3), start=round(t, 3), end=round(t + b - a, 3), words=words))
        if l.get('cue'): cues[l['cue']] = round(t, 3)
        t += (b - a) + l.get('post', 0.8 if l['v'] == 'n' else 1.25)
    dur = max(t + sc.get('post', 1.0), sc.get('minDur', 0))
    timeline['scenes'].append(dict(id=sc['id'], start=round(T, 3), dur=round(dur, 3), book=sc['book'], bookName=books[sc['book']]['name'],
                                   chapter=sc['chapter'], cues=cues, lines=lines))
    T += dur
timeline['total'] = round(T, 3)
json.dump(timeline, open(os.environ.get('TIMELINE_OUT', 'data/timeline.json'), 'w'), ensure_ascii=False, indent=1)
for s in timeline['scenes']: print(f"{s['id']:13s} {s['start']:7.1f} {s['dur']:6.1f}")
print('TOTAL', round(T, 1), 's =', f"{int(T//60)}:{T%60:04.1f}")
