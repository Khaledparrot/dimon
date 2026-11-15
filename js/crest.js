/* =====================================================================
   crest.js — heraldic crests for hunters. One hundred of them, drawn
   as SVG shields: field division, charge, and a second charge for the
   higher banners. No image files.
   ===================================================================== */
(function (global) {
  'use strict';

  var SHIELD = 'M50 3 L95 13 V57 C95 88 75 107 50 117 C25 107 5 88 5 57 V13 Z';

  var CHARGE = {
    star: function (c) {
      var pts = [];
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 14;
        pts.push((Math.cos(a) * r).toFixed(1) + ',' + (Math.sin(a) * r).toFixed(1));
      }
      return '<polygon points="' + pts.join(' ') + '" fill="' + c + '"/>';
    },
    crown: function (c) {
      return '<path d="M-14 9 L-14 -5 L-7 1 L0 -10 L7 1 L14 -5 L14 9 Z" fill="' + c + '"/>';
    },
    sword: function (c) {
      return '<path d="M0 -17 L3 -9 L3 7 L-3 7 L-3 -9 Z" fill="' + c + '"/>' +
        '<rect x="-9" y="6" width="18" height="3.4" fill="' + c + '"/>' +
        '<rect x="-1.6" y="9" width="3.2" height="7" fill="' + c + '"/>';
    },
    tower: function (c) {
      return '<path d="M-10 10 L-10 -7 L-6 -7 L-6 -12 L-2 -12 L-2 -7 L2 -7 L2 -12 L6 -12 L6 -7 L10 -7 L10 10 Z" fill="' + c + '"/>' +
        '<rect x="-2.5" y="1" width="5" height="9" fill="none" stroke="' + c + '" stroke-width="1.6"/>';
    },
    key: function (c) {
      return '<circle cx="0" cy="-8" r="5.5" fill="none" stroke="' + c + '" stroke-width="3"/>' +
        '<rect x="-1.6" y="-3" width="3.2" height="16" fill="' + c + '"/>' +
        '<rect x="1.6" y="7" width="6" height="3" fill="' + c + '"/>' +
        '<rect x="1.6" y="12" width="4.5" height="3" fill="' + c + '"/>';
    },
    eye: function (c) {
      return '<path d="M-16 0 Q0 -13 16 0 Q0 13 -16 0 Z" fill="none" stroke="' + c + '" stroke-width="2.4"/>' +
        '<circle cx="0" cy="0" r="4.2" fill="' + c + '"/>';
    },
    flame: function (c) {
      return '<path d="M0 -15 C6 -7 10 -3 10 4 A10 10 0 0 1 -10 4 C-10 -3 -6 -7 0 -15 Z" fill="' + c + '"/>';
    },
    raven: function (c) {
      return '<path d="M-14 6 L-7 -5 L-3 -11 L1 -4 L10 -3 L15 6 L6 4 L0 9 L-6 4 Z" fill="' + c + '"/>';
    },
    wolf: function (c) {
      return '<path d="M-12 8 L-12 -9 L-6 -4 L-2 -11 L2 -4 L6 -9 L12 -9 L12 8 L6 4 L0 10 L-6 4 Z" fill="' + c + '"/>';
    },
    serpent: function (c) {
      return '<path d="M-11 9 C-2 9 -2 1 -11 1 C-19 1 -19 -7 -11 -7 L11 -7" fill="none" stroke="' + c +
        '" stroke-width="3.4" stroke-linecap="round"/>';
    }
  };

  function division(kind, field, metal) {
    switch (kind) {
      case 'pale': return '<rect x="38" y="0" width="24" height="120" fill="' + metal + '"/>';
      case 'fess': return '<rect x="0" y="48" width="100" height="24" fill="' + metal + '"/>';
      case 'quarterly': return '<rect x="0" y="0" width="50" height="60" fill="' + metal + '"/>' +
        '<rect x="50" y="60" width="50" height="60" fill="' + metal + '"/>';
      case 'bend': return '<polygon points="0,0 34,0 100,74 100,110" fill="' + metal + '"/>';
      case 'chevron': return '<polygon points="50,30 100,86 100,110 50,56 0,110 0,86" fill="' + metal + '"/>';
      case 'cross': return '<rect x="40" y="0" width="20" height="120" fill="' + metal + '"/>' +
        '<rect x="0" y="46" width="100" height="20" fill="' + metal + '"/>';
      case 'saltire': return '<polygon points="0,0 18,0 100,82 100,100 82,100 0,18" fill="' + metal + '"/>' +
        '<polygon points="82,0 100,0 100,18 18,100 0,100 0,82" fill="' + metal + '"/>';
      default: return '';
    }
  }

  /* crest index -> deterministic shield */
  function svg(crest, size, opts) {
    opts = opts || {};
    size = size || 64;
    var field = crest.field, metal = crest.metal;
    var banded = crest.division !== 'plain';
    var c1 = banded ? metal : metal;
    var c2 = field;

    var inner = division(crest.division, field, metal);
    var chargeColour = banded ? field : metal;

    var main = CHARGE[crest.charge] || CHARGE.star;
    var second = crest.charge2 && crest.charge2 !== crest.charge ? CHARGE[crest.charge2] : null;

    var g = '<g clip-path="url(#shieldclip)">' +
      '<rect x="0" y="0" width="100" height="120" fill="' + field + '"/>' + inner + '</g>';

    g += '<g transform="translate(50,58) scale(1.15)">' + main(chargeColour) + '</g>';
    if (second && opts.cadet) {
      g += '<g transform="translate(50,92) scale(0.5)">' + second(chargeColour) + '</g>';
    }

    return '<svg class="crest" viewBox="0 0 100 124" width="' + size + '" height="' + (size * 1.24) +
      '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><clipPath id="shieldclip"><path d="' + SHIELD + '"/></clipPath></defs>' +
      g +
      '<path d="' + SHIELD + '" fill="none" stroke="' + (opts.stroke || '#2a2118') + '" stroke-width="3"/>' +
      '<path d="' + SHIELD + '" fill="none" stroke="' + (opts.rim || '#c9a227') + '" stroke-width="1.2" ' +
      'transform="translate(50,60) scale(0.9) translate(-50,-60)"/>' +
      '</svg>';
  }

  /* a tiny map token: the shield on a dark disc */
  function token(crest, size) {
    size = size || 34;
    return '<div class="ptoken" style="width:' + size + 'px;height:' + (size * 1.2) + 'px">' + svg(crest, size) + '</div>';
  }

  global.Crest = { svg: svg, token: token, list: function () { return global.DATA.CRESTS; } };
})(window);
