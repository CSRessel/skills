// Swipe-card review: serves index.html, a deck JSON, and persists answers.
// Usage: node server.mjs [deck.json] [answers.json] [port]
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const deckPath = resolve(process.argv[2] ?? `${here}/deck.json`);
const answersPath = resolve(process.argv[3] || deckPath.replace(/\.json$/, '') + '.answers.json');
const port = Number(process.argv[4] || process.env.PORT || 4100);
const host = process.env.HOST || '127.0.0.1';

const readJson = async (p, fallback) => {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; }
};
const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  try {
    if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
      return send(res, 200, await readFile(`${here}/index.html`, 'utf8'), 'text/html; charset=utf-8');
    }
    if (req.method === 'GET' && path.endsWith('/api/deck')) {
      return send(res, 200, await readJson(deckPath, { items: [] }));
    }
    if (req.method === 'GET' && path.endsWith('/api/answers')) {
      return send(res, 200, await readJson(answersPath, { answers: {} }));
    }
    if (req.method === 'POST' && path.endsWith('/api/answers')) {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw || '{}');
      const out = { deck: deckPath, updatedAt: new Date().toISOString(), answers: body.answers ?? {} };
      await writeFile(answersPath, JSON.stringify(out, null, 2));
      return send(res, 200, { ok: true });
    }
    send(res, 404, { error: 'not found' });
  } catch (err) {
    send(res, 500, { error: String(err) });
  }
}).listen(port, host, () => console.log(`card-review on ${host}:${port} deck=${deckPath} answers=${answersPath}`));
