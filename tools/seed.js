/* Takes a snapshot of the live sources and saves it as data/seed.json. The app
   uses it only on a device that has not yet fetched anything, or to fill a
   source that device has never reached, and replaces it with live data.
   Run before a release:  node tools/seed.js */
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
global.self = global; const store = {};
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
global.navigator = { onLine: true };
const M = require(path.join(root, 'js/model.js')); require(path.join(root, 'js/live.js'));
const L = self.Live, pv = {}; Object.keys(M.topics).forEach(t => { pv[t] = M.topics[t].pv; });
const real = global.fetch;
/* the news index is left out: it is optional in the app and not needed here */
global.fetch = (u, o) => /gdeltproject/.test(u) ? Promise.reject(new Error('skipped')) :
  real(u, Object.assign({}, o, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36', Origin: 'https://samuelakosaonyejekwe.github.io' } }));
L.setTopics(M.topics);
L.refresh(M.precedents.map(p => p.wiki).filter(Boolean), pv).then(d => {
  const seed = { t: Date.now(), press: d.press, official: d.official, attn: d.attn, research: d.research, wiki: d.wiki, fx: d.fx, wb: d.wb };
  const missing = ['press', 'official', 'attn'].filter(k => !seed[k]);
  if (missing.length) { console.error('Snapshot incomplete, not saved. Missing: ' + missing.join(', ')); process.exit(1); }
  fs.writeFileSync(path.join(root, 'data/seed.json'), JSON.stringify(seed));
  const o = seed.official;
  console.log('data/seed.json', Math.round(fs.statSync(path.join(root, 'data/seed.json')).size / 1024) + ' KB · newspapers answering: ' + seed.press.n + ' · headlines: ' + seed.press.items.length +
    ' · official: ' + Object.keys(o).map(k => k + ' ' + (o[k].items || []).length).join(', '));
});
