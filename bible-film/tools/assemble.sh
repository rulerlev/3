#!/usr/bin/env bash
# Склейка отрендеренных сегментов + сведённый звук → итоговый MP4.
# tools/assemble.sh <папка_с_сегментами> <выход.mp4>
set -euo pipefail
SEG_DIR=${1:-/tmp/bible-render}; OUT=${2:-bible_10min.mp4}
ls "$SEG_DIR"/seg_*.mp4 | sort | sed "s/^/file '/; s/$/'/" > "$SEG_DIR/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$SEG_DIR/list.txt" -i audio/mix.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
