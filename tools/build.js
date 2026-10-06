/* Produces offline.html: the whole tool in one self-contained file.
   Usage: node tools/build.js */
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
let html = read('index.html');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(read('icons/icon.svg')).toString('base64');
html = html.replace(/<link rel="manifest"[^>]*>\n/, '')
  .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" href="' + icon + '">')
  .replace(/<link rel="apple-touch-icon"[^>]*>\n/, '')
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + read('styles.css') + '</style>')
  .replace(/<script src="js\/model\.js" defer><\/script>[\s\S]*<script src="js\/app\.js" defer><\/script>/, () =>
    '<script>window.KNOWLEDGE=' + safe(read('data/knowledge.json')) + ';</script>\n' +
    ['model', 'engine', 'live'].map(n => '<script>' + safe(read('js/' + n + '.js')) + '</script>').join('\n') +
    '\n<script>document.addEventListener("DOMContentLoaded",function(){' + safe(read('js/app.js')) + '});</script>');
if (/src="js\//.test(html) || /href="styles\.css"/.test(html)) throw new Error('inlining failed');
fs.writeFileSync(path.join(root, 'offline.html'), html);
console.log('offline.html', (html.length / 1024).toFixed(0) + ' KB');
