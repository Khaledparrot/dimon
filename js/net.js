/* =====================================================================
   net.js — optional online layer.
   With no server configured the game is fully offline: every win, loss,
   relic and sign is kept on the phone and queued. Point SYNC_URL at your
   own server (see server/server.js) and the queue drains, and other
   hunters nearby become visible on the map.
   ===================================================================== */
(function (global) {
  'use strict';

  var SYNC_URL = '';            /* e.g. 'https://your-host.example' */
  var enabled = false, pollTimer = null, peers = [];

  function configured() { return !!SYNC_URL; }

  function queue(S, event) {
    if (!S.pending) S.pending = [];
    S.pending.push(Object.assign({ at: Date.now() }, event));
    if (S.pending.length > 200) S.pending.shift();
  }

  function post(path, body) {
    return fetch(SYNC_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.ok ? r.json() : null; });
  }

  function flush(S, player) {
    if (!enabled || !configured() || !S.pending || !S.pending.length) return Promise.resolve();
    var batch = S.pending.slice(0, 40);
    return post('/sync', { id: S.hunterId, batch: batch, at: Date.now() })
      .then(function (res) {
        if (res && res.ok) S.pending = S.pending.slice(batch.length);
        return res;
      }).catch(function () { return null; });
  }

  function poll(S, onPeers) {
    if (!enabled || !configured()) return;
    var url = SYNC_URL + '/peers?id=' + encodeURIComponent(S.hunterId) +
      '&lat=' + S.player.lat.toFixed(5) + '&lng=' + S.player.lng.toFixed(5);
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      peers = (data && data.peers) || [];
      if (onPeers) onPeers(peers);
    }).catch(function () {});
  }

  function start(S, onPeers) {
    if (!configured()) return false;
    enabled = true;
    if (pollTimer) clearInterval(pollTimer);
    flush(S);
    poll(S, onPeers);
    pollTimer = setInterval(function () { flush(S); poll(S, onPeers); }, 15000);
    return true;
  }
  function stop() {
    enabled = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    peers = [];
  }

  global.Net = {
    configured: configured, start: start, stop: stop, queue: queue,
    peers: function () { return peers; },
    isOn: function () { return enabled; },
    setUrl: function (u) { SYNC_URL = u || ''; }
  };
})(window);
