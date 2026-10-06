/* Measures how well the keyword rules sort and read real headlines.
   node tools/eval.js export <file>   writes the rules' current reading of the snapshot, for a person to check
   node tools/eval.js                 scores the rules against the checked set (tools/eval/headlines.json and gold.json)
   The fixed dates in the checked set mean the three-week window is ignored here: only sorting and reading are scored. */
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
global.self = global; const store = {};
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
global.navigator = { onLine: false };
const M = require(path.join(root, 'js/model.js'));
/* scoring uses the fixed set of headlines that was checked by hand; exporting uses the current snapshot */
self.SEED = JSON.parse(fs.readFileSync(process.argv[2] === 'export' ? path.join(root, 'data/seed.json') : path.join(__dirname, 'eval', 'headlines.json'), 'utf8'));
require(path.join(root, 'js/live.js'));
const L = self.Live; L.setTopics(M.topics);
function reading() {
  const v = L.voices(), voices = [], subjects = [];
  Object.keys(v).forEach(pid => v[pid].items.forEach(x => voices.push({ title: x.title, lang: x.lang, source: x.domain, date: x.date, stakeholder: pid, kind: x.deed ? 'deed' : 'word', tone: x.tone })));
  Object.keys(M.topics).forEach(t => L.reports(t, M.topics[t]).forEach(x => subjects.push({ title: x.title, lang: x.lang, source: x.domain, subject: t })));
  return { voices, subjects };
}
if (process.argv[2] === 'export') {
  const r = reading();
  r.stakeholders = Object.fromEntries(M.players.map(p => [p.id, p.name]));
  r.subjectNames = Object.fromEntries(Object.keys(M.topics).map(t => [t, M.topics[t].name]));
  fs.writeFileSync(process.argv[3], JSON.stringify(r, null, 1));
  console.log('exported', r.voices.length, 'statement/deed readings and', r.subjects.length, 'subject assignments');
} else {
  const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'eval', 'gold.json'), 'utf8')), r = reading();
  const key = x => x.title.toLowerCase().slice(0, 80);
  const now = {}; r.voices.forEach(x => { now[key(x)] = x; });
  let n = 0, who = 0, kind = 0, tone = 0, dropped = 0;
  gold.voices.forEach(g => {
    const x = now[key(g)];
    if (g.relevant === false) { n++; if (!x) { who++; kind++; tone++; dropped++; } return; }
    n++;
    if (!x) { if (g.tone === 'plain') { who++; kind++; tone++; } return; }   /* a neutral item left out changes no count */
    if (x.stakeholder === g.stakeholder) who++;
    if (x.kind === g.kind) kind++;
    if (x.tone === g.tone || (x.tone === 'unsure' && g.tone !== 'plain')) tone++;   /* abstaining on a real statement is not an error */
  });
  const sub = {}; r.subjects.forEach(x => { sub[key(x) + '|' + x.subject] = 1; });
  let sn = 0, sok = 0;
  gold.subjects.forEach(g => { sn++; const has = !!sub[key(g) + '|' + g.subject]; if (has === (g.ok !== false)) sok++; });
  const pc = (a, b) => b ? Math.round(100 * a / b) + '%' : 'n/a';
  console.log('checked statements and deeds: ' + n + ' · right stakeholder ' + pc(who, n) + ' · word/deed right ' + pc(kind, n) + ' · tone right or withheld ' + pc(tone, n));
  console.log('checked subject assignments: ' + sn + ' · right ' + pc(sok, sn));
  fs.writeFileSync(path.join(root, 'data', 'accuracy.json'), JSON.stringify({ date: new Date().toISOString().slice(0, 10), n: n, who: Math.round(100 * who / n), kind: Math.round(100 * kind / n), tone: Math.round(100 * tone / n), sn: sn, subject: Math.round(100 * sok / sn) }));
}
