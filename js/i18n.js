/* Languages. English is the source: every interface string is written in
   English in the code and looked up in the current language pack, which is an
   optional file under js/lang/. Anything a pack does not cover stays English. */
(function (root) {
  'use strict';
  var KEY = 'cy.lang', listeners = [];
  var I = { codes: ['en', 'el', 'tr'], labels: { en: 'EN', el: 'ΕΛ', tr: 'TR' }, names: { en: 'English', el: 'Ελληνικά', tr: 'Türkçe' }, lang: 'en' };

  function known(l) { return I.codes.indexOf(l) >= 0; }
  function pack() { return (root.LANGS || {})[I.lang] || {}; }
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k) && typeof o[k] === 'string' && o[k] !== ''; }
  function pickLang() {
    var s = null, n = '';
    try { s = root.localStorage.getItem(KEY); } catch (e) {}
    if (known(s)) return s;
    try { n = String(root.navigator.language || '').toLowerCase().slice(0, 2); } catch (e) {}
    return n !== 'en' && known(n) ? n : 'en';
  }
  function mark() { try { root.document.documentElement.lang = I.lang; } catch (e) {} }

  /* T('Round {0} played.', 3): the English text is the key; {0}, {1}… are filled from the arguments. */
  I.T = function (text) {
    var ui = pack().ui, gd = pack().guide, s = own(ui, text) ? ui[text] : own(gd, text) ? gd[text] : String(text), a = arguments;
    if (a.length < 2) return s;
    return s.replace(/\{(\d+)\}/g, function (m, i) { return a[+i + 1] === undefined ? m : a[+i + 1]; });
  };

  I.onChange = function (f) { listeners.push(f); };
  I.set = function (lang) {
    if (!known(lang)) lang = 'en';
    I.lang = lang;
    try { root.localStorage.setItem(KEY, lang); } catch (e) {}
    mark();
    listeners.forEach(function (f) { try { f(lang); } catch (e) {} });
  };

  /* A copy of the model with every translatable field taken from the pack
     where the pack has it. Ids, numbers and grouping keys are left alone. */
  I.model = function (M) {
    var m = JSON.parse(JSON.stringify(M)), t = pack().model || {};
    function fill(dst, src, keys) { if (src) keys.forEach(function (k) { if (own(src, k) && dst[k] !== undefined) dst[k] = src[k]; }); }
    function list(dst, src, k) {
      if (!src || !Array.isArray(src[k]) || !Array.isArray(dst[k])) return;
      dst[k] = dst[k].map(function (v, i) { return typeof src[k][i] === 'string' && src[k][i] ? src[k][i] : v; });
    }
    Object.keys(m.cats || {}).forEach(function (k) { if (own(t.cats, k)) m.cats[k] = t.cats[k]; });
    Object.keys(m.outcomes || {}).forEach(function (k) { fill(m.outcomes[k], (t.outcomes || {})[k], ['name', 'desc']); });
    m.lens = {};
    m.dims.forEach(function (d) {
      m.lens[d.lens] = own(t.lens, d.lens) ? t.lens[d.lens] : d.lens;
      fill(d, (t.dims || {})[d.id], ['name', 'short', 'lo', 'hi', 'desc', 'basis']);
    });
    if (t.hold && (own(t.hold, 'name') || own(t.hold, 'desc'))) { m.hold = {}; if (own(t.hold, 'name')) m.hold.name = t.hold.name; if (own(t.hold, 'desc')) m.hold.desc = t.hold.desc; }
    m.players.forEach(function (p) {
      var s = (t.players || {})[p.id];
      fill(p, s, ['name', 'short', 'role']);
      ['interests', 'redlines', 'leverage', 'vuln'].forEach(function (k) { list(p, s, k); });
    });
    Object.keys(m.topics || {}).forEach(function (k) { if (own(t.topics, k)) m.topics[k].name = t.topics[k]; });
    m.moves.forEach(function (v) {
      fill(v, (t.moves || {})[v.id], ['name', 'desc', 'mit', 'counter', 'commitNote']);
      if (v.src && t.srcs) v.src = String(v.src).split(' · ').map(function (x) { return own(t.srcs, x) ? t.srcs[x] : x; }).join(' · ');
    });
    (m.precedents || []).forEach(function (p) { fill(p, (t.precedents || {})[p.id], ['name', 'lesson']); });
    return m;
  };

  I.lang = pickLang();
  mark();
  root.I18N = I;
})(typeof self !== 'undefined' ? self : this);
