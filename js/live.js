/* Live intelligence: everything is fetched by the user's own browser, straight
   from public open-data services. No server of ours is involved. Results are
   cached on the device so the last picture stays available offline. */
(function (root) {
  'use strict';
  var KEY = 'cy.live.v1', MAX_AGE = 3 * 3600 * 1000;
  var L = { data: null, busy: false, listeners: [] };

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
  function iso(d) { return d.toISOString().slice(0, 10); }

  var GQ = encodeURIComponent('(cyprus OR "turkish cypriot" OR "greek cypriot") (reunification OR talks OR "buffer zone" OR UNFICYP OR occupation OR settlement OR "two-state" OR Varosha OR Erdogan OR Erhurman OR Christodoulides) sourcelang:english');

  function news() {
    return get('https://api.gdeltproject.org/api/v2/doc/doc?query=' + GQ + '&mode=artlist&maxrecords=60&timespan=21d&sort=datedesc&format=json', 20000).then(function (j) {
      var seen = {};
      return (j.articles || []).filter(function (a) {
        var k = (a.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 60);
        if (!a.title || seen[k]) return false;
        seen[k] = 1; return true;
      }).slice(0, 40).map(function (a) {
        var themes = Object.keys(THEMES).filter(function (k) { return THEMES[k].test(a.title); });
        var d = a.seendate || '';
        return { title: a.title, url: a.url, domain: a.domain, country: a.sourcecountry,
          date: d ? d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) : '', themes: themes };
      });
    });
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
    gdp: ['NY.GDP.MKTP.CD', 'GDP (US$ bn)', 1e9, 1],
    growth: ['NY.GDP.MKTP.KD.ZG', 'GDP growth (%)', 1, 1],
    infl: ['FP.CPI.TOTL.ZG', 'Inflation (%)', 1, 1],
    mil: ['MS.MIL.XPND.GD.ZS', 'Military spend (% GDP)', 1, 2],
    milusd: ['MS.MIL.XPND.CD', 'Military spend (US$ bn)', 1e9, 1],
    pop: ['SP.POP.TOTL', 'Population (m)', 1e6, 1]
  };

  function worldBank() {
    var out = {};
    return Promise.all(Object.keys(WB).map(function (k) {
      return get('https://api.worldbank.org/v2/country/CYP;TUR;GRC/indicator/' + WB[k][0] + '?format=json&mrnev=1').then(function (j) {
        var row = { label: WB[k][1], dp: WB[k][3] };
        (j[1] || []).forEach(function (r) { row[r.countryiso3code] = r.value / WB[k][2]; row.year = r.date; });
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

  /* Convert raw feeds into small, capped, transparent adjustments of the model. */
  function signals(d) {
    var s = [], cap = function (v, m) { return Math.max(-m, Math.min(m, v)); };
    if (d.tone) {
      var dt = d.tone.recent - d.tone.base, adj = Math.round(cap(dt * 4, 8));
      s.push({ id: 'tone', label: 'News tone on Cyprus–Türkiye', value: (dt >= 0 ? '+' : '') + dt.toFixed(2) + ' vs 4-month average',
        dim: 'stability', adj: adj, why: 'Coverage over the last two weeks is ' + (dt >= 0 ? 'calmer' : 'more hostile') + ' than the four-month norm.' });
    }
    if (d.news && d.news.length >= 8) {
      var n = d.news.length, c = {};
      Object.keys(THEMES).forEach(function (k) { c[k] = d.news.filter(function (a) { return a.themes.indexOf(k) >= 0; }).length / n; });
      s.push({ id: 'talks', label: 'Share of headlines about talks', value: Math.round(c.talks * 100) + '%', dim: 'trust',
        adj: Math.round(cap((c.talks - 0.3) * 15, 5)), why: 'A busy negotiation agenda signals diplomatic momentum; silence signals drift.' });
      s.push({ id: 'mil', label: 'Share of headlines about military matters', value: Math.round(c.military * 100) + '%', dim: 'stability',
        adj: Math.round(cap((0.25 - c.military) * 15, 5)), why: 'Heavier military coverage is treated as a sign of rising friction.' });
      s.push({ id: 'press', label: 'Share of headlines about legal / sanctions pressure', value: Math.round(c.pressure * 100) + '%', dim: 'pressure',
        adj: Math.round(cap((c.pressure - 0.2) * 15, 5)), why: 'More court, sanctions and resolution coverage means more live pressure on the status quo.' });
    }
    if (d.fx) {
      var dep = d.fx.change, k = Math.max(0, Math.min(0.4, dep / 100));
      s.push({ id: 'lira', label: 'Lira against the euro, 12 months', value: (dep >= 0 ? '−' : '+') + Math.abs(dep).toFixed(1) + '% (€1 = ₺' + d.fx.try.toFixed(2) + ')',
        weight: { player: 'TR', dims: ['trwest', 'econ'], factor: +(1 + k).toFixed(2) },
        why: 'A weaker lira raises the value Ankara places on Western capital, trade and market access.' });
    }
    return s;
  }

  function load() {
    if (L.data) return L.data;
    try { L.data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { L.data = null; }
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
    function retry(f) { return f().catch(function () { return wait(6500).then(f); }); }
    var gd = part('news', retry(news)).then(function () { return wait(6000); }).then(function () { return part('tone', retry(tone)); });
    return Promise.all([gd, part('fx', lira()), part('wb', worldBank()), part('wiki', wiki(wikiTitles || []))]).then(function () {
      var ok = Object.keys(d.status).some(function (k) { return d.status[k].ok && Date.now() - d.status[k].t < 60000; });
      if (ok) d.t = Date.now();
      L.data = d; L.busy = false; save(); emit();
      return d;
    });
  };

  L.sources = [
    { id: 'news', name: 'GDELT Project', what: 'Worldwide news index: headlines mentioning the Cyprus question (last 21 days)', url: 'https://www.gdeltproject.org/' },
    { id: 'tone', name: 'GDELT Project', what: 'Average tone of Cyprus–Türkiye coverage (four months)', url: 'https://www.gdeltproject.org/' },
    { id: 'fx', name: 'Frankfurter (ECB reference rates)', what: 'Euro–lira and euro–dollar exchange rates', url: 'https://frankfurter.dev/' },
    { id: 'wb', name: 'World Bank Open Data', what: 'GDP, growth, inflation, military spending, population for Cyprus, Türkiye, Greece', url: 'https://data.worldbank.org/' },
    { id: 'wiki', name: 'Wikipedia', what: 'Current summaries of past plans, talks, rulings and comparable cases', url: 'https://en.wikipedia.org/' }
  ];

  root.Live = L;
})(typeof self !== 'undefined' ? self : this);
