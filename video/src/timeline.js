// Монтаж: окна сцен привязаны к тактам трека (см. music/compose.py).
import open from './scenes/open.js';
import loss from './scenes/loss.js';
import tokens from './scenes/tokens.js';
import scale from './scenes/scale.js';
import bureau from './scenes/bureau.js';
import datacenter from './scenes/datacenter.js';
import outro from './scenes/outro.js';

export function buildTimeline(R) {
  const edit = [
    [open, 0, 8],
    [loss, 8, 16],
    [tokens, 16, 24],
    [scale, 24, 32],
    [bureau, 32, 40],
    [datacenter, 40, 47],
    [outro, 47, Infinity],
  ];
  return edit.map(([sc, a, b]) => ({
    ...sc,
    start: R.tBar(a),
    end: b === Infinity ? R.d.duration : R.tBar(b),
    bars: [a, b],
  }));
}
