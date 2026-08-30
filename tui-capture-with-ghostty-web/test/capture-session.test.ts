import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
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

async function fakeCodexHome(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "fake-codex-home-"));
  temporaryDirectories.push(root);
  const scripts = join(root, "skills", "tui-puppeteering-with-tmux");
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
  return root;
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
      env: { ...Bun.env, CODEX_HOME: codexHome, FAKE_CAPTURE_ANSI: ansi },
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
});
