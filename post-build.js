// Optional web-build tweak: strip the Electron-only CSP meta from dist/index.html.
// Paths are relative to this file so it works on any machine and on Vercel.
const fs = require('fs');
const path = require('path');

const distHtml = path.join(__dirname, 'dist', 'index.html');
if (fs.existsSync(distHtml)) {
  const html = fs.readFileSync(distHtml, 'utf8');
  const stripped = html.replace(/<meta http-equiv=["']Content-Security-Policy["'][^>]*>/i, '');
  if (stripped !== html) {
    fs.writeFileSync(distHtml, stripped, 'utf8');
    console.log('[PostBuild] Stripped CSP meta tag from dist/index.html');
  }
}
