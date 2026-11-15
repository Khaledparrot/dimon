/* =====================================================================
   audio.js — louder, and actually musical: five pieces for the world,
   two for the moment a demon is close enough to touch.
   ===================================================================== */
(function (global) {
  'use strict';

  var ctx = null, master = null, enabled = true, started = false;
  var timer = null, drone = [], current = -1, mode = 'calm';

  /* each piece: root, mode (scale), chord loop, tempo, lead, percussion */
  var CALM = [
    { name: 'The Long Night', root: 55, scale: [0, 3, 5, 7, 10], prog: [0, -2, 3, 0], tempo: 620, lead: 'triangle', perc: 0.12 },
    { name: 'Salt and Ash', root: 49, scale: [0, 2, 3, 7, 8], prog: [0, 5, 3, 7], tempo: 540, lead: 'sine', perc: 0.18 },
    { name: 'March of the Hollow', root: 62, scale: [0, 1, 5, 7, 8], prog: [0, -3, -1, 2], tempo: 480, lead: 'square', perc: 0.22 },
    { name: 'The Drowned Field', root: 58, scale: [0, 2, 5, 7, 9], prog: [0, 4, 2, -1], tempo: 700, lead: 'sine', perc: 0.08 },
    { name: 'Sovereign', root: 44, scale: [0, 3, 6, 7, 10], prog: [0, -4, -2, 3], tempo: 560, lead: 'sawtooth', perc: 0.16 }
  ];
  var DREAD = [
    { name: 'It Is Here', root: 41, scale: [0, 1, 6, 7, 11], prog: [0, 1, 0, 6], tempo: 300, lead: 'sawtooth', perc: 0.42, dread: 1 },
    { name: 'Five Paces', root: 36, scale: [0, 6, 7, 11], prog: [0, 6, 1, 7], tempo: 260, lead: 'square', perc: 0.5, dread: 1 }
  ];

  function init() {
    if (started) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.95;                 /* loud */
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    started = true;
    play(mode === 'dread' ? DREAD : CALM);
  }

  function hz(root, semis) { return root * Math.pow(2, semis / 12); }

  function tone(freq, t, dur, type, vol, cut) {
    if (!ctx || !enabled) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
    if (cut) {
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut;
      o.connect(f); f.connect(g);
    } else o.connect(g);
    g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function percussion(t, vol) {
    if (!ctx || !enabled) return;
    var n = Math.floor(ctx.sampleRate * 0.14), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    var s = ctx.createBufferSource(); s.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.4;
    var g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }

  function stopDrone() {
    drone.forEach(function (n) { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} });
    drone = [];
  }

  function startDrone(piece) {
    stopDrone();
    if (!ctx) return;
    var d = piece.dread ? 1.4 : 1;
    [1, 1.5, 2.01].forEach(function (m, i) {
      var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = i === 0 ? 'sawtooth' : 'sine';
      o.frequency.value = piece.root * m * 0.5;
      g.gain.value = (i === 0 ? 0.13 : 0.08) * d;
      f.type = 'lowpass'; f.frequency.value = piece.dread ? 420 : 260;
      o.connect(f); f.connect(g); g.connect(master);
      o.start();
      drone.push(o, g, f);
    });
  }

  function play(pool) {
    if (!ctx) return;
    if (timer) { clearInterval(timer); timer = null; }
    var i = Math.floor(Math.random() * pool.length);
    if (i === current) i = (i + 1) % pool.length;
    current = i;
    var p = pool[i];
    startDrone(p);
    var step = 0;
    timer = setInterval(function () {
      if (!ctx || !enabled) return;
      var t = ctx.currentTime;
      step++;
      var chord = p.prog[Math.floor(step / 4) % p.prog.length];

      /* bass on the chord */
      if (step % 4 === 0) tone(hz(p.root, chord) * 0.5, t, 1.9, 'sine', 0.16, 500);

      /* arpeggio over the chord */
      var deg = p.scale[(step * 3) % p.scale.length];
      var oct = (step % 8 < 4) ? 2 : 4;
      tone(hz(p.root, chord + deg) * oct * 0.5, t, 1.2, p.lead, p.dread ? 0.10 : 0.085, 2400);

      /* a distant bell every other bar */
      if (step % 8 === 0) tone(hz(p.root, chord + 12) * 2, t, 2.6, 'sine', 0.07, 3000);

      /* percussion */
      if (step % 2 === 0) percussion(t, p.perc * 0.35);
      if (p.dread && step % 4 === 2) percussion(t, p.perc * 0.5);

      /* dread: a tritone scraping under everything */
      if (p.dread && step % 3 === 0) tone(hz(p.root, 6) * 1.5, t, 1.4, 'sawtooth', 0.06, 900);
    }, p.tempo);

    setTimeout(function () {
      if (ctx && enabled && mode === (pool === DREAD ? 'dread' : 'calm')) play(pool);
    }, 75000 + Math.random() * 30000);
  }

  var heartTimer = null, heartRate = 1.6, beat = 0;
  function startHeart() {
    if (heartTimer) clearInterval(heartTimer);
    heartTimer = setInterval(function () {
      if (!ctx || !enabled || ctx.state !== 'running') return;
      beat += 0.25;
      var t = ctx.currentTime;
      tone(78, t, 0.3, 'sine', mode === 'dread' ? 0.42 : 0.3, 220);
      if (beat % 1 < 0.25) tone(70, t + 0.15, 0.24, 'sine', 0.24, 220);
    }, Math.max(260, heartRate * 1000));
  }

  function blip(freq, dur, vol, type) {
    if (!ctx || !enabled) return;
    tone(freq, ctx.currentTime, dur, type || 'square', vol || 0.09, 4000);
  }

  global.Sound = {
    init: function () { init(); startHeart(); },
    isOn: function () { return enabled; },
    trackName: function () { var p = (mode === 'dread' ? DREAD : CALM)[current]; return p ? p.name : '—'; },
    mode: function () { return mode; },
    setMode: function (m) {
      if (m === mode) return;
      mode = m;
      if (ctx && enabled) play(m === 'dread' ? DREAD : CALM);
    },
    setEnabled: function (on) {
      enabled = !!on;
      if (!enabled) { if (timer) { clearInterval(timer); timer = null; } stopDrone(); }
      else if (started) { play(mode === 'dread' ? DREAD : CALM); startHeart(); }
    },
    volume: function (v) { if (master) master.gain.value = Math.max(0, Math.min(1, v)); },
    proximity: function (m) {
      heartRate = 1.7 - Math.max(0, Math.min(1, 1 - m / 600)) * 1.15;
      if (heartTimer) { clearInterval(heartTimer); heartTimer = null; startHeart(); }
    },
    ui: function () { blip(660, 0.05, 0.05, 'square'); },
    open: function () { blip(300, 0.12, 0.05, 'sine'); },
    error: function () { blip(150, 0.18, 0.1, 'sawtooth'); },
    tick: function () { blip(1400, 0.03, 0.03, 'square'); },
    kill: function () {
      if (!ctx || !enabled) return;
      var n = Math.floor(ctx.sampleRate * 0.5), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = ctx.createBufferSource(); s.buffer = b;
      var g = ctx.createGain(); g.gain.value = 0.4;
      s.connect(g); g.connect(master); s.start();
      tone(220, ctx.currentTime, 0.9, 'sawtooth', 0.3, 900);
    },
    fail: function () {
      if (!ctx || !enabled) return;
      var t = ctx.currentTime;
      tone(138, t, 0.9, 'triangle', 0.18);
      tone(146, t, 0.9, 'triangle', 0.18);
    },
    levelup: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { blip(f, 0.3, 0.09, 'sine'); }, i * 110); }); },
    crackDone: function () { [392, 587].forEach(function (f, i) { setTimeout(function () { blip(f, 0.25, 0.1, 'triangle'); }, i * 90); }); }
  };
})(window);
