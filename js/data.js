/* =====================================================================
   data.js — 100 demon houses, 100 relics, 100 heraldic crests,
   the rank ladder and the world rules.
   ===================================================================== */
(function (global) {
  'use strict';

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var R = mulberry(20261115);
  function pick(a) { return a[Math.floor(R() * a.length)]; }

  /* ------------------------------------------------------------------ */
  /* The ten great houses, hand-written                                  */
  /* ------------------------------------------------------------------ */
  var GREAT = [
    { id:'grub', name:'Ashen Grub', title:'the Starving', rank:1, cat:'math',
      lore:'It crawls out of cold ground where something died unburied. It cannot kill you. It can only follow, and it never stops being hungry.',
      taunts:['You smell of iron and warm blood. Come closer.','I have eaten six hunters this winter. You will be the seventh.'],
      rule:'Breaks on arithmetic.' },
    { id:'wisp', name:'Rift Wisp', title:'the Whisper', rank:2, cat:'sequence',
      lore:'A smear of light that speaks in numbers. It has no body, so it drifts faster than anything with legs.',
      taunts:['Count my breaths. Miss one and I am already elsewhere.','I am the gap between the numbers you already know.'],
      rule:'Breaks on sequences.' },
    { id:'crawler', name:'Grave Crawler', title:'the Patient', rank:3, cat:'logic',
      lore:'It waits in the space under a wrong assumption. Six hundred years of patience and it has never once been in a hurry.',
      taunts:['Everything you believe has a hole in it. I live in the hole.','Sit. Think. That is how I catch hunters.'],
      rule:'Breaks on logic.' },
    { id:'mimic', name:'Charnel Mimic', title:'the Thief of Tongues', rank:4, cat:'caesar',
      lore:'It wears language the way a lord wears a borrowed cloak. Speak plainly and it hands your own words back, twisted.',
      taunts:['Your words, shifted a little. Now they belong to me.','Say my name. You cannot. I took it.'],
      rule:'Breaks on shifted alphabets.' },
    { id:'howler', name:'Pale Howler', title:'the Mirror', rank:5, cat:'atbash',
      lore:'It inverts whatever it touches. A torch becomes a shadow, courage becomes terror, a true word becomes its opposite.',
      taunts:['I invert everything. Your courage reads as terror from here.','The mirror does not lie. It only reverses.'],
      rule:'Breaks on mirrored script.' },
    { id:'warden', name:'Iron Warden', title:'Keeper of the Gates', rank:6, cat:'base64',
      lore:'It was bound to a gate that no longer exists and has guarded it ever since. Every lock in the rift is its work.',
      taunts:['You are locked out. I am the door.','Bring a key or bring a war. You will not pass.'],
      rule:'Breaks on encoded script.' },
    { id:'chainer', name:'The Chainbound', title:'the Accountant', rank:7, cat:'modmath',
      lore:'It counts everything and forgives nothing. It does not chase hunters; it waits where the remainder puts you.',
      taunts:['Every step you take is a remainder. I decide what is left.','You will arrive exactly where I calculated. You always do.'],
      rule:'Breaks on modular arithmetic.' },
    { id:'veil', name:'The Veil', title:'the Unseen', rank:8, cat:'hash',
      lore:'No hunter has ever seen it. It leaves only proofs — a string that could only have come from something that was there.',
      taunts:['You cannot see me. You can only prove I was here.','I leave no footprints. Only fingerprints of arithmetic.'],
      rule:'Breaks on hashes and ciphers.' },
    { id:'hollow', name:'Hollow King', title:'the Counter', rank:9, cat:'combinatorics',
      lore:'A crown with nothing beneath it. It has counted every way a hunter can fail, and it is not finished counting.',
      taunts:['There are more ways to fail than you have days. Choose well.','Kneel, and I will make the number smaller.'],
      rule:'Breaks on counting.' },
    { id:'sovereign', name:'The Sovereign', title:'the Last Seal', rank:10, cat:'mixed',
      lore:'The rift made one of these and then closed the door behind it. Every other demon is a rumour of this one.',
      taunts:['Ten of us. One of you. The arithmetic has already decided.','You will not kill me. You will only prove you were brave.'],
      rule:'Breaks on everything at once.' }
  ];

  /* ------------------------------------------------------------------ */
  /* Ninety lesser houses, generated                                     */
  /* ------------------------------------------------------------------ */
  var PRE = ['Ash','Bone','Iron','Salt','Cinder','Grave','Marrow','Thorn','Raven','Hollow','Ember','Frost',
    'Rot','Silk','Gilt','Pale','Black','Red','Grey','Dusk','Mire','Storm','Wolf','Crow','Hart','Vale',
    'Pyke','Dread','Morn','Wyrm','Cairn','Briar','Corm','Hag','Knell','Lark','Moth','Nettle','Oak',
    'Pike','Quill','Rook','Sable','Tallow','Umber','Vex','Wick','Yew','Bale','Coal'];
  var SUF = ['Wisp','Crawler','Warden','Chainer','Howler','Mimic','Veil','Hollow','Sovereign','Grub',
    'Hound','Serpent','Wretch','Revenant','Shade','Banshee','Wyrm','Ghoul','Hag','Knight','Queen','King',
    'Priest','Scribe','Widow','Orphan','Herald','Sentinel','Devourer','Maw'];
  var TITLES = ['the Unquiet','of the Low Road','the Twice-Buried','of Nine Bells','the Quiet Debt',
    'of the Drowned Field','the Patient Knife','of Salt and Ash','the Last Tenant','of the Long Night',
    'the Hollow Debt','of Grey Water','the Keeper of Names','of the Broken Gate','the Silent Ledger'];
  var CATS = ['math','sequence','logic','caesar','atbash','base64','modmath','hash','combinatorics','mixed'];
  var LORE_A = ['It came up through the cellar floor of a house that burned twice.',
    'It was a tax collector once, and it kept the habit.',
    'It has been walking the same road since the old kingdom fell.',
    'It lives in the space behind a locked door nobody remembers fitting.',
    'It was summoned to settle a debt and never left.',
    'It speaks with the voice of the last person who owned it.'];
  var LORE_B = ['It collects names and returns them misspelled.',
    'It cannot cross running water, so it waits on bridges.',
    'It trades answers for memories, and it is very good at arithmetic.',
    'It marks its territory with ciphers cut into stone.',
    'It has never once lied, which is somehow worse.',
    'It counts everything that passes and forgets nothing.'];
  var TAUNT_A = ['You are late. The others were late too.',
    'I have been expecting someone with your exact heartbeat.',
    'Say your name and I will decide what it is worth.',
    'You carry iron and a telephone. Only one of those frightens me.',
    'Turn around. That is the whole riddle.'];

  var combos = [];
  for (var pi = 0; pi < PRE.length; pi++) {
    for (var si = 0; si < SUF.length; si++) combos.push(PRE[pi] + ' ' + SUF[si]);
  }
  /* deterministic scatter so the first ninety are not all "Ash" */
  var used = {}, LESSER = [], guard = 0;
  while (LESSER.length < 90 && guard < 4000) {
    var idx = Math.floor(R() * combos.length);
    var nm = combos[idx];
    if (!used[nm]) {
      used[nm] = 1;
      var k = LESSER.length;
      LESSER.push({
        id: 'h' + k,
        name: nm,
        title: TITLES[k % TITLES.length],
        rank: 1 + (k % 10),
        cat: CATS[(k * 3 + 1) % CATS.length],
        lore: LORE_A[k % LORE_A.length] + ' ' + LORE_B[(k * 5) % LORE_B.length],
        taunts: [TAUNT_A[k % TAUNT_A.length], '"' + nm.split(' ')[0] + ' remembers you now."'],
        rule: 'Breaks on ' + ({ math:'arithmetic', sequence:'sequences', logic:'logic', caesar:'shifted alphabets',
          atbash:'mirrored script', base64:'encoded script', modmath:'modular arithmetic', hash:'hashes',
          combinatorics:'counting', mixed:'everything at once' })[CATS[(k * 3 + 1) % CATS.length]] + '.'
      });
    }
    guard++;
  }

  var NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  /* five pages of history for every house */
  var P_ORIGIN = [
    'The first record of it is a bill of sale, and the buyer is listed as "the house itself".',
    'It came through a door that was bricked over a century before it arrived.',
    'It was summoned to settle a debt between two lords. Both lords are gone. The debt is not.',
    'It is older than the road it walks on, and the road was built on something older still.',
    'It was a person once. The paperwork to reverse it was never filed.',
    'It crawled out of a well that had been sealed for the crime of being too deep.'
  ];
  var P_POWER = [
    'It cannot be lied to, only answered.',
    'It moves without leaving a track, and it is never where the map says it is for long.',
    'It speaks in the language of the thing it is about to take from you.',
    'It can hold a door shut from the other side of the world.',
    'It hears its own name spoken anywhere, and it resents being called.',
    'It remembers every hunter it has met, and it charges interest.'
  ];
  var P_WEAK = [
    'It cannot refuse a question that is properly asked.',
    'It will not cross salt that has been laid by hand.',
    'It must answer before the count of three, and it counts badly.',
    'It loses interest in anything that does not move toward it.',
    'It cannot abide its own reflection in still water.',
    'Iron, plainly worked, makes it polite.'
  ];
  var P_LIFE = [
    'It keeps a room somewhere with a chair for every hunter it has beaten.',
    'It sleeps in daylight, in the cool under a bridge, with one eye open.',
    'It eats names. It has eaten most of the good ones.',
    'It trades in favours and remembers the exchange rate.',
    'It has never been seen to eat, drink or rest, and it resents the question.',
    'It keeps a ledger. The ledger is longer than the road.'
  ];
  var P_RUMOUR = [
    'They say a hunter once bound it with a single word. Nobody agrees on the word.',
    'They say it is one of a pair, and the other has never been seen.',
    'They say the Sovereign made it as a joke, and the joke is still running.',
    'They say it will trade its own freedom for a true answer.',
    'They say it cannot be killed in the same place twice, and nobody has tested it twice.',
    'They say the sanctums were raised because of this one house alone.'
  ];

  var HOUSES = GREAT.concat(LESSER);
  HOUSES.forEach(function (h, i) {
    h.index = i;
    h.numeral = NUMERALS[h.rank] || String(h.rank);
    if (!h.taunts) h.taunts = ['"You are already too late."'];
    h.speed = 0.25 + (h.rank - 1) * 0.25;         /* metres per second */
    h.pages = [
      { title: 'Origin', body: h.lore + ' ' + P_ORIGIN[i % P_ORIGIN.length] },
      { title: 'Powers', body: P_POWER[(i + 2) % P_POWER.length] + ' ' + h.rule },
      { title: 'Weakness', body: P_WEAK[(i + 1) % P_WEAK.length] },
      { title: 'Life', body: P_LIFE[(i + 3) % P_LIFE.length] },
      { title: 'Rumour', body: P_RUMOUR[(i + 4) % P_RUMOUR.length] }
    ];
  });

  /* ------------------------------------------------------------------ */
  /* Relics — twelve effects, one hundred vessels                        */
  /* ------------------------------------------------------------------ */
  var EFFECTS = {
    seer:    { label: 'true sight', unit: 'minutes', verb: 'reveals the true position of every sealed demon within %R m for %M min' },
    anchor:  { label: 'binding',    unit: 'minutes', verb: 'freezes one demon in place for %M min' },
    key:     { label: 'opening',    unit: '—',       verb: 'opens one demon seal instantly, with no cracking' },
    shield:  { label: 'warding',    unit: 'minutes', verb: 'holds a bond you own together for %M min, even if you fail a condition' },
    veil:    { label: 'cloaking',   unit: 'minutes', verb: 'cloaks the relic you drop for %M min so rivals cannot claim it' },
    lantern: { label: 'revealing',  unit: 'minutes', verb: 'lights up every relic within %R m for %M min' },
    jammer:  { label: 'slowing',    unit: 'minutes', verb: 'slows every demon to %P% drift for %M min' },
    ward:    { label: 'mending',    unit: 'wards',   verb: 'restores %M ward' },
    flask:   { label: 'burning',    unit: 'minutes', verb: 'burns away the fog of war for %M min' },
    beacon:  { label: 'luring',     unit: 'minutes', verb: 'draws unbound demons within %R m toward you for %M min' },
    mending: { label: 'cleansing',  unit: 'corruption', verb: 'washes %M corruption from you' },
    fortune: { label: 'fortune',    unit: 'shards',  verb: 'pays you %M shards the moment it is used' }
  };
  var ADJ = ['Ash','Blood','Salt','Iron','Cinder','Grave','Marrow','Thorn','Raven','Pale','Gilt','Dusk',
    'Storm','Mire','Wyrm','Coal','Frost','Briar','Hollow','Sable'];
  var NOUN = ['Charm','Sigil','Ring','Phial','Crown','Nail','Coin','Bell','Candle','Mirror','Chain','Veil',
    'Stone','Key','Quill','Tallow','Horn','Cup','Lantern','Brand'];
  var KEYS = Object.keys(EFFECTS);
  var RELICS = {}, RELIC_KEYS = [];
  var usedRelic = {};
  var rn = 0;
  while (RELIC_KEYS.length < 100 && rn < 4000) {
    var nm2 = ADJ[Math.floor(R() * ADJ.length)] + ' ' + NOUN[Math.floor(R() * NOUN.length)];
    rn++;
    if (usedRelic[nm2]) continue;
    usedRelic[nm2] = 1;
    var k = RELIC_KEYS.length;
    var kind = KEYS[k % KEYS.length];
    var tier = 1 + (k % 4);
    var mag = kind === 'ward' ? 1 : kind === 'key' ? 1 : 5 + tier * 5;
    var radius = 300 + tier * 300;
    var rarity = tier <= 1 ? 'common' : tier === 2 ? 'uncommon' : tier === 3 ? 'rare' : 'fabled';
    var cost = 20 + tier * 25;
    var id = 'rel' + k;
    var text = EFFECTS[kind].verb
      .replace('%M', mag).replace('%R', radius).replace('%P', 30);
    RELICS[id] = {
      id: id, name: nm2, kind: kind, mag: mag, radius: radius, tier: tier,
      rarity: rarity, cost: cost, effect: text, note: EFFECTS[kind].label + ' · tier ' + tier
    };
    RELIC_KEYS.push(id);
  }
  var R_MAKING = [
    'Forged in a town that no longer appears on any map.',
    'Cut from a bell that was rung once, at a funeral nobody attended.',
    'Its maker is remembered only as "the patient one".',
    'Assembled from nine pieces, each taken from a different hunter.',
    'It was not made. It was found, already old.',
    'The seams are wrong. Whatever made it did not know how hands work.'
  ];
  var R_HISTORY = [
    'It has changed owners eleven times. Three of them are still alive.',
    'It was buried for a hundred years and dug up by accident.',
    'It was carried by a lord who never once used it, and died anyway.',
    'Every owner has said the same thing: it is heavier than it looks.',
    'It has been dropped, stolen, dropped again, and always found.',
    'The last hunter to use it wrote a note. The note is blank.'
  ];
  var R_WARNING = [
    'Do not use it indoors. The rift notices.',
    'It works best when you are being watched.',
    'The cost is not paid by you.',
    'It will not work twice in the same place for the same hunter.',
    'Keep it away from running water and open flames.',
    'If it grows warm, put it down.'
  ];
  Object.keys(RELICS).forEach(function (id, i) {
    var r = RELICS[id];
    r.pages = [
      { title: 'What it is', body: r.effect.charAt(0).toUpperCase() + r.effect.slice(1) + '.' },
      { title: 'Making', body: R_MAKING[i % R_MAKING.length] },
      { title: 'History', body: R_HISTORY[(i + 2) % R_HISTORY.length] },
      { title: 'Warning', body: R_WARNING[(i + 3) % R_WARNING.length] },
      { title: 'Rumour', body: 'They say a relic left behind stays behind for a reason, and the reason is not generosity.' }
    ];
    r.zeros = [0, 7, 8, 9, 9][clampTier(r.tier)] || 7;
  });
  function clampTier(t) { return Math.max(1, Math.min(4, t || 1)); }

  /* the ten hand-named relics, kept as the first entries */
  var NAMED = [
    ['seer', "Seer's Lens"], ['anchor', 'Anchor Spike'], ['key', 'Rift Key'], ['shield', 'Shield Rune'],
    ['veil', 'Veil Cloak'], ['lantern', 'Lantern'], ['jammer', 'Jammer'], ['ward', 'Ward Stone'],
    ['flask', 'Ember Flask'], ['beacon', 'Beacon']
  ];
  NAMED.forEach(function (p, i) {
    var id = RELIC_KEYS[i], r = RELICS[id];
    r.name = p[1];
    r.kind = p[0];
    r.mag = r.kind === 'ward' || r.kind === 'key' ? 1 : 10;
    r.effect = EFFECTS[r.kind].verb.replace('%M', r.mag).replace('%R', 1200).replace('%P', 30);
  });

  /* ------------------------------------------------------------------ */
  /* Heraldic crests — one hundred, unlocked by strength                 */
  /* ------------------------------------------------------------------ */
  var CREST_TINCTURES = [
    ['#7d1f1a', '#e8dcc0'], ['#1e2f4d', '#e8dcc0'], ['#2a2118', '#c9a227'],
    ['#5b3a12', '#e8dcc0'], ['#3d1f3a', '#d8c68a'], ['#12232b', '#d8c68a'],
    ['#8a6a1f', '#2a2118'], ['#5a1b1b', '#c9a227'], ['#243b2a', '#e8dcc0'],
    ['#1a1a1a', '#b9a06a']
  ];
  var CREST_DIVISIONS = ['plain', 'pale', 'fess', 'quarterly', 'bend', 'chevron', 'cross', 'saltire'];
  var CREST_CHARGES = ['wolf', 'raven', 'tower', 'sword', 'crown', 'star', 'flame', 'key', 'eye', 'serpent'];
  var CRESTS = [];
  for (var ci = 0; ci < 100; ci++) {
    var t = CREST_TINCTURES[ci % CREST_TINCTURES.length];
    CRESTS.push({
      id: 'c' + ci,
      name: ['House ', 'Order of ', 'Sworn of ', 'Banner of '][ci % 4] +
        ['Ash', 'Thorn', 'Raven', 'Wolf', 'Iron', 'Salt', 'Ember', 'Grave', 'Storm', 'Gilt'][Math.floor(ci / 10) % 10] +
        ' ' + NUMERALS[1 + (ci % 9)],
      field: t[0], metal: t[1],
      division: CREST_DIVISIONS[ci % CREST_DIVISIONS.length],
      charge: CREST_CHARGES[Math.floor(ci / 10) % CREST_CHARGES.length],
      charge2: CREST_CHARGES[(Math.floor(ci / 10) + 3) % CREST_CHARGES.length]
    });
  }
  /* how many crests each rank unlocks */
  var CREST_UNLOCK = [2, 5, 10, 18, 28, 40, 55, 70, 85, 100];

  /* ------------------------------------------------------------------ */
  /* Ranks, timings, rules                                               */
  /* ------------------------------------------------------------------ */
  var RANKS = [
    { rank: 1,  name: 'Acolyte',            xp: 0 },
    { rank: 2,  name: 'Ranger',             xp: 120 },
    { rank: 3,  name: 'Warden',             xp: 400 },
    { rank: 4,  name: 'Sentinel',           xp: 1100 },
    { rank: 5,  name: 'Maester',            xp: 2800 },
    { rank: 6,  name: 'Knight of the Rift', xp: 7000 },
    { rank: 7,  name: 'Lord Hunter',        xp: 18000 },
    { rank: 8,  name: 'Hand of the Rift',   xp: 46000 },
    { rank: 9,  name: 'Prince of Ash',      xp: 120000 },
    { rank: 10, name: 'Sovereign Slayer',   xp: 320000 }
  ];
  var SEAL_TIME = [0, 75, 70, 65, 55, 50, 45, 40, 35, 30, 25];

  var WORLD = {
    initial: 1000000000,      /* one billion houses at first light */
    refillBelow: 500000,
    refillTo: 1000000000
  };

  var RULES = {
    bindRange: 5,
    relicPickup: 25,
    attuneRange: 12,
    demonPopulation: 9,
    spawnMin: 120,
    spawnMax: 700,
    cullDistance: 3500,
    driftMinMs: 20000,
    driftMaxMs: 45000,
    maxWards: 5,
    wardRegenMs: 20 * 60000,
    markedMs: 10 * 60000,
    sanctums: 4,
    sanctumRadius: [140, 260],
    servantSlots: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6],
    attuneSlots: [0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 8]
  };

  global.DATA = {
    DEMONS: HOUSES, GREAT: GREAT,
    RELICS: RELICS, RELIC_KEYS: RELIC_KEYS, EFFECTS: EFFECTS,
    CRESTS: CRESTS, CREST_UNLOCK: CREST_UNLOCK,
    RANKS: RANKS, SEAL_TIME: SEAL_TIME, RULES: RULES, WORLD: WORLD,
    NUMERALS: NUMERALS
  };
})(window);
