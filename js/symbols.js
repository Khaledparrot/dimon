/* =====================================================================
   symbols.js — one thousand map signs, drawn procedurally.
   Each sign is a rune-like mark you can stamp on the world with a note.
   ===================================================================== */
(function (global) {
  'use strict';

  function seedFrom(n) {
    var h = (n * 2654435761) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var NAMES = ['stone', 'tree', 'water', 'bone', 'iron', 'ash', 'salt', 'gate', 'well', 'cairn',
    'cross', 'wheel', 'eye', 'hand', 'crow', 'wolf', 'hart', 'serpent', 'star', 'moon',
    'sun', 'flame', 'spire', 'bridge', 'mill', 'forge', 'grave', 'oath', 'vow', 'debt',
    'hollow', 'veil', 'knot', 'ring', 'spur', 'helm', 'blade', 'crown', 'coin', 'bell'];

  var cache = {};

  /* a sign is a deterministic little diagram: frame + 2–5 strokes + marks */
  function svg(index, size) {
    var key = index + ':' + (size || 40);
    if (cache[key]) return cache[key];
    var R = rng(seedFrom(index + 1));
    size = size || 40;
    var g = [];
    var frame = Math.floor(R() * 4);
    if (frame === 0) g.push('<circle cx="50" cy="50" r="42" stroke-width="3"/>');
    else if (frame === 1) g.push('<rect x="10" y="10" width="80" height="80" stroke-width="3"/>');
    else if (frame === 2) g.push('<polygon points="50,8 92,50 50,92 8,50" stroke-width="3"/>');
    else g.push('<path d="M12 12 H88 V88 H12 Z M12 50 H88" stroke-width="2.4"/>');

    var strokes = 2 + Math.floor(R() * 4);
    for (var i = 0; i < strokes; i++) {
      var x1 = 18 + Math.floor(R() * 5) * 16;
      var y1 = 18 + Math.floor(R() * 5) * 16;
      var x2 = 18 + Math.floor(R() * 5) * 16;
      var y2 = 18 + Math.floor(R() * 5) * 16;
      if (x1 === x2 && y1 === y2) x2 = x1 + 16;
      g.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke-width="' + (2.4 + R() * 2) + '"/>');
    }
    var marks = Math.floor(R() * 3);
    for (var m = 0; m < marks; m++) {
      var cx = 18 + Math.floor(R() * 5) * 16, cy = 18 + Math.floor(R() * 5) * 16;
      if (R() < 0.5) g.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + (3 + R() * 4) + '" fill="currentColor" stroke="none"/>');
      else g.push('<path d="M' + cx + ' ' + (cy - 6) + ' L' + (cx + 6) + ' ' + (cy + 5) + ' L' + (cx - 6) + ' ' + (cy + 5) + ' Z" fill="currentColor" stroke="none"/>');
    }

    var out = '<svg class="msign" viewBox="0 0 100 100" width="' + size + '" height="' + size +
      '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" stroke="currentColor" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + g.join('') + '</g></svg>';
    cache[key] = out;
    return out;
  }

  function name(index) {
    return NAMES[index % NAMES.length] + ' · ' + (index + 1);
  }

  global.Signs = { count: 1000, svg: svg, name: name };
})(window);
