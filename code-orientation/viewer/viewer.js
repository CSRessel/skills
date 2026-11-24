/* Renders every diagram in /diagrams.json. All local, no external calls.
   Minimal GitHub-style chrome, hand-drawn mermaid, light/dark toggle. */

const DEFAULT_LEGEND = [
  { symbol: '⬚', text: 'dashed box = folder / module' },
  { symbol: '→', text: 'solid arrow = main data flow' },
  { symbol: '⇢', text: 'dotted arrow = external service call' }
];

// Light: tuned "base" palette (GitHub light). Dark: mermaid's built-in "dark"
// theme, which handles cluster/actor colors correctly, plus a few overrides.
const LIGHT_VARS = {
  background: '#f6f8fa', primaryColor: '#ffffff', primaryTextColor: '#1f2328',
  primaryBorderColor: '#8c959f', lineColor: '#6e7781', secondaryColor: '#f6f8fa',
  tertiaryColor: '#ffffff', clusterBkg: '#ffffff', clusterBorder: '#d1d9e0',
  actorBkg: '#ffffff', actorBorder: '#8c959f', actorTextColor: '#1f2328',
  signalColor: '#57606a', signalTextColor: '#57606a', labelBoxBkgColor: '#ffffff',
  noteBkgColor: '#fff8c5', noteBorderColor: '#d4a72c', noteTextColor: '#1f2328'
};
const DARK_VARS = {
  background: '#151b23', clusterBkg: '#0d1117', clusterBorder: '#2a313c',
  mainBkg: '#1b2028', lineColor: '#8b949e', noteBkgColor: '#2d2a1a',
  noteBorderColor: '#9e8a3f', noteTextColor: '#e6edf3'
};

const main = document.querySelector('#main');
const cache = new Map();      // file -> source text
let files = [];               // ordered file list
let theme = 'light';
let zoom = 1;
let seq = 0;

function initMermaid() {
  const dark = theme === 'dark';
  mermaid.initialize({
    startOnLoad: false, securityLevel: 'strict',
    theme: dark ? 'dark' : 'base',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    themeVariables: { fontSize: '14px', ...(dark ? DARK_VARS : LIGHT_VARS) },
    flowchart: { htmlLabels: false, useMaxWidth: true, curve: 'basis', nodeSpacing: 36, rankSpacing: 54, padding: 10 },
    sequence: { useMaxWidth: true, boxMargin: 10, actorMargin: 46, mirrorActors: false }
  });
}

function applyZoom() {
  document.querySelector('#zoom').textContent = `${Math.round(zoom * 100)}%`;
  document.querySelectorAll('.diagram svg').forEach((svg) => {
    if (zoom === 1) { svg.style.maxWidth = '100%'; svg.style.width = ''; return; }
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const w = vb && vb.width ? vb.width : svg.getBoundingClientRect().width;
    svg.style.maxWidth = 'none';
    svg.style.width = `${w * zoom}px`;
  });
}

async function renderInto(host, file) {
  try {
    if (!cache.has(file)) {
      const res = await fetch('/' + String(file).replace(/^\//, ''));
      if (!res.ok) throw new Error(`load ${file}: HTTP ${res.status}`);
      cache.set(file, await res.text());
    }
    const { svg } = await mermaid.render(`co-${++seq}`, cache.get(file));
    host.innerHTML = svg;
  } catch (e) {
    host.innerHTML = '';
    const pre = document.createElement('div');
    pre.className = 'err';
    pre.textContent = `Could not render ${file}: ${e.message || e}`;
    host.appendChild(pre);
  }
}

async function renderAll() {
  initMermaid();
  const hosts = [...main.querySelectorAll('.diagram')];
  for (let i = 0; i < hosts.length; i++) await renderInto(hosts[i], files[i]);
  applyZoom();
}

function renderLegend(items) {
  const box = document.querySelector('#legend');
  const list = (Array.isArray(items) && items.length) ? items : DEFAULT_LEGEND;
  box.innerHTML = '';
  for (const it of list) {
    const span = document.createElement('span');
    const g = document.createElement('span');
    g.className = 'g';
    g.textContent = it.symbol || '';
    span.appendChild(g);
    span.appendChild(document.createTextNode(it.text || ''));
    box.appendChild(span);
  }
  box.hidden = false;
}

function setTheme(next) {
  theme = next;
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('#theme').textContent = theme === 'light' ? 'Dark' : 'Light';
}

document.querySelector('#plus').onclick = () => { zoom = Math.min(4, zoom * 1.25); applyZoom(); };
document.querySelector('#minus').onclick = () => { zoom = Math.max(0.25, zoom / 1.25); applyZoom(); };
document.querySelector('#fit').onclick = () => { zoom = 1; applyZoom(); };
document.querySelector('#theme').onclick = () => { setTheme(theme === 'light' ? 'dark' : 'light'); void renderAll(); };

async function boot() {
  let manifest;
  try {
    const res = await fetch('/diagrams.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    manifest = await res.json();
  } catch (e) {
    main.innerHTML = `<section><div class="err">Could not load diagrams.json: ${e.message || e}</div></section>`;
    return;
  }

  if (manifest.title) {
    document.querySelector('#title').textContent = manifest.title;
    document.title = `${manifest.title} · Code Orientation`;
  }
  document.querySelector('#subtitle').textContent = manifest.subtitle || '';
  renderLegend(manifest.legend);

  const diagrams = manifest.diagrams || [];
  files = diagrams.map((d) => d.file);
  main.innerHTML = '';
  diagrams.forEach((d, i) => {
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = `${i + 1}`;
    h2.append(n, document.createTextNode(d.title || d.file));
    section.appendChild(h2);
    if (d.note) {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent = d.note;
      section.appendChild(note);
    }
    const host = document.createElement('div');
    host.className = 'diagram';
    section.appendChild(host);
    main.appendChild(section);
  });

  await renderAll();
}

const wanted = new URLSearchParams(location.search).get('theme');
setTheme(wanted === 'dark' ? 'dark' : 'light');
boot();
