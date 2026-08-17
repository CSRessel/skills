#!/usr/bin/env node
// bcdp — "browser CDP" verbs for the remote-browser-cdp-kvm skill.
//
// One self-contained CLI. Each verb connects to a long-lived, shared Chrome over
// CDP, performs ONE task, prints a compact JSON result to stdout, and (optionally)
// writes a screenshot. Because the browser holds all state, every verb is
// stateless and repeatable — ideal for handing a single task to a cheap subagent.
//
// Usage:  node bcdp.mjs <verb> [args]        (see `node bcdp.mjs help`)
// Config (env, all optional):
//   BCDP_PROFILE   Chrome user-data-dir      (default ~/.cache/remote-browser-cdp-kvm)
//   BCDP_PORT      CDP debug port            (default 9333)
//   BCDP_HEADED    "1"/"0" force headed/less (default: headed iff $DISPLAY set)
//   DISPLAY        X display for headed mode  (e.g. :1)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = process.env.BCDP_PROFILE || join(homedir(), '.cache', 'remote-browser-cdp-kvm');
const PORT = process.env.BCDP_PORT || '9333';
const CDP = `http://127.0.0.1:${PORT}`;
const out = (o) => console.log(JSON.stringify(o));
const die = (msg) => { out({ ok: false, error: msg }); process.exit(1); };
const ensureProfile = () => {
  mkdirSync(PROFILE, { recursive: true, mode: 0o700 });
  chmodSync(PROFILE, 0o700);
};

