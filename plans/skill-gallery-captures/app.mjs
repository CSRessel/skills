import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.2.6/+esm";
import { marked } from "https://cdn.jsdelivr.net/npm/marked@15.0.12/+esm";
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.12.0/dist/mermaid.esm.min.mjs";

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

    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: dark ? "dark" : "default",
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
