const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-now';
const ROOT = __dirname;
const STATE_FILE = path.join(ROOT, 'data', 'state.json');

function readState() {
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}
function writeState(state) {
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, STATE_FILE);
}
function send(res, code, type, body) {
  res.writeHead(code, {'Content-Type': type, 'Cache-Control': 'no-store'});
  res.end(body);
}
function isAdmin(req) {
  return req.headers['x-admin-key'] === ADMIN_PASSWORD;
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);

  if (u.pathname === '/api/state' && req.method === 'GET') {
    try { return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(readState())); }
    catch (e) { return send(res, 500, 'application/json', JSON.stringify({error:'state'})); }
  }

  if (u.pathname === '/api/state' && req.method === 'PUT') {
    if (!isAdmin(req)) return send(res, 401, 'application/json', JSON.stringify({error:'unauthorized'}));
    let body = '';
    req.on('data', chunk => { if (body.length < 2_000_000) body += chunk; });
    req.on('end', () => {
      try {
        const state = JSON.parse(body);
        if (!state || !state.groups || !state.matches || !state.playoffs) throw new Error('bad state');
        writeState(state);
        send(res, 200, 'application/json', JSON.stringify({ok:true}));
      } catch (e) {
        send(res, 400, 'application/json', JSON.stringify({error:'bad json'}));
      }
    });
    return;
  }

  let filePath;
  if (u.pathname === '/admin' || u.pathname === '/admin/') filePath = path.join(ROOT, 'admin.html');
  else {
    const clean = decodeURIComponent(u.pathname);
    filePath = path.join(ROOT, clean === '/' ? 'index.html' : clean.replace(/^\/+/, ''));
  }

  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
  send(res, 200, types[ext] || 'application/octet-stream', fs.readFileSync(filePath));
});

server.listen(PORT, () => console.log(`Tournament site: http://localhost:${PORT}`));
