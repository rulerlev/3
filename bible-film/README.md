# Библия за 15 минут 🎬

Анимационный фильм (~14:35, 1920×1080, 24 к/с) по всей Библии — **сделан целиком кодом**:
картинка — Three.js, звук — numpy, голос — офлайн-синтез RHVoice. Без генеративных видео- и голосовых API.

## Что внутри

| Этап | Файл | Что делает |
|---|---|---|
| 📖 Чтение | `tools/parse_bible.py`, `tools/exact_counts.py` | Разбирает все 31 169 стихов Синодального перевода → `data/bible.json`, `stats.json`, `exact.json` (главы, частоты слов, самые короткие стихи) |
| ✍️ Сценарий | `data/script.json`, `tools/check_quotes.py` | 24 сцены; каждая цитата проверяется на дословное совпадение со стихом |
| 🗣️ Озвучка | `tools/tts.py` | RHVoice (`aleksandr-hq`) + обработка sox → `data/timeline.json` с пословными таймингами |
| 🔊 Звук | `tools/sound.py` | Музыка, атмосферы, фоли и эффекты, синтезированные с нуля; микс **5.1** (`audio/mix51.wav`) и стерео (`audio/mix.wav`) по LUFS |
| 🎨 Картинка | `film/` | Ядро (`main.js`), 2D-оверлей (`overlay.js`: субтитры по словам, цитаты, HUD «чтения»), хелперы (`lib.js`), 24 сцены (`film/scenes/*.js`) |
| 🎞️ Рендер | `tools/render.mjs` | Headless Chromium покадрово → сегменты H.264 по сценам |
| 📦 Сборка | `tools/assemble.sh` | Склейка + две аудиодорожки: стерео (по умолчанию) и 5.1 |

## Как собрать

```bash
cd bible-film && npm i
sudo apt-get install rhvoice rhvoice-russian sox fonts-paratype fonts-ebgaramond
pip install numpy scipy pyloudnorm

python3 tools/parse_bible.py "<путь к файлу Библии>.txt" && python3 tools/exact_counts.py
python3 tools/check_quotes.py
python3 tools/tts.py
python3 tools/sound.py
node tools/render.mjs --workers 3 --out /tmp/bible-render      # долго: CPU-рендер
tools/assemble.sh /tmp/bible-render bible.mp4
```

Превью отдельных кадров: `node tools/render.mjs --preview s30,s95 --out /tmp/prev --sheet sheet.jpg`.
Правила написания сцен — `film/SCENES.md`.

Текст: Синодальный перевод, 66 книг (eBible.org, public domain). Шрифты: EB Garamond, PT Sans/Mono (OFL).
