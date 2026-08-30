import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "..", "scripts", "render-ansi.ts");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

async function run(args: string[]) {
  const process = Bun.spawn(["bun", script, ...args], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    process.exited,
    new Response(process.stderr).text(),
    new Response(process.stdout).text(),
  ]);
  return { exitCode, stderr, stdout };
}

describe("render-ansi", () => {
  test("renders ANSI input to a deterministic PNG grid", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ghostty-web-render-"));
    temporaryDirectories.push(directory);
    const input = join(import.meta.dir, "fixtures", "screen.ansi");
    const output = join(directory, "screen.png");

    const result = await run([
      "--input",
      input,
      "--output",
      output,
      "--cols",
      "32",
      "--rows",
      "6",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const metadata = JSON.parse(result.stdout);
    expect(metadata).toMatchObject({ cols: 32, rows: 6, renderer: "ghostty-web@0.4.0" });
    expect(metadata.pixelWidth).toBeGreaterThan(0);
    expect(metadata.pixelHeight).toBeGreaterThan(0);
    expect((await stat(output)).size).toBeGreaterThan(100);
    expect((await readFile(output)).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }, 20_000);

  test("rejects invalid grid dimensions", async () => {
    const result = await run([
      "--input",
      join(import.meta.dir, "fixtures", "screen.ansi"),
      "--output",
      join(tmpdir(), "should-not-render.png"),
      "--cols",
      "0",
      "--rows",
      "6",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--cols must be a positive integer");
  });
});
