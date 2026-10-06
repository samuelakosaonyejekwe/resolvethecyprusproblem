/* Translation catalogue.
   node tools/strings.js          collects every English string passed to T() / E.T()
                                  into i18n/strings.en.json (sorted, unique)
   node tools/strings.js --check  lists what each language pack under js/lang/ still
                                  lacks, for the interface and for the model; exits 1
                                  if anything is missing */
const fs = require('fs'), path = require('path'), vm = require('vm'), root = path.join(__dirname, '..');
const FILES = ['js/app.js', 'js/live.js', 'js/engine.js', 'js/i18n.js'], LANGS = ['el', 'tr'];
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

/* End of the string literal that starts at src[i] (a quote), or -1. */
function litEnd(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') j++;
    else if (src[j] === q) return j + 1;
    else if (src[j] === '\n') return -1;
  }
  return -1;
}

/* First arguments of T(…) and E.T(…): one literal, or literals joined with +. */
function extract(file) {
  const src = read(file), out = [], odd = [], re = /(^|[^\w$])T\(\s*/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, text = '', got = false;
    for (;;) {
      if (src[i] !== '\'' && src[i] !== '"') break;
      const e = litEnd(src, i);
      if (e < 0) break;
      text += vm.runInNewContext(src.slice(i, e));
      got = true; i = e;
      const more = /^\s*\+\s*(?=['"])/.exec(src.slice(i, i + 200));
      if (!more) break;
      i += more[0].length;
    }
    const next = (/^\s*(.)/.exec(src.slice(i, i + 50)) || [])[1];
    if (got && (next === ',' || next === ')')) out.push(text);
    else if (!/^(s|text)\)\s*\{/.test(src.slice(re.lastIndex, re.lastIndex + 12))) odd.push(file + ':' + src.slice(0, m.index).split('\n').length + '  ' + src.slice(m.index, m.index + 60).trim());
  }
  return { out, odd };
}

function catalogue() {
  const set = new Set(), odd = [];
  FILES.forEach(f => { const r = extract(f); r.out.forEach(s => set.add(s)); odd.push(...r.odd); });
  if (odd.length) console.warn('T() calls whose text is not a plain literal (not collected):\n  ' + odd.join('\n  '));
  return Array.from(set).sort();
}

function pack(lang) {
  const sb = {}; sb.self = sb; let n = 0;
  ['model', 'ui'].forEach(k => {
    const f = path.join(root, 'js/lang/' + lang + '.' + k + '.js');
    if (fs.existsSync(f)) { vm.runInNewContext(fs.readFileSync(f, 'utf8'), sb, { filename: f }); n++; }
  });
  return Object.assign({ files: n }, (sb.LANGS || {})[lang] || {});
}

const has = (o, k) => !!o && typeof o[k] === 'string' && o[k] !== '';
const marks = s => (String(s).match(/\{\d+\}/g) || []).sort().join('');

/* Every id and field a complete model pack carries, read off the English model. */
function modelGaps(M, t) {
  const miss = [], need = (o, k, where) => { if (!has(o, k)) miss.push(where); };
  t = t || {};
  Object.keys(M.cats).forEach(k => need(t.cats, k, 'cats.' + k));
  Object.keys(M.outcomes).forEach(k => ['name', 'desc'].forEach(f => need((t.outcomes || {})[k], f, 'outcomes.' + k + '.' + f)));
  Array.from(new Set(M.dims.map(d => d.lens))).forEach(k => need(t.lens, k, 'lens.' + k));
  ['name', 'desc'].forEach(f => need(t.hold, f, 'hold.' + f));
  const srcs = new Set();
  M.moves.forEach(v => String(v.src || '').split(' · ').filter(Boolean).forEach(x => srcs.add(x)));
  srcs.forEach(x => need(t.srcs, x, 'srcs[' + JSON.stringify(x) + ']'));
  M.dims.forEach(d => ['name', 'short', 'lo', 'hi', 'desc', 'basis'].forEach(f => need((t.dims || {})[d.id], f, 'dims.' + d.id + '.' + f)));
  M.players.forEach(p => {
    const s = (t.players || {})[p.id] || {};
    ['name', 'short', 'role'].forEach(f => need(s, f, 'players.' + p.id + '.' + f));
    ['interests', 'redlines', 'leverage', 'vuln'].forEach(f => (p[f] || []).forEach((x, i) => { if (!Array.isArray(s[f]) || typeof s[f][i] !== 'string' || !s[f][i]) miss.push('players.' + p.id + '.' + f + '[' + i + ']'); }));
  });
  M.moves.forEach(v => ['name', 'desc', 'mit', 'counter', 'commitNote'].forEach(f => { if (v[f]) need((t.moves || {})[v.id], f, 'moves.' + v.id + '.' + f); }));
  M.precedents.forEach(p => ['name', 'lesson'].forEach(f => need((t.precedents || {})[p.id], f, 'precedents.' + p.id + '.' + f)));
  return miss;
}

const list = catalogue();
if (process.argv.indexOf('--check') < 0) {
  fs.mkdirSync(path.join(root, 'i18n'), { recursive: true });
  fs.writeFileSync(path.join(root, 'i18n/strings.en.json'), JSON.stringify(list, null, 2) + '\n');
  console.log('i18n/strings.en.json', list.length, 'strings');
} else {
  const sb = {}; sb.self = sb; vm.runInNewContext(read('js/model.js'), sb);
  let bad = 0;
  LANGS.forEach(lang => {
    const p = pack(lang), ui = p.ui || {};
    const noUi = list.filter(s => !has(ui, s)), noModel = modelGaps(sb.MODEL, p.model);
    const marksOff = list.filter(s => has(ui, s) && marks(ui[s]) !== marks(s));
    const extra = Object.keys(ui).filter(s => list.indexOf(s) < 0);
    console.log('\n== ' + lang + ' (' + p.files + ' of 2 pack files found) ==');
    console.log('interface: ' + (list.length - noUi.length) + ' of ' + list.length + ' strings translated');
    noUi.forEach(s => console.log('  missing: ' + JSON.stringify(s)));
    marksOff.forEach(s => console.log('  placeholders differ: ' + JSON.stringify(s) + ' -> ' + JSON.stringify(ui[s])));
    if (extra.length) console.log('  (' + extra.length + ' entries are not in the catalogue and are never used' + (extra.length <= 10 ? ': ' + extra.map(s => JSON.stringify(s)).join(', ') : '') + ')');
    console.log('model: ' + (noModel.length ? noModel.length + ' fields missing' : 'complete'));
    noModel.forEach(s => console.log('  missing: ' + s));
    bad += noUi.length + noModel.length + marksOff.length;
  });
  console.log(bad ? '\n' + bad + ' gaps in all.' : '\nBoth packs are complete.');
  process.exit(bad ? 1 : 0);
}
