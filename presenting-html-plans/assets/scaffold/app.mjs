import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.2.6/+esm";
import { marked } from "https://cdn.jsdelivr.net/npm/marked@15.0.12/+esm";
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.12.0/dist/mermaid.esm.min.mjs";

// Diagram ink, mapped to the shared repo palette (see THEME.md). Mermaid's
// "base" theme with a full variable set, so a diagram is drawn in charcoal
// under paper and in green under carbon. The built-in "default" and "dark"
// themes are deliberately not used: they impose their own hues.
const PAPER_VARS = {
  background: "#e7e0d0",
  mainBkg: "#f4efe3",
  primaryColor: "#f4efe3",
  primaryTextColor: "#1f1c18",
  primaryBorderColor: "#6d6a64",
  secondaryColor: "#e7e0d0",
  secondaryTextColor: "#1f1c18",
  secondaryBorderColor: "#b7ad99",
  tertiaryColor: "#d9d1bf",
  tertiaryTextColor: "#1f1c18",
  tertiaryBorderColor: "#b7ad99",
  nodeBorder: "#6d6a64",
  lineColor: "#6b6660",
  textColor: "#1f1c18",
  titleColor: "#1f1c18",
  edgeLabelBackground: "#e7e0d0",
  clusterBkg: "#e7e0d0",
  clusterBorder: "#8b8371",
  actorBkg: "#f4efe3",
  actorBorder: "#6d6a64",
  actorTextColor: "#1f1c18",
  actorLineColor: "#b7ad99",
  signalColor: "#1f1c18",
  signalTextColor: "#1f1c18",
  labelBoxBkgColor: "#d9d1bf",
  labelBoxBorderColor: "#8b8371",
  labelTextColor: "#1f1c18",
  loopTextColor: "#5a564f",
  activationBkgColor: "#d9d1bf",
  activationBorderColor: "#6d6a64",
  sequenceNumberColor: "#f4efe3",
  noteBkgColor: "#d9d1bf",
  noteBorderColor: "#8b8371",
  noteTextColor: "#1f1c18",
};
const CARBON_VARS = {
  background: "#1c1c1c",
  mainBkg: "#1c1c1c",
  primaryColor: "#1c1c1c",
  primaryTextColor: "#dde1e6",
  primaryBorderColor: "#3f9e59",
  secondaryColor: "#262626",
  secondaryTextColor: "#dde1e6",
  secondaryBorderColor: "#393939",
  tertiaryColor: "#262626",
  tertiaryTextColor: "#dde1e6",
  tertiaryBorderColor: "#393939",
  nodeBorder: "#3f9e59",
  lineColor: "#42be65",
  textColor: "#dde1e6",
  titleColor: "#f2f4f8",
  edgeLabelBackground: "#1c1c1c",
  clusterBkg: "#161616",
  clusterBorder: "#393939",
  actorBkg: "#1c1c1c",
  actorBorder: "#3f9e59",
  actorTextColor: "#dde1e6",
  actorLineColor: "#393939",
  signalColor: "#42be65",
  signalTextColor: "#dde1e6",
  labelBoxBkgColor: "#262626",
  labelBoxBorderColor: "#3f9e59",
  labelTextColor: "#dde1e6",
  loopTextColor: "#8a8f98",
  activationBkgColor: "#262626",
  activationBorderColor: "#3f9e59",
  sequenceNumberColor: "#0e0e0e",
  noteBkgColor: "#262626",
  noteBorderColor: "#3f9e59",
  noteTextColor: "#dde1e6",
};

// The page follows the OS setting unless ?theme=paper or ?theme=carbon pins it,
// which is what a capture or a shared link needs.
function resolveTheme() {
  const wanted = new URLSearchParams(window.location.search).get("theme");
  if (wanted === "paper" || wanted === "carbon") {
    document.documentElement.dataset.theme = wanted;
    return wanted;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "carbon"
    : "paper";
}

const theme = resolveTheme();

const plan = document.querySelector("#plan");
const toc = document.querySelector("#toc");
const title = document.querySelector("#document-title");
const sourcePath = document.querySelector("#source-path");
const requestedSource =
  new URLSearchParams(window.location.search).get("src") || "plan.mdx";
const source = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.mdx?$/.test(requestedSource)
  ? requestedSource
  : "plan.mdx";

sourcePath.textContent = source;
document.querySelector("#reload").addEventListener("click", () => {
  window.location.reload();
});
document.querySelector("#print").addEventListener("click", () => {
  window.print();
});

function slugify(value) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section"
  );
}

function buildToc() {
  const used = new Map();
  const headings = [...plan.querySelectorAll("h2, h3")];
  toc.replaceChildren(
    ...headings.map((heading) => {
      const base = slugify(heading.textContent);
      const count = used.get(base) || 0;
      used.set(base, count + 1);
      heading.id = count ? `${base}-${count + 1}` : base;

      const item = document.createElement("li");
      item.dataset.level = heading.tagName.slice(1);
      const link = document.createElement("a");
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      item.append(link);
      return item;
    }),
  );
}

async function loadPlan() {
  try {
    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load ${source}: ${response.status}`);
    }

    const markdown = await response.text();
    plan.innerHTML = DOMPurify.sanitize(marked.parse(markdown, { gfm: true }), {
      USE_PROFILES: { html: true },
    });

    const heading = plan.querySelector("h1");
    if (heading) {
      title.textContent = heading.textContent;
      document.title = `${heading.textContent} · Plan`;
    }

    for (const code of plan.querySelectorAll("pre > code.language-mermaid")) {
      const diagram = document.createElement("div");
      diagram.className = "mermaid";
      diagram.textContent = code.textContent;
      code.parentElement.replaceWith(diagram);
    }

    buildToc();

    const dark = theme === "carbon";
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: { darkMode: dark, ...(dark ? CARBON_VARS : PAPER_VARS) },
    });
    await mermaid.run({ nodes: plan.querySelectorAll(".mermaid") });
  } catch (error) {
    plan.innerHTML = "";
    const message = document.createElement("div");
    message.className = "error";
    message.textContent = error instanceof Error ? error.message : error;
    plan.append(message);
    console.error(error);
  }
}

loadPlan();
