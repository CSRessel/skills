import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../scripts/bcdp.mjs', import.meta.url));

function run(args, extraEnv = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      BCDP_PORT: '19444',
      BCDP_KVM_PORT: '19445',
      BCDP_PROFILE: mkdtempSync(join(tmpdir(), 'bcdp-test-')),
      ...extraEnv,
    },
  });
}

test('help prints compact JSON', () => {
  const result = run(['help']);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.match(output.verbs.kvm, /start\|stop/);
});

test('KVM refuses to claim success without a browser', () => {
  const result = run(['kvm', 'start']);
  assert.notEqual(result.status, 0);
  assert.match(JSON.parse(result.stdout).error, /launch it before starting KVM/);
});

test('eval is disabled by default', () => {
  const result = run(['eval', '1 + 1']);
  assert.notEqual(result.status, 0);
  assert.match(JSON.parse(result.stdout).error, /eval is disabled/);
});

test('KVM endpoints require a token and set a CSP', () => {
  const source = readFileSync(new URL('../scripts/kvm-server.mjs', import.meta.url), 'utf8');
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /content-security-policy/);
  assert.match(source, /frame-ancestors 'none'/);
  assert.match(source, /window\.location\.hash\.slice/);
  assert.doesNotMatch(source, /const token = JSON\.stringify\(TOKEN\)/);
});