// ---- tiny flag parser: `--k v`, `--k=v`, `--flag`, positionals ----
function parse(argv) {
  const pos = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[a.slice(2)] = argv[++i];
      else flags[a.slice(2)] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

async function cdpUp() {
  try { const r = await fetch(`${CDP}/json/version`, { signal: AbortSignal.timeout(1500) }); return r.ok; }
  catch { return false; }
}
async function connect() {
  if (!(await cdpUp())) die(`no browser on ${CDP} — run: node bcdp.mjs launch`);
  const browser = await chromium.connectOverCDP(CDP);
  const ctx = browser.contexts()[0];
  return { browser, ctx };
}
// Pick the page a verb acts on. --match <substr> selects by URL; else the first
// real (non about:blank) page, else the first page.
function pickPage(ctx, match) {
  const pages = ctx.pages().filter((p) => !p.isClosed());
  if (match) return pages.find((p) => p.url().includes(match)) || pages[0];
  return pages.find((p) => p.url() && !p.url().startsWith('about:')) || pages[0];
}
function requirePage(ctx, match) {
  const page = pickPage(ctx, match);
  if (!page) die('browser has no open page');
  return page;
}
// Resolve a locator from --selector / --text / --role[+--name], optionally scoped
// into an iframe via --frame <iframe-css> (needed for reCAPTCHA / embedded SSO).
function locator(page, flags) {
  const root = flags.frame ? page.frameLocator(flags.frame) : page;
  if (flags.selector) return root.locator(flags.selector).first();
  if (flags.text) return root.getByText(flags.text, { exact: false }).first();
  if (flags.role) return root.getByRole(flags.role, flags.name ? { name: flags.name, exact: false } : {}).first();
  die('need one of --selector / --text / --role');
}
async function snap(page, flags, extra = {}) {
  const res = { ok: true, url: page.url(), title: await page.title().catch(() => null), ...extra };
  if (flags.shot) {
    mkdirSync(dirname(flags.shot), { recursive: true });
    await page.screenshot({ path: flags.shot, fullPage: flags.full === true || flags.full === 'true' });
    res.shot = flags.shot;
  }
  return res;
}

async function waitForKvm(port, token, child) {
  const url = `http://127.0.0.1:${port}/health?token=${encodeURIComponent(token)}`;
  for (let i = 0; i < 30; i++) {
    if (child.exitCode != null) return false;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(300) });
      if (response.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

const [verb, ...rest] = process.argv.slice(2);
const { pos, flags } = parse(rest);

switch (verb) {
  case 'launch': {
    // Idempotent: if the port is live, do nothing. Else spawn a detached daemon.
    if (await cdpUp()) { out({ ok: true, already: true, port: PORT }); break; }
    ensureProfile();
    const log = join(PROFILE, 'browser.log');
    const logFd = openSync(log, 'a', 0o600);
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '__daemon'], {
      detached: true, stdio: ['ignore', logFd, logFd], env: process.env,
    });
    closeSync(logFd);
    child.unref();
    for (let i = 0; i < 40; i++) { if (await cdpUp()) { out({ ok: true, launched: true, pid: child.pid, port: PORT }); process.exit(0); } await new Promise((r) => setTimeout(r, 500)); }
    die('browser did not come up within 20s — check ' + log);
    break;
  }
  case '__daemon': {
    // Long-lived: owns the browser process; keeps it alive until killed.
    ensureProfile();
    const headed = process.env.BCDP_HEADED != null ? process.env.BCDP_HEADED === '1' : !!process.env.DISPLAY;
    const ctx = await chromium.launchPersistentContext(PROFILE, {
      headless: !headed, channel: 'chrome', viewport: { width: 1440, height: 900 },
      args: [`--remote-debugging-port=${PORT}`, '--remote-debugging-address=127.0.0.1', '--no-first-run', '--no-default-browser-check'],
    });
    writeFileSync(join(PROFILE, 'daemon.pid'), String(process.pid));
    process.on('SIGTERM', async () => { await ctx.close().catch(() => {}); process.exit(0); });
    await new Promise(() => {});
    break;
  }
  case 'stop': {
    const pf = join(PROFILE, 'daemon.pid');
    if (existsSync(pf)) { try { process.kill(Number(readFileSync(pf, 'utf8').trim()), 'SIGTERM'); } catch {} unlinkSync(pf); out({ ok: true, stopped: true }); }
    else out({ ok: true, note: 'no daemon.pid; browser may be externally managed' });
    break;
  }
  case 'status': {
    if (!(await cdpUp())) { out({ ok: false, up: false, port: PORT }); break; }
    const { browser, ctx } = await connect();
    const pages = await Promise.all(ctx.pages().filter((p) => !p.isClosed()).map(async (p) => ({ url: p.url(), title: await p.title().catch(() => null) })));
    out({ ok: true, up: true, port: PORT, pages });
    await browser.close();
    break;
  }
  case 'open': {
    const url = pos[0] || die('usage: open <url> [--shot p] [--wait ms]');
    let parsed;
    try { parsed = new URL(url); } catch { die('open requires an absolute http(s) URL'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) die('open permits only http(s) URLs');
    const { browser, ctx } = await connect();
    const page = pickPage(ctx, flags.match) || (await ctx.newPage());
    await page.goto(url, { waitUntil: flags.until || 'domcontentloaded', timeout: Number(flags.timeout || 45000) });
    await page.waitForTimeout(Number(flags.wait || 2500));
    out(await snap(page, flags));
    await browser.close();
    break;
  }
  case 'shot': {
    flags.shot = pos[0] || flags.shot || die('usage: shot <path> [--match sub] [--full]');
    const { browser, ctx } = await connect();
    out(await snap(requirePage(ctx, flags.match), flags));
    await browser.close();
    break;
  }
  case 'click': {
    const { browser, ctx } = await connect();
    const page = requirePage(ctx, flags.match);
    await locator(page, flags).click({ timeout: Number(flags.timeout || 15000) });
    await page.waitForTimeout(Number(flags.wait || 1500));
    out(await snap(page, flags, { clicked: flags.selector || flags.text || flags.role }));
    await browser.close();
    break;
  }
  case 'type': {
    const text = flags.value ?? pos[0];
    if (text == null) die('usage: type <text> --selector <css> [--enter] [--shot p]');
    const { browser, ctx } = await connect();
    const page = requirePage(ctx, flags.match);
    const el = locator(page, flags);
    await el.fill(String(text), { timeout: Number(flags.timeout || 15000) });
    if (flags.enter) await el.press('Enter');
    await page.waitForTimeout(Number(flags.wait || 800));
    out(await snap(page, flags, { typed: true }));
    await browser.close();
    break;
  }
  case 'read': {
    const { browser, ctx } = await connect();
    const page = requirePage(ctx, flags.match);
    const root = flags.selector ? locator(page, flags) : page.locator('body');
    const text = (await root.innerText({ timeout: Number(flags.timeout || 10000) }).catch(() => '')).slice(0, Number(flags.max || 4000));
    out(await snap(page, flags, { text }));
    await browser.close();
    break;
  }
  case 'wait': {
    const { browser, ctx } = await connect();
    const page = requirePage(ctx, flags.match);
    await locator(page, flags).waitFor({ state: flags.state || 'visible', timeout: Number(flags.timeout || 20000) });
    out(await snap(page, flags, { waited: true }));
    await browser.close();
    break;
  }
  case 'eval': {
    if (process.env.BCDP_ALLOW_EVAL !== '1') die('eval is disabled; set BCDP_ALLOW_EVAL=1 for a reviewed expression');
    const js = pos[0] || die('usage: eval "<js expression>"  (return value must be JSON-serialisable)');
    const { browser, ctx } = await connect();
    const page = requirePage(ctx, flags.match);
    const value = await page.evaluate((code) => {
      // eslint-disable-next-line no-new-func
      const r = Function('"use strict";return (' + code + ')')();
      return r;
    }, js);
    out(await snap(page, flags, { value }));
    await browser.close();
    break;
  }
  case 'kvm': {
    // Start/stop the phone/tailnet KVM (human-in-the-loop screencast control).
    const sub = pos[0];
    const KVM_PORT = process.env.BCDP_KVM_PORT || '6080';
    const pf = join(PROFILE, 'kvm.pid');
    if (sub === 'start') {
      if (!(await cdpUp())) die(`no browser on ${CDP} — launch it before starting KVM`);
      ensureProfile();
      const token = randomBytes(24).toString('base64url');
      const log = join(PROFILE, 'kvm.log');
      const logFd = openSync(log, 'a', 0o600);
      const child = spawn(process.execPath, [join(HERE, 'kvm-server.mjs')], {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: { ...process.env, BCDP_PORT: PORT, BCDP_KVM_PORT: KVM_PORT, BCDP_KVM_TOKEN: token },
      });
      closeSync(logFd);
      child.unref();
      if (!(await waitForKvm(KVM_PORT, token, child))) {
        try { process.kill(child.pid, 'SIGTERM'); } catch {}
        die(`KVM did not become ready — check ${log}`);
      }
      writeFileSync(pf, String(child.pid));
      out({ ok: true, kvm: 'started', local: `http://127.0.0.1:${KVM_PORT}/#${token}`, expose: `tailscale serve --bg ${KVM_PORT}`, then: `append /#${token} to the private tailscale URL`, teardown: `node bcdp.mjs kvm stop  &&  tailscale serve reset` });
    } else if (sub === 'stop') {
      if (existsSync(pf)) { try { process.kill(Number(readFileSync(pf, 'utf8').trim()), 'SIGTERM'); } catch {} unlinkSync(pf); }
      out({ ok: true, kvm: 'stopped', reminder: 'run `tailscale serve reset` to close the tailnet route' });
    } else die('usage: kvm start|stop');
    break;
  }
  case 'help': default: {
    out({ ok: true, verbs: {
      launch: 'ensure the shared browser is up (idempotent)',
      stop: 'stop the browser daemon this skill launched',
      status: 'is the browser up? list open pages',
      open: 'open <url> [--shot p] [--wait ms] [--until load] [--match sub]',
      shot: 'shot <path> [--match sub] [--full]',
      click: 'click --selector|--text|--role[ --name] [--frame css] [--shot p]',
      type: 'type <text> --selector <css> [--enter] [--shot p]',
      read: 'read [--selector css] [--max n] [--shot p]  -> {text}',
      wait: 'wait --selector|--text|--role [--state visible] [--timeout ms]',
      eval: 'eval "<js>" [--shot p]  -> {value}; requires BCDP_ALLOW_EVAL=1',
      kvm: 'kvm start|stop  — phone/tailnet human-in-the-loop control',
    }, config: { BCDP_PROFILE: PROFILE, BCDP_PORT: PORT, BCDP_KVM_PORT: process.env.BCDP_KVM_PORT || '6080' } });
  }
}
