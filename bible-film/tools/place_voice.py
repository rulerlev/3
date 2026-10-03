"""Вставляет новую озвучку (по одному mp3 на реплику) на места старых реплик таймлайна.
Каждая реплика: обрезка тишины по краям → при необходимости сжатие длинных пауз → темп подгоняется к длительности
старой реплики (±8%, чтобы подсветка субтитров шла синхронно) и гарантированно влезает в своё окно → запись wav так,
что речь начинается ровно в lines[].start. Таймлайн не меняется.  python3 tools/place_voice.py <папка_с_mp3>"""
import json, subprocess, sys, wave, numpy as np
SR = 48000
SRC = sys.argv[1]
tl = json.load(open('data/timeline.json'))
def load(f):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
def trim(x):
    env = np.convolve(np.abs(x), np.ones(480) / 480, 'same'); th = max(env.max() * 0.02, 1e-4); idx = np.where(env > th)[0]
    a, b = max(idx[0] - 960, 0), min(idx[-1] + 2400, len(x)); return x[a:b]
def squeeze_pauses(x, keep=0.32):
    env = np.convolve(np.abs(x), np.ones(960) / 960, 'same'); quiet = env < env.max() * 0.03
    out, i, n = [], 0, len(x)
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]: j += 1
            seg = x[i:j]
            if len(seg) > keep * SR * 1.6:
                k = int(keep * SR / 2); fade = np.linspace(1, 0, 240)
                h, t = seg[:k].copy(), seg[-k:].copy(); h[-240:] *= fade; t[:240] *= fade[::-1]; seg = np.concatenate([h, t])
            out.append(seg); i = j
        else:
            j = i
            while j < n and not quiet[j]: j += 1
            out.append(x[i:j]); i = j
    return np.concatenate(out)
def atempo(x, f):
    if abs(f - 1) < 0.01: return x
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', f'atempo={f:.4f}', '-f', 'f32le', '-'], input=x.tobytes(), capture_output=True)
    return np.frombuffer(p.stdout, np.float32).copy()
rep = []; i = 0
for s in tl['scenes']:
    for k, l in enumerate(s['lines']):
        x = trim(load(f'{SRC}/{i}.mp3'))
        nxt = s['lines'][k + 1]['start'] if k + 1 < len(s['lines']) else s['dur'] - 0.5
        slot = nxt - l['start'] - (0.3 if k + 1 < len(s['lines']) else 0)
        if len(x) / SR > slot: x = squeeze_pauses(x)
        old = l['end'] - l['start']; d = len(x) / SR
        f = min(max(d / old, 0.95), 1.08)          # ближе к старому темпу (синхрон субтитров), без заметного замедления
        f = max(f, d / slot)                        # но обязательно влезть в окно
        x = atempo(x, f)
        x = x / (np.sqrt(np.mean(x[np.abs(x) > 0.01] ** 2)) + 1e-9) * 0.15   # ровная громкость реплик
        x = np.clip(x, -0.98, 0.98)
        lead = np.zeros(int(round((l['start'] - l['at']) * SR)), np.float32)
        y = (np.concatenate([lead, x]) * 32767).astype(np.int16)
        with wave.open(l['wav'], 'w') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes())
        rep.append((round(f, 3), round(len(x) / SR, 2), round(slot, 2), s['id'])); i += 1
fs = np.array([r[0] for r in rep]); print('lines', len(rep), 'tempo min/median/max', fs.min(), np.median(fs), fs.max())
print('over 1.08:', [r for r in rep if r[0] > 1.081])
