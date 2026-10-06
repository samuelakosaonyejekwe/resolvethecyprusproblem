/* Produces offline.html: the whole tool in one self-contained file.
   Usage: node tools/build.js */
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
/* Language packs are optional: whichever exist are built in. */
const packs = ['el.model', 'el.ui', 'el.guide', 'tr.model', 'tr.ui', 'tr.guide'].map(n => 'js/lang/' + n + '.js').filter(f => fs.existsSync(path.join(root, f)));
let html = read('index.html');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(read('icons/icon.svg')).toString('base64');
html = html.replace(/<link rel="manifest"[^>]*>\n/, '')
  .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" href="' + icon + '">')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n/, '')
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + read('styles.css') + '</style>')
  .replace(/<script src="js\/i18n\.js" defer><\/script>[\s\S]*<script src="js\/app\.js" defer><\/script>/, () =>
    '<script>window.KNOWLEDGE=' + safe(read('data/knowledge.json')) + ';</script>\n' +
    ['js/i18n.js'].concat(packs, ['js/model.js', 'js/engine.js', 'js/live.js', 'js/guide.js']).map(f => '<script>' + safe(read(f)) + '</script>').join('\n') +
    '\n<script>document.addEventListener("DOMContentLoaded",function(){' + safe(read('js/app.js')) + '});</script>');
if (/src="js\//.test(html) || /href="styles\.css"/.test(html)) throw new Error('inlining failed');
fs.writeFileSync(path.join(root, 'offline.html'), html);
/* Stamp the service worker with a fingerprint of the published files, so every
   release replaces the stored copy as a whole and open pages reload once. */
const crypto = require('crypto'), swPath = path.join(root, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8');
const shell = eval(/var SHELL = (\[[\s\S]*?\]);/.exec(sw)[1]).filter(f => f !== './' && fs.existsSync(path.join(root, f)));
const stamp = crypto.createHash('sha1').update(shell.map(f => fs.readFileSync(path.join(root, f))).reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0))).digest('hex').slice(0, 10);
fs.writeFileSync(swPath, sw.replace(/var CACHE = '[^']*';/, "var CACHE = 'cyprus-board-" + stamp + "';"));
console.log('offline.html', (html.length / 1024).toFixed(0) + ' KB', '· language packs:', packs.length ? packs.map(f => path.basename(f, '.js')).join(', ') : 'none');
