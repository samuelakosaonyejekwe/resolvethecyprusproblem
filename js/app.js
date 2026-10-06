/* Interface for the Cyprus Strategy Board. */
(function () {
  'use strict';
  var M = window.MODEL, E = window.Engine, L = window.Live;
  var LS = 'cy.app.v2';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = $('#view'), sheet = $('#sheet');

  var A = { pid: null, tab: 'board', sel: null, mode: 'sustainable', horizon: 6, live: true, sigOff: {}, own: [],
    cat: 'all', play: 'auto', manual: {}, lib: 'players', q: '', opp: null, theme: null, custom: { base: {}, w: {}, ideal: {} }, newsTheme: 'all' };
  var C = null, S = null, stack = [], cache = {}, KB = null, deferred = null;

  var TABS = [['board', '♟', 'Board'], ['path', '➤', 'Best path'], ['analysis', '◫', 'Analysis'], ['live', '◉', 'Live intel'], ['library', '☰', 'Library']];
  var MODES = { self: ['My payoff', 'Maximise your own stakeholder\'s payoff, whatever it does to the others.'],
    sustainable: ['Sustainable', 'Your payoff, minus a penalty whenever a party that can block the outcome (Republic of Cyprus, Turkish Cypriots, Türkiye) ends worse off than today, or stability erodes. Deals that leave a veto player worse off do not last.'],
    collective: ['Collective', 'The power-weighted average payoff of all ten stakeholders.'] };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function P(id) { return C.players[id].src; }
  function dim(i) { return M.dims[i]; }
  function sgn(v, dp) { var r = v.toFixed(dp === undefined ? 1 : dp); return (v > 0 ? '+' : '') + r; }
  function pct(v) { return Math.round(v * 100) + '%'; }
  function cls(v, t) { t = t || 0.3; return v > t ? 'good' : v < -t ? 'bad' : ''; }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 3200); }

  /* ---------- persistence ---------- */
  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({ pid: A.pid, tab: A.tab, mode: A.mode, horizon: A.horizon, live: A.live, sigOff: A.sigOff, own: A.own, play: A.play, custom: A.custom, theme: A.theme, opp: A.opp }));
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
    C = E.compile(m);
    replay();
  }
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

  function recs() {
    if (!cache.rec) {
      cache.rec = E.recommend(C, S, A.pid, { horizon: 3, mode: A.mode });
      var hold = cache.rec.filter(function (r) { return r.m.hold; })[0];
      cache.rec.forEach(function (r) { r.rel = r.gain - (hold ? hold.gain : 0); });
    }
    return cache.rec;
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

  /* Every page opens with what it shows and how to use it. */
  function intro(title, lead, steps) {
    return '<section class="card intro"><h1>' + title + '</h1><p class="lead">' + lead + '</p>' +
      (steps ? '<details class="explain" open><summary>How to use this page</summary><ol class="list">' + steps.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol></details>' : '') + '</section>';
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
        '<div class="track"><span class="fill" style="width:' + v + '%"></span>' + gh + (ideal !== null && C.players[pid].w[i] > 0.02 ? '<span class="ideal" style="left:' + ideal + '%" title="Your ideal point"></span>' : '') + '</div>' +
        '<div class="ends"><span>' + esc(d.lo) + '</span><span>' + esc(d.hi) + '</span></div></div>';
    }).join('') + '</div>';
  }

  function fxChips(m) {
    var out = m.fx.map(function (f) { return '<span class="' + (f[1] > 0 ? 'up' : 'down') + '">' + esc(dim(f[0]).short || dim(f[0]).name) + ' ' + sgn(f[1], 0) + '</span>'; });
    return '<div class="fx">' + out.join('') + '</div>';
  }

  function stance(a) { return a > 0.25 ? 'ally' : a < -0.25 ? 'opp' : 'swing'; }
  var STANCE = { ally: 'With you', opp: 'Against you', swing: 'Swing' };

  function spark(series, color) {
    if (!series || series.length < 2) return '';
    var mn = Math.min.apply(null, series), mx = Math.max.apply(null, series), r = mx - mn || 1;
    var pts = series.map(function (v, i) { return (i / (series.length - 1) * 100).toFixed(1) + ',' + (40 - (v - mn) / r * 36 - 2).toFixed(1); }).join(' ');
    return '<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
  }

  /* ---------- header / tabs ---------- */
  function chrome() {
    $('#who').textContent = A.pid ? 'Deciding as: ' + P(A.pid).name : 'Decision support for every stakeholder';
    $('#tabs').innerHTML = A.pid ? TABS.map(function (t) {
      return '<button data-a="tab" data-v="' + t[0] + '"' + (A.tab === t[0] ? ' aria-current="page"' : '') + '><i>' + t[1] + '</i>' + t[2] + '</button>';
    }).join('') : '';
    $('#tabs').style.display = A.pid ? '' : 'none';
    net(); navButtons();
  }
  function net() {
    var d = L.get(), el = $('#net'), on = navigator.onLine !== false;
    var age = d && d.t ? Math.round((Date.now() - d.t) / 60000) : null;
    var a = age === null ? 'no live data yet' : age < 1 ? 'data: just now' : age < 60 ? 'data: ' + age + ' min ago' : age < 2880 ? 'data: ' + Math.round(age / 60) + ' h ago' : 'data: ' + Math.round(age / 1440) + ' d ago';
    el.textContent = (L.busy ? 'Updating… ' : on ? 'Online · ' : 'Offline · ') + (L.busy ? '' : a);
    el.className = 'pill' + (on ? '' : ' off');
  }

  /* ---------- views ---------- */
  function viewPick() {
    return '<section class="card"><h1>Who are you deciding for?</h1>' +
      '<p class="lead">Every stakeholder in the Cyprus question is a player on the same board. Pick your seat. The board then shows your options, predicts how each other player is likely to answer, and points to the strongest sustainable path.</p>' +
      '<div class="grid pick">' + M.players.map(function (p) {
        return '<button class="pcard" style="--c:' + p.color + '" data-a="pick" data-v="' + p.id + '"><b>' + esc(p.name) + '</b><span>' + esc(p.role) + '</span></button>';
      }).join('') + '</div></section>' +
      '<section class="card"><h2>How it works</h2><ol class="list">' +
      '<li><b>Position.</b> Ten measurable dimensions describe where the Cyprus question stands today, from troop presence to energy cooperation. Live news and economic data nudge the starting position.</li>' +
      '<li><b>Players.</b> Ten stakeholders each have an ideal position and care about the dimensions to different degrees. That is all the model needs to compute who gains and who loses from any change.</li>' +
      '<li><b>Moves.</b> You choose a move. Then either the computer plays the other nine stakeholders, each answering with the reply that serves it best, as a chess program would; or you switch to manual mode and choose their moves yourself.</li>' +
      '<li><b>Result.</b> You see each predicted reply with its probability, the new position, every player\'s gain or loss, a SWOT and risk analysis, and the best path several rounds ahead.</li></ol>' +
      '<p class="help">Predictions are model-based forecasts with stated assumptions, not certainties. Every assumption is open to inspection and adjustment under Library → Assumptions.</p></section>';
  }

  function viewBoard() {
    var x = S.x, u = E.utilities(C, x), al = E.alignment(C, x, A.pid), o = outcomeOf(x), R = recs();
    var sel = A.sel ? recFor(A.sel) : null, ghost = sel ? (A.play === 'manual' ? E.round(C, S, A.pid, sel.m.id, { deep: true, forced: forcedMap() }).after : sel.first.after) : null;
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

    var h = intro('The board', 'You are playing <b>' + esc(P(A.pid).name) + '</b>. This page shows where the Cyprus question stands, who is with you and against you, and every move open to you. Each round stands for roughly six months.', [
      'Read <b>Current position</b> and <b>The position</b>: ten bars describe the situation today; the ▼ on each bar is where you would like it to be.',
      'Choose under <b>Who plays the other stakeholders?</b> whether the computer answers for them or you pick their moves yourself.',
      'Under <b>Your move</b>, tap any move to preview it: what it does, how the others answer, and who gains or loses.',
      'Press <b>Play this move</b> to commit. The board advances one round and the <b>Game record</b> keeps the history. <b>Undo</b> takes a round back.']) +
      '<div class="status"><section class="card"><div class="outcome"><div class="badge" style="color:' + o.color + '">' + o.icon + '</div><div>' +
      '<span class="tag">Round ' + (S.round + 1) + ' · current position</span><h2 style="margin:.15em 0">' + esc(o.name) + '</h2><span class="help">' + esc(o.desc) + '</span></div></div>' +
      '<div style="margin-top:12px"><div class="row between help"><span>Coalition weight with you <b class="num">' + pct(bal) + '</b></span><span>Your payoff <b class="num">' + u[A.pid].toFixed(0) + '</b>/100</span></div>' +
      '<div class="evalbar" role="img" aria-label="Balance of power between your coalition and opponents"><i style="width:' + (bal * 100) + '%"></i></div></div>' +
      '<h3 style="margin-top:14px">The other players, as they stand toward you now</h3><div class="chips">' +
      C.order.filter(function (q) { return q !== A.pid; }).sort(function (a, b) { return al[b] - al[a]; }).map(function (q) {
        var st = stance(al[q]);
        return '<button class="chip ' + st + '" style="--c:' + P(q).color + '" data-a="player" data-v="' + q + '" title="Payoff ' + u[q].toFixed(0) + '/100"><i>' + esc(P(q).short) + '</i>' + esc(P(q).name) + ' <em>' + STANCE[st] + '</em></button>';
      }).join('') + '</div>' +
      '<details class="explain"><summary>How "with you / against you" is worked out</summary>Each player wants the position to move in a particular direction. If that direction overlaps with yours, they are with you on the present board; if it runs opposite, they are against you. It changes as the position changes — today\'s opponent can become tomorrow\'s partner once the trade-offs shift.</details></section>' +
      '<section class="card"><div class="row between"><h2>The position</h2><span class="help">▼ = your ideal' + (ghost ? ' · coloured band = after this round' : '') + '</span></div><p class="help">Ten measures of the Cyprus question, each scored 0–100 between the two descriptions under its bar. The facts behind today\'s scores are listed under Library → Assumptions.</p>' + gauges(x, ghost, A.pid) + '</section></div>';

    h += '<section class="card"><h2>Who plays the other stakeholders?</h2><div class="seg" role="group" aria-label="Who plays the other stakeholders">' +
      '<button data-a="playmode" data-v="auto" aria-pressed="' + (A.play === 'auto') + '">Computer plays them</button><button data-a="playmode" data-v="manual" aria-pressed="' + (A.play === 'manual') + '">I choose their moves</button></div>' +
      '<p class="help" style="margin-top:8px">' + (A.play === 'auto' ? '<b>Computer mode.</b> After your move, the app plays the other nine stakeholders: each answers with the reply that serves its own interests best, and you see the probability of each reply. Use this to find out what is likely to happen.' :
        '<b>Manual mode.</b> After your move, you decide what each of the other nine stakeholders does. Nothing is predicted for you; every stakeholder starts on "Hold position" until you choose otherwise. Use this to test a "what if", replay real events, or play with other people around a table.') + '</p></section>';

    h += '<section class="card"><div class="row between"><h2>Your move</h2><div class="seg" role="group" aria-label="Objective">' +
      Object.keys(MODES).map(function (k) { return '<button data-a="mode" data-v="' + k + '" aria-pressed="' + (A.mode === k) + '" title="' + esc(MODES[k][1]) + '">' + MODES[k][0] + '</button>'; }).join('') + '</div></div>' +
      '<p class="help">' + esc(MODES[A.mode][1]) + ' Each score is how much better (+) or worse (−) than simply waiting the move leaves you, three rounds on, once every other player has answered with their best replies.' + (A.play === 'manual' ? ' In manual mode these scores remain the computer\'s estimate, for guidance only.' : '') + '</p>';
    if (best) h += '<p><span class="tag good">Engine\'s choice</span> <b>' + esc(best.m.src.name) + '</b> — ' + (best.m.hold ? 'no available move beats waiting this round.' : sgn(best.rel, 2) + ' better than waiting, after the other players reply.') + '</p>';
    h += '<div class="filter" role="group" aria-label="Filter moves">' + cats.map(function (c) { return '<button data-a="cat" data-v="' + c + '" aria-pressed="' + (A.cat === c) + '">' + (c === 'all' ? 'All' : esc(M.cats[c])) + '</button>'; }).join('') + '</div>' +
      '<div class="moves" style="margin-top:8px">' + R.filter(function (r) { return A.cat === 'all' || r.m.src.cat === A.cat || r.m.hold; }).map(function (r, i) {
        var w = Math.abs(r.rel) / maxGain * 100;
        return '<button class="mv' + (r === best ? ' best' : '') + (A.sel === r.m.id ? ' sel' : '') + '" data-a="sel" data-v="' + r.m.id + '"><b>' + esc(r.m.src.name) + '</b><span class="sc ' + cls(r.rel, 0.05) + '">' + (r.m.hold ? 'baseline' : sgn(r.rel, 2)) + '</span>' +
          '<span class="sub">' + (r.m.hold ? '' : esc(M.cats[r.m.src.cat] || '') + ' · success ' + pct(r.m.ps) + ' · ') + esc(r.m.src.desc.split('. ')[0].replace(/\.$/, '')) + '.</span>' +
          '<span class="bar"><i style="width:' + w + '%;background:var(--' + (r.rel >= 0 ? 'good' : 'bad') + ')"></i></span></button>';
      }).join('') + '</div>';
    if (locked.length) h += '<details class="explain" style="margin-top:10px"><summary>' + locked.length + ' move' + (locked.length > 1 ? 's' : '') + ' not available yet</summary><div class="moves" style="margin-top:8px">' + locked.map(function (m) {
      return '<div class="mv locked"><b>' + esc(m.src.name) + '</b><span class="tag">' + esc(E.blocked(C, S, m)) + '</span><span class="sub">' + esc(m.src.desc) + '</span></div>';
    }).join('') + '</div></details>';
    h += '</section>';

    h += '<section class="card"><div class="row between"><h2>Game record</h2><div class="row"><button class="btn small" data-a="undo"' + (stack.length ? '' : ' disabled') + '>Undo round</button><button class="btn small" data-a="reset"' + (stack.length ? '' : ' disabled') + '>New game</button><button class="btn small" data-a="share">Share</button></div></div>';
    h += stack.length ? '<ol class="history">' + stack.map(function (s) {
      var r = s.r, acts = r.replies.filter(function (y) { return !y.chosen.m.hold; });
      return '<li>' + (r.manual ? '<span class="tag info">manual</span> ' : '') + '<b>' + esc(P(A.pid).short) + ': ' + esc(r.move.src.name) + '</b> → ' + (acts.length ? acts.map(function (y) { return esc(P(y.pid).short) + ': ' + esc(y.chosen.m.src.name); }).join(' · ') : 'all others hold') +
        ' <span class="tag" style="color:' + outcomeOf(r.after).color + '">' + esc(outcomeOf(r.after).name) + '</span></li>';
    }).join('') + '</ol>' : '<p class="help">No moves played yet. Select a move above to preview the predicted replies, then play it to advance the board one round (roughly six months).</p>';
    return h + '</section>';
  }

  /* ---------- move detail ---------- */
  function replyImpact(y) { return E.utility(C, A.pid, y.after) - E.utility(C, A.pid, y.before); }

  function viewSheet() {
    var rec = A.sel && A.tab === 'board' ? recFor(A.sel) : null;
    if (!rec) { sheet.className = 'sheet'; sheet.innerHTML = ''; document.body.classList.remove('has-sheet'); return; }
    var man = A.play === 'manual', m = rec.m, r = man ? E.round(C, S, A.pid, m.id, { deep: true, forced: forcedMap() }) : rec.first;
    var u0 = E.utilities(C, S.x), u1 = E.utilities(C, r.after), al = E.alignment(C, S.x, A.pid), o = outcomeOf(r.after), avail = {};
    if (man) C.order.forEach(function (q) { avail[q] = E.available(C, S, q); });
    var h = '<div class="shead"><div><span class="tag">' + (m.hold ? 'Wait' : esc(M.cats[m.src.cat] || '')) + '</span><h2 style="margin:.2em 0 0">' + esc(m.src.name) + '</h2></div><button class="btn small" data-a="close" aria-label="Close">✕</button></div>';
    h += '<section class="card"><p>' + esc(m.src.desc) + '</p>' + (m.hold ? '' : '<p class="help">Direct effect of the move on the position, before anyone replies:</p>') + fxChips(m) +
      (m.hold ? '' : '<p class="help" style="margin-top:8px">Chance it works as intended: <b>' + pct(m.ps) + '</b> · political cost to you: <b>' + (m.src.cost || 0) + '</b>/10' + (m.src.src ? ' · source: ' + esc(m.src.src) : '') + '</p>') +
      (m.src.commitNote ? '<p class="help"><b>Commitment:</b> ' + esc(m.src.commitNote) + '</p>' : '') + (man ? '' : verdict(rec)) + '</section>';

    if (man) h += '<section class="card"><h3>Choose each stakeholder\'s reply</h3><p class="help">Manual mode: you decide what every other player does this round. The tag shows what each choice does to your payoff. Pick "Let the computer choose" for any player you would rather leave to the app.</p>' + r.replies.map(function (y) {
      var imp = replyImpact(y), cur = A.manual[y.pid] === 'auto' ? 'auto' : y.chosen.m.id;
      return '<div class="reply"><span class="av" style="--c:' + P(y.pid).color + '">' + esc(P(y.pid).short) + '</span><div><label><b>' + esc(P(y.pid).name) + '</b><br><select data-c="man" data-v="' + y.pid + '" style="width:100%;margin-top:4px">' +
        avail[y.pid].map(function (k) { return '<option value="' + k.id + '"' + (cur === k.id ? ' selected' : '') + '>' + esc(k.src.name) + '</option>'; }).join('') +
        '<option value="auto"' + (cur === 'auto' ? ' selected' : '') + '>Let the computer choose' + (cur === 'auto' ? ' (' + esc(y.chosen.m.src.name) + ')' : '') + '</option></select></label></div>' +
        '<span class="tag ' + (imp > 0.3 ? 'good' : imp < -0.3 ? 'bad' : '') + '">' + (imp > 0.3 ? 'helps ' + sgn(imp) : imp < -0.3 ? 'hurts ' + sgn(imp) : 'neutral') + '</span></div>';
    }).join('') + '</section>';
    else h += '<section class="card"><h3>Predicted replies, in order of play</h3><p class="help">Computer mode: the app plays the other stakeholders. The percentage is the model\'s probability that the player picks that reply over its alternatives.</p>' + r.replies.map(function (y) {
      var imp = replyImpact(y), alt = y.ranked.filter(function (k) { return k !== y.chosen; }).slice(0, 2);
      return '<div class="reply"><span class="av" style="--c:' + P(y.pid).color + '">' + esc(P(y.pid).short) + '</span><div><b>' + esc(y.chosen.m.src.name) + '</b> <span class="tag ' + (imp > 0.3 ? 'good' : imp < -0.3 ? 'bad' : '') + '">' + (imp > 0.3 ? 'helps you ' + sgn(imp) : imp < -0.3 ? 'hurts you ' + sgn(imp) : 'neutral') + '</span><br><span class="help">' + esc(P(y.pid).name) + ' · ' + STANCE[stance(al[y.pid])].toLowerCase() + '</span></div><span class="pr">' + pct(y.chosen.p) + '</span>' +
        (alt.length ? '<span class="alt">Otherwise: ' + alt.map(function (k) { return esc(k.m.src.name) + ' (' + pct(k.p) + ')'; }).join(' · ') + '</span>' : '') + '</div>';
    }).join('') + '</section>';

    h += '<section class="card"><h3>Result of all moves together</h3><p class="help">The position after your move and all nine replies, and what it does to each stakeholder.</p><p><span class="tag" style="color:' + o.color + '">' + o.icon + ' ' + esc(o.name) + '</span> ' + esc(o.desc) + '</p>' +
      '<div class="pay">' + C.order.map(function (q) {
        var d = u1[q] - u0[q], w = Math.min(50, Math.abs(d) * 5);
        return '<span>' + (q === A.pid ? '<b>' + esc(P(q).name) + '</b>' : esc(P(q).name)) + '</span><span class="pb"><i style="' + (d >= 0 ? 'left:50%' : 'right:50%') + ';width:' + w + '%;background:var(--' + (d >= 0 ? 'good' : 'bad') + ')"></i></span><b class="num ' + cls(d) + '">' + sgn(d) + '</b>';
      }).join('') + '</div><p class="help" style="margin-top:8px">Change in each player\'s payoff (0–100 scale) once every reply is in.</p></section>';
    h += '<div class="sfoot"><button class="btn" data-a="analyse">Full analysis</button><button class="btn accent" data-a="play">Play this move</button></div>';
    sheet.innerHTML = h; sheet.className = 'sheet open'; document.body.classList.add('has-sheet');
  }

  function verdict(rec) {
    var r = rec.first, d = E.utility(C, A.pid, r.after) - E.utility(C, A.pid, S.x), best = recs()[0];
    var hurt = r.replies.filter(function (y) { return replyImpact(y) < -0.3; }), help = r.replies.filter(function (y) { return replyImpact(y) > 0.3; });
    var losers = C.order.filter(function (q) { return q !== A.pid && C.players[q].veto && E.utility(C, q, r.after) < E.utility(C, q, S.x) - 1; });
    var t = '<p style="margin-top:10px"><b>Reading:</b> ';
    t += rec === best ? 'This is the engine\'s first choice under the "' + MODES[A.mode][0] + '" objective. ' : 'The engine prefers <b>' + esc(best.m.src.name) + '</b> (' + sgn(best.rel, 2) + ' against ' + sgn(rec.rel, 2) + ' here, compared with waiting). ';
    t += 'With every reply counted, your payoff after one round changes by <b class="' + cls(d) + '">' + sgn(d) + '</b>; three rounds out the line is worth <b class="' + cls(rec.rel, 0.05) + '">' + sgn(rec.rel, 2) + '</b> against waiting. ';
    if (hurt.length) t += 'Expect push-back from ' + hurt.map(function (y) { return esc(P(y.pid).name); }).join(', ') + '. ';
    if (help.length) t += 'Support is likely from ' + help.map(function (y) { return esc(P(y.pid).name); }).join(', ') + '. ';
    if (losers.length) t += '<span class="warn">Sustainability warning: ' + losers.map(function (q) { return esc(P(q).name); }).join(' and ') + ' can block a settlement and end' + (losers.length > 1 ? '' : 's') + ' this round worse off, so expect resistance later.</span>';
    return t + '</p>';
  }

  /* ---------- best path ---------- */
  function viewPath() {
    if (!cache.path) {
      setTimeout(function () {
        var p = E.path(C, S, A.pid, { horizon: A.horizon, mode: A.mode });
        var dn = E.doNothing(C, S, A.pid, A.horizon);
        var first = p.steps[0] ? p.steps[0].move.id : null;
        cache.path = { p: p, dn: dn, mc: E.monteCarlo(C, S, A.pid, first, { horizon: A.horizon, mode: A.mode, runs: 240 }), mc0: E.monteCarlo(C, S, A.pid, A.pid + '.hold', { horizon: A.horizon, mode: A.mode, runs: 240, seed: 9, holdOnly: true }) };
        if (A.tab === 'path') render();
      }, 30);
      return '<p class="loading">Searching ' + A.horizon + ' rounds ahead…</p>';
    }
    var k = cache.path, p = k.p, u0 = E.utility(C, A.pid, S.x), uE = E.utility(C, A.pid, p.s.x), uN = E.utility(C, A.pid, k.dn.s.x);
    var h = intro('Best path', 'The strongest sequence of moves the computer can find for <b>' + esc(P(A.pid).name) + '</b>, looking several rounds ahead with the app playing every other stakeholder. It is the critical path: the order matters, because early moves open later ones.', [
      'Choose what to optimise: your own payoff, a sustainable outcome, or the collective good.',
      'Choose how many rounds to look ahead (one round is about six months).',
      'Read the steps in order. Each shows your move, the replies the computer predicts, and where the position stands afterwards.',
      'Compare with <b>if you only wait</b>, then check the <b>odds</b> to see how the path fares when things go wrong.',
      'Press <b>Play step 1</b> to take the first move onto the board.']) +
      '<section class="card"><div class="row between"><h2>Settings and headline result</h2></div>' +
      '<div class="row" style="margin:8px 0"><div class="seg" role="group" aria-label="Objective">' + Object.keys(MODES).map(function (m) { return '<button data-a="mode" data-v="' + m + '" aria-pressed="' + (A.mode === m) + '">' + MODES[m][0] + '</button>'; }).join('') + '</div>' +
      '<label class="help">Rounds ahead <select data-c="horizon">' + [3, 4, 6, 8, 10].map(function (n) { return '<option' + (n === A.horizon ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="help">' + esc(MODES[A.mode][1]) + ' One round is roughly six months. The search keeps the three most promising lines alive at every step and assumes each other player answers with its own best reply.</p>' +
      '<div class="kv"><div><b>' + u0.toFixed(0) + '</b><span>your payoff today</span></div><div><b class="' + cls(uE - u0) + '">' + uE.toFixed(0) + '</b><span>on the best path (' + sgn(uE - u0) + ')</span></div><div><b class="' + cls(uN - u0) + '">' + uN.toFixed(0) + '</b><span>if you only wait (' + sgn(uN - u0) + ')</span></div><div><b style="color:' + outcomeOf(p.s.x).color + ';font-size:1rem">' + esc(outcomeOf(p.s.x).name) + '</b><span>where the path leads</span></div></div></section>';

    h += '<section class="card"><h2>Critical path, step by step</h2><p class="help">Your recommended moves in order. Replies in green help you, in red hurt you; the percentage is how likely the computer thinks each reply is.</p><ol class="steps">' + p.steps.map(function (r, i) {
      var acts = r.replies.filter(function (y) { return !y.chosen.m.hold; }), o = outcomeOf(r.after), du = E.utility(C, A.pid, r.after) - E.utility(C, A.pid, r.before);
      return '<li><b>' + esc(r.move.src.name) + '</b> <span class="tag">' + (r.move.hold ? 'wait' : pct(r.move.ps) + ' success') + '</span><br><span class="help">' + esc(r.move.src.desc) + '</span>' +
        '<div style="margin:6px 0;font-size:.86rem">' + (acts.length ? '<b>Predicted replies:</b> ' + acts.map(function (y) { var im = E.utility(C, A.pid, y.after) - E.utility(C, A.pid, y.before); return '<span class="' + cls(im) + '">' + esc(P(y.pid).short) + ' — ' + esc(y.chosen.m.src.name) + ' (' + pct(y.chosen.p) + ')</span>'; }).join('; ') : 'All other players hold.') + '</div>' +
        '<span class="tag" style="color:' + o.color + '">' + o.icon + ' ' + esc(o.name) + '</span> <span class="num ' + cls(du) + '">your payoff ' + sgn(du) + '</span></li>';
    }).join('') + '</ol>' + (p.steps[0] && !p.steps[0].move.hold ? '<button class="btn accent" data-a="playfirst">Play step 1 on the board</button>' : '') + '</section>';

    h += '<section class="card"><h2>Where the position ends up</h2><p class="help">Start (blue bar) to end of the best path (coloured band). ▼ marks your ideal.</p>' + gauges(S.x, p.s.x, A.pid) + '</section>';

    function odds(mc) {
      var keys = Object.keys(M.outcomes).filter(function (o) { return mc.odds[o]; });
      return '<div class="stack">' + keys.map(function (o) { return '<i style="width:' + mc.odds[o] * 100 + '%;background:' + M.outcomes[o].color + '" title="' + esc(M.outcomes[o].name) + ' ' + pct(mc.odds[o]) + '"></i>'; }).join('') + '</div><div class="legend">' +
        keys.sort(function (a, b) { return mc.odds[b] - mc.odds[a]; }).map(function (o) { return '<span><i style="background:' + M.outcomes[o].color + '"></i>' + esc(M.outcomes[o].name) + ' <b class="num">' + pct(mc.odds[o]) + '</b></span>'; }).join('') + '</div>';
    }
    h += '<section class="card"><h2>Odds, allowing for surprises</h2><p class="help">' + k.mc.runs + ' simulated futures over ' + k.mc.horizon + ' rounds. In each one, moves can fail and players sometimes pick their second or third choice, in proportion to how close the options are.</p>' +
      '<h3>Following the best path</h3>' + odds(k.mc) + '<p class="help num">Your payoff: pessimistic ' + k.mc.p10.toFixed(0) + ' · typical ' + k.mc.p50.toFixed(0) + ' · optimistic ' + k.mc.p90.toFixed(0) + '</p>' +
      '<h3 style="margin-top:12px">If you only wait</h3>' + odds(k.mc0) + '<p class="help num">Your payoff: pessimistic ' + k.mc0.p10.toFixed(0) + ' · typical ' + k.mc0.p50.toFixed(0) + ' · optimistic ' + k.mc0.p90.toFixed(0) + '</p></section>';
    return h;
  }

  /* ---------- analysis ---------- */
  function swot(rec) {
    var p = P(A.pid), cp = C.players[A.pid], m = rec.m, r = rec.first, s = [], w = [], o = [], t = [];
    m.fx.forEach(function (f) {
      var i = f[0], toward = Math.abs(S.x[i] + f[1] - cp.ideal[i]) < Math.abs(S.x[i] - cp.ideal[i]);
      if (cp.w[i] < 0.03) return;
      (toward ? s : w).push('The move itself shifts <b>' + esc(dim(i).name) + '</b> by ' + sgn(f[1], 0) + ', ' + (toward ? 'toward' : 'away from') + ' your ideal.');
    });
    if (!m.hold && m.ps >= 0.75) s.push('High chance of working as intended (' + pct(m.ps) + ').');
    (p.leverage || []).slice(0, 3).forEach(function (l) { s.push(esc(l)); });
    if (!m.hold && m.ps < 0.65) w.push('Uncertain execution: ' + pct(1 - m.ps) + ' chance it fails' + (m.fail.length ? ', which would shift ' + m.fail.map(function (f) { return esc(dim(f[0]).name) + ' ' + sgn(f[1], 0); }).join(', ') : '') + '.');
    if (m.src.cost >= 3) w.push('Significant political or financial cost to you (' + m.src.cost + '/10).');
    (p.vuln || []).slice(0, 3).forEach(function (l) { w.push(esc(l)); });
    r.replies.forEach(function (y) {
      var im = replyImpact(y), nm = '<b>' + esc(P(y.pid).name) + '</b>';
      if (y.chosen.m.hold) return;
      if (im > 0.3) o.push(nm + ' is likely (' + pct(y.chosen.p) + ') to answer with "' + esc(y.chosen.m.src.name) + '", worth ' + sgn(im) + ' to you.');
      else if (im < -0.3) t.push(nm + ' is likely (' + pct(y.chosen.p) + ') to answer with "' + esc(y.chosen.m.src.name) + '", costing you ' + sgn(im) + '.');
      y.ranked.slice(1, 3).forEach(function (k) {
        if (k.p < 0.15 || k.m.hold) return;
        var after = E.apply(C, y.before, k.m, S.used, 'exp'), d = E.utility(C, A.pid, after) - E.utility(C, A.pid, y.before);
        if (d < -1) t.push('Less likely (' + pct(k.p) + '), ' + nm + ' could instead choose "' + esc(k.m.src.name) + '" (' + sgn(d) + ' for you).');
        if (d > 1) o.push('Less likely (' + pct(k.p) + '), ' + nm + ' could instead choose "' + esc(k.m.src.name) + '" (' + sgn(d) + ' for you).');
      });
    });
    var unlocked = [];
    C.order.forEach(function (q) { C.byPlayer[q].forEach(function (k) { if (E.blocked(C, S, k) && !E.blocked(C, r.state, k)) unlocked.push(esc(P(q).short) + ': ' + esc(k.src.name)); }); });
    if (unlocked.length) o.push('Opens moves that are closed today — ' + unlocked.slice(0, 5).join('; ') + '.');
    var al = E.alignment(C, r.after, A.pid), al0 = E.alignment(C, S.x, A.pid);
    C.order.forEach(function (q) {
      if (q === A.pid) return;
      if (stance(al0[q]) !== 'ally' && stance(al[q]) === 'ally') o.push('<b>' + esc(P(q).name) + '</b> moves into alignment with you after this round.');
      if (stance(al0[q]) !== 'opp' && stance(al[q]) === 'opp') t.push('<b>' + esc(P(q).name) + '</b> moves into opposition after this round.');
      if (C.players[q].veto && E.utility(C, q, r.after) < E.utility(C, q, S.x) - 1) t.push('<b>' + esc(P(q).name) + '</b> can block any settlement and ends the round worse off (' + sgn(E.utility(C, q, r.after) - E.utility(C, q, S.x)) + ') — a defection risk.');
    });
    var st = C.di.stability, ds = r.after[st] - S.x[st];
    if (ds < -3) t.push('Stability falls by ' + Math.abs(ds).toFixed(0) + ' points; miscalculation becomes more likely.');
    if (ds > 3) o.push('Stability rises by ' + ds.toFixed(0) + ' points, widening everyone\'s room for compromise.');
    if (rec.rel > 0.3) o.push('Three rounds out, the line that starts here is worth ' + sgn(rec.rel, 2) + ' more to you than waiting.');
    if (rec.rel < -0.3) t.push('Three rounds out, the line that starts here leaves you ' + sgn(rec.rel, 2) + ' against waiting.');
    function ul(a, none) { return '<ul>' + (a.length ? a.slice(0, 7).map(function (x) { return '<li>' + x + '</li>'; }).join('') : '<li class="mute">' + none + '</li>') + '</ul>'; }
    return '<div class="swot"><div class="s"><h3>Strengths <small>yours, helpful</small></h3>' + ul(s, 'No particular strength in play.') + '</div><div class="w"><h3>Weaknesses <small>yours, harmful</small></h3>' + ul(w, 'No notable weakness exposed.') + '</div>' +
      '<div class="o"><h3>Opportunities <small>from others</small></h3>' + ul(o, 'No supportive reply predicted this round.') + '</div><div class="t"><h3>Threats <small>from others</small></h3>' + ul(t, 'No hostile reply predicted this round.') + '</div></div>';
  }

  function risks(rec) {
    var r = rec.first, m = rec.m, rows = [];
    function rate(p, im) { var s = p * Math.min(10, Math.abs(im)); return s > 2.2 ? ['High', 'bad'] : s > 0.8 ? ['Medium', 'warn'] : ['Low', 'good']; }
    if (!m.hold && m.ps < 1) {
      var im = E.utility(C, A.pid, E.apply(C, S.x, m, S.used, 'fail')) - E.utility(C, A.pid, E.apply(C, S.x, m, S.used, 'ok'));
      rows.push(['Your move fails to deliver', 1 - m.ps, im, m.src.mit || 'Prepare the ground first: line up partners and a fallback before committing publicly.']);
    }
    r.replies.forEach(function (y) {
      y.ranked.slice(0, 3).forEach(function (k) {
        if (k.m.hold || k.p < 0.12) return;
        var d = E.utility(C, A.pid, E.apply(C, y.before, k.m, S.used, 'exp')) - E.utility(C, A.pid, y.before);
        if (d < -0.8) rows.push([esc(P(y.pid).name) + ': ' + esc(k.m.src.name), k.p, d, k.m.src.counter || 'Raise the cost or lower the benefit of this reply before you move; keep a channel open to ' + esc(P(y.pid).name) + '.']);
      });
    });
    rows.sort(function (a, b) { return b[1] * Math.abs(b[2]) - a[1] * Math.abs(a[2]); });
    if (!rows.length) return '<p class="help">No material risk identified for this move in the coming round.</p>';
    return '<div class="tblwrap"><table><thead><tr><th>Risk</th><th>Likelihood</th><th>Impact on you</th><th>Rating</th><th>Mitigation</th></tr></thead><tbody>' + rows.slice(0, 8).map(function (x) {
      var rt = rate(x[1], x[2]);
      return '<tr><td>' + x[0] + '</td><td class="c">' + pct(x[1]) + '</td><td class="c bad">' + sgn(x[2]) + '</td><td class="c"><span class="tag ' + rt[1] + '">' + rt[0] + '</span></td><td>' + x[3] + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  function lens(rec) {
    var r = rec.first, groups = {};
    M.dims.forEach(function (d, i) { (groups[d.lens] = groups[d.lens] || []).push(i); });
    return '<div class="tblwrap"><table><thead><tr><th>Lens</th><th>What changes this round</th></tr></thead><tbody>' + Object.keys(groups).map(function (g) {
      var parts = groups[g].map(function (i) { var d = r.after[i] - S.x[i]; return Math.abs(d) < 0.5 ? null : esc(dim(i).name) + ' <b class="num">' + sgn(d, 0) + '</b> (to ' + Math.round(r.after[i]) + ')'; }).filter(Boolean);
      return '<tr><th>' + esc(g) + '</th><td>' + (parts.length ? parts.join('; ') : '<span class="mute">No material change</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  function matrix() {
    var opp = A.opp && A.opp !== A.pid ? A.opp : (A.pid === 'TR' ? 'ROC' : 'TR');
    var mx = E.matrix(C, S, A.pid, opp, 5);
    function isNe(i, j) { return mx.ne.some(function (n) { return n[0] === i && n[1] === j; }); }
    var h = '<label class="help">Against <select data-c="opp">' + C.order.filter(function (q) { return q !== A.pid; }).map(function (q) { return '<option value="' + q + '"' + (q === opp ? ' selected' : '') + '>' + esc(P(q).name) + '</option>'; }).join('') + '</select></label>' +
      '<div class="tblwrap" style="margin-top:8px"><table><thead><tr><th>' + esc(P(A.pid).short) + ' ↓ / ' + esc(P(opp).short) + ' →</th>' + mx.B.map(function (b) { return '<th>' + esc(b.src.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      mx.A.map(function (a, i) { return '<tr><th>' + esc(a.src.name) + '</th>' + mx.cells[i].map(function (c, j) { return '<td class="c' + (isNe(i, j) ? ' ne' : '') + '">' + sgn(c.a - mx.base.a) + ' / ' + sgn(c.b - mx.base.b) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    h += '<p class="help">Each cell: your payoff change / theirs, if both play those moves and nobody else acts. ';
    h += mx.ne.length ? 'Highlighted: ' + (mx.ne.length > 1 ? 'equilibria' : 'the equilibrium') + ' — neither side can do better by switching alone (' + mx.ne.map(function (n) { return '"' + esc(mx.A[n[0]].src.name) + '" against "' + esc(mx.B[n[1]].src.name) + '"'; }).join('; ') + '). ' : 'No pure-strategy equilibrium among these options: each side keeps wanting to switch, so expect manoeuvring. ';
    if (mx.domA >= 0) h += 'Your dominant option: "' + esc(mx.A[mx.domA].src.name) + '" is at least as good whatever they do. ';
    if (mx.domB >= 0) h += 'Their dominant option: "' + esc(mx.B[mx.domB].src.name) + '".';
    return h + '</p>';
  }

  function map() {
    var al = E.alignment(C, S.x, A.pid), W = 320, H = 220;
    var pts = C.order.filter(function (q) { return q !== A.pid; }).map(function (q) {
      var x = 30 + (al[q] + 1) / 2 * (W - 50), y = H - 26 - C.players[q].power / 100 * (H - 46);
      return '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="11" fill="' + P(q).color + '"/><text x="' + x.toFixed(0) + '" y="' + (y + 3).toFixed(0) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">' + esc(P(q).short) + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:560px;height:auto" role="img" aria-label="Stakeholder map: power against alignment with you">' +
      '<rect x="30" y="10" width="' + (W - 50) / 2 + '" height="' + (H - 36) + '" fill="var(--opp)" opacity=".08"/><rect x="' + (30 + (W - 50) / 2) + '" y="10" width="' + (W - 50) / 2 + '" height="' + (H - 36) + '" fill="var(--ally)" opacity=".08"/>' +
      '<line x1="30" y1="' + (H - 26) + '" x2="' + (W - 20) + '" y2="' + (H - 26) + '" stroke="var(--mute)"/><line x1="30" y1="10" x2="30" y2="' + (H - 26) + '" stroke="var(--mute)"/>' +
      '<text x="34" y="' + (H - 8) + '" font-size="9" fill="var(--mute)">against you</text><text x="' + (W - 22) + '" y="' + (H - 8) + '" font-size="9" fill="var(--mute)" text-anchor="end">with you</text>' +
      '<text x="12" y="18" font-size="9" fill="var(--mute)" transform="rotate(-90 12 18)" text-anchor="end">more power ↑</text>' + pts + '</svg>' +
      '<p class="help">Upper right: strong partners — keep them close. Upper left: strong opponents — the players whose incentives you must change. Lower half: weaker voices that still shape legitimacy.</p>';
  }

  function sens() {
    if (!cache.sens) {
      setTimeout(function () { cache.sens = E.sensitivity(C, S, A.pid, { mode: A.mode, runs: 24 }); if (A.tab === 'analysis') render(); }, 60);
      return '<p class="loading">Stress-testing the recommendation…</p>';
    }
    var s = cache.sens, top = C.moves[s.top], others = Object.keys(s.wins).filter(function (k) { return k !== s.top; }).sort(function (a, b) { return s.wins[b] - s.wins[a]; });
    var span = Math.max.apply(null, s.tornado.map(function (t) { return Math.max(Math.abs(t.lo - s.baseScore), Math.abs(t.hi - s.baseScore)); }).concat([0.5]));
    var h = '<p>With every weight, ideal point and move effect randomly disturbed (' + s.runs + ' trials), "<b>' + esc(top.src.name) + '</b>" stays the top move in <b class="' + (s.robustness >= 0.6 ? 'good' : s.robustness >= 0.35 ? 'warn' : 'bad') + '">' + pct(s.robustness) + '</b> of them. ' +
      (s.robustness >= 0.6 ? 'The recommendation is robust.' : s.robustness >= 0.35 ? 'The recommendation is fairly sensitive to assumptions; weigh the alternatives.' : 'The recommendation is fragile — several moves are close. Treat it as one good option, not the answer.') + '</p>';
    if (others.length) h += '<p class="help">Challengers: ' + others.slice(0, 3).map(function (k) { return esc(C.moves[k].src.name) + ' (' + pct(s.wins[k] / s.runs) + ')'; }).join(' · ') + '</p>';
    h += '<h3>Which starting conditions matter most</h3><div class="torn">' + s.tornado.slice().sort(function (a, b) { return Math.abs(b.hi - b.lo) - Math.abs(a.hi - a.lo); }).map(function (t) {
      var a = (t.lo - s.baseScore) / span * 50, b = (t.hi - s.baseScore) / span * 50, d = M.dims[C.di[t.dim]];
      function seg(v, col) { return '<i style="' + (v >= 0 ? 'left:50%' : 'right:50%') + ';width:' + Math.abs(v) + '%;background:var(--' + col + ')"></i>'; }
      return '<span>' + esc(d.name) + '</span><span class="tb">' + seg(a, 'warn') + seg(b, 'info') + '</span><span class="num help">' + sgn(t.lo - s.baseScore) + ' / ' + sgn(t.hi - s.baseScore) + '</span>';
    }).join('') + '</div><p class="help">Effect on your best achievable score if each dimension started 15 points lower (amber) or higher (blue).</p>';
    return h;
  }

  function precedents(m) {
    var ids = m.src.prec || [], list = M.precedents.filter(function (p) { return ids.indexOf(p.id) >= 0; });
    if (!list.length) list = M.precedents.filter(function (p) { return (p.cats || []).indexOf(m.src.cat) >= 0; }).slice(0, 3);
    if (!list.length) return '';
    return '<section class="card"><h2>What history says about moves like this</h2><p class="help">Real past attempts that resemble this move, on Cyprus or elsewhere, with how they ended and the lesson. Tap one to open it.</p>' + list.map(precItem).join('') + '</section>';
  }
  function precItem(p) {
    var w = (L.get() || {}).wiki || {}, x = w[p.wiki];
    return '<details class="lib-item"><summary>' + esc(p.name) + ' <span class="tag ' + (p.outcome === 'success' ? 'good' : p.outcome === 'failure' ? 'bad' : 'warn') + '">' + esc(p.outcome) + '</span> <span class="meta">' + esc(p.year) + '</span></summary><p><b>Lesson:</b> ' + esc(p.lesson) + '</p>' +
      (x ? '<p class="help">' + esc(x.extract) + ' <a href="' + esc(x.url) + '" target="_blank" rel="noopener">Wikipedia</a></p>' : '') + '</details>';
  }

  function viewAnalysis() {
    var R = recs(), rec = (A.sel && recFor(A.sel)) || R[0];
    var h = intro('Analysis', 'A full assessment of one move for <b>' + esc(P(A.pid).name) + '</b> in the current position: strengths and weaknesses, risks, how it plays against a chosen opponent, who holds power, and how far the advice can be trusted. All of it is calculated with the computer playing the other stakeholders.', [
      'Pick the move to analyse in the first box (it starts on the move you selected on the board, or the engine\'s choice).',
      'Read each section from top to bottom; every section begins with a line saying what it shows.',
      'Use <b>Print / save PDF</b> to keep or share the assessment.']) +
      '<section class="card"><div class="row between"><h2>Move under analysis</h2><button class="btn small" data-a="print">Print / save PDF</button></div>' +
      '<label class="help">Move under analysis <select data-c="sel">' + R.map(function (r) { return '<option value="' + r.m.id + '"' + (r === rec ? ' selected' : '') + '>' + esc(r.m.src.name) + ' (' + sgn(r.rel, 2) + ')</option>'; }).join('') + '</select></label>' +
      '<p style="margin-top:8px">' + esc(rec.m.src.desc) + '</p>' + verdict(rec) + '</section>';
    h += '<section class="card"><h2>SWOT for ' + esc(P(A.pid).name) + '</h2><p class="help">Generated from this exact position: your own leverage and exposure, plus what the other players are predicted to do in reply.</p>' + swot(rec) + '</section>';
    h += '<section class="card"><h2>Risk register</h2><p class="help">What could go wrong with this move in the coming round, how likely it is, how much it would cost you, and what to do about it.</p>' + risks(rec) + '</section>';
    h += '<section class="card"><h2>Head-to-head payoff matrix</h2><p class="help">The classic game-theory table: your five strongest options against one opponent\'s five strongest. Choose the opponent below.</p>' + matrix() + '</section>';
    h += '<div class="grid two"><section class="card"><h2>Stakeholder map</h2><p class="help">Every other stakeholder placed by how much power it has (height) and whether it currently pulls with you or against you (left to right).</p>' + map() + '</section><section class="card"><h2>How sure is the recommendation?</h2><p class="help">A stress test. The model\'s assumptions are judgments, so this re-runs the advice many times with those judgments deliberately disturbed.</p>' + sens() + '</section></div>';
    h += '<section class="card"><h2>Political, security, economic, energy, legal and social lens</h2><p class="help">The same result sorted by field, so a specialist in any one area can see what changes for them after this round.</p>' + lens(rec) + '</section>';
    h += precedents(rec.m);
    return h;
  }

  /* ---------- live ---------- */
  function viewLive() {
    var d = L.get() || {}, st = d.status || {};
    var h = intro('Live intelligence', 'Real, current data from public sources, so the board starts from today\'s situation rather than a fixed snapshot. Your device fetches it directly whenever the app is open and online, and keeps the last copy for offline use.', [
      '<b>Sources</b> shows where each kind of data comes from and whether the last fetch worked.',
      '<b>Signals feeding the model</b> shows exactly how the data nudges the starting position. Untick any signal you do not want used.',
      'The charts, table and headlines below are the raw material, for your own reading.']) +
      '<section class="card"><div class="row between"><h2>Sources</h2><button class="btn accent small" data-a="refresh"' + (L.busy ? ' disabled' : '') + '>' + (L.busy ? 'Updating…' : 'Refresh now') + '</button></div>' +
      '<p class="help">Nothing passes through a private server: this device asks each source directly.</p>' +
      '<div class="tblwrap"><table><thead><tr><th>Source</th><th>Provides</th><th>Status</th></tr></thead><tbody>' + L.sources.map(function (s) {
        var x = st[s.id];
        return '<tr><td><a href="' + s.url + '" target="_blank" rel="noopener">' + esc(s.name) + '</a></td><td>' + esc(s.what) + '</td><td>' + (!x ? '<span class="tag">not yet fetched</span>' : x.ok ? '<span class="tag good">ok</span> ' + new Date(x.t).toLocaleString() : '<span class="tag warn">unreachable</span> ' + (x.kept ? 'showing last saved copy' : 'no data')) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';

    h += '<section class="card"><div class="row between"><h2>Signals feeding the model</h2><label class="row help"><input type="checkbox" data-c="live"' + (A.live ? ' checked' : '') + '> Apply live signals</label></div>';
    h += d.signals && d.signals.length ? '<div class="tblwrap"><table><thead><tr><th>Use</th><th>Signal</th><th>Reading</th><th>Effect on the model</th></tr></thead><tbody>' + d.signals.map(function (s) {
      var eff = s.dim ? (s.adj ? esc(M.dims[C.di[s.dim]].name) + ' starts ' + sgn(s.adj, 0) : 'none (within normal range)') : esc(P(s.weight.player).name) + ' weights ' + s.weight.dims.map(function (k) { return esc(M.dims[C.di[k]].name); }).join(' and ') + ' ×' + s.weight.factor;
      return '<tr><td class="c"><input type="checkbox" data-c="sig" data-v="' + s.id + '"' + (A.sigOff[s.id] ? '' : ' checked') + (A.live ? '' : ' disabled') + ' aria-label="Use this signal"></td><td>' + esc(s.label) + '<br><span class="help">' + esc(s.why) + '</span></td><td>' + esc(s.value) + '</td><td>' + eff + '</td></tr>';
    }).join('') + '</tbody></table></div><p class="help">Adjustments are deliberately small and capped. They move the starting position of a new game; a game in progress is replayed from the adjusted start.</p>' : '<p class="help">No signals yet. They appear after the first successful refresh.</p>';
    h += '</section>';

    h += '<div class="grid two">';
    if (d.fx) h += '<section class="card"><h2>Lira against the euro</h2><div class="kv"><div><b>₺' + d.fx.try.toFixed(2) + '</b><span>per €1 on ' + esc(d.fx.date) + '</span></div><div><b class="' + (d.fx.change > 0 ? 'bad' : 'good') + '">' + sgn(d.fx.change) + '%</b><span>euro price in lira, 12 months</span></div></div>' + spark(d.fx.series, 'var(--accent)') + '<p class="help"><b>Why this is here.</b> Türkiye is the player whose decision matters most, and its economy is where outside incentives and pressure bite. The lira is the one daily, public, hard number that shows how exposed that economy is. When it has fallen a lot over twelve months, Ankara needs foreign capital, trade access and investor confidence more, so offers such as a customs-union upgrade, and threats to them, weigh more in its calculation. The model therefore raises the weight Türkiye gives to its Western ties and to the economy, by at most 40%. The north of Cyprus also uses the lira, so the same slide erodes Turkish Cypriot living standards. Untick the lira signal above to switch this off.</p></section>';
    if (d.tone) h += '<section class="card"><h2>Tone of Cyprus–Türkiye coverage</h2><div class="kv"><div><b>' + d.tone.recent.toFixed(2) + '</b><span>last two weeks</span></div><div><b>' + d.tone.base.toFixed(2) + '</b><span>four-month average</span></div></div>' + spark(d.tone.series, 'var(--info)') + '<p class="help"><b>Why this is here.</b> It is an early-warning gauge. GDELT scores the language of worldwide news coverage: below zero is negative, and a falling line means more hostile reporting about Cyprus and Türkiye. If the last two weeks are clearly worse than the four-month average, the model starts with slightly lower stability.</p></section>';
    h += '</div>';

    if (d.wb) {
      h += '<section class="card"><h2>Balance of resources</h2><p class="help">The size of each economy, population and military budget, for context on who can afford what. These figures are shown for reference and do not change the model.</p><div class="tblwrap"><table><thead><tr><th>Indicator</th><th>Cyprus</th><th>Türkiye</th><th>Greece</th><th>Year</th></tr></thead><tbody>' + Object.keys(d.wb).map(function (k) {
        var r = d.wb[k]; function f(v) { return v === undefined || v === null ? '–' : v.toFixed(r.dp); }
        return '<tr><td>' + esc(r.label) + '</td><td class="c">' + f(r.CYP) + '</td><td class="c">' + f(r.TUR) + '</td><td class="c">' + f(r.GRC) + '</td><td class="c">' + esc(r.year || '') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="help">World Bank, latest available year. Cyprus figures cover the government-controlled area.</p></section>';
    }

    var themes = ['all', 'talks', 'military', 'energy', 'europe', 'pressure'], news = (d.news || []).filter(function (a) { return A.newsTheme === 'all' || a.themes.indexOf(A.newsTheme) >= 0; });
    h += '<section class="card"><h2>Latest headlines</h2><p class="help">News from the last three weeks that mentions the Cyprus question, newest first. Filter by theme; tap a headline to read it at its source. The mix of themes feeds the signals above.</p><div class="filter">' + themes.map(function (t) { return '<button data-a="ntheme" data-v="' + t + '" aria-pressed="' + (A.newsTheme === t) + '">' + t.charAt(0).toUpperCase() + t.slice(1) + '</button>'; }).join('') + '</div>' +
      (news.length ? '<ul class="news">' + news.map(function (a) { return '<li><a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title) + '</a><br><span class="help">' + esc(a.domain) + ' · ' + esc(a.date) + ' ' + a.themes.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join(' ') + '</span></li>'; }).join('') + '</ul>' : '<p class="help">' + (d.news ? 'No headlines under this theme.' : 'Headlines appear after the first successful refresh.') + '</p>') + '</section>';
    return h;
  }

  /* ---------- library ---------- */
  var LIBS = [['players', 'Stakeholders'], ['blueprints', 'Blueprint strategies'], ['history', 'Precedents'], ['assume', 'Assumptions'], ['about', 'Method & install']];

  function viewLibrary() {
    var h = intro('Library', 'The reference shelf behind the board: who the stakeholders are, the strategies in the source blueprints, what history teaches, the assumptions you can change, and how the tool works.', [
      'Use the buttons below to switch between the five shelves.',
      '<b>Stakeholders</b>: interests, red lines, leverage and weak points of each player, and the moves the model gives them.',
      '<b>Blueprint strategies</b>: search the full catalogue of proposals the moves are drawn from.',
      '<b>Precedents</b>: past successes and failures. <b>Assumptions</b>: every number in the model, adjustable. <b>Method & install</b>: how predictions are made, and how to install or download the tool.']) +
      '<div class="filter" style="margin-bottom:12px">' + LIBS.map(function (l) { return '<button data-a="lib" data-v="' + l[0] + '" aria-pressed="' + (A.lib === l[0]) + '">' + l[1] + '</button>'; }).join('') + '</div>';
    if (A.lib === 'players') {
      var u = E.utilities(C, S.x);
      h += '<p class="help">One card per stakeholder. "Power" is relative influence on the outcome (0–100); "payoff now" is how close today\'s position is to that player\'s ideal (100 would be its perfect world).</p>' + M.players.map(function (p) {
        function li(t, a) { return a && a.length ? '<h3>' + t + '</h3><ul class="list">' + a.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
        var cp = C.players[p.id], top = M.dims.map(function (d, i) { return [d, cp.w[i], cp.ideal[i]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 4);
        return '<section class="card" id="pl-' + p.id + '" style="border-left:5px solid ' + p.color + '"><div class="row between"><h2>' + esc(p.name) + '</h2><span class="help">power ' + p.power + ' · payoff now ' + u[p.id].toFixed(0) + (p.veto ? ' · <b>can block a settlement</b>' : '') + '</span></div><p>' + esc(p.role) + '</p>' +
          '<p class="help"><b>Cares most about:</b> ' + top.map(function (t) { return esc(t[0].name) + ' (wants ' + Math.round(t[2]) + ', weight ' + pct(t[1]) + ')'; }).join(' · ') + '</p>' +
          li('Interests', p.interests) + li('Red lines', p.redlines) + li('Leverage', p.leverage) + li('Vulnerabilities', p.vuln) +
          '<h3>Moves available in the model</h3><div class="chips">' + C.byPlayer[p.id].filter(function (m) { return !m.hold; }).map(function (m) { return '<span class="chip" style="padding-left:10px" title="' + esc(m.src.desc) + '">' + esc(m.src.name) + '</span>'; }).join('') + '</div>' +
          (p.id !== A.pid ? '<p style="margin-top:10px"><button class="btn small" data-a="pick" data-v="' + p.id + '">Play as ' + esc(p.short) + '</button></p>' : '') + '</section>';
      }).join('');
    } else if (A.lib === 'blueprints') {
      h += '<section class="card"><h2>Blueprint strategies</h2><p class="help">The strategies set out in the source blueprints by Samuel Akosa Onyejekwe, searchable. These are proposals, not established facts; figures and timings inside them are the author\'s planning estimates. The moves on the board are drawn from them.</p><input type="search" placeholder="Search strategies, actors, risks…" value="' + esc(A.q) + '" data-c="q" aria-label="Search strategies" style="width:100%">';
      if (!KB && window.KNOWLEDGE) KB = window.KNOWLEDGE;
      if (!KB) { loadKB(); h += '<p class="loading">Loading the library…</p></section>'; return h; }
      var q = A.q.toLowerCase().trim(), n = 0;
      h += '<div id="kbres">' + kbResults(q) + '</div></section>';
    } else if (A.lib === 'history') {
      h += '<section class="card"><h2>Precedents: what worked, what failed</h2><p class="help">Past attempts on Cyprus and comparable cases elsewhere. Summaries update from Wikipedia when online.</p>' + ['Cyprus', 'Elsewhere'].map(function (g) {
        return '<h2 style="margin-top:14px">' + g + '</h2>' + M.precedents.filter(function (p) { return (p.scope === 'cy') === (g === 'Cyprus'); }).map(precItem).join('');
      }).join('') + '</section>';
    } else if (A.lib === 'assume') {
      h += viewAssume();
    } else h += viewAbout();
    return h;
  }

  function kbResults(q) {
    var out = '', n = 0;
    KB.docs.forEach(function (d) {
      var items = d.strategies.filter(function (s) { return !q || (s.t + ' ' + s.a + ' ' + s.s + ' ' + (s.r || []).join(' ')).toLowerCase().indexOf(q) >= 0; });
      if (!items.length) return;
      n += items.length;
      out += '<h2 style="margin-top:16px">' + esc(d.title) + ' <small>(' + items.length + ')</small></h2>' + (q ? '' : '<p class="help">' + esc(d.thesis) + '</p>' +
        (d.games && d.games.length ? '<details class="explain"><summary>The game-theory logic of this blueprint</summary><ul class="list">' + d.games.map(function (g) { return '<li><b>' + esc(g.n) + '.</b> ' + esc(g.i) + '</li>'; }).join('') + '</ul></details>' : '') +
        (d.phases && d.phases.length ? '<details class="explain"><summary>Sequencing and gates</summary><ul class="list">' + d.phases.map(function (p) { return '<li><b>' + esc(p.p) + '</b>' + (p.w ? ' (' + esc(p.w) + ')' : '') + ': ' + p.a.map(esc).join('; ') + (p.g.length ? ' <i>Gates: ' + p.g.map(esc).join('; ') + '</i>' : '') + '</li>'; }).join('') + '</ul></details>' : '')) + items.slice(0, q ? 60 : 400).map(function (s) {
        function li(t, a) { return a && a.length ? '<p><b>' + t + ':</b> ' + a.map(esc).join('; ') + '</p>' : ''; }
        return '<details class="lib-item"><summary>' + esc(s.t) + ' <span class="tag">' + esc(s.c) + '</span></summary><p class="meta">' + esc(s.a) + (s.w ? ' · ' + esc(s.w) : '') + '</p><p>' + esc(s.s) + '</p>' +
          (s.x && s.x.length ? '<p><b>Expected responses:</b></p><ul class="list">' + s.x.map(function (x) { return '<li><b>' + esc(x[0]) + ':</b> ' + esc(x[1]) + '</li>'; }).join('') + '</ul>' : '') + li('Benefits', s.b) + li('Risks', s.r) + li('Mitigations', s.m) + '</details>';
      }).join('');
    });
    return (q ? '<p class="help">' + n + ' match' + (n === 1 ? '' : 'es') + '</p>' : '') + (out || '<p class="help">Nothing matches that search.</p>');
  }
  function loadKB() {
    if (loadKB.busy) return; loadKB.busy = true;
    var done = function (j) { KB = j; loadKB.busy = false; if (A.tab === 'library' && A.lib === 'blueprints') render(); };
    if (window.KNOWLEDGE) return done(window.KNOWLEDGE);
    fetch('data/knowledge.json').then(function (r) { return r.json(); }).then(done).catch(function () { loadKB.busy = false; KB = { docs: [] }; toast('The library could not be loaded. It will be available once you have opened it online.'); KB = null; });
  }

  function viewAssume() {
    var p = P(A.pid), cp = C.players[A.pid];
    var h = '<section class="card"><div class="row between"><h2>Assumptions</h2><button class="btn small" data-a="resetassume">Restore defaults</button></div><p class="help">Nothing in the model is hidden. Change any number and every prediction is recalculated. Your edits stay on this device.</p>' +
      '<h3>Starting position</h3><p class="help">Where each of the ten measures stands today, 0–100. The facts behind each score are listed below the sliders.</p><div class="adj">' + M.dims.map(function (d, i) { return '<label for="b-' + d.id + '">' + esc(d.name) + '</label><input id="b-' + d.id + '" type="range" min="0" max="100" value="' + Math.round(C.x0[i]) + '" data-c="base" data-v="' + d.id + '"><b class="num">' + Math.round(C.x0[i]) + '</b>'; }).join('') + '</div><details class="explain" style="margin-top:10px"><summary>The facts behind each starting score</summary><ul class="list">' + M.dims.map(function (d) { return '<li><b>' + esc(d.name) + '</b> (' + esc(d.lo) + ' ↔ ' + esc(d.hi) + '): ' + esc(d.basis) + '</li>'; }).join('') + '</ul></details></section>';
    h += '<section class="card"><h2>What a player wants, and how much it cares</h2><p class="help">For the chosen player: the "ideal point" is where it would like each measure to be, and the "weight" is how much that measure matters to it. These two numbers drive every prediction of that player\'s behaviour.</p><label class="help">Player <select data-c="assumep">' + M.players.map(function (q) { return '<option value="' + q.id + '"' + (q.id === (A.ap || A.pid) ? ' selected' : '') + '>' + esc(q.name) + '</option>'; }).join('') + '</select></label>';
    var q = C.players[A.ap || A.pid];
    h += '<div class="tblwrap" style="margin-top:8px"><table><thead><tr><th>Dimension</th><th>Ideal point (0–100)</th><th>Weight</th></tr></thead><tbody>' + M.dims.map(function (d, i) {
      return '<tr><td>' + esc(d.name) + '<br><span class="help">' + esc(d.lo) + ' ↔ ' + esc(d.hi) + '</span></td><td><input type="range" min="0" max="100" value="' + Math.round(q.ideal[i]) + '" data-c="ideal" data-v="' + d.id + '" aria-label="Ideal for ' + esc(d.name) + '"> <b class="num">' + Math.round(q.ideal[i]) + '</b></td><td><input type="range" min="0" max="40" value="' + Math.round(q.w[i] * 100) + '" data-c="w" data-v="' + d.id + '" aria-label="Weight for ' + esc(d.name) + '"> <b class="num">' + pct(q.w[i]) + '</b></td></tr>';
    }).join('') + '</tbody></table></div><p class="help">Weights are rescaled to total 100%.</p></section>';
    return h;
  }

  function viewAbout() {
    var mirrors = (M.mirrors || []).map(function (u) { return '<li><a href="' + u + '" rel="noopener">' + esc(u.replace(/^https?:\/\//, '')) + '</a></li>'; }).join('');
    return '<section class="card"><h2>Method</h2>' +
      '<p>The board is a <b>spatial bargaining game</b>. The Cyprus question is described by ten dimensions scored 0–100. Each of ten stakeholders has an ideal point on every dimension and a weight for how much it cares. A player\'s payoff is its weighted closeness to its ideals — 100 would be its perfect world.</p>' +
      '<p><b>Moves</b> shift dimensions by stated amounts, carry a chance of success, and may cost the mover political capital. Some need a precondition: a level of trust, or another player\'s earlier move.</p>' +
      '<p><b>Prediction.</b> After your move every other player replies in turn. Each values its options by its payoff once the remaining players have also replied, and the reply probabilities follow from how far apart those values are (a quantal-response rule: close calls are uncertain, clear ones are near-certain).</p>' +
      '<p><b>Best move and critical path.</b> The engine plays every option forward through several rounds of best replies and ranks them by your chosen objective; the path search keeps the three most promising lines at each step.</p>' +
      '<p><b>Odds</b> come from hundreds of simulated futures in which moves can fail and players sometimes take their second choice. <b>Robustness</b> comes from re-running the recommendation with every assumption randomly disturbed.</p>' +
      '<p><b>Limits.</b> This is a decision aid. It makes reasoning explicit and comparable; it cannot know private intentions, domestic shocks or events outside the ten dimensions. Scores are the authors\' structured judgments, informed by the source blueprints and the public record, and are open to edit under Assumptions. Treat outputs as scenarios with probabilities, not prophecy.</p></section>' +
      '<section class="card"><h2>Install and use offline</h2><p>The board installs like an app on phones, tablets and computers and runs fully offline, including in airplane mode. Live data refreshes whenever a connection returns.</p>' +
      '<div class="row"><button class="btn accent" data-a="install">Install on this device</button><a class="btn" href="offline.html" download="cyprus-strategy-board.html">Download single-file copy</a></div>' +
      '<p class="help" style="margin-top:8px">The single-file copy is the whole tool in one HTML document. Keep it on a drive or pass it on; it opens in any browser without a connection.</p>' +
      (mirrors ? '<h3>Mirrors</h3><p class="help">The same board is published at independent addresses. If one is unreachable, use another; an installed copy keeps working regardless.</p><ul class="list">' + mirrors + '</ul>' : '') + '</section>' +
      '<section class="card"><h2>Sources</h2><p>Strategy content is drawn from the policy blueprints of <b>Samuel Akosa Onyejekwe</b> (2024–2025):</p><ul class="list">' + M.docs.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' +
      '<p class="help">Live data: ' + L.sources.map(function (s) { return esc(s.name); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') + '. Version ' + esc(M.version) + '.</p></section>';
  }

  /* ---------- render ---------- */
  function render() {
    chrome();
    if (!A.pid) { view.innerHTML = viewPick(); sheet.className = 'sheet'; document.body.classList.remove('has-sheet'); return; }
    var f = { board: viewBoard, path: viewPath, analysis: viewAnalysis, live: viewLive, library: viewLibrary }[A.tab] || viewBoard;
    var keep = document.activeElement && document.activeElement.getAttribute('data-c') === 'q';
    var ti = TABS.map(function (t) { return t[0]; }).indexOf(A.tab), prev = TABS[ti - 1], next = TABS[ti + 1];
    view.innerHTML = f() + '<nav class="pager" aria-label="Previous and next page">' +
      (prev ? '<button class="btn" data-a="tab" data-v="' + prev[0] + '">← ' + prev[2] + '</button>' : '<button class="btn" data-a="home">← Choose stakeholder</button>') +
      (next ? '<button class="btn accent" data-a="tab" data-v="' + next[0] + '">' + next[2] + ' →</button>' : '<button class="btn" data-a="tab" data-v="board">Back to the board ↺</button>') + '</nav>';
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
    var acts = r.replies.filter(function (y) { return !y.chosen.m.hold; }).length;
    toast('Round ' + S.round + ' played. ' + (acts ? acts + ' player' + (acts > 1 ? 's' : '') + ' answered.' : 'Everyone else held.'));
  }

  /* ---------- install ---------- */
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function installUI() { $('#installBtn').hidden = standalone(); }
  function install() {
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; }); return; }
    var ua = navigator.userAgent, ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var steps = standalone() ? '<p>The board is already installed and running as an app on this device.</p>' :
      location.protocol === 'file:' ? '<p>You are using the single-file copy. It already works offline from wherever you saved it. To install it as an app with automatic updates, open one of the web addresses under Library → Method & install.</p>' :
      ios ? '<ol class="list"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (the square with an arrow).</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>' :
      /Android/.test(ua) ? '<ol class="list"><li>Open the browser menu (<b>⋮</b>).</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Confirm. The board appears with your other apps.</li></ol>' :
      '<ol class="list"><li><b>Chrome or Edge:</b> click the install icon at the right of the address bar, or menu → <b>Install Cyprus Strategy Board</b>.</li><li><b>Safari on Mac:</b> File → <b>Add to Dock</b>.</li><li><b>Firefox:</b> bookmark the page; it still works offline after the first visit.</li></ol>';
    modal('<h2>Install the board</h2>' + steps + '<p class="help">Once installed it opens without a connection, including in airplane mode. Any browser that has opened the page once also keeps an offline copy.</p><div class="row"><a class="btn" href="offline.html" download="cyprus-strategy-board.html">Download single-file copy</a><button class="btn accent" data-a="closemodal">Done</button></div>');
  }
  function modal(html) { var m = $('#modal'); m.innerHTML = '<div class="box" role="dialog" aria-modal="true">' + html + '</div>'; m.hidden = false; }

  /* ---------- events ---------- */
  var acts = {
    home: function () { if (!A.pid) return; A.pid = null; A.sel = null; navPush(); render(); window.scrollTo(0, 0); },
    back: function () { history.back(); },
    fwd: function () { history.forward(); },
    pick: function (v) { A.pid = v; A.own = []; A.sel = null; A.tab = 'board'; A.cat = 'all'; replay(); navPush(); render(); window.scrollTo(0, 0); },
    tab: function (v) { go(v); },
    sel: function (v) { A.sel = A.sel === v ? null : v; A.manual = {}; render(); },
    playmode: function (v) { A.play = v; A.manual = {}; save(); render(); },
    close: function () { A.sel = null; render(); },
    play: function () { play(A.sel); },
    playfirst: function () { var st = cache.path.p.steps[0]; A.tab = 'board'; navPush(); play(st.move.id); },
    analyse: function () { go('analysis'); },
    mode: function (v) { A.mode = v; cache = {}; save(); render(); },
    cat: function (v) { A.cat = v; render(); },
    undo: function () { if (!stack.length) return; S = stack.pop().S; A.own.pop(); cache = {}; A.sel = null; save(); render(); },
    reset: function () { A.own = []; A.sel = null; replay(); save(); render(); },
    share: function () {
      save(); var url = location.href;
      if (navigator.share) navigator.share({ title: 'Cyprus Strategy Board', text: 'A line of play as ' + P(A.pid).name, url: url }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('Link to this game copied.'); });
      else modal('<h2>Link to this game</h2><p style="word-break:break-all">' + esc(url) + '</p><button class="btn accent" data-a="closemodal">Done</button>');
    },
    player: function (v) { A.tab = 'library'; A.lib = 'players'; A.sel = null; navPush(); render(); var el = $('#pl-' + v); if (el) el.scrollIntoView(); },
    lib: function (v) { if (A.lib === v) return; A.lib = v; navPush(); render(); },
    ntheme: function (v) { A.newsTheme = v; render(); },
    refresh: function () { refresh(true); },
    install: install,
    closemodal: function () { $('#modal').hidden = true; },
    theme: function () {
      var cur = A.theme || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      A.theme = cur === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', A.theme); save();
    },
    print: function () { window.print(); },
    resetassume: function () { A.custom = { base: {}, w: {}, ideal: {} }; build(); save(); render(); }
  };
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-a]') : null;
    if (!t) { if (e.target.id === 'modal') e.target.hidden = true; return; }
    var f = acts[t.getAttribute('data-a')];
    if (f) { if (t.tagName !== 'A') e.preventDefault(); f(t.getAttribute('data-v')); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, c = t.getAttribute && t.getAttribute('data-c'), v = t.getAttribute('data-v');
    if (!c) return;
    if (c === 'horizon') { A.horizon = +t.value; cache.path = null; }
    else if (c === 'opp') A.opp = t.value;
    else if (c === 'man') { A.manual[v] = t.value; render(); return; }
    else if (c === 'sel') A.sel = t.value;
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
    if (e.target.getAttribute && e.target.getAttribute('data-c') === 'q') {
      A.q = e.target.value;
      var el = $('#kbres'); if (el && KB) el.innerHTML = kbResults(A.q.toLowerCase().trim());
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!$('#modal').hidden) $('#modal').hidden = true; else if (A.sel) acts.close(); } });

  /* ---------- live refresh loop ---------- */
  function refresh(manual) {
    if (navigator.onLine === false) { if (manual) toast('You are offline. Showing the last saved data.'); return; }
    L.refresh(M.precedents.map(function (p) { return p.wiki; }).filter(Boolean)).then(function () { if (manual) toast('Live data updated.'); });
  }
  var lastSig = '';
  L.onChange(function (d, busy) {
    net();
    var sig = JSON.stringify((d && d.signals) || []);
    if (sig !== lastSig) { lastSig = sig; if (C) { build(); if (A.tab === 'live' || (A.tab === 'board' && !A.sel)) render(); } }
    else if (A.tab === 'live') render();
  });
  window.addEventListener('online', function () { net(); refresh(); });
  window.addEventListener('offline', net);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && L.stale()) refresh(); });
  setInterval(function () { net(); if (!document.hidden && L.stale()) refresh(); }, 10 * 60 * 1000);

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { deferred = null; installUI(); toast('Installed. The board now works offline.'); });

  /* ---------- start ---------- */
  restore();
  if (A.theme) document.documentElement.setAttribute('data-theme', A.theme);
  lastSig = JSON.stringify((L.get() || {}).signals || []);
  build(); installUI();
  try { history.replaceState(navState(), '', location.href); } catch (e) {}
  render();
  if (L.stale()) setTimeout(refresh, 800);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    var hadSW = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var w = reg.installing;
        if (w) w.addEventListener('statechange', function () { if (w.state === 'activated' && hadSW) toast('Updated to the latest version. Reload to use it.'); });
      });
      setInterval(function () { reg.update().catch(function () {}); }, 60 * 60 * 1000);
    }).catch(function () {});
  }
})();
