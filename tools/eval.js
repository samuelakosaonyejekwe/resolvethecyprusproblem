/* Measures how well the reading rules sort and read real headlines.

   node tools/eval.js                 scores the rules on both hand-checked sets and writes data/accuracy.json
   node tools/eval.js export <file>   writes the rules' reading of the current snapshot, for a person to check

   Two sets live in tools/eval/:
     headlines.json + gold.json                   the first set; the rules were corrected against it
     heldout-headlines.json + heldout-gold.json   a later set the rules were not corrected against when it was scored
   One measure is used throughout. Every headline either adds to a stakeholder's
   tally (as conciliatory or hard-line) or adds nothing. The rules are right on a
   headline when they add exactly what a careful reader would, "withheld" when
   they mark as unsure something a reader would have counted, and wrong otherwise.
   Set LIVE_JS=<path> to score another version of js/live.js with the same measure. */
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..'), dir = path.join(__dirname, 'eval');
const store = {};
global.self = global;
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
global.navigator = { onLine: false };
const M = require(path.join(root, 'js/model.js'));
const liveFile = process.env.LIVE_JS || path.join(root, 'js/live.js');
const key = t => String(t).toLowerCase().slice(0, 80);

function reading(seedFile) {
  delete require.cache[require.resolve(liveFile)]; Object.keys(store).forEach(k => delete store[k]);
  self.SEED = JSON.parse(fs.readFileSync(seedFile, 'utf8')); self.Live = null;
  require(liveFile);
  const L = self.Live; if (L.setTopics) L.setTopics(M.topics);
  const v = L.voices(), voices = [], subjects = [];
  Object.keys(v).forEach(pid => v[pid].items.forEach(x => voices.push({ title: x.title, lang: x.lang, source: x.domain, date: x.date, stakeholder: pid, kind: x.deed ? 'deed' : 'word', tone: x.tone })));
  Object.keys(M.topics).forEach(t => L.reports(t, M.topics[t]).forEach(x => subjects.push({ title: x.title, lang: x.lang, source: x.domain, subject: t })));
  return { voices, subjects };
}

function score(seedFile, goldFile) {
  const gold = JSON.parse(fs.readFileSync(goldFile, 'utf8')), r = reading(seedFile);
  const now = {}; r.voices.forEach(x => { now[key(x.title)] = x; });
  const items = gold.voices.map(g => ({ t: g.title, g: g.relevant !== false && (g.tone === 'soft' || g.tone === 'hard') ? g.stakeholder + ' ' + g.tone : null }))
    .concat((gold.uncounted || []).map(g => ({ t: g.title, g: g.should_count && (g.tone === 'soft' || g.tone === 'hard') ? g.stakeholder + ' ' + g.tone : null })));
  const o = { n: items.length, right: 0, withheld: 0, wrong: 0, tally: 0, caught: 0, counted: 0, countedRight: 0 };
  items.forEach(it => {
    const x = now[key(it.t)], t = x && (x.tone === 'soft' || x.tone === 'hard') ? x.stakeholder + ' ' + x.tone : null, unsure = x && x.tone === 'unsure';
    if (it.g) o.tally++;
    if (t) o.counted++;
    if (t === it.g) { o.right++; if (it.g) o.caught++; if (t) o.countedRight++; }
    else if (unsure && it.g) o.withheld++;
    else if (unsure && !it.g) o.right++;
    else o.wrong++;
  });
  const sub = {}; r.subjects.forEach(x => { sub[key(x.title) + '|' + x.subject] = 1; });
  let sn = 0, sok = 0;
  gold.subjects.forEach(g => { sn++; if (!!sub[key(g.title) + '|' + g.subject] === (g.ok !== false)) sok++; });
  o.sn = sn; o.sok = sok;
  return o;
}
const pc = (a, b) => b ? Math.round(100 * a / b) : null;
function line(name, o) {
  console.log(name + ': ' + o.n + ' headlines · read right ' + pc(o.right, o.n) + '% · withheld ' + pc(o.withheld, o.n) + '% · wrong ' + pc(o.wrong, o.n) + '%' +
    ' | of ' + o.tally + ' that a reader would count, caught ' + pc(o.caught, o.tally) + '% | of ' + o.counted + ' the rules counted, right ' + pc(o.countedRight, o.counted) + '%' +
    ' | subjects ' + o.sn + ', right ' + pc(o.sok, o.sn) + '%');
}

if (process.argv[2] === 'export') {
  const r = reading(path.join(root, 'data/seed.json'));
  r.stakeholders = Object.fromEntries(M.players.map(p => [p.id, p.name]));
  r.subjectNames = Object.fromEntries(Object.keys(M.topics).map(t => [t, M.topics[t].name]));
  fs.writeFileSync(process.argv[3], JSON.stringify(r, null, 1));
  console.log('exported', r.voices.length, 'statement/deed readings and', r.subjects.length, 'subject assignments');
} else {
  const a = score(path.join(dir, 'headlines.json'), path.join(dir, 'gold.json')); line('first set (rules corrected against it)', a);
  let b = null;
  if (fs.existsSync(path.join(dir, 'heldout-gold.json'))) { b = score(path.join(dir, 'heldout-headlines.json'), path.join(dir, 'heldout-gold.json')); line('later set (not used for correction)', b); }
  if (!process.env.LIVE_JS && process.argv[2] === 'save') {
    /* what is shown in the app: the two sets together as they stand now, and, kept from the day it was first scored,
       how the rules did on the later set before they had been corrected against it */
    const t = b ? { n: a.n + b.n, right: a.right + b.right, wrong: a.wrong + b.wrong, withheld: a.withheld + b.withheld, tally: a.tally + b.tally, caught: a.caught + b.caught, counted: a.counted + b.counted, countedRight: a.countedRight + b.countedRight, sn: a.sn + b.sn, sok: a.sok + b.sok } : a;
    const first = fs.existsSync(path.join(dir, 'heldout-first.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'heldout-first.json'), 'utf8')) : null;
    fs.writeFileSync(path.join(root, 'data', 'accuracy.json'), JSON.stringify({ date: new Date().toISOString().slice(0, 10), n: t.n, right: pc(t.right, t.n), tally: t.tally, caught: pc(t.caught, t.tally), counted: t.counted, countedRight: pc(t.countedRight, t.counted), sn: t.sn, subject: pc(t.sok, t.sn), fresh: first }));
    console.log('saved data/accuracy.json');
  }
}
