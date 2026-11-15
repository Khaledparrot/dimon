/* =====================================================================
   server/server.js — the smallest possible Sigil War backend.
   Node 18+, no dependencies. Run:  node server/server.js 8080
   Then set SYNC_URL in js/net.js to your host and turn Online on.
   ===================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'world.json');

let world = { hunters: {}, events: [], signs: [], at: Date.now() };
try { world = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}

const save = () => { try { fs.writeFileSync(FILE, JSON.stringify(world)); } catch (e) {} };
setInterval(save, 10000);

const json = (res, code, body) => {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});

  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/peers') {
    const id = url.searchParams.get('id');
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lng = parseFloat(url.searchParams.get('lng') || '0');
    if (id) world.hunters[id] = { id, lat, lng, at: Date.now() };
    const now = Date.now();
    const near = Object.values(world.hunters)
      .filter(h => h.id !== id && now - h.at < 120000)
      .filter(h => Math.abs(h.lat - lat) < 0.2 && Math.abs(h.lng - lng) < 0.2)
      .slice(0, 40);
    return json(res, 200, { peers: near });
  }

  if (url.pathname === '/sync' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      let msg = {};
      try { msg = JSON.parse(body || '{}'); } catch (e) { return json(res, 400, { ok: false }); }
      (msg.batch || []).forEach(ev => {
        ev.hunter = msg.id;
        world.events.push(ev);
        if (ev.type === 'sign' && ev.sign) world.signs.push(ev.sign);
      });
      if (world.events.length > 5000) world.events = world.events.slice(-5000);
      if (world.signs.length > 2000) world.signs = world.signs.slice(-2000);
      json(res, 200, { ok: true, signs: world.signs.length });
    });
    return;
  }

  if (url.pathname === '/signs') {
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lng = parseFloat(url.searchParams.get('lng') || '0');
    const near = world.signs.filter(s => Math.abs(s.lat - lat) < 0.2 && Math.abs(s.lng - lng) < 0.2);
    return json(res, 200, { signs: near });
  }

  if (url.pathname === '/stats') {
    return json(res, 200, { hunters: Object.keys(world.hunters).length, events: world.events.length, signs: world.signs.length });
  }

  json(res, 404, { ok: false });
});

const port = process.argv[2] || process.env.PORT || 8080;
server.listen(port, () => console.log('Sigil War server on :' + port));
