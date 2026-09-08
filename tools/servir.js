// Servidor estático mínimo pra pré-visualizar o renderer no navegador.
// uso: node tools/servir.js [porta]   (raiz = a pasta do projeto)
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.resolve(__dirname, '..');
const porta = +process.argv[2] || 5174;
const tipos = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const arq = path.join(raiz, p);
  if (!arq.startsWith(raiz)) { res.writeHead(403); return res.end(); }
  fs.readFile(arq, (e, d) => {
    if (e) { res.writeHead(404); return res.end('nao achei ' + p); }
    res.writeHead(200, { 'Content-Type': tipos[path.extname(arq).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(d);
  });
}).listen(porta, '127.0.0.1', () => console.log('servindo ' + raiz + ' em http://127.0.0.1:' + porta));
