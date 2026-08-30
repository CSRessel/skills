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
7. Stop every session created for the task with `tui-stop`. Do not stop user-owned or pre-existing sessions.
</required>

## Boundary

Treat tmux as the sole source of terminal state and keyboard input. Ghostty Web is only the pinned reference renderer for the ANSI screen returned by `tui-capture -e`. It does not launch a shell, send input, own a PTY, or claim pixel parity with a native Ghostty window.

This skill intentionally uses:

- `coder/ghostty-web` 0.4.0 for Ghostty's WASM VT parser and canvas renderer.
- Playwright Core 1.60.0 to drive an installed Chrome or Chromium in headless mode.
- A fixed Nori dark palette, device scale factor 1, and explicit terminal grid.

Set `GHOSTTY_WEB_CHROME` only when Chrome is installed outside the script's known macOS/Linux locations.

## Capture workflow

Start one isolated session. `tui-start` begins at its safe default 120×40; the
capture wrapper resizes through `tmux-isolated` when another grid is requested:

```bash
TUI={{skills_dir}}/tui-puppeteering-with-tmux
$TUI/tui-start capture-example 'env -u NO_COLOR COLORTERM=truecolor your-command'
```

Drive one semantic action at a time and assert the destination:

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

The wrapper writes:

- `screen.txt`: searchable and diffable visible terminal text.
- `screen.ansi`: the tmux display rows plus ANSI styles used as render input.
- `screen.png`: the Ghostty Web reference rendering.
- `metadata.json`: grid, pixel dimensions, file size, renderer version, and SHA-256.

Use `scripts/render-ansi.ts` directly only when re-rendering an existing ANSI artifact:

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

For inventories with several captures, give each worker a separate session and artifact directory. Provide the worker the template in `references/capture-brief.md`; review every returned PNG and text artifact before accepting it.

## Maintenance

Run the renderer tests after changing the harness, theme, dependency pins, geometry, or CLI contract:

```bash
cd {{skills_dir}}/tui-capture-with-ghostty-web && bun test
```

Keep Ghostty Web pinned. Updating either renderer dependency changes the visual reference and requires explicit approval plus regenerated baseline artifacts.
