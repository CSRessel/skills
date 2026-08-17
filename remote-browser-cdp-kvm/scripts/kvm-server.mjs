// kvm-server — phone-friendly remote control of ONE Chrome tab, over CDP.
// Streams JPEG frames to the browser via SSE (no websocket dep) and forwards
// taps / scroll / typing back via fetch POST -> CDP Input.*  Zero extra deps
// beyond playwright (already vendored by the skill).
//
// Bind is 127.0.0.1 only; a human exposes it to their phone with:
//     tailscale serve --bg <BCDP_KVM_PORT>
// Used for steps only a human can do: login, reCAPTCHA, SSO consent, 2FA,
// or "eyeball this and approve".
import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chromium } from 'playwright';

const KVM_PORT = Number(process.env.BCDP_KVM_PORT || 6080);
const PORT = process.env.BCDP_PORT || '9333';
const MATCH = process.env.BCDP_KVM_MATCH || ''; // optional url substring to pin a tab
const TOKEN = process.env.BCDP_KVM_TOKEN;
if (!TOKEN) throw new Error('BCDP_KVM_TOKEN is required');

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
const pickPage = () => {
  const pages = ctx.pages().filter((p) => !p.isClosed());
  return (MATCH && pages.find((p) => p.url().includes(MATCH))) ||
    pages.find((p) => p.url() && !p.url().startsWith('about:')) || pages[0];
};
let page = pickPage();
let client = await ctx.newCDPSession(page);
let vw = 1440, vh = 900;

async function measure() {
  try { const s = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight })); if (s.w) { vw = s.w; vh = s.h; } } catch {}
}
const sseClients = new Set();
let latest = null;

async function startScreencast() {
  await measure();
  client.on('Page.screencastFrame', async (evt) => {
    latest = evt.data;
    for (const res of sseClients) res.write(`data: ${evt.data}\n\n`);
    try { await client.send('Page.screencastFrameAck', { sessionId: evt.sessionId }); } catch {}
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 55, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });
}
await startScreencast();

// Re-pin if the tab navigates or a new tab (SSO popup) becomes the active one.
setInterval(async () => {
  const p = pickPage();
  if (p && p !== page) { page = p; try { client = await ctx.newCDPSession(page); await startScreencast(); } catch {} }
  else await measure();
}, 2000);

async function dispatch(body) {
  const x = Math.round((body.fx ?? 0) * vw), y = Math.round((body.fy ?? 0) * vh);
  if (body.type === 'tap') {
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  } else if (body.type === 'scroll') {
    await client.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: body.dy ?? 0 });
  } else if (body.type === 'text') {
    await client.send('Input.insertText', { text: body.text ?? '' });
  } else if (body.type === 'key') {
    const m = { Enter: { code: 'Enter', key: 'Enter', windowsVirtualKeyCode: 13 },
                Backspace: { code: 'Backspace', key: 'Backspace', windowsVirtualKeyCode: 8 },
                Tab: { code: 'Tab', key: 'Tab', windowsVirtualKeyCode: 9 } }[body.key];
    if (m) { await client.send('Input.dispatchKeyEvent', { type: 'keyDown', ...m }); await client.send('Input.dispatchKeyEvent', { type: 'keyUp', ...m }); }
  }
}

function authorized(req) {
  const supplied = new URL(req.url, 'http://localhost').searchParams.get('token') || '';
  const actual = Buffer.from(TOKEN);
  const candidate = Buffer.from(supplied);
  return actual.length === candidate.length && timingSafeEqual(actual, candidate);
}

function html(nonce) {
  return `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style nonce="${nonce}">html,body{margin:0;background:#111;height:100%;overflow:hidden;font-family:system-ui}
#wrap{position:fixed;inset:0;display:flex;flex-direction:column}
#screen{flex:1;object-fit:contain;width:100%;min-height:0;touch-action:none;background:#000}
#bar{display:flex;gap:6px;padding:6px;background:#1e1e1e}
#bar input{flex:1;font-size:16px;padding:8px;border-radius:6px;border:1px solid #444;background:#222;color:#eee}
#bar button{font-size:15px;padding:8px 10px;border-radius:6px;border:0;background:#3a7;color:#fff}</style>
<div id=wrap><img id=screen><div id=bar>
<input id=txt placeholder="type into focused field" autocapitalize=off autocorrect=off spellcheck=false>
<button id=send>Send</button><button id=ent>⏎</button><button id=bk>⌫</button></div></div>
<script nonce="${nonce}">
const token=window.location.hash.slice(1);
history.replaceState(null,'',window.location.pathname+window.location.search);
const img=document.getElementById('screen');
const es=new EventSource('/stream?token='+encodeURIComponent(token)); es.onmessage=e=>{img.src='data:image/jpeg;base64,'+e.data};
function post(b){fetch('/input?token='+encodeURIComponent(token),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})}
function frac(ev){const r=img.getBoundingClientRect();const natW=img.naturalWidth||1440,natH=img.naturalHeight||900;
  const s=Math.min(r.width/natW,r.height/natH),dw=natW*s,dh=natH*s,ox=r.left+(r.width-dw)/2,oy=r.top+(r.height-dh)/2;
  return {fx:Math.max(0,Math.min(1,(ev.clientX-ox)/dw)),fy:Math.max(0,Math.min(1,(ev.clientY-oy)/dh))};}
let sy=0;
img.addEventListener('pointerdown',e=>{sy=e.clientY;img._d=frac(e);img._m=false});
img.addEventListener('pointermove',e=>{if(img._d){const dy=sy-e.clientY;if(Math.abs(dy)>6){img._m=true;const f=frac(e);post({type:'scroll',fx:f.fx,fy:f.fy,dy});sy=e.clientY}}});
img.addEventListener('pointerup',e=>{const f=frac(e);if(!img._m)post({type:'tap',...f});img._d=null});
send.onclick=()=>{if(txt.value){post({type:'text',text:txt.value});txt.value=''}};
ent.onclick=()=>post({type:'key',key:'Enter'});bk.onclick=()=>post({type:'key',key:'Backspace'});
</script>`;
}

function secureHeaders(nonce) {
  return {
    'cache-control': 'no-store',
    'content-security-policy': `default-src 'none'; img-src data:; connect-src 'self'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  };
}

http.createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/') {
    const nonce = randomBytes(18).toString('base64url');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...secureHeaders(nonce) });
    return res.end(html(nonce));
  }
  if (!authorized(req)) { res.writeHead(403); return res.end(); }
  if (path === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end('{"ok":true}');
  }
  if (path === '/stream') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    if (latest) res.write(`data: ${latest}\n\n`);
    sseClients.add(res); req.on('close', () => sseClients.delete(res)); return;
  }
  if (path === '/input' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 65536) req.destroy();
    });
    req.on('end', async () => {
      try {
        await dispatch(JSON.parse(body));
        res.writeHead(204);
      } catch {
        res.writeHead(400);
      }
      res.end();
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(KVM_PORT, '127.0.0.1', () => console.log(`KVM on http://127.0.0.1:${KVM_PORT} (tab ${page.url()})`));
