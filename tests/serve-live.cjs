// Local-only source delivery for Mixdog browser integration tests.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
http.createServer((req, res) => {
  const origins = ['https://uploadnow.io', 'https://kio.ac', 'https://mypikpak.com', 'https://gofile.io', 'https://docs.google.com', 'https://transfer.it'];
  if (origins.includes(req.headers.origin)) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.url !== '/script.js') { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  res.end(fs.readFileSync(path.join(__dirname, '../Kone_Plus.user.js')));
}).listen(18764, '127.0.0.1', () => console.log('Browser test source: http://127.0.0.1:18764/script.js'));
