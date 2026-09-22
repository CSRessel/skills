/* Renders every diagram in /diagrams.json. All local, no external calls.
   Minimal chrome, hand-drawn mermaid, paper/carbon toggle. */

const DEFAULT_LEGEND = [
  { symbol: '⬚', text: 'dashed box = folder / module' },
  { symbol: '→', text: 'solid arrow = main data flow' },
  { symbol: '⇢', text: 'dotted arrow = external service call' }
];

// Diagram ink, mapped to the shared repo palette (see THEME.md). Both variants
// use mermaid's "base" theme with a full variable set, so a diagram is drawn in
// charcoal under paper and in green under carbon. The built-in "default" and
// "dark" themes are deliberately not used: they impose their own hues.
const PAPER_VARS = {
  background: '#e7e0d0', mainBkg: '#f4efe3',
  primaryColor: '#f4efe3', primaryTextColor: '#1f1c18', primaryBorderColor: '#6d6a64',
  secondaryColor: '#e7e0d0', secondaryTextColor: '#1f1c18', secondaryBorderColor: '#b7ad99',
  tertiaryColor: '#d9d1bf', tertiaryTextColor: '#1f1c18', tertiaryBorderColor: '#b7ad99',
  nodeBorder: '#6d6a64', lineColor: '#6b6660', textColor: '#1f1c18', titleColor: '#1f1c18',
  edgeLabelBackground: '#e7e0d0', clusterBkg: '#e7e0d0', clusterBorder: '#8b8371',
  actorBkg: '#f4efe3', actorBorder: '#6d6a64', actorTextColor: '#1f1c18', actorLineColor: '#b7ad99',
  signalColor: '#1f1c18', signalTextColor: '#1f1c18',
  labelBoxBkgColor: '#d9d1bf', labelBoxBorderColor: '#8b8371', labelTextColor: '#1f1c18',
  loopTextColor: '#5a564f', activationBkgColor: '#d9d1bf', activationBorderColor: '#6d6a64',
  sequenceNumberColor: '#f4efe3',
  noteBkgColor: '#d9d1bf', noteBorderColor: '#8b8371', noteTextColor: '#1f1c18'
};
const CARBON_VARS = {
  background: '#1c1c1c', mainBkg: '#1c1c1c',
  primaryColor: '#1c1c1c', primaryTextColor: '#dde1e6', primaryBorderColor: '#3f9e59',
  secondaryColor: '#262626', secondaryTextColor: '#dde1e6', secondaryBorderColor: '#393939',
  tertiaryColor: '#262626', tertiaryTextColor: '#dde1e6', tertiaryBorderColor: '#393939',
  nodeBorder: '#3f9e59', lineColor: '#42be65', textColor: '#dde1e6', titleColor: '#f2f4f8',
  edgeLabelBackground: '#1c1c1c', clusterBkg: '#161616', clusterBorder: '#393939',
  actorBkg: '#1c1c1c', actorBorder: '#3f9e59', actorTextColor: '#dde1e6', actorLineColor: '#393939',
  signalColor: '#42be65', signalTextColor: '#dde1e6',
  labelBoxBkgColor: '#262626', labelBoxBorderColor: '#3f9e59', labelTextColor: '#dde1e6',
  loopTextColor: '#8a8f98', activationBkgColor: '#262626', activationBorderColor: '#3f9e59',
  sequenceNumberColor: '#0e0e0e',
  noteBkgColor: '#262626', noteBorderColor: '#3f9e59', noteTextColor: '#dde1e6'
};

const main = document.querySelector('#main');
const cache = new Map();      // file -> source text
let files = [];               // ordered file list
let theme = 'paper';
let zoom = 1;
let seq = 0;

function initMermaid() {
  const dark = theme === 'carbon';
  mermaid.initialize({
    startOnLoad: false, securityLevel: 'strict',
    theme: 'base',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    themeVariables: { fontSize: '14px', darkMode: dark, ...(dark ? CARBON_VARS : PAPER_VARS) },
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
  document.querySelector('#theme').textContent = theme === 'paper' ? 'Carbon' : 'Paper';
}

document.querySelector('#plus').onclick = () => { zoom = Math.min(4, zoom * 1.25); applyZoom(); };
document.querySelector('#minus').onclick = () => { zoom = Math.max(0.25, zoom / 1.25); applyZoom(); };
document.querySelector('#fit').onclick = () => { zoom = 1; applyZoom(); };
document.querySelector('#theme').onclick = () => { setTheme(theme === 'paper' ? 'carbon' : 'paper'); void renderAll(); };

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

// ?theme=carbon (or the older ?theme=dark) opens straight into the dark variant.
const wanted = new URLSearchParams(location.search).get('theme');
setTheme(wanted === 'carbon' || wanted === 'dark' ? 'carbon' : 'paper');
boot();
