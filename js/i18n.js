/* =====================================================================
   i18n.js — interface languages. Content (lore, house names) stays in
   the tongue of the game; the chrome follows the player.
   ===================================================================== */
(function (global) {
  'use strict';

  var LANGS = [
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'العربية' },
    { code: 'fr', label: 'Français' }
  ];

  var EN = {
    tagline: 'A hundred houses move across the real world. Bind them at five paces, break their conditions, and take them into your service.',
    enter: 'Enter the Rift',
    warn: 'Look up while you walk. Never hunt while driving, and never step onto a road or private land for a marker.',
    foot: 'Headphones recommended',
    rank: 'Sigil', might: 'Might', shards: 'Shards', slain: 'Slain', wards: 'Wards',
    listening: 'listening…', nothing: 'nothing stirs within sight', marked: 'MARKED',
    codex: 'Codex', household: 'Household', war: 'War', vault: 'Vault', menu: 'Menu',
    bind: 'Bind it to you', speak: 'Speak with it', crack: 'Crack the seal',
    relics: 'Relics', kill: 'Kill it', claim: 'Take it into service', answer: 'Answer',
    withdraw: 'Withdraw', cast: 'Cast', yield: 'Yield', close: 'Close',
    distance: 'distance', bearing: 'bearing', binding: 'binding', conditions: 'conditions',
    bond: 'bond', warded: 'warded', blind: 'blind',
    seal: 'Seal', set_password: 'Set a password', use_drop: 'Use and drop it',
    cancel: 'Cancel', store: 'Store', withdraw_item: 'Withdraw', open: 'Open',
    servants: 'Servants', attuned: 'attuned', wield: 'Wield',
    challenge: 'Challenge', leave_field: 'Leave the field',
    banner: 'Choose your banner', chronicle: 'Chronicle',
    sound: 'Sound', map_style: 'Map', tiles: 'Tiles', recentre: 'Recentre', erase: 'Erase this world',
    language: 'Language', centre_me: 'Centre on me',
    mark_place: 'Mark this place', note: 'Note', public: 'Public', private: 'Private',
    add_sign: 'Set the sign', signs: 'Signs',
    hasher: 'Hasher', hasher_start: 'Activate the hasher', hasher_stop: 'Stop',
    hasher_resume: 'Resume', hasher_abandon: 'Abandon', hashrate: 'hash rate', eta: 'time left',
    world: 'Houses in the world', you_own: 'yours', please_wait: 'working…',
    kill_now: 'Kill it', spoils: 'It yields', locked_by_hunter: 'Sealed by another hunter',
    no_password: 'No password is ever typed. The hasher does the work.',
    taken: 'Taken', lost: 'Lost', won: 'Won', failed: 'Failed',
    pages: 'page', next: 'Next', prev: 'Back', powers: 'Powers', weakness: 'Weakness', life: 'Life', rumour: 'Rumour', origin: 'Origin'
  };

  var DICT = { en: EN };
  var current = 'en';

  function register(code, dict) {
    DICT[code] = Object.assign({}, EN, dict);
  }
  function setLang(code) {
    if (!DICT[code]) code = 'en';
    current = code;
    try {
      document.documentElement.setAttribute('lang', code);
      document.documentElement.setAttribute('dir', code === 'ar' ? 'rtl' : 'ltr');
      document.body.classList.toggle('rtl', code === 'ar');
    } catch (e) {}
  }
  function lang() { return current; }
  function t(key, vars) {
    var d = DICT[current] || EN;
    var s = d[key] || EN[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }

  global.I18N = { LANGS: LANGS, register: register, setLang: setLang, lang: lang, t: t, EN: EN };
  global.t = t;
})(window);
