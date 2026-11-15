/* =====================================================================
   puzzles.js — seal generators. Difficulty scales with demon rank:
   I–III single step, IV–VI two steps, VII–X three steps.
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------------- SHA-256 (pure JS, no secure context needed) ------ */
  function sha256hex(str) {
    function rr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var bytes = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 128) bytes.push(c);
      else if (c < 2048) { bytes.push(192 | (c >> 6), 128 | (c & 63)); }
      else { bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
    }
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);
    var w = new Array(64);
    for (var off = 0; off < bytes.length; off += 64) {
      for (i = 0; i < 16; i++) {
        w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
      }
      for (i = 16; i < 64; i++) {
        var s0 = rr(7, w[i - 15]) ^ rr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
        var s1 = rr(17, w[i - 2]) ^ rr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], cc = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rr(6, e) ^ rr(11, e) ^ rr(25, e);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rr(2, a) ^ rr(13, a) ^ rr(22, a);
        var mj = (a & b) ^ (a & cc) ^ (b & cc);
        var t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = '';
    for (i = 0; i < 8; i++) out += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
    return out;
  }

  /* ---------------- helpers ---------------- */
  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function caesar(s, k) {
    return s.split('').map(function (c) {
      var x = c.charCodeAt(0);
      if (x >= 65 && x <= 90) return String.fromCharCode(((x - 65 + k % 26 + 26) % 26) + 65);
      return c;
    }).join('');
  }
  function atbash(s) {
    return s.split('').map(function (c) {
      var x = c.charCodeAt(0);
      if (x >= 65 && x <= 90) return String.fromCharCode(90 - (x - 65));
      return c;
    }).join('');
  }
  function rev(s) { return s.split('').reverse().join(''); }
  function modpow(b, e, m) { var r = 1; b %= m; while (e > 0) { if (e & 1) r = (r * b) % m; b = (b * b) % m; e >>= 1; } return r; }
  function gcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }
  function fact(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }
  function comb(n, k) { return Math.round(fact(n) / (fact(k) * fact(n - k))); }
  function hexOf(s) { return s.split('').map(function (c) { return c.charCodeAt(0).toString(16); }).join(''); }
  function fromHex(h) { var o = ''; for (var i = 0; i < h.length; i += 2) o += String.fromCharCode(parseInt(h.substr(i, 2), 16)); return o; }

  var WORDS = ['RIFT', 'ASHEN', 'BLOOD', 'CROWN', 'OATHS', 'BONE', 'IRON', 'VEIL', 'WARDEN', 'RAVEN',
    'EMBER', 'GRAVE', 'HOUND', 'PYRE', 'SIGIL', 'THORN', 'VOW', 'DUSK', 'HALLOW', 'MOURN'];

  /* ---------------- step generators ---------------- */
  var STEP = {
    arith: function (rank) {
      var a = rnd(11, 30 + rank * 7), b = rnd(3, 9 + rank), c = rnd(3, 25);
      return { q: a + ' × ' + b + ' − ' + c, a: String(a * b - c) };
    },
    percent: function () {
      var p = rnd(1, 8) * 5, n = rnd(3, 18) * 20;
      return { q: p + '% of ' + n, a: String(p * n / 100) };
    },
    power: function (rank) {
      var b = rnd(2, 6), e = rnd(2, 3 + Math.min(rank, 4));
      return { q: b + '^' + e, a: String(Math.pow(b, e)) };
    },
    sequence: function (rank) {
      var kind = rnd(0, 2), s = [], i, next;
      if (kind === 0) {
        var st = rnd(2, 9), d = rnd(3, 4 + rank);
        for (i = 0; i < 5; i++) s.push(st + d * i);
        next = st + d * 5;
      } else if (kind === 1) {
        var x = rnd(1, 4), y = rnd(1, 3);
        for (i = 0; i < 5; i++) { s.push(x); var t = x + y; x = y; y = t; }
        next = x;
      } else {
        var base = rnd(2, 3);
        for (i = 1; i <= 4; i++) s.push(Math.pow(base, i) + i);
        next = Math.pow(base, 5) + 5;
      }
      return { q: s.join(', ') + ', ?', a: String(next) };
    },
    mod: function () {
      var b = rnd(3, 9), e = rnd(3, 9), m = pick([7, 11, 13, 17, 19]);
      return { q: b + '^' + e + ' mod ' + m, a: String(modpow(b, e, m)) };
    },
    gcd: function () {
      var x = rnd(24, 96), y = rnd(24, 96);
      return { q: 'gcd(' + x + ', ' + y + ')', a: String(gcd(x, y)) };
    },
    count: function (rank) {
      if (Math.random() < 0.5) {
        var n = rnd(3, 4 + Math.min(rank, 4));
        return { q: 'ways to order ' + n + ' distinct runes', a: String(fact(n)) };
      }
      var m = rnd(5, 9), k = rnd(2, 3);
      return { q: 'ways to choose ' + k + ' from ' + m + ' distinct runes', a: String(comb(m, k)) };
    },
    caesar: function () {
      var w = pick(WORDS), k = rnd(1, 12);
      return { q: 'shift −' + k + ': ' + caesar(w, k), a: w };
    },
    atbash: function () {
      var w = pick(WORDS);
      return { q: 'mirror: ' + atbash(w), a: w };
    },
    b64: function () {
      var w = pick(WORDS);
      return { q: 'base64: ' + btoa(w), a: w };
    },
    hex: function () {
      var w = pick(WORDS);
      return { q: 'hex: ' + hexOf(w), a: w };
    },
    reverse: function () {
      var w = pick(WORDS);
      return { q: 'reverse: ' + rev(w), a: w };
    }
  };

  function stepByCat(cat, rank) {
    switch (cat) {
      case 'math': return Math.random() < 0.6 ? STEP.arith(rank) : STEP.percent(rank);
      case 'sequence': return STEP.sequence(rank);
      case 'logic': return STEP.sequence(rank);
      case 'caesar': return STEP.caesar();
      case 'atbash': return STEP.atbash();
      case 'base64': return Math.random() < 0.5 ? STEP.b64() : STEP.hex();
      case 'modmath': return Math.random() < 0.5 ? STEP.mod() : STEP.gcd();
      case 'hash': return Math.random() < 0.5 ? STEP.b64() : STEP.hex();
      case 'combinatorics': return STEP.count(rank);
      default: return STEP.arith(rank);
    }
  }

  /* ---------------- composed seals ---------------- */
  function make(rank, cat) {
    rank = rank || 1;

    /* Rank I–III: one step, plain. */
    if (rank <= 3) {
      var s = stepByCat(cat, rank);
      return {
        q: s.q, ans: [s.a], hint: hintFor(cat), steps: 1, cat: cat,
        title: 'Seal of the ' + (rank <= 1 ? 'First' : rank === 2 ? 'Second' : 'Third') + ' Circle'
      };
    }

    /* Rank IV–VI: two steps. */
    if (rank <= 6) {
      var two = makeTwoStep(rank, cat);
      return { q: two.q, ans: [two.a], hint: hintFor(cat), steps: 2, cat: cat, title: 'Seal of the Fourth Circle' };
    }

    /* Rank VII+: three steps. */
    var three = makeThreeStep(rank, cat);
    return {
      q: three.q, ans: [three.a], hint: rank >= 8 ? '' : hintFor(cat),
      steps: 3, cat: cat, title: 'Seal of the ' + (rank >= 9 ? 'Ninth' : 'Seventh') + ' Circle'
    };
  }

  function makeTwoStep(rank, cat) {
    var w = pick(WORDS), k = rnd(2, 11), mode = rnd(0, 3);
    if (mode === 0) {
      return { q: 'Decode the base64, then shift every letter back by ' + k + ':\n' + btoa(caesar(w, k)), a: w };
    }
    if (mode === 1) {
      return { q: 'Read the hex, then mirror it (A↔Z):\n' + hexOf(atbash(w)), a: w };
    }
    if (mode === 2) {
      var b = rnd(3, 9), e = rnd(4, 9), m = pick([7, 11, 13, 17]);
      var r = modpow(b, e, m);
      return { q: 'Compute ' + b + '^' + e + ' mod ' + m + ', then turn that number into a letter (1=A).', a: String.fromCharCode(64 + r) };
    }
    var x = rnd(30, 80), y = rnd(20, 60);
    return { q: 'Take gcd(' + x + ', ' + y + '), multiply it by ' + k + '.', a: String(gcd(x, y) * k) };
  }

  function makeThreeStep(rank, cat) {
    var w = pick(WORDS), k = rnd(3, 13), mode = rnd(0, 3);
    if (mode === 0) {
      return {
        q: 'Three locks on this one.\n1. Shift every letter back by ' + k + '\n2. Mirror the result (A↔Z)\n3. Reverse it\nCipher: ' + btoa(atbash(caesar(w, k))).replace(/=+$/, ''),
        a: rev(w)
      };
    }
    if (mode === 1) {
      var b = rnd(4, 9), e = rnd(5, 11), m = pick([11, 13, 17, 19]);
      var r = modpow(b, e, m), k2 = rnd(2, 9);
      return {
        q: 'Compute ' + b + '^' + e + ' mod ' + m + ', then multiply by ' + k2 + ', then take that mod ' + m + '.',
        a: String((r * k2) % m)
      };
    }
    if (mode === 2) {
      var n = rnd(5, 8), kk = rnd(2, 3);
      return {
        q: 'A court of ' + n + ' demons must seat ' + kk + ' of them on a council — order matters.\nHow many arrangements?',
        a: String(Math.round(fact(n) / fact(n - kk)))
      };
    }
    var w2 = pick(WORDS);
    return {
      q: 'Hex, then mirror, then shift back by ' + k + ':\n' + hexOf(atbash(caesar(w2, k))),
      a: w2
    };
  }

  function hintFor(cat) {
    switch (cat) {
      case 'math': return 'Multiply before you subtract. Percent means ÷100.';
      case 'sequence': return 'Look at the gaps, not the numbers.';
      case 'logic': return 'Only the empty conclusion is always true.';
      case 'caesar': return 'Shift each letter back by the number given.';
      case 'atbash': return 'A↔Z, B↔Y, C↔X. The alphabet folded in half.';
      case 'base64': return 'Base64 pads with = and hides 3 bytes in 4 characters.';
      case 'modmath': return 'Reduce after every multiplication; gcd by Euclid.';
      case 'hash': return 'A hash hides its input. Only the prefix is a clue.';
      case 'combinatorics': return 'Order matters → permutations. Order does not → combinations.';
      default: return 'Work backwards from the last lock.';
    }
  }

  /* ---------------- seal-breaking proof of work ---------------- */
  function difficultyFor(rank) {
    return Math.max(2, Math.min(7, 1 + Math.ceil(rank * 0.7)));
  }

  global.Puzzles = {
    make: make,
    sha256: sha256hex,
    difficultyFor: difficultyFor,
    hintFor: hintFor
  };
})(window);
