/* =====================================================================
   jinn.js — the other world. A procedural city that covers the planet,
   drawn tile by tile, and the fifty levels of jinn that walk it.
   ===================================================================== */
(function (global) {
  'use strict';

  function hash(x, y, z) {
    var h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
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

  var PALETTE = ['#1a1026', '#241635', '#2f1b3d', '#3a2148', '#20122b', '#2a1a33'];
  var GLOW = ['#6b3fa0', '#8a5fc0', '#4a2a7a', '#c9a227'];

  function drawTile(ctx, x, y, z, size) {
    var R = rng(hash(x, y, z));
    ctx.fillStyle = '#0d0715';
    ctx.fillRect(0, 0, size, size);

    /* a wash of distant light */
    var g = ctx.createRadialGradient(size * R(), size * R(), 0, size / 2, size / 2, size);
    g.addColorStop(0, 'rgba(90,50,140,0.30)');
    g.addColorStop(1, 'rgba(10,6,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    /* streets */
    ctx.strokeStyle = 'rgba(150,110,200,0.16)';
    ctx.lineWidth = Math.max(2, size / 90);
    var lanes = 2 + Math.floor(R() * 3);
    for (var i = 0; i < lanes; i++) {
      var vx = R() * size, hy = R() * size;
      ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(size, hy); ctx.stroke();
    }

    /* blocks and towers */
    var n = 14 + Math.floor(R() * 18);
    for (var b = 0; b < n; b++) {
      var w = size * (0.05 + R() * 0.16);
      var h = size * (0.05 + R() * 0.16);
      var px = R() * (size - w), py = R() * (size - h);
      var tall = R() < 0.12;
      var body = PALETTE[Math.floor(R() * PALETTE.length)];
      ctx.fillStyle = body;
      ctx.fillRect(px, py, w, h);
      /* roof light */
      ctx.fillStyle = 'rgba(160,120,220,' + (0.10 + R() * 0.16) + ')';
      ctx.fillRect(px, py, w, Math.max(2, h * 0.18));
      if (tall) {
        ctx.fillStyle = 'rgba(200,160,255,0.10)';
        ctx.fillRect(px + w * 0.3, py - h * 0.8, w * 0.4, h * 0.8);
        ctx.fillStyle = GLOW[Math.floor(R() * GLOW.length)];
        ctx.globalAlpha = 0.5;
        ctx.fillRect(px + w * 0.45, py - h * 0.9, w * 0.1, h * 0.1);
        ctx.globalAlpha = 1;
      }
      /* windows */
      var rows = 2 + Math.floor(R() * 4);
      for (var r2 = 0; r2 < rows; r2++) {
        if (R() < 0.45) continue;
        ctx.fillStyle = R() < 0.2 ? '#ffcc66' : 'rgba(200,170,255,0.5)';
        ctx.fillRect(px + w * (0.15 + R() * 0.6), py + h * (0.25 + r2 * 0.18), Math.max(1, w * 0.08), Math.max(1, h * 0.06));
      }
    }

    /* a river or a chasm, sometimes */
    if (R() < 0.25) {
      ctx.strokeStyle = 'rgba(60,20,90,0.85)';
      ctx.lineWidth = size * (0.06 + R() * 0.06);
      ctx.beginPath();
      ctx.moveTo(0, R() * size);
      ctx.bezierCurveTo(size * 0.3, R() * size, size * 0.7, R() * size, size, R() * size);
      ctx.stroke();
    }
    /* a plaza or a crater */
    if (R() < 0.2) {
      ctx.beginPath();
      ctx.arc(R() * size, R() * size, size * (0.06 + R() * 0.08), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,10,35,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(201,162,39,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function layer() {
    var JinnLayer = L.GridLayer.extend({
      createTile: function (coords) {
        var size = 256;
        var tile = document.createElement('canvas');
        tile.width = tile.height = size;
        var ctx = tile.getContext('2d');
        drawTile(ctx, coords.x, coords.y, coords.z, size);
        return tile;
      }
    });
    return new JinnLayer({ tileSize: 256, minZoom: 3, maxZoom: 19, opacity: 1, className: 'jinnlayer' });
  }

  /* ---------------- the fifty levels ---------------- */
  function levelColour(lvl) {
    /* violet at the bottom, gold at the top */
    var t = (lvl - 1) / 49;
    var r = Math.round(90 + t * 165);
    var g = Math.round(50 + t * 145);
    var b = Math.round(160 - t * 60);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function rollLevel(R) {
    /* heavy tail: most are low, the great ones are nearly never seen */
    var r = Math.pow(R(), 4.2);
    return 1 + Math.floor(r * 49);
  }
  function speedOf(lvl) { return 0.6 + lvl * 0.22; }   /* m/s */

  function spawnJinn(around, R) {
    var lvl = rollLevel(R);
    var p = destinationLocal(around, 40 + R() * 900, R() * 360);
    return {
      id: 'j' + Math.floor(R() * 1e9).toString(36),
      level: lvl,
      lat: p.lat, lng: p.lng,
      heading: R() * 360,
      restUntil: 0,
      colour: levelColour(lvl)
    };
  }

  function destinationLocal(p, m, brg) {
    var R_EARTH = 6371000, D2R = Math.PI / 180;
    var d = m / R_EARTH, b = brg * D2R, la1 = p.lat * D2R, lo1 = p.lng * D2R;
    var la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
    var lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
    return { lat: la2 / D2R, lng: ((lo2 / D2R + 540) % 360) - 180 };
  }

  function step(list, dtMs, player) {
    var t = Date.now();
    list.forEach(function (j) {
      if (j.restUntil && t < j.restUntil) return;
      if (Math.random() < 0.008) { j.restUntil = t + 3000 + Math.random() * 12000; return; }
      if (Math.random() < 0.05) j.heading = Math.random() * 360;
      var stepM = speedOf(j.level) * (dtMs / 1000);
      var p = destinationLocal(j, stepM, j.heading);
      j.lat = p.lat; j.lng = p.lng;
    });
  }

  global.Jinn = {
    layer: layer,
    spawnJinn: spawnJinn,
    step: step,
    colour: levelColour,
    speedOf: speedOf,
    rollLevel: rollLevel
  };
})(window);
