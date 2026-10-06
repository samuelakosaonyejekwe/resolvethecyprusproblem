/* Live intelligence: everything is fetched by the user's own browser, straight
   from public open-data services. No server of ours is involved. Results are
   cached on the device so the last picture stays available offline. */
(function (root) {
  'use strict';
  var KEY = 'cy.live.v1', MAX_AGE = 3 * 3600 * 1000;
  var L = { data: null, busy: false, listeners: [] };

  /* Text goes through the interface's translator when there is one. */
  function T(s) {
    var a = arguments;
    if (root.I18N) return root.I18N.T.apply(root.I18N, a);
    return String(s).replace(/\{(\d+)\}/g, function (m, i) { return a[+i + 1] === undefined ? m : a[+i + 1]; });
  }

  var THEMES = {
    talks: /\b(talks?|negotiat|envoy|guterres|settlement|reunif|federation|confidence[- ]building|crossing|informal meeting|peace process|holguin|holguín)/i,
    military: /\b(troops?|military|drill|exercise|warship|navy|naval|drone|missile|airspace|violation|buffer zone|unficyp|base|army|defen[cs]e)/i,
    energy: /\b(gas|energy|drilling|eez|pipeline|interconnector|electricity|lng|offshore|exxon|chevron|eni|aphrodite)/i,
    europe: /\b(eu|european|brussels|schengen|customs union|accession|commission|council presidency)/i,
    pressure: /\b(sanction|court|echr|ruling|lawsuit|resolution|condemn|embargo|property|recognition|two[- ]state)/i
  };

  function get(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 15000);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (txt) { return JSON.parse(txt); });
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  /* GDELT asks for at most one request every five seconds: every call to it
     takes a numbered place in one queue. */
  var nextSlot = 0;
  function gate() { var now = Date.now(), at = Math.max(now, nextSlot); nextSlot = at + 6500; return wait(at - now); }
  function iso(d) { return d.toISOString().slice(0, 10); }

  var GQ = encodeURIComponent('("cyprus problem" OR "cyprus issue" OR "cyprus talks" OR "turkish cypriot" OR "greek cypriot" OR "northern cyprus" OR "occupied cyprus" OR UNFICYP OR Varosha OR Erhurman OR Christodoulides) sourcelang:english');
  var ABOUT = /cypr|nicosia|varosha|famagusta|unficyp|erh[uü]rman|christodoulides|green line|buffer zone/i;

  var GQ2 = encodeURIComponent('cyprus (turkish OR reunification OR UNFICYP OR talks) sourcelang:english');

  function articles(q) {
    return get('https://api.gdeltproject.org/api/v2/doc/doc?query=' + q + '&mode=artlist&maxrecords=150&timespan=21d&sort=datedesc&format=json', 20000).then(function (j) {
      var seen = {};
      return (j.articles || []).filter(function (a) {
        var k = (a.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 60);
        if (!a.title || seen[k] || !ABOUT.test(a.title)) return false;
        seen[k] = 1; return true;
      }).slice(0, 40).map(function (a) {
        var themes = Object.keys(THEMES).filter(function (k) { return THEMES[k].test(a.title); });
        var d = a.seendate || '';
        return { title: a.title, url: a.url, domain: a.domain, country: a.sourcecountry,
          date: d ? d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) : '', themes: themes };
      });
    });
  }

  /* Precise query first; a broader one if it fails or returns too little. */
  function news() {
    function broad() { return gate().then(function () { return articles(GQ2); }); }
    return articles(GQ).then(function (list) { return list.length >= 5 ? list : broad().then(function (l2) { return l2.length > list.length ? l2 : list; }, function () { return list; }); }, broad);
  }

  function tone() {
    return get('https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent('cyprus (turkey OR turkish) sourcelang:english') + '&mode=timelinetone&timespan=4m&format=json', 20000).then(function (j) {
      var pts = ((j.timeline || [])[0] || {}).data || [];
      var v = pts.map(function (p) { return p.value; }).filter(function (n) { return typeof n === 'number'; });
      if (v.length < 20) throw new Error('short series');
      var cut = Math.max(1, Math.round(v.length * 14 / 120));
      function avg(a) { return a.reduce(function (s, n) { return s + n; }, 0) / a.length; }
      var step = Math.max(1, Math.floor(v.length / 60)), series = [];
      for (var i = 0; i < v.length; i += step) series.push(+avg(v.slice(i, i + step)).toFixed(2));
      return { recent: avg(v.slice(-cut)), base: avg(v.slice(0, -cut)), series: series };
    });
  }

  function lira() {
    var end = new Date(), start = new Date(end.getTime() - 366 * 864e5);
    return get('https://api.frankfurter.dev/v1/' + iso(start) + '..?base=EUR&symbols=TRY,USD').then(function (j) {
      var days = Object.keys(j.rates).sort(), s = days.map(function (d) { return j.rates[d].TRY; });
      var step = Math.max(1, Math.floor(s.length / 60)), series = [];
      for (var i = 0; i < s.length; i += step) series.push(+s[i].toFixed(2));
      var last = j.rates[days[days.length - 1]];
      return { date: days[days.length - 1], try: last.TRY, usd: last.USD, change: (s[s.length - 1] / s[0] - 1) * 100, series: series };
    });
  }

  var WB = {
    gdp: ['NY.GDP.MKTP.CD', 1e9, 1],
    growth: ['NY.GDP.MKTP.KD.ZG', 1, 1],
    infl: ['FP.CPI.TOTL.ZG', 1, 1],
    mil: ['MS.MIL.XPND.GD.ZS', 1, 2],
    milusd: ['MS.MIL.XPND.CD', 1e9, 1],
    pop: ['SP.POP.TOTL', 1e6, 1]
  };
  L.wbLabel = function (k) {
    return { gdp: T('GDP (US$ bn)'), growth: T('GDP growth (%)'), infl: T('Inflation (%)'), mil: T('Military spend (% GDP)'),
      milusd: T('Military spend (US$ bn)'), pop: T('Population (m)') }[k] || k;
  };

  function worldBank() {
    var out = {};
    return Promise.all(Object.keys(WB).map(function (k) {
      return get('https://api.worldbank.org/v2/country/CYP;TUR;GRC/indicator/' + WB[k][0] + '?format=json&mrnev=1').then(function (j) {
        var row = { dp: WB[k][2] };
        (j[1] || []).forEach(function (r) { row[r.countryiso3code] = r.value / WB[k][1]; row.year = r.date; });
        out[k] = row;
      }).catch(function () {});
    })).then(function () {
      if (!Object.keys(out).length) throw new Error('no indicators');
      return out;
    });
  }

  /* One batched request per 20 pages, to stay well inside Wikipedia's limits. */
  function wiki(titles) {
    var out = {}, groups = [];
    for (var i = 0; i < titles.length; i += 20) groups.push(titles.slice(i, i + 20));
    return Promise.all(groups.map(function (g) {
      return get('https://en.wikipedia.org/w/api.php?action=query&prop=extracts%7Cinfo&exintro=1&explaintext=1&exlimit=20&inprop=url&redirects=1&format=json&formatversion=2&origin=*&titles=' + encodeURIComponent(g.join('|'))).then(function (j) {
        var back = {};
        ((j.query || {}).normalized || []).concat((j.query || {}).redirects || []).forEach(function (r) { back[r.to] = back[r.from] || r.from; });
        ((j.query || {}).pages || []).forEach(function (p) {
          if (p.missing || !p.extract) return;
          var key = g.indexOf(p.title) >= 0 ? p.title : back[p.title] || p.title, x = p.extract.replace(/\s+/g, ' ').trim();
          if (x.length > 600) x = x.slice(0, x.lastIndexOf('. ', 600) + 1 || 600);
          out[key] = { extract: x, url: p.fullurl || '', updated: p.touched };
        });
      }).catch(function () {});
    })).then(function () {
      if (!Object.keys(out).length) throw new Error('no pages');
      return out;
    });
  }

  /* Recent scholarly work on the Cyprus question, newest first. */
  function research() {
    var from = iso(new Date(Date.now() - 3 * 366 * 864e5));
    return get('https://api.openalex.org/works?search=' + encodeURIComponent('Cyprus reunification OR "Cyprus problem" OR "Cyprus conflict" OR "Turkish Cypriot"') + '&filter=from_publication_date:' + from + ',type:article&sort=publication_date:desc&per-page=40&select=id,title,publication_date,doi,primary_location').then(function (j) {
      var seen = {};
      return (j.results || []).filter(function (w) {
        var k = (w.title || '').toLowerCase().slice(0, 50);
        if (!w.title || seen[k] || !/cypr/i.test(w.title) || w.publication_date > iso(new Date())) return false;
        seen[k] = 1; return true;
      }).slice(0, 12).map(function (w) {
        var src = (w.primary_location || {}).source || {};
        return { title: String(w.title).replace(/<[^>]+>/g, ''), date: w.publication_date, venue: src.display_name || '', url: w.doi || w.id };
      });
    });
  }

  /* ---------- evidence by subject ----------
     For the subject of any move, the current coverage: how much, whether it is
     rising, who is speaking, what meetings are being held. Fetched one subject
     at a time and kept for six hours. */
  var TKEY = 'cy.topics.v1', TOPIC_AGE = 6 * 3600 * 1000, topics = null, queue = [], pumping = false, tListeners = [];
  var SAID = /\b(says?|said|tells?|told|interview|speech|remarks|statement|warns?|urges?|calls? (for|on)|vows?|pledges?|rejects?|insists?|accuses?|announces?)\b/i;
  var MEET = /\b(summit|conference|council|meeting|meets?|talks|forum|assembly|visit|session|dialogue|trilateral)\b/i;

  function tload() {
    if (!topics) { try { topics = JSON.parse(localStorage.getItem(TKEY) || '{}') || {}; } catch (e) { topics = {}; } }
    return topics;
  }
  function tsave() { try { localStorage.setItem(TKEY, JSON.stringify(topics)); } catch (e) {} }

  function topicFetch(q, must, sub) {
    var about = must ? new RegExp(must, 'i') : null, on = sub ? new RegExp(sub, 'i') : null;
    return get('https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(q + ' sourcelang:english') + '&mode=artlist&maxrecords=250&timespan=21d&sort=datedesc&format=json', 25000).then(function (j) {
      var seen = {}, week = Date.now() - 7 * 864e5, n7 = 0;
      var items = (j.articles || []).filter(function (a) {
        var k = (a.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 60);
        if (!a.title || seen[k] || (about && !about.test(a.title)) || (on && !on.test(a.title))) return false;
        seen[k] = 1; return true;
      }).map(function (a) {
        var d = a.seendate || '', date = d ? d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) : '';
        if (date && new Date(date).getTime() >= week) n7 += 1;
        return { title: a.title, url: a.url, domain: a.domain, date: date, said: SAID.test(a.title), meet: MEET.test(a.title) };
      });
      var keep = items.filter(function (a) { return a.said; }).slice(0, 4).concat(items.filter(function (a) { return a.meet && !a.said; }).slice(0, 4), items.filter(function (a) { return !a.said && !a.meet; }).slice(0, 5));
      return { t: Date.now(), n7: n7, n21: items.length, said: items.filter(function (a) { return a.said; }).length, meet: items.filter(function (a) { return a.meet; }).length, items: keep };
    });
  }

  function pump() {
    if (pumping || !queue.length) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    pumping = true;
    var job = queue.shift();
    gate().then(function () { return topicFetch(job.q, job.must, job.sub); }).then(function (o) {
      tload()[job.id] = o; tsave();
      tListeners.forEach(function (f) { try { f(job.id, o); } catch (e) {} });
    }).catch(function () {
      var old = tload()[job.id] || {};
      old.fail = Date.now(); topics[job.id] = old; /* keep what we had; try again later */
    }).then(function () { pumping = false; pump(); });
  }

  L.topic = function (id) { var o = tload()[id]; return o && o.t ? o : null; };
  L.onTopic = function (f) { tListeners.push(f); };
  /* Ask for subjects; `first` puts them at the head of the queue. */
  L.want = function (list, first) {
    var add = list.filter(function (x) {
      var o = tload()[x.id];
      if (o && o.t && Date.now() - o.t < TOPIC_AGE) return false;
      if (o && o.fail && Date.now() - o.fail < 10 * 60 * 1000) return false;
      return true;
    });
    queue = queue.filter(function (x) { return !add.some(function (y) { return y.id === x.id; }); });
    queue = first ? add.concat(queue) : queue.concat(add);
    pump();
  };
  L.pending = function (id) { return queue.some(function (x) { return x.id === id; }); };
  /* Is the subject climbing the world's agenda, holding, fading or absent? */
  L.momentum = function (o) {
    if (!o) return null;
    var prev = (o.n21 - o.n7) / 2;
    if (o.n21 < 3) return 'quiet';
    if (o.n7 >= 3 && o.n7 >= 1.5 * Math.max(prev, 1)) return 'rising';
    if (o.n21 >= 6 && o.n7 <= 0.5 * prev) return 'fading';
    return 'steady';
  };

  /* Convert raw feeds into small, capped, transparent adjustments of the model.
     Only numbers are kept here; the wording is produced by L.sigText when shown,
     so saved data reads in whatever language is current. */
  function signals(d) {
    var s = [], cap = function (v, m) { return Math.max(-m, Math.min(m, v)); };
    if (d.tone) {
      var dt = d.tone.recent - d.tone.base;
      s.push({ id: 'tone', dim: 'stability', adj: Math.round(cap(dt * 4, 8)), dt: dt });
    }
    if (d.news && d.news.length >= 8) {
      var n = d.news.length, c = {};
      Object.keys(THEMES).forEach(function (k) { c[k] = d.news.filter(function (a) { return a.themes.indexOf(k) >= 0; }).length / n; });
      s.push({ id: 'talks', dim: 'trust', adj: Math.round(cap((c.talks - 0.3) * 15, 5)), share: c.talks });
      s.push({ id: 'mil', dim: 'stability', adj: Math.round(cap((0.25 - c.military) * 15, 5)), share: c.military });
      s.push({ id: 'press', dim: 'pressure', adj: Math.round(cap((c.pressure - 0.2) * 15, 5)), share: c.pressure });
    }
    if (d.fx) {
      var dep = d.fx.change, k = Math.max(0, Math.min(0.4, dep / 100));
      s.push({ id: 'lira', weight: { player: 'TR', dims: ['trwest', 'econ'], factor: +(1 + k).toFixed(2) }, dep: dep, rate: d.fx.try });
    }
    return s;
  }

  /* Label, reading and reasoning of one signal, in the current language. */
  L.sigText = function (s) {
    var share = Math.round((s.share || 0) * 100) + '%';
    if (s.id === 'tone') return { label: T('News tone on Cyprus–Türkiye'), value: T('{0} vs 4-month average', (s.dt >= 0 ? '+' : '') + s.dt.toFixed(2)),
      why: s.dt >= 0 ? T('Coverage over the last two weeks is calmer than the four-month norm.') : T('Coverage over the last two weeks is more hostile than the four-month norm.') };
    if (s.id === 'talks') return { label: T('Share of headlines about talks'), value: share, why: T('A busy negotiation agenda signals diplomatic momentum; silence signals drift.') };
    if (s.id === 'mil') return { label: T('Share of headlines about military matters'), value: share, why: T('Heavier military coverage is treated as a sign of rising friction.') };
    if (s.id === 'press') return { label: T('Share of headlines about legal / sanctions pressure'), value: share, why: T('More court, sanctions and resolution coverage means more live pressure on the status quo.') };
    if (s.id === 'lira') return { label: T('Lira against the euro, 12 months'), value: (s.dep >= 0 ? '−' : '+') + Math.abs(s.dep).toFixed(1) + '% (€1 = ₺' + s.rate.toFixed(2) + ')',
      why: T('A weaker lira raises the value Ankara places on Western capital, trade and market access.') };
    return { label: s.id, value: '', why: '' };
  };

  /* Theme names: as filter buttons and as the small tags on each headline. */
  L.themes = Object.keys(THEMES);
  L.themeName = function (k) { return { talks: T('Talks'), military: T('Military'), energy: T('Energy'), europe: T('Europe'), pressure: T('Pressure') }[k] || k; };
  L.themeTag = function (k) { return { talks: T('talks'), military: T('military'), energy: T('energy'), europe: T('europe'), pressure: T('pressure') }[k] || k; };

  function load() {
    if (L.data) return L.data;
    try { L.data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { L.data = null; }
    if (L.data) L.data.signals = signals(L.data); /* rebuilt, so copies saved by earlier versions carry no wording */
    return L.data;
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(L.data)); } catch (e) {} }
  function emit() { L.listeners.forEach(function (f) { try { f(L.data, L.busy); } catch (e) {} }); }

  L.onChange = function (f) { L.listeners.push(f); };
  L.get = load;
  L.stale = function () { var d = load(); return !d || Date.now() - d.t > MAX_AGE; };

  /* Each source succeeds or fails on its own; old values are kept on failure. */
  L.refresh = function (wikiTitles) {
    if (L.busy) return Promise.resolve(load());
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(load());
    L.busy = true; emit();
    var d = Object.assign({ status: {} }, load() || {});
    d.status = Object.assign({}, d.status);
    function part(name, p) {
      return p.then(function (v) { d[name] = v; d.status[name] = { ok: true, t: Date.now() }; })
        .catch(function (e) { d.status[name] = { ok: false, t: Date.now(), err: String(e && e.message || e), kept: !!d[name] }; })
        .then(function () { d.signals = signals(d); if (d.status[name].ok) d.t = Date.now(); L.data = d; save(); emit(); });
    }
    /* GDELT asks for at most one request every five seconds. */
    function retry(f) { return gate().then(f).catch(function () { return gate().then(f); }); }
    var gd = part('news', retry(news)).then(function () { return part('tone', retry(tone)); });
    return Promise.all([gd, part('fx', lira()), part('wb', worldBank()), part('wiki', wiki(wikiTitles || [])), part('research', research())]).then(function () {
      var ok = Object.keys(d.status).some(function (k) { return d.status[k].ok && Date.now() - d.status[k].t < 60000; });
      if (ok) d.t = Date.now();
      L.data = d; L.busy = false; save(); emit();
      return d;
    });
  };

  L.sources = function () {
    return [
      { id: 'research', name: 'OpenAlex', what: T('Recent scholarly articles on the Cyprus question'), url: 'https://openalex.org/' },
      { id: 'topics', name: T('GDELT Project'), what: T('Current coverage, statements and meetings on the subject of each move (last 21 days)'), url: 'https://www.gdeltproject.org/' },
      { id: 'news', name: T('GDELT Project'), what: T('Worldwide news index: headlines mentioning the Cyprus question (last 21 days)'), url: 'https://www.gdeltproject.org/' },
      { id: 'tone', name: T('GDELT Project'), what: T('Average tone of Cyprus–Türkiye coverage (four months)'), url: 'https://www.gdeltproject.org/' },
      { id: 'fx', name: T('Frankfurter (ECB reference rates)'), what: T('Euro–lira and euro–dollar exchange rates'), url: 'https://frankfurter.dev/' },
      { id: 'wb', name: T('World Bank Open Data'), what: T('GDP, growth, inflation, military spending, population for Cyprus, Türkiye, Greece'), url: 'https://data.worldbank.org/' },
      { id: 'wiki', name: T('Wikipedia'), what: T('Current summaries of past plans, talks, rulings and comparable cases'), url: 'https://en.wikipedia.org/' }
    ];
  };

  root.Live = L;
})(typeof self !== 'undefined' ? self : this);
