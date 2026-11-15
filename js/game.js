/* =====================================================================
   game.js — the hunt, the houses you own, the vault, the war.
   ===================================================================== */
(function () {
  'use strict';

  var D = window.DATA, R = D.RULES, HOUSES = D.DEMONS, RELICS = D.RELICS;
  var SIG = window.Sigil, CR = window.Crest, PZ = window.Puzzles, SND = window.Sound;
  var BIND = R.bindRange;

  /* ------------------------------------------------------------------ */
  /* helpers                                                             */
  /* ------------------------------------------------------------------ */
  var R_EARTH = 6371000, D2R = Math.PI / 180;
  var COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function now() { return Date.now(); }
  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function norm(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function roman(n) { return D.NUMERALS[n] || n; }
  function uid(p) { return p + Math.random().toString(36).slice(2, 9); }

  function haversine(a, b) {
    var dLat = (b.lat - a.lat) * D2R, dLng = (b.lng - a.lng) * D2R;
    var la1 = a.lat * D2R, la2 = b.lat * D2R;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function bearing(a, b) {
    var la1 = a.lat * D2R, la2 = b.lat * D2R, dLng = (b.lng - a.lng) * D2R;
    var y = Math.sin(dLng) * Math.cos(la2);
    var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
    return (Math.atan2(y, x) / D2R + 360) % 360;
  }
  function destination(p, m, brg) {
    var d = m / R_EARTH, b = brg * D2R, la1 = p.lat * D2R, lo1 = p.lng * D2R;
    var la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
    var lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
    return { lat: la2 / D2R, lng: ((lo2 / D2R + 540) % 360) - 180 };
  }
  function compassOf(b) { return COMPASS[Math.round(b / 45) % 8]; }
  function fmtDist(m) { if (m == null) return '—'; return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(m < 10000 ? 2 : 1) + ' km'; }

  /* ------------------------------------------------------------------ */
  /* state                                                               */
  /* ------------------------------------------------------------------ */
  var SAVE_KEY = 'sigilwar.save.v5', VER = 5;
  var S = null, map = null, tiles = null;
  var markers = {}, youMk = null, accCircle = null, sanctumLayers = [];
  var sheet = { demon: null, chal: null, cond: null, timer: null, typewriter: null };
  var crack = null, pendingUse = null, duel = null;
  var lastTick = now(), sigCache = {};

  function fresh(lat, lng) {
    return {
      v: VER,
      player: { lat: lat, lng: lng, acc: 25, real: false },
      xp: 0, rank: 1, kills: 0, shards: 60, wards: R.maxWards, wardAt: now(),
      corruption: 0, markedUntil: 0, playMs: 0, cracked: 0,
      crest: 0, crestRank: 1, crestPending: true,
      demons: [], relics: [], sanctums: [],
      inv: {}, servants: [],
      vault: { hash: null, salt: null, relics: {}, servants: [] },
      signs: [], cracks: {}, world: D.WORLD.initial, lang: 'en', jinnMode: false, jinns: [],
      rivals: [], feed: [], buffs: {}, seenIntro: false, tiles: 'osm', muted: false, theme: 'parchment'
    };
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return (s && s.v === VER) ? s : null;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ */
  /* progression                                                         */
  /* ------------------------------------------------------------------ */
  function rankFor(xp) {
    var r = 1;
    for (var i = 0; i < D.RANKS.length; i++) if (xp >= D.RANKS[i].xp) r = D.RANKS[i].rank;
    return r;
  }
  function rankInfo(r) { return D.RANKS[Math.min(r, 10) - 1]; }
  function nextThreshold(r) { return r >= 10 ? null : D.RANKS[r].xp; }

  function rarityWeight(rar) { return rar === 'fabled' ? 5 : rar === 'rare' ? 3 : rar === 'uncommon' ? 2 : 1; }

  function strength() {
    var s = S.rank * 10;
    Object.keys(S.inv).forEach(function (k) {
      if (RELICS[k]) s += (S.inv[k] || 0) * rarityWeight(RELICS[k].rarity) * 2;
    });
    S.servants.forEach(function (sv) { s += 12 + sv.rank * 3 + sv.attuned.length * 6; });
    Object.keys(S.vault.relics).forEach(function (k) {
      if (RELICS[k]) s += (S.vault.relics[k] || 0) * rarityWeight(RELICS[k].rarity);
    });
    s += S.vault.servants.length * 10;
    s += S.cracked * 2;
    s += Math.floor(S.playMs / 3600000) * 4;
    return Math.round(s);
  }

  /* ------------------------------------------------------------------ */
  /* map                                                                 */
  /* ------------------------------------------------------------------ */
  function initMap() {
    map = L.map('map', { zoomControl: false, attributionControl: false, tap: true })
      .setView([S.player.lat, S.player.lng], 17);
    L.control.attribution({ prefix: false, position: 'bottomleft' })
      .addAttribution('&copy; OpenStreetMap').addTo(map);
    setTiles(S.tiles);
  }

  function setTiles(kind) {
    S.tiles = kind;
    if (tiles) { map.removeLayer(tiles); tiles = null; }
    var el = $('map');
    el.className = '';
    if (kind === 'none') return;
    if (kind === 'carto') {
      el.classList.add('map-dark');
      tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { subdomains: 'abcd', maxZoom: 19, minZoom: 3, detectRetina: true }).addTo(map);
    } else {
      el.classList.add('map-parchment');
      tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, minZoom: 3 }).addTo(map);
    }
  }

  /* ------------------------------------------------------------------ */
  /* sanctums — ground where no hunter can see a demon                   */
  /* ------------------------------------------------------------------ */
  function inSanctum(p) {
    for (var i = 0; i < S.sanctums.length; i++) {
      var s = S.sanctums[i];
      if (haversine(p, s) < s.r) return true;
    }
    return false;
  }

  function makeSanctums() {
    S.sanctums = [];
    for (var i = 0; i < R.sanctums; i++) {
      var p = destination(S.player, rnd(350, 1600), rnd(0, 359));
      S.sanctums.push({ id: uid('s'), lat: p.lat, lng: p.lng, r: rnd(R.sanctumRadius[0], R.sanctumRadius[1]) });
    }
  }

  function drawSanctums() {
    sanctumLayers.forEach(function (l) { map.removeLayer(l); });
    sanctumLayers = [];
    S.sanctums.forEach(function (s) {
      var c = L.circle([s.lat, s.lng], {
        radius: s.r, color: '#7d1f1a', weight: 1.4, opacity: .55, dashArray: '6 6',
        fillColor: '#7d1f1a', fillOpacity: .07, interactive: false
      }).addTo(map);
      sanctumLayers.push(c);
    });
  }

  /* ------------------------------------------------------------------ */
  /* world                                                               */
  /* ------------------------------------------------------------------ */
  function spawnDemon(rank) {
    var pool = HOUSES.filter(function (h) { return h.rank === clamp(rank, 1, 10); });
    var h = pick(pool) || HOUSES[0];
    var pos = destination(S.player, rnd(R.spawnMin, R.spawnMax), rnd(0, 359));
    if (inSanctum(pos)) pos = destination(S.player, rnd(R.spawnMin, R.spawnMax), rnd(0, 359));
    var locked = Math.random() < 0.38;
    var fake = locked ? destination(pos, rnd(70, 180), rnd(0, 359)) : null;
    return {
      id: uid('d'), house: h.id, rank: h.rank,
      lat: pos.lat, lng: pos.lng,
      shownLat: fake ? fake.lat : pos.lat, shownLng: fake ? fake.lng : pos.lng,
      locked: locked, diff: PZ.difficultyFor(h.rank),
      driftAt: now() + rnd(R.driftMinMs, R.driftMaxMs),
      frozenUntil: 0, veiledUntil: 0, shieldUntil: 0, flag: null
    };
  }

  function spawnRelic(id) {
    var pos = destination(S.player, rnd(60, 550), rnd(0, 359));
    var rid = id || pick(D.RELIC_KEYS);
    var r = { id: uid('r'), relic: rid, lat: pos.lat, lng: pos.lng };
    if (Math.random() < 0.3) {
      var chars = 'abcdefghijklmnopqrstuvwxyz0123456789', len = rnd(3, 4), pwd = '';
      for (var i = 0; i < len; i++) pwd += chars[rnd(0, chars.length - 1)];
      var salt = r.id.toUpperCase();
      r.lock = { salt: salt, hash: PZ.sha256(salt + ':' + pwd), len: len, owner: 'rival' };
    }
    return r;
  }

  function populate() {
    var maxRank = clamp(S.rank + 1, 1, 10);
    var near = S.demons.filter(function (d) {
      var p = d.locked ? { lat: d.shownLat, lng: d.shownLng } : d;
      return haversine(S.player, p) < 1700;
    }).length;
    while (near < R.demonPopulation) {
      var r = Math.random() < 0.6 ? rnd(1, clamp(maxRank, 1, 3)) : rnd(1, maxRank);
      S.demons.push(spawnDemon(r));
      near++;
    }
    var relicsNear = S.relics.filter(function (x) { return haversine(S.player, x) < 1200; }).length;
    while (relicsNear < 6) { S.relics.push(spawnRelic()); relicsNear++; }
  }

  function cull() {
    S.demons = S.demons.filter(function (d) {
      var p = d.locked ? { lat: d.shownLat, lng: d.shownLng } : d;
      return haversine(S.player, p) < R.cullDistance;
    });
    S.relics = S.relics.filter(function (r) { return haversine(S.player, r) < 3000; });
  }

  /* ------------------------------------------------------------------ */
  /* markers                                                             */
  /* ------------------------------------------------------------------ */
  function sig(seed, size, crown) {
    var k = seed + size + (crown ? 'c' : '');
    if (!sigCache[k]) sigCache[k] = SIG.svg(seed, { size: size, crown: crown });
    return sigCache[k];
  }

  function demonIcon(d, cls, size) {
    var h = HOUSES.filter(function (x) { return x.id === d.house; })[0] || HOUSES[0];
    size = size || 54;
    return L.divIcon({
      className: 'mkwrap',
      html: '<div class="mk ' + cls + '" style="width:' + size + 'px;height:' + size + 'px">' +
        '<div class="ring"></div><div class="sg">' + sig(h.id, size, d.rank >= 9) + '</div>' +
        '<div class="num">' + h.numeral + '</div></div>',
      iconSize: [size, size], iconAnchor: [size / 2, size / 2]
    });
  }

  function relicIcon(relicId, size) {
    size = size || 40;
    return L.divIcon({
      className: 'mkwrap',
      html: '<div class="relic" style="width:' + size + 'px;height:' + size + 'px">' +
        '<div class="plate"></div><div class="ic">' + SIG.icon(RELICS[relicId] ? RELICS[relicId].kind : 'seer', size * 0.55) + '</div></div>',
      iconSize: [size, size], iconAnchor: [size / 2, size / 2]
    });
  }

  function playerIcon() {
    var crest = D.CRESTS[S.crest] || D.CRESTS[0];
    return L.divIcon({
      className: 'mkwrap',
      html: '<div class="you"><div class="halo"></div><div class="mark">' + CR.svg(crest, 30) + '</div></div>',
      iconSize: [34, 40], iconAnchor: [17, 20]
    });
  }

  function syncMap() {
    var t = now(), seer = S.buffs.seerUntil > t, lantern = S.buffs.lanternUntil > t, ember = S.buffs.flaskUntil > t;
    var pp = [S.player.lat, S.player.lng];

    if (!youMk) {
      youMk = L.marker(pp, { icon: playerIcon(), zIndexOffset: 900, interactive: false }).addTo(map);
    } else {
      youMk.setLatLng(pp);
      if (youMk._crest !== S.crest) { youMk.setIcon(playerIcon()); youMk._crest = S.crest; }
    }

    if (!accCircle) {
      accCircle = L.circle(pp, { radius: S.player.acc, color: '#8a6a1f', weight: 1, opacity: .3, fillOpacity: .05, interactive: false }).addTo(map);
    } else { accCircle.setLatLng(pp); accCircle.setRadius(S.player.acc); }

    var live = {};
    S.demons.forEach(function (d) {
      /* demons sheltering in a sanctum cannot be seen by anyone */
      if (inSanctum({ lat: d.lat, lng: d.lng })) {
        if (markers[d.id]) { map.removeLayer(markers[d.id]); delete markers[d.id]; }
        return;
      }
      live[d.id] = 1;
      var pos = (d.locked && !seer) ? { lat: d.shownLat, lng: d.shownLng } : { lat: d.lat, lng: d.lng };
      var dist = haversine(S.player, d);
      var cls = [];
      if (d.locked && !seer) cls.push('locked');
      if (d.frozenUntil > t) cls.push('frozen');
      if (d.flag) cls.push('flagged');
      if (dist > 1300) cls.push('far');
      if (!d.locked && dist <= BIND) cls.push('near');
      var key = cls.join(' ');
      var m = markers[d.id];
      if (!m) {
        m = L.marker([pos.lat, pos.lng], { icon: demonIcon(d, key), zIndexOffset: 300 });
        m.on('click', function () { openDemon(d.id); });
        m.addTo(map); markers[d.id] = m; m._k = key;
        var el = m.getElement(); if (el && el.firstChild) el.firstChild.classList.add('pop');
      } else {
        m.setLatLng([pos.lat, pos.lng]);
        if (m._k !== key) { m.setIcon(demonIcon(d, key)); m._k = key; }
      }
    });

    S.relics.forEach(function (r) {
      live[r.id] = 1;
      var dist = haversine(S.player, r);
      if (dist >= (lantern || ember ? 1200 : 400)) {
        if (markers[r.id]) { map.removeLayer(markers[r.id]); delete markers[r.id]; }
        return;
      }
      var m = markers[r.id];
      if (!m) {
        m = L.marker([r.lat, r.lng], { icon: relicIcon(r.relic), zIndexOffset: 200 });
        m.on('click', function () { openRelicPickup(r.id); });
        m.addTo(map); markers[r.id] = m;
      } else m.setLatLng([r.lat, r.lng]);
    });

    Object.keys(markers).forEach(function (id) {
      if (id.indexOf('sg') === 0 || id.indexOf('peer_') === 0) return;   /* signs stay put */
      if (!live[id]) { map.removeLayer(markers[id]); delete markers[id]; }
    });

    updateFog();
  }

  function updateFog() {
    if (!map) return;
    var p = map.latLngToContainerPoint([S.player.lat, S.player.lng]);
    var fog = $('fog');
    fog.style.setProperty('--px', p.x + 'px');
    fog.style.setProperty('--py', p.y + 'px');
    fog.classList.toggle('off', S.buffs.flaskUntil > now());
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */
  function renderHUD() {
    var ri = rankInfo(S.rank), nx = nextThreshold(S.rank);
    var crest = D.CRESTS[S.crest] || D.CRESTS[0];
    if (renderHUD._crest !== S.crest) {
      renderHUD._crest = S.crest;
      $('hudCrest').innerHTML = CR.svg(crest, 34);
    }
    $('rankName').textContent = ri.name;
    $('rankNum').textContent = 'Sigil ' + roman(S.rank);
    $('shards').textContent = S.shards;
    $('kills').textContent = S.kills;
    $('strength').textContent = strength();
    var prev = ri.xp, span = nx ? nx - prev : 1;
    $('xpBar').style.width = (nx ? clamp((S.xp - prev) / span * 100, 0, 100) : 100) + '%';
    $('xpLbl').textContent = nx ? (S.xp - prev) + ' / ' + span : 'MAX';

    var w = '';
    for (var i = 0; i < R.maxWards; i++) w += '<i class="' + (i < S.wards ? '' : 'off') + '"></i>';
    $('wards').innerHTML = w;
    $('corruptBar').style.width = clamp(S.corruption, 0, 100) + '%';

    var best = null, bestD = 1e9;
    S.demons.forEach(function (d) {
      if (inSanctum(d)) return;
      var dd = haversine(S.player, d);
      if (dd < bestD) { bestD = dd; best = d; }
    });
    var el = $('nearest');
    if (S.jinnMode) {
      var hi = 0;
      S.jinns.forEach(function (j) { if (j.level > hi) hi = j.level; });
      el.innerHTML = '<b>The veil</b> · ' + jinnCount().toLocaleString() + ' jinn · strongest seen <b>level ' + hi + '</b>';
      var wl2 = $('world');
      if (wl2) wl2.textContent = jinnCount().toLocaleString();
      return;
    }
    if (S.markedUntil > now()) {
      el.innerHTML = '<b class="bad">MARKED</b> — no seals for ' + Math.ceil((S.markedUntil - now()) / 60000) + ' min';
    } else if (best) {
      var h = HOUSES.filter(function (x) { return x.id === best.house; })[0];
      el.innerHTML = '<b>' + h.name + '</b> · ' + roman(best.rank) + ' · ' + fmtDist(bestD) + ' ' +
        compassOf(bearing(S.player, best)) + (best.locked && !seerOn() ? ' · sealed' : '') +
        (best.flag ? ' · bound to you' : bestD <= BIND ? ' · <b>in reach</b>' : '');
    } else {
      el.innerHTML = 'nothing stirs within sight';
    }
    var wl = $('world');
    if (wl) wl.textContent = S.jinnMode ? jinnCount().toLocaleString() : S.world.toLocaleString();
    var wlab = $('lblWorld');
    if (wlab) wlab.textContent = S.jinnMode ? 'Jinn in the veil' : t('world');

    /* five paces: the music turns and the air catches fire */
    var nearDemon = false;
    if (!S.jinnMode) {
      S.demons.forEach(function (d) {
        if (haversine(S.player, d) <= BIND) nearDemon = true;
      });
    }
    document.body.classList.toggle('dread', nearDemon);
    if (window.Sound && Sound.setMode) Sound.setMode(nearDemon ? 'dread' : 'calm');
    if (nearDemon && Math.random() < 0.10) embers(10);
    var buffs = [];
    if (S.buffs.seerUntil > now()) buffs.push('sight');
    if (S.buffs.jammerUntil > now()) buffs.push('jammer');
    if (S.buffs.lanternUntil > now()) buffs.push('lantern');
    if (S.buffs.flaskUntil > now()) buffs.push('ember');
    if (S.buffs.beaconUntil > now()) buffs.push('beacon');
    if (buffs.length) el.innerHTML += '<br><span class="dim">' + buffs.join(' · ') + '</span>';

    if (best) SND.proximity(bestD);
  }

  function renderInv() {
    var bar = $('inv'), html = '';
    var keys = D.RELIC_KEYS.filter(function (k) { return (S.inv[k] || 0) > 0; });
    keys.forEach(function (k) {
      html += '<div class="slot" data-relic="' + k + '">' + SIG.icon(RELICS[k].kind, 22) +
        '<div class="n">' + S.inv[k] + '</div></div>';
    });
    if (S.servants.length) {
      html += '<div class="slot servant" data-act="servants">' +
        '<span class="sv">' + S.servants.length + '</span></div>';
    }
    if (!keys.length && !S.servants.length) html = '<div class="slot empty">' + SIG.icon('seer', 20) + '</div>';
    bar.innerHTML = html;
  }

  function seerOn() { return S.buffs.seerUntil > now(); }

  /* ------------------------------------------------------------------ */
  /* sheets                                                              */
  /* ------------------------------------------------------------------ */
  function openSheet(html) {
    var sh = $('sheet');
    sh.querySelector('.inner').innerHTML = html;
    sh.classList.remove('hidden');
  }
  function closeSheet() {
    $('sheet').classList.add('hidden');
    stopTimer(); stopCrack(); stopTypewriter();
    sheet.demon = null; sheet.chal = null; sheet.cond = null;
    pendingUse = null;
  }
  function head(badgeHTML, gold, title, sub) {
    return '<div class="sh-head"><div class="badge ' + (gold ? 'gold' : '') + '">' + badgeHTML + '</div>' +
      '<div><h2>' + title + '</h2><div class="sub">' + sub + '</div></div>' +
      '<button class="x" data-act="close">✕</button></div>';
  }
  function typewriter(el, text) {
    stopTypewriter();
    var i = 0; el.textContent = '';
    sheet.typewriter = setInterval(function () {
      i += 1; el.textContent = text.slice(0, i);
      if (i >= text.length) stopTypewriter();
    }, 22);
  }
  function stopTypewriter() { if (sheet.typewriter) { clearInterval(sheet.typewriter); sheet.typewriter = null; } }

  /* ------------------------------------------------------------------ */
  /* demon sheet                                                         */
  /* ------------------------------------------------------------------ */
  function openDemon(id) {
    var d = S.demons.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    SND.open();
    sheet.demon = id;
    var h = HOUSES.filter(function (x) { return x.id === d.house; })[0];
    var dist = haversine(S.player, d);
    var sealed = d.locked && !seerOn();
    var canFace = d.rank <= S.rank;
    var marked = S.markedUntil > now();
    var shel = inSanctum(d);

    var html = head('<div style="width:46px;height:46px">' + sig(h.id, 46, d.rank >= 9) + '</div>', false,
      h.name, 'Rank ' + roman(d.rank) + ' · ' + h.title);
    html += '<div class="lore">' + esc(h.lore) + '</div>';
    html += '<div class="quote" id="quote"></div>';
    html += '<div class="stats">' +
      '<div><b>' + fmtDist(dist) + '</b><span>distance</span></div>' +
      '<div><b>' + compassOf(bearing(S.player, d)) + '</b><span>bearing</span></div>' +
      '<div><b>' + (dist <= BIND ? 'in reach' : BIND + ' m') + '</b><span>binding</span></div>' +
      '<div><b>' + roman(d.rank) + '</b><span>rank</span></div></div>';

    if (shel) {
      html += '<p class="body bad">It is standing in a sanctum. No hunter can reach it there — not even you.</p>';
    }

    if (sealed) {
      html += '<h3 class="sec">Seal</h3>' +
        '<p class="body">Its marker is a lie. Crack it, or spend a Rift Key.</p>' +
        '<div class="mono-line">sha256(' + d.id.toUpperCase() + ':nonce) begins with ' + '0'.repeat(crackDiff(d)) + '</div>' +
        '<div class="bar gold"><i id="crackBar"></i></div>' +
        '<div class="mono-line" id="crackInfo">difficulty ' + crackDiff(d) + '</div>';
    }
    if (d.flag) {
      html += '<h3 class="sec">Bound to you</h3>' +
        '<div class="stats"><div><b>' + Math.ceil(Math.max(0, d.flag.until - now()) / 60000) + 'm</b><span>bond</span></div>' +
        '<div><b>' + (d.flag.conds || 1) + '</b><span>conditions</span></div>' +
        '<div><b>' + (d.shieldUntil > now() ? 'on' : 'off') + '</b><span>warded</span></div>' +
        '<div><b>blind</b><span>all others</span></div></div>';
    }

    html += '<div class="btnrow">';
    if (marked) {
      html += '<button class="btn" disabled>Marked — ' + Math.ceil((S.markedUntil - now()) / 60000) + ' min</button>';
    } else if (!canFace) {
      html += '<button class="btn" disabled>Requires sigil ' + roman(d.rank) + '</button>';
    } else if (d.locked) {
      html += '<button class="btn pri" data-act="crack" data-id="' + d.id + '">Crack the seal</button>';
    } else if (!d.flag) {
      if (dist <= BIND) html += '<button class="btn pri" data-act="flag" data-id="' + d.id + '">Bind it to you</button>';
      else html += '<button class="btn" disabled>' + fmtDist(dist - BIND) + ' to the binding</button>';
    } else if (dist <= BIND) {
      html += '<button class="btn pri" data-act="contact" data-id="' + d.id + '">Speak with it</button>';
    } else {
      html += '<button class="btn" disabled>Return within ' + BIND + ' m to speak</button>';
    }
    html += '<button class="btn" data-act="relics" data-id="' + d.id + '">Relics</button></div>';

    html += '<div class="btnrow">';
    if (!d.flag) html += '<button class="btn sm" data-act="flag" data-id="' + d.id + '">Bind it to you</button>';
    else html += '<button class="btn sm" data-act="unflag" data-id="' + d.id + '">Release the bond</button>';
    html += '<button class="btn sm" data-act="usekey" data-id="' + d.id + '">Rift Key</button>' +
      '<button class="btn sm" data-act="anchor" data-id="' + d.id + '">Anchor</button></div>';

    openSheet(html);
    var q = $('quote'); if (q) typewriter(q, '“' + pick(h.taunts) + '”');
  }

  /* ------------------------------------------------------------------ */
  /* binding, conditions                                                 */
  /* ------------------------------------------------------------------ */
  function flagDemon(id) {
    var d = S.demons.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    if (d.flag) { toast('Already bound.', 'bad'); return; }
    if (inSanctum(d)) { toast('It is inside a sanctum. Unreachable.', 'bad'); return; }
    var dist = haversine(S.player, d);
    if (dist > BIND) { toast('Stand within ' + BIND + ' m — you are ' + fmtDist(dist - BIND) + ' away.', 'bad'); return; }
    d.flag = { until: now() + 30 * 60000, conds: d.rank <= 3 ? 1 : d.rank <= 6 ? 2 : 3 };
    SND.ui();
    feed('You bound <b>' + houseName(d.house) + '</b>. No other hunter can see it.');
    toast('Bound. It belongs to you now.', 'good');
    openDemon(id); syncMap(); save();
  }
  function unflagDemon(id) {
    var d = S.demons.filter(function (x) { return x.id === id; })[0];
    if (d) d.flag = null;
    openDemon(id); syncMap(); save();
  }

  function houseName(hid) {
    var h = HOUSES.filter(function (x) { return x.id === hid; })[0];
    return h ? h.name : hid;
  }
  function house(hid) { return HOUSES.filter(function (x) { return x.id === hid; })[0] || HOUSES[0]; }

  function contactDemon(id) {
    var d = S.demons.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    if (!d.flag) { toast('Bind it first.', 'bad'); return; }
    if (haversine(S.player, d) > BIND) { toast('Beyond ' + BIND + ' m.', 'bad'); return; }
    if (d.rank > S.rank) { toast('Your sigil is too weak.', 'bad'); return; }
    if (S.markedUntil > now()) { toast('You are Marked.', 'bad'); return; }
    if (d.locked) { toast('Its seal is shut.', 'bad'); return; }
    var n = d.flag.conds || 1, list = [];
    for (var i = 0; i < n; i++) list.push(PZ.make(d.rank, house(d.house).cat));
    sheet.cond = { demon: id, list: list, idx: 0 };
    renderCondition();
  }

  function renderCondition() {
    var c = sheet.cond; if (!c) return;
    var d = S.demons.filter(function (x) { return x.id === c.demon; })[0];
    if (!d) { closeSheet(); return; }
    var h = house(d.house), ch = c.list[c.idx], secs = D.SEAL_TIME[d.rank] || 60;
    sheet.chal = { demon: d.id, data: ch }; sheet.demon = d.id;

    var html = head('<div style="width:40px;height:40px">' + sig(h.id, 40) + '</div>', false,
      'Condition ' + (c.idx + 1) + ' of ' + c.list.length, h.name + ' · ' + roman(d.rank));
    html += '<div class="seal-time"><i id="sealTime"></i></div>';
    html += '<div class="q">' + esc(ch.q).replace(/\n/g, '<br>') + '</div>';
    html += '<input class="ans" id="ans" autocomplete="off" autocorrect="off" spellcheck="false" ' +
      'inputmode="' + (/^[0-9]+$/.test(ch.ans[0]) ? 'numeric' : 'text') + '" placeholder="…">';
    html += '<div class="btnrow"><button class="btn pri" data-act="submit" data-id="' + d.id + '">Answer</button>' +
      '<button class="btn" data-act="flee" data-id="' + d.id + '">Withdraw</button></div>';
    if (ch.hint) html += '<div class="hint">' + esc(ch.hint) + '</div>';
    openSheet(html);
    startTimer(secs);
    var a = $('ans'); if (a) a.focus();
  }

  function startTimer(secs) {
    stopTimer();
    sheet.deadline = now() + secs * 1000;
    var lastSec = -1;
    sheet.timer = setInterval(function () {
      var left = sheet.deadline - now();
      var bar = $('sealTime');
      if (bar) bar.style.width = clamp(left / (secs * 1000) * 100, 0, 100) + '%';
      if (left > 0 && left < 5000) {
        var s = Math.ceil(left / 1000);
        if (s !== lastSec) { lastSec = s; SND.tick(); }
      }
      if (left <= 0) { stopTimer(); failSeal('The seal closed.'); }
    }, 200);
  }
  function stopTimer() { if (sheet.timer) { clearInterval(sheet.timer); sheet.timer = null; } }

  function submitSeal(val) {
    var c = sheet.cond; if (!c) return;
    var d = S.demons.filter(function (x) { return x.id === c.demon; })[0];
    if (!d) { closeSheet(); return; }
    var ch = c.list[c.idx];
    if (!ch.ans.some(function (a) { return norm(a) === norm(val); })) {
      failSeal('Wrong. The condition is refused.'); return;
    }
    c.idx++;
    if (c.idx >= c.list.length) { stopTimer(); winDemon(d); }
    else renderCondition();
  }

  function failSeal(msg) {
    stopTimer();
    var id = sheet.demon || (sheet.cond && sheet.cond.demon);
    var d = S.demons.filter(function (x) { return x.id === id; })[0];
    SND.fail(); flash(); shakeScreen();
    S.wards = Math.max(0, S.wards - 1);
    S.corruption = clamp(S.corruption + 10, 0, 100);
    if (S.wards === 0 && S.markedUntil < now()) {
      S.markedUntil = now() + R.markedMs;
      feed('You are <b>Marked</b>. The houses can smell you.');
      toast('Marked — no seals for 10 minutes.', 'bad');
    } else toast(msg || 'Failed.', 'bad');
    if (d) {
      var p = destination(d, rnd(40, 90), rnd(0, 359));
      d.lat = p.lat; d.lng = p.lng;
      if (d.locked) { var f = destination(d, rnd(70, 160), rnd(0, 359)); d.shownLat = f.lat; d.shownLng = f.lng; }
    }
    closeSheet(); syncMap(); renderHUD(); save();
  }

  /* ------------------------------------------------------------------ */
  /* winning: kill it, or take it                                        */
  /* ------------------------------------------------------------------ */
  function winDemon(d) {
    stopTimer();
    $('sheet').classList.add('hidden');
    var h = house(d.house);
    SND.kill(); flash(); shakeScreen(); embers(80);
    var cine = $('cinema');
    $('cineSigil').innerHTML = sig(h.id, 260, d.rank >= 9);
    $('cineH').textContent = h.name;
    $('cineS').textContent = 'Yielded · Rank ' + roman(d.rank);
    cine.classList.add('on');
    setTimeout(function () {
      cine.classList.remove('on');
      openSpoils(d);
    }, 2000);
  }

  function openSpoils(d) {
    var h = house(d.house);
    var slots = R.servantSlots[clamp(S.rank, 1, 10)];
    var full = S.servants.length >= slots;
    var html = head('<div style="width:44px;height:44px">' + sig(h.id, 44) + '</div>', false,
      'It yields', h.name + ' · ' + roman(d.rank));
    html += '<p class="body">The house is broken and waiting on your word. You can end it now for coin and renown, ' +
      'or take it into your service — a servant that can be wielded as a relic of its own kind.</p>';
    html += '<div class="stats"><div><b>' + S.servants.length + '/' + slots + '</b><span>servants</span></div>' +
      '<div><b>' + (10 * d.rank) + '</b><span>xp if killed</span></div>' +
      '<div><b>' + (d.rank * 2) + '</b><span>shards</span></div>' +
      '<div><b>' + R.attuneSlots[clamp(d.rank, 1, 10)] + '</b><span>attunements</span></div></div>';
    html += '<div class="btnrow">' +
      '<button class="btn dng" data-act="killNow" data-id="' + d.id + '">Kill it</button>' +
      (full
        ? '<button class="btn" disabled>Servant slots full</button>'
        : '<button class="btn pri" data-act="claim" data-id="' + d.id + '">Take it into service</button>') +
      '</div>';
    html += '<p class="body dim">A servant keeps its seat where you bound it. Stand at that seat while you collect a relic ' +
      'and the servant learns to wield that relic’s power without ever spending one.</p>';
    openSheet(html);
  }

  function killNow(id) {
    var d = S.demons.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    var gain = 10 * d.rank;
    S.xp += gain; S.shards += d.rank * 2; S.kills++; S.world = Math.max(0, S.world - 1);
    S.corruption = clamp(S.corruption - 3, 0, 100);
    removeDemon(d);
    if (window.Net) Net.queue(S, { type: 'kill', house: d.house, rank: d.rank, lat: d.lat, lng: d.lng });
    feed('You killed <b>' + houseName(d.house) + '</b> · +' + gain + ' XP');
    toast('Slain · +' + gain + ' XP', 'good');
    afterKill();
  }

  function claim(id) {
    var d = S.demons.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    var slots = R.servantSlots[clamp(S.rank, 1, 10)];
    if (S.servants.length >= slots) { toast('No servant slots left.', 'bad'); return; }
    S.servants.push({
      id: uid('sv'), house: d.house, rank: d.rank,
      seat: { lat: d.lat, lng: d.lng },
      attuned: [], cd: {}, since: now()
    });
    S.kills++;
    S.world = Math.max(0, S.world - 1);
    S.xp += Math.round(10 * d.rank * 0.5);
    removeDemon(d);
    if (window.Net) Net.queue(S, { type: 'claim', house: d.house, rank: d.rank, lat: d.lat, lng: d.lng });
    feed('You took <b>' + houseName(d.house) + '</b> into service.');
    toast(houseName(d.house) + ' is yours.', 'good');
    afterKill();
  }

  function removeDemon(d) {
    var i = S.demons.indexOf(d);
    if (i >= 0) S.demons.splice(i, 1);
    if (markers[d.id]) { map.removeLayer(markers[d.id]); delete markers[d.id]; }
  }

  function afterKill() {
    closeSheet();
    var nr = rankFor(S.xp);
    if (nr > S.rank) {
      S.rank = nr;
      SND.levelup();
      S.crestPending = true;
      feed('<b>Sigil raised to ' + roman(nr) + '</b> — ' + rankInfo(nr).name + '.');
      toast('Sigil ' + roman(nr) + ' — choose your banner.', 'good');
      setTimeout(openCrestChooser, 700);
    }
    populate(); syncMap(); renderHUD(); renderInv(); save();
  }

  /* ------------------------------------------------------------------ */
  /* cracking                                                            */
  /* ------------------------------------------------------------------ */
  function crackDiff(d) {
    var b = d.diff;
    if (seerOn()) b = Math.max(2, b - 1);
    return clamp(b, 2, 7);
  }
  function startCrack(id) {
    var d = S.demons.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    stopCrack();
    var salt = d.id.toUpperCase(), diff = crackDiff(d), prefix = '0'.repeat(diff);
    var nonce = 0, t0 = now(), hashes = 0, dead = false;
    crack = { stop: false };
    function step() {
      if (!crack || crack.stop || dead) return;
      var batch = 3000, s0 = performance.now(), found = null;
      for (var i = 0; i < batch; i++) {
        var h = PZ.sha256(salt + ':' + nonce); hashes++;
        if (h.slice(0, diff) === prefix) { found = nonce; break; }
        nonce++;
      }
      var dt = Math.max(1, performance.now() - s0), rate = Math.round(batch / (dt / 1000));
      var expected = Math.pow(16, diff);
      var bar = $('crackBar'), info = $('crackInfo');
      if (bar) bar.style.width = clamp((1 - Math.exp(-nonce / expected)) * 100, 0, 99).toFixed(1) + '%';
      if (info) info.textContent = nonce.toLocaleString() + ' hashes · ' + rate.toLocaleString() + '/s';
      if (found !== null) {
        dead = true; d.locked = false; d.shownLat = d.lat; d.shownLng = d.lng;
        S.cracked++;
        SND.crackDone();
        toast('Seal broken in ' + ((now() - t0) / 1000).toFixed(1) + ' s', 'good');
        syncMap(); save();
        if (sheet.demon === d.id) openDemon(d.id);
        crack = null; return;
      }
      setTimeout(step, 0);
    }
    step();
  }
  function stopCrack() { if (crack) crack.stop = true; crack = null; }

  /* ------------------------------------------------------------------ */
  /* relics                                                              */
  /* ------------------------------------------------------------------ */
  function openRelicPickup(id) {
    var r = S.relics.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    SND.open();
    var rel = RELICS[r.relic], dist = haversine(S.player, r);
    var html = head(SIG.icon(rel.kind, 26), true, rel.name, rel.rarity + ' · ' + fmtDist(dist));
    html += '<p class="body">' + esc(rel.effect) + '</p>';

    if (r.lock && r.lock.owner === 'me') {
      html += '<p class="body bad">You set the password on this one. A hunter cannot take back what they gave away.</p>' +
        '<div class="btnrow"><button class="btn" disabled>Cannot be reclaimed</button></div>';
    } else if (r.lock) {
      var running = hasher && hasher.relicId === r.id;
      html += '<h3 class="sec">' + t('locked_by_hunter') + '</h3>' +
        '<p class="body">' + t('no_password') + ' It needs <b>' + r.lock.zeros + ' zeroes</b> — about ' +
        fmtTime(estimate(r.lock.zeros, 70000)) + ' on a phone like this.</p>' +
        '<div class="bar gold"><i id="crackBar" style="width:' + (S.cracks[r.id] ? '8%' : '0') + '"></i></div>' +
        '<div class="mono-line" id="crackInfo">' + (running ? 'running…' : (S.cracks[r.id] ? 'paused at ' + S.cracks[r.id].toLocaleString() : 'idle')) + '</div>' +
        '<div class="btnrow">' +
        (dist > R.relicPickup
          ? '<button class="btn" disabled>Walk within ' + R.relicPickup + ' m</button>'
          : (running
            ? '<button class="btn dng" data-act="hasherStop">' + t('hasher_stop') + '</button>'
            : '<button class="btn pri" data-act="hasherStart" data-id="' + r.id + '">' +
              (S.cracks[r.id] ? t('hasher_resume') : t('hasher_start')) + '</button>')) +
        '<button class="btn" data-act="hasherPanel" data-id="' + r.id + '">Details</button></div>';
    } else {
      html += '<div class="btnrow">' + (dist <= R.relicPickup
        ? '<button class="btn pri" data-act="take" data-id="' + r.id + '">Take it</button>'
        : '<button class="btn" disabled>Walk within ' + R.relicPickup + ' m</button>') + '</div>';
    }
    openSheet(html);
  }

  function tryRelicPassword(id) {
    var r = S.relics.filter(function (x) { return x.id === id; })[0];
    if (!r || !r.lock) return;
    if (haversine(S.player, r) > R.relicPickup) { toast('Too far.', 'bad'); return; }
    var val = String(($('pwd') || {}).value || '').trim().toLowerCase();
    if (PZ.sha256(r.lock.salt + ':' + val) === r.lock.hash) {
      S.cracked++; SND.crackDone(); toast('The lock opens.', 'good'); takeRelic(id);
    } else { SND.fail(); toast('Wrong password.', 'bad'); }
  }

  function crackRelic(id) {
    var r = S.relics.filter(function (x) { return x.id === id; })[0];
    if (!r || !r.lock) return;
    if (haversine(S.player, r) > R.relicPickup) { toast('Too far.', 'bad'); return; }
    if (r.lock.len > 4) { toast('Too long to break. You need the word.', 'bad'); return; }
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789', n = r.lock.len;
    var total = Math.pow(36, n), idx = 0, salt = r.lock.salt, hash = r.lock.hash;
    var job = { stop: false }; crack = job;
    function step() {
      if (job.stop) return;
      var batch = 20000, found = null;
      for (var i = 0; i < batch && idx < total; i++, idx++) {
        var x = idx, guess = '';
        for (var k = 0; k < n; k++) { guess = chars[x % 36] + guess; x = Math.floor(x / 36); }
        if (PZ.sha256(salt + ':' + guess) === hash) { found = guess; break; }
      }
      var bar = $('crackBar'), info = $('crackInfo');
      if (bar) bar.style.width = clamp(idx / total * 100, 0, 100) + '%';
      if (info) info.textContent = idx.toLocaleString() + ' / ' + total.toLocaleString();
      if (found) { crack = null; S.cracked++; SND.crackDone(); toast('Broken: ' + found, 'good'); takeRelic(id); return; }
      if (idx >= total) { crack = null; toast('No such password.', 'bad'); return; }
      setTimeout(step, 0);
    }
    step();
  }

  function takeRelic(id) {
    var r = S.relics.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    if (haversine(S.player, r) > R.relicPickup) { toast('Too far.', 'bad'); return; }
    S.inv[r.relic] = (S.inv[r.relic] || 0) + 1;
    S.relics = S.relics.filter(function (x) { return x.id !== id; });
    if (markers[id]) { map.removeLayer(markers[id]); delete markers[id]; }
    SND.ui();

    /* did we collect it at the seat of one of our own servants? */
    var attuned = null;
    S.servants.forEach(function (sv) {
      if (attuned) return;
      if (haversine(S.player, sv.seat) > R.attuneRange) return;
      var slots = R.attuneSlots[clamp(sv.rank, 1, 10)];
      if (sv.attuned.length >= slots) return;
      var kind = RELICS[r.relic].kind;
      if (sv.attuned.indexOf(kind) >= 0) return;
      sv.attuned.push(kind);
      attuned = { sv: sv, kind: kind };
    });

    feed('Took <b>' + RELICS[r.relic].name + '</b>.');
    if (attuned) {
      toast(houseName(attuned.sv.house) + ' learned to wield ' + RELICS[r.relic].name + '’s power.', 'good');
      feed('<b>' + houseName(attuned.sv.house) + '</b> attuned to ' + RELICS[r.relic].kind + '.');
    } else toast('Took ' + RELICS[r.relic].name, 'good');
    closeSheet(); renderInv(); syncMap(); save();
  }

  /* ------------------------------------------------------------------ */
  /* relic detail and use                                                */
  /* ------------------------------------------------------------------ */
  function openRelicDetail(relicId) {
    var rel = RELICS[relicId], n = S.inv[relicId] || 0;
    SND.open();
    var html = head(SIG.icon(rel.kind, 26), true, rel.name, rel.rarity + ' · owned ×' + n);
    html += '<p class="body">' + esc(rel.effect) + '</p>';
    html += '<p class="body dim">Using it drops the relic where you stand, locked with a password you choose. ' +
      'You can never take it back.</p>';
    html += '<div class="btnrow"><button class="btn pri" data-act="askPwd" data-kind="' + relicId + '">Use and drop it</button></div>';
    openSheet(html);
  }

  function askPassword(relicId, demonId) {
    /* no password is ever typed: the seal is made by the game */
    var rel = RELICS[relicId];
    if (!rel || (S.inv[relicId] || 0) <= 0) { toast('None left.', 'bad'); return; }
    var d = demonId ? S.demons.filter(function (x) { return x.id === demonId; })[0] : null;
    if (rel.kind === 'key' && (!d || !d.locked)) { toast('Nothing to open.', 'bad'); return; }
    if (rel.kind === 'shield' && (!d || !d.flag)) { toast('Bind it first.', 'bad'); return; }
    if (rel.kind === 'ward' && S.wards >= R.maxWards) { toast('Wards are full.', 'bad'); return; }
    if ((rel.kind === 'anchor' || rel.kind === 'key' || rel.kind === 'shield') && !d) { toast('Choose a demon first.', 'bad'); return; }
    applyRelic(relicId, d);
  }

  function applyRelic(relicId, d) {
    var rel = RELICS[relicId];
    if (!rel || (S.inv[relicId] || 0) <= 0) { toast('None left.', 'bad'); return; }
    if (rel.kind === 'ward' && S.wards >= R.maxWards) { toast('Wards are full.', 'bad'); return; }

    S.inv[relicId]--;
    if (S.inv[relicId] <= 0) delete S.inv[relicId];
    applyEffect(rel, d, null);

    /* the game makes the seal: a nonce nobody is told, stored only as a hash */
    var id = uid('r'), salt = id.toUpperCase();
    var zeros = rel.zeros || 7;
    var nonce = 0, hash = '';
    /* the password is the nonce itself, and only its hash is kept */
    nonce = Math.floor(Math.random() * 1e9);
    hash = PZ.sha256(salt + ':' + nonce);
    /* make it a real target: pick a nonce whose hash has the required zeros */
    var target = '0'.repeat(zeros);
    while (hash.slice(0, zeros) !== target) { nonce++; hash = PZ.sha256(salt + ':' + nonce); }

    S.relics.push({
      id: id, relic: relicId, lat: S.player.lat, lng: S.player.lng,
      lock: { salt: salt, hash: hash, zeros: zeros, owner: 'me' }
    });
    pendingUse = null;
    SND.ui();
    feed('You used <b>' + rel.name + '</b> and left it sealed behind you — ' + zeros + ' zeroes.');
    toast(rel.name + ' used and sealed (' + zeros + ' zeroes).', 'good');
    closeSheet(); renderInv(); renderHUD(); syncMap(); save();
  }

  /* one function applies every effect, whether it came from a relic or a servant */
  function applyEffect(rel, demon, servant) {
    var t = now(), m = rel.mag || 1;
    switch (rel.kind) {
      case 'seer': S.buffs.seerUntil = t + m * 60000; break;
      case 'anchor': if (demon) demon.frozenUntil = t + m * 60000; break;
      case 'key': if (demon) { demon.locked = false; demon.shownLat = demon.lat; demon.shownLng = demon.lng; } break;
      case 'shield': if (demon) demon.shieldUntil = t + m * 60000; break;
      case 'veil': if (demon) demon.veiledUntil = t + m * 60000; break;
      case 'lantern': S.buffs.lanternUntil = t + m * 60000; break;
      case 'jammer': S.buffs.jammerUntil = t + m * 60000; break;
      case 'ward': S.wards = Math.min(R.maxWards, S.wards + 1); break;
      case 'flask': S.buffs.flaskUntil = t + m * 60000; break;
      case 'beacon': S.buffs.beaconUntil = t + m * 60000; break;
      case 'mending': S.corruption = clamp(S.corruption - m, 0, 100); break;
      case 'fortune': S.shards += m; break;
    }
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* the hasher — background proof of work                               */
  /* ------------------------------------------------------------------ */
  var hasher = null, hasherTimer = null;

  function estimate(zeros, rate) {
    var expected = Math.pow(16, zeros);
    var secs = expected / (rate || 60000);
    return secs;
  }
  function fmtTime(sec) {
    if (!isFinite(sec)) return '—';
    if (sec < 90) return Math.round(sec) + 's';
    if (sec < 5400) return Math.round(sec / 60) + 'm';
    return (sec / 3600).toFixed(1) + 'h';
  }

  function openHasher(relicId) {
    var r = S.relics.filter(function (x) { return x.id === relicId; })[0];
    if (!r || !r.lock) return;
    var running = hasher && hasher.relicId === relicId;
    var html = head('⚒', true, 'The hasher', 'sealed by another hunter');
    html += '<p class="body">Nobody types a password. The seal is a hash made by the game: the phone must find a number ' +
      'whose hash begins with <b>' + r.lock.zeros + ' zeroes</b>. It runs in the background while you hunt.</p>';
    html += '<div class="stats"><div><b>' + r.lock.zeros + '</b><span>zeroes</span></div>' +
      '<div><b>' + Math.pow(16, r.lock.zeros).toLocaleString() + '</b><span>expected</span></div>' +
      '<div><b id="hRate">—</b><span>' + t('hashrate') + '</span></div>' +
      '<div><b id="hEta">—</b><span>' + t('eta') + '</span></div></div>';
    html += '<div class="bar gold"><i id="crackBar"></i></div>' +
      '<div class="mono-line" id="crackInfo">' + (running ? 'running…' : 'idle') + '</div>';
    html += '<div class="btnrow">' +
      (running
        ? '<button class="btn dng" data-act="hasherStop">' + t('hasher_stop') + '</button>'
        : '<button class="btn pri" data-act="hasherStart" data-id="' + r.id + '">' + t('hasher_start') + '</button>') +
      (S.cracks[r.id] ? '<button class="btn" data-act="hasherAbandon" data-id="' + r.id + '">' + t('hasher_abandon') + '</button>' : '') +
      '</div>';
    openSheet(html);
    if (running) paintHasher();
  }

  function startHasher(relicId) {
    var r = S.relics.filter(function (x) { return x.id === relicId; })[0];
    if (!r || !r.lock) return;
    hasher = { relicId: relicId, salt: r.lock.salt, zeros: r.lock.zeros, nonce: S.cracks[relicId] || 0, rate: 0 };
    Cracker.start({
      id: relicId, salt: r.lock.salt, zeros: r.lock.zeros, nonce: hasher.nonce,
      onProgress: function (nonce, rate) {
        if (!hasher) return;
        hasher.nonce = nonce; hasher.rate = rate;
        S.cracks[relicId] = nonce;
        paintHasher();
      },
      onFound: function (nonce) {
        var rr = S.relics.filter(function (x) { return x.id === relicId; })[0];
        hasher = null;
        if (rr) { rr.lock.hash = rr.lock.hash; }
        delete S.cracks[relicId];
        S.cracked++;
        SND.crackDone();
        toast('The seal opens.', 'good');
        feed('Your phone broke a seal — ' + nonce.toLocaleString() + ' hashes in.');
        takeRelic(relicId);
      }
    });
    hasherTimer = setInterval(paintHasher, 900);
    toast('Hasher running in the background.', 'good');
    openHasher(relicId);
  }

  function stopHasher() {
    Cracker.stop();
    if (hasherTimer) { clearInterval(hasherTimer); hasherTimer = null; }
    var id = hasher && hasher.relicId;
    hasher = null;
    toast('Hasher stopped.', null);
    if (id) openHasher(id);
  }

  function abandonHasher(relicId) {
    Cracker.stop();
    delete S.cracks[relicId];
    if (hasher && hasher.relicId === relicId) hasher = null;
    toast('Abandoned. The progress is lost.', 'bad');
    openHasher(relicId); save();
  }

  function paintHasher() {
    var bar = $('crackBar'), info = $('crackInfo'), rateEl = $('hRate'), etaEl = $('hEta');
    if (!hasher) return;
    var expected = Math.pow(16, hasher.zeros);
    var pct = (1 - Math.exp(-hasher.nonce / expected)) * 100;
    if (bar) bar.style.width = clamp(pct, 0, 99.9).toFixed(1) + '%';
    if (rateEl) rateEl.textContent = hasher.rate ? hasher.rate.toLocaleString() + '/s' : '—';
    if (etaEl) etaEl.textContent = hasher.rate ? fmtTime(estimate(hasher.zeros, hasher.rate)) : '—';
    if (info) info.textContent = hasher.nonce.toLocaleString() + ' hashes tried · ' + pct.toFixed(1) + '%';
  }

  /* ------------------------------------------------------------------ */
  /* servants                                                            */
  /* ------------------------------------------------------------------ */
  function openServants() {
    SND.open();
    var slots = R.servantSlots[clamp(S.rank, 1, 10)];
    var html = head('⚔', true, 'Your household', S.servants.length + ' of ' + slots + ' servants');
    if (!S.servants.length) {
      html += '<p class="body">You own nothing yet. Bind a demon at ' + BIND + ' m, break its conditions, and choose to take it ' +
        'into service instead of killing it.</p>';
    }
    S.servants.forEach(function (sv) {
      var h = house(sv.house);
      html += '<div class="row"><div class="ic">' + sig(h.id, 42, sv.rank >= 9) + '</div>' +
        '<div style="flex:1"><div class="t">' + h.name + ' <small>' + roman(sv.rank) + ' · ' +
        sv.attuned.length + '/' + R.attuneSlots[clamp(sv.rank, 1, 10)] + ' attuned</small></div>' +
        '<div class="d">' + (sv.attuned.length ? sv.attuned.map(function (k) { return k; }).join(' · ') : 'no powers learned') + '</div>' +
        '<div class="btnrow" style="margin-top:6px">' +
        '<button class="btn sm" data-act="svUse" data-id="' + sv.id + '">Wield</button>' +
        '<button class="btn sm" data-act="svKill" data-id="' + sv.id + '">Kill</button>' +
        '<button class="btn sm" data-act="svVault" data-id="' + sv.id + '">Vault</button>' +
        '</div></div></div>';
    });
    openSheet(html);
  }

  function servant(id) { return S.servants.filter(function (x) { return x.id === id; })[0]; }

  function openServantPowers(id) {
    var sv = servant(id);
    if (!sv) return;
    var h = house(sv.house);
    var html = head('<div style="width:42px;height:42px">' + sig(h.id, 42) + '</div>', false,
      h.name, 'wield as a relic');
    if (!sv.attuned.length) {
      html += '<p class="body">It has learned nothing. Stand at its seat — ' + fmtDist(haversine(S.player, sv.seat)) +
        ' from you — and collect a relic there. The house will learn to wield that relic’s power without spending one.</p>';
    } else {
      html += '<p class="body">Each power may be called once every 30 minutes, and costs you nothing.</p>';
      sv.attuned.forEach(function (kind) {
        var ready = (sv.cd[kind] || 0) < now();
        var mins = Math.ceil(((sv.cd[kind] || 0) - now()) / 60000);
        var sample = null;
        for (var i = 0; i < D.RELIC_KEYS.length; i++) {
          if (RELICS[D.RELIC_KEYS[i]].kind === kind) { sample = RELICS[D.RELIC_KEYS[i]]; break; }
        }
        html += '<div class="row"><div class="ic gold">' + SIG.icon(kind, 26) + '</div>' +
          '<div style="flex:1"><div class="t">' + kind + '</div><div class="d">' +
          esc(sample ? sample.effect : kind) + '</div></div>' +
          (ready
            ? '<button class="btn sm" data-act="svCast" data-id="' + sv.id + '" data-kind="' + kind + '">Wield</button>'
            : '<button class="btn sm" disabled>' + mins + 'm</button>') + '</div>';
      });
    }
    openSheet(html);
  }

  function castServant(id, kind) {
    var sv = servant(id);
    if (!sv || sv.attuned.indexOf(kind) < 0) return;
    if ((sv.cd[kind] || 0) > now()) { toast('Not yet.', 'bad'); return; }
    var sample = null;
    for (var i = 0; i < D.RELIC_KEYS.length; i++) {
      if (RELICS[D.RELIC_KEYS[i]].kind === kind) { sample = RELICS[D.RELIC_KEYS[i]]; break; }
    }
    if (!sample) return;
    if (kind === 'anchor' || kind === 'key' || kind === 'shield') { toast('That power needs a demon in front of you.', 'bad'); return; }
    applyEffect(sample, null, sv);
    sv.cd[kind] = now() + 30 * 60000;
    SND.ui();
    toast(houseName(sv.house) + ' wields ' + kind + '.', 'good');
    feed('<b>' + houseName(sv.house) + '</b> wielded ' + kind + '.');
    closeSheet(); renderHUD(); syncMap(); save();
  }

  function killServant(id) {
    var sv = servant(id);
    if (!sv) return;
    if (!confirm('Kill ' + houseName(sv.house) + '? You lose it for good.')) return;
    S.servants = S.servants.filter(function (x) { return x.id !== id; });
    S.shards += 5 + sv.rank * 2;
    S.xp += 5 * sv.rank;
    feed('You put <b>' + houseName(sv.house) + '</b> down.');
    toast('Killed. Shards taken.', null);
    closeSheet(); renderInv(); renderHUD(); save();
  }

  /* ------------------------------------------------------------------ */
  /* the vault                                                           */
  /* ------------------------------------------------------------------ */
  var vaultOpen = false;
  function openVault() {
    SND.open();
    var v = S.vault;
    var html = head('▣', true, 'The Vault', v.hash ? (vaultOpen ? 'open' : 'sealed') : 'no password set');

    if (!v.hash) {
      html += '<p class="body">Lock relics and servants away behind a password. Anything inside cannot be used and ' +
        'cannot be taken from you in a duel.</p>' +
        '<p class="body bad">Write the password down. If you forget it, the vault stays shut forever — there is no recovery.</p>' +
        '<input class="ans" id="vpwd" autocomplete="off" spellcheck="false" placeholder="vault password (min 6)">' +
        '<div class="btnrow"><button class="btn pri" data-act="vaultSet">Set the password</button></div>';
      openSheet(html); return;
    }
    if (!vaultOpen) {
      html += '<p class="body">Sealed. Type the vault password to open it.</p>' +
        '<input class="ans" id="vpwd" autocomplete="off" spellcheck="false" placeholder="vault password">' +
        '<div class="btnrow"><button class="btn pri" data-act="vaultUnlock">Open</button></div>';
      openSheet(html); return;
    }

    html += '<h3 class="sec">Inside</h3>';
    var any = false;
    Object.keys(v.relics).forEach(function (k) {
      if (!v.relics[k]) return; any = true;
      html += '<div class="row"><div class="ic gold">' + SIG.icon(RELICS[k].kind, 26) + '</div>' +
        '<div style="flex:1"><div class="t">' + RELICS[k].name + ' <small>×' + v.relics[k] + '</small></div></div>' +
        '<button class="btn sm" data-act="vaultTake" data-kind="' + k + '">Withdraw</button></div>';
    });
    v.servants.forEach(function (sv) {
      any = true;
      html += '<div class="row"><div class="ic">' + sig(sv.house, 36) + '</div>' +
        '<div style="flex:1"><div class="t">' + houseName(sv.house) + ' <small>' + roman(sv.rank) + '</small></div></div>' +
        '<button class="btn sm" data-act="vaultTakeSv" data-id="' + sv.id + '">Withdraw</button></div>';
    });
    if (!any) html += '<p class="body dim">Empty.</p>';

    html += '<h3 class="sec">Put away</h3>';
    var put = false;
    Object.keys(S.inv).forEach(function (k) {
      if (!S.inv[k]) return; put = true;
      html += '<div class="row"><div class="ic gold">' + SIG.icon(RELICS[k].kind, 24) + '</div>' +
        '<div style="flex:1"><div class="t">' + RELICS[k].name + ' <small>×' + S.inv[k] + '</small></div></div>' +
        '<button class="btn sm" data-act="vaultPut" data-kind="' + k + '">Store</button></div>';
    });
    S.servants.forEach(function (sv) {
      put = true;
      html += '<div class="row"><div class="ic">' + sig(sv.house, 34) + '</div>' +
        '<div style="flex:1"><div class="t">' + houseName(sv.house) + '</div></div>' +
        '<button class="btn sm" data-act="vaultPutSv" data-id="' + sv.id + '">Store</button></div>';
    });
    if (!put) html += '<p class="body dim">Nothing to store.</p>';
    html += '<div class="btnrow"><button class="btn sm" data-act="vaultClose">Seal the vault</button></div>';
    openSheet(html);
  }

  function vaultSet() {
    var p = String(($('vpwd') || {}).value || '').trim();
    if (p.length < 6) { toast('At least six characters.', 'bad'); return; }
    var salt = uid('v');
    S.vault.salt = salt;
    S.vault.hash = PZ.sha256(salt + ':' + p);
    vaultOpen = true;
    toast('Vault password set. Do not forget it.', 'good');
    feed('You sealed a vault with a new password.');
    openVault(); save();
  }
  function vaultUnlock() {
    var p = String(($('vpwd') || {}).value || '').trim();
    if (PZ.sha256(S.vault.salt + ':' + p) === S.vault.hash) {
      vaultOpen = true; SND.crackDone(); openVault();
    } else { SND.fail(); toast('Wrong password.', 'bad'); }
  }
  function vaultPut(kind) {
    if (!S.inv[kind]) return;
    S.inv[kind]--; if (!S.inv[kind]) delete S.inv[kind];
    S.vault.relics[kind] = (S.vault.relics[kind] || 0) + 1;
    openVault(); renderInv(); save();
  }
  function vaultTake(kind) {
    if (!S.vault.relics[kind]) return;
    S.vault.relics[kind]--;
    if (!S.vault.relics[kind]) delete S.vault.relics[kind];
    S.inv[kind] = (S.inv[kind] || 0) + 1;
    openVault(); renderInv(); save();
  }
  function vaultPutSv(id) {
    var sv = servant(id); if (!sv) return;
    S.servants = S.servants.filter(function (x) { return x.id !== id; });
    S.vault.servants.push(sv);
    openVault(); renderInv(); save();
  }
  function vaultTakeSv(id) {
    var sv = S.vault.servants.filter(function (x) { return x.id === id; })[0];
    if (!sv) return;
    S.vault.servants = S.vault.servants.filter(function (x) { return x.id !== id; });
    S.servants.push(sv);
    openVault(); renderInv(); save();
  }

  /* ------------------------------------------------------------------ */
  /* the jinn dimension                                                  */
  /* ------------------------------------------------------------------ */
  var jinnLayer = null;

  function toggleJinn() {
    S.jinnMode = !S.jinnMode;
    if (S.jinnMode) {
      if (tiles) { map.removeLayer(tiles); tiles = null; }
      jinnLayer = Jinn.layer().addTo(map);
      Object.keys(markers).forEach(function (k) {
        if (k.indexOf('peer_') === 0) return;
        map.removeLayer(markers[k]); delete markers[k];
      });
      if (!S.jinns.length) {
        var R = Math.random;
        for (var i = 0; i < 220; i++) S.jinns.push(Jinn.spawnJinn(S.player, R));
      }
      document.body.classList.add('jinnmode');
      syncJinn();
      toast('You step sideways. The jinn see you.', 'good');
      feed('<b>You entered the jinn dimension.</b> ' + jinnCount().toLocaleString() + ' of them walk here.');
    } else {
      if (jinnLayer) { map.removeLayer(jinnLayer); jinnLayer = null; }
      Object.keys(markers).forEach(function (k) {
        if (k.indexOf('j') === 0 && markers[k]._jinn) { map.removeLayer(markers[k]); delete markers[k]; }
      });
      document.body.classList.remove('jinnmode');
      setTiles(S.tiles);
      syncMap();
      toast('You return to the world.', null);
    }
    renderHUD(); save();
  }

  function jinnCount() { return Math.max(0, S.demons.length) * 1000; }

  function syncJinn() {
    var live = {};
    var sorted = S.jinns.slice().sort(function (a, b) { return a.level - b.level; });
    sorted.slice(-160).forEach(function (j) {
      live[j.id] = 1;
      var size = 14 + Math.min(18, Math.floor(j.level / 3));
      var m = markers[j.id];
      if (!m) {
        m = L.marker([j.lat, j.lng], {
          icon: L.divIcon({
            className: 'mkwrap',
            html: '<div class="jinn" style="width:' + size + 'px;height:' + size + 'px;color:' + j.colour +
              ';border-color:' + j.colour + '"><span>' + j.level + '</span></div>',
            iconSize: [size, size], iconAnchor: [size / 2, size / 2]
          }),
          zIndexOffset: 400 + j.level
        });
        m._jinn = true;
        m.on('click', function () { openJinn(j.id); });
        m.addTo(map); markers[j.id] = m;
      } else m.setLatLng([j.lat, j.lng]);
    });
    Object.keys(markers).forEach(function (k) {
      if (markers[k]._jinn && !live[k]) { map.removeLayer(markers[k]); delete markers[k]; }
    });
  }

  function openJinn(id) {
    var j = S.jinns.filter(function (x) { return x.id === id; })[0];
    if (!j) return;
    SND.open();
    var html = head('<div style="width:34px;height:34px;border-radius:50%;border:2px solid ' + j.colour +
      ';display:flex;align-items:center;justify-content:center;color:' + j.colour + ';font-family:Cinzel,serif">' +
      j.level + '</div>', false, 'Jinn of the ' + j.level + ordinal(j.level) + ' veil',
      'level ' + j.level + ' of 50 · speed ' + Jinn.speedOf(j.level).toFixed(2) + ' m/s');
    html += '<p class="body">' + (j.level >= 40
      ? 'One of the great ones. It has never been bound, and it knows you are looking.'
      : j.level >= 20
        ? 'Old enough to have a name it will not give you.'
        : 'A lesser jinn, curious and quick, harmless until it is not.') + '</p>';
    html += '<div class="mono-line">' + j.lat.toFixed(5) + ', ' + j.lng.toFixed(5) + '</div>';
    html += '<p class="body dim">Jinn are not bound like houses. They are watched, marked, and remembered.</p>';
    openSheet(html);
  }

  function ordinal(n) {
    var s2 = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return s2[(v - 20) % 10] || s2[v] || s2[0];
  }

  /* ------------------------------------------------------------------ */
  /* the market — trade and buy, never fight                             */
  /* ------------------------------------------------------------------ */
  var TRADERS = ['Ser Arryn', 'Black Brother', 'The Quiet Hour', 'Vex of Salt', 'Mother Moth',
    'Grey Kestrel', 'The Salt Rook', 'Nine', 'Ashwalker', 'Lady Thorn', 'The Pale Fox', 'Hexwolf'];

  function makeTraders() {
    S.rivals = [];
    for (var i = 0; i < 6; i++) {
      var offer = pick(D.RELIC_KEYS);
      S.rivals.push({
        id: uid('tr'),
        name: TRADERS[(i * 3 + rnd(0, 2)) % TRADERS.length],
        crest: rnd(0, 99),
        relic: offer,
        price: Math.round(RELICS[offer].cost * (1.4 + Math.random() * 1.6)),
        wants: pick(D.RELIC_KEYS)
      });
    }
  }

  function openMarket() {
    SND.open();
    if (!S.rivals.length) makeTraders();
    var html = head('⚖', true, t('war'), t('shards') + ' · ' + S.shards);
    html += '<p class="body">No hunter fights another here. You buy from the traders who walk the rift, and you sell ' +
      'what you no longer need. Offers you post travel with the online layer.</p>';

    html += '<h3 class="sec">For sale</h3>';
    S.rivals.forEach(function (tr) {
      var r = RELICS[tr.relic];
      html += '<div class="row"><div class="ic" style="width:34px;height:42px">' + CR.svg(D.CRESTS[tr.crest], 32) + '</div>' +
        '<div style="flex:1"><div class="t">' + r.name + ' <small>' + tr.price + ' shards</small></div>' +
        '<div class="d">' + tr.name + ' · ' + r.rarity + ' · ' + esc(r.effect) + '</div></div>' +
        '<button class="btn sm" data-act="buyOffer" data-id="' + tr.id + '">Buy</button></div>';
    });

    html += '<h3 class="sec">Your satchel</h3>';
    var any = false;
    Object.keys(S.inv).forEach(function (k) {
      if (!S.inv[k]) return;
      any = true;
      var r = RELICS[k];
      html += '<div class="row"><div class="ic gold">' + SIG.icon(r.kind, 24) + '</div>' +
        '<div style="flex:1"><div class="t">' + r.name + ' <small>×' + S.inv[k] + '</small></div></div>' +
        '<button class="btn sm" data-act="sellRelic" data-kind="' + k + '">Sell ' + Math.round(r.cost * 0.6) + '</button></div>';
    });
    if (!any) html += '<p class="body dim">Nothing to sell.</p>';

    html += '<div class="btnrow"><button class="btn sm" data-act="refreshMarket">New traders</button>' +
      '<button class="btn sm" data-act="postOffer">Post an offer online</button></div>';
    openSheet(html);
  }

  function buyOffer(id) {
    var tr = S.rivals.filter(function (x) { return x.id === id; })[0];
    if (!tr) return;
    if (S.shards < tr.price) { toast('Not enough shards.', 'bad'); return; }
    S.shards -= tr.price;
    S.inv[tr.relic] = (S.inv[tr.relic] || 0) + 1;
    SND.ui();
    toast('Bought ' + RELICS[tr.relic].name, 'good');
    feed('You bought <b>' + RELICS[tr.relic].name + '</b> for ' + tr.price + ' shards.');
    if (window.Net) Net.queue(S, { type: 'buy', relic: tr.relic, price: tr.price });
    renderInv(); renderHUD(); openMarket(); save();
  }

  function sellRelic(kind) {
    if (!S.inv[kind]) return;
    var price = Math.round(RELICS[kind].cost * 0.6);
    S.inv[kind]--;
    if (!S.inv[kind]) delete S.inv[kind];
    S.shards += price;
    toast('Sold for ' + price + ' shards.', 'good');
    feed('You sold <b>' + RELICS[kind].name + '</b> for ' + price + ' shards.');
    if (window.Net) Net.queue(S, { type: 'sell', relic: kind, price: price });
    renderInv(); renderHUD(); openMarket(); save();
  }

  /* ------------------------------------------------------------------ */
  /* other hunters, when a server is configured                           */
  /* ------------------------------------------------------------------ */
  function renderPeers() {
    var list = window.Net ? Net.peers() : [];
    Object.keys(markers).forEach(function (k) {
      if (k.indexOf('peer_') === 0) { map.removeLayer(markers[k]); delete markers[k]; }
    });
    list.forEach(function (p) {
      var crest = D.CRESTS[(p.id || '').length % 100] || D.CRESTS[0];
      var m = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: 'mkwrap',
          html: '<div class="peer">' + CR.svg(crest, 22) + '</div>',
          iconSize: [24, 30], iconAnchor: [12, 15]
        }),
        zIndexOffset: 700, interactive: false
      }).addTo(map);
      markers['peer_' + p.id] = m;
    });
  }

  function toggleOnline() {
    if (!window.Net) return;
    if (!Net.configured()) { toast('No server set. Add your URL in js/net.js.', 'bad'); return; }
    if (Net.isOn()) { Net.stop(); renderPeers(); toast('Online off — everything stays on the phone.', null); }
    else { Net.start(S, renderPeers); toast('Online on. Other hunters nearby will appear.', 'good'); }
    openMenu(); save();
  }

  /* ------------------------------------------------------------------ */
  /* crests                                                              */
  /* ------------------------------------------------------------------ */
  function crestUnlocked() { return D.CREST_UNLOCK[clamp(S.rank, 1, 10) - 1]; }

  function openCrestChooser() {
    var n = crestUnlocked();
    SND.open();
    var html = head(CR.svg(D.CRESTS[S.crest], 34), true, 'Choose your banner',
      S.crestPending ? 'sigil ' + roman(S.rank) + ' · ' + n + ' banners unlocked' : 'banners unlocked: ' + n);
    html += '<p class="body">Your banner is how other hunters see you on the map. You may choose once at each sigil, ' +
      'and you cannot change it until the next.</p>';
    html += '<div class="crestgrid">';
    for (var i = 0; i < n; i++) {
      html += '<button class="crestcell ' + (i === S.crest ? 'on' : '') + '" data-act="pickCrest" data-idx="' + i + '">' +
        CR.svg(D.CRESTS[i], 46) + '<span>' + (i + 1) + '</span></button>';
    }
    html += '</div>';
    openSheet(html);
  }

  function pickCrest(idx) {
    if (idx >= crestUnlocked()) { toast('Not unlocked.', 'bad'); return; }
    if (!S.crestPending && idx === S.crest) { closeSheet(); return; }
    if (!S.crestPending) { toast('You chose your banner at this sigil.', 'bad'); return; }
    S.crest = idx;
    S.crestRank = S.rank;
    S.crestPending = false;
    SND.levelup();
    toast('Banner chosen.', 'good');
    feed('You raised the banner of <b>' + D.CRESTS[idx].name + '</b>.');
    closeSheet(); syncMap(); renderHUD(); save();
  }

  /* ------------------------------------------------------------------ */
  /* codex, journal, menu                                                */
  /* ------------------------------------------------------------------ */
  function openCodex() {
    SND.open();
    var html = head('◈', true, t('codex'), '100 houses · 100 relics · five pages each');
    html += '<h3 class="sec">The houses</h3>';
    HOUSES.forEach(function (h) {
      html += '<div class="row tap" data-act="houseOpen" data-id="' + h.id + '">' +
        '<div class="ic">' + sig(h.id, 34, h.rank >= 9) + '</div>' +
        '<div><div class="t">' + h.name + ' <small>' + roman(h.rank) + ' · ' + h.title + '</small></div>' +
        '<div class="d">' + esc(h.rule) + '</div></div></div>';
    });
    html += '<h3 class="sec">Relics</h3>';
    D.RELIC_KEYS.forEach(function (k) {
      var r = RELICS[k];
      html += '<div class="row tap" data-act="relicInfo" data-id="' + k + '">' +
        '<div class="ic gold">' + SIG.icon(r.kind, 24) + '</div>' +
        '<div><div class="t">' + r.name + ' <small>' + r.rarity + '</small></div>' +
        '<div class="d">' + esc(r.effect) + '</div></div></div>';
    });
    openSheet(html);
  }

  function pager(kind, id, page, total) {
    var h = '<div class="btnrow">';
    h += '<button class="btn sm" data-act="' + (kind === 'house' ? 'pageHouse' : 'pageRelic') + '" data-id="' + id +
      '" data-page="' + Math.max(0, page - 1) + '"' + (page === 0 ? ' disabled' : '') + '>‹ ' + t('prev') + '</button>';
    h += '<button class="btn sm" disabled>' + (page + 1) + ' / ' + total + '</button>';
    h += '<button class="btn sm" data-act="' + (kind === 'house' ? 'pageHouse' : 'pageRelic') + '" data-id="' + id +
      '" data-page="' + Math.min(total - 1, page + 1) + '"' + (page >= total - 1 ? ' disabled' : '') + '> ' + t('next') + ' ›</button>';
    return h + '</div>';
  }

  function openHouse(id, page) {
    var h = house(id);
    var pages = h.pages || [];
    page = clamp(page || 0, 0, pages.length - 1);
    var p = pages[page];
    var html = head('<div style="width:44px;height:44px">' + sig(h.id, 44, h.rank >= 9) + '</div>', false,
      h.name, roman(h.rank) + ' · ' + h.title);
    html += '<div class="lore">' + esc(h.lore) + '</div>';
    html += '<h3 class="sec">' + t(['origin', 'powers', 'weakness', 'life', 'rumour'][page] || 'origin') + '</h3>';
    html += '<p class="body">' + esc(p ? p.body : '') + '</p>';
    html += '<div class="mono-line">' + h.speed.toFixed(2) + ' m/s · ' + h.rule + '</div>';
    html += pager('house', h.id, page, pages.length);
    openSheet(html);
  }

  function openRelicInfo(id, page) {
    var r = RELICS[id];
    var pages = r.pages || [];
    page = clamp(page || 0, 0, pages.length - 1);
    var p = pages[page];
    var html = head(SIG.icon(r.kind, 26), true, r.name, r.rarity + ' · tier ' + (r.tier || 1));
    html += '<h3 class="sec">' + ['what it is', 'making', 'history', 'warning', 'rumour'][page] + '</h3>';
    html += '<p class="body">' + esc(p ? p.body : '') + '</p>';
    html += '<div class="mono-line">seal: ' + (r.zeros || 7) + ' zeroes</div>';
    html += pager('relic', id, page, pages.length);
    openSheet(html);
  }

  var signCtx = { lat: 0, lng: 0, symbol: 0, page: 0, pub: false, note: '' };

  function openSignMaker(lat, lng) {
    signCtx.lat = lat; signCtx.lng = lng; signCtx.page = 0; signCtx.note = '';
    SND.open();
    renderSignPicker();
  }
  function signPage(n) { signCtx.page = clamp(n, 0, Math.floor(999 / 40)); renderSignPicker(); }
  function signPick(i) { signCtx.symbol = i; renderSignPicker(); }

  function renderSignPicker() {
    var per = 40, start = signCtx.page * per;
    var html = head('✎', true, t('mark_place'), t('signs') + ' · ' + (signCtx.page + 1) + ' / ' + Math.ceil(1000 / per));
    html += '<div class="signgrid">';
    for (var i = start; i < start + per && i < 1000; i++) {
      html += '<button class="signcell ' + (i === signCtx.symbol ? 'on' : '') + '" data-act="signSymbol" data-idx="' + i + '">' +
        Signs.svg(i, 30) + '</button>';
    }
    html += '</div>';
    html += '<div class="btnrow">' +
      '<button class="btn sm" data-act="signPage" data-page="' + (signCtx.page - 1) + '"' + (signCtx.page === 0 ? ' disabled' : '') + '>‹</button>' +
      '<button class="btn sm" data-act="signPage" data-page="' + (signCtx.page + 1) + '"' + (start + per >= 1000 ? ' disabled' : '') + '>›</button>' +
      '</div>';
    html += '<h3 class="sec">The note</h3>' +
      '<input class="ans" id="signNote" maxlength="120" placeholder="what is here?" value="' + esc(signCtx.note || '') + '">' +
      '<div class="btnrow">' +
      '<button class="btn ' + (signCtx.pub ? '' : 'pri') + '" data-act="signVis" data-pub="0">' + t('private') + '</button>' +
      '<button class="btn ' + (signCtx.pub ? 'pri' : '') + '" data-act="signVis" data-pub="1">' + t('public') + '</button>' +
      '</div>' +
      '<div class="btnrow"><button class="btn pri" data-act="signSave">' + t('add_sign') + '</button></div>';
    openSheet(html);
  }

  function signSave() {
    var note = String(($('signNote') || {}).value || signCtx.note || '').slice(0, 120);
    var sg = {
      id: uid('sg'), lat: signCtx.lat, lng: signCtx.lng,
      symbol: signCtx.symbol, note: note, pub: !!signCtx.pub, at: now()
    };
    S.signs.push(sg);
    if (window.Net && sg.pub) Net.queue(S, { type: 'sign', sign: { lat: sg.lat, lng: sg.lng, symbol: sg.symbol, note: sg.note } });
    syncSigns();
    SND.ui();
    toast(signCtx.pub ? 'Sign set — public.' : 'Sign set — private.', 'good');
    feed('You set a sign: ' + Signs.name(sg.symbol) + (note ? ' — “' + esc(note) + '”' : ''));
    closeSheet(); save();
  }

  function openSignView(id) {
    var sg = S.signs.filter(function (x) { return x.id === id; })[0];
    if (!sg) return;
    var html = head(Signs.svg(sg.symbol, 30), true, Signs.name(sg.symbol), sg.pub ? t('public') : t('private'));
    html += '<p class="body">' + (sg.note ? esc(sg.note) : 'No note.') + '</p>';
    html += '<div class="mono-line">' + sg.lat.toFixed(5) + ', ' + sg.lng.toFixed(5) + '</div>';
    html += '<div class="btnrow"><button class="btn dng" data-act="signDel" data-id="' + sg.id + '">Remove</button></div>';
    openSheet(html);
  }

  function syncSigns() {
    Object.keys(markers).forEach(function (k) {
      if (k.indexOf('sg') === 0 && markers[k]._sign) { map.removeLayer(markers[k]); delete markers[k]; }
    });
    S.signs.forEach(function (sg) {
      var m = L.marker([sg.lat, sg.lng], {
        icon: L.divIcon({
          className: 'mkwrap',
          html: '<div class="mapsign ' + (sg.pub ? 'pub' : 'priv') + '">' + Signs.svg(sg.symbol, 26) + '</div>',
          iconSize: [30, 30], iconAnchor: [15, 15]
        }),
        zIndexOffset: 150
      });
      m._sign = true;
      m.on('click', function () { openSignView(sg.id); });
      m.addTo(map);
      markers[sg.id] = m;
    });
  }

  function openJournal() {
    SND.open();
    var html = head('✉', true, 'Chronicle', 'the war, in order');
    html += '<div class="feed">';
    if (!S.feed.length) html += '<div class="it">Nothing has happened yet.</div>';
    S.feed.forEach(function (f) {
      var m = Math.max(0, Math.round((now() - f.t) / 60000));
      html += '<div class="it"><span class="t">' + (m < 1 ? 'now' : m + 'm') + '</span>' + f.text + '</div>';
    });
    html += '</div>';
    openSheet(html);
  }

  function openLanguage() {
    var html = head('✎', true, t('language'), 'interface only — the houses speak their own tongue');
    I18N.LANGS.forEach(function (l) {
      html += '<div class="row tap" data-act="langSet" data-code="' + l.code + '">' +
        '<div class="ic gold" style="font-family:Cinzel,serif;font-size:13px">' + l.code.toUpperCase() + '</div>' +
        '<div><div class="t">' + l.label + '</div></div></div>';
    });
    openSheet(html);
  }

  function setLanguage(code) {
    I18N.setLang(code);
    S.lang = code;
    applyLabels();
    closeSheet(); renderHUD(); save();
    toast(I18N.LANG_LABEL || 'Language changed', 'good');
  }

  function applyLabels() {
    var set = function (id, txt) { var e = $(id); if (e) e.textContent = txt; };
    set('lblMight', t('might')); set('lblShards', t('shards')); set('lblSlain', t('slain'));
    set('lblWorld', t('world'));
    var nav = { navCodex: t('codex'), navServants: t('household'), navWar: t('war'), navVault: t('vault'), navMenu: t('menu') };
    var jb = $('navJinn'); if (jb) jb.setAttribute('aria-label', 'Jinn');
    Object.keys(nav).forEach(function (k) {
      var b = $(k); if (b) b.setAttribute('aria-label', nav[k]);
    });
    set('enterBtn', t('enter'));
  }

  function openMenu() {
    SND.open();
    var html = head('☰', true, 'Menu', 'sigil ' + roman(S.rank) + ' · might ' + strength());
    html += '<p class="body">Position <b>' + S.player.lat.toFixed(5) + ', ' + S.player.lng.toFixed(5) + '</b><br>' +
      'Accuracy <b>±' + Math.round(S.player.acc) + ' m</b> · ' + (S.player.real ? 'live GPS' : 'no fix') + '<br>' +
      'Binding range <b>' + BIND + ' m</b> · you move only when you move.</p>';
    html += '<div class="btnrow"><button class="btn sm" data-act="banner">' + t('banner') + '</button>' +
      '<button class="btn sm" data-act="journal">' + t('chronicle') + '</button></div>';
    html += '<div class="btnrow"><button class="btn sm" data-act="langMenu">' + t('language') + ' · ' +
      (I18N.lang().toUpperCase()) + '</button>' +
      '<button class="btn sm" data-act="signOpen" data-lat="' + map.getCenter().lat + '" data-lng="' + map.getCenter().lng + '">' + t('mark_place') + '</button></div>';
    html += '<div class="btnrow"><button class="btn sm" data-act="toggleSound">Sound: ' + (S.muted ? 'off' : 'on') + '</button>' +
      '<button class="btn sm" data-act="theme">Map: ' + (S.theme === 'parchment' ? 'parchment' : 'midnight') + '</button></div>';
    html += '<div class="btnrow"><button class="btn sm" data-act="online">Online: ' +
      (window.Net && Net.isOn() ? 'on' : 'off') + ' · queued ' + ((S.pending || []).length) + '</button>' +
      '<button class="btn sm" data-act="tiles">Tiles: ' +
      (S.tiles === 'osm' ? 'OpenStreetMap' : S.tiles === 'carto' ? 'CARTO' : 'off') + '</button>' +
      '<button class="btn sm" data-act="recentre">Recentre</button></div>';
    html += '<div class="btnrow"><button class="btn sm dng" data-act="reset">Erase this world</button></div>';
    html += '<p class="body dim" style="font-size:11px">Map data © OpenStreetMap contributors.</p>';
    openSheet(html);
  }

  /* ------------------------------------------------------------------ */
  /* fx                                                                  */
  /* ------------------------------------------------------------------ */
  var toastT = null;
  function toast(msg, kind) {
    var el = $('toast');
    el.textContent = msg;
    el.className = 'on' + (kind ? ' ' + kind : '');
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.className = ''; }, 2800);
  }
  function flash() { var f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  function shakeScreen() { var m = $('map'); m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake'); }
  function feed(html) { S.feed.unshift({ t: now(), text: html }); if (S.feed.length > 80) S.feed.length = 80; }

  var fx = null, fxc = null, parts = [], fxRun = false;
  function initFx() { fxc = $('fx'); fx = fxc.getContext('2d'); resizeFx(); window.addEventListener('resize', resizeFx); }
  function resizeFx() {
    if (!fxc) return;
    var dpr = window.devicePixelRatio || 1;
    fxc.width = window.innerWidth * dpr; fxc.height = window.innerHeight * dpr;
    fxc.style.width = window.innerWidth + 'px'; fxc.style.height = window.innerHeight + 'px';
    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function embers(n) {
    if (!fx) return;
    var cx = window.innerWidth / 2, cy = window.innerHeight * 0.45;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 6;
      parts.push({ x: cx + (Math.random() - .5) * 80, y: cy + (Math.random() - .5) * 80,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, life: 1, size: 1 + Math.random() * 2.4,
        hue: Math.random() < .7 ? '224,69,60' : '201,162,39' });
    }
    if (!fxRun) { fxRun = true; requestAnimationFrame(fxLoop); }
  }
  function fxLoop() {
    fx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += .05; p.vx *= .99; p.life -= .012;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      fx.beginPath(); fx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      fx.fillStyle = 'rgba(' + p.hue + ',' + (p.life * .9) + ')';
      fx.shadowBlur = 12; fx.shadowColor = 'rgba(' + p.hue + ',.8)'; fx.fill();
    }
    fx.shadowBlur = 0;
    if (parts.length) requestAnimationFrame(fxLoop); else fxRun = false;
  }

  /* ------------------------------------------------------------------ */
  /* gps                                                                 */
  /* ------------------------------------------------------------------ */
  function showGate(msg) { var g = $('gpsGate'); if (g) g.classList.remove('hidden'); var a = $('gpsAcc'); if (a) a.textContent = msg || 'no fix yet'; }
  function hideGate() { var g = $('gpsGate'); if (g) g.classList.add('hidden'); }

  function startGPS() {
    if (!navigator.geolocation) { showGate('this device has no geolocation'); return; }
    showGate('searching for a fix…');
    navigator.geolocation.watchPosition(function (pos) {
      S.player.lat = pos.coords.latitude;
      S.player.lng = pos.coords.longitude;
      S.player.acc = pos.coords.accuracy || 25;
      S.player.real = true;
      if (!map._centred) { map.setView([S.player.lat, S.player.lng], 18); map._centred = true; }
      hideGate(); cull(); populate(); syncMap(); renderHUD();
    }, function (e) { gpsFail(e && e.message ? e.message : 'location unavailable'); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  }
  function gpsFail(msg) { S.player.real = false; showGate('no fix — ' + msg); toast('Waiting for GPS.', 'bad'); }

  /* ------------------------------------------------------------------ */
  /* tick                                                                */
  /* ------------------------------------------------------------------ */
  function tick() {
    var t = now(), dt = Math.min(5000, t - lastTick);
    lastTick = t;
    S.playMs += dt;
    var jam = S.buffs.jammerUntil > t, beacon = S.buffs.beaconUntil > t;

    S.demons.forEach(function (d) {
      if (d.frozenUntil > t) return;
      var h = house(d.house);
      /* each house walks at its own pace, and sometimes simply stands still */
      var speed = (h.speed || 0.5) * (jam ? .3 : 1);
      if (d.restUntil && t < d.restUntil) return;
      if (!d.restUntil || t > d.restUntil + 3000) {
        if (Math.random() < 0.02) { d.restUntil = t + rnd(5000, 20000); return; }
        if (Math.random() < 0.15) d.heading = rnd(0, 359);
      }
      var step = speed * (dt / 1000);
      var towards = beacon && !d.flag && haversine(d, S.player) < 300;
      var p = towards ? destination(d, step, bearing(d, S.player)) : destination(d, step, d.heading || rnd(0, 359));
      d.lat = p.lat; d.lng = p.lng;
      if (d.locked) { var f = destination(d, rnd(60, 170), rnd(0, 359)); d.shownLat = f.lat; d.shownLng = f.lng; }
    });

    if (S.wards < R.maxWards && t - S.wardAt > R.wardRegenMs) { S.wards++; S.wardAt = t; }
    if (S.corruption >= 100) {
      S.corruption = 70;
      S.demons.push(spawnDemon(clamp(S.rank + 3, 1, 10)));
      feed('<b>The rift answers your corruption.</b> Something stronger has arrived.');
    }
    if (t - (tick._rivalAt || 0) > 15 * 60000) { tick._rivalAt = t; makeTraders(); }
    if (S.world < D.WORLD.refillBelow) {
      S.world = D.WORLD.refillTo;
      feed('The rift is emptying — <b>new houses walk in</b> across the world.');
      toast('The world is refilled with new houses.', 'good');
    }

    if (S.jinnMode) {
      Jinn.step(S.jinns, dt, S.player);
      syncJinn();
    } else {
      populate(); cull(); syncMap();
    }
    renderHUD();
  }

  /* ------------------------------------------------------------------ */
  /* boot                                                                */
  /* ------------------------------------------------------------------ */
  function boot() {
    var restored = load();
    S = restored || fresh(28.6139, 77.2090);
    ['inv', 'servants', 'relics', 'demons', 'sanctums', 'rivals', 'feed'].forEach(function (k) {
      if (!S[k]) S[k] = (k === 'inv') ? {} : [];
    });
    if (!S.buffs) S.buffs = {};
    if (!S.vault) S.vault = { hash: null, salt: null, relics: {}, servants: [] };
    if (!S.vault.servants) S.vault.servants = [];

    $('titleCrest').innerHTML = CR.svg(D.CRESTS[7], 170);
    initFx();
    initMap();
    if (!S.sanctums.length) makeSanctums();
    drawSanctums();
    populate();
    if (!S.rivals.length) makeTraders();
    syncMap(); renderHUD(); renderInv();
    document.body.classList.add(S.theme === 'midnight' ? 'theme-midnight' : 'theme-parchment');
    if (!S.hunterId) S.hunterId = uid('h');
    if (!S.pending) S.pending = [];
    if (window.Net && Net.isOn()) Net.start(S, renderPeers);
    I18N.setLang(S.lang || 'en');
    applyLabels();
    syncSigns();
    feed(restored ? 'You return to the hunt, sigil ' + roman(S.rank) + '.' : 'The sigil opens. Nine houses are moving.');

    $('enterBtn').addEventListener('click', function () {
      SND.init(); SND.setEnabled(!S.muted);
      $('title').classList.add('gone');
      startGPS();
      if (!S.seenIntro) { S.seenIntro = true; save(); setTimeout(openIntro, 700); }
      else if (S.crestPending) setTimeout(openCrestChooser, 500);
      tick();
      setInterval(tick, 1000);
      setInterval(save, 8000);
    });

    bindUI();
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  function openIntro() {
    var html = head('◈', true, 'The Sigil War', 'how to hunt');
    html += '<p class="body">One hundred houses move across real ground. You move only when you move — there is no other way across the map.</p>' +
      '<p class="body">Walk within <b>' + BIND + ' m</b>, <b>bind</b> a demon and it vanishes from every other hunter’s map. ' +
      'Speak with it, break its conditions, and then choose: <b>kill it</b> for coin, or take it into <b>service</b>.</p>' +
      '<p class="body">A servant keeps the seat where you bound it. Collect a relic while standing on that seat and the servant ' +
      'learns to wield that relic’s power for nothing, forever.</p>' +
      '<p class="body">Relics you use are left behind, locked with a password you choose — and you can never take them back. ' +
      'Your vault keeps what you cannot afford to lose in the war.</p>';
    html += '<div class="btnrow"><button class="btn pri" data-act="close">Begin the hunt</button></div>';
    openSheet(html);
  }

  /* ------------------------------------------------------------------ */
  /* events                                                              */
  /* ------------------------------------------------------------------ */
  function bindUI() {
    $('inv').addEventListener('click', function (e) {
      var slot = e.target.closest('.slot');
      if (!slot) return;
      if (slot.dataset.relic) openRelicDetail(slot.dataset.relic);
      else if (slot.dataset.act === 'servants') openServants();
    });

    $('sheet').addEventListener('click', function (e) {
      if (e.target.id === 'sheet') { closeSheet(); return; }
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.dataset.act, id = b.dataset.id, kind = b.dataset.kind;
      SND.ui();
      switch (act) {
        case 'close':
          closeSheet();
          if (S.crestPending && !S._crestPrompted) { S._crestPrompted = true; setTimeout(openCrestChooser, 280); }
          break;
        case 'flag': flagDemon(id); break;
        case 'unflag': unflagDemon(id); break;
        case 'contact': contactDemon(id); break;
        case 'submit': submitSeal(($('ans') || {}).value); break;
        case 'flee': closeSheet(); break;
        case 'crack': startCrack(id); break;
        case 'relics': openRelicList(id); break;
        case 'usekey': openRelicPicker('key', id); break;
        case 'anchor': openRelicPicker('anchor', id); break;
        case 'take': takeRelic(id); break;
        case 'tryPwd': tryRelicPassword(id); break;
        case 'crackRelic': crackRelic(id); break;
        case 'askPwd': askPassword(kind, null); break;
        case 'usePwd': applyRelic(($('pwd') || {}).value); break;
        case 'killNow': killNow(id); break;
        case 'claim': claim(id); break;
        case 'servants': openServants(); break;
        case 'svUse': openServantPowers(id); break;
        case 'svCast': castServant(id, kind); break;
        case 'svKill': killServant(id); break;
        case 'svVault': openVault(); toast('Unlock the vault, then store it.', null); break;
        case 'hasherStart': startHasher(id); break;
        case 'hasherStop': stopHasher(); break;
        case 'hasherAbandon': abandonHasher(id); break;
        case 'hasherPanel': openHasher(id); break;
        case 'houseOpen': openHouse(b.dataset.id, 0); break;
        case 'relicInfo': openRelicInfo(b.dataset.id, 0); break;
        case 'pageHouse': openHouse(b.dataset.id, Number(b.dataset.page)); break;
        case 'pageRelic': openRelicInfo(b.dataset.id, Number(b.dataset.page)); break;
        case 'signOpen': openSignMaker(Number(b.dataset.lat), Number(b.dataset.lng)); break;
        case 'signSymbol': signPick(Number(b.dataset.idx)); break;
        case 'signPage': signPage(Number(b.dataset.page)); break;
        case 'signSave': signSave(); break;
        case 'signView': openSignView(id); break;
        case 'signVis':
          signCtx.note = String(($('signNote') || {}).value || '');
          signCtx.pub = b.dataset.pub === '1';
          renderSignPicker(); break;
        case 'signDel':
          S.signs = S.signs.filter(function (x) { return x.id !== id; });
          if (markers[id]) { map.removeLayer(markers[id]); delete markers[id]; }
          closeSheet(); save(); break;
        case 'langSet': setLanguage(b.dataset.code); break;
        case 'langMenu': openLanguage(); break;
        case 'online': toggleOnline(); break;
        case 'vaultSet': vaultSet(); break;
        case 'vaultUnlock': vaultUnlock(); break;
        case 'vaultPut': vaultPut(kind); break;
        case 'vaultTake': vaultTake(kind); break;
        case 'vaultPutSv': vaultPutSv(id); break;
        case 'vaultTakeSv': vaultTakeSv(id); break;
        case 'vaultClose': vaultOpen = false; closeSheet(); break;
        case 'buyOffer': buyOffer(id); break;
        case 'sellRelic': sellRelic(kind); break;
        case 'refreshMarket': makeTraders(); openMarket(); save(); break;
        case 'postOffer':
          if (window.Net) Net.queue(S, { type: 'offer', at: now() });
          toast('Offer posted. It travels when you are online.', 'good');
          break;
        case 'pickCrest': pickCrest(Number(b.dataset.idx)); break;
        case 'banner': openCrestChooser(); break;
        case 'journal': openJournal(); break;
        case 'toggleSound': S.muted = !S.muted; SND.setEnabled(!S.muted); openMenu(); save(); break;
        case 'theme':
          S.theme = S.theme === 'parchment' ? 'midnight' : 'parchment';
          document.body.className = S.theme === 'midnight' ? 'theme-midnight' : 'theme-parchment';
          openMenu(); save(); break;
        case 'tiles':
          setTiles(S.tiles === 'osm' ? 'carto' : S.tiles === 'carto' ? 'none' : 'osm');
          openMenu(); save(); break;
        case 'recentre': map.setView([S.player.lat, S.player.lng], 18); closeSheet(); break;
        case 'reset':
          if (!confirm('Erase this world and everything in it?')) return;
          localStorage.removeItem(SAVE_KEY);
          S = fresh(S.player.lat, S.player.lng);
          Object.keys(markers).forEach(function (k) { map.removeLayer(markers[k]); delete markers[k]; });
          makeSanctums(); drawSanctums(); populate(); makeRivals();
          syncMap(); renderHUD(); renderInv(); closeSheet(); save();
          toast('The world is remade.', 'good'); break;
      }
    });

    $('sheet').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target.id === 'ans' && sheet.cond) submitSeal(e.target.value);
      if (e.target.id === 'dans' && duel) castDuel();
    });

    $('navCodex').addEventListener('click', openCodex);
    $('navServants').addEventListener('click', openServants);
    $('navWar').addEventListener('click', openMarket);
    var jb = $('navJinn');
    if (jb) jb.addEventListener('click', toggleJinn);
    $('navVault').addEventListener('click', openVault);
    $('navMenu').addEventListener('click', openMenu);

    var retry = $('gpsRetry');
    if (retry) retry.addEventListener('click', function () { showGate('searching…'); startGPS(); });

    var centre = $('btnCentre');
    if (centre) centre.addEventListener('click', function () {
      map.setView([S.player.lat, S.player.lng], 18);
      toast(t('centre_me'), null);
    });
    var markBtn = $('navMark');
    if (markBtn) markBtn.addEventListener('click', function () {
      var c = map.getCenter();
      openSignMaker(c.lat, c.lng);
    });
    map.on('contextmenu', function (e) { openSignMaker(e.latlng.lat, e.latlng.lng); });

    map.on('move zoom', updateFog);
  }

  function openRelicPicker(kind, demonId) {
    var keys = D.RELIC_KEYS.filter(function (k) { return RELICS[k].kind === kind && (S.inv[k] || 0) > 0; });
    if (!keys.length) { toast('You carry no ' + kind + ' relic.', 'bad'); return; }
    if (keys.length === 1) { askPassword(keys[0], demonId); return; }
    var html = head(SIG.icon(kind, 26), true, 'Which one?', kind);
    keys.forEach(function (k) {
      html += '<div class="row tap" data-act="askPwd" data-kind="' + k + '">' +
        '<div class="ic gold">' + SIG.icon(kind, 24) + '</div>' +
        '<div style="flex:1"><div class="t">' + RELICS[k].name + ' <small>×' + S.inv[k] + '</small></div>' +
        '<div class="d">' + esc(RELICS[k].effect) + '</div></div></div>';
    });
    openSheet(html);
  }

  function openRelicList(demonId) {
    var d = S.demons.filter(function (x) { return x.id === demonId; })[0];
    if (!d) return;
    var html = head('⚱', true, 'Relics', 'against ' + houseName(d.house));
    var any = false;
    ['anchor', 'key', 'shield', 'veil'].forEach(function (kind) {
      var keys = D.RELIC_KEYS.filter(function (k) { return RELICS[k].kind === kind && (S.inv[k] || 0) > 0; });
      keys.forEach(function (k) {
        any = true;
        html += '<div class="row tap" data-act="askPwd" data-kind="' + k + '">' +
          '<div class="ic gold">' + SIG.icon(kind, 24) + '</div>' +
          '<div style="flex:1"><div class="t">' + RELICS[k].name + ' <small>×' + S.inv[k] + '</small></div>' +
          '<div class="d">' + esc(RELICS[k].effect) + '</div></div></div>';
      });
    });
    if (!any) html += '<p class="body">You carry nothing that can be used on a demon.</p>';
    openSheet(html);
  }

  /* debug handle */
  window.SIGIL_GAME = {
    get state() { return S; },
    get map() { return map; },
    get sheet() { return sheet; },
    get markers() { return markers; },
    get duel() { return duel; },
    strength: strength,
    openDemon: openDemon, openCodex: openCodex, closeSheet: closeSheet, openServants: openServants,
    openVault: openVault, openMarket: openMarket, openMenu: openMenu, openJournal: openJournal,
    openCrestChooser: openCrestChooser, pickCrest: pickCrest,
    syncMap: syncMap, contactDemon: contactDemon, submitSeal: submitSeal, flagDemon: flagDemon,
    takeRelic: takeRelic, askPassword: askPassword, applyRelic: applyRelic, openRelicPickup: openRelicPickup,
    tryRelicPassword: tryRelicPassword, crackRelic: crackRelic, toggleJinn: toggleJinn,
    killNow: killNow, claim: claim, castServant: castServant, openServantPowers: openServantPowers,
    setTiles: setTiles, populate: populate, makeTraders: makeTraders, gpsFail: gpsFail,
    vaultPut: vaultPut, vaultTake: vaultTake, openHasher: openHasher, startHasher: startHasher,
    stopHasher: stopHasher, openHouse: openHouse, openRelicInfo: openRelicInfo, openSignMaker: openSignMaker,
    signSave: signSave, syncSigns: syncSigns, setLanguage: setLanguage, openLanguage: openLanguage,
    get hasher() { return hasher; }
  };

  document.addEventListener('DOMContentLoaded', boot);
})();
