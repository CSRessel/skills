import map from './data.js';
import { THEMES, bounds, disc, fitCamera, floorText, gridLines, project, route, validate } from './geometry.js';

validate(map);

const $ = selector => document.querySelector(selector);
const byId = new Map(map.nodes.map(node => [node.id, node]));
const edgeById = new Map(map.edges.map(edge => [edge.id, edge]));
const svg = (tag, attrs, parent) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  parent?.append(el);
  return el;
};
const pointList = points => points.map(point => point.join(',')).join(' ');
const shapeOf = node => node.shape ?? 'box';
const plan = (node, z = 0) => [
  project(node.x, node.y, z),
  project(node.x + node.w, node.y, z),
  project(node.x + node.w, node.y + node.d, z),
  project(node.x, node.y + node.d, z),
];
const polygon = (parent, points, className) =>
  svg('polygon', { points: pointList(points), class: className }, parent);
const segment = (parent, [x1, y1], [x2, y2]) =>
  svg('line', { x1, y1, x2, y2, class: 'cut' }, parent);

const layers = {
  grid: $('#grid'), ground: $('#ground'), edges: $('#edges'),
  nodes: $('#nodes'), labels: $('#labels'),
};
const cameraEl = $('#camera');
const stage = $('#map');
const traceButton = $('#trace');
const frame = bounds([...map.zones, ...map.nodes]);
const camera = { x: 0, y: 0, k: 1 };
const ZONE_LIFT = .35;
let flowStep = -1;
let selectedId = null;
let moved = false;
let flight = 0;

const themeSelect = $('#theme');
const applyTheme = value => {
  document.documentElement.dataset.theme = themeSelect.value = value;
  localStorage.setItem('system-map-theme', value);
};
// A reader's saved choice wins; failing that, the theme the map asked for.
const savedTheme = localStorage.getItem('system-map-theme');
applyTheme(THEMES.includes(savedTheme) ? savedTheme : map.theme ?? THEMES[0]);
themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

function prism(parent, node, bottom = 0, top = node.h) {
  const low = plan(node, bottom);
  const high = plan(node, top);
  polygon(parent, [low[1], low[2], high[2], high[1]], 'face-right');
  polygon(parent, [low[2], low[3], high[3], high[2]], 'face-left');
  polygon(parent, high, 'face-top');
}

function cylinder(parent, node, bottom = 0, top = node.h) {
  const [x, lowY] = project(node.x + node.w / 2, node.y + node.d / 2, bottom);
  const [, topY] = project(node.x + node.w / 2, node.y + node.d / 2, top);
  const [rx, ry] = disc(node.w, node.d);
  svg('path', {
    d: `M${x - rx},${lowY}V${topY}A${rx},${ry} 0 0 0 ${x + rx},${topY}V${lowY}A${rx},${ry} 0 0 1 ${x - rx},${lowY}`,
    class: 'body',
  }, parent);
  svg('ellipse', { cx: x, cy: topY, rx, ry, class: 'cap' }, parent);
}

const countOf = node => node.count ?? 4;

// One volume cut across its long axis, each cut running the full length of the
// top face and down the near face: a queue, a bus, a topic, or a stack.
function stack(parent, node) {
  const alongX = node.w >= node.d;
  prism(parent, node);
  for (let i = 1; i < countOf(node); i++) {
    const t = i / countOf(node);
    const [near, far] = alongX
      ? [[node.x + node.w * t, node.y + node.d], [node.x + node.w * t, node.y]]
      : [[node.x + node.w, node.y + node.d * t], [node.x, node.y + node.d * t]];
    segment(parent, project(...far, node.h), project(...near, node.h));
    segment(parent, project(...near, node.h), project(...near));
  }
}

// A row of identical units filling the footprint: replicas, a pool, a bank, or
// any fixed set. The same row of cylinders reads as a sharded store.
const row = draw => (parent, node) => {
  const pitch = node.w / countOf(node);
  for (let i = 0; i < countOf(node); i++) {
    draw(parent, { ...node, x: node.x + i * pitch, w: pitch * .74 });
  }
};

// A broad plate with a rim, so it reads as a surface rather than a squat box.
function slab(parent, node) {
  const lip = Math.min(node.w, node.d) * .12;
  prism(parent, node);
  polygon(parent, plan({
    ...node, x: node.x + lip, y: node.y + lip, w: node.w - lip * 2, d: node.d - lip * 2,
  }, node.h), 'slab-lip');
}

