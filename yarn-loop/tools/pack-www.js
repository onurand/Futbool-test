/* Copies the playable static files into www/ — Capacitor's webDir. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');

const FILES = ['index.html', 'style.css', 'game.js', 'manifest.webmanifest', 'sw.js'];

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(path.join(WWW, 'icons'), { recursive: true });

for (const f of FILES) {
  fs.copyFileSync(path.join(ROOT, f), path.join(WWW, f));
}
for (const f of fs.readdirSync(path.join(ROOT, 'icons'))) {
  fs.copyFileSync(path.join(ROOT, 'icons', f), path.join(WWW, 'icons', f));
}

console.log('www/ hazır:', fs.readdirSync(WWW).join(', '));
