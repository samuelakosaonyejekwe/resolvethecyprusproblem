/* Game engine: spatial-utility, multi-player, sequential-response model.
   Pure functions, no DOM. Works in browsers and in Node (for tests). */
(function (root) {
  'use strict';
  var E = {};

  /* Text hook. The interface points this at its translator; on its own the
     engine answers in English. {0}, {1}… are filled from the arguments. */
  E.T = function (s) {
    var a = arguments;
    return String(s).replace(/\{(\d+)\}/g, function (m, i) { return a[+i + 1] === undefined ? m : a[+i + 1]; });
  };

  function clamp(v) { return v < 0 ? 0 : v > 100 ? 100 : v; }
  /* Diminishing returns: the nearer a dimension is to an extreme, the harder
     it is to push it further that way. */
  function sat(x, d) { var room = d > 0 ? (100 - x) / 55 : x / 55; return d * (room > 1 ? 1 : room < 0 ? 0 : room); }

  /* Small seeded generator so simulations are repeatable. */
  E.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  function sparse(C, obj) {
    var out = [];
    if (obj) Object.keys(obj).forEach(function (k) {
      if (C.di[k] === undefined) throw new Error('Unknown dimension: ' + k);
      out.push([C.di[k], obj[k]]);
    });
    return out;
  }

  function conds(C, obj) {
    var out = [];
    if (obj) Object.keys(obj).forEach(function (k) {
      if (C.di[k] === undefined) throw new Error('Unknown dimension: ' + k);
      out.push([C.di[k], obj[k][0], obj[k][1]]);
    });
    return out;
  }

  /* Turn the readable model into arrays for fast evaluation. */
  E.compile = function (M) {
    var C = { M: M, D: M.dims.map(function (d) { return d.id; }), di: {}, players: {}, order: [], moves: {}, byPlayer: {} };
    var H = M.hold || {};
    C.D.forEach(function (d, i) { C.di[d] = i; });
    C.n = C.D.length;
    C.x0 = M.dims.map(function (d) { return d.base; });
    C.drift = M.dims.map(function (d) { return d.drift || 0; });
    M.players.forEach(function (p) {
      var w = C.D.map(function (d) { return p.w[d] || 0; });
      var s = w.reduce(function (a, b) { return a + b; }, 0) || 1;
      C.players[p.id] = {
        id: p.id, src: p, power: p.power, inertia: p.inertia || 0, veto: !!p.veto, lean: p.lean || 0,
        ideal: C.D.map(function (d) { return p.ideal[d] === undefined ? 50 : p.ideal[d]; }),
        w: w.map(function (v) { return v / s; })
      };
      C.order.push(p.id);
      C.byPlayer[p.id] = [];
      var hold = { id: p.id + '.hold', p: p.id, name: H.name || E.T('Hold position'), hold: true, cat: 'wait',
        desc: H.desc || E.T('Make no new move this round; keep current policy and let others act.'), fx: {}, cost: 0, ps: 1 };
      addMove(C, hold);
    });
    M.moves.forEach(function (m) { addMove(C, m); });
    return C;
  };

  /* Is a move conciliatory (+1), confrontational (-1) or neither? Read from
     what it does to the settlement track, trust and stability. */
  function tone(fx) { var v = (fx.settle || 0) + (fx.trust || 0) + (fx.stability || 0); return v > 3 ? 1 : v < -3 ? -1 : 0; }
  /* A government whose recent public statements lean one way is a little
     more inclined to moves of the same kind. */
  function leaning(C, pid, m) { return 0.4 * C.players[pid].lean * m.tone; }

  function addMove(C, m) {
    if (!C.players[m.p]) throw new Error('Unknown player on move ' + m.id);
    if (C.moves[m.id]) throw new Error('Duplicate move ' + m.id);
    var c = {
      id: m.id, p: m.p, src: m, hold: !!m.hold,
      fx: sparse(C, m.fx), fail: sparse(C, m.fail),
      ps: m.ps === undefined ? 0.8 : m.ps, cost: (m.cost || 0) * (C.M.costScale || 1),
      req: conds(C, m.req), once: m.once !== false && !m.hold, after: m.after || [],
      not: m.not || [], any: m.any || [], decay: m.decay || 0.55,
      tone: tone(m.fx || {}),
      mods: (m.mods || []).map(function (md) { return { c: conds(C, md.when), u: md.used || null, fx: sparse(C, md.fx) }; }),
      commit: m.commit || null
    };
    C.moves[m.id] = c;
    C.byPlayer[m.p].push(c);
  }

  /* Commitment value: what the mover would forfeit by not following through
     on a step it is bound to (escrowed rewards, snap-back, verification). */
  function bound(m, used) {
    if (!m.commit) return 0;
    var v = 0;
    for (var i = 0; i < m.commit.length; i++) if (!m.commit[i].used || (used && used[m.commit[i].used])) v += m.commit[i].v;
    return v;
  }
  E.bound = bound;

  E.newState = function (C, x) { return { x: (x || C.x0).slice(), used: {}, round: 0, history: [] }; };

  function holds(cs, x) {
    for (var i = 0; i < cs.length; i++) if (x[cs[i][0]] < cs[i][1] || x[cs[i][0]] > cs[i][2]) return false;
    return true;
  }

  /* Why a move is not currently playable (null when it is). */
  E.blocked = function (C, S, m) {
    if (m.hold) return null;
    if (m.once && S.used[m.id]) return E.T('Already played');
    var i;
    for (i = 0; i < m.after.length; i++) if (!S.used[m.after[i]]) {
      var pre = C.moves[m.after[i]];
      return E.T('Needs first: {0}', pre ? pre.src.name + ' (' + C.players[pre.p].src.short + ')' : m.after[i]);
    }
    if (m.any.length && !m.any.some(function (a) { return S.used[a]; })) {
      return E.T('Needs one of: {0}', m.any.map(function (a) { var q = C.moves[a]; return q ? q.src.name + ' (' + C.players[q.p].src.short + ')' : a; }).join('; '));
    }
    for (i = 0; i < m.not.length; i++) if (S.used[m.not[i]]) return E.T('Ruled out by: {0}', C.moves[m.not[i]].src.name);
    for (i = 0; i < m.req.length; i++) {
      var r = m.req[i], v = S.x[r[0]];
      if (v < r[1]) return E.T('Needs {0} ≥ {1} (now {2})', C.M.dims[r[0]].name, r[1], Math.round(v));
      if (v > r[2]) return E.T('Needs {0} ≤ {1} (now {2})', C.M.dims[r[0]].name, r[2], Math.round(v));
    }
    return null;
  };

  /* The same test as `blocked`, as a plain yes or no: used in the inner loops. */
  function open(C, S, m) {
    if (m.hold) return true;
    if (m.once && S.used[m.id]) return false;
    var i;
    for (i = 0; i < m.after.length; i++) if (!S.used[m.after[i]]) return false;
    if (m.any.length) { var ok = false; for (i = 0; i < m.any.length; i++) if (S.used[m.any[i]]) { ok = true; break; } if (!ok) return false; }
    for (i = 0; i < m.not.length; i++) if (S.used[m.not[i]]) return false;
    for (i = 0; i < m.req.length; i++) { var v = S.x[m.req[i][0]]; if (v < m.req[i][1] || v > m.req[i][2]) return false; }
    return true;
  }
  E.available = function (C, S, pid) {
    var ms = C.byPlayer[pid], out = [];
    for (var i = 0; i < ms.length; i++) if (open(C, S, ms[i])) out.push(ms[i]);
    return out;
  };

  /* mode: 'exp' expected value, 'ok' success, 'fail' failure. */
  E.apply = function (C, x, m, used, mode) {
    var y = x.slice(), k = used && used[m.id] ? Math.pow(m.decay, used[m.id]) : 1, i, f;
    var ps = mode === 'ok' ? 1 : mode === 'fail' ? 0 : m.ps;
    for (i = 0; i < m.fx.length; i++) { f = m.fx[i]; y[f[0]] += sat(x[f[0]], f[1]) * k * ps; }
    if (ps < 1) for (i = 0; i < m.fail.length; i++) { f = m.fail[i]; y[f[0]] += sat(x[f[0]], f[1]) * (1 - ps); }
    if (ps > 0) for (var j = 0; j < m.mods.length; j++) if (holds(m.mods[j].c, x) && (!m.mods[j].u || (used && used[m.mods[j].u]))) {
      var mf = m.mods[j].fx;
      for (i = 0; i < mf.length; i++) y[mf[i][0]] += sat(x[mf[i][0]], mf[i][1]) * k * ps;
    }
    for (i = 0; i < y.length; i++) y[i] = clamp(y[i]);
    return y;
  };

  /* Utility 0..100: weighted closeness of the position to the player's ideal point. */
  E.utility = function (C, pid, x) {
    var p = C.players[pid], u = 0;
    for (var i = 0; i < C.n; i++) u += p.w[i] * (1 - Math.abs(x[i] - p.ideal[i]) / 100);
    return 100 * u;
  };

  E.utilities = function (C, x) {
    var o = {};
    C.order.forEach(function (pid) { o[pid] = E.utility(C, pid, x); });
    return o;
  };

  function greedy(C, S, x, pid, avail) {
    var ms = avail[pid], best = ms[0], bv = -1e9;
    for (var i = 0; i < ms.length; i++) {
      var v = E.utility(C, pid, E.apply(C, x, ms[i], S.used, 'exp')) - ms[i].cost + bound(ms[i], S.used) + leaning(C, pid, ms[i]) + (ms[i].hold ? C.players[pid].inertia : 0);
      if (v > bv) { bv = v; best = ms[i]; }
    }
    return best;
  }

  function availAll(C, S) {
    var a = {};
    C.order.forEach(function (pid) { a[pid] = E.available(C, S, pid); });
    return a;
  }

  /* Rank one player's options. Each option is valued after anticipating the
     myopic replies of the players still to move this round. */
  E.rank = function (C, S, x, pid, rest, avail, opt) {
    opt = opt || {};
    var tau = opt.tau || C.M.tau || 1.2, deep = opt.deep !== false;
    var ms = avail[pid], out = [], i, j;
    if (opt.top) {
      var bm = ms[0], bvv = -1e9;
      for (i = 0; i < ms.length; i++) {
        var m0 = ms[i], v0 = E.utility(C, pid, E.apply(C, x, m0, S.used, 'exp')) - m0.cost + bound(m0, S.used) + leaning(C, pid, m0) + (m0.hold ? C.players[pid].inertia : 0);
        if (v0 > bvv) { bvv = v0; bm = m0; }
      }
      return [{ m: bm, v: bvv, direct: bvv, p: 1 }];
    }
    for (i = 0; i < ms.length; i++) {
      var m = ms[i], y = E.apply(C, x, m, S.used, 'exp');
      var direct = E.utility(C, pid, y);
      if (deep) for (j = 0; j < rest.length; j++) y = E.apply(C, y, greedy(C, S, y, rest[j], avail), S.used, 'exp');
      var v = (deep ? 0.5 * direct + 0.5 * E.utility(C, pid, y) : direct) - m.cost + bound(m, S.used) + leaning(C, pid, m) + (m.hold ? C.players[pid].inertia : 0);
      out.push({ m: m, v: v, direct: direct });
    }
    var mx = Math.max.apply(null, out.map(function (o) { return o.v; })), z = 0;
    out.forEach(function (o) { o.p = Math.exp((o.v - mx) / tau); z += o.p; });
    out.forEach(function (o) { o.p /= z; });
    out.sort(function (a, b) { return b.v - a.v; });
    return out;
  };

  function pick(list, r) {
    var a = 0;
    for (var i = 0; i < list.length; i++) { a += list[i].p; if (r <= a) return list[i]; }
    return list[list.length - 1];
  }

  /* One full round: `pid` plays `moveId`, every other stakeholder replies in turn.
     opt.rand -> sample replies and success instead of taking expected values. */
  E.round = function (C, S, pid, moveId, opt) {
    opt = opt || {};
    var rand = opt.rand, x = S.x, used = Object.assign({}, S.used), avail = availAll(C, S);
    var order = C.order.filter(function (q) { return q !== pid; });
    var m = C.moves[moveId], res = { mover: pid, move: m, replies: [], before: S.x.slice() };
    function play(mv) {
      var ok = rand ? rand() < mv.ps : null;
      x = E.apply(C, x, mv, used, rand ? (ok ? 'ok' : 'fail') : 'exp');
      if (!mv.hold) used[mv.id] = (used[mv.id] || 0) + 1;
      return ok;
    }
    res.ok = play(m);
    res.afterMove = x.slice();
    for (var i = 0; i < order.length; i++) {
      var q = order[i], before = x;
      var ranked = E.rank(C, { used: used }, x, q, opt.top ? null : order.slice(i + 1), avail, { deep: opt.deep, tau: opt.tau, top: opt.top && !rand });
      var ch = rand ? pick(ranked, rand()) : ranked[0], forced = false;
      if (opt.forced && opt.forced[q]) {
        var want = ranked.filter(function (o) { return o.m.id === opt.forced[q]; })[0];
        if (want) { ch = want; forced = true; }
      }
      var ok = play(ch.m);
      res.replies.push({ pid: q, chosen: ch, ranked: ranked, ok: ok, before: before, after: x, forced: forced });
    }
    for (var d = 0; d < C.n; d++) x[d] = clamp(x[d] + C.drift[d]);
    res.after = x;
    res.state = { x: x, used: used, round: S.round + 1, history: S.history.concat([{ pid: pid, move: moveId, replies: res.replies.map(function (r) { return r.chosen.m.id; }) }]) };
    return res;
  };

  /* Prospects: how attractive the position makes other players' moves that
     would help (or hurt) `pid`. Lets the search value groundwork whose pay-off
     arrives only when someone else responds. */
  E.potential = function (C, S, pid) {
    var u0 = E.utility(C, pid, S.x), tot = 0;
    for (var qi = 0; qi < C.order.length; qi++) {
      var q = C.order[qi];
      if (q === pid) continue;
      var uq = E.utility(C, q, S.x), ms = C.byPlayer[q];
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.hold || (m.once && S.used[m.id])) continue;
        var y = E.apply(C, S.x, m, S.used, 'exp'), d = E.utility(C, pid, y) - u0;
        if (d > -0.4 && d < 0.4) continue;
        var net = E.utility(C, q, y) - uq - m.cost + bound(m, S.used) + leaning(C, q, m) - C.players[q].inertia;
        var pr = 1 / (1 + Math.exp(-net / 0.5));
        tot += d * pr * (E.blocked(C, S, m) ? 0.3 : 1);
      }
    }
    return 0.5 * tot;
  };

  /* What the decision-maker is optimising. */
  E.objective = function (C, pid, x, mode, x0) {
    var u = E.utility(C, pid, x);
    if (mode === 'self') return u;
    if (mode === 'collective') {
      var s = 0, pw = 0;
      C.order.forEach(function (q) { s += C.players[q].power * E.utility(C, q, x); pw += C.players[q].power; });
      return s / pw;
    }
    /* 'sustainable': own payoff, penalised when any veto player ends up worse
       off than at the start (they would defect) and when stability erodes. */
    var worst = 0;
    C.order.forEach(function (q) {
      if (q === pid || !C.players[q].veto) return;
      worst = Math.max(worst, E.utility(C, q, x0) - E.utility(C, q, x));
    });
    var st = C.di.stability;
    return u - 1.3 * worst - 0.25 * Math.max(0, x0[st] - x[st]);
  };

  /* Score every option of `pid` by playing it and then following best play for
     `horizon` rounds. Returns the list ranked for the chosen objective. */
  E.recommend = function (C, S, pid, opt) {
    var job = E.recommendJob(C, S, pid, opt);
    while (!job.step(1e9)) { /* run to the end */ }
    return job.result();
  };
  /* The same calculation, able to stop and resume: step(ms) works for about
     that long and returns true once every move has been assessed. */
  E.recommendJob = function (C, S, pid, opt) {
    opt = opt || {};
    var H = opt.horizon || 3, mode = opt.mode || 'sustainable', x0 = S.x, pot0 = mode === 'collective' ? 0 : E.potential(C, S, pid);
    var todo = E.available(C, S, pid), i = 0, list = [];
    function one(m) {
      var r = E.round(C, S, pid, m.id, { deep: opt.deep }), s = r.state, first = r, acc = E.objective(C, pid, s.x, mode, x0), wsum = 1;
      for (var h = 1; h < H; h++) {
        var nx = E.bestQuick(C, s, pid, mode, x0);
        s = E.round(C, s, pid, nx.id, { deep: false, top: true }).state;
        var wgt = 1 + h * 0.5;
        acc += wgt * E.objective(C, pid, s.x, mode, x0); wsum += wgt;
      }
      if (mode !== 'collective') acc += wsum * 0.6 * (E.potential(C, s, pid) - pot0);
      return { m: m, score: acc / wsum, first: first, end: s.x };
    }
    return {
      step: function (ms) {
        var t0 = Date.now();
        while (i < todo.length) { list.push(one(todo[i])); i += 1; if (Date.now() - t0 >= ms) break; }
        return i >= todo.length;
      },
      result: function () {
        var base = E.objective(C, pid, S.x, mode, x0);
        list.forEach(function (o) { o.gain = o.score - base; });
        list.sort(function (a, b) { return b.score - a.score; });
        return list;
      }
    };
  };

  /* Cheap one-round choice used inside deeper searches. */
  E.bestQuick = function (C, S, pid, mode, x0) {
    var ms = E.available(C, S, pid), best = ms[0], bv = -1e9;
    /* with many options, look closely only at the eight that look best at first sight */
    if (ms.length > 8) {
      ms = ms.map(function (m) { return [m, E.objective(C, pid, E.apply(C, S.x, m, S.used, 'exp'), mode, x0) - m.cost * 0.3]; })
        .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8).map(function (a) { return a[0]; });
      best = ms[0];
    }
    for (var i = 0; i < ms.length; i++) {
      var r = E.round(C, S, pid, ms[i].id, { deep: false, top: true });
      var v = E.objective(C, pid, r.after, mode, x0) - ms[i].cost * 0.3;
      if (v > bv) { bv = v; best = ms[i]; }
    }
    return best;
  };

  /* Beam search for the best sequence of own moves (the critical path).
     Run with several weights on prospects, from cautious to ambitious, and
     keep the line whose end position is genuinely best. */
  E.path = function (C, S, pid, opt) {
    opt = opt || {};
    var mode = opt.mode || 'sustainable', x0 = S.x, best = null;
    (mode === 'collective' ? [0] : [1, 3, 7]).forEach(function (lam) {
      var b = beam(C, S, pid, opt, lam);
      if (!b) return;
      b.final = E.objective(C, pid, b.s.x, mode, x0) + (mode === 'collective' ? 0 : E.potential(C, b.s, pid));
      if (!best || b.final > best.final + 1e-9) best = b;
    });
    return best;
  };

  function beam(C, S, pid, opt, lam) {
    var H = opt.horizon || 5, B = opt.beam || 4, K = opt.branch || 6, mode = opt.mode || 'sustainable', x0 = S.x;
    function val(st) { return E.objective(C, pid, st.x, mode, x0) + (lam ? lam * E.potential(C, st, pid) : 0); }
    var beams = [{ s: S, steps: [], score: val(S) }];
    for (var h = 0; h < H; h++) {
      var next = [];
      beams.forEach(function (b) {
        var cands = E.available(C, b.s, pid).map(function (m) {
          var r = E.round(C, b.s, pid, m.id, { deep: false, top: true });
          return { m: m, q: val(r.state) - m.cost * 0.3 };
        }).sort(function (a, c) { return c.q - a.q; }).slice(0, K);
        cands.forEach(function (c) {
          var r = E.round(C, b.s, pid, c.m.id, { deep: true });
          next.push({ s: r.state, steps: b.steps.concat([r]), score: val(r.state) });
        });
      });
      next.sort(function (a, c) { return c.score - a.score; });
      var seen = {}, kept = [];
      next.forEach(function (n) {
        var key = n.s.x.map(function (v) { return Math.round(v / 2); }).join(',');
        if (!seen[key] && kept.length < B) { seen[key] = 1; kept.push(n); }
      });
      beams = kept;
    }
    return beams[0];
  }

  /* What happens if `pid` only holds while everyone else plays their best. */
  E.doNothing = function (C, S, pid, rounds) {
    var s = S, steps = [];
    for (var h = 0; h < rounds; h++) { var r = E.round(C, s, pid, pid + '.hold', { deep: false }); steps.push(r); s = r.state; }
    return { s: s, steps: steps };
  };

  /* Name the kind of world a position represents. */
  E.classify = function (C, x) {
    var g = function (k) { return x[C.di[k]]; };
    if (g('stability') < 22) return 'crisis';
    if (g('settle') >= 78 && g('troops') >= 65) return 'reunified';
    if (g('settle') <= 22) return 'partition';
    if (g('settle') >= 60 && g('trust') >= 50) return 'convergence';
    if (g('pressure') >= 60 && g('stability') < 45) return 'confrontation';
    return 'stalemate';
  };

  /* Monte-Carlo: sample replies and success/failure to get outcome odds. */
  E.monteCarlo = function (C, S, pid, firstMoveId, opt) {
    opt = opt || {};
    var N = opt.runs || 200, H = opt.horizon || 4, mode = opt.mode || 'sustainable', rand = E.rng(opt.seed || 7);
    var counts = {}, us = [], sum = C.x0.map(function () { return 0; });
    for (var n = 0; n < N; n++) {
      var s = S;
      for (var h = 0; h < H; h++) {
        var mv = h === 0 && firstMoveId ? firstMoveId : E.bestQuick(C, s, pid, mode, S.x).id;
        if (E.blocked(C, s, C.moves[mv])) mv = pid + '.hold';
        s = E.round(C, s, pid, mv, { deep: false, rand: rand, tau: (C.M.tau || 1.2) * 1.4 }).state;
      }
      var k = E.classify(C, s.x);
      counts[k] = (counts[k] || 0) + 1;
      us.push(E.utility(C, pid, s.x));
      for (var d = 0; d < C.n; d++) sum[d] += s.x[d] / N;
    }
    us.sort(function (a, b) { return a - b; });
    Object.keys(counts).forEach(function (k) { counts[k] /= N; });
    return { odds: counts, mean: sum, p10: us[Math.floor(N * 0.1)], p50: us[Math.floor(N * 0.5)], p90: us[Math.floor(N * 0.9)], runs: N, horizon: H };
  };

  /* Alignment of every stakeholder with `pid` at the current position:
     cosine similarity of the directions each wants the position to move. */
  E.alignment = function (C, x, pid) {
    function grad(q) {
      var p = C.players[q];
      return p.ideal.map(function (id, i) { var d = id - x[i]; return p.w[i] * (Math.abs(d) < 3 ? 0 : d / 100); });
    }
    var g = grad(pid), out = {};
    C.order.forEach(function (q) {
      if (q === pid) return;
      var h = grad(q), dot = 0, a = 0, b = 0;
      for (var i = 0; i < C.n; i++) { dot += g[i] * h[i]; a += g[i] * g[i]; b += h[i] * h[i]; }
      out[q] = a && b ? dot / Math.sqrt(a * b) : 0;
    });
    return out;
  };

  /* Two-player normal-form slice with pure-strategy equilibria. */
  E.matrix = function (C, S, a, b, k) {
    k = k || 5;
    function top(pid) {
      var av = availAll(C, S);
      return E.rank(C, S, S.x, pid, [], av, { deep: false }).slice(0, k).map(function (o) { return o.m; });
    }
    var A = top(a), B = top(b), cells = [];
    A.forEach(function (ma, i) {
      cells.push(B.map(function (mb) {
        var y = E.apply(C, E.apply(C, S.x, ma, S.used, 'exp'), mb, S.used, 'exp');
        return { a: E.utility(C, a, y) - ma.cost, b: E.utility(C, b, y) - mb.cost };
      }));
    });
    var ne = [];
    A.forEach(function (_, i) {
      B.forEach(function (_, j) {
        var ok = true, r, c;
        for (r = 0; r < A.length; r++) if (cells[r][j].a > cells[i][j].a + 1e-9) ok = false;
        for (c = 0; c < B.length; c++) if (cells[i][c].b > cells[i][j].b + 1e-9) ok = false;
        if (ok) ne.push([i, j]);
      });
    });
    function dom(n, k, get) {
      for (var i = 0; i < n; i++) {
        var ok = true;
        for (var o = 0; o < n && ok; o++) if (o !== i) for (var c = 0; c < k; c++) if (get(i, c) < get(o, c) - 1e-9) { ok = false; break; }
        if (ok && n > 1) return i;
      }
      return -1;
    }
    var domA = dom(A.length, B.length, function (i, c) { return cells[i][c].a; });
    var domB = dom(B.length, A.length, function (j, r) { return cells[r][j].b; });
    var base = { a: E.utility(C, a, S.x), b: E.utility(C, b, S.x) };
    return { A: A, B: B, cells: cells, ne: ne, domA: domA, domB: domB, base: base };
  };

  /* How robust is the top recommendation to errors in the assumptions? */
  E.sensitivity = function (C, S, pid, opt) {
    opt = opt || {};
    var N = opt.runs || 30, mode = opt.mode || 'sustainable', rand = E.rng(opt.seed || 11);
    var base = E.recommend(C, S, pid, { horizon: 2, mode: mode, deep: false });
    var topId = base[0].m.id, wins = {}, same = 0;
    for (var n = 0; n < N; n++) {
      var M2 = JSON.parse(JSON.stringify(C.M));
      M2.players.forEach(function (p) {
        Object.keys(p.w).forEach(function (k) { p.w[k] *= 0.65 + 0.7 * rand(); });
        Object.keys(p.ideal).forEach(function (k) { p.ideal[k] = clamp(p.ideal[k] + (rand() - 0.5) * 20); });
      });
      M2.moves.forEach(function (m) { Object.keys(m.fx || {}).forEach(function (k) { m.fx[k] *= 0.7 + 0.6 * rand(); }); });
      var C2 = E.compile(M2);
      var r = E.recommend(C2, S, pid, { horizon: 2, mode: mode, deep: false })[0].m.id;
      wins[r] = (wins[r] || 0) + 1;
      if (r === topId) same++;
    }
    /* Tornado: shift each starting dimension by ±15 and watch the best score. */
    var tornado = C.D.map(function (d, i) {
      function run(delta) {
        var s = { x: S.x.slice(), used: S.used, round: S.round, history: S.history };
        s.x[i] = clamp(s.x[i] + delta);
        return E.recommend(C, s, pid, { horizon: 2, mode: mode, deep: false })[0].score;
      }
      return { dim: d, lo: run(-15), hi: run(15) };
    });
    return { top: topId, robustness: same / N, wins: wins, runs: N, tornado: tornado, baseScore: base[0].score };
  };

  /* The same stress test, cut into small pieces of work so a page can run it
     without freezing: call step() until it returns true, then read result(). */
  E.sensitivityJob = function (C, S, pid, opt) {
    opt = opt || {};
    var N = opt.runs || 30, mode = opt.mode || 'sustainable', rand = E.rng(opt.seed || 11);
    var base = null, topId = null, wins = {}, same = 0, n = 0, t = 0, tornado = [];
    function trial() {
      var M2 = JSON.parse(JSON.stringify(C.M));
      M2.players.forEach(function (p) {
        Object.keys(p.w).forEach(function (k) { p.w[k] *= 0.65 + 0.7 * rand(); });
        Object.keys(p.ideal).forEach(function (k) { p.ideal[k] = clamp(p.ideal[k] + (rand() - 0.5) * 20); });
      });
      M2.moves.forEach(function (m) { Object.keys(m.fx || {}).forEach(function (k) { m.fx[k] *= 0.7 + 0.6 * rand(); }); });
      var r = E.recommend(E.compile(M2), S, pid, { horizon: 2, mode: mode, deep: false })[0].m.id;
      wins[r] = (wins[r] || 0) + 1;
      if (r === topId) same++;
    }
    function shifted(i, delta) {
      var s = { x: S.x.slice(), used: S.used, round: S.round, history: S.history };
      s.x[i] = clamp(s.x[i] + delta);
      return E.recommend(C, s, pid, { horizon: 2, mode: mode, deep: false })[0].score;
    }
    return {
      step: function () {
        if (!base) { base = E.recommend(C, S, pid, { horizon: 2, mode: mode, deep: false }); topId = base[0].m.id; return false; }
        if (n < N) { trial(); n++; return false; }
        if (t < C.n) { tornado.push({ dim: C.D[t], lo: shifted(t, -15), hi: shifted(t, 15) }); t++; return t >= C.n; }
        return true;
      },
      result: function () { return { top: topId, robustness: same / N, wins: wins, runs: N, tornado: tornado, baseScore: base[0].score }; }
    };
  };

  E.clamp = clamp;
  root.Engine = E;
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof self !== 'undefined' ? self : this);
