#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { access, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

type Options = {
  cols: number;
  fontFamily: string;
  fontSize: number;
  input: string;
  output: string;
  rows: number;
};

const skillDirectory = resolve(import.meta.dir, "..");
const ghosttyDirectory = join(skillDirectory, "node_modules", "ghostty-web");
const ghosttyDistDirectory = join(ghosttyDirectory, "dist");
const browserHelperName = "__vite-browser-external-2447137e.js";

const theme = {
  background: "#161616",
  foreground: "#dde1e6",
  cursor: "#f2f4f8",
  cursorAccent: "#161616",
  selectionBackground: "#393939",
  selectionForeground: "#f2f4f8",
  black: "#161616",
  red: "#fa4d56",
  green: "#42be65",
  yellow: "#f2cc60",
  blue: "#78a9ff",
  magenta: "#be95ff",
  cyan: "#33b1ff",
  white: "#dde1e6",
  brightBlack: "#8a8f98",
  brightRed: "#ff8389",
  brightGreen: "#6fdc8c",
  brightYellow: "#fddc69",
  brightBlue: "#a6c8ff",
  brightMagenta: "#d4bbff",
  brightCyan: "#82cfff",
  brightWhite: "#f2f4f8",
};

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

async function ensureRendererDependencies(): Promise<void> {
  try {
    await Promise.all([
      access(join(ghosttyDirectory, "package.json")),
      access(join(skillDirectory, "node_modules", "playwright-core", "package.json")),
    ]);
    return;
  } catch {
    // Registry packages intentionally omit node_modules; install the locked set on first use.
  }

  const installation = Bun.spawnSync({
    cmd: [process.execPath, "install", "--frozen-lockfile", "--silent"],
    cwd: skillDirectory,
    stderr: "pipe",
    stdout: "ignore",
  });
  if (!installation.success) {
    const detail = installation.stderr.toString().trim();
    fail(`failed to install pinned renderer dependencies${detail ? `: ${detail}` : ""}`);
  }
}

function positiveInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`${flag} must be a positive integer`);
  }
  return parsed;
}

function positiveNumber(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`${flag} must be a positive number`);
  }
  return parsed;
}

function parseArguments(args: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      fail(`invalid argument sequence near ${flag ?? "end of input"}`);
    }
    values.set(flag, value);
  }

  const input = values.get("--input");
  const output = values.get("--output");
  if (!input) fail("--input is required");
  if (!output) fail("--output is required");

  return {
    cols: positiveInteger(values.get("--cols") ?? "120", "--cols"),
    fontFamily: values.get("--font-family") ?? "Menlo, monospace",
    fontSize: positiveNumber(values.get("--font-size") ?? "14", "--font-size"),
    input: resolve(input),
    output: resolve(output),
    rows: positiveInteger(values.get("--rows") ?? "40", "--rows"),
  };
}

function chromeExecutable(): string {
  const candidates = [
    process.env.GHOSTTY_WEB_CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (Bun.file(candidate).size > 0) return candidate;
  }
  fail("Chrome/Chromium not found; set GHOSTTY_WEB_CHROME to its executable");
}

const harness = `<!doctype html>
<html><head><meta charset="utf-8"><style>
* { animation: none !important; box-sizing: border-box; transition: none !important; }
html, body { margin: 0; padding: 0; background: ${theme.background}; overflow: hidden; }
#terminal { display: inline-block; line-height: 1; }
canvas { display: block; }
</style></head><body data-ready="false"><div id="terminal"></div>
<script type="module">
import { init, Terminal } from "/assets/ghostty-web.js";
const config = await fetch("/config.json").then((response) => response.json());
const ansi = await fetch("/screen.ansi").then((response) => response.text());
await init();
const terminal = new Terminal({
  cols: config.cols,
  rows: config.rows,
  // tmux capture-pane emits LF-delimited display rows, not a PTY byte stream.
  // Reset the column on LF so every captured row replays at column zero.
  convertEol: true,
  cursorBlink: false,
  disableStdin: true,
  fontFamily: config.fontFamily,
  fontSize: config.fontSize,
  scrollback: 0,
  theme: config.theme,
});
terminal.open(document.getElementById("terminal"));
terminal.resize(config.cols, config.rows);
await new Promise((resolve) => terminal.write(ansi, resolve));
await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
document.body.dataset.ready = "true";
</script></body></html>`;

async function main(): Promise<void> {
  const options = parseArguments(Bun.argv.slice(2));
  await ensureRendererDependencies();
  const { chromium } = await import("playwright-core");
  await access(options.input);
  await mkdir(dirname(options.output), { recursive: true });
  const ansi = await readFile(options.input);
  const assets = new Map<string, { body: BlobPart; type: string }>([
    ["/", { body: harness, type: "text/html; charset=utf-8" }],
    [
      "/assets/ghostty-web.js",
      { body: await readFile(join(ghosttyDistDirectory, "ghostty-web.js")), type: "text/javascript" },
    ],
    [
      `/assets/${browserHelperName}`,
      { body: await readFile(join(ghosttyDistDirectory, browserHelperName)), type: "text/javascript" },
    ],
    [
      "/ghostty-vt.wasm",
      { body: await readFile(join(ghosttyDistDirectory, "ghostty-vt.wasm")), type: "application/wasm" },
    ],
    ["/screen.ansi", { body: ansi, type: "application/octet-stream" }],
    [
      "/config.json",
      {
        body: JSON.stringify({
          cols: options.cols,
          fontFamily: options.fontFamily,
          fontSize: options.fontSize,
          rows: options.rows,
          theme,
        }),
        type: "application/json",
      },
    ],
  ]);

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const asset = assets.get(new URL(request.url).pathname);
      return asset ? new Response(asset.body, { headers: { "content-type": asset.type } }) : new Response("Not found", { status: 404 });
    },
  });

  const browser = await chromium.launch({
    executablePath: chromeExecutable(),
    headless: true,
  });

  try {
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      viewport: { width: 1920, height: 1200 },
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.port}/`, { waitUntil: "load" });
    await page.locator('body[data-ready="true"]').waitFor({ timeout: 10_000 });
    const terminal = page.locator("#terminal");
    await terminal.screenshot({ animations: "disabled", path: options.output, type: "png" });
    await context.close();
  } finally {
    await browser.close();
    server.stop(true);
  }

  const png = await readFile(options.output);
  const file = await stat(options.output);
  if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("renderer output is not a PNG");
  }
  const metadata = {
    cols: options.cols,
    rows: options.rows,
    pixelWidth: png.readUInt32BE(16),
    pixelHeight: png.readUInt32BE(20),
    pngSizeBytes: file.size,
    renderer: "ghostty-web@0.4.0",
    sha256: createHash("sha256").update(png).digest("hex"),
  };
  process.stdout.write(`${JSON.stringify(metadata)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
