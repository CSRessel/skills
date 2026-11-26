#!/usr/bin/env node
// Copies theme/tokens.css and theme/mermaid.js into every surface that inlines
// them. Run with no arguments to write, or with --check to fail on drift.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CSS = {
  source: 'theme/tokens.css',
  start: '/* theme:tokens start — copied from theme/tokens.css by theme/sync.mjs */',
  end: '/* theme:tokens end */',
};
const MERMAID = {
  source: 'theme/mermaid.js',
  start: '// theme:mermaid start — copied from theme/mermaid.js by theme/sync.mjs',
  end: '// theme:mermaid end',
};

export const SURFACES = [
  ['code-orientation/viewer/viewer.html', CSS],
  ['code-orientation/viewer/viewer.js', MERMAID],
  ['presenting-html-plans/assets/scaffold/index.html', CSS],
  ['presenting-html-plans/assets/scaffold/app.mjs', MERMAID],
  ['making-isometric-system-maps/assets/starter/style.css', CSS],
  ['reviewing-with-swipe-cards/assets/index.html', CSS],
];

export function fillRegion(text, { start, end }, body) {
  const startAt = text.indexOf(start);
  if (startAt < 0) throw new Error(`missing marker: ${start}`);
  const endAt = text.indexOf(end, startAt);
  if (endAt < 0) throw new Error(`missing marker: ${end}`);
  const lineStart = text.lastIndexOf('\n', startAt) + 1;
  const indent = text.slice(lineStart, startAt);
  const bodyLines = body.replace(/\n$/, '').split('\n')
    .map((line) => (line ? indent + line : line));
  const head = text.slice(0, startAt + start.length);
  return `${head}\n${bodyLines.join('\n')}\n${indent}${text.slice(endAt)}`;
}

function main(check) {
  const stale = [];
  for (const [file, region] of SURFACES) {
    const path = join(root, file);
    const text = readFileSync(path, 'utf8');
    const next = fillRegion(text, region, readFileSync(join(root, region.source), 'utf8'));
    if (next === text) continue;
    stale.push(file);
    if (!check) writeFileSync(path, next);
  }
  if (check && stale.length) {
    console.error(`Theme out of sync; run node theme/sync.mjs:\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log(check ? 'Theme in sync.' : `Updated ${stale.length} file(s).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.includes('--check'));
