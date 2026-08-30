import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "..", "scripts", "capture-session");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

async function fakeTuiSkill(root: string): Promise<string> {
  const scripts = join(root, "tui-puppeteering-with-tmux");
  await mkdir(scripts, { recursive: true });
  const files = new Map([
    ["tmux-isolated", "#!/bin/sh\nexit 0\n"],
    ["tui-assert", "#!/bin/sh\nexit 0\n"],
    [
      "tui-capture",
      "#!/bin/sh\nif [ \"${2:-}\" = \"-e\" ]; then printf '%s' \"$FAKE_CAPTURE_ANSI\"; else printf '%s\\n' 'reference screen'; fi\n",
    ],
  ]);
  for (const [name, contents] of files) {
    const path = join(scripts, name);
    await writeFile(path, contents);
    await chmod(path, 0o755);
  }
  return scripts;
}

async function fakeCodexHome(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "fake-codex-home-"));
  temporaryDirectories.push(root);
  await fakeTuiSkill(join(root, "skills"));
  return root;
}

async function copyCaptureSkill(options: { dependencies: boolean }): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "capture-skill-install-"));
  temporaryDirectories.push(root);
  const source = join(import.meta.dir, "..");
  const destination = join(root, "tui-capture-with-ghostty-web");
  await mkdir(destination, { recursive: true });
  await Promise.all([
    cp(join(source, "scripts"), join(destination, "scripts"), { recursive: true }),
    cp(join(source, "package.json"), join(destination, "package.json")),
    cp(join(source, "bun.lock"), join(destination, "bun.lock")),
  ]);
  if (options.dependencies) {
    await symlink(join(source, "node_modules"), join(destination, "node_modules"), "dir");
  }
  return destination;
}

async function runCapture(ansi: string) {
  const codexHome = await fakeCodexHome();
  const output = await mkdtemp(join(tmpdir(), "capture-session-output-"));
  temporaryDirectories.push(output);
  const process = Bun.spawn(
    [
      script,
      "fake-session",
      output,
      "--cols",
      "32",
      "--rows",
      "6",
      "--require-color",
    ],
    {
      env: {
        ...Bun.env,
        CODEX_HOME: codexHome,
        FAKE_CAPTURE_ANSI: ansi,
        TUI_PUPPETEERING_DIR: join(codexHome, "skills", "tui-puppeteering-with-tmux"),
      },
      stderr: "pipe",
      stdout: "pipe",
    },
  );
  const [exitCode, stderr] = await Promise.all([
    process.exited,
    new Response(process.stderr).text(),
  ]);
  return { exitCode, output, stderr };
}

describe("capture-session --require-color", () => {
  test("accepts a captured screen containing ANSI color", async () => {
    const result = await runCapture("\u001b[31mred\u001b[0m");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect((await stat(join(result.output, "screen.png"))).size).toBeGreaterThan(100);
    expect((await stat(join(result.output, "metadata.json"))).size).toBeGreaterThan(20);
  }, 20_000);

  test("rejects a monochrome captured screen", async () => {
    const result = await runCapture("plain text");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("capture contains no ANSI foreground/background color SGR");
  });

  test("uses the sibling tmux skill outside a Codex installation", async () => {
    const installedSkill = await copyCaptureSkill({ dependencies: true });
    await fakeTuiSkill(join(installedSkill, ".."));
    const output = join(installedSkill, "capture");
    const process = Bun.spawn(
      [
        join(installedSkill, "scripts", "capture-session"),
        "fake-session",
        output,
        "--cols",
        "32",
        "--rows",
        "6",
        "--require-color",
      ],
      {
        env: {
          ...Bun.env,
          CODEX_HOME: join(installedSkill, "missing-codex-home"),
          FAKE_CAPTURE_ANSI: "\u001b[31mred\u001b[0m",
        },
        stderr: "pipe",
        stdout: "pipe",
      },
    );
    const [exitCode, stderr] = await Promise.all([
      process.exited,
      new Response(process.stderr).text(),
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect((await stat(join(output, "screen.png"))).size).toBeGreaterThan(100);
  }, 20_000);

  test("captures successfully on first use without preinstalled renderer dependencies", async () => {
    const installedSkill = await copyCaptureSkill({ dependencies: false });
    const codexHome = await fakeCodexHome();
    const output = join(installedSkill, "capture");
    const process = Bun.spawn(
      [
        join(installedSkill, "scripts", "capture-session"),
        "fake-session",
        output,
        "--cols",
        "32",
        "--rows",
        "6",
        "--require-color",
      ],
      {
        env: {
          ...Bun.env,
          CODEX_HOME: codexHome,
          FAKE_CAPTURE_ANSI: "\u001b[31mred\u001b[0m",
        },
        stderr: "pipe",
        stdout: "pipe",
      },
    );
    const [exitCode, stderr] = await Promise.all([
      process.exited,
      new Response(process.stderr).text(),
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect((await stat(join(output, "screen.png"))).size).toBeGreaterThan(100);
    expect((await stat(join(output, "metadata.json"))).size).toBeGreaterThan(20);
  }, 20_000);

  test("preserves an existing artifact set when a recapture fails", async () => {
    const codexHome = await fakeCodexHome();
    const output = await mkdtemp(join(tmpdir(), "capture-session-existing-"));
    temporaryDirectories.push(output);
    const artifacts = new Map([
      ["screen.txt", "old text"],
      ["screen.ansi", "old ansi"],
      ["screen.png", "old png"],
      ["metadata.json", "old metadata"],
    ]);
    await Promise.all(
      [...artifacts].map(([name, contents]) => writeFile(join(output, name), contents)),
    );

    const process = Bun.spawn(
      [script, "fake-session", output, "--cols", "32", "--rows", "6", "--require-color"],
      {
        env: {
          ...Bun.env,
          CODEX_HOME: codexHome,
          FAKE_CAPTURE_ANSI: "plain text",
          TUI_PUPPETEERING_DIR: join(codexHome, "skills", "tui-puppeteering-with-tmux"),
        },
        stderr: "pipe",
        stdout: "pipe",
      },
    );
    const exitCode = await process.exited;

    expect(exitCode).toBe(1);
    for (const [name, contents] of artifacts) {
      expect(await readFile(join(output, name), "utf8")).toBe(contents);
    }
  });
});
