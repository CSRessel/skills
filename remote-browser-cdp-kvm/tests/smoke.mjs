import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../scripts/bcdp.mjs', import.meta.url));
const profile = mkdtempSync(join(tmpdir(), 'bcdp-smoke-'));
const basePort = 20000 + (process.pid % 10000);
const env = {
  ...process.env,
  BCDP_PROFILE: profile,
  BCDP_PORT: String(basePort),
  BCDP_KVM_PORT: String(basePort + 1),
  BCDP_HEADED: '0',
};

function run(args, allowFailure = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('exit', (code) => {
      if (code !== 0 && !allowFailure) {
        reject(new Error(`${args.join(' ')} failed (${code}): ${stdout}${stderr}`));
      } else {
        resolve({ code, output: stdout.trim() ? JSON.parse(stdout) : null });
      }
    });
  });
}

const server = http.createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end('<!doctype html><title>BCDP smoke</title><button>Ready</button>');
});

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const pageUrl = `http://127.0.0.1:${address.port}/`;
  const shot = join(profile, 'shot.png');

  assert.equal((await run(['launch'])).output.ok, true);
  assert.equal(statSync(profile).mode & 0o777, 0o700);
  assert.equal((await run(['open', pageUrl, '--shot', shot, '--wait', '50'])).output.ok, true);
  assert.equal(existsSync(shot), true);

  const kvm = (await run(['kvm', 'start'])).output;
  const local = new URL(kvm.local);
  const token = local.hash.slice(1);
  assert.ok(token.length >= 32);
  const kvmPage = await (await fetch(`http://127.0.0.1:${basePort + 1}/`)).text();
  assert.equal(kvmPage.includes(token), false);
  assert.equal((await fetch(`http://127.0.0.1:${basePort + 1}/health`)).status, 403);
  assert.equal(
    (await fetch(`http://127.0.0.1:${basePort + 1}/health?token=${encodeURIComponent(token)}`)).status,
    200,
  );

  console.log('remote-browser-cdp-kvm smoke test passed');
} finally {
  await run(['kvm', 'stop'], true);
  await run(['stop'], true);
  await new Promise((resolve) => server.close(resolve));
  rmSync(profile, { recursive: true, force: true });
}
