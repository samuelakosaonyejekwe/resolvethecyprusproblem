/* Interface for the Cyprus Strategy Board. */
(function () {
  'use strict';
  var M0 = window.MODEL, E = window.Engine, L = window.Live, I = window.I18N, T = I.T;
  var M = I.model(M0); /* the model in the current language; rebuilt when the language changes */
  var LS = 'cy.app.v2';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = $('#view'), sheet = $('#sheet');
  E.T = T;

  var A = { pid: null, tab: 'board', sel: null, mode: 'sustainable', horizon: 6, live: true, sigOff: {}, own: [],
    cat: 'all', play: 'auto', manual: {}, priv: {}, lib: 'players', q: '', opp: null, theme: null, custom: { base: {}, w: {}, ideal: {} }, newsTheme: 'all' };
  var C = null, S = null, stack = [], cache = {}, KB = null, deferred = null;

  /* Tables of labels are functions so that they follow the current language. */
  function TABS() { return [['board', '♟', T('Board')], ['path', '➤', T('Best path')], ['analysis', '◫', T('Analysis')], ['live', '◉', T('Live intel')], ['library', '☰', T('Library')], ['guide', '?', T('Guide')]]; }
  function MODES() {
    return { self: [T('My payoff'), T('Maximise your own stakeholder\'s payoff, whatever it does to the others.')],
      sustainable: [T('Sustainable'), T('Your payoff, minus a penalty whenever a party that can block the outcome (Republic of Cyprus, Turkish Cypriots, Türkiye) ends worse off than today, or stability erodes. Deals that leave a veto player worse off do not last.')],
      collective: [T('Collective'), T('The power-weighted average payoff of all ten stakeholders.')] };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function P(id) { return C.players[id].src; }
  function dim(i) { return M.dims[i]; }
  function sgn(v, dp) { var r = v.toFixed(dp === undefined ? 1 : dp); return (v > 0 ? '+' : '') + r; }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function cls(v, t) { t = t || 0.3; return v > t ? 'good' : v < -t ? 'bad' : ''; }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 3200); }
  /* "A and B and C", with the joining word open to translation. */
  function andList(a) { return a.reduce(function (x, y) { return T('{0} and {1}', x, y); }); }

  /* ---------- persistence ---------- */
  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({ pid: A.pid, tab: A.tab, mode: A.mode, horizon: A.horizon, live: A.live, sigOff: A.sigOff, own: A.own, play: A.play, priv: A.priv, custom: A.custom, theme: A.theme, opp: A.opp }));
    } catch (e) {}
    var h = A.pid ? '#p=' + A.pid + (A.own.length ? '&m=' + A.own.join(',') : '') : '';
    try { history.replaceState(history.state, '', location.pathname + location.search + h); } catch (e) {}
  }
  function restore() {
    try { Object.assign(A, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
    var m = /#p=([A-Z]+)(?:&m=([\w.,~=-]+))?/.exec(location.hash);
    if (m && M.players.some(function (p) { return p.id === m[1]; })) { A.pid = m[1]; A.own = m[2] ? m[2].split(',') : []; }
    A.custom = Object.assign({ base: {}, w: {}, ideal: {} }, A.custom || {});
    A.sel = null; A.manual = {};
    if (A.play !== 'manual') A.play = 'auto';
  }

  /* ---------- page history: back and forward arrows, and the device's own back button ---------- */
  var navI = 0, navMax = 0;
  function navState() { return { i: navI, pid: A.pid, tab: A.tab, lib: A.lib }; }
  function navPush() {
    navI += 1; navMax = navI;
    try { history.pushState(navState(), '', location.href); } catch (e) {}
    save(); navButtons();
  }
  function navButtons() {
    var b = $('#navBack'), f = $('#navFwd');
    if (b) b.disabled = navI <= 0;
    if (f) f.disabled = navI >= navMax;
  }
  window.addEventListener('popstate', function (e) {
    var st = e.state;
    if (!st || st.i === undefined) return;
    navI = st.i;
    if (st.pid !== A.pid) { A.pid = st.pid; if (st.pid) { A.own = []; replay(); } }
    A.tab = st.tab || 'board'; A.lib = st.lib || 'players'; A.sel = null; A.manual = {};
    $('#modal').hidden = true;
    save(); render(); window.scrollTo(0, 0);
  });

  /* ---------- model assembly: defaults + user edits + live signals ---------- */
  function activeSignals() {
    var d = L.get();
    if (!A.live || !d || !d.signals) return [];
    return d.signals.filter(function (s) { return !A.sigOff[s.id]; });
  }
  function build() {
    var m = JSON.parse(JSON.stringify(M));
    m.dims.forEach(function (d) { if (A.custom.base[d.id] !== undefined) d.base = A.custom.base[d.id]; });
    m.players.forEach(function (p) {
      Object.keys(A.custom.w[p.id] || {}).forEach(function (k) { p.w[k] = A.custom.w[p.id][k]; });
      Object.keys(A.custom.ideal[p.id] || {}).forEach(function (k) { p.ideal[k] = A.custom.ideal[p.id][k]; });
    });
    activeSignals().forEach(function (s) {
      if (s.dim && s.adj) m.dims.forEach(function (d) { if (d.id === s.dim) d.base = E.clamp(d.base + s.adj); });
      if (s.weight) m.players.forEach(function (p) { if (p.id === s.weight.player) s.weight.dims.forEach(function (k) { p.w[k] = (p.w[k] || 0) * s.weight.factor; }); });
    });
    /* Live agenda: a move whose subject is climbing the world's news gets a
       slightly better chance of working; one whose subject is fading, slightly
       worse. */
    if (A.live && !A.sigOff.momentum) m.moves.forEach(function (mv) {
      var ag = L.agenda(mv.topic), k = ag ? ag.k : null, ps = mv.ps === undefined ? 0.8 : mv.ps;
      if (k === 'rising') mv.ps = Math.min(0.95, ps + 0.05);
      else if (k === 'fading') mv.ps = Math.max(0.05, ps - 0.03);
    });
    /* What each government has been saying lately tilts its choices a little. */
    /* ...and the user's own private assessment is added on top: the user may know more than the public record shows. */
    var vs0 = A.live && !A.sigOff.voices ? (L._lazy ? L._voicesReady() : L.voices()) : null;
    if (vs0) L.remember(vs0);
    A.priv = A.priv || {};
    m.players.forEach(function (pl) {
      var v = (vs0 && vs0[pl.id] ? vs0[pl.id].lean : 0) + 0.3 * (+A.priv[pl.id] || 0);
      pl.lean = v > 1 ? 1 : v < -1 ? -1 : v;
    });
    /* Recalculate only when something that feeds the model has really changed. */
    var key = I18N.lang + JSON.stringify([m.dims.map(function (d) { return d.base; }), m.players.map(function (pl) { return [pl.w, pl.ideal, +pl.lean.toFixed(3)]; }), m.moves.map(function (mv) { return mv.ps; })]);
    if (C && key === build.key) return false;
    build.key = key; build.model = m; build.stamp = (build.stamp || 0) + 1;
    C = E.compile(m);
    replay();
    return true;
  }

  /* ---------- heavy calculations in the background ----------
     Where the browser allows it, the long calculations run on a separate
     thread. If it does not (a copy opened straight from a file, an old
     browser), `fallback` does the same work on the page instead. */
  var bgWorker = null, bgJobs = {}, bgId = 0, bgOff = location.protocol === 'file:' || typeof Worker === 'undefined';
  L._lazy = !bgOff;
  function background(job, opt, done, fallback, snap) {
    if (!bgOff && !bgWorker) {
      try {
        bgWorker = new Worker('js/worker.js');
        bgWorker.onmessage = function (e) { var f = bgJobs[e.data.id]; delete bgJobs[e.data.id]; if (f) { if (e.data.error) f.fallback(); else f.done(e.data.out); } };
        bgWorker.onerror = function () { bgOff = true; L._lazy = false; bgWorker = null; var js = bgJobs; bgJobs = {}; Object.keys(js).forEach(function (k) { js[k].fallback(); }); };
      } catch (e) { bgOff = true; L._lazy = false; bgWorker = null; }
    }
    if (bgOff || !bgWorker) return fallback();
    var id = ++bgId; bgJobs[id] = { done: done, fallback: fallback };
    if (snap) bgWorker.postMessage({ id: id, job: job, snap: snap });
    else bgWorker.postMessage({ id: id, job: job, stamp: build.stamp, model: build.model, state: { x: S.x, used: S.used, round: S.round, history: [] }, pid: A.pid, opt: opt });
  }

  /* ---------- live evidence on the subject of a move ---------- */
  function wantTopics(first) {
    var list = [];
    function add(t) { if (t && M.topics[t]) list.push({ id: t, q: M.topics[t].q, must: M.topics[t].must, sub: M.topics[t].sub }); }
    if (first && M.topics[first] && M.topics[first].own) { add(first); L.want(list, true); list = []; }
    Object.keys(M.topics).forEach(function (t) { if (M.topics[t].own) add(t); });
    L.want(list, false);
  }
  function momentumName(k) { return { rising: T('rising'), steady: T('steady'), fading: T('fading') }[k] || ''; }
  function momentumTag(k) { return '<span class="tag ' + (k === 'rising' ? 'good' : k === 'steady' ? 'info' : 'warn') + '">' + momentumName(k) + '</span>'; }
  function evidence(m) {
    if (m.hold || !m.src.topic) return '';
    var id = m.src.topic, tp = M.topics[id], ag = L.agenda(id), rp = L.reports(id, tp), base = M0move(m.id), d = L.get() || {};
    var h = '<section class="card"><h3>' + T('Live evidence: {0}', esc(tp.name)) + '</h3><p class="help">' + T('What the world is paying attention to on the subject of this move right now: how many people a day are reading the reference articles on it (Wikimedia), and the current headlines on it, read directly from Greek Cypriot, Turkish Cypriot and Greek newspapers and from the GDELT news index. Fetched by your device and renewed every few hours.') + '</p>';
    if (!ag && !rp.length && !d.attn && !d.news && !d.press) return h + '<p class="help">' + (navigator.onLine === false ? T('You are offline and no evidence on this subject has been saved yet.') : T('Fetching current evidence… it appears here in a few seconds.')) + '</p></section>';
    if (ag) {
      h += '<div class="kv"><div><b>' + ag.r7.toLocaleString(locale()) + '</b><span>' + T('readers a day, last 7 days') + '</span></div><div><b>' + ag.r28.toLocaleString(locale()) + '</b><span>' + T('readers a day, 4 weeks before') + '</span></div><div><b class="' + cls(ag.ratio - 1, 0.2) + '">' + sgn((ag.ratio - 1) * 100, 0) + '%</b><span>' + T('change in attention') + ' ' + momentumTag(ag.k) + '</span></div></div>' + spark(ag.series, 'var(--info)');
      var eff = !A.live || A.sigOff.momentum ? T('Live adjustment is switched off, so the chance of success is unchanged.') :
        ag.k === 'rising' ? T('Attention to this subject is up by a quarter or more, so decision-makers have reason and cover to act: chance of success raised from {0} to {1}.', pct(base), pct(m.ps)) :
        ag.k === 'fading' ? T('Attention to this subject has dropped by a fifth or more, so an initiative has less to carry it: chance of success lowered from {0} to {1}.', pct(base), pct(m.ps)) :
        T('Attention is steady: chance of success unchanged at {0}.', pct(m.ps));
      h += '<p style="margin-top:8px"><b>' + T('Effect on the result:') + '</b> ' + eff + '</p>';
    } else h += '<p class="help">' + T('Readership figures for this subject are not available yet; the chance of success is unchanged.') + '</p>';
    function items(f, n) { return rp.filter(f).slice(0, n).map(function (a) { return '<li><a href="' + esc(a.url) + '" target="_blank" rel="noopener" lang="' + a.lang + '">' + esc(a.title) + '</a> <span class="help">' + esc(a.domain) + ((a.outlets || []).length > 1 ? ' ' + T('and {0} more', a.outlets.length - 1) : '') + ' · ' + esc(a.date) + '</span> ' + hideBtn(a.title) + '</li>'; }).join(''); }
    rp = rp.slice().sort(function (x, y) { return (y.lang === I18N.lang) - (x.lang === I18N.lang) || (x.date < y.date ? 1 : x.date > y.date ? -1 : 0); });
    var said = items(function (a) { return a.said; }, 3), meet = items(function (a) { return a.meet && !a.said; }, 3), rest = items(function (a) { return !a.said && !a.meet; }, 3);
    if (said) h += '<h3>' + T('What is being said') + '</h3><ul class="news">' + said + '</ul>';
    if (meet) h += '<h3>' + T('Meetings and conferences') + '</h3><ul class="news">' + meet + '</ul>';
    if (rest) h += '<h3>' + T('Other current reports') + '</h3><ul class="news">' + rest + '</ul>';
    if (!rp.length) h += '<p class="help">' + (tp.own && L.pending(id) ? T('Looking for current headlines on this subject…') : T('No headlines plainly on this subject in the last 21 days.')) + '</p>';
    else h += '<p class="help">' + T('{0} stories on this subject in the last 21 days, from newspapers and the news index. The same story in several papers is counted once. Headlines are shown as published, those in your language first.', rp.length) + '</p>';
    return h + '</section>';
  }
  /* Lets the reader take a wrongly sorted headline out of every count. */
  function hideBtn(title) { return '<button class="x" data-a="hide" data-v="' + esc(title) + '" title="' + esc(T('Not about this: leave it out')) + '" aria-label="' + esc(T('Not about this: leave it out')) + '">×</button>'; }
  /* Nothing said lately: show the standing position from the current reference article, clearly labelled. */
  function standingCell(pid) {
    var sp = L.standing(pid);
    return '<span class="mute">' + T('Nothing said or done about Cyprus was found in the last three months.') + '</span>' +
      (sp ? '<br><span class="tag">' + T('standing position') + '</span> <span lang="en">' + esc(sp.text) + '</span> <a href="' + esc(sp.url) + '" target="_blank" rel="noopener">Wikipedia</a>' + (sp.updated ? ' <span class="help">' + T('article updated {0}', esc(sp.updated)) + '</span>' : '') : '');
  }
  /* The reading of one item, as a button: pressing it changes the reading. */
  function toneBtn(x) {
    var nm = { soft: T('conciliatory'), hard: T('hard-line'), plain: T('neither'), unsure: T('unsure: you decide') }[x.tone], c = x.tone === 'soft' ? 'good' : x.tone === 'hard' ? 'bad' : x.tone === 'unsure' ? 'warn' : '';
    return '<button class="tag tonebtn ' + c + '" data-a="tone" data-v="' + esc(x.title) + '" data-t="' + x.tone + '" title="' + esc(T('Press to change how this is read')) + '">' + nm + (x.set ? ' ✓' : '') + '</button>';
  }
  function M0move(id) { var r = M.moves.filter(function (x) { return x.id === id; })[0]; return r && r.ps !== undefined ? r.ps : 0.8; }
  function locale() { return I18N.lang === 'en' ? 'en-GB' : I18N.lang; }
  function replay() {
    S = E.newState(C); stack = []; cache = {};
    var kept = [];
    if (A.pid) A.own.forEach(function (entry) {
      var parts = String(entry).split('~'), id = parts[0], mv = C.moves[id], forced = null;
      if (!mv || mv.p !== A.pid || E.blocked(C, S, mv)) return;
      parts.slice(1).forEach(function (kv) { var a = kv.split('='); if (C.players[a[0]] && C.moves[a[1]]) { forced = forced || {}; forced[a[0]] = a[1]; } });
      var r = E.round(C, S, A.pid, id, { deep: true, forced: forced });
      r.manual = !!forced;
      stack.push({ S: S, r: r }); S = r.state; kept.push(entry);
    });
    A.own = kept;
  }

  function recKeep(c, list) {
    var hold = list.filter(function (r) { return r.m.hold; })[0];
    list.forEach(function (r) { r.rel = r.gain - (hold ? hold.gain : 0); });
    c.rec = list;
  }
  function recs() {
    if (!cache.rec) recKeep(cache, E.recommend(C, S, A.pid, { horizon: 3, mode: A.mode }));
    return cache.rec;
  }
  /* Work the recommendation out a little at a time, so the page stays responsive, then call back.
     If the user moves on in the meantime the unfinished work is simply dropped. */
  function recsSoon(then) {
    if (cache.rec || !A.pid) return then();
    var c0 = cache, job = E.recommendJob(C, S, A.pid, { horizon: 3, mode: A.mode });
    (function next() {
      if (cache !== c0) return;
      if (cache.rec) return then();
      if (!job.step(24)) return setTimeout(next, 0);
      recKeep(c0, job.result()); then();
    })();
  }
  function recFor(id) { return recs().filter(function (r) { return r.m.id === id; })[0]; }

  /* The replies the user has chosen for the other players (manual play). */
  function forcedMap() {
    var f = {};
    C.order.forEach(function (q) {
      if (q === A.pid) return;
      var v = A.manual[q];
      if (v === 'auto') return;
      f[q] = v && C.moves[v] && !E.blocked(C, S, C.moves[v]) ? v : q + '.hold';
    });
    return f;
  }

  /* The step-by-step guide on each page is open the first time the page is
     visited and folded away afterwards, to leave the room to the content. */
  function seenPage(title) {
    var k = 'cy.seen.' + A.tab, was = false;
    try { was = localStorage.getItem(k) === '1'; localStorage.setItem(k, '1'); } catch (e) {}
    if (seenPage.now === A.tab) return false;      /* still on the first visit */
    if (!was) seenPage.now = A.tab;
    return was;
  }

  /* Every page opens with what it shows and how to use it. */
  function intro(title, lead, steps) {
    return '<section class="card intro"><h1>' + title + '</h1><p class="lead">' + lead + '</p>' +
      (steps ? '<details class="explain"' + (seenPage(title) ? '' : ' open') + '><summary>' + T('How to use this page') + '</summary><ol class="list">' + steps.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol></details>' : '') + nextStep() + '</section>';
  }
  /* One plain sentence on every page saying what to do next, with the buttons that do it. */
  function tabBtn(id) { var t = TABS().filter(function (x) { return x[0] === id; })[0]; return '<button class="btn small" data-a="tab" data-v="' + id + '">' + t[1] + ' ' + t[2] + '</button>'; }
  function findBtn() { return '<button class="btn small" data-a="find">' + T('Find anything') + '</button>'; }
  function nextStep() {
    var t, b = '';
    if (!A.pid && A.tab !== 'guide') { t = T('<b>Next step:</b> choose the stakeholder you want to play. You can change seat at any time.'); b = findBtn(); }
    else if (A.tab === 'guide') { t = T('<b>Next step:</b> open the section you need, or press <b>Find anything</b> to search the whole app.'); b = findBtn() + (A.pid ? tabBtn('board') : ''); }
    else if (A.tab === 'path') { t = T('<b>Next step:</b> play the first step of this path, or open <b>Analysis</b> to test how well it stands up.'); b = tabBtn('analysis') + tabBtn('board'); }
    else if (A.tab === 'analysis') { t = T('<b>Next step:</b> if the move stands up, go back to the board and play it. To check the evidence behind it, open <b>Live intel</b>.'); b = tabBtn('board') + tabBtn('live'); }
    else if (A.tab === 'live') { t = T('<b>Next step:</b> correct any headline that was read wrongly, then return to the board. The predictions there already include everything shown here.'); b = tabBtn('board'); }
    else if (A.tab === 'library') { t = T('<b>Next step:</b> use the buttons below to move between stakeholders, blueprints, precedents, assumptions and method. Changing an assumption updates every prediction at once.'); b = tabBtn('board') + findBtn(); }
    else if (A.sel) { t = T('<b>Next step:</b> read the preview of this move, then press <b>Play this move</b>, or tap another move to compare.'); }
    else if (stack.length) return '';
    else { t = T('<b>Next step:</b> tap a move under <b>Your move</b> to see what it does and how the others answer. The engine\'s choice is marked.'); b = '<button class="btn small accent" data-a="selbest">' + T('Show the engine\'s choice') + '</button>' + tabBtn('path'); }
    return '<div class="next"><span>' + t + '</span>' + (b ? '<span class="row">' + b + '</span>' : '') + '</div>';
  }
  /* After a round: what you played, what each of the others answered, what changed, and what to do now.
     It stays on the board until the next round, so nothing depends on catching a passing message. */
  function justPlayed() {
    if (!stack.length) return '';
    var top = stack[stack.length - 1], r = top.r, x0 = top.S.x, u0 = E.utilities(C, x0)[A.pid], u1 = E.utilities(C, S.x)[A.pid], o0 = outcomeOf(x0), o1 = outcomeOf(S.x);
    var acts = r.replies.filter(function (y) { return !y.chosen.m.hold; }), held = r.replies.filter(function (y) { return y.chosen.m.hold; });
    var moved = M.dims.map(function (d, i) { return { d: d, a: x0[i], b: S.x[i], i: i }; }).filter(function (c) { return Math.abs(c.b - c.a) >= 1; }).sort(function (a, b) { return Math.abs(b.b - b.a) - Math.abs(a.b - a.a); });
    var best = recs()[0], ideal = C.players[A.pid].ideal;
    var h = '<section class="card played" id="played"><div class="row between"><h2>' + T('What just happened') + '</h2><span class="tag">' + T('Round {0}', S.round) + (r.manual ? ' · ' + T('manual') : '') + '</span></div>' +
      '<p><b>' + T('You played:') + '</b> ' + esc(r.move.src.name) + '</p>' +
      '<h3>' + (acts.length ? T('How the others answered') : T('Every other player held position')) + '</h3>';
    if (acts.length) h += '<ul class="answers">' + acts.map(function (y) {
      var g = E.utilities(C, y.after)[A.pid] - E.utilities(C, y.before)[A.pid];
      return '<li><i style="background:' + P(y.pid).color + '">' + esc(P(y.pid).short) + '</i><span><b>' + esc(P(y.pid).name) + ':</b> ' + esc(y.chosen.m.src.name) +
        (y.forced || r.manual ? '' : ' <span class="mute">' + T('{0} likely', pct(y.chosen.p)) + '</span>') +
        (Math.abs(g) >= 0.05 ? ' <span class="tag ' + (g > 0 ? 'good' : 'bad') + '">' + (g > 0 ? T('helps you {0}', sgn(g, 1)) : T('hurts you {0}', sgn(g, 1))) + '</span>' : '') + '</span></li>';
    }).join('') + '</ul>' + (held.length ? '<p class="help">' + T('Held position: {0}.', held.map(function (y) { return esc(P(y.pid).name); }).join(', ')) + '</p>' : '');
    h += '<h3>' + T('What changed') + '</h3>' + (moved.length ? '<div class="fx">' + moved.map(function (c) {
      var toward = Math.abs(c.b - ideal[c.i]) < Math.abs(c.a - ideal[c.i]);
      return '<span class="' + (toward ? 'up' : 'down') + '">' + esc(c.d.short || c.d.name) + ' ' + Math.round(c.a) + ' → ' + Math.round(c.b) + '</span>';
    }).join('') + '</div><p class="help">' + T('Green moved toward your ideal, red away from it. The bars under <b>The position</b> show the new scores.') + '</p>' : '<p class="help">' + T('No measure moved by a full point this round.') + '</p>') +
      '<p>' + T('Your payoff went from <b>{0}</b> to <b class="{2}">{1}</b> out of 100.', u0.toFixed(0), u1.toFixed(0), cls(u1 - u0, 0.3)) + ' ' +
      (o0 === o1 ? T('The situation is still: <b>{0}</b>.', esc(o1.name)) : T('The situation changed from <b>{0}</b> to <b>{1}</b>.', esc(o0.name), esc(o1.name))) + '</p>' +
      '<div class="next"><span>' + (best ? T('<b>Next step:</b> choose your move for round {0}. The engine now suggests <b>{1}</b>.', S.round + 1, esc(best.m.src.name)) : '') + '</span><span class="row">' +
      '<button class="btn small accent" data-a="selbest">' + T('Show the engine\'s choice') + '</button><button class="btn small" data-a="jump" data-v="' + esc('board||' + plain(T('Your move'))) + '">' + T('See all my moves') + '</button>' + tabBtn('path') +
      '<button class="btn small" data-a="jump" data-v="' + esc('board||' + plain(T('Game record'))) + '">' + T('Game record') + '</button><button class="btn small" data-a="undo">' + T('Undo round') + '</button></span></div></section>';
    return h;
  }
  function plain(html) { return String(html).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(); }

  /* ---------- find anything ---------- */
  /* Go to a page, open the section whose heading has this text, and show it. */
  function jumpTo(tab, lib, text) {
    $('#modal').hidden = true;
    var changed = A.tab !== tab || (lib && A.lib !== lib);
    A.tab = tab; if (lib) A.lib = lib;
    A.sel = null;
    if (changed) navPush();
    render();
    setTimeout(function () {
      var hs = view.querySelectorAll('h2, summary'), hit = null, i;
      for (i = 0; i < hs.length && !hit; i++) if (hs[i].offsetParent !== null && hs[i].textContent.trim() === text) hit = hs[i];
      for (i = 0; i < hs.length && !hit; i++) if (hs[i].offsetParent !== null && hs[i].textContent.trim().indexOf(text) >= 0) hit = hs[i];
      if (!hit) { window.scrollTo(0, 0); return; }
      if (hit.tagName === 'SUMMARY') hit.parentNode.open = true;
      var box = hit.closest('section, details') || hit;
      hit.scrollIntoView({ block: 'start' });
      box.classList.add('flash'); setTimeout(function () { box.classList.remove('flash'); }, 1800);
    }, 40);
  }
  function findItems() {
    var out = [], tn = {}, pid = A.pid;
    TABS().forEach(function (t) { tn[t[0]] = t[2]; });
    function sec(tab, lib, title, label) { out.push({ l: label || plain(title), w: tn[tab] + (lib ? ' › ' + LIBS().filter(function (x) { return x[0] === lib; })[0][1] : ''), a: 'jump', v: tab + '|' + (lib || '') + '|' + plain(title) }); }
    if (pid) {
      /* the questions people ask most, in their own words */
      sec('board', '', stack.length ? T('What just happened') : T('Game record'), T('What the other players answered after my move'));
      sec('board', '', T('The position'), T('What the colours of the bars mean'));
      sec('board', '', T('Who plays the other stakeholders?'), T('Switch between the computer playing the others and choosing their moves myself'));
      sec('board', '', T('Game record'), T('Undo a round, start a new game or share this game'));
      sec('library', 'assume', T('Assumptions'), T('Change the assumptions behind the scores'));
      sec('library', 'about', T('Install and use offline'), T('Install the app and use it without a connection'));
      [T('The position'), T('Who plays the other stakeholders?'), T('Your move'), T('Game record')].forEach(function (x) { sec('board', '', x); });
      [T('Settings and headline result'), T('Critical path, step by step'), T('Where the position ends up'), T('Odds, allowing for surprises')].forEach(function (x) { sec('path', '', x); });
      [T('Move under analysis'), T('SWOT for {0}', esc(P(pid).name)), T('Risk register'), T('Head-to-head payoff matrix'), T('Stakeholder map'), T('Political, security, economic, energy, legal and social lens')].forEach(function (x) { sec('analysis', '', x); });
      [T('Sources'), T('Signals feeding the model'), T('Evidence by subject'), T('What each government says and does'), T('On the official record'), T('Lira against the euro'), T('Balance of resources'), T('Latest research'), T('From the newspapers'), T('Latest headlines')].forEach(function (x) { sec('live', '', x); });
      sec('library', 'blueprints', T('Blueprint strategies')); sec('library', 'history', T('Precedents: what worked, what failed')); sec('library', 'assume', T('Assumptions'));
      sec('library', 'assume', T('What a player wants, and how much it cares')); sec('library', 'about', T('Method')); sec('library', 'about', T('Languages'));
      C.order.forEach(function (q) { out.push({ l: P(q).name, w: tn.library + ' › ' + T('Stakeholders'), a: 'player', v: q }); });
      recs().forEach(function (r) { if (!r.m.hold) out.push({ l: r.m.src.name, w: tn.board + ' › ' + plain(T('Your move')), a: 'findmove', v: r.m.id }); });
    }
    var g = window.GUIDE(T, M, esc), re = /<summary>([\s\S]*?)<\/summary>/g, mm;
    while ((mm = re.exec(g))) out.push({ l: plain(mm[1]), w: T('Guide'), a: 'jump', v: 'guide||' + plain(mm[1]) });
    return out;
  }
  function findOpen() {
    var items = findItems();
    modal('<div class="row between"><h2>' + T('Find anything') + '</h2><button class="btn small" data-a="closemodal" aria-label="' + esc(T('Close')) + '">✕</button></div>' +
      '<p class="help">' + T('Type a word, or pick from the list. Each line takes you straight to that place and highlights it.') + '</p>' +
      '<input type="search" class="findq" data-c="find" autocomplete="off" placeholder="' + esc(T('For example: answered, colours, veto, gas, undo, install')) + '" aria-label="' + esc(T('Find anything')) + '">' +
      '<div id="findres" class="findres">' + items.map(function (it) {
        return '<button data-a="' + it.a + '" data-v="' + esc(it.v) + '"><b>' + esc(it.l) + '</b><small>' + esc(it.w) + '</small></button>';
      }).join('') + '</div><p class="help" id="findnone" hidden>' + T('Nothing matches. Try a shorter word, or open the Guide.') + '</p>' +
      (A.pid ? '' : '<p class="help">' + T('Choose a stakeholder first to search the board, the moves and the analysis as well.') + '</p>'));
    var q = $('.findq'); if (q) q.focus();
  }
  function findFilter(v) {
    var words = v.toLowerCase().split(/\s+/).filter(Boolean), bs = document.querySelectorAll('#findres button'), n = 0, i;
    for (i = 0; i < bs.length; i++) {
      var txt = bs[i].textContent.toLowerCase(), ok = words.every(function (w) { return txt.indexOf(w) >= 0; });
      bs[i].hidden = !ok; if (ok) n += 1;
    }
    $('#findnone').hidden = n > 0;
  }

  /* ---------- small renderers ---------- */
  function outcomeOf(x) { return M.outcomes[E.classify(C, x)]; }

  function gauges(x, ghost, pid) {
    return '<div class="gauges">' + M.dims.map(function (d, i) {
      var v = x[i], g = ghost ? ghost[i] : null, ideal = pid ? C.players[pid].ideal[i] : null, gh = '';
      if (g !== null && Math.abs(g - v) >= 0.5) {
        var lo = Math.min(v, g), w = Math.abs(g - v), toward = ideal === null ? g > v : Math.abs(g - ideal) < Math.abs(v - ideal);
        gh = '<span class="ghost ' + (toward ? 'up' : 'down') + '" style="left:' + lo + '%;width:' + w + '%"></span>';
      }
      return '<div class="g" title="' + esc(d.desc) + '"><div class="gl"><b>' + esc(d.name) + '</b><span class="num">' + Math.round(v) +
        (g !== null && Math.abs(g - v) >= 0.5 ? ' → <b class="' + (gh.indexOf('up') > 0 ? 'good' : 'bad') + '">' + Math.round(g) + '</b>' : '') + '</span></div>' +
        '<div class="track"><span class="fill" style="width:' + v + '%"></span>' + gh + (ideal !== null && C.players[pid].w[i] > 0.02 ? '<span class="ideal" style="left:' + ideal + '%" title="' + esc(T('Your ideal point')) + '"></span>' : '') + '</div>' +
        '<div class="ends"><span>' + esc(d.lo) + '</span><span>' + esc(d.hi) + '</span></div></div>';
    }).join('') + '</div>' +
      /* what the colours mean, always shown with the bars */
      '<div class="legend barkey"><span><i style="background:var(--info)"></i>' + T('blue: where the measure stands now') + '</span>' +
      (ghost ? '<span><i style="background:var(--good)"></i>' + T('green: the change moves it toward your ideal') + '</span><span><i style="background:var(--bad)"></i>' + T('red: the change moves it away from your ideal') + '</span>' : '') +
      (pid ? '<span><b style="color:var(--accent)">▼</b> ' + T('your ideal for that measure') + '</span>' : '') + '</div>';
  }

  function fxChips(m) {
    var out = m.fx.map(function (f) { return '<span class="' + (f[1] > 0 ? 'up' : 'down') + '">' + esc(dim(f[0]).short || dim(f[0]).name) + ' ' + sgn(f[1], 0) + '</span>'; });
    return '<div class="fx">' + out.join('') + '</div>';
  }

  function stance(a) { return a > 0.25 ? 'ally' : a < -0.25 ? 'opp' : 'swing'; }
  function STANCE(st) { return { ally: T('With you'), opp: T('Against you'), swing: T('Swing') }[st]; }
  function stanceLow(st) { return { ally: T('with you'), opp: T('against you'), swing: T('swing') }[st]; }

  function spark(series, color) {
    if (!series || series.length < 2) return '';
    var mn = Math.min.apply(null, series), mx = Math.max.apply(null, series), r = mx - mn || 1;
    var pts = series.map(function (v, i) { return (i / (series.length - 1) * 100).toFixed(1) + ',' + (40 - (v - mn) / r * 36 - 2).toFixed(1); }).join(' ');
    return '<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
  }

  /* ---------- header / tabs ---------- */
  function langOptions(names) {
    return I.codes.map(function (c) { return '<option value="' + c + '"' + (c === I.lang ? ' selected' : '') + '>' + esc((names ? I.names : I.labels)[c]) + '</option>'; }).join('');
  }
  /* The fixed parts of the page, which index.html carries in English. */
  function fixed() {
    function set(sel, attrs, text) {
      var el = $(sel);
      if (!el) return;
      Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
      if (text !== undefined) el.textContent = text;
    }
    document.title = T('Cyprus Strategy Board — game-theory decision support');
    set('#navBack', { 'aria-label': T('Back to the previous page'), title: T('Back') });
    set('#navFwd', { 'aria-label': T('Forward to the next page'), title: T('Forward') });
    set('.top .brand', { 'aria-label': T('Cyprus Strategy Board, choose stakeholder') });
    set('.top .brand b', null, T('Cyprus Strategy Board'));
    set('#net', { title: T('Connection and data freshness') });
    set('#installBtn', null, T('Install app'));
    set('.top [data-a="theme"]', { 'aria-label': T('Switch light or dark theme'), title: T('Light / dark') });
    set('#tabs', { 'aria-label': T('Sections') });
    set('#lang', { 'aria-label': T('Language'), title: T('Language') });
    set('#boot', null, T('Setting up the board…'));
    var s = $('#lang');
    if (s) { if (!s.options.length) s.innerHTML = langOptions(); s.value = I.lang; }
  }
  function chrome() {
    fixed();
    $('#who').textContent = A.pid ? T('Deciding as: {0}', P(A.pid).name) : T('Decision support for every stakeholder');
    $('#tabs').innerHTML = A.pid ? TABS().map(function (t) {
      return '<button data-a="tab" data-v="' + t[0] + '"' + (A.tab === t[0] ? ' aria-current="page"' : '') + '><i>' + t[1] + '</i>' + t[2] + '</button>';
    }).join('') : '';
    $('#tabs').style.display = A.pid ? '' : 'none';
    var fb = $('#findBtn'); fb.title = T('Find anything'); fb.setAttribute('aria-label', T('Find anything'));
    net(); navButtons();
  }
  function net() {
    var d = L.get(), el = $('#net'), on = navigator.onLine !== false;
    var age = d && d.t ? Math.round((Date.now() - d.t) / 60000) : null;
    var a = age === null ? T('no live data yet') : age < 1 ? T('data: just now') : age < 60 ? T('data: {0} min ago', age) : age < 2880 ? T('data: {0} h ago', Math.round(age / 60)) : T('data: {0} d ago', Math.round(age / 1440));
    el.textContent = L.busy ? T('Updating…') + ' ' : on ? T('Online · {0}', a) : T('Offline · {0}', a);
    el.className = 'pill' + (on ? '' : ' off');
  }

  /* ---------- views ---------- */
  function viewPick() {
    return '<section class="card"><h1>' + T('Who are you deciding for?') + '</h1>' +
      '<p class="lead">' + T('Every stakeholder in the Cyprus question is a player on the same board. Pick your seat. The board then shows your options, predicts how each other player is likely to answer, and points to the strongest sustainable path.') + '</p>' +
      '<p class="langrow"><label class="help">' + T('Language') + ' <select data-c="lang">' + langOptions(true) + '</select></label></p>' +
      '<p class="row"><button class="btn" data-a="guide">' + T('Read the complete guide') + '</button>' + (standalone() ? '' : '<button class="btn accent" data-a="install">' + T('Install app') + '</button>') + '</p>' + nextStep() +
      '<div class="grid pick" style="margin-top:12px">' + M.players.map(function (p) {
        return '<button class="pcard" style="--c:' + p.color + '" data-a="pick" data-v="' + p.id + '"><b>' + esc(p.name) + '</b><span>' + esc(p.role) + '</span></button>';
      }).join('') + '</div></section>' +
      '<section class="card"><h2>' + T('How it works') + '</h2><ol class="list">' +
      '<li>' + T('<b>Position.</b> Ten measurable dimensions describe where the Cyprus question stands today, from troop presence to energy cooperation. Live news and economic data nudge the starting position.') + '</li>' +
      '<li>' + T('<b>Players.</b> Ten stakeholders each have an ideal position and care about the dimensions to different degrees. That is all the model needs to compute who gains and who loses from any change.') + '</li>' +
      '<li>' + T('<b>Moves.</b> You choose a move. Then either the computer plays the other nine stakeholders, each answering with the reply that serves it best, as a chess program would; or you switch to manual mode and choose their moves yourself.') + '</li>' +
      '<li>' + T('<b>Result.</b> You see each predicted reply with its probability, the new position, every player\'s gain or loss, a SWOT and risk analysis, and the best path several rounds ahead.') + '</li></ol>' +
      '<p class="help">' + T('Predictions are model-based forecasts with stated assumptions, not certainties. Every assumption is open to inspection and adjustment under Library → Assumptions.') + '</p></section>';
  }

  function viewBoard() {
    var x = S.x, u = E.utilities(C, x), al = E.alignment(C, x, A.pid), o = outcomeOf(x), R = recs(), MD = MODES(), man = A.play === 'manual';
    var sel = A.sel ? recFor(A.sel) : null, ghost = sel ? (man ? E.round(C, S, A.pid, sel.m.id, { deep: true, forced: forcedMap() }).after : sel.first.after) : null;
    var withU = 0, withP = 0, oppU = 0, oppP = 0;
    C.order.forEach(function (q) {
      if (q === A.pid) return;
      var pw = C.players[q].power;
      if (al[q] > 0.25) { withP += pw; } else if (al[q] < -0.25) { oppP += pw; }
    });
    var bal = (C.players[A.pid].power + withP) / (C.players[A.pid].power + withP + oppP || 1);
    var best = R[0], maxGain = Math.max.apply(null, R.map(function (r) { return Math.abs(r.rel); }).concat([0.5]));
    var cats = ['all'].concat(Object.keys(M.cats).filter(function (c) { return C.byPlayer[A.pid].some(function (m) { return m.src.cat === c; }); }));
    var locked = C.byPlayer[A.pid].filter(function (m) { return E.blocked(C, S, m); });

    var rec = '<section class="card REC"><div class="row between"><h2>' + T('Game record') + '</h2><div class="row"><button class="btn small" data-a="undo"' + (stack.length ? '' : ' disabled') + '>' + T('Undo round') + '</button><button class="btn small" data-a="reset"' + (stack.length ? '' : ' disabled') + '>' + T('New game') + '</button><button class="btn small" data-a="share">' + T('Share') + '</button></div></div>';
    rec += stack.length ? '<ol class="history">' + stack.map(function (s) {
      var r = s.r, acts = r.replies.filter(function (y) { return !y.chosen.m.hold; });
      return '<li>' + (r.manual ? '<span class="tag info">' + T('manual') + '</span> ' : '') + '<b>' + esc(P(A.pid).short) + ': ' + esc(r.move.src.name) + '</b> → ' + (acts.length ? acts.map(function (y) { return esc(P(y.pid).short) + ': ' + esc(y.chosen.m.src.name); }).join(' · ') : T('all others hold')) +
        ' <span class="tag" style="color:' + outcomeOf(r.after).color + '">' + esc(outcomeOf(r.after).name) + '</span></li>';
    }).join('') + '</ol>' : '<p class="help">' + T('No moves played yet. Select a move above to preview the predicted replies, then play it to advance the board one round (roughly six months).') + '</p>';
    rec += '</section>';
    var h = intro(T('The board'), T('You are playing <b>{0}</b>. This page shows where the Cyprus question stands, who is with you and against you, and every move open to you. Each round stands for roughly six months.', esc(P(A.pid).name)), [
      T('Read <b>Current position</b> and <b>The position</b>: ten bars describe the situation today; the ▼ on each bar is where you would like it to be.'),
      T('Choose under <b>Who plays the other stakeholders?</b> whether the computer answers for them or you pick their moves yourself.'),
      T('Under <b>Your move</b>, tap any move to preview it: what it does, how the others answer, and who gains or loses.'),
      T('Press <b>Play this move</b> to commit. The board advances one round and the <b>Game record</b> keeps the history. <b>Undo</b> takes a round back.'),
      T('After each round, <b>What just happened</b> at the top of the page lists every answer, what changed and what to do next.')]) + justPlayed() +
      '<div class="status"><div class="stcol"><section class="card"><div class="outcome"><div class="badge" style="color:' + o.color + '">' + o.icon + '</div><div>' +
      '<span class="tag">' + T('Round {0} · current position', S.round + 1) + '</span><h2 style="margin:.15em 0">' + esc(o.name) + '</h2><span class="help">' + esc(o.desc) + '</span></div></div>' +
      '<div style="margin-top:12px"><div class="row between help"><span>' + T('Coalition weight with you <b class="num">{0}</b>', pct(bal)) + '</span><span>' + T('Your payoff <b class="num">{0}</b>/100', u[A.pid].toFixed(0)) + '</span></div>' +
      '<div class="evalbar" role="img" aria-label="' + esc(T('Balance of power between your coalition and opponents')) + '"><i style="width:' + (bal * 100) + '%"></i></div></div>' +
      '<h3 style="margin-top:14px">' + T('The other players, as they stand toward you now') + '</h3><div class="chips">' +
      C.order.filter(function (q) { return q !== A.pid; }).sort(function (a, b) { return al[b] - al[a]; }).map(function (q) {
        var st = stance(al[q]);
        return '<button class="chip ' + st + '" style="--c:' + P(q).color + '" data-a="player" data-v="' + q + '" title="' + esc(T('Payoff {0}/100', u[q].toFixed(0))) + '"><i>' + esc(P(q).short) + '</i>' + esc(P(q).name) + ' <em>' + STANCE(st) + '</em></button>';
      }).join('') + '</div>' +
      '<details class="explain"><summary>' + T('How "with you / against you" is worked out') + '</summary>' + T('Each player wants the position to move in a particular direction. If that direction overlaps with yours, they are with you on the present board; if it runs opposite, they are against you. It changes as the position changes — today\'s opponent can become tomorrow\'s partner once the trade-offs shift.') + '</details></section>' +
      ('<section class="card"><h2>' + T('Who plays the other stakeholders?') + '</h2><div class="seg" role="group" aria-label="' + esc(T('Who plays the other stakeholders')) + '">' +
      '<button data-a="playmode" data-v="auto" aria-pressed="' + (A.play === 'auto') + '">' + T('Computer plays them') + '</button><button data-a="playmode" data-v="manual" aria-pressed="' + man + '">' + T('I choose their moves') + '</button></div>' +
      '<p class="help" style="margin-top:8px">' + (A.play === 'auto' ? T('<b>Computer mode.</b> After your move, the app plays the other nine stakeholders: each answers with the reply that serves its own interests best, and you see the probability of each reply. Use this to find out what is likely to happen.') :
        T('<b>Manual mode.</b> After your move, you decide what each of the other nine stakeholders does. Nothing is predicted for you; every stakeholder starts on "Hold position" until you choose otherwise. Use this to test a "what if", replay real events, or play with other people around a table.')) + '</p></section>') + rec.replace('card REC', 'card rec-desk') + '</div>' +
      '<section class="card"><div class="row between"><h2>' + T('The position') + '</h2><span class="help">' + (ghost ? T('▼ = your ideal · coloured band = after this round') : T('▼ = your ideal')) + '</span></div><p class="help">' + T('Ten measures of the Cyprus question, each scored 0–100 between the two descriptions under its bar. The facts behind today\'s scores are listed under Library → Assumptions.') + '</p>' + gauges(x, ghost, A.pid) + '</section></div>';

    h += '<section class="card"><div class="row between"><h2>' + T('Your move') + '</h2><div class="seg" role="group" aria-label="' + esc(T('Objective')) + '">' +
      Object.keys(MD).map(function (k) { return '<button data-a="mode" data-v="' + k + '" aria-pressed="' + (A.mode === k) + '" title="' + esc(MD[k][1]) + '">' + MD[k][0] + '</button>'; }).join('') + '</div></div>' +
      '<p class="help">' + esc(MD[A.mode][1]) + ' ' + T('Each score is how much better (+) or worse (−) than simply waiting the move leaves you, three rounds on, once every other player has answered with their best replies.') + (man ? ' ' + T('In manual mode these scores remain the computer\'s estimate, for guidance only.') : '') + '</p>';
    if (best) h += '<p>' + (best.m.hold ? T('<span class="tag good">Engine\'s choice</span> <b>{0}</b> — no available move beats waiting this round.', esc(best.m.src.name)) : T('<span class="tag good">Engine\'s choice</span> <b>{0}</b> — {1} better than waiting, after the other players reply.', esc(best.m.src.name), sgn(best.rel, 2))) + '</p>';
    h += '<div class="filter" role="group" aria-label="' + esc(T('Filter moves')) + '">' + cats.map(function (c) { return '<button data-a="cat" data-v="' + c + '" aria-pressed="' + (A.cat === c) + '">' + (c === 'all' ? T('All') : esc(M.cats[c])) + '</button>'; }).join('') + '</div>' +
      '<div class="moves" style="margin-top:8px">' + R.filter(function (r) { return A.cat === 'all' || r.m.src.cat === A.cat || r.m.hold; }).map(function (r, i) {
        var w = Math.abs(r.rel) / maxGain * 100;
        return '<button class="mv' + (r === best ? ' best' : '') + (A.sel === r.m.id ? ' sel' : '') + '" data-a="sel" data-v="' + r.m.id + '"><b>' + esc(r.m.src.name) + '</b><span class="sc ' + cls(r.rel, 0.05) + '">' + (r.m.hold ? T('baseline') : sgn(r.rel, 2)) + '</span>' +
          '<span class="sub">' + (r.m.hold ? '' : T('{0} · success {1}', esc(M.cats[r.m.src.cat] || ''), pct(r.m.ps)) + ' · ') + esc(r.m.src.desc.split('. ')[0].replace(/\.$/, '')) + '.</span>' +
          '<span class="bar"><i style="width:' + w + '%;background:var(--' + (r.rel >= 0 ? 'good' : 'bad') + ')"></i></span></button>';
      }).join('') + '</div>';
    if (locked.length) h += '<details class="explain" style="margin-top:10px"><summary>' + (locked.length > 1 ? T('{0} moves not available yet', locked.length) : T('{0} move not available yet', locked.length)) + '</summary><div class="moves" style="margin-top:8px">' + locked.map(function (m) {
      return '<div class="mv locked"><b>' + esc(m.src.name) + '</b><span class="tag">' + esc(E.blocked(C, S, m)) + '</span><span class="sub">' + esc(m.src.desc) + '</span></div>';
    }).join('') + '</div></details>';
    h += '</section>';

    return h + rec.replace('card REC', 'card rec-mob');
  }

  /* ---------- move detail ---------- */
  function replyImpact(y) { return E.utility(C, A.pid, y.after) - E.utility(C, A.pid, y.before); }

  function viewSheet() {
    var rec = A.sel && A.tab === 'board' ? recFor(A.sel) : null;
    if (!rec) { sheet.className = 'sheet'; sheet.innerHTML = ''; document.body.classList.remove('has-sheet'); return; }
    var man = A.play === 'manual', m = rec.m, r = man ? E.round(C, S, A.pid, m.id, { deep: true, forced: forcedMap() }) : rec.first;
    var u0 = E.utilities(C, S.x), u1 = E.utilities(C, r.after), al = E.alignment(C, S.x, A.pid), o = outcomeOf(r.after), avail = {};
    if (man) C.order.forEach(function (q) { avail[q] = E.available(C, S, q); });
    var h = '<div class="shead"><div><span class="tag">' + (m.hold ? T('Wait') : esc(M.cats[m.src.cat] || '')) + '</span><h2 style="margin:.2em 0 0">' + esc(m.src.name) + '</h2></div><button class="btn small" data-a="close" aria-label="' + esc(T('Close')) + '">✕</button></div>';
    h += '<section class="card"><p>' + esc(m.src.desc) + '</p>' + (m.hold ? '' : '<p class="help">' + T('Direct effect of the move on the position, before anyone replies:') + '</p>') + fxChips(m) +
      (m.hold ? '' : '<p class="help" style="margin-top:8px">' + (m.src.src ? T('Chance it works as intended: <b>{0}</b> · political cost to you: <b>{1}</b>/10 · source: {2}', pct(m.ps), m.src.cost || 0, esc(m.src.src)) : T('Chance it works as intended: <b>{0}</b> · political cost to you: <b>{1}</b>/10', pct(m.ps), m.src.cost || 0)) + '</p>') +
      (m.src.commitNote ? '<p class="help">' + T('<b>Commitment:</b> {0}', esc(m.src.commitNote)) + '</p>' : '') + (man ? '' : verdict(rec)) + '</section>';

    if (man) h += '<section class="card"><h3>' + T('Choose each stakeholder\'s reply') + '</h3><p class="help">' + T('Manual mode: you decide what every other player does this round. The tag shows what each choice does to your payoff. Pick "Let the computer choose" for any player you would rather leave to the app.') + '</p>' + r.replies.map(function (y) {
      var imp = replyImpact(y), cur = A.manual[y.pid] === 'auto' ? 'auto' : y.chosen.m.id;
      return '<div class="reply"><span class="av" style="--c:' + P(y.pid).color + '">' + esc(P(y.pid).short) + '</span><div><label><b>' + esc(P(y.pid).name) + '</b><br><select data-c="man" data-v="' + y.pid + '" style="width:100%;margin-top:4px">' +
        avail[y.pid].map(function (k) { return '<option value="' + k.id + '"' + (cur === k.id ? ' selected' : '') + '>' + esc(k.src.name) + '</option>'; }).join('') +
        '<option value="auto"' + (cur === 'auto' ? ' selected' : '') + '>' + (cur === 'auto' ? T('Let the computer choose ({0})', esc(y.chosen.m.src.name)) : T('Let the computer choose')) + '</option></select></label></div>' +
        '<span class="tag ' + (imp > 0.3 ? 'good' : imp < -0.3 ? 'bad' : '') + '">' + (imp > 0.3 ? T('helps {0}', sgn(imp)) : imp < -0.3 ? T('hurts {0}', sgn(imp)) : T('neutral')) + '</span></div>';
    }).join('') + '</section>';
    else h += '<section class="card"><h3>' + T('Predicted replies, in order of play') + '</h3><p class="help">' + T('Computer mode: the app plays the other stakeholders. The percentage is the model\'s probability that the player picks that reply over its alternatives.') + '</p>' + r.replies.map(function (y) {
      var imp = replyImpact(y), alt = y.ranked.filter(function (k) { return k !== y.chosen; }).slice(0, 2);
      return '<div class="reply"><span class="av" style="--c:' + P(y.pid).color + '">' + esc(P(y.pid).short) + '</span><div><b>' + esc(y.chosen.m.src.name) + '</b> <span class="tag ' + (imp > 0.3 ? 'good' : imp < -0.3 ? 'bad' : '') + '">' + (imp > 0.3 ? T('helps you {0}', sgn(imp)) : imp < -0.3 ? T('hurts you {0}', sgn(imp)) : T('neutral')) + '</span><br><span class="help">' + esc(P(y.pid).name) + ' · ' + stanceLow(stance(al[y.pid])) + '</span></div><span class="pr">' + pct(y.chosen.p) + '</span>' +
        (alt.length ? '<span class="alt">' + T('Otherwise: {0}', alt.map(function (k) { return esc(k.m.src.name) + ' (' + pct(k.p) + ')'; }).join(' · ')) + '</span>' : '') + '</div>';
    }).join('') + '</section>';

    h += '<section class="card"><h3>' + T('Result of all moves together') + '</h3><p class="help">' + T('The position after your move and all nine replies, and what it does to each stakeholder.') + '</p><p><span class="tag" style="color:' + o.color + '">' + o.icon + ' ' + esc(o.name) + '</span> ' + esc(o.desc) + '</p>' +
      '<div class="pay">' + C.order.map(function (q) {
        var d = u1[q] - u0[q], w = Math.min(50, Math.abs(d) * 5);
        return '<span>' + (q === A.pid ? '<b>' + esc(P(q).name) + '</b>' : esc(P(q).name)) + '</span><span class="pb"><i style="' + (d >= 0 ? 'left:50%' : 'right:50%') + ';width:' + w + '%;background:var(--' + (d >= 0 ? 'good' : 'bad') + ')"></i></span><b class="num ' + cls(d) + '">' + sgn(d) + '</b>';
      }).join('') + '</div><p class="help" style="margin-top:8px">' + T('Change in each player\'s payoff (0–100 scale) once every reply is in.') + '</p></section>';
    h += evidence(m);
    h += '<div class="sfoot"><button class="btn" data-a="analyse">' + T('Full analysis') + '</button><button class="btn accent" data-a="play">' + T('Play this move') + '</button></div>';
    sheet.innerHTML = h; sheet.className = 'sheet open'; document.body.classList.add('has-sheet');
  }

  function verdict(rec) {
    var r = rec.first, d = E.utility(C, A.pid, r.after) - E.utility(C, A.pid, S.x), best = recs()[0];
    var hurt = r.replies.filter(function (y) { return replyImpact(y) < -0.3; }), help = r.replies.filter(function (y) { return replyImpact(y) > 0.3; });
    var losers = C.order.filter(function (q) { return q !== A.pid && C.players[q].veto && E.utility(C, q, r.after) < E.utility(C, q, S.x) - 1; });
    var t = '<p style="margin-top:10px">' + T('<b>Reading:</b>') + ' ';
    t += (rec === best ? T('This is the engine\'s first choice under the "{0}" objective.', MODES()[A.mode][0]) : T('The engine prefers <b>{0}</b> ({1} against {2} here, compared with waiting).', esc(best.m.src.name), sgn(best.rel, 2), sgn(rec.rel, 2))) + ' ';
    t += T('With every reply counted, your payoff after one round changes by {0}; three rounds out the line is worth {1} against waiting.', '<b class="' + cls(d) + '">' + sgn(d) + '</b>', '<b class="' + cls(rec.rel, 0.05) + '">' + sgn(rec.rel, 2) + '</b>') + ' ';
    if (hurt.length) t += T('Expect push-back from {0}.', hurt.map(function (y) { return esc(P(y.pid).name); }).join(', ')) + ' ';
    if (help.length) t += T('Support is likely from {0}.', help.map(function (y) { return esc(P(y.pid).name); }).join(', ')) + ' ';
    if (losers.length) {
      var who = andList(losers.map(function (q) { return esc(P(q).name); }));
      t += '<span class="warn">' + (losers.length > 1 ? T('Sustainability warning: {0} can block a settlement and end this round worse off, so expect resistance later.', who) : T('Sustainability warning: {0} can block a settlement and ends this round worse off, so expect resistance later.', who)) + '</span>';
    }
    return t + '</p>';
  }

  /* ---------- best path ---------- */
  function viewPath() {
    var head = intro(T('Best path'), T('The strongest sequence of moves the computer can find for <b>{0}</b>, looking several rounds ahead with the app playing every other stakeholder. It is the critical path: the order matters, because early moves open later ones.', esc(P(A.pid).name)), [
      T('Choose what to optimise: your own payoff, a sustainable outcome, or the collective good.'),
      T('Choose how many rounds to look ahead (one round is about six months).'),
      T('Read the steps in order. Each shows your move, the replies the computer predicts, and where the position stands afterwards.'),
      T('Compare with <b>if you only wait</b>, then check the <b>odds</b> to see how the path fares when things go wrong.'),
      T('Press <b>Play step 1</b> to take the first move onto the board.')]);
    if (!cache.path) {
      if (!cache.pathJob) {
        var mine = cache; cache.pathJob = 1;
        background('path', { horizon: A.horizon, mode: A.mode }, function (out) { if (cache === mine) { cache.path = out; if (A.tab === 'path') render(); } }, function () {
          setTimeout(function () {
            if (cache !== mine) return;
            var p = E.path(C, S, A.pid, { horizon: A.horizon, mode: A.mode });
            var dn = E.doNothing(C, S, A.pid, A.horizon);
            var first = p.steps[0] ? p.steps[0].move.id : null;
            cache.path = { p: p, dn: dn, mc: E.monteCarlo(C, S, A.pid, first, { horizon: A.horizon, mode: A.mode, runs: 240 }), mc0: E.monteCarlo(C, S, A.pid, A.pid + '.hold', { horizon: A.horizon, mode: A.mode, runs: 240, seed: 9, holdOnly: true }) };
            if (A.tab === 'path') render();
          }, 30);
        });
      }
      return head + '<section class="card"><p class="loading">' + T('Searching {0} rounds ahead…', A.horizon) + '</p></section>';
    }
    var k = cache.path, p = k.p, u0 = E.utility(C, A.pid, S.x), uE = E.utility(C, A.pid, p.s.x), uN = E.utility(C, A.pid, k.dn.s.x), MD = MODES();
    var h = head +
      '<section class="card"><div class="row between"><h2>' + T('Settings and headline result') + '</h2></div>' +
      '<div class="row" style="margin:8px 0"><div class="seg" role="group" aria-label="' + esc(T('Objective')) + '">' + Object.keys(MD).map(function (m) { return '<button data-a="mode" data-v="' + m + '" aria-pressed="' + (A.mode === m) + '">' + MD[m][0] + '</button>'; }).join('') + '</div>' +
      '<label class="help">' + T('Rounds ahead') + ' <select data-c="horizon">' + [3, 4, 6, 8, 10].map(function (n) { return '<option' + (n === A.horizon ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="help">' + esc(MD[A.mode][1]) + ' ' + T('One round is roughly six months. The search keeps the four most promising lines alive at every step and assumes each other player answers with its own best reply.') + '</p>' +
      '<div class="kv"><div><b>' + u0.toFixed(0) + '</b><span>' + T('your payoff today') + '</span></div><div><b class="' + cls(uE - u0) + '">' + uE.toFixed(0) + '</b><span>' + T('on the best path ({0})', sgn(uE - u0)) + '</span></div><div><b class="' + cls(uN - u0) + '">' + uN.toFixed(0) + '</b><span>' + T('if you only wait ({0})', sgn(uN - u0)) + '</span></div><div><b style="color:' + outcomeOf(p.s.x).color + ';font-size:1rem">' + esc(outcomeOf(p.s.x).name) + '</b><span>' + T('where the path leads') + '</span></div></div></section>';

    h += '<section class="card"><h2>' + T('Critical path, step by step') + '</h2><p class="help">' + T('Your recommended moves in order. Replies in green help you, in red hurt you; the percentage is how likely the computer thinks each reply is.') + '</p><ol class="steps">' + p.steps.map(function (r, i) {
      var acts = r.replies.filter(function (y) { return !y.chosen.m.hold; }), o = outcomeOf(r.after), du = E.utility(C, A.pid, r.after) - E.utility(C, A.pid, r.before);
      return '<li><b>' + esc(r.move.src.name) + '</b> <span class="tag">' + (r.move.hold ? T('wait') : T('{0} success', pct(r.move.ps))) + '</span><br><span class="help">' + esc(r.move.src.desc) + '</span>' +
        '<div style="margin:6px 0;font-size:.86rem">' + (acts.length ? T('<b>Predicted replies:</b> {0}', acts.map(function (y) { var im = E.utility(C, A.pid, y.after) - E.utility(C, A.pid, y.before); return '<span class="' + cls(im) + '">' + esc(P(y.pid).short) + ' — ' + esc(y.chosen.m.src.name) + ' (' + pct(y.chosen.p) + ')</span>'; }).join('; ')) : T('All other players hold.')) + '</div>' +
        '<span class="tag" style="color:' + o.color + '">' + o.icon + ' ' + esc(o.name) + '</span> <span class="num ' + cls(du) + '">' + T('your payoff {0}', sgn(du)) + '</span></li>';
    }).join('') + '</ol>' + (p.steps[0] && !p.steps[0].move.hold ? '<button class="btn accent" data-a="playfirst">' + T('Play step 1 on the board') + '</button>' : '') + '</section>';

    h += '<section class="card"><h2>' + T('Where the position ends up') + '</h2><p class="help">' + T('Start (blue bar) to end of the best path (coloured band). ▼ marks your ideal.') + '</p>' + gauges(S.x, p.s.x, A.pid) + '</section>';

    function odds(mc) {
      var keys = Object.keys(M.outcomes).filter(function (o) { return mc.odds[o]; });
      return '<div class="stack">' + keys.map(function (o) { return '<i style="width:' + mc.odds[o] * 100 + '%;background:' + M.outcomes[o].color + '" title="' + esc(M.outcomes[o].name) + ' ' + pct(mc.odds[o]) + '"></i>'; }).join('') + '</div><div class="legend">' +
        keys.sort(function (a, b) { return mc.odds[b] - mc.odds[a]; }).map(function (o) { return '<span><i style="background:' + M.outcomes[o].color + '"></i>' + esc(M.outcomes[o].name) + ' <b class="num">' + pct(mc.odds[o]) + '</b></span>'; }).join('') + '</div>';
    }
    function range(mc) { return T('Your payoff: pessimistic {0} · typical {1} · optimistic {2}', mc.p10.toFixed(0), mc.p50.toFixed(0), mc.p90.toFixed(0)); }
    h += '<section class="card"><h2>' + T('Odds, allowing for surprises') + '</h2><p class="help">' + T('{0} simulated futures over {1} rounds. In each one, moves can fail and players sometimes pick their second or third choice, in proportion to how close the options are.', k.mc.runs, k.mc.horizon) + '</p>' +
      '<h3>' + T('Following the best path') + '</h3>' + odds(k.mc) + '<p class="help num">' + range(k.mc) + '</p>' +
      '<h3 style="margin-top:12px">' + T('If you only wait') + '</h3>' + odds(k.mc0) + '<p class="help num">' + range(k.mc0) + '</p></section>';
    return h;
  }

  /* ---------- analysis ---------- */
  function swot(rec) {
    var p = P(A.pid), cp = C.players[A.pid], m = rec.m, r = rec.first, s = [], w = [], o = [], t = [];
    m.fx.forEach(function (f) {
      var i = f[0], toward = Math.abs(S.x[i] + f[1] - cp.ideal[i]) < Math.abs(S.x[i] - cp.ideal[i]);
      if (cp.w[i] < 0.03) return;
      (toward ? s : w).push(toward ? T('The move itself shifts <b>{0}</b> by {1}, toward your ideal.', esc(dim(i).name), sgn(f[1], 0)) : T('The move itself shifts <b>{0}</b> by {1}, away from your ideal.', esc(dim(i).name), sgn(f[1], 0)));
    });
    if (!m.hold && m.ps >= 0.75) s.push(T('High chance of working as intended ({0}).', pct(m.ps)));
    (p.leverage || []).slice(0, 3).forEach(function (l) { s.push(esc(l)); });
    if (!m.hold && m.ps < 0.65) w.push(m.fail.length ? T('Uncertain execution: {0} chance it fails, which would shift {1}.', pct(1 - m.ps), m.fail.map(function (f) { return esc(dim(f[0]).name) + ' ' + sgn(f[1], 0); }).join(', ')) : T('Uncertain execution: {0} chance it fails.', pct(1 - m.ps)));
    if (m.src.cost >= 3) w.push(T('Significant political or financial cost to you ({0}/10).', m.src.cost));
    (p.vuln || []).slice(0, 3).forEach(function (l) { w.push(esc(l)); });
    r.replies.forEach(function (y) {
      var im = replyImpact(y), nm = '<b>' + esc(P(y.pid).name) + '</b>';
      if (y.chosen.m.hold) return;
      if (im > 0.3) o.push(T('{0} is likely ({1}) to answer with "{2}", worth {3} to you.', nm, pct(y.chosen.p), esc(y.chosen.m.src.name), sgn(im)));
      else if (im < -0.3) t.push(T('{0} is likely ({1}) to answer with "{2}", costing you {3}.', nm, pct(y.chosen.p), esc(y.chosen.m.src.name), sgn(im)));
      y.ranked.slice(1, 3).forEach(function (k) {
        if (k.p < 0.15 || k.m.hold) return;
        var after = E.apply(C, y.before, k.m, S.used, 'exp'), d = E.utility(C, A.pid, after) - E.utility(C, A.pid, y.before);
        if (d < -1) t.push(T('Less likely ({0}), {1} could instead choose "{2}" ({3} for you).', pct(k.p), nm, esc(k.m.src.name), sgn(d)));
        if (d > 1) o.push(T('Less likely ({0}), {1} could instead choose "{2}" ({3} for you).', pct(k.p), nm, esc(k.m.src.name), sgn(d)));
      });
    });
    var unlocked = [];
    C.order.forEach(function (q) { C.byPlayer[q].forEach(function (k) { if (E.blocked(C, S, k) && !E.blocked(C, r.state, k)) unlocked.push(esc(P(q).short) + ': ' + esc(k.src.name)); }); });
    if (unlocked.length) o.push(T('Opens moves that are closed today — {0}.', unlocked.slice(0, 5).join('; ')));
    var al = E.alignment(C, r.after, A.pid), al0 = E.alignment(C, S.x, A.pid);
    C.order.forEach(function (q) {
      var nm = '<b>' + esc(P(q).name) + '</b>';
      if (q === A.pid) return;
      if (stance(al0[q]) !== 'ally' && stance(al[q]) === 'ally') o.push(T('{0} moves into alignment with you after this round.', nm));
      if (stance(al0[q]) !== 'opp' && stance(al[q]) === 'opp') t.push(T('{0} moves into opposition after this round.', nm));
      if (C.players[q].veto && E.utility(C, q, r.after) < E.utility(C, q, S.x) - 1) t.push(T('{0} can block any settlement and ends the round worse off ({1}) — a defection risk.', nm, sgn(E.utility(C, q, r.after) - E.utility(C, q, S.x))));
    });
    var st = C.di.stability, ds = r.after[st] - S.x[st];
    if (ds < -3) t.push(T('Stability falls by {0} points; miscalculation becomes more likely.', Math.abs(ds).toFixed(0)));
    if (ds > 3) o.push(T('Stability rises by {0} points, widening everyone\'s room for compromise.', ds.toFixed(0)));
    if (rec.rel > 0.3) o.push(T('Three rounds out, the line that starts here is worth {0} more to you than waiting.', sgn(rec.rel, 2)));
    if (rec.rel < -0.3) t.push(T('Three rounds out, the line that starts here leaves you {0} against waiting.', sgn(rec.rel, 2)));
    function ul(a, none) { return '<ul>' + (a.length ? a.slice(0, 7).map(function (x) { return '<li>' + x + '</li>'; }).join('') : '<li class="mute">' + none + '</li>') + '</ul>'; }
    return '<div class="swot"><div class="s"><h3>' + T('Strengths <small>yours, helpful</small>') + '</h3>' + ul(s, T('No particular strength in play.')) + '</div><div class="w"><h3>' + T('Weaknesses <small>yours, harmful</small>') + '</h3>' + ul(w, T('No notable weakness exposed.')) + '</div>' +
      '<div class="o"><h3>' + T('Opportunities <small>from others</small>') + '</h3>' + ul(o, T('No supportive reply predicted this round.')) + '</div><div class="t"><h3>' + T('Threats <small>from others</small>') + '</h3>' + ul(t, T('No hostile reply predicted this round.')) + '</div></div>';
  }

  function risks(rec) {
    var r = rec.first, m = rec.m, rows = [];
    function rate(p, im) { var s = p * Math.min(10, Math.abs(im)); return s > 2.2 ? [T('High'), 'bad'] : s > 0.8 ? [T('Medium'), 'warn'] : [T('Low'), 'good']; }
    if (!m.hold && m.ps < 1) {
      var im = E.utility(C, A.pid, E.apply(C, S.x, m, S.used, 'fail')) - E.utility(C, A.pid, E.apply(C, S.x, m, S.used, 'ok'));
      rows.push([T('Your move fails to deliver'), 1 - m.ps, im, m.src.mit || T('Prepare the ground first: line up partners and a fallback before committing publicly.')]);
    }
    r.replies.forEach(function (y) {
      y.ranked.slice(0, 3).forEach(function (k) {
        if (k.m.hold || k.p < 0.12) return;
        var d = E.utility(C, A.pid, E.apply(C, y.before, k.m, S.used, 'exp')) - E.utility(C, A.pid, y.before);
        if (d < -0.8) rows.push([esc(P(y.pid).name) + ': ' + esc(k.m.src.name), k.p, d, k.m.src.counter || T('Raise the cost or lower the benefit of this reply before you move; keep a channel open to {0}.', esc(P(y.pid).name))]);
      });
    });
    rows.sort(function (a, b) { return b[1] * Math.abs(b[2]) - a[1] * Math.abs(a[2]); });
    if (!rows.length) return '<p class="help">' + T('No material risk identified for this move in the coming round.') + '</p>';
    return '<div class="tblwrap"><table><thead><tr><th>' + T('Risk') + '</th><th>' + T('Likelihood') + '</th><th>' + T('Impact on you') + '</th><th>' + T('Rating') + '</th><th>' + T('Mitigation') + '</th></tr></thead><tbody>' + rows.slice(0, 8).map(function (x) {
      var rt = rate(x[1], x[2]);
      return '<tr><td>' + x[0] + '</td><td class="c">' + pct(x[1]) + '</td><td class="c bad">' + sgn(x[2]) + '</td><td class="c"><span class="tag ' + rt[1] + '">' + rt[0] + '</span></td><td>' + x[3] + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  /* Dimensions are grouped by the English lens key; only the heading shown is translated. */
  function lens(rec) {
    var r = rec.first, groups = {};
    M.dims.forEach(function (d, i) { (groups[d.lens] = groups[d.lens] || []).push(i); });
    return '<div class="tblwrap"><table><thead><tr><th>' + T('Lens') + '</th><th>' + T('What changes this round') + '</th></tr></thead><tbody>' + Object.keys(groups).map(function (g) {
      var parts = groups[g].map(function (i) { var d = r.after[i] - S.x[i]; return Math.abs(d) < 0.5 ? null : T('{0} <b class="num">{1}</b> (to {2})', esc(dim(i).name), sgn(d, 0), Math.round(r.after[i])); }).filter(Boolean);
      return '<tr><th>' + esc((M.lens || {})[g] || g) + '</th><td>' + (parts.length ? parts.join('; ') : '<span class="mute">' + T('No material change') + '</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  function matrix() {
    var opp = A.opp && A.opp !== A.pid ? A.opp : (A.pid === 'TR' ? 'ROC' : 'TR');
    var mx = E.matrix(C, S, A.pid, opp, 5);
    function isNe(i, j) { return mx.ne.some(function (n) { return n[0] === i && n[1] === j; }); }
    var h = '<label class="help">' + T('Against') + ' <select data-c="opp">' + C.order.filter(function (q) { return q !== A.pid; }).map(function (q) { return '<option value="' + q + '"' + (q === opp ? ' selected' : '') + '>' + esc(P(q).name) + '</option>'; }).join('') + '</select></label>' +
      '<div class="tblwrap" style="margin-top:8px"><table><thead><tr><th>' + esc(P(A.pid).short) + ' ↓ / ' + esc(P(opp).short) + ' →</th>' + mx.B.map(function (b) { return '<th>' + esc(b.src.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      mx.A.map(function (a, i) { return '<tr><th>' + esc(a.src.name) + '</th>' + mx.cells[i].map(function (c, j) { return '<td class="c' + (isNe(i, j) ? ' ne' : '') + '">' + sgn(c.a - mx.base.a) + ' / ' + sgn(c.b - mx.base.b) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    var pairs = mx.ne.map(function (n) { return T('"{0}" against "{1}"', esc(mx.A[n[0]].src.name), esc(mx.B[n[1]].src.name)); }).join('; ');
    h += '<p class="help">' + T('Each cell: your payoff change / theirs, if both play those moves and nobody else acts.') + ' ';
    h += (!mx.ne.length ? T('No pure-strategy equilibrium among these options: each side keeps wanting to switch, so expect manoeuvring.') : mx.ne.length > 1 ? T('Highlighted: equilibria — neither side can do better by switching alone ({0}).', pairs) : T('Highlighted: the equilibrium — neither side can do better by switching alone ({0}).', pairs)) + ' ';
    if (mx.domA >= 0) h += T('Your dominant option: "{0}" is at least as good whatever they do.', esc(mx.A[mx.domA].src.name)) + ' ';
    if (mx.domB >= 0) h += T('Their dominant option: "{0}".', esc(mx.B[mx.domB].src.name));
    return h + '</p>';
  }

  function map() {
    var al = E.alignment(C, S.x, A.pid), W = 320, H = 220;
    var pts = C.order.filter(function (q) { return q !== A.pid; }).map(function (q) {
      var x = 30 + (al[q] + 1) / 2 * (W - 50), y = H - 26 - C.players[q].power / 100 * (H - 46);
      return '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="11" fill="' + P(q).color + '"/><text x="' + x.toFixed(0) + '" y="' + (y + 3).toFixed(0) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">' + esc(P(q).short) + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:760px;height:auto;display:block;margin:0 auto" role="img" aria-label="' + esc(T('Stakeholder map: power against alignment with you')) + '">' +
      '<rect x="30" y="10" width="' + (W - 50) / 2 + '" height="' + (H - 36) + '" fill="var(--opp)" opacity=".08"/><rect x="' + (30 + (W - 50) / 2) + '" y="10" width="' + (W - 50) / 2 + '" height="' + (H - 36) + '" fill="var(--ally)" opacity=".08"/>' +
      '<line x1="30" y1="' + (H - 26) + '" x2="' + (W - 20) + '" y2="' + (H - 26) + '" stroke="var(--mute)"/><line x1="30" y1="10" x2="30" y2="' + (H - 26) + '" stroke="var(--mute)"/>' +
      '<text x="34" y="' + (H - 8) + '" font-size="9" fill="var(--mute)">' + T('against you') + '</text><text x="' + (W - 22) + '" y="' + (H - 8) + '" font-size="9" fill="var(--mute)" text-anchor="end">' + T('with you') + '</text>' +
      '<text x="12" y="18" font-size="9" fill="var(--mute)" transform="rotate(-90 12 18)" text-anchor="end">' + T('more power ↑') + '</text>' + pts + '</svg>' +
      '<p class="help">' + T('Upper right: strong partners — keep them close. Upper left: strong opponents — the players whose incentives you must change. Lower half: weaker voices that still shape legitimacy.') + '</p>';
  }

  function sens() {
    if (!cache.sens) {
      if (!cache.sensJob) {
        var mine = cache; cache.sensJob = 1;
        background('sens', { mode: A.mode, runs: 24 }, function (out) { if (cache === mine) { cache.sens = out; if (A.tab === 'analysis') render(); } }, function () {
          /* on the page itself: a little at a time, so it never freezes */
          var job = E.sensitivityJob(C, S, A.pid, { mode: A.mode, runs: 24 });
          (function tick() {
            if (cache !== mine) return;
            if (job.step()) { cache.sens = job.result(); if (A.tab === 'analysis') render(); } else setTimeout(tick, 30);
          })();
        });
      }
      return '<p class="loading">' + T('Stress-testing the recommendation…') + '</p>';
    }
    var s = cache.sens, top = C.moves[s.top], others = Object.keys(s.wins).filter(function (k) { return k !== s.top; }).sort(function (a, b) { return s.wins[b] - s.wins[a]; });
    var span = Math.max.apply(null, s.tornado.map(function (t) { return Math.max(Math.abs(t.lo - s.baseScore), Math.abs(t.hi - s.baseScore)); }).concat([0.5]));
    var h = '<p>' + T('With every weight, ideal point and move effect randomly disturbed ({0} trials), "<b>{1}</b>" stays the top move in {2} of them.', s.runs, esc(top.src.name), '<b class="' + (s.robustness >= 0.6 ? 'good' : s.robustness >= 0.35 ? 'warn' : 'bad') + '">' + pct(s.robustness) + '</b>') + ' ' +
      (s.robustness >= 0.6 ? T('The recommendation is robust.') : s.robustness >= 0.35 ? T('The recommendation is fairly sensitive to assumptions; weigh the alternatives.') : T('The recommendation is fragile — several moves are close. Treat it as one good option, not the answer.')) + '</p>';
    if (others.length) h += '<p class="help">' + T('Challengers: {0}', others.slice(0, 3).map(function (k) { return esc(C.moves[k].src.name) + ' (' + pct(s.wins[k] / s.runs) + ')'; }).join(' · ')) + '</p>';
    h += '<h3>' + T('Which starting conditions matter most') + '</h3><div class="torn">' + s.tornado.slice().sort(function (a, b) { return Math.abs(b.hi - b.lo) - Math.abs(a.hi - a.lo); }).map(function (t) {
      var a = (t.lo - s.baseScore) / span * 50, b = (t.hi - s.baseScore) / span * 50, d = M.dims[C.di[t.dim]];
      function seg(v, col) { return '<i style="' + (v >= 0 ? 'left:50%' : 'right:50%') + ';width:' + Math.abs(v) + '%;background:var(--' + col + ')"></i>'; }
      return '<span>' + esc(d.name) + '</span><span class="tb">' + seg(a, 'warn') + seg(b, 'info') + '</span><span class="num help">' + sgn(t.lo - s.baseScore) + ' / ' + sgn(t.hi - s.baseScore) + '</span>';
    }).join('') + '</div><p class="help">' + T('Effect on your best achievable score if each dimension started 15 points lower (amber) or higher (blue).') + '</p>';
    return h;
  }

  function precedents(m) {
    var ids = m.src.prec || [], list = M.precedents.filter(function (p) { return ids.indexOf(p.id) >= 0; });
    if (!list.length) list = M.precedents.filter(function (p) { return (p.cats || []).indexOf(m.src.cat) >= 0; }).slice(0, 3);
    if (!list.length) return '';
    return '<section class="card"><h2>' + T('What history says about moves like this') + '</h2><p class="help">' + T('Real past attempts that resemble this move, on Cyprus or elsewhere, with how they ended and the lesson. Tap one to open it.') + '</p>' + list.map(precItem).join('') + '</section>';
  }
  function precItem(p) {
    var w = (L.get() || {}).wiki || {}, x = w[p.wiki], out = { success: T('success'), failure: T('failure'), mixed: T('mixed') }[p.outcome] || p.outcome;
    return '<details class="lib-item"><summary>' + esc(p.name) + ' <span class="tag ' + (p.outcome === 'success' ? 'good' : p.outcome === 'failure' ? 'bad' : 'warn') + '">' + esc(out) + '</span> <span class="meta">' + esc(p.year) + '</span></summary><p>' + T('<b>Lesson:</b> {0}', esc(p.lesson)) + '</p>' +
      (x ? '<p class="help">' + esc(x.extract) + ' <a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + T('Wikipedia') + '</a></p>' : '') + '</details>';
  }

  function viewAnalysis() {
    var R = recs(), rec = (A.sel && recFor(A.sel)) || R[0];
    var h = intro(T('Analysis'), T('A full assessment of one move for <b>{0}</b> in the current position: strengths and weaknesses, risks, how it plays against a chosen opponent, who holds power, and how far the advice can be trusted. All of it is calculated with the computer playing the other stakeholders.', esc(P(A.pid).name)), [
      T('Pick the move to analyse in the first box (it starts on the move you selected on the board, or the engine\'s choice).'),
      T('Read each section from top to bottom; every section begins with a line saying what it shows.'),
      T('Use <b>Print / save PDF</b> to keep or share the assessment.')]) +
      '<section class="card"><div class="row between"><h2>' + T('Move under analysis') + '</h2><button class="btn small" data-a="print">' + T('Print / save PDF') + '</button></div>' +
      '<label class="help">' + T('Move under analysis') + ' <select data-c="sel">' + R.map(function (r) { return '<option value="' + r.m.id + '"' + (r === rec ? ' selected' : '') + '>' + esc(r.m.src.name) + ' (' + sgn(r.rel, 2) + ')</option>'; }).join('') + '</select></label>' +
      '<p style="margin-top:8px">' + esc(rec.m.src.desc) + '</p>' + verdict(rec) + '</section>';
    h += '<section class="card"><h2>' + T('SWOT for {0}', esc(P(A.pid).name)) + '</h2><p class="help">' + T('Generated from this exact position: your own leverage and exposure, plus what the other players are predicted to do in reply.') + '</p>' + swot(rec) + '</section>';
    h += '<section class="card"><h2>' + T('Risk register') + '</h2><p class="help">' + T('What could go wrong with this move in the coming round, how likely it is, how much it would cost you, and what to do about it.') + '</p>' + risks(rec) + '</section>';
    h += '<section class="card"><h2>' + T('Head-to-head payoff matrix') + '</h2><p class="help">' + T('The classic game-theory table: your five strongest options against one opponent\'s five strongest. Choose the opponent below.') + '</p>' + matrix() + '</section>';
    h += '<div class="grid two"><section class="card"><h2>' + T('Stakeholder map') + '</h2><p class="help">' + T('Every other stakeholder placed by how much power it has (height) and whether it currently pulls with you or against you (left to right).') + '</p>' + map() + '</section><section class="card"><h2>' + T('How sure is the recommendation?') + '</h2><p class="help">' + T('A stress test. The model\'s assumptions are judgments, so this re-runs the advice many times with those judgments deliberately disturbed.') + '</p>' + sens() + '</section></div>';
    h += '<section class="card"><h2>' + T('Political, security, economic, energy, legal and social lens') + '</h2><p class="help">' + T('The same result sorted by field, so a specialist in any one area can see what changes for them after this round.') + '</p>' + lens(rec) + '</section>';
    h += evidence(rec.m) + precedents(rec.m);
    return h;
  }

  /* ---------- live ---------- */
  function viewLive() {
    var d = L.get() || {}, st = d.status || {}, loc = I.lang === 'en' ? undefined : I.lang;
    var seedNote = d.seeded ? '<section class="card" style="border-left:5px solid var(--warn)"><p style="margin:0">' + T('This device has not yet completed a live fetch for every source. Until it does, the gaps are filled from the snapshot shipped with this version, taken on {0}. Live data replaces it source by source.', new Date(d.seeded).toLocaleDateString(loc)) + '</p></section>' : '';
    var h = intro(T('Live intelligence'), T('Real, current data from public sources, so the board starts from today\'s situation rather than a fixed snapshot. Your device fetches it directly whenever the app is open and online, and keeps the last copy for offline use.'), [
      T('<b>Sources</b> shows where each kind of data comes from and whether the last fetch worked.'),
      T('<b>Signals feeding the model</b> shows exactly how the data nudges the starting position. Untick any signal you do not want used.'),
      T('The charts, table and headlines below are the raw material, for your own reading.')]) + seedNote +
      '<section class="card"><div class="row between"><h2>' + T('Sources') + '</h2><button class="btn accent small" data-a="refresh"' + (L.busy ? ' disabled' : '') + '>' + (L.busy ? T('Updating…') : T('Refresh now')) + '</button></div>' +
      '<p class="help">' + T('Nothing passes through a private server: this device asks each source directly.') + '</p>' +
      '<div class="tblwrap"><table><thead><tr><th>' + T('Source') + '</th><th>' + T('Provides') + '</th><th>' + T('Status') + '</th></tr></thead><tbody>' + L.sources().map(function (s) {
        var x = st[s.id];
        return '<tr><td><a href="' + s.url + '" target="_blank" rel="noopener">' + esc(s.name) + '</a></td><td>' + esc(s.what) + '</td><td>' + (!x ? '<span class="tag">' + T('not yet fetched') + '</span>' : x.ok ? '<span class="tag good">' + T('ok') + '</span> ' + new Date(x.t).toLocaleString(loc) : '<span class="tag warn">' + T('unreachable') + '</span> ' + (x.kept ? T('showing last saved copy') : T('no data'))) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';

    h += '<section class="card"><div class="row between"><h2>' + T('Signals feeding the model') + '</h2><label class="row help"><input type="checkbox" data-c="live"' + (A.live ? ' checked' : '') + '> ' + T('Apply live signals') + '</label></div>';
    h += d.signals && d.signals.length ? '<div class="tblwrap"><table><thead><tr><th>' + T('Use') + '</th><th>' + T('Signal') + '</th><th>' + T('Reading') + '</th><th>' + T('Effect on the model') + '</th></tr></thead><tbody>' + d.signals.map(function (s) {
      var tx = L.sigText(s);
      var eff = s.dim ? (s.adj ? T('{0} starts {1}', esc(M.dims[C.di[s.dim]].name), sgn(s.adj, 0)) : T('none (within normal range)')) : T('{0} weights {1} ×{2}', esc(P(s.weight.player).name), andList(s.weight.dims.map(function (k) { return esc(M.dims[C.di[k]].name); })), s.weight.factor);
      return '<tr><td class="c"><input type="checkbox" data-c="sig" data-v="' + s.id + '"' + (A.sigOff[s.id] ? '' : ' checked') + (A.live ? '' : ' disabled') + ' aria-label="' + esc(T('Use this signal')) + '"></td><td>' + esc(tx.label) + '<br><span class="help">' + esc(tx.why) + '</span></td><td>' + esc(tx.value) + '</td><td>' + eff + '</td></tr>';
    }).join('') + '</tbody></table></div><p class="help">' + T('Adjustments are deliberately small and capped. They move the starting position of a new game; a game in progress is replayed from the adjusted start.') + '</p>' : '<p class="help">' + T('No signals yet. They appear after the first successful refresh.') + '</p>';
    h += '</section>';

    var tids = Object.keys(M.topics);
    h += '<section class="card"><div class="row between"><h2>' + T('Evidence by subject') + '</h2><label class="row help"><input type="checkbox" data-c="sig" data-v="momentum"' + (A.sigOff.momentum ? '' : ' checked') + (A.live ? '' : ' disabled') + '> ' + T('Let attention adjust each move') + '</label></div>' +
      '<p class="help">' + T('Every move belongs to a subject. For each subject the tool measures world attention by the number of people reading its reference articles on Wikipedia each day, comparing the last 7 days with the 4 weeks before, and sorts the current headlines by subject. When attention to a subject is up by a quarter or more, the chance of success of its moves rises by 5 points; when it is down by a fifth or more, it falls by 3; otherwise nothing changes. The same evidence, with the statements and meetings found, is shown beside every move on the board.') + '</p>' +
      '<div class="tblwrap"><table><thead><tr><th>' + T('Subject') + '</th><th>' + T('Readers a day, last 7 days') + '</th><th>' + T('4 weeks before') + '</th><th>' + T('Change') + '</th><th>' + T('Headlines, 21 days') + '</th><th>' + T('Attention') + '</th></tr></thead><tbody>' +
      tids.map(function (t) {
        var ag = L.agenda(t), n = L.reports(t, M.topics[t]).length;
        return '<tr><td>' + esc(M.topics[t].name) + '</td>' + (ag ? '<td class="c">' + ag.r7.toLocaleString(loc) + '</td><td class="c">' + ag.r28.toLocaleString(loc) + '</td><td class="c ' + cls(ag.ratio - 1, 0.2) + '">' + sgn((ag.ratio - 1) * 100, 0) + '%</td>' : '<td class="c mute" colspan="3">' + T('not yet fetched') + '</td>') + '<td class="c">' + n + '</td><td class="c">' + (ag ? momentumTag(ag.k) : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';

    var vs = L.voices(), any = M.players.some(function (pl) { return vs[pl.id] && vs[pl.id].n; });
    h += '<section class="card"><div class="row between"><h2>' + T('What each government says and does') + '</h2><label class="row help"><input type="checkbox" data-c="sig" data-v="voices"' + (A.sigOff.voices ? '' : ' checked') + (A.live ? '' : ' disabled') + '> ' + T('Let this tilt predictions') + '</label></div>' +
      '<p class="help">' + T('Readership shows attention, not intent. To get as close to intent as public evidence allows, the tool separates <b>words</b> from <b>deeds</b>. Words are statements: those published by governments themselves, and newspaper headlines reporting a named leader or office speaking about the Cyprus question. Deeds are headlines reporting an act, such as signing, opening, withdrawing, deploying or blocking. Each is read as conciliatory or hard-line. Deeds and governments\' own statements count double. The balance tilts that stakeholder\'s predicted choices slightly the same way, and the table warns when words and deeds point in opposite directions.') + '</p>' +
      (any ? '<div class="tblwrap"><table><thead><tr><th>' + T('Stakeholder') + '</th><th>' + T('Says') + '</th><th>' + T('Does') + '</th><th>' + T('Tilt') + '</th><th>' + T('Your own assessment') + '</th><th>' + T('Latest') + '</th></tr></thead><tbody>' + M.players.map(function (pl) {
        var v = vs[pl.id] || { says: { soft: 0, hard: 0 }, does: { soft: 0, hard: 0 }, n: 0, lean: 0, items: [] }, it = v.items[0], pv = +A.priv[pl.id] || 0;
        function pair(o) { return o.soft + o.hard ? '<span class="good">' + o.soft + '</span> / <span class="bad">' + o.hard + '</span>' : '<span class="mute">–</span>'; }
        return '<tr><td>' + esc(pl.name) + '</td><td class="c">' + pair(v.says) + '</td><td class="c">' + pair(v.does) + '</td><td class="c">' + (v.lean > 0 ? '<span class="tag good">' + T('conciliatory') + '</span>' : v.lean < 0 ? '<span class="tag bad">' + T('hard-line') + '</span>' : v.mixed ? '<span class="tag warn">' + T('mixed') + '</span>' : '<span class="tag">' + T('no tilt') + '</span>') + (v.gap ? '<br><span class="tag warn">' + T('words and deeds differ') + '</span>' : '') + (v.unsure ? '<br><span class="help">' + T('{0} unsure, not counted', v.unsure) + '</span>' : '') + (v.trend !== null && v.trend !== undefined && Math.abs(v.trend) >= 0.15 ? '<br><span class="help">' + (v.trend > 0 ? T('more conciliatory this week than in the two weeks before') : T('harder this week than in the two weeks before')) + '</span>' : '') + '</td><td class="c"><select data-c="priv" data-v="' + pl.id + '" aria-label="' + esc(T('Your own assessment')) + '">' +
          [[-2, T('much harder')], [-1, T('harder')], [0, T('as the record shows')], [1, T('more open')], [2, T('much more open')]].map(function (o) { return '<option value="' + o[0] + '"' + (pv === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></td><td>' +
          (it ? (it.official ? '<span class="tag info">' + T('official') + '</span> ' : it.deed ? '<span class="tag">' + T('deed') + '</span> ' : '') + '<a href="' + esc(it.url) + '" target="_blank" rel="noopener" lang="' + (it.lang || '') + '">' + esc(it.title) + '</a> <span class="help">' + esc(it.domain) + (it.outlets > 1 ? ' ' + T('and {0} more', it.outlets - 1) : '') + ' · ' + esc(it.date) + '</span> ' + hideBtn(it.title) : standingCell(pl.id)) + '</td></tr>' +
          (v.items.length ? '<tr><td colspan="6"><details class="explain"><summary>' + T('All {0} items counted for {1}: check and correct them', v.items.length, esc(pl.name)) + '</summary><ul class="news">' + v.items.slice(0, 40).map(function (x) {
            return '<li>' + toneBtn(x) + ' ' + (x.deed ? '<span class="tag">' + T('deed') + '</span> ' : x.official ? '<span class="tag info">' + T('official') + '</span> ' : '') + '<a href="' + esc(x.url) + '" target="_blank" rel="noopener" lang="' + x.lang + '">' + esc(x.title) + '</a> <span class="help">' + esc(x.domain) + ' · ' + esc(x.date) + (x.backs ? ' · ' + T('read as backing {0}', esc(P(x.backs).name)) : '') + '</span> ' + hideBtn(x.title) + '</li>';
          }).join('') + '</ul></details></td></tr>' : '');
      }).join('') + '</tbody></table></div><p class="help">' + T('In each pair the first number is conciliatory, the second hard-line. The same story in several papers is counted once. A stakeholder needs a weighted total of at least three before any tilt is applied. If an item is read wrongly, open the list under its stakeholder and press its coloured label to change the reading, or × to leave it and other papers\' versions of it out of every count. <b>Your own assessment</b> is for what you know and the public record does not: it shifts that stakeholder\'s tilt on your device only, and is never shared, not even in a shared link.') + (A.acc && A.acc.fresh ? ' ' + T('<b>How reliable is this reading?</b> It is measured against headlines read by hand. On {0} fresh headlines the rules had never been corrected against, they read {1}% correctly, but they caught only {2} of the {3} statements a careful reader would have counted, and {4} of the {5} they did count were right. The rules were then corrected against those too. On all {6} checked headlines they now read {7}% correctly, catch {8}% of what a reader would count, and are right in {9}% of what they count; subjects are assigned correctly in {10}% of {11} cases. Expect new headlines to fall between the two: the tool misses more than it invents, so an empty or thin tally means "little found", not "nothing said". Where the wording pulls both ways the item is marked "unsure" and left out until you decide.', A.acc.fresh.n, A.acc.fresh.right, A.acc.fresh.caught, A.acc.fresh.tally, A.acc.fresh.countedRight, A.acc.fresh.counted, A.acc.n, A.acc.right, A.acc.caught, A.acc.countedRight, A.acc.subject, A.acc.sn) : '') + (L.hiddenCount() + L.tonedCount() ? ' ' + T('You have left out {0} and re-read {1}.', L.hiddenCount(), L.tonedCount()) + ' <button class="btn small" data-a="unhide">' + T('Undo my corrections') + '</button>' : '') + '</p>' : '<p class="help">' + T('No statements found yet. They appear after the newspaper feeds have been read.') + '</p>') + '</section>';

    var off = L.officialItems();
    if (off.length) {
      var byActor = {};
      off.forEach(function (x) { (byActor[x.actor] = byActor[x.actor] || []).push(x); });
      h += '<section class="card"><h2>' + T('On the official record') + '</h2><p class="help">' + T('What governments and administrations themselves have published, fetched from their own sites: {0}. Statements here also feed the table above; bills, rules and formal decisions count as deeds. Each source is kept from its last successful fetch, so a source that is slow today still shows what it gave before.', esc(L.officialBodies.join('; '))) + '</p>' +
        M.players.filter(function (pl) { return byActor[pl.id]; }).map(function (pl) {
          return '<details class="lib-item"' + (pl.id === A.pid ? ' open' : '') + '><summary>' + esc(pl.name) + ' <span class="meta">(' + byActor[pl.id].length + ')</span></summary><ul class="news">' + byActor[pl.id].slice(0, 10).map(function (x) {
            return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a><br><span class="help">' + esc(x.body) + ' · ' + esc(x.date) + '</span>' + (x.detail ? '<br><span class="help">' + esc(x.detail) + '</span>' : '') + '</li>';
          }).join('') + '</ul></details>';
        }).join('') + '</section>';
    }

    h += '<div class="grid two">';
    if (d.fx) h += '<section class="card"><h2>' + T('Lira against the euro') + '</h2><div class="kv"><div><b>₺' + d.fx.try.toFixed(2) + '</b><span>' + T('per €1 on {0}', esc(d.fx.date)) + '</span></div><div><b class="' + (d.fx.change > 0 ? 'bad' : 'good') + '">' + sgn(d.fx.change) + '%</b><span>' + T('euro price in lira, 12 months') + '</span></div></div>' + spark(d.fx.series, 'var(--accent)') + '<p class="help">' + T('<b>Why this is here.</b> Türkiye is the player whose decision matters most, and its economy is where outside incentives and pressure bite. The lira is the one daily, public, hard number that shows how exposed that economy is. When it has fallen a lot over twelve months, Ankara needs foreign capital, trade access and investor confidence more, so offers such as a customs-union upgrade, and threats to them, weigh more in its calculation. The model therefore raises the weight Türkiye gives to its Western ties and to the economy, by at most 40%. The north of Cyprus also uses the lira, so the same slide erodes Turkish Cypriot living standards. Untick the lira signal above to switch this off.') + '</p></section>';
    if (d.tone) h += '<section class="card"><h2>' + T('Tone of Cyprus–Türkiye coverage') + '</h2><div class="kv"><div><b>' + d.tone.recent.toFixed(2) + '</b><span>' + T('last two weeks') + '</span></div><div><b>' + d.tone.base.toFixed(2) + '</b><span>' + T('four-month average') + '</span></div></div>' + spark(d.tone.series, 'var(--info)') + '<p class="help">' + T('<b>Why this is here.</b> It is an early-warning gauge. GDELT scores the language of worldwide news coverage: below zero is negative, and a falling line means more hostile reporting about Cyprus and Türkiye. If the last two weeks are clearly worse than the four-month average, the model starts with slightly lower stability.') + '</p></section>';
    h += '</div>';

    if (d.wb) {
      h += '<section class="card"><h2>' + T('Balance of resources') + '</h2><p class="help">' + T('The size of each economy, population and military budget, for context on who can afford what. These figures are shown for reference and do not change the model.') + '</p><div class="tblwrap"><table><thead><tr><th>' + T('Indicator') + '</th><th>' + T('Cyprus') + '</th><th>' + T('Türkiye') + '</th><th>' + T('Greece') + '</th><th>' + T('Year') + '</th></tr></thead><tbody>' + Object.keys(d.wb).map(function (k) {
        var r = d.wb[k]; function f(v) { return v === undefined || v === null ? '–' : v.toFixed(r.dp); }
        return '<tr><td>' + esc(L.wbLabel(k)) + '</td><td class="c">' + f(r.CYP) + '</td><td class="c">' + f(r.TUR) + '</td><td class="c">' + f(r.GRC) + '</td><td class="c">' + esc(r.year || '') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="help">' + T('World Bank, latest available year. Cyprus figures cover the government-controlled area.') + '</p></section>';
    }

    if (d.research && d.research.length) h += '<section class="card"><h2>' + T('Latest research') + '</h2><p class="help">' + T('The most recent scholarly articles on the Cyprus question, from the OpenAlex index of world research, newest first. For background reading; they do not change the model.') + '</p><ul class="news">' +
      d.research.map(function (w) { return '<li><a href="' + esc(w.url) + '" target="_blank" rel="noopener">' + esc(w.title) + '</a><br><span class="help">' + esc(w.venue) + (w.venue ? ' · ' : '') + esc(w.date) + '</span></li>'; }).join('') + '</ul></section>';

    var pr = ((d.press || {}).items || []).slice().sort(function (x, y) { return (y.lang === I18N.lang) - (x.lang === I18N.lang) || (x.date < y.date ? 1 : x.date > y.date ? -1 : 0); }).slice(0, 15);
    if (pr.length) h += '<section class="card"><h2>' + T('From the newspapers') + '</h2><p class="help">' + T('The newest headlines on the Cyprus question read directly from {0} newspapers that publish an open feed ({1}), those in your language first. {2} headlines from the last 21 days are held on this device and sorted by subject for the board.', (d.press || {}).n || 0, esc(L.pressNames.join(', ')), ((d.press || {}).items || []).length) + '</p><ul class="news">' +
      pr.map(function (a) { return '<li><a href="' + esc(a.url) + '" target="_blank" rel="noopener" lang="' + a.lang + '">' + esc(a.title) + '</a><br><span class="help">' + esc(a.domain) + ' · ' + esc(a.date) + '</span></li>'; }).join('') + '</ul></section>';

    var themes = ['all'].concat(L.themes), news = (d.news || []).filter(function (a) { return A.newsTheme === 'all' || a.themes.indexOf(A.newsTheme) >= 0; });
    h += '<section class="card"><h2>' + T('Latest headlines') + '</h2><p class="help">' + T('News from the last three weeks that mentions the Cyprus question, newest first. Filter by theme; tap a headline to read it at its source. The mix of themes feeds the signals above.') + '</p><div class="filter">' + themes.map(function (t) { return '<button data-a="ntheme" data-v="' + t + '" aria-pressed="' + (A.newsTheme === t) + '">' + (t === 'all' ? T('All') : L.themeName(t)) + '</button>'; }).join('') + '</div>' +
      (news.length ? '<ul class="news">' + news.map(function (a) { return '<li><a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title) + '</a><br><span class="help">' + esc(a.domain) + ' · ' + esc(a.date) + ' ' + a.themes.map(function (t) { return '<span class="tag">' + L.themeTag(t) + '</span>'; }).join(' ') + '</span></li>'; }).join('') + '</ul>' : '<p class="help">' + (d.news ? T('No headlines under this theme.') : T('Headlines appear after the first successful refresh.')) + '</p>') + '</section>';
    return h;
  }

  /* ---------- library ---------- */
  function LIBS() { return [['players', T('Stakeholders')], ['blueprints', T('Blueprint strategies')], ['history', T('Precedents')], ['assume', T('Assumptions')], ['about', T('Method & install')]]; }

  function viewLibrary() {
    var h = intro(T('Library'), T('The reference shelf behind the board: who the stakeholders are, the strategies in the source blueprints, what history teaches, the assumptions you can change, and how the tool works.'), [
      T('Use the buttons below to switch between the five shelves.'),
      T('<b>Stakeholders</b>: interests, red lines, leverage and weak points of each player, and the moves the model gives them.'),
      T('<b>Blueprint strategies</b>: search the full catalogue of proposals the moves are drawn from.'),
      T('<b>Precedents</b>: past successes and failures. <b>Assumptions</b>: every number in the model, adjustable. <b>Method & install</b>: how predictions are made, and how to install or download the tool.')]) +
      '<div class="filter" style="margin-bottom:12px">' + LIBS().map(function (l) { return '<button data-a="lib" data-v="' + l[0] + '" aria-pressed="' + (A.lib === l[0]) + '">' + l[1] + '</button>'; }).join('') + '</div>';
    if (A.lib === 'players') {
      var u = E.utilities(C, S.x);
      h += '<p class="help">' + T('One card per stakeholder. "Power" is relative influence on the outcome (0–100); "payoff now" is how close today\'s position is to that player\'s ideal (100 would be its perfect world).') + '</p><div class="cols2">' + M.players.map(function (p) {
        function li(t, a) { return a && a.length ? '<h3>' + t + '</h3><ul class="list">' + a.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
        var cp = C.players[p.id], top = M.dims.map(function (d, i) { return [d, cp.w[i], cp.ideal[i]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 4);
        return '<section class="card" id="pl-' + p.id + '" style="border-left:5px solid ' + p.color + '"><div class="row between"><h2>' + esc(p.name) + '</h2><span class="help">' + (p.veto ? T('power {0} · payoff now {1} · <b>can block a settlement</b>', p.power, u[p.id].toFixed(0)) : T('power {0} · payoff now {1}', p.power, u[p.id].toFixed(0))) + '</span></div><p>' + esc(p.role) + '</p>' +
          '<p class="help">' + T('<b>Cares most about:</b> {0}', top.map(function (t) { return T('{0} (wants {1}, weight {2})', esc(t[0].name), Math.round(t[2]), pct(t[1])); }).join(' · ')) + '</p>' +
          li(T('Interests'), p.interests) + li(T('Red lines'), p.redlines) + li(T('Leverage'), p.leverage) + li(T('Vulnerabilities'), p.vuln) +
          '<h3>' + T('Moves available in the model') + '</h3><div class="chips">' + C.byPlayer[p.id].filter(function (m) { return !m.hold; }).map(function (m) { return '<span class="chip" style="padding-left:10px" title="' + esc(m.src.desc) + '">' + esc(m.src.name) + '</span>'; }).join('') + '</div>' +
          (p.id !== A.pid ? '<p style="margin-top:10px"><button class="btn small" data-a="pick" data-v="' + p.id + '">' + T('Play as {0}', esc(p.short)) + '</button></p>' : '') + '</section>';
      }).join('') + '</div>';
    } else if (A.lib === 'blueprints') {
      h += '<section class="card"><h2>' + T('Blueprint strategies') + '</h2><p class="help">' + T('The strategies set out in the source blueprints by Samuel Akosa Onyejekwe, searchable. These are proposals, not established facts; figures and timings inside them are the author\'s planning estimates. The moves on the board are drawn from them.') + '</p>' +
        (I.lang === 'en' ? '' : '<p class="help langnote">' + T('The source documents are in English, so the entries in this list are shown in English.') + '</p>') +
        '<input type="search" placeholder="' + esc(T('Search strategies, actors, risks…')) + '" value="' + esc(A.q) + '" data-c="q" aria-label="' + esc(T('Search strategies')) + '" style="width:100%">';
      if (!KB && window.KNOWLEDGE) KB = window.KNOWLEDGE;
      if (!KB) { loadKB(); h += '<p class="loading">' + T('Loading the library…') + '</p></section>'; return h; }
      var q = A.q.toLowerCase().trim(), n = 0;
      h += '<div id="kbres">' + kbResults(q) + '</div></section>';
    } else if (A.lib === 'history') {
      h += '<section class="card"><h2>' + T('Precedents: what worked, what failed') + '</h2><p class="help">' + T('Past attempts on Cyprus and comparable cases elsewhere. Summaries update from Wikipedia when online.') + '</p>' + [['cy', T('Cyprus')], ['else', T('Elsewhere')]].map(function (g) {
        return '<h2 style="margin-top:14px">' + g[1] + '</h2><div class="cols2">' + M.precedents.filter(function (p) { return (p.scope === 'cy') === (g[0] === 'cy'); }).map(precItem).join('') + '</div>';
      }).join('') + '</section>';
    } else if (A.lib === 'assume') {
      h += viewAssume();
    } else h += viewAbout();
    return h;
  }

  /* The blueprint entries themselves stay in the language of the source documents. */
  function kbResults(q) {
    var out = '', n = 0;
    KB.docs.forEach(function (d) {
      var items = d.strategies.filter(function (s) { return !q || (s.t + ' ' + s.a + ' ' + s.s + ' ' + (s.r || []).join(' ')).toLowerCase().indexOf(q) >= 0; });
      if (!items.length) return;
      n += items.length;
      out += '<h2 style="margin-top:16px">' + esc(d.title) + ' <small>(' + items.length + ')</small></h2>' + (q ? '' : '<p class="help">' + esc(d.thesis) + '</p>' +
        (d.games && d.games.length ? '<details class="explain"><summary>' + T('The game-theory logic of this blueprint') + '</summary><ul class="list">' + d.games.map(function (g) { return '<li><b>' + esc(g.n) + '.</b> ' + esc(g.i) + '</li>'; }).join('') + '</ul></details>' : '') +
        (d.phases && d.phases.length ? '<details class="explain"><summary>' + T('Sequencing and gates') + '</summary><ul class="list">' + d.phases.map(function (p) { return '<li><b>' + esc(p.p) + '</b>' + (p.w ? ' (' + esc(p.w) + ')' : '') + ': ' + p.a.map(esc).join('; ') + (p.g.length ? ' <i>' + T('Gates: {0}', p.g.map(esc).join('; ')) + '</i>' : '') + '</li>'; }).join('') + '</ul></details>' : '')) + items.slice(0, q ? 60 : 400).map(function (s) {
        function li(t, a) { return a && a.length ? '<p><b>' + t + ':</b> ' + a.map(esc).join('; ') + '</p>' : ''; }
        return '<details class="lib-item"><summary>' + esc(s.t) + ' <span class="tag">' + esc(s.c) + '</span></summary><p class="meta">' + esc(s.a) + (s.w ? ' · ' + esc(s.w) : '') + '</p><p>' + esc(s.s) + '</p>' +
          (s.x && s.x.length ? '<p><b>' + T('Expected responses:') + '</b></p><ul class="list">' + s.x.map(function (x) { return '<li><b>' + esc(x[0]) + ':</b> ' + esc(x[1]) + '</li>'; }).join('') + '</ul>' : '') + li(T('Benefits'), s.b) + li(T('Risks'), s.r) + li(T('Mitigations'), s.m) + '</details>';
      }).join('');
    });
    return (q ? '<p class="help">' + (n === 1 ? T('{0} match', n) : T('{0} matches', n)) + '</p>' : '') + (out || '<p class="help">' + T('Nothing matches that search.') + '</p>');
  }
  function loadKB() {
    if (loadKB.busy) return; loadKB.busy = true;
    var done = function (j) { KB = j; loadKB.busy = false; if (A.tab === 'library' && A.lib === 'blueprints') render(); };
    if (window.KNOWLEDGE) return done(window.KNOWLEDGE);
    fetch('data/knowledge.json').then(function (r) { return r.json(); }).then(done).catch(function () { loadKB.busy = false; KB = { docs: [] }; toast(T('The library could not be loaded. It will be available once you have opened it online.')); KB = null; });
  }

  function viewAssume() {
    var p = P(A.pid), cp = C.players[A.pid];
    var h = '<section class="card"><div class="row between"><h2>' + T('Assumptions') + '</h2><button class="btn small" data-a="resetassume">' + T('Restore defaults') + '</button></div><p class="help">' + T('Nothing in the model is hidden. Change any number and every prediction is recalculated. Your edits stay on this device.') + '</p>' +
      '<h3>' + T('Starting position') + '</h3><p class="help">' + T('Where each of the ten measures stands today, 0–100. The facts behind each score are listed below the sliders.') + '</p><div class="adj">' + M.dims.map(function (d, i) { return '<label for="b-' + d.id + '">' + esc(d.name) + '</label><input id="b-' + d.id + '" type="range" min="0" max="100" value="' + Math.round(C.x0[i]) + '" data-c="base" data-v="' + d.id + '"><b class="num">' + Math.round(C.x0[i]) + '</b>'; }).join('') + '</div><details class="explain" style="margin-top:10px"><summary>' + T('The facts behind each starting score') + '</summary><ul class="list">' + M.dims.map(function (d) { return '<li><b>' + esc(d.name) + '</b> (' + esc(d.lo) + ' ↔ ' + esc(d.hi) + '): ' + esc(d.basis) + '</li>'; }).join('') + '</ul></details></section>';
    h += '<section class="card"><h2>' + T('What a player wants, and how much it cares') + '</h2><p class="help">' + T('For the chosen player: the "ideal point" is where it would like each measure to be, and the "weight" is how much that measure matters to it. These two numbers drive every prediction of that player\'s behaviour.') + '</p><label class="help">' + T('Player') + ' <select data-c="assumep">' + M.players.map(function (q) { return '<option value="' + q.id + '"' + (q.id === (A.ap || A.pid) ? ' selected' : '') + '>' + esc(q.name) + '</option>'; }).join('') + '</select></label>';
    var q = C.players[A.ap || A.pid];
    h += '<div class="tblwrap" style="margin-top:8px"><table><thead><tr><th>' + T('Dimension') + '</th><th>' + T('Ideal point (0–100)') + '</th><th>' + T('Weight') + '</th></tr></thead><tbody>' + M.dims.map(function (d, i) {
      return '<tr><td>' + esc(d.name) + '<br><span class="help">' + esc(d.lo) + ' ↔ ' + esc(d.hi) + '</span></td><td><input type="range" min="0" max="100" value="' + Math.round(q.ideal[i]) + '" data-c="ideal" data-v="' + d.id + '" aria-label="' + esc(T('Ideal for {0}', d.name)) + '"> <b class="num">' + Math.round(q.ideal[i]) + '</b></td><td><input type="range" min="0" max="40" value="' + Math.round(q.w[i] * 100) + '" data-c="w" data-v="' + d.id + '" aria-label="' + esc(T('Weight for {0}', d.name)) + '"> <b class="num">' + pct(q.w[i]) + '</b></td></tr>';
    }).join('') + '</tbody></table></div><p class="help">' + T('Weights are rescaled to total 100%.') + '</p></section>';
    return h;
  }

  function viewAbout() {
    var mirrors = (M.mirrors || []).map(function (u) { return '<li><a href="' + u + '" rel="noopener">' + esc(u.replace(/^https?:\/\//, '')) + '</a></li>'; }).join('');
    return '<section class="card"><h2>' + T('Method') + '</h2>' +
      '<p>' + T('The board is a <b>spatial bargaining game</b>. The Cyprus question is described by ten dimensions scored 0–100. Each of ten stakeholders has an ideal point on every dimension and a weight for how much it cares. A player\'s payoff is its weighted closeness to its ideals — 100 would be its perfect world.') + '</p>' +
      '<p>' + T('<b>Moves</b> shift dimensions by stated amounts, carry a chance of success, and may cost the mover political capital. Some need a precondition: a level of trust, or another player\'s earlier move.') + '</p>' +
      '<p>' + T('<b>Prediction.</b> After your move every other player replies in turn. Each values its options by its payoff once the remaining players have also replied, and the reply probabilities follow from how far apart those values are (a quantal-response rule: close calls are uncertain, clear ones are near-certain).') + '</p>' +
      '<p>' + T('<b>Best move and critical path.</b> The engine plays every option forward through several rounds of best replies and ranks them by your chosen objective; the path search keeps the four most promising lines at each step.') + '</p>' +
      '<p>' + T('<b>Odds</b> come from hundreds of simulated futures in which moves can fail and players sometimes take their second choice. <b>Robustness</b> comes from re-running the recommendation with every assumption randomly disturbed.') + '</p>' +
      '<p>' + T('<b>Limits.</b> This is a decision aid. It makes reasoning explicit and comparable; it cannot know private intentions, domestic shocks or events outside the ten dimensions. Scores are the authors\' structured judgments, informed by the source blueprints and the public record, and are open to edit under Assumptions. Treat outputs as scenarios with probabilities, not prophecy.') + '</p></section>' +
      '<section class="card"><h2>' + T('Install and use offline') + '</h2><p>' + T('The board installs like an app on phones, tablets and computers and runs fully offline, including in airplane mode. Live data refreshes whenever a connection returns.') + '</p>' +
      '<div class="row"><button class="btn accent" data-a="install">' + T('Install on this device') + '</button><a class="btn" href="offline.html" download="cyprus-strategy-board.html">' + T('Download single-file copy') + '</a></div>' +
      '<p class="help" style="margin-top:8px">' + T('The single-file copy is the whole tool in one HTML document. Keep it on a drive or pass it on; it opens in any browser without a connection.') + '</p>' +
      (mirrors ? '<h3>' + T('Mirrors') + '</h3><p class="help">' + T('The same board is published at independent addresses. If one is unreachable, use another; an installed copy keeps working regardless.') + '</p><ul class="list">' + mirrors + '</ul>' : '') + '</section>' +
      '<section class="card"><h2>' + T('Languages') + '</h2><p>' + T('The Greek and Turkish versions were translated from the English and then checked a second time by a separate reviewer for accuracy, natural wording and even-handed terms. They have not yet been approved by a professional native-speaking editor. If you find wording that is wrong, awkward or one-sided, please report it; every report is read and corrected in the next release.') + '</p><p><a class="btn" target="_blank" rel="noopener" href="https://github.com/samuelakosaonyejekwe/resolvethecyprusproblem/issues/new?title=' + encodeURIComponent('Wording correction (' + I18N.lang + ')') + '&body=' + encodeURIComponent('Where (page and section):\n\nCurrent wording:\n\nBetter wording:\n\nWhy:\n') + '">' + T('Suggest a better wording') + '</a></p></section>' +
      '<section class="card"><h2>' + T('Sources') + '</h2><p>' + T('Strategy content is drawn from the policy blueprints of <b>Samuel Akosa Onyejekwe</b> (2024–2025):') + '</p><ul class="list">' + M.docs.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
      '<p class="help">' + T('Live data: {0}. Version {1}.', L.sources().map(function (s) { return esc(s.name); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', '), esc(M.version)) + '</p></section>';
  }

  /* ---------- guide ---------- */
  function viewGuide() {
    return intro(T('Guide'), T('The complete guide to the Cyprus Strategy Board: what it is, how to play, how every prediction and score is worked out, what each page shows, and how to install it. Tap a heading to open that section.'), null) +
      '<section class="card"><div class="row" style="margin-bottom:8px"><button class="btn small" data-a="gopen" data-v="1">' + T('Open all sections') + '</button><button class="btn small" data-a="gopen" data-v="0">' + T('Close all') + '</button><button class="btn small" data-a="print">' + T('Print / save PDF') + '</button></div>' +
      window.GUIDE(T, M, esc) + '</section>';
  }

  /* A previous / next page button: round chevron, small caption, page name. */
  function pagerBtn(dir, act, v, cap, label) {
    return '<button class="pg ' + dir + '" data-a="' + act + '"' + (v ? ' data-v="' + v + '"' : '') + '><i aria-hidden="true"></i><span><small>' + esc(cap) + '</small><b>' + esc(label) + '</b></span></button>';
  }

  /* ---------- render ---------- */
  function render() {
    /* remember which fold-out sections the reader has opened, so a redraw does not close them */
    var openNow = {}, od = view.querySelectorAll('details[open] > summary'), oi;
    for (oi = 0; oi < od.length; oi++) openNow[od[oi].textContent.slice(0, 60)] = 1;
    var keepTab = render.tab === A.tab + '|' + A.lib + '|' + A.pid; render.tab = A.tab + '|' + A.lib + '|' + A.pid;
    setTimeout(function () {
      if (!keepTab) return;
      var all = view.querySelectorAll('details > summary');
      for (var q = 0; q < all.length; q++) if (openNow[all[q].textContent.slice(0, 60)]) all[q].parentNode.open = true;
    }, 0);
    chrome();
    if (!A.pid && A.tab === 'guide') { view.innerHTML = viewGuide() + '<nav class="pager">' + pagerBtn('prev', 'start', '', T('Previous'), T('Choose stakeholder')) + '</nav>'; sheet.className = 'sheet'; document.body.classList.remove('has-sheet'); return; }
    if (!A.pid) { view.innerHTML = viewPick(); sheet.className = 'sheet'; document.body.classList.remove('has-sheet'); return; }
    var f = { board: viewBoard, path: viewPath, analysis: viewAnalysis, live: viewLive, library: viewLibrary, guide: viewGuide }[A.tab] || viewBoard;
    var keep = document.activeElement && document.activeElement.getAttribute('data-c') === 'q';
    var tabs = TABS(), ti = tabs.map(function (t) { return t[0]; }).indexOf(A.tab), prev = tabs[ti - 1], next = tabs[ti + 1];
    view.innerHTML = f() + '<nav class="pager" aria-label="' + esc(T('Previous and next page')) + '">' +
      (prev ? pagerBtn('prev', 'tab', prev[0], T('Previous'), prev[2]) : pagerBtn('prev', 'home', '', T('Previous'), T('Choose stakeholder'))) +
      (next ? pagerBtn('next', 'tab', next[0], T('Next'), next[2]) : pagerBtn('next', 'tab', 'board', T('Start again'), T('Back to the board'))) + '</nav>';
    viewSheet();
    if (keep) { var i = $('[data-c="q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
  function go(tab) { if (A.tab === tab) return; A.tab = tab; A.sel = tab === 'board' ? A.sel : A.sel; navPush(); render(); window.scrollTo(0, 0); }

  function play(id) {
    var mv = C.moves[id];
    if (!mv || E.blocked(C, S, mv)) return;
    var forced = A.play === 'manual' ? forcedMap() : null;
    var r = E.round(C, S, A.pid, id, { deep: true, forced: forced });
    r.manual = !!forced;
    stack.push({ S: S, r: r }); S = r.state; A.sel = null; A.manual = {}; cache = {};
    A.own.push(forced ? id + Object.keys(forced).map(function (k) { return '~' + k + '=' + forced[k]; }).join('') : id);
    save(); render(); window.scrollTo(0, 0);
    var card = $('#played'); if (card) card.scrollIntoView({ block: 'start' });
    toast(T('Round {0} played. Every answer is listed under "What just happened".', S.round));
  }

  /* ---------- install ---------- */
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function installUI() { $('#installBtn').hidden = standalone(); }
  function install() {
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; }); return; }
    var ua = navigator.userAgent, ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    function ol(a) { return '<ol class="list">' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>'; }
    var steps = standalone() ? '<p>' + T('The board is already installed and running as an app on this device.') + '</p>' :
      location.protocol === 'file:' ? '<p>' + T('You are using the single-file copy. It already works offline from wherever you saved it. To install it as an app with automatic updates, open one of the web addresses under Library → Method & install.') + '</p>' :
      ios ? ol([T('Open this page in <b>Safari</b>.'), T('Tap the <b>Share</b> button (the square with an arrow).'), T('Choose <b>Add to Home Screen</b>, then <b>Add</b>.')]) :
      /Android/.test(ua) ? ol([T('Open the browser menu (<b>⋮</b>).'), T('Choose <b>Install app</b> or <b>Add to Home screen</b>.'), T('Confirm. The board appears with your other apps.')]) :
      ol([T('<b>Chrome or Edge:</b> click the install icon at the right of the address bar, or menu → <b>Install Cyprus Strategy Board</b>.'), T('<b>Safari on Mac:</b> File → <b>Add to Dock</b>.'), T('<b>Firefox:</b> bookmark the page; it still works offline after the first visit.')]);
    modal('<h2>' + T('Install the board') + '</h2>' + steps + '<p class="help">' + T('Once installed it opens without a connection, including in airplane mode. Any browser that has opened the page once also keeps an offline copy.') + '</p><div class="row"><a class="btn" href="offline.html" download="cyprus-strategy-board.html">' + T('Download single-file copy') + '</a><button class="btn accent" data-a="closemodal">' + T('Done') + '</button></div>');
  }
  function modal(html) { var m = $('#modal'); m.innerHTML = '<div class="box" role="dialog" aria-modal="true">' + html + '</div>'; m.hidden = false; }

  /* ---------- events ---------- */
  var acts = {
    home: function () { if (!A.pid && A.tab !== 'guide') return; A.pid = null; A.sel = null; A.tab = 'board'; navPush(); render(); window.scrollTo(0, 0); },
    start: function () { acts.home(); },
    guide: function () { A.tab = 'guide'; A.sel = null; navPush(); render(); window.scrollTo(0, 0); },
    gopen: function (v) { var all = view.querySelectorAll('details.guide-sec'); for (var i = 0; i < all.length; i++) all[i].open = v === '1'; },
    back: function () { history.back(); },
    fwd: function () { history.forward(); },
    pick: function (v) { A.pid = v; A.own = []; A.sel = null; A.tab = 'board'; A.cat = 'all'; replay(); navPush(); render(); window.scrollTo(0, 0); wantTopics(null); },
    tab: function (v) { go(v); },
    sel: function (v) { A.sel = A.sel === v ? null : v; A.manual = {}; if (A.sel && C.moves[A.sel]) wantTopics(C.moves[A.sel].src.topic); render(); },
    playmode: function (v) { A.play = v; A.manual = {}; save(); render(); },
    close: function () { A.sel = null; render(); },
    find: findOpen,
    jump: function (v) { var a = v.split('|'); jumpTo(a[0], a[1], a.slice(2).join('|')); },
    selbest: function () { var b = recs()[0]; if (!b) return; A.sel = b.m.id; A.manual = {}; wantTopics(b.m.src.topic); render(); var el = view.querySelector('.mv.sel'); if (el && !document.body.classList.contains('has-sheet')) el.scrollIntoView({ block: 'center' }); },
    findmove: function (v) { $('#modal').hidden = true; if (A.tab !== 'board') { A.tab = 'board'; navPush(); } A.cat = 'all'; A.sel = v; A.manual = {}; if (C.moves[v]) wantTopics(C.moves[v].src.topic); render(); },
    play: function () { play(A.sel); },
    playfirst: function () { var st = cache.path.p.steps[0]; A.tab = 'board'; navPush(); play(st.move.id); },
    analyse: function () { go('analysis'); },
    mode: function (v) { A.mode = v; cache = {}; save(); render(); },
    cat: function (v) { A.cat = v; render(); },
    undo: function () { if (!stack.length) return; S = stack.pop().S; A.own.pop(); cache = {}; A.sel = null; save(); render(); },
    reset: function () { A.own = []; A.sel = null; replay(); save(); render(); },
    share: function () {
      save(); var url = location.href;
      if (navigator.share) navigator.share({ title: T('Cyprus Strategy Board'), text: T('A line of play as {0}', P(A.pid).name), url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast(T('Link to this game copied.')); });
      else modal('<h2>' + T('Link to this game') + '</h2><p style="word-break:break-all">' + esc(url) + '</p><button class="btn accent" data-a="closemodal">' + T('Done') + '</button>');
    },
    player: function (v) { $('#modal').hidden = true; A.tab = 'library'; A.lib = 'players'; A.sel = null; navPush(); render(); var el = $('#pl-' + v); if (el) el.scrollIntoView(); },
    lib: function (v) { if (A.lib === v) return; A.lib = v; navPush(); render(); },
    ntheme: function (v) { A.newsTheme = v; render(); },
    refresh: function () { refresh(true); },
    install: install,
    closemodal: function () { $('#modal').hidden = true; },
    theme: function () {
      var cur = A.theme || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      A.theme = cur === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', A.theme); save();
    },
    hide: function (v) { L.hide(v); readNow(); build(); render(); toast(T('Left out. You can restore hidden headlines on the Live intel page.')); },
    unhide: function () { L.unhideAll(); L.resetTones(); readNow(); build(); render(); },
    tone: function (v, el) { var t = el.getAttribute('data-t'); L.setTone(v, t === 'unsure' ? 'soft' : t === 'soft' ? 'hard' : t === 'hard' ? 'plain' : 'soft'); readNow(); build(); render(); },
    print: function () { if (A.tab === 'guide') acts.gopen('1'); window.print(); },
    resetassume: function () { A.custom = { base: {}, w: {}, ideal: {} }; build(); save(); render(); }
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-a]') : null;
    if (!t) { if (e.target.id === 'modal') e.target.hidden = true; return; }
    var f = acts[t.getAttribute('data-a')];
    if (f) { if (t.tagName !== 'A') e.preventDefault(); f(t.getAttribute('data-v'), t); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, c = t.getAttribute && t.getAttribute('data-c'), v = t.getAttribute('data-v');
    if (!c) return;
    if (c === 'lang') { I.set(t.value); return; }
    if (c === 'horizon') { A.horizon = +t.value; cache.path = null; }
    else if (c === 'opp') A.opp = t.value;
    else if (c === 'priv') { A.priv[v] = +t.value; build(); }
    else if (c === 'man') { A.manual[v] = t.value; render(); return; }
    else if (c === 'sel') { A.sel = t.value; if (C.moves[A.sel]) wantTopics(C.moves[A.sel].src.topic); }
    else if (c === 'live') { A.live = t.checked; build(); }
    else if (c === 'sig') { A.sigOff[v] = !t.checked; build(); }
    else if (c === 'assumep') A.ap = t.value;
    else if (c === 'base') { A.custom.base[v] = +t.value; build(); }
    else if (c === 'ideal' || c === 'w') {
      var pid = A.ap || A.pid, o = A.custom[c][pid] = A.custom[c][pid] || {};
      if (c === 'w') { M.dims.forEach(function (d, i) { if (o[d.id] === undefined) o[d.id] = C.players[pid].w[i]; }); o[v] = +t.value / 100; }
      else o[v] = +t.value;
      build();
    } else return;
    save(); render();
  });
  document.addEventListener('input', function (e) {
    if (e.target.getAttribute && e.target.getAttribute('data-c') === 'find') return findFilter(e.target.value);
    if (e.target.getAttribute && e.target.getAttribute('data-c') === 'q') {
      A.q = e.target.value;
      var el = $('#kbres'); if (el && KB) el.innerHTML = kbResults(A.q.toLowerCase().trim());
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) { e.preventDefault(); return findOpen(); } if (e.key === 'Escape') { if (!$('#modal').hidden) $('#modal').hidden = true; else if (A.sel) acts.close(); } });

  /* ---------- language: re-translate the model and redraw; the game itself is untouched ---------- */
  I.onChange(function () {
    var at = document.activeElement, inView = at && at.getAttribute && at.getAttribute('data-c') === 'lang' && at.id !== 'lang';
    M = I.model(M0);
    build();
    $('#modal').hidden = true;
    render();
    if (inView) { var s = $('#view [data-c="lang"]'); if (s) s.focus(); }
  });

  /* ---------- live refresh loop ---------- */
  function refresh(manual) {
    if (navigator.onLine === false) { if (manual) toast(T('You are offline. Showing the last saved data.')); return; }
    var pv = {};
    Object.keys(M.topics).forEach(function (t) { pv[t] = M.topics[t].pv || []; });
    L.refresh(M.precedents.map(function (p) { return p.wiki; }).filter(Boolean).concat(L.standingTitles), pv).then(function () { if (manual) toast(T('Live data updated.')); });
    wantTopics(A.sel && C.moves[A.sel] ? C.moves[A.sel].src.topic : null);
  }
  /* Evidence arriving for a subject changes the odds of its moves: recalculate,
     and redraw unless the user is in the middle of choosing something. */
  var liveTimer = null, liveFirst = 0, liveDrawn = 0;
  function liveArrived() {
    net();
    var now = Date.now();
    if (!liveFirst) liveFirst = now;
    clearTimeout(liveTimer);
    /* recalculate after 2.5 quiet seconds, or 8 seconds at most while things keep arriving */
    liveTimer = setTimeout(liveApply, Math.max(0, Math.min(2500, liveFirst + 8000 - now)));
    /* the Live intel page itself may redraw sooner, to show sources ticking in, but not more than every two seconds */
    if (A.tab === 'live' && C && now - liveDrawn > 2000 && !typing()) { liveDrawn = now; render(); }
  }
  /* Sort the headlines by subject a little at a time while the page is idle, so that pages which show them open at once. */
  var warmTimer = null;
  function warmUp() {
    clearTimeout(warmTimer);
    var ids = Object.keys(M.topics), i = 0;
    (function next() { if (i >= ids.length) return; L.reports(ids[i], M.topics[ids[i]]); i += 1; warmTimer = setTimeout(next, 60); })();
  }
  /* A correction made by the user is read at once, on the page, so that it shows immediately. */
  function readNow() { var z = L._lazy; L._lazy = false; L.voices(); Object.keys(M.topics).forEach(function (t) { L.reports(t, M.topics[t]); }); L._lazy = z; }
  function typing() { var el = document.activeElement; return !!el && (el.tagName === 'SELECT' || el.tagName === 'INPUT'); }
  function liveApply() {
    liveFirst = 0;
    if (!C) return;
    L._lazy = !bgOff;
    if (bgOff) { warmUp(); return liveDone(); }
    var snap = L._snapshot();
    if (L._voicesReady()) return liveDone();
    /* have the headlines read in the background, then recalculate */
    background('read', null, function (out) { if (!L._adopt(snap.stamp, out)) return liveArrived(); liveDone(); }, function () { L._lazy = false; warmUp(); liveDone(); }, snap);
  }
  function liveDone() {
    var changed = build();
    if (typing()) return;
    if (A.tab === 'live' || (changed && (A.tab === 'board' || A.tab === 'analysis' || A.tab === 'path')) || (A.tab === 'board' && A.sel)) recsSoon(function () { if (typing()) return; liveDrawn = Date.now(); render(); });
  }
  L.onTopic(liveArrived);
  L.onChange(liveArrived);
  window.addEventListener('online', function () { net(); refresh(); });
  window.addEventListener('offline', net);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && L.stale()) refresh(); });
  setInterval(function () { net(); if (!document.hidden && L.stale()) refresh(); if (!document.hidden) wantTopics(null); }, 10 * 60 * 1000);

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { deferred = null; installUI(); toast(T('Installed. The board now works offline.')); });

  /* ---------- start ---------- */
  restore();
  if (A.theme) document.documentElement.setAttribute('data-theme', A.theme);
  fixed();
  L.setTopics(window.MODEL.topics);
  build(); installUI();
  setTimeout(liveArrived, 300);          /* read what is already stored, in the background */
  try { history.replaceState(navState(), '', location.href); } catch (e) {}
  render();
  /* how well the reading rules did on the hand-checked set, measured at release */
  if (window.ACC) A.acc = window.ACC; else if (location.protocol !== 'file:') fetch('data/accuracy.json').then(function (r) { return r.json(); }).then(function (j) { A.acc = j; if (A.tab === 'live') render(); }).catch(function () {});
  /* first run on this device: start from the snapshot shipped with this version */
  if (!L.get() && !window.SEED && location.protocol !== 'file:') fetch('data/seed.json').then(function (r) { return r.json(); }).then(function (j) { L.useSeed(j); if (C) { build(); render(); } }).catch(function () {});
  if (L.stale()) setTimeout(refresh, 800);
  setTimeout(function () { wantTopics(null); }, 2500);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    var hadSW = !!navigator.serviceWorker.controller, reloaded = false;
    /* A new version has taken over: show it straight away. */
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadSW && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (w) w.addEventListener('statechange', function () { if (w.state === 'activated' && hadSW) toast(T('Updated to the latest version.')); });
      });
      setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);
    }).catch(function () {});
  }
})();
