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
    return get('https://api.gdeltproject.org/api/v2/doc/doc?query=' + q + '&mode=artlist&maxrecords=250&timespan=21d&sort=datedesc&format=json', 25000).then(function (j) {
      var seen = {};
      return (j.articles || []).filter(function (a) {
        var k = (a.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 60);
        if (!a.title || seen[k] || !ABOUT.test(a.title)) return false;
        seen[k] = 1; return true;
      }).slice(0, 150).map(function (a) {
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

  /* A second, wider sweep for the practical subjects: energy, defence, partners. */
  var GQ3 = encodeURIComponent('cyprus (gas OR energy OR interconnector OR defence OR defense OR "national guard" OR israel OR egypt OR "united states" OR sanctions OR bases OR crossing OR property OR referendum) sourcelang:english');
  function feed() { return articles(GQ3); }

  /* Attention: daily readers of each subject's reference articles on Wikipedia,
     last five weeks. Returns { subject: { r7, r28, series } }. */
  function attention(map) {
    var end = new Date(Date.now() - 864e5), start = new Date(end.getTime() - 34 * 864e5);
    function ymd(d) { return iso(d).replace(/-/g, ''); }
    var titles = [], views = {};
    Object.keys(map).forEach(function (t) { map[t].forEach(function (a) { if (titles.indexOf(a) < 0) titles.push(a); }); });
    function one(a) {
      return get('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/' + encodeURIComponent(a.replace(/ /g, '_')) + '/daily/' + ymd(start) + '/' + ymd(end)).then(function (j) {
        views[a] = (j.items || []).map(function (i) { return i.views; });
      }).catch(function () {});
    }
    /* a few at a time */
    var i = 0;
    function worker() { return i < titles.length ? one(titles[i++]).then(worker) : Promise.resolve(); }
    return Promise.all([worker(), worker(), worker(), worker()]).then(function () {
      var out = {};
      Object.keys(map).forEach(function (t) {
        var series = [];
        map[t].forEach(function (a) { (views[a] || []).forEach(function (v, k) { series[k] = (series[k] || 0) + v; }); });
        if (series.length < 21) return;
        function avg(x) { return x.reduce(function (p, c) { return p + c; }, 0) / x.length; }
        out[t] = { r7: Math.round(avg(series.slice(-7))), r28: Math.round(avg(series.slice(0, -7))), series: series };
      });
      if (!Object.keys(out).length) throw new Error('no readership data');
      return out;
    });
  }

  /* ---------- the press itself ----------
     Newspapers that publish an open headline feed are read directly, in their
     own language: Greek Cypriot, Turkish Cypriot, Greek and regional titles.
     This does not pass through any news index. */
  var EL_CY = ['Κυπριακό', 'κατεχόμενα', 'Τουρκία'], EL_GR = ['Κυπριακό', 'Κύπρος'], TR_CY = ['Kıbrıs sorunu', 'Erhürman', 'müzakere'], TR_TR = ['Kıbrıs'];
  var PRESS = [
    { name: 'Philenews', host: 'philenews.com', lang: 'el', cy: true, side: 'gc', q: EL_CY },
    { name: 'Dialogos', host: 'dialogos.com.cy', lang: 'el', cy: true, side: 'gc', q: EL_CY },
    { name: 'Alpha News', host: 'www.alphanews.live', lang: 'el', cy: true, side: 'gc', q: EL_CY },
    { name: '24h', host: 'www.24h.com.cy', lang: 'el', cy: true, side: 'gc', q: EL_CY },
    { name: 'Financial Mirror', host: 'www.financialmirror.com', lang: 'en', cy: true, side: 'gc', q: ['Cyprus problem', 'Turkish Cypriot', 'Turkey'] },
    { name: 'Kıbrıs Gazetesi', host: 'kibrisgazetesi.com', lang: 'tr', cy: true, side: 'tc', q: TR_CY },
    { name: 'Havadis', host: 'www.havadiskibris.com', lang: 'tr', cy: true, side: 'tc', q: TR_CY },
    { name: 'Yeni Bakış', host: 'www.yenibakisgazetesi.com', lang: 'tr', cy: true, side: 'tc', q: TR_CY },
    { name: 'Özgür Gazete', host: 'ozgurgazetekibris.com', lang: 'tr', cy: true, side: 'tc', q: TR_CY },
    { name: 'Gazedda', host: 'www.gazeddakibris.com', lang: 'tr', cy: true, side: 'tc', q: TR_CY },
    { name: 'ERT News', host: 'www.ertnews.gr', lang: 'el', side: 'gr', q: EL_GR },
    { name: 'Hellenic News', host: 'hellenicnews.com', lang: 'el', side: 'gr', q: EL_GR },
    { name: 'Greek News USA', host: 'www.greeknewsusa.com', lang: 'el', side: 'gr', q: EL_GR },
    { name: 'Greek City Times', host: 'greekcitytimes.com', lang: 'en', side: 'gr', q: ['Cyprus'] },
    { name: 'Naftemporiki', host: 'www.naftemporiki.gr', lang: 'en', side: 'gr', q: ['Cyprus'] },
    { name: 'Pappas Post', host: 'www.pappaspost.com', lang: 'en', side: 'gr', q: ['Cyprus'] },
    { name: 'Diken', host: 'www.diken.com.tr', lang: 'tr', side: 'tr', q: TR_TR },
    { name: 'Medyascope', host: 'medyascope.tv', lang: 'tr', side: 'tr', q: TR_TR },
    { name: 'Serbestiyet', host: 'serbestiyet.com', lang: 'tr', side: 'tr', q: TR_TR },
    { name: 'Politics Today', host: 'politicstoday.org', lang: 'en', side: 'tr', q: ['Cyprus'] },
    { name: 'Daily News Egypt', host: 'www.dailynewsegypt.com', lang: 'en', side: 'reg', q: ['Cyprus'] },
    { name: 'The Media Line', host: 'themedialine.org', lang: 'en', side: 'reg', q: ['Cyprus'] },
    { name: 'Middle East Monitor', host: 'www.middleeastmonitor.com', lang: 'en', side: 'reg', q: ['Cyprus'] }
  ];
  function plain(h) {
    return String(h || '').replace(/<[^>]+>/g, '').replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); })
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function press() {
    var after = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 19), far = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 19), out = [], seen = {}, okSources = 0;
    var jobs = [];
    PRESS.forEach(function (src) { src.q.forEach(function (q) { jobs.push({ src: src, q: q }); }); });
    var i = 0;
    function one(job) {
      return get('https://' + job.src.host + '/wp-json/wp/v2/posts?per_page=50&_fields=title,link,date&after=' + (job.src.side === 'reg' || job.src.side === 'tr' && job.src.lang === 'en' ? far : after) + '&search=' + encodeURIComponent(job.q), 20000).then(function (list) {
        if (!Array.isArray(list)) return;
        job.src.ok = true;
        list.forEach(function (x) {
          var t = plain((x.title || {}).rendered), k = t.toLowerCase().slice(0, 70);
          if (!t || seen[k]) return;
          seen[k] = 1;
          out.push({ title: t, url: x.link, domain: job.src.name, date: String(x.date || '').slice(0, 10), lang: job.src.lang, cy: !!job.src.cy, side: job.src.side });
        });
      }).catch(function () {});
    }
    function worker() { return i < jobs.length ? one(jobs[i++]).then(worker) : Promise.resolve(); }
    return Promise.all([worker(), worker(), worker(), worker(), worker()]).then(function () {
      PRESS.forEach(function (x) { if (x.ok) okSources += 1; });
      if (!out.length) throw new Error('no newspaper feed answered');
      out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      /* keep only what the tool uses: headlines that belong to a subject or to a
         stakeholder, and the newest few in each language for the reading list */
      var per = {}, total = out.length;
      var kept = out.filter(function (a) {
        a.title = a.title.slice(0, 170);
        per[a.lang] = (per[a.lang] || 0) + 1;
        return per[a.lang] <= 25 || useful(a);
      });
      return { n: okSources, total: total, items: kept.slice(0, 500) };
    });
  }
  L.pressNames = PRESS.map(function (x) { return x.name; });
  var USE = null;
  function useful(a) {
    if (!USE) {
      var parts = [];
      Object.keys(SUB_EL).forEach(function (t) { parts.push(SUB_EL[t], SUB_TR[t]); if (TOP && TOP[t] && TOP[t].sub) parts.push(TOP[t].sub); });
      Object.keys(VOICE).forEach(function (p) { parts.push(VOICE[p]); });
      try { USE = new RegExp(parts.join('|'), 'i'); } catch (e) { USE = /./; }
    }
    return USE.test(a.title);
  }

  /* ---------- official records ----------
     What governments themselves have published: statements on their own
     websites, answers to parliament, bills and formal notices. Each source is
     tried on its own; one that fails keeps what it gave last time. */
  var CYQ = /cyprus problem|cyprus issue|cyprus question|turk|türk|occup|settlement|reunif|talks|unficyp|united nations|missing persons|enclaved|buffer zone|famagusta|varosha|κυπριακ|τουρκ|κατοχ|κατεχ/i;
  function wpPosts(host, q) {
    var after = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 19);
    return get('https://' + host + '/wp-json/wp/v2/posts?per_page=30&_fields=title,link,date&after=' + after + '&search=' + encodeURIComponent(q), 20000).then(function (l) {
      return (Array.isArray(l) ? l : []).map(function (x) { return { title: plain((x.title || {}).rendered), date: String(x.date || '').slice(0, 10), url: x.link }; });
    });
  }
  var OFFICIAL = {
    govcy: { actor: 'ROC', body: 'Government of the Republic of Cyprus', kind: 'statement', run: function () {
      return Promise.all([wpPosts('www.gov.cy', 'Cyprus problem'), wpPosts('www.gov.cy', 'Turkish')]).then(function (r) { return r[0].concat(r[1]).filter(function (x) { return CYQ.test(x.title); }); }); } },
    grpm: { actor: 'GR', body: 'Prime Minister of Greece', kind: 'statement', run: function () {
      return Promise.all([wpPosts('www.primeminister.gr', 'Cyprus'), wpPosts('www.primeminister.gr', 'Κύπρος')]).then(function (r) { return r[0].concat(r[1]); }); } },
    grmfa: { actor: 'GR', body: 'Ministry of Foreign Affairs of Greece', kind: 'statement', run: function () {
      return Promise.all([wpPosts('www.mfa.gr', 'Κυπριακό'), wpPosts('www.mfa.gr', 'Cyprus')]).then(function (r) { return r[0].concat(r[1]); }); } },
    govuk: { actor: 'UK', body: 'UK Foreign, Commonwealth and Development Office', kind: 'statement', run: function () {
      return get('https://www.gov.uk/api/search.json?q=cyprus&filter_organisations=foreign-commonwealth-development-office&order=-public_timestamp&count=40&fields=title,link,public_timestamp,description', 20000).then(function (j) {
        return (j.results || []).filter(function (r) { return /cypr/i.test(r.title || '') && !/travel advice|living in|tax|visa|passport|consular|hospital|doctors|lawyers|funeral|prisoner/i.test(r.title || ''); }).map(function (r) { return { title: r.title, date: String(r.public_timestamp || '').slice(0, 10), url: 'https://www.gov.uk' + r.link, detail: r.description || '' }; });
      }); } },
    ukparl: { actor: 'UK', body: 'UK ministers\' written answers to Parliament', kind: 'answer', run: function () {
      return get('https://questions-statements-api.parliament.uk/api/writtenquestions/questions?searchTerm=Cyprus&take=20&answered=Answered', 40000).then(function (j) {
        return (j.results || []).map(function (r) { return r.value || {}; }).filter(function (v) { return v.answerText && /cypr/i.test(v.questionText || ''); }).map(function (v) {
          var d = String(v.dateTabled || '').slice(0, 10), ans = plain(v.answerText);
          return { title: plain(v.questionText).replace(/^To ask (His Majesty's Government|the Secretary of State[^,]*,)\s*/i, '').slice(0, 240), date: String(v.dateAnswered || v.dateTabled || '').slice(0, 10), body: v.answeringBodyName || '',
            detail: ans.length > 420 ? ans.slice(0, ans.lastIndexOf(' ', 420)) + '…' : ans, url: 'https://questions-statements.parliament.uk/written-questions/detail/' + d + '/' + encodeURIComponent(v.uin || '') };
        });
      }); } },
    uscong: { actor: 'US', body: 'United States Congress', kind: 'record', run: function () {
      return get('https://www.govtrack.us/api/v2/bill?q=Cyprus&order_by=-introduced_date&limit=15', 20000).then(function (j) {
        return (j.objects || []).filter(function (o) { return /cyprus|turk|hellenic|eastern mediterranean/i.test(o.title || ''); }).map(function (o) { return { title: o.title, date: o.current_status_date || o.introduced_date, url: o.link, detail: o.current_status_label || '' }; });
      }); } },
    usfr: { actor: 'US', body: 'United States Federal Register', kind: 'record', run: function () {
      return get('https://www.federalregister.gov/api/v1/documents.json?conditions%5Bterm%5D=Cyprus&per_page=40&order=newest', 20000).then(function (j) {
        return (j.results || []).filter(function (r) { return /cyprus|turkey|türkiye|arms regulations/i.test(r.title || ''); }).map(function (r) { return { title: r.title, date: r.publication_date, url: r.html_url, body: ((r.agencies || [])[0] || {}).name || '', detail: r.type || '' }; });
      }); } },
    tcpio: { actor: 'TC', body: 'Turkish Cypriot administration, Public Information Office', kind: 'statement', run: function () {
      var qs = ['Kıbrıs sorunu', 'Cumhurbaşkanı', 'Dışişleri', 'Erdoğan', 'Fidan', 'MSB'];
      return Promise.all(qs.map(function (q) { return wpPosts('pio.mfa.gov.ct.tr', q).catch(function () { return []; }); })).then(function (r) {
        var all = []; r.forEach(function (x) { all = all.concat(x); });
        return all.map(function (x) {
          /* statements issued by Ankara and carried here word for word are Ankara's */
          if (/^(cumhurbaşkanı |tc cumhurbaşkanı |türkiye cumhurbaşkanı |bakan )?(erdoğan|fidan|cevdet yılmaz|yılmaz:|tc dışişleri|türkiye dışişleri|türkiye msb|tc msb|msb)/i.test(x.title)) { x.actor = 'TR'; x.body = 'Ankara, as published by the Turkish Cypriot Public Information Office'; }
          x.lang = 'tr';
          return x;
        }).filter(function (x) { return x.actor === 'TR' ? /kıbrıs|kktc|rum|ada/i.test(x.title) : /kıbrıs sorunu|müzakere|çözüm|rum |federasyon|egemen|iki devlet|\bbm\b|holguin|guterres|garant|tanın|ambargo|izolasyon/i.test(x.title); });
      }); } },
    ec: { actor: 'EU', body: 'European Commission', kind: 'statement', run: function () {
      return get('https://ec.europa.eu/commission/presscorner/api/search?language=en&text=Cyprus&pagesize=50', 20000).then(function (j) {
        return (j.docuLanguageListResources || []).filter(function (r) { return /cyprus (problem|issue|settlement|talks|reunification)|representative for cyprus|cyprus.{0,40}(türkiye|turkey)|türkiye|turkey|eastern mediterranean/i.test(r.title || ''); }).map(function (r) {
          return { title: r.title, date: r.eventDate, url: 'https://ec.europa.eu/commission/presscorner/detail/en/' + String(r.refCode || '').replace(/\//g, '_'), detail: r.leadText && r.leadText !== 'None' ? plain(r.leadText).slice(0, 300) : '' };
        });
      }); } }
  };
  L.officialBodies = Object.keys(OFFICIAL).map(function (k) { return OFFICIAL[k].body; });
  function official() {
    var prev = (load() || {}).official || {}, out = {}, fresh = 0;
    function one(k) {
      var src = OFFICIAL[k];
      function attempt() { return src.run(); }
      return attempt().catch(function () { return wait(2500).then(attempt); }).catch(function () { return wait(6000).then(attempt); }).then(function (items) {
        var seen = {};
        items = (items || []).filter(function (x) { var q = (x.title || '').toLowerCase().slice(0, 70); if (!x.title || seen[q]) return false; seen[q] = 1; return true; })
          .sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; }).slice(0, k === 'tcpio' ? 24 : 10)
          .map(function (x) { return { title: x.title, date: x.date || '', url: x.url || '', body: x.body || src.body, detail: x.detail || '', actor: x.actor || src.actor, kind: src.kind, src: k, lang: x.lang || 'en' }; });
        if (!items.length && prev[k] && prev[k].items && prev[k].items.length) { out[k] = prev[k]; return; }
        out[k] = { t: Date.now(), items: items }; fresh += 1;
      }).catch(function () { if (prev[k]) out[k] = prev[k]; });
    }
    return Promise.all(Object.keys(OFFICIAL).map(one)).then(function () {
      if (!Object.keys(out).some(function (k) { return out[k].items && out[k].items.length; })) throw new Error('no official source answered');
      return out;
    });
  }
  L.officialItems = function () {
    var o = (load() || {}).official || {}, all = [];
    Object.keys(o).forEach(function (k) { if (o[k] && o[k].items) all = all.concat(o[k].items); });
    return all.sort(function (a, b) { return String(a.date) < String(b.date) ? 1 : -1; });
  };

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

  /* Recent scholarly work on the Cyprus question, newest first: OpenAlex,
     with Crossref as a second source if it is unreachable or thin. */
  var RTOPIC = /cyprus (conflict|problem|issue|question|dispute|talks|peace|policy)|reunif|peace (process|negotiat|initiative)|negotiat|partition|federa|unficyp|buffer zone|bi-?communal|geopolit|occupation|sovereign|guarantor|maritime|\beez\b|natural gas|hydrocarbon|refugee|displace|the missing|nationalis|referendum|annan|green line|divided|division|security|foreign policy|europeani[sz]|turkish[- ]cypriots?|greek[- ]cypriots?|memory|identity/i;
  var ROFF = /beetle|species|coleoptera|genotype|archaeo|bronze age|romantic|nursing|students|patients|clinical|tourism|gastronom|melon|soil|covid|prevalence|hotel|marketing|teachers|school principals|food|dental|surgery|cancer|implant|banking sector/i;
  function research() {
    var from = iso(new Date(Date.now() - 3 * 366 * 864e5)), today = iso(new Date());
    function tidy(list) {
      var seen = {};
      return list.filter(function (w) {
        var k = (w.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 50);
        if (!w.title || seen[k] || !/cypr|kıbrıs|kibris/i.test(w.title) || !RTOPIC.test(w.title) || ROFF.test(w.title) || (w.date || '') > today) return false;
        seen[k] = 1; return true;
      }).sort(function (x, y) { return x.date < y.date ? 1 : -1; }).slice(0, 15);
    }
    var terms = ['cyprus conflict', 'cyprus reunification', 'cyprus problem', 'cyprus issue', 'cyprus question', 'cyprus dispute', 'cyprus peace', 'cyprus negotiations', 'cyprus settlement', 'cyprus partition', 'cyprus federation', 'turkish cypriots', 'greek cypriots', 'cyprus turkey', 'cyprus geopolitics', 'cyprus energy', 'cyprus security', 'divided cyprus', 'cyprus buffer zone'];
    function openalex() {
      return get('https://api.openalex.org/works?filter=' + encodeURIComponent('title.search:' + terms.join('|') + ',from_publication_date:' + from) + '&sort=publication_date:desc&per-page=200&select=id,title,publication_date,doi,primary_location', 25000).then(function (j) {
        return (j.results || []).map(function (w) { return { title: String(w.title || '').replace(/<[^>]+>/g, ''), date: w.publication_date || '', venue: ((w.primary_location || {}).source || {}).display_name || '', url: w.doi || w.id }; });
      });
    }
    function crossref() {
      return get('https://api.crossref.org/works?query.title=' + encodeURIComponent('Cyprus conflict reunification Turkish Cypriot') + '&filter=from-pub-date:' + from + '&sort=published&order=desc&rows=200&select=title,DOI,published,container-title', 25000).then(function (j) {
        return (((j.message || {}).items) || []).map(function (w) {
          var dp = ((w.published || {})['date-parts'] || [[]])[0] || [];
          return { title: String((w.title || [''])[0]).replace(/<[^>]+>/g, ''), date: dp.length ? dp[0] + '-' + ('0' + (dp[1] || 1)).slice(-2) + '-' + ('0' + (dp[2] || 1)).slice(-2) : '', venue: (w['container-title'] || [''])[0], url: w.DOI ? 'https://doi.org/' + w.DOI : '' };
        });
      });
    }
    return openalex().catch(function () { return []; }).then(function (a) {
      var list = tidy(a);
      if (list.length >= 8) return list;
      return crossref().catch(function () { return []; }).then(function (b) {
        var both = tidy(a.concat(b));
        if (!both.length) throw new Error('no research found');
        return both;
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
      return { t: Date.now(), items: items.slice(0, 20) };
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
      tListeners.forEach(function (f) { try { f(job.id, null); } catch (e) {} });
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
  L.failed = function (id) { var o = tload()[id]; return !!(o && !o.t && o.fail); };
  L.pending = function (id) { return queue.some(function (x) { return x.id === id; }); };
  /* Is the subject climbing the world's agenda, holding or fading? Judged from
     readership in the last week against the four weeks before. */
  L.agenda = function (id) {
    var d = load(), o = d && d.attn ? d.attn[id] : null;
    if (!o || !o.r28) return null;
    var ratio = o.r7 / o.r28;
    return { r7: o.r7, r28: o.r28, ratio: ratio, series: o.series, k: ratio >= 1.25 ? 'rising' : ratio <= 0.8 ? 'fading' : 'steady' };
  };
  /* Headlines the user has marked as wrongly sorted are left out everywhere. */
  var HKEY = 'cy.hide.v1', hidden = null;
  function hid() { if (!hidden) { try { hidden = JSON.parse(localStorage.getItem(HKEY) || '{}') || {}; } catch (e) { hidden = {}; } } return hidden; }
  function hkey(t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').slice(0, 80); }
  L.hide = function (title) { hid()[hkey(title)] = 1; try { localStorage.setItem(HKEY, JSON.stringify(hidden)); } catch (e) {} emit(); };
  L.hiddenCount = function () { return Object.keys(hid()).length; };
  L.unhideAll = function () { hidden = {}; try { localStorage.removeItem(HKEY); } catch (e) {} emit(); };

  /* The same story carried by several papers is one story. Two headlines are
     taken as the same story when most of their words coincide. */
  var SPLIT;
  try { SPLIT = new RegExp('[^\\p{L}\\p{N}]+', 'u'); } catch (e) { SPLIT = /[\s.,;:!?"'«»“”‘’()\[\]\-–—\/|]+/; }
  function words(t) { var o = {}, n = 0; String(t || '').toLowerCase().split(SPLIT).forEach(function (w) { if (w.length > 3 && !o[w]) { o[w] = 1; n += 1; } }); o._n = n; return o; }
  function same(a, b) {
    if (!a._n || !b._n) return false;
    var k, c = 0;
    for (k in a) if (k !== '_n' && b[k]) c += 1;
    return c / (a._n + b._n - c) >= 0.55;
  }
  function stories(list) {
    var out = [];
    list.forEach(function (a) {
      var w = words(a.title), i;
      for (i = 0; i < out.length; i++) if (out[i].lang === a.lang && same(out[i]._w, w)) {
        if (out[i].outlets.indexOf(a.domain) < 0) out[i].outlets.push(a.domain);
        return;
      }
      var c = {}; Object.keys(a).forEach(function (k) { c[k] = a[k]; });
      c._w = w; c.outlets = [a.domain]; out.push(c);
    });
    return out;
  }
  /* A headline the reader has left out also removes other papers' versions of it. */
  function leftOut(title) {
    var h = hid();
    if (h[hkey(title)]) return true;
    if (!leftOut.w || leftOut.n !== Object.keys(h).length) { leftOut.w = Object.keys(h).map(words); leftOut.n = Object.keys(h).length; }
    if (!leftOut.w.length) return false;
    var w = words(title);
    return leftOut.w.some(function (x) { return same(x, w); });
  }

  /* The reader can also correct how a headline has been read. */
  var TKEY2 = 'cy.tone.v1', toned = null;
  function tones() { if (!toned) { try { toned = JSON.parse(localStorage.getItem(TKEY2) || '{}') || {}; } catch (e) { toned = {}; } } return toned; }
  L.setTone = function (title, tone) { tones()[hkey(title)] = tone; try { localStorage.setItem(TKEY2, JSON.stringify(toned)); } catch (e) {} emit(); };
  L.tonedCount = function () { return Object.keys(tones()).length; };
  L.resetTones = function () { toned = {}; try { localStorage.removeItem(TKEY2); } catch (e) {} emit(); };

  /* Subject words for the Greek- and Turkish-language press. */
  var SUB_EL = {
    talks: 'το κυπριακό(?! (ποδόσφαιρο|μπάσκετ|πρωτάθλημα|κράτος|διαβατήριο|χαλλούμι))|του κυπριακού(?! (ποδοσφαίρου|κράτους|λαού))|στο κυπριακό(?! (ποδόσφαιρο|πρωτάθλημα))|συνομιλ|διαπραγματ|επανένωσ|ομοσπονδ|χόλγκιν|ολγκίν|άτυπη διάσκεψη|διευρυμέν|επίλυση|κοινή συνάντηση', security: 'εγγυήσ|εγγυησ|ειρηνευτικ|ουνφικυπ|ουδετερότ|αποχώρηση στρατ',
    troops: 'κατοχικός στρατός|κατοχικού στρατού|κατοχικά στρατεύματα|κατοχικές δυνάμεις|τουρκικά στρατεύματα|τούρκοι στρατιώτες', property: 'περιουσι|εκτοπισμ|επιτροπή αγνοουμένων|σφετερισ',
    cbm: 'οδόφραγμα|οδοφράγμ|μέτρα οικοδόμησης|νεκρή ζώνη|νεκρής ζώνης|δικοινοτικ', trade: 'πράσινης γραμμής|πράσινη γραμμή|χαλλούμι|απευθείας πτήσ|τουρκοκυπριακή οικονομ',
    gas: 'φυσικό αέριο|φυσικού αερίου|γεώτρησ.{0,40}(αοζ|κύπρ|οικόπεδ)|αοζ|κοίτασμα|κοιτάσμ|chevron|exxon|αγωγό', grid: 'ηλεκτρική διασύνδεσ|ηλεκτρικής διασύνδεσης|καλώδιο|καλωδίου|great sea|\\bgsi\\b',
    euturkey: 'τελωνειακή ένωση|τελωνειακής ένωσης|ενταξιακ|ευρωτουρκικ|βίζα|safe', sanctions: 'κυρώσ', uscyprus: '(ηπα|αμερικ|ρούμπιο|τραμπ).{0,60}(κύπρ|κυπρ|χριστοδουλίδ)|(κύπρ|κυπρ|χριστοδουλίδ).{0,60}(ηπα|αμερικ|ρούμπιο|τραμπ)',
    usturkey: 'f-?35|f-?16|s-?400|caatsa', courts: '(εδαδ|εδδα|ευρωπαϊκό δικαστήριο).{0,90}(τουρκ|κατεχ|περιουσ|αγνοούμεν)|(τουρκ|κατεχ|περιουσ).{0,90}(εδαδ|εδδα)|διεθνές δικαστήριο|συμβούλιο της ευρώπης.{0,60}(τουρκ|κυπριακ)', maritime: 'navtex|πολεμικό πλοίο|πολεμικά πλοία|ναυτικ|γαλάζια πατρίδα|θαλάσσι',
    varosha: 'βαρώσι|βαρωσί|αμμόχωστ|αμμοχώστ', recognition: 'δύο κράτ|δύο κρατ|αναγνώρισ|αναγνωρίσ|κυριαρχική ισότητα|κυριαρχικής ισότητας|ψευδοκράτ',
    defence: 'εθνική φρουρά|εθνικής φρουράς|αμυντική θωράκιση|εξοπλισ|αντιαεροπορικ|στρατιωτική άσκηση|στρατιωτική παρέλαση', regional: 'ισραήλ|αίγυπτ|αιγύπτ|εμιράτ|ινδία|τριμερής συνεργασία|τριμερούς συνεργασίας|imec',
    greeceturkey: 'ελληνοτουρκικ|μητσοτάκ|γεραπετρίτ|αιγαίο', britain: 'βρετανικ|βάσεις|βάσεων|ακρωτήρι', un: 'γκουτέρες.{0,80}(κυπρ|κύπρ|χριστοδουλίδ|έρχιουρμαν)|(κυπρ|κύπρ|χριστοδουλίδ|έρχιουρμαν).{0,80}(οηε|γκουτέρες|συμβούλιο ασφαλείας)|χόλγκιν|ολγκίν|ουνφικυπ',
    russia: '(ρωσία|ρωσίας|ρωσικ|πούτιν|λαβρόφ).{0,80}(κύπρ|κυπρ|τουρκ|ακούγιου)|(κύπρ|κυπρ).{0,80}(ρωσία|ρωσίας|ρωσικ|πούτιν|λαβρόφ)', society: 'δημοψήφισμ|δημοσκόπησ|διασπορά|κοινωνία των πολιτών|κοινωνίας των πολιτών'
  };
  var SUB_TR = {
    talks: 'kıbrıs sorunu|müzakere|federal çözüm|çözüm süreci|çözüme ulaş|federasyon|holguin|gayriresmi|5\\+1|üçlü görüşme|üçlü zirve', security: 'garanti|garantör|barış gücü|unficyp|tarafsızlık',
    troops: 'türk askeri|işgal|barış harekâtı|barış harekatı', property: 'mülkiyet|taşınmaz mal|\\btmk\\b|kayıp şahıs|tazminat|göçmen',
    cbm: 'geçiş kapı|sınır kapı|kapıların|güven artırıcı|ara bölge|iki toplumlu', trade: 'yeşil hat|hellim|ercan|doğrudan uçuş|doğrudan ticaret',
    gas: 'doğal gaz|doğalgaz|sondaj|\\bmeb\\b|hidrokarbon|chevron|exxon', grid: 'enterkonnekt|elektrik kablosu|great sea',
    euturkey: 'gümrük birliği|üyelik müzakere|vize serbest|ab-türkiye|\\bsafe\\b', sanctions: 'yaptırım', uscyprus: '(\\babd\\b|amerika|rubio|trump).{0,60}(kıbrıs|rum|hristodulidis)|(kıbrıs|rum|hristodulidis).{0,60}(\\babd\\b|amerika|rubio|trump)',
    usturkey: 'f-?35|f-?16|s-?400|caatsa', courts: 'aihm|avrupa insan hakları|uluslararası adalet', maritime: 'navtex|savaş gemisi|donanma|mavi vatan|deniz yetki',
    varosha: 'maraş', recognition: 'iki devlet|tanınma|tanınması|egemen eşit', defence: 'milli muhafız|savunma.{0,50}(kıbrıs|rum|hristodulidis)|(kıbrıs|rum|hristodulidis).{0,60}savunma|tatbikat|silahlan',
    regional: 'israil|mısır|\\bbae\\b|hindistan|üçlü mekanizma|üçlü iş ?birliği', greeceturkey: 'yunanistan|miçotakis|\\bege\\b', britain: 'ingiliz|ingiltere|üsler|ağrotur|dikelya',
    un: '(guterres|\\bbm\\b|güvenlik konseyi|birleşmiş milletler).{0,80}(kıbrıs|erhürman|müzakere)|(kıbrıs|erhürman).{0,80}(guterres|\\bbm\\b|güvenlik konseyi)|holguin|unficyp', russia: '(rusya|putin|lavrov).{0,80}(kıbrıs|kktc|türkiye|akkuyu)|(kıbrıs|kktc).{0,80}(rusya|putin|lavrov)|akkuyu', society: 'referandum|anket|diaspora|sivil toplum'
  };
  var SAID_ANY = /\b(says?|said|tells?|told|interview|speech|remarks|statement|warns?|urges?|calls? (for|on)|vows?|pledges?|rejects?|insists?|accuses?|announces?)\b|δήλωσ|δηλώσ|είπε|ανέφερε|τόνισε|προειδοπ|κάλεσε|απάντησε|μήνυμα|συνέντευξη|dedi|açıkla|söyledi|belirtti|vurgula|uyardı|çağrı|röportaj|mesaj/i;
  var MEET_ANY = /\b(summit|conference|council|meeting|meets?|talks|forum|assembly|visit|session|dialogue|trilateral)\b|συνάντησ|συναντήσ|σύνοδ|συνόδ|διάσκεψ|συνέδρι|επίσκεψ|τριμερ|görüş|toplantı|zirve|konferans|ziyaret|buluş/i;

  /* Current headlines on a subject: news-index feeds and newspaper feeds, sorted
     on the device, plus the subject's own search where it has one. */
  L.reports = function (id, def) {
    var d = load() || {}, own = tload()[id], seen = {};
    var re = { must: def.must ? new RegExp(def.must, 'i') : null, en: def.sub ? new RegExp(def.sub, 'i') : null, el: SUB_EL[id] ? new RegExp(SUB_EL[id], 'i') : null, tr: SUB_TR[id] ? new RegExp(SUB_TR[id], 'i') : null };
    var all = (d.news || []).concat(d.feed || [], own && own.items ? own.items : [], (d.press || {}).items || []);
    all = all.filter(function (a) {
      var k = (a.title || '').toLowerCase().replace(/\s+/g, ' ').slice(0, 60), on = re[a.lang || 'en'];
      if (!a.title || seen[k] || leftOut(a.title) || !on || !on.test(a.title)) return false;
      if ((!a.cy || def.own) && re.must && !re.must.test(a.title)) return false;
      seen[k] = 1; return true;
    }).map(function (a) { return { title: a.title, url: a.url, domain: a.domain, date: a.date, lang: a.lang || 'en', said: SAID_ANY.test(a.title), meet: MEET_ANY.test(a.title) }; })
      .sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : 0; });
    return stories(all).map(function (a) { delete a._w; return a; });
  };

  /* ---------- what governments are saying ----------
     Headlines that report a named leader or office speaking are attributed to
     that stakeholder and read as conciliatory or hard-line from their wording. */
  var VOICE = {
    ROC: 'christodoulid|χριστοδουλίδ|hristodulidis|kombos|κόμπος|κόμπου|letymbiot|λετυμπιώτ|cyprus government|κυπριακή κυβέρνηση|rum lider|rum yönetimi',
    TC: 'erh[uü]rman|ερχιουρμάν|ερχουρμάν|\\btatar\\b|τατάρ|üstel|ertuğruloğlu|turkish cypriot leader',
    TR: 'erdo[gğ]an|ερντογάν|\\bfidan\\b|φιντάν|cevdet yılmaz|yaşar güler|ankara says|turkish (president|foreign minister|defen[cs]e ministry|government)|\\bmsb\\b|τουρκικό υπεξ|türkiye dışişleri',
    GR: 'mitsotak|μητσοτάκ|miçotakis|gerapetrit|γεραπετρίτ|dendias|δένδια|greek (prime minister|foreign minister|government)',
    EU: 'von der leyen|φον ντερ λάιεν|antónio costa|antonio costa|kallas|κάλας|european commission|κομισιόν|european council|ab komisyon|eu envoy|johannes hahn',
    US: '\\btrump\\b|τραμπ|rubio|ρούμπιο|state department|στέιτ ντιπάρτμεντ|white house|λευκός οίκος|us ambassador|u\\.s\\. ambassador|abd büyükelçi|beyaz saray',
    UK: 'starmer|στάρμερ|burnham|lammy|foreign office|british (high commissioner|government|prime minister)|ingiltere başbakan',
    UN: 'guterres|γκουτέρες|holgu[ií]n|χόλγκιν|ολγκίν|unficyp|ουνφικυπ|security council|συμβούλιο ασφαλείας|güvenlik konseyi|un envoy|un chief',
    RU: '\\bputin\\b|πούτιν|lavrov|λαβρόφ|zakharova|ζαχάροβα|kremlin|κρεμλίν|russian (foreign ministry|ambassador)',
    REG: 'netanyahu|νετανιάχου|\\bsisi\\b|σίσι|herzog|bin zayed|israeli (prime minister|foreign minister)|egyptian (president|foreign minister)|\\bmodi\\b'
  };
  var SOFT = /\b(talks?|dialogue|ready|open to|agree\w*|cooperat\w*|welcom\w*|support\w*|window|solution|settlement|peace|resum\w*|bridge|trust|progress|constructive|commit\w*|meets?|meeting)\b|διάλογ|συνομιλ|έτοιμ|λύση|συνεργασ|καλωσόρι|στήριξ|πρόοδο|ειρήν|επανέναρξ|εποικοδομ|συνάντησ|diyalog|görüşme|hazır|çözüm|iş ?birliği|destek|barış|ilerleme|yapıcı|uzlaş/i;
  var HARD = /\b(rejects?|warns?|threat|condemn|illegal|never|two-state|sovereign equality|accus|slams?|violat|provoc|occup|red line|not accept|refus|blames?|sanction)|απορρίπτ|απέρριψ|προειδοπ|απειλ|καταδικ|παράνομ|ποτέ|δύο κράτ|κυριαρχική ισότητα|κατηγορ|παραβίασ|πρόκλησ|προκλητικ|κατοχ|κόκκινη γραμμή|δεν δεχ|tanınması|tanınmalı|recognition of the|αναγνώριση του ψευδοκράτους|reddet|uyardı|tehdit|kınadı|kınıyor|yasa dışı|asla|iki devlet|egemen eşit|suçla|ihlal|provokasyon|işgal|kırmızı çizgi|kabul etme/i;
  /* Only statements about the Cyprus question itself are counted. */
  var CORE = /cyprus (problem|issue|talks|settlement|solution)|negotiat|two-state|federa|sovereign|recogni|reunif|guarant|troops|occup|turkish cypriot|greek cypriot|northern cyprus|το κυπριακό|του κυπριακού|στο κυπριακό|συνομιλ|διαπραγματ|δύο κράτ|ομοσπονδ|κατοχ|εγγυήσ|επανένωσ|τουρκοκύπρι|κοινή συνάντηση|kıbrıs sorunu|müzakere|iki devlet|federasyon|egemen eşit|tanınma|garanti|kıbrıs türk|rum lider|çözüm/i;
  /* Deeds: a headline that reports an act, not a remark. Deeds count double. */
  var ACT = /\b(signs?|signed|deploys?|deployed|opens?|opened|closes?|closed|sends?|sent|withdraws?|withdrew|votes?|voted|approves?|approved|blocks?|blocked|imposes?|imposed|lifts?|lifted|launch(es|ed)?|drills?|exercise|seizes?|seized|arrests?|arrested|inaugurat\w*|allocat\w*|adopts?|adopted|ratif\w*|extends?|suspends?|cancels?|violat\w*|builds?|expands?|issues?|issued|obstruct\w*|halts?|halted|designat\w*|appoints?|appointed|delivers?|delivered|buys?|bought|purchas\w*|sells?|sold|advances?|harass\w*|shadow\w*|dispatch\w*)\b|navtex|υπέγραψ|υπογράφ|ανέπτυξ|άνοιξ|ανοίγει|έκλεισ|απέστειλ|αποσύρ|ψήφισ|ενέκριν|μπλόκαρ|μπλοκάρ|επέβαλ|ήρε |ξεκίνησ|άσκηση|συνέλαβ|εγκαινί|παραβίασ|παρεμπόδισ|εξέδωσε|βγάζει|διόρισ|αγόρασ|παρέλαβ|imzala|konuşlandır|açtı|açıldı|açılıyor|kapattı|gönderdi|çekti|oyladı|onayladı|engelledi|uyguladı|kaldırdı|başlattı|tatbikat|tutukla|ihlal etti|ilan etti|atadı|satın al|teslim|eğitim uçuşu|uçuş yaptı|υπερπτήσ|overflight/i;
  var ACT_SOFT = /\b(signs?|signed|opens?|opened|withdraws?|withdrew|lifts?|lifted|approves?|approved|inaugurat\w*|ratif\w*|allocat\w*|designat\w*|appoints?|appointed)\b|υπέγραψ|υπογράφ|άνοιξ|ανοίγει|αποσύρ|ήρε |ενέκριν|εγκαινί|διόρισ|imzala|açtı|açıldı|açılıyor|çekti|kaldırdı|onayladı|atadı/i;
  var ACT_HARD = /\b(deploys?|deployed|drills?|exercise|blocks?|blocked|violat\w*|imposes?|imposed|seizes?|seized|arrests?|arrested|suspends?|cancels?|closes?|closed|obstruct\w*|halts?|halted|harass\w*|shadow\w*|dispatch\w*)\b|navtex|ανέπτυξ|άσκηση|παραβίασ|μπλόκαρ|μπλοκάρ|επέβαλ|συνέλαβ|έκλεισ|παρεμπόδισ|βγάζει|konuşlandır|tatbikat|engelledi|ihlal etti|tutukla|kapattı|eğitim uçuşu|uçuş yaptı|πτήσεις πάνω|υπερπτήσ|overflight|airspace/i;
  /* A state can act without a leader being named. */
  var STATE = {
    ROC: 'nicosia|cyprus government|republic of cyprus|λευκωσία|κυπριακή δημοκρατία|κυπριακής δημοκρατίας|εθνική φρουρά|rum yönetimi|güney kıbrıs',
    TC: 'turkish cypriot (authorities|side|police|leadership)|ψευδοκράτος|κατοχικ(ό καθεστώς|ές αρχές)|\\bkktc\\b',
    TR: 'turkey|türkiye|turkish (navy|warships?|army|forces|soldiers|military|government)|ankara|τουρκία|τούρκοι στρατιώτες|τουρκικ(ά πολεμικά|ό ναυτικό|ή navtex)|άγκυρα|oruc reis|türk (donanma|asker)',
    GR: 'greece|athens|ελλάδα|αθήνα|yunanistan',
    EU: 'european commission|commission (designat|decid|propos)|brussels|κομισιόν|βρυξέλλες|ab komisyon',
    US: 'washington|pentagon|u\\.s\\. (congress|senate|house)|congress|ουάσιγκτον|ηπα|\\babd\\b',
    UK: 'britain|british (government|forces|bases)|βρετανία|ingiltere',
    UN: 'unficyp|united nations|un security council|ουνφικυπ|οηε|birleşmiş milletler',
    RU: 'russia|moscow|ρωσία|μόσχα|rusya',
    REG: 'israel|egypt|ισραήλ|αίγυπτος|israil|mısır'
  };
  var QUOTE = /^[^:]{0,70}:\s|[«“"]/;
  /* Wording that turns a friendly word into its opposite: "no talks", "rules out a meeting". */
  var NEGATED = /\b(no|not|never|won't|will not|rules? out|ruled out|refus\w*|without|cancel\w*|den(y|ies|ied))\b.{0,40}\b(talks?|dialogue|meeting|negotiat\w*|solution|settlement|agree\w*|cooperat\w*|progress)\b|(δεν|όχι|χωρίς|αποκλεί|ακύρωσ|αρνήθηκ|αρνείται|ναυάγ).{0,50}(συνάντησ|διάλογ|συνομιλ|λύση|πρόοδο|συνεργασ)|(görüşme|diyalog|müzakere|çözüm|iş ?birliği|toplantı|zirve).{0,40}(yok|olmayacak|yapmam|yapmayacağ|reddet|iptal)|reddet.{0,40}(görüşme|müzakere|zirve)/i;
  /* Backing someone else's position: read as that position, not as a friendly word. */
  var ENDORSE = /\b(backs?|backed|supports?|supported|praises?|praised|welcomes?|welcomed|endorses?|hails?|hailed)\b|destek|övgü|tebrik|στηρίζει|στήριξη σ|χαιρετίζει|επικροτεί/i;
  L.voices = function () {
    var d = load() || {}, out = {}, res = {}, both = {}, seen = {}, pend = [], week = iso(new Date(Date.now() - 7 * 864e5));
    var all = (d.news || []).concat(d.feed || [], (d.press || {}).items || []);
    Object.keys(tload()).forEach(function (t) { all = all.concat((topics[t] || {}).items || []); });
    all = stories(all.filter(function (a) { return a.title && !leftOut(a.title); }));
    var off = L.officialItems(), hasOfficial = {};
    off.forEach(function (a) { if (a.kind !== 'record') hasOfficial[a.actor] = 1; });
    Object.keys(VOICE).forEach(function (pid) {
      res[pid] = new RegExp(VOICE[pid], 'i'); both[pid] = new RegExp(VOICE[pid] + '|' + STATE[pid], 'ig');
      out[pid] = { says: { soft: 0, hard: 0 }, does: { soft: 0, hard: 0 }, n: 0, w: 0, score: 0, now: [0, 0], prev: [0, 0], items: [], official: !!hasOfficial[pid] };
    });
    /* who acted: the one named nearest before the verb, else the first named after it */
    function doer(t) {
      var m = ACT.exec(t), at = m ? m.index : 0, before = null, bi = -1, after = null, ai = 1e9;
      Object.keys(both).forEach(function (q) {
        var re = both[q], x; re.lastIndex = 0;
        while ((x = re.exec(t))) { if (x.index <= at && x.index > bi) { bi = x.index; before = q; } if (x.index > at && x.index < ai) { ai = x.index; after = q; } if (!x[0]) re.lastIndex += 1; }
      });
      return before || after;
    }
    if (!L._subj) {
      var parts = [];
      Object.keys(SUB_EL).forEach(function (t) { parts.push(SUB_EL[t], SUB_TR[t]); if (TOP && TOP[t] && TOP[t].sub) parts.push(TOP[t].sub); });
      try { L._subj = new RegExp(parts.join('|'), 'i'); } catch (e) { L._subj = /./; }
    }
    /* a statement belongs to whoever is named first in it */
    function first(t) { var best = null, at = 1e9; Object.keys(res).forEach(function (q) { var m = res[q].exec(t); if (m && m.index < at) { at = m.index; best = q; } }); return best; }
    function other(t, pid) { var o = null; Object.keys(res).forEach(function (q) { if (q !== pid && !o && res[q].test(t)) o = q; }); return o; }
    function count(o, it, sign) {
      (it.deed ? o.does : o.says)[it.tone] += sign;
      o.w += sign * it.w; o.score += sign * (it.tone === 'soft' ? it.w : -it.w);
      var b = it.date >= week ? o.now : o.prev; b[0] += sign * it.w; b[1] += sign * (it.tone === 'soft' ? it.w : -it.w);
    }
    function add(pid, a, kind) {
      var k = pid + hkey(a.title), o = out[pid];
      if (!o || seen[k]) return;
      var text = a.title + ' ' + (a.detail || '');
      var deed = kind === 'deed' || kind === 'record' || (kind === 'official' && (ACT_HARD.test(a.title) || ACT_SOFT.test(a.title)) && !QUOTE.test(a.title.slice(0, 40)));
      var hard = deed ? ACT_HARD.test(a.title) || HARD.test(text) : HARD.test(text), soft = deed ? ACT_SOFT.test(a.title) || SOFT.test(text) : SOFT.test(text);
      if (!hard && !soft && kind === 'word' && !SAID_ANY.test(a.title)) return;
      seen[k] = 1;
      var tone = hard ? 'hard' : soft ? (NEGATED.test(a.title) ? 'plain' : 'soft') : 'plain', backs = null, own = tones()[hkey(a.title)];
      if (!deed && tone !== 'hard' && ENDORSE.test(a.title)) backs = other(a.title, pid);
      /* weight: deeds 2; a government's own statement 2; a leader quoted directly counts the same where the government publishes nothing we can read; anything else 1; +0.5 when several papers carry it */
      var w = deed || kind === 'official' ? 2 : (!o.official && QUOTE.test(a.title) ? 2 : 1);
      if ((a.outlets || []).length > 1) w += 0.5;
      /* what was said or done longer ago counts for less */
      var age = a.date ? (Date.now() - new Date(a.date).getTime()) / 864e5 : 0;
      if (age > 60) w *= 0.25; else if (age > 21) w *= 0.5;
      var it = { title: a.title, url: a.url, domain: a.domain || a.body, date: a.date || '', lang: a.lang || 'en', tone: own || tone, deed: deed, official: kind === 'official' || kind === 'record', outlets: (a.outlets || []).length, w: w, set: !!own };
      o.n += 1; o.items.push(it);
      if (own) { if (own !== 'plain') count(o, it, 1); }
      else if (backs) pend.push([o, it, backs]);
      else if (tone !== 'plain') count(o, it, 1);
    }
    var CYMARK = /cypr|kıbrıs|κυπρ|κύπρ|kktc|trnc|τ\/κ|ε\/κ|turkish cypriot|rum (lider|yönetim)|τουρκοκύπρι|ψευδοκράτ|κατεχόμεν|νεκρή ζών|buffer zone|ara bölge/i;
    var TRIVIAL = /visitors.? book|βιβλίο επισκεπτών|wreath|στεφάν|çelenk|anniversary|επέτειο|yıl ?dönümü|condolenc|συλλυπητήρι|taziye/i;
    all.forEach(function (a) {
      var act = ACT.test(a.title), about = CYMARK.test(a.title);
      if (act && about && !TRIVIAL.test(a.title) && (CORE.test(a.title) || L._subj.test(a.title))) { var who = doer(a.title); if (who) { add(who, a, 'deed'); return; } }
      var sp = first(a.title);
      if (!sp) return;
      /* the island's own leaders: anything on the question; everyone else: anything they say about Cyprus */
      if (sp === 'ROC' || sp === 'TC' ? CORE.test(a.title) : about) add(sp, a, 'word');
    });
    off.forEach(function (a) {
      if (a.kind === 'record') { if (/cyprus|turk|türk|mediterranean/i.test(a.title)) add(a.actor, a, 'record'); }
      else if (a.actor === 'TC' || a.actor === 'TR' || CYQ.test(a.title + ' ' + a.detail)) add(a.actor, a, 'official');
    });
    /* backing another's position takes that position's colour */
    /* A tilt needs a clear balance: a near-even split is "mixed" and tilts nothing. */
    function lean(o) { var l = o.w >= 3 ? o.score / (o.w + 3) : 0; return Math.abs(l) < 0.2 ? 0 : l; }
    var base = {}; Object.keys(out).forEach(function (pid) { base[pid] = lean(out[pid]); });
    pend.forEach(function (x) {
      var o = x[0], it = x[1], l = base[x[2]];
      it.tone = l < -0.1 ? 'hard' : l > 0.1 ? 'soft' : it.tone; it.backs = x[2];
      if (it.tone !== 'plain') count(o, it, 1);
    });
    Object.keys(out).forEach(function (pid) {
      var o = out[pid];
      o.items.sort(function (x, y) { return (y.deed - x.deed) || (y.official - x.official) || (x.date < y.date ? 1 : -1); });
      o.lean = lean(o);
      o.mixed = !o.lean && o.w >= 3 && (o.says.soft + o.does.soft) > 0 && (o.says.hard + o.does.hard) > 0;
      var s = o.says.soft - o.says.hard, dd = o.does.soft - o.does.hard;
      o.gap = o.says.soft + o.says.hard >= 2 && o.does.soft + o.does.hard >= 2 && s * dd < 0;
      /* direction of travel: this week against the two weeks before, from the dates on the items themselves */
      o.trend = o.now[0] >= 2 && o.prev[0] >= 2 ? o.now[1] / (o.now[0] + 2) - o.prev[1] / (o.prev[0] + 2) : null;
    });
    return out;
  };

  /* A weekly note of each stakeholder's tilt, kept on the device, so that the
     direction of travel can be shown over time. */
  var HISTKEY = 'cy.hist.v1';
  L.history = function () { try { return JSON.parse(localStorage.getItem(HISTKEY) || '{}') || {}; } catch (e) { return {}; } };
  L.remember = function (v) {
    var h = L.history(), wk = iso(new Date()).slice(0, 8) + (new Date().getDate() <= 7 ? '1' : new Date().getDate() <= 14 ? '2' : new Date().getDate() <= 21 ? '3' : '4');
    var any = Object.keys(v).some(function (p) { return v[p].w >= 3; });
    if (!any) return;
    h[wk] = {}; Object.keys(v).forEach(function (p) { h[wk][p] = +v[p].lean.toFixed(2); });
    var keys = Object.keys(h).sort(); while (keys.length > 26) delete h[keys.shift()];
    try { localStorage.setItem(HISTKEY, JSON.stringify(h)); } catch (e) {}
  };

  /* Convert raw feeds into small, capped, transparent adjustments of the model.
     Only numbers are kept here; the wording is produced by L.sigText when shown,
     so saved data reads in whatever language is current. */
  var TOP = null;
  L.setTopics = function (t) { TOP = t; };
  function signals(d) {
    var s = [], cap = function (v, m) { return Math.max(-m, Math.min(m, v)); };
    if (d.tone) {
      var dt = d.tone.recent - d.tone.base;
      s.push({ id: 'tone', dim: 'stability', adj: Math.round(cap(dt * 4, 8)), dt: dt });
    }
    var pool = ((d.press || {}).items || []).length >= 40 && TOP ? d.press.items : null;
    if (pool && !(d.news && d.news.length >= 8)) {
      var wk = iso(new Date(Date.now() - 7 * 864e5)), now = {}, before = {};
      pool.forEach(function (a) {
        ['talks', 'cbm', 'troops', 'defence', 'maritime', 'courts', 'sanctions', 'recognition'].forEach(function (t) {
          var re = a.lang === 'el' ? SUB_EL[t] : a.lang === 'tr' ? SUB_TR[t] : (TOP[t] || {}).sub;
          if (re && new RegExp(re, 'i').test(a.title)) { if (a.date >= wk) now[t] = (now[t] || 0) + 1; else before[t] = (before[t] || 0) + 1; }
        });
      });
      var trend = function (id, dim, list, sign) {
        var n = list.reduce(function (p, t) { return p + (now[t] || 0); }, 0), b = list.reduce(function (p, t) { return p + (before[t] || 0); }, 0) / 2;
        if (n + b < 6) return;
        s.push({ id: id, dim: dim, adj: Math.round(cap(sign * ((n + 2) / (b + 2) - 1) * 5, 5)), now: n, before: Math.round(b), press: true });
      };
      trend('talks', 'trust', ['talks', 'cbm'], 1);
      trend('mil', 'stability', ['troops', 'defence', 'maritime'], -1);
      trend('press', 'pressure', ['courts', 'sanctions', 'recognition'], 1);
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
    var share = s.press ? T('{0} this week, {1} a week before', s.now, s.before) : Math.round((s.share || 0) * 100) + '%';
    if (s.id === 'tone') return { label: T('News tone on Cyprus–Türkiye'), value: T('{0} vs 4-month average', (s.dt >= 0 ? '+' : '') + s.dt.toFixed(2)),
      why: s.dt >= 0 ? T('Coverage over the last two weeks is calmer than the four-month norm.') : T('Coverage over the last two weeks is more hostile than the four-month norm.') };
    if (s.id === 'talks') return { label: s.press ? T('Headlines about talks and contacts') : T('Share of headlines about talks'), value: share, why: T('A busy negotiation agenda signals diplomatic momentum; silence signals drift.') };
    if (s.id === 'mil') return { label: s.press ? T('Headlines about military matters') : T('Share of headlines about military matters'), value: share, why: T('Heavier military coverage is treated as a sign of rising friction.') };
    if (s.id === 'press') return { label: s.press ? T('Headlines about legal pressure and recognition') : T('Share of headlines about legal / sanctions pressure'), value: share, why: T('More court, sanctions and resolution coverage means more live pressure on the status quo.') };
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
    /* A device that has never fetched anything starts from the snapshot shipped
       with this version, so no source is ever blank; live data replaces it
       source by source as it arrives. */
    if (!L.data && root.SEED) { L.data = JSON.parse(JSON.stringify(root.SEED)); L.data.seeded = L.data.t; L.data.status = {}; }
    if (L.data && !L.data.seeded && root.SEED) {
      /* fill in any source this device has never managed to reach */
      ['press', 'attn', 'research'].forEach(function (k) { if (!L.data[k] && root.SEED[k]) L.data[k] = root.SEED[k]; });
      var so = root.SEED.official || {}; L.data.official = L.data.official || {};
      Object.keys(so).forEach(function (k) { if (!L.data.official[k] || !(L.data.official[k].items || []).length) L.data.official[k] = so[k]; });
    }
    if (L.data) L.data.signals = signals(L.data); /* rebuilt, so copies saved by earlier versions carry no wording */
    return L.data;
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(L.data)); } catch (e) {} }
  function emit() { L.listeners.forEach(function (f) { try { f(L.data, L.busy); } catch (e) {} }); }

  L.onChange = function (f) { L.listeners.push(f); };
  L.get = load;
  /* the snapshot may arrive after the page has started */
  L.useSeed = function (seed) { root.SEED = seed; if (!L.data || !L.data.press) { L.data = null; load(); emit(); } };
  L.stale = function () { var d = load(); return !d || Date.now() - d.t > MAX_AGE; };

  /* Each source succeeds or fails on its own; old values are kept on failure. */
  L.refresh = function (wikiTitles, pvMap) {
    if (L.busy) return Promise.resolve(load());
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(load());
    L.busy = true; emit();
    var d = Object.assign({ status: {} }, load() || {});
    d.status = Object.assign({}, d.status);
    function part(name, p) {
      return p.then(function (v) { d[name] = v; d.status[name] = { ok: true, t: Date.now() }; d.seeded = 0; })
        .catch(function (e) { d.status[name] = { ok: false, t: Date.now(), err: String(e && e.message || e), kept: !!d[name] }; })
        .then(function () { d.signals = signals(d); if (d.status[name].ok) d.t = Date.now(); L.data = d; save(); emit(); });
    }
    /* GDELT asks for at most one request every five seconds. */
    function retry(f) { return gate().then(f).catch(function () { return gate().then(f); }); }
    /* The news index is an extra. If it refused us lately, leave it alone for
       half an hour and rely on the newspapers. */
    var idxOff = d.idxFail && Date.now() - d.idxFail < 30 * 60 * 1000;
    function idx(name, f) {
      if (idxOff) return Promise.resolve();
      return part(name, gate().then(f)).then(function () { if (d.status[name] && !d.status[name].ok) { d.idxFail = Date.now(); idxOff = true; } else d.idxFail = 0; });
    }
    var gd = idx('news', news).then(function () { return idx('tone', tone); });
    return Promise.all([gd, part('fx', lira()), part('wb', worldBank()), part('wiki', wiki(wikiTitles || [])), part('research', research()), part('attn', attention(pvMap || {})), part('press', press()), part('official', official()), gd.then(function () { return idx('feed', feed); })]).then(function () {
      var ok = Object.keys(d.status).some(function (k) { return d.status[k].ok && Date.now() - d.status[k].t < 60000; });
      if (ok) d.t = Date.now();
      L.data = d; L.busy = false; save(); emit();
      return d;
    });
  };

  L.sources = function () {
    return [
      { id: 'research', name: 'OpenAlex', what: T('Recent scholarly articles on the Cyprus question'), url: 'https://openalex.org/' },
      { id: 'attn', name: T('Wikimedia pageviews'), what: T('Daily readership of the reference articles for each subject: a measure of world attention (last five weeks)'), url: 'https://wikimedia.org/api/rest_v1/' },
      { id: 'press', name: T('Newspapers\' own feeds'), what: T('Headlines read directly from Greek Cypriot, Turkish Cypriot, Greek and Turkish newspapers, in their own languages (last 21 days)'), url: 'https://philenews.com/' },
      { id: 'official', name: T('Governments\' own publications'), what: T('Statements, answers to parliament, bills and formal notices published by the governments of Cyprus, Greece, the United Kingdom and the United States and by the European Commission'), url: 'https://www.gov.cy/' },
      { id: 'feed', name: T('GDELT Project'), what: T('Current headlines, statements and meetings sorted by the subject of each move (last 21 days)'), url: 'https://www.gdeltproject.org/' },
      { id: 'news', name: T('GDELT Project'), what: T('Worldwide news index: headlines mentioning the Cyprus question (last 21 days)'), url: 'https://www.gdeltproject.org/' },
      { id: 'tone', name: T('GDELT Project'), what: T('Average tone of Cyprus–Türkiye coverage (four months)'), url: 'https://www.gdeltproject.org/' },
      { id: 'fx', name: T('Frankfurter (ECB reference rates)'), what: T('Euro–lira and euro–dollar exchange rates'), url: 'https://frankfurter.dev/' },
      { id: 'wb', name: T('World Bank Open Data'), what: T('GDP, growth, inflation, military spending, population for Cyprus, Türkiye, Greece'), url: 'https://data.worldbank.org/' },
      { id: 'wiki', name: T('Wikipedia'), what: T('Current summaries of past plans, talks, rulings and comparable cases'), url: 'https://en.wikipedia.org/' }
    ];
  };

  root.Live = L;
})(typeof self !== 'undefined' ? self : this);
