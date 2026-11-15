# Demon Finder — The Sigil War

A location-based dark-fantasy hunt for the browser and for Android. One hundred houses of demons walk
the real world at their own pace. Bind them at five paces, break their conditions, and either kill
them or take them into your household as servants you can wield like relics. Relics you drop are
sealed by the game with a hash your phone must break by brute force — nobody ever types a password.

And there is a second world underneath this one, where fifty levels of jinn walk a city that nobody
built.

---

## What is in this folder

| Path | Purpose |
|---|---|
| `index.html` | Shell: banner header, map, relic bar, nav, GPS gate |
| `css/style.css` | Parchment-atlas skin, banner header, dread state, RTL, fonts embedded |
| `js/i18n.js` · `js/lang.js` | Interface languages: English, العربية, Français |
| `js/sigil.js` · `js/crest.js` · `js/symbols.js` | Procedural sigils, heraldic crests, 1000 map signs |
| `js/data.js` | 100 houses, 100 relics, ranks, speeds, five-page lore |
| `js/puzzles.js` | Seal generators + SHA-256 |
| `js/cracker.js` | The hasher — background proof-of-work in a Web Worker |
| `js/jinn.js` | The other world: procedural city tiles and 50 levels of jinn |
| `js/audio.js` | Five pieces for the world, two for the last five paces |
| `js/net.js` | Optional online layer + offline queue |
| `js/game.js` | World, GPS, binding, servants, vault, market, signs, jinn |
| `server/server.js` | Dependency-free Node backend for the online layer |

---

## Run it

```bash
cd sigil
python3 -m http.server 8080        # http://localhost:8080
node server/server.js 8081         # optional, for online play
```

**Deploy:** push, then *Settings → Pages → Deploy from a branch → main / root*.
**APK:** push to `main`; the *Build Android APK* workflow leaves `app-debug.apk` as a run artifact.

---

## The rules of the hunt

**You move only when you move.** No joystick; the marker is your phone's GPS fix.

**Every house walks.** 0.25 m/s at rank I up to 2.5 m/s at rank X, resting at random.

**Bind at five metres**, and it vanishes from every other hunter's map. Speak with it inside 5 m —
one, two or three conditions — then kill it or take it into service. A servant keeps the seat where
you bound it: collect a relic on that seat and the servant attunes to its power, free to wield every
30 minutes.

**Seals are made by the game.** A relic you use is dropped sealed with a hash needing 7 leading zeroes
(tier I, roughly 40 minutes on a phone), 8 at tier II, 9 at tier III–IV. Opening it means running the
**hasher** in the background — stop, resume or abandon, with progress saved across restarts.

**The vault** takes one password of your own and protects relics and servants.

**The market, not the field.** There are no duels between hunters. You buy from the traders who walk
the rift and sell what you no longer need; offers you post travel with the online layer.

**Signs stay where you put them.** Tap ✎ or long-press the map, choose one of **1000 marks**, add a
note, and mark it public or private. Your own signs are always visible to you; only public ones travel
to other phones. A sign sits exactly where it was set until you remove it.

**Sanctums** are four circles where no demon can be found by anyone.

**The world** holds a billion houses at first light, counted in the banner; below 500,000 it refills.

**Banners.** A heraldic crest at every sigil — 2 at Sigil I, 5 at II, 10 at III, all 100 at X — which
is what others see, and it blinks so you can find yourself.

### Five paces: the music turns

Walk inside 5 m of a demon and the score changes: the five calm pieces give way to *It Is Here* and
*Five Paces* — faster, dissonant, a tritone scraping under the drone. The screen edges redden and
pulse, the map trembles, embers drift up from the ground, and the header burns red. Step away and the
calm returns. Everything is synthesised; there are no audio files, and the master is loud.

### The jinn dimension

The moon button in the side rail turns the world sideways.

- The real map is replaced by a **procedurally generated city** covering the whole planet — streets,
  blocks, towers, rivers, plazas and craters drawn per tile from a hash of its coordinates. Walk any
  direction and the architecture changes, endlessly, and it is the same city for everyone standing in
  the same place.
- **Fifty levels of jinn** walk it. Their number is the number of demons × 1000, shown in the banner
  (nine houses → 9,000). Each jinn moves at its own speed and rests when it likes.
- Colour is rank: deep violet for the least, gold for the great ones. The distribution is a heavy
  tail — most are level 1–5, and a level 50 is almost never seen. Size grows with level, so the rare
  ones are also the largest things on the map.

### Languages

*Menu → Language*: **English, العربية, Français**. Arabic switches the whole interface to right-to-left.
House lore stays in the tongue of the game.

---

## Online play (optional)

`js/net.js` holds one line: `var SYNC_URL = '';`. Point it at your host, switch Online on in the menu,
and nearby hunters appear as their banners while public signs and market offers travel. Everything you
did offline is queued in `S.pending` and flushed when the connection returns. `server/server.js` is a
complete reference backend — one file, no dependencies.

---

## Honest limitations

- **No player-versus-player combat** — as you asked, the market replaces it. Live trading with another
  phone needs the server running.
- **Jinn cannot be bound**; they are watched and marked, not owned. The city is generated, not stored.
- **One billion houses is a counter**; entities are generated procedurally around each hunter.
- **Hash time depends on the phone** — a slow device can take hours on a nine-zero seal.
- **Tiles need a network** (the jinn city does not — it is drawn on the device).
- **Passwords are unforgiving**: the vault has no reset.
- **Safety.** Never hunt while driving; never step onto a road or private land for a marker.

Map data © OpenStreetMap contributors. Leaflet © Volodymyr Agafonkin (BSD-2-Clause). Fonts: Cinzel
and EB Garamond (SIL OFL), embedded.
