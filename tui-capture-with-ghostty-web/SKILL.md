---
name: tui-capture-with-ghostty-web
description: Use when capturing reviewable PNG and plain-text artifacts from a TUI controlled through the isolated tmux puppeteering skill, especially for terminal UI visual QA, component inventories, documentation captures, and screenshot regression evidence.
---

<required>
*CRITICAL* Add the following steps to your task list:
1. Read and follow `{{skills_dir}}/tui-puppeteering-with-tmux/SKILL.md` before any TUI interaction.
2. Write a short capture plan naming the session, fixed columns and rows, target state, assertion, keystrokes, artifact directory, and cleanup owner.
3. Use only the bundled `tui-*` scripts for tmux interaction. Never call `tmux` directly.
4. Reach the target state with `tui-send`, then prove it with `tui-assert` before capturing.
5. Run `scripts/capture-session` to save `screen.txt`, `screen.ansi`, `screen.png`, and `metadata.json` together.
6. Inspect the PNG visually and compare it with `screen.txt`; correct clipped, shifted, stale, or incorrect captures.
7. Stop every session you created with `tui-stop`. Never stop sessions you did not create.
</required>

## Boundary

tmux owns all terminal state and keyboard input. Ghostty Web only renders the ANSI screen from `tui-capture -e`. It sends no input, owns no PTY, and does not match a native Ghostty window pixel for pixel.

The renderer pins `coder/ghostty-web` 0.4.0 and Playwright Core 1.60.0, drives an installed Chrome or Chromium headlessly, and uses a fixed Nori dark palette at device scale factor 1.

- On first use, the renderer installs its pinned Bun dependencies from `bun.lock`.
- If Chrome is outside the script's known macOS and Linux locations, set `GHOSTTY_WEB_CHROME`.
- `capture-session` looks for a sibling `tui-puppeteering-with-tmux`. If that skill lives elsewhere, set `TUI_PUPPETEERING_DIR`.

## Capture workflow

Start one isolated session. `tui-start` opens at 120×40. If you pass another grid, the capture wrapper resizes the session:

```bash
TUI={{skills_dir}}/tui-puppeteering-with-tmux
$TUI/tui-start capture-example 'env -u NO_COLOR COLORTERM=truecolor your-command'
```

Send one action at a time. Assert the result of each:

```bash
$TUI/tui-send capture-example /
$TUI/tui-send capture-example query
$TUI/tui-assert capture-example 'Search'
```

Capture all artifacts in one operation:

```bash
{{skills_dir}}/tui-capture-with-ghostty-web/scripts/capture-session \
  capture-example /absolute/path/to/artifacts \
  --cols 120 --rows 40 --expect 'Search' --require-color
```

Pass an artifact directory that is absent or empty. The wrapper writes the four files only after every assertion and quality gate passes. A failed capture leaves no files.

The wrapper writes:

- `screen.txt`: searchable and diffable visible terminal text.
- `screen.ansi`: the tmux display rows plus ANSI styles used as render input.
- `screen.png`: the Ghostty Web reference rendering.
- `metadata.json`: grid, pixel dimensions, file size, renderer version, and SHA-256.

To re-render an existing ANSI file, run `scripts/render-ansi.ts` directly:

```bash
bun {{skills_dir}}/tui-capture-with-ghostty-web/scripts/render-ansi.ts \
  --input /absolute/path/screen.ansi \
  --output /absolute/path/screen.png \
  --cols 120 --rows 40
```

## Quality gate

Reject and recapture when any of these are true:

- the asserted feature is absent from either artifact;
- a color-required capture contains no foreground/background ANSI color SGR;
- rows begin at changing columns (LF replay was not normalized to terminal rows);
- text is clipped because the render grid differs from the tmux grid;
- the PNG shows a transition, loading state, or stale selection;
- `screen.txt` contains secrets, credentials, or unrelated private content;
- the image is technically valid but does not clearly demonstrate the named feature.

For an inventory of several captures, give each worker its own session and artifact directory. Hand each worker the template in `references/capture-brief.md`. Review every returned PNG and text file before you accept it.

## Maintenance

If you change the harness, theme, dependency pins, geometry, bootstrap, or CLI contract, run the renderer tests:

```bash
cd {{skills_dir}}/tui-capture-with-ghostty-web && bun test
```

Keep both renderer dependencies pinned. If you update either, REQUIRE my approval and regenerate the baseline artifacts. An update changes the visual reference.
