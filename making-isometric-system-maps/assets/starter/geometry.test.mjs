import assert from 'node:assert/strict';
import test from 'node:test';

import * as geometry from './geometry.js';

const { bounds, fitCamera, floorText, project, route, validate } = geometry;

const node = (id, x, y, extra = {}) => ({ id, x, y, w: 2, d: 2, h: 1, ...extra });
const validMap = () => ({
  zones: [{ id: 'zone' }],
  nodes: [
    node('a', 0, 0, { zone: 'zone', shape: 'box' }),
    node('b', 2, 0, { zone: 'zone', shape: 'cylinder' }),
  ],
  edges: [{ id: 'edge', from: 'a', to: 'b', kind: 'data' }],
  flow: [['edge', 'one step']],
});

test('projects plan coordinates onto one isometric grid', () => {
  assert.deepEqual(project(2, 1, 1), [36, 28]);
});

test('fades both projected floor-grid families through a four-tile halo', () => {
  const key = points => points.map(point => point.join(',')).sort().join(' to ');
  const lines = new Map(geometry.gridLines([{ x: 0, y: 0, w: 1, d: 1 }])
    .map(line => [key(line.points), line.opacity]));

  assert.equal(lines.get(key([project(0, 0), project(0, 1)])), 1);
  assert.equal(lines.get(key([project(0, 0), project(1, 0)])), 1);
  assert.ok(lines.get(key([project(-4, 0), project(-4, 1)])) < .05);
  assert.ok(lines.get(key([project(0, -4), project(1, -4)])) < .05);
  assert.equal(lines.has(key([project(-5, 0), project(-5, 1)])), false);
  assert.equal(lines.has(key([project(0, -5), project(1, -5)])), false);
});

test('sizes a round unit from the inscribed circle of its footprint', () => {
  // A store must stay inside its own tiles so a route still meets its centre.
  const [rx, ry] = geometry.disc(5, 3);
  const [halfWidth] = project(5, 0);

  assert.ok(rx < halfWidth);
  assert.deepEqual([rx, ry], geometry.disc(3, 3));
  assert.ok(Math.abs(rx / ry - 2) < 1e-9);
});

test('lays a floor label flat along the plan x axis', () => {
  const [a, b, c, d, tx, ty] = floorText(2, 1)
    .match(/-?[\d.]+/g).map(Number);

  // Unit basis: text runs along +x, its own down axis follows +y.
  assert.ok(Math.abs(Math.hypot(a, b) - 1) < 1e-9);
  assert.ok(Math.abs(Math.hypot(c, d) - 1) < 1e-9);
  assert.ok(a > 0 && b > 0 && c < 0 && d > 0);
  assert.deepEqual([tx, ty], project(2, 1));
});

test('accepts an omitted shape and every shape in the vocabulary', () => {
  const map = validMap();
  delete map.nodes[0].shape;
  assert.doesNotThrow(() => validate(map));

  for (const shape of ['box', 'slab', 'cylinder', 'stack', 'repeat', 'shards', 'user']) {
    map.nodes[1].shape = shape;
    assert.doesNotThrow(() => validate(map), shape);
  }
});

test('routes a relationship from centre to centre through the plan grid', () => {
  const from = node('a', 0, 0);
  const to = node('b', 5, 2);
  assert.deepEqual(route(from, to), [[0, 36], [180, 126], [108, 162]]);
});

test('collapses an aligned relationship to one straight segment', () => {
  assert.deepEqual(route(node('a', 0, 0), node('b', 0, 5)), [[0, 36], [-180, 126]]);
});

test('bounds include footprint, elevated top, and label room', () => {
  assert.deepEqual(bounds([node('a', 1, 2, { w: 3, d: 2, h: 2 })]), {
    x0: -108, x1: 72, y0: 2, y1: 168,
  });
});

test('fits a drawing frame inside the requested viewport padding', () => {
  const frame = { x0: -100, x1: 300, y0: -50, y1: 150 };
  const camera = fitCamera(frame, 390, 500, 32);
  const shown = {
    left: frame.x0 * camera.k + camera.x,
    right: frame.x1 * camera.k + camera.x,
    top: frame.y0 * camera.k + camera.y,
    bottom: frame.y1 * camera.k + camera.y,
  };

  assert.ok(shown.left >= 31 && shown.right <= 359);
  assert.ok(shown.top >= 31 && shown.bottom <= 469);
});

test('lets a small map start closer than two-times scale', () => {
  const camera = fitCamera({ x0: 0, x1: 100, y0: 0, y1: 100 }, 1000, 800, 36);
  assert.ok(camera.k > 2);
});

test('rejects a dangling relationship before the map renders', () => {
  for (const edge of [
    { id: 'edge', from: 'a', to: 'missing', kind: 'data' },
    { id: 'edge', from: 'missing', to: 'a', kind: 'data' },
  ]) {
    assert.throws(
      () => validate({ ...validMap(), edges: [edge] }),
      /unknown node "missing"/,
    );
  }
});

test('rejects malformed map data at startup', () => {
  const cases = [
    [map => map.nodes.push({ ...map.nodes[0] }), /duplicate node id "a"/],
    [map => map.edges.push({ ...map.edges[0] }), /duplicate edge id "edge"/],
    [map => { map.nodes[0].zone = 'missing'; }, /unknown zone "missing"/],
    [map => { map.nodes[0].shape = 'cloud'; }, /unknown shape "cloud"/],
    [map => { map.edges[0].kind = 'magic'; }, /unknown edge kind "magic"/],
    [map => { map.flow[0][0] = 'missing'; }, /unknown flow edge "missing"/],
    [map => { map.theme = 'sepia'; }, /unknown theme "sepia"/],
  ];

  for (const [breakMap, message] of cases) {
    const map = validMap();
    breakMap(map);
    assert.throws(() => validate(map), message);
  }
});