// Head and shoulders, proportioned from the node height rather than its
// footprint, and closed along a projected base arc so the bust reads as a
// solid standing on the floor instead of a flat sticker.
function user(parent, node) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.d / 2;
  const [x, groundY] = project(cx, cy);
  const [, topY] = project(cx, cy, node.h);
  const span = groundY - topY;
  const head = span * .21;
  const half = span * .42;
  const shoulderY = topY + span * .46;
  const ease = (groundY - shoulderY) * .45;

  svg('path', {
    d: `M${x - half},${groundY}
        C${x - half},${shoulderY + ease} ${x - head * 1.2},${shoulderY} ${x},${shoulderY}
        C${x + head * 1.2},${shoulderY} ${x + half},${shoulderY + ease} ${x + half},${groundY}
        A${half},${half / 2} 0 0 1 ${x - half},${groundY}Z`,
    class: 'user-body',
  }, parent);
  svg('circle', { cx: x, cy: topY + head, r: head, class: 'user-head' }, parent);
}

const SHAPES = {
  box: prism, slab, cylinder, stack, user, repeat: row(prism), shards: row(cylinder),
};
const drawShape = (parent, node) => SHAPES[shapeOf(node)](parent, node);

function draw() {
  for (const { points: [from, to], opacity } of gridLines([...map.zones, ...map.nodes])) {
    svg('line', {
      x1: from[0], y1: from[1], x2: to[0], y2: to[1], class: 'grid-line', opacity,
    }, layers.grid);
  }

  for (const zone of map.zones) {
    const group = svg('g', { class: 'zone' }, layers.ground);
    const low = plan(zone, -ZONE_LIFT);
    const high = plan(zone);
    polygon(group, [low[1], low[2], high[2], high[1]], 'zone-right');
    polygon(group, [low[2], low[3], high[3], high[2]], 'zone-left');
    polygon(group, high, 'zone-top');
    // Lies on the floor along the boundary edge, but in the annotation layer
    // so a building standing on the edge never overdraws it.
    const label = svg('text', {
      y: -9, class: 'zone-name', transform: floorText(zone.x + .4, zone.y),
    }, layers.labels);
    label.textContent = zone.label;
  }

  for (const edge of map.edges) {
    const group = svg('g', { class: `edge ${edge.kind}`, 'data-edge': edge.id }, layers.edges);
    const points = route(byId.get(edge.from), byId.get(edge.to));
    svg('path', { d: `M${points.map(point => point.join(',')).join(' L')}` }, group);
    svg('title', {}, group).textContent = edge.label;
  }

  const nodes = [...map.nodes].sort((a, b) => a.x + a.y - b.x - b.y);
  for (const node of nodes) {
    const shape = shapeOf(node);
    const group = svg('g', {
      class: 'node', 'data-node': node.id, 'data-shape': shape,
      role: 'button', tabindex: '0', 'aria-label': node.name,
    }, layers.nodes);
    drawShape(group, node);
    const [x, y] = project(node.x + node.w / 2, node.y + node.d / 2, node.h);
    const [, groundY] = project(node.x + node.w / 2, node.y + node.d / 2);
    // A bust has no top face to letter, so its code sits below the base.
    const code = svg('text', { x, y: shape === 'user' ? groundY + 26 : y + 3, class: 'node-code' }, group);
    code.textContent = node.code;
    // Nameplates live in their own layer so a hovered one is never overdrawn.
    const label = svg('g', {
      class: 'node-label', 'data-label': node.id, 'data-x': x, 'data-y': y,
      transform: `translate(${x} ${y})`,
    }, layers.labels);
    const name = svg('text', { x: 0, y: -15, class: 'node-name' }, label);
    name.textContent = node.name;
    const box = name.getBBox();
    const plate = svg('rect', {
      x: box.x - 5, y: box.y - 2,
      width: box.width + 10, height: box.height + 4,
      class: 'node-plate',
    });
    label.prepend(plate);
    group.addEventListener('pointerenter', () => label.classList.add('is-hover'));
    group.addEventListener('pointerleave', () => label.classList.remove('is-hover'));
  }
}

function buildIndex() {
  for (const zone of map.zones) {
    const group = document.createElement('section');
    group.className = 'index-group';
    const label = document.createElement('p');
    label.textContent = zone.label;
    group.append(label);
    for (const node of map.nodes.filter(item => item.zone === zone.id)) {
      const button = document.createElement('button');
      button.className = 'node-link';
      button.dataset.node = node.id;
      const code = document.createElement('span');
      const name = document.createElement('span');
      code.textContent = node.code;
      name.textContent = node.name;
      button.append(code, name);
      group.append(button);
    }
    $('#index').append(group);
  }
}

