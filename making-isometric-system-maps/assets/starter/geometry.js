const TILE_X = 36;
const TILE_Y = 18;
const STOREY = 26;
const SHAPES = new Set([
  'box', 'slab', 'cylinder', 'stack', 'repeat', 'shards', 'user',
]);
const EDGE_KINDS = new Set(['data', 'control', 'store']);
export const THEMES = ['paper', 'carbon', 'cyanotype'];

export const project = (x, y, z = 0) => [
  (x - y) * TILE_X,
  (x + y) * TILE_Y - z * STOREY,
];

// The floor lattice fades out through a halo a few tiles beyond the drawing.
export function gridLines(items, fade = 4) {
  const x0 = Math.floor(Math.min(...items.map(item => item.x)) - fade);
  const y0 = Math.floor(Math.min(...items.map(item => item.y)) - fade);
  const x1 = Math.ceil(Math.max(...items.map(item => item.x + item.w)) + fade);
  const y1 = Math.ceil(Math.max(...items.map(item => item.y + item.d)) + fade);
  const lines = [];

  const add = (from, to) => {
    const [x, y] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const distance = Math.min(...items.map(item => Math.max(
      item.x - x, x - item.x - item.w,
      item.y - y, y - item.y - item.d, 0,
    )));
    if (distance > fade) return;
    lines.push({ points: [project(...from), project(...to)], opacity: (1 - distance / (fade + 1)) ** 2 });
  };

  for (let x = x0; x <= x1; x++) for (let y = y0; y < y1; y++) add([x, y], [x, y + 1]);
  for (let y = y0; y <= y1; y++) for (let x = x0; x < x1; x++) add([x, y], [x + 1, y]);
  return lines;
}

// A plan circle projects to an axis-aligned ellipse. Sizing it from the
// footprint's inscribed circle keeps a round shape inside its own tiles, so
// routes still meet the centre the router aimed at.
export const disc = (w, d) => {
  const r = Math.min(w, d) / 2 * Math.SQRT2;
  return [r * TILE_X, r * TILE_Y];
};

// Lays text flat on the floor plane, running along the +x plan axis.
const unit = ([x, y]) => [x / Math.hypot(x, y), y / Math.hypot(x, y)];

export function floorText(x, y) {
  const [ax, ay] = unit(project(1, 0));
  const [bx, by] = unit(project(0, 1));
  const [tx, ty] = project(x, y);
  return `matrix(${ax} ${ay} ${bx} ${by} ${tx} ${ty})`;
}

const corners = n => [
  [n.x, n.y], [n.x + n.w, n.y],
  [n.x + n.w, n.y + n.d], [n.x, n.y + n.d],
];

export function route(a, b) {
  const from = [a.x + a.w / 2, a.y + a.d / 2];
  const to = [b.x + b.w / 2, b.y + b.d / 2];
  const elbow = Math.abs(to[0] - from[0]) > Math.abs(to[1] - from[1])
    ? [to[0], from[1]] : [from[0], to[1]];
  return [from, elbow, to]
    .filter((point, i, all) => i === 0 || point[0] !== all[i - 1][0] || point[1] !== all[i - 1][1])
    .map(point => project(...point));
}

export function bounds(nodes) {
  const frame = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const node of nodes) for (const corner of corners(node)) for (const z of [0, node.h]) {
    const [x, y] = project(...corner, z);
    frame.x0 = Math.min(frame.x0, x);
    frame.x1 = Math.max(frame.x1, x);
    frame.y0 = Math.min(frame.y0, y);
    frame.y1 = Math.max(frame.y1, y);
  }
  frame.y1 += 24;
  return frame;
}

export function fitCamera(frame, width, height, padding = 48, maxScale = 2.5) {
  const drawingWidth = Math.max(1, frame.x1 - frame.x0);
  const drawingHeight = Math.max(1, frame.y1 - frame.y0);
  const k = Math.max(.1, Math.min(maxScale, (width - padding * 2) / drawingWidth, (height - padding * 2) / drawingHeight));
  return {
    k,
    x: width / 2 - (frame.x0 + frame.x1) / 2 * k,
    y: height / 2 - (frame.y0 + frame.y1) / 2 * k,
  };
}

function collectIds(items, name) {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`duplicate ${name} id "${item.id}"`);
    ids.add(item.id);
  }
  return ids;
}

export function validate(map) {
  if (map.theme && !THEMES.includes(map.theme)) throw new Error(`unknown theme "${map.theme}"`);
  const zones = collectIds(map.zones, 'zone');
  const nodes = collectIds(map.nodes, 'node');
  const edges = collectIds(map.edges, 'edge');

  for (const node of map.nodes) {
    if (!zones.has(node.zone)) throw new Error(`unknown zone "${node.zone}"`);
    if (!SHAPES.has(node.shape ?? 'box')) throw new Error(`unknown shape "${node.shape}"`);
  }
  for (const edge of map.edges) {
    for (const id of [edge.from, edge.to]) {
      if (!nodes.has(id)) throw new Error(`unknown node "${id}"`);
    }
    if (!EDGE_KINDS.has(edge.kind)) throw new Error(`unknown edge kind "${edge.kind}"`);
  }
  for (const [id] of map.flow ?? []) {
    if (!edges.has(id)) throw new Error(`unknown flow edge "${id}"`);
  }
  return map;
}
