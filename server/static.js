const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'dist');
const contentTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  const requested = decodeURIComponent(req.url.split('?')[0]);
  const target = path.join(root, requested === '/' ? 'index.html' : requested);
  const file = target.startsWith(root) && fs.existsSync(target) && fs.statSync(target).isFile() ? target : path.join(root, 'index.html');
  fs.readFile(file, (error, content) => {
    if (error) return res.writeHead(404).end('Build nao encontrado. Execute npm run build.');
    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream' });
    return res.end(content);
  });
}).listen(5173, () => console.log('Portal Formis em http://localhost:5173'));