function showDetail(node) {
  const detail = $('#detail');
  detail.replaceChildren();
  const code = document.createElement('p');
  code.className = 'code';
  code.textContent = `${node.code} / ${shapeOf(node).toUpperCase()}`;
  const title = document.createElement('h2');
  title.textContent = node.name;
  const summary = document.createElement('p');
  summary.textContent = node.summary;
  const filesTitle = document.createElement('h3');
  filesTitle.textContent = 'START READING';
  const files = document.createElement('ul');
  for (const path of node.files) {
    const item = document.createElement('li');
    item.textContent = path;
    files.append(item);
  }
  detail.append(code, title, summary, filesTitle, files);
}

const showLabels = ids => document.querySelectorAll('[data-label]')
  .forEach(el => el.classList.toggle('is-active', ids.includes(el.dataset.label)));

function clearSelection() {
  flowStep = -1;
  selectedId = null;
  traceButton.textContent = 'Trace flow';
  $('#flow-note').textContent = '';
  document.querySelectorAll('.is-active, .is-muted, .is-flow').forEach(el =>
    el.classList.remove('is-active', 'is-muted', 'is-flow'));
  showDetail(map.nodes[0]);
  flyTo(wholeMap());
}

function select(id) {
  if (selectedId === id && flowStep < 0) {
    clearSelection();
    return;
  }
  flowStep = -1;
  selectedId = id;
  traceButton.textContent = 'Trace flow';
  $('#flow-note').textContent = '';
  document.querySelectorAll('.is-flow').forEach(el => el.classList.remove('is-flow'));
  const related = new Set(map.edges.filter(edge => edge.from === id || edge.to === id).map(edge => edge.id));
  document.querySelectorAll('[data-node]').forEach(el => {
    el.classList.toggle('is-active', el.dataset.node === id);
    el.classList.toggle('is-muted', el.closest('svg') && el.dataset.node !== id);
  });
  document.querySelectorAll('[data-edge]').forEach(el => {
    el.classList.toggle('is-active', flowStep < 0 && related.has(el.dataset.edge));
    el.classList.toggle('is-muted', flowStep < 0 && !related.has(el.dataset.edge));
  });
  showLabels([id]);
  showDetail(byId.get(id));
}

function applyCamera() {
  cameraEl.setAttribute('transform', `translate(${camera.x} ${camera.y}) scale(${camera.k})`);
  document.querySelectorAll('.node-label').forEach(label => {
    label.setAttribute('transform', `translate(${label.dataset.x} ${label.dataset.y}) scale(${1 / camera.k})`);
  });
}

const wholeMap = () =>
  fitCamera(frame, stage.clientWidth, stage.clientHeight, stage.clientWidth < 500 ? 18 : 36);

// Framing the two ends of one step is what makes a traced flow readable: the
// camera closes in on the pair, so the step is read at drawing scale.
const around = nodes =>
  fitCamera(bounds(nodes), stage.clientWidth, stage.clientHeight, stage.clientWidth < 500 ? 60 : 120, 1.5);

function stopFlying() {
  cancelAnimationFrame(flight);
  flight = 0;
}

function flyTo(target) {
  stopFlying();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    Object.assign(camera, target);
    applyCamera();
    return;
  }
  const from = { ...camera };
  const started = performance.now();
  const step = now => {
    const t = Math.min(1, (now - started) / 460);
    const eased = 1 - (1 - t) ** 3;
    for (const key of ['x', 'y', 'k']) camera[key] = from[key] + (target[key] - from[key]) * eased;
    applyCamera();
    flight = t < 1 ? requestAnimationFrame(step) : 0;
  };
  flight = requestAnimationFrame(step);
}

function fit() {
  stopFlying();
  Object.assign(camera, wholeMap());
  applyCamera();
}

function zoomAt(x, y, nextScale) {
  const scale = Math.max(.35, Math.min(3, nextScale));
  const ratio = scale / camera.k;
  camera.x = x - (x - camera.x) * ratio;
  camera.y = y - (y - camera.y) * ratio;
  camera.k = scale;
  applyCamera();
}

