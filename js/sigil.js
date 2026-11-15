/* =====================================================================
   sigil.js — procedural occult sigils and tool icons.
   Every demon type gets its own deterministic, ornate sigil drawn as
   inline SVG: no image assets, crisp at any size, ~0 bytes each.
   ===================================================================== */
(function (global) {
  'use strict';

  function seedFrom(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
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

  function pt(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  function n2(v) { return Math.round(v * 100) / 100; }
  function P(a) { return n2(a[0]) + ' ' + n2(a[1]); }

  /* ---------------------------------------------------------------- */
  /* The sigil itself                                                  */
  /* ---------------------------------------------------------------- */
  function sigilSVG(seedStr, opts) {
    opts = opts || {};
    var R = rng(seedFrom(seedStr));
    var size = opts.size || 200;
    var cx = 100, cy = 100;
    var s = [];

    function line(a, b, w, op) {
      s.push('<line x1="' + n2(a[0]) + '" y1="' + n2(a[1]) + '" x2="' + n2(b[0]) + '" y2="' + n2(b[1]) +
        '" stroke-width="' + w + '" opacity="' + op + '"/>');
    }
    function circ(r, w, op, dash) {
      s.push('<circle cx="100" cy="100" r="' + r + '" stroke-width="' + w + '" opacity="' + op + '"' +
        (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>');
    }
    function poly(radius, sides, rot, w, op, closed) {
      var pts = [];
      for (var i = 0; i < sides; i++) pts.push(P(pt(cx, cy, radius, rot + i * 360 / sides)));
      s.push('<polygon points="' + pts.join(' ') + '" stroke-width="' + w + '" opacity="' + op + '"' +
        (closed === false ? ' fill="none"' : ' fill="none"') + '/>');
    }
    function arc(r, a0, a1, w, op) {
      var p0 = pt(cx, cy, r, a0), p1 = pt(cx, cy, r, a1);
      var large = (a1 - a0) > 180 ? 1 : 0;
      s.push('<path d="M' + P(p0) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + P(p1) +
        '" stroke-width="' + w + '" opacity="' + op + '"/>');
    }

    /* outer boundary */
    circ(92, 0.7, 0.5);
    circ(88, 0.5, 0.28);

    /* tick ring — 60 marks, every fifth longer */
    for (var i = 0; i < 60; i++) {
      var a = i * 6;
      var long = i % 5 === 0;
      line(pt(cx, cy, 84, a), pt(cx, cy, long ? 92 : 88.5, a), long ? 1.1 : 0.55, long ? 0.75 : 0.35);
    }

    /* rune ring — small invented glyphs */
    var runes = 12 + Math.floor(R() * 5);
    for (var r = 0; r < runes; r++) {
      var ang = (360 / runes) * r + R() * 4;
      var base = pt(cx, cy, 74, ang);
      var segs = 2 + Math.floor(R() * 2);
      var prev = base;
      for (var k = 0; k < segs; k++) {
        var nxt = [base[0] + (R() - 0.5) * 7, base[1] + (R() - 0.5) * 7];
        line(prev, nxt, 0.8, 0.55);
        prev = nxt;
      }
    }

    /* inner ring */
    circ(66, 1.1, 0.8);
    circ(62, 0.5, 0.3, '2 4');

    /* interlocking star polygons */
    var sides = 5 + Math.floor(R() * 4);
    var step = 2 + Math.floor(R() * (Math.floor(sides / 2) - 1 || 1));
    if (step >= sides / 2) step = 2;
    var starPts = [];
    for (var t = 0; t < sides; t++) {
      starPts.push(P(pt(cx, cy, 62, (360 / sides) * ((t * step) % sides) + R() * 2)));
    }
    s.push('<polygon points="' + starPts.join(' ') + '" stroke-width="1.4" opacity="0.9" fill="none"/>');

    var rot2 = R() * 40;
    poly(54, 3 + Math.floor(R() * 3), rot2, 0.8, 0.45);

    /* cardinal arcs */
    var arcs = 2 + Math.floor(R() * 3);
    for (var q = 0; q < arcs; q++) {
      var a0 = R() * 360;
      arc(80, a0, a0 + 22 + R() * 50, 1.2, 0.5);
    }

    /* chaos path — the binding stroke */
    var grid = 5, cell = 90 / grid, nodes = [];
    var cur = [cx + (Math.floor(R() * grid) - grid / 2) * cell, cy + (Math.floor(R() * grid) - grid / 2) * cell];
    var path = ['M' + P(cur)];
    var steps = 7 + Math.floor(R() * 5);
    for (var st = 0; st < steps; st++) {
      var dir = Math.floor(R() * 8);
      var dx = [0, 1, 1, 1, 0, -1, -1, -1][dir] * cell;
      var dy = [-1, -1, 0, 1, 1, 1, 0, -1][dir] * cell;
      var nx = cur[0] + dx, ny = cur[1] + dy;
      if (Math.hypot(nx - cx, ny - cy) > 46) { nx = cur[0] - dx; ny = cur[1] - dy; }
      cur = [nx, ny];
      path.push('L' + P(cur));
      nodes.push(cur);
    }
    s.push('<path d="' + path.join(' ') + '" stroke-width="1.9" opacity="0.95" fill="none"/>');

    /* nodes of the chaos path */
    nodes.forEach(function (nd, idx) {
      if (idx % 2 === 0) s.push('<circle cx="' + n2(nd[0]) + '" cy="' + n2(nd[1]) + '" r="1.9" fill="currentColor" stroke="none" opacity="0.9"/>');
    });

    /* central core */
    poly(20, 3 + Math.floor(R() * 4), R() * 60, 1.3, 0.9);
    s.push('<circle cx="100" cy="100" r="3.4" fill="currentColor" stroke="none" opacity="0.95"/>');
    s.push('<circle cx="100" cy="100" r="7" stroke-width="0.7" opacity="0.6"/>');

    /* outer crown spikes for the high ranks */
    if (opts.crown) {
      for (var c = 0; c < 4; c++) {
        var aa = c * 90 + 45;
        line(pt(cx, cy, 92, aa), pt(cx, cy, 99, aa), 1.6, 0.9);
      }
    }

    return '<svg class="sig" viewBox="0 0 200 200" width="' + size + '" height="' + size +
      '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" stroke="currentColor" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + s.join('') + '</g></svg>';
  }

  /* ---------------------------------------------------------------- */
  /* Tool icons — hand-authored line art, one per relic                */
  /* ---------------------------------------------------------------- */
  var ICONS = {
    seer: '<circle cx="12" cy="11" r="6"/><path d="M8 17l-3 4"/><circle cx="12" cy="11" r="2" fill="currentColor"/>',
    anchor: '<path d="M12 3v14"/><path d="M6 13a6 6 0 0 0 12 0"/><path d="M9 6h6"/><path d="M12 21l-2-3M12 21l2-3"/>',
    key: '<circle cx="9" cy="9" r="4"/><path d="M12 12l7 7"/><path d="M16 16l2-2M18 18l2-2"/>',
    shield: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    veil: '<path d="M4 6c4 2 12 2 16 0"/><path d="M4 6c0 8 3 12 8 15 5-3 8-7 8-15"/><path d="M9 11c1 3 2 5 3 6 1-1 2-3 3-6"/>',
    scanner: '<path d="M3 12a9 9 0 0 1 18 0"/><path d="M6.5 12a5.5 5.5 0 0 1 11 0"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 16v4"/>',
    lantern: '<path d="M9 4h6l-1 3H10z"/><path d="M8 7h8v11H8z"/><path d="M10 10v5M14 10v5"/><path d="M12 18v3"/>',
    jammer: '<path d="M3 12h3l2-5 3 10 2-5h5"/><path d="M19 6l-3 3M19 18l-3-3"/>',
    ward: '<path d="M12 3l8 5v8l-8 5-8-5V8z"/><path d="M12 8v8M8 12h8"/>',
    flask: '<path d="M10 3h4v4l4 9a4 4 0 0 1-4 5H10a4 4 0 0 1-4-5l4-9z"/><path d="M8.5 14h7"/>'
  };

  function toolIconSVG(kind, size) {
    size = size || 24;
    var d = ICONS[kind] || ICONS.seer;
    return '<svg class="ticon" viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + d + '</svg>';
  }

  global.Sigil = { svg: sigilSVG, icon: toolIconSVG, seed: seedFrom };
})(window);
