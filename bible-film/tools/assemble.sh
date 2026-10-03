#!/usr/bin/env bash
# Склейка отрендеренных сегментов + звук → итоговый MP4 с двумя дорожками:
#   #1 стерео (по умолчанию: телефон/ноутбук/наушники), #2 5.1 (L R C LFE Ls Rs — домашний кинотеатр).
# tools/assemble.sh <папка_с_сегментами> <выход.mp4>
set -euo pipefail
SEG_DIR=${1:-/tmp/bible-render}; OUT=${2:-bible.mp4}
ls "$SEG_DIR"/seg_*.mp4 | sort | sed "s/^/file '/; s/$/'/" > "$SEG_DIR/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$SEG_DIR/list.txt" -i audio/mix.wav -i audio/mix51.wav \
  -map 0:v -map 1:a -map 2:a -c:v copy \
  -c:a:0 aac -b:a:0 256k -c:a:1 aac -b:a:1 512k -channel_layout:a:1 5.1 \
  -metadata:s:a:0 title="Стерео" -metadata:s:a:0 language=rus -disposition:a:0 default \
  -metadata:s:a:1 title="5.1 Surround" -metadata:s:a:1 language=rus -disposition:a:1 0 \
  -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=index,codec_type,channels -of compact "$OUT"