function trace() {
  if (!map.flow?.length) return;
  if (flowStep === map.flow.length - 1) {
    clearSelection();
    return;
  }
  selectedId = null;
  flowStep += 1;
  const [id, note] = map.flow[flowStep];
  const edge = edgeById.get(id);
  document.querySelectorAll('[data-edge]').forEach(el => {
    el.classList.toggle('is-active', el.dataset.edge === id);
    el.classList.toggle('is-muted', el.dataset.edge !== id);
    el.classList.toggle('is-flow', el.dataset.edge === id);
  });
  document.querySelectorAll('#nodes [data-node]').forEach(el => {
    el.classList.toggle('is-active', [edge.from, edge.to].includes(el.dataset.node));
    el.classList.toggle('is-muted', ![edge.from, edge.to].includes(el.dataset.node));
  });
  document.querySelectorAll('.node-link').forEach(el => el.classList.remove('is-active'));
  showLabels([edge.from, edge.to]);
  flyTo(around([byId.get(edge.from), byId.get(edge.to)]));
  traceButton.textContent = `Trace ${flowStep + 1}/${map.flow.length}`;
  $('#flow-note').textContent = note;
  showDetail(byId.get(edge.to));
}

$('#title').textContent = document.title = `system map / ${map.title}`;
$('#subtitle').textContent = `${map.subtitle} · ${map.nodes.length} components · ${map.edges.length} relationships`;
traceButton.hidden = !map.flow?.length;
await document.fonts.ready;
draw();
buildIndex();
showDetail(map.nodes[0]);
new ResizeObserver(fit).observe(stage);

$('#fit').addEventListener('click', fit);
traceButton.addEventListener('click', trace);
document.addEventListener('click', event => {
  const target = event.target.closest('.node-link');
  if (target && !moved) select(target.dataset.node);
});
// A hand on the camera always wins over an animated one.
stage.addEventListener('wheel', event => {
  event.preventDefault();
  stopFlying();
  const rect = stage.getBoundingClientRect();
  zoomAt(event.clientX - rect.left, event.clientY - rect.top, camera.k * Math.exp(-event.deltaY * .001));
}, { passive: false });

const pointers = new Map();
let gesture = null;
let pressedNode = null;
let dragOrigin = null;
const localPoint = event => {
  const rect = stage.getBoundingClientRect();
  return [event.clientX - rect.left, event.clientY - rect.top];
};
const midpoint = ([a, b], [c, d]) => [(a + c) / 2, (b + d) / 2];
const distance = ([a, b], [c, d]) => Math.hypot(a - c, b - d);

stage.addEventListener('pointerdown', event => {
  stopFlying();
  const point = localPoint(event);
  pressedNode = pointers.size ? null : event.target.closest('[data-node]')?.dataset.node ?? null;
  stage.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, point);
  moved = false;
  dragOrigin = pointers.size === 1 ? point : null;
  gesture = { points: [...pointers.values()] };
});

stage.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, localPoint(event));
  const points = [...pointers.values()];
  if (points.length === 1 && gesture?.points.length === 1) {
    camera.x += points[0][0] - gesture.points[0][0];
    camera.y += points[0][1] - gesture.points[0][1];
    moved ||= distance(points[0], dragOrigin ?? points[0]) > 3;
    gesture.points = points;
    applyCamera();
  } else if (points.length === 2) {
    const previous = gesture?.points.length === 2 ? gesture.points : points;
    const before = midpoint(...previous);
    const after = midpoint(...points);
    camera.x += after[0] - before[0];
    camera.y += after[1] - before[1];
    zoomAt(after[0], after[1], camera.k * distance(...points) / Math.max(1, distance(...previous)));
    moved = true;
    gesture = { points };
  }
});

function endPointer(event) {
  const released = event.type === 'pointerup' && pointers.size === 1 && !moved;
  const tapped = released ? pressedNode : null;
  const emptyTap = released && !pressedNode;
  pointers.delete(event.pointerId);
  dragOrigin = pointers.size === 1 ? [...pointers.values()][0] : null;
  gesture = pointers.size ? { points: [...pointers.values()] } : null;
  if (!pointers.size) {
    pressedNode = null;
    requestAnimationFrame(() => { moved = false; });
  }
  if (tapped) select(tapped);
  else if (emptyTap) clearSelection();
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);

stage.addEventListener('keydown', event => {
  const node = event.target.closest?.('[data-node]');
  if (node && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    select(node.dataset.node);
  } else if (event.key === 'Escape') {
    clearSelection();
  } else if (event.key === 'ArrowRight') trace();
});
