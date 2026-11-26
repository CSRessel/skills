import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillRegion } from './sync.mjs';

const css = { start: '/* theme:tokens start */', end: '/* theme:tokens end */' };

test('replaces the region body and indents it to the start marker', () => {
  const before = '<style>\n    /* theme:tokens start */\n    old\n    /* theme:tokens end */\n    body {}\n</style>\n';
  const after = fillRegion(before, css, ':root {\n  --ink: #000;\n}\n');
  assert.equal(after,
    '<style>\n    /* theme:tokens start */\n    :root {\n      --ink: #000;\n    }\n    /* theme:tokens end */\n    body {}\n</style>\n');
});

test('keeps blank lines in the source unindented', () => {
  const after = fillRegion('  /* theme:tokens start */\n  /* theme:tokens end */\n', css, 'a\n\nb\n');
  assert.equal(after, '  /* theme:tokens start */\n  a\n\n  b\n  /* theme:tokens end */\n');
});

test('is a no-op when the region already matches', () => {
  const once = fillRegion('/* theme:tokens start */\n/* theme:tokens end */\n', css, 'x\n');
  assert.equal(fillRegion(once, css, 'x\n'), once);
});

test('throws when a marker is missing', () => {
  assert.throws(() => fillRegion('/* theme:tokens start */\n', css, 'x\n'), /theme:tokens end/);
  assert.throws(() => fillRegion('nothing here\n', css, 'x\n'), /theme:tokens start/);
});
