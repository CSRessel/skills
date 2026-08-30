# Noridoc: TUI Capture with Ghostty Web

Path: @/tui-capture-with-ghostty-web

### Overview

- Produces reviewable text, ANSI, PNG, and metadata artifacts for a proven TUI state.
- Keeps terminal ownership and interaction in the companion [tmux puppeteering skill](../tui-puppeteering-with-tmux/SKILL.md); Ghostty Web is only the reference renderer for captured ANSI rows.

### How it fits into the larger codebase

- [SKILL.md](SKILL.md) defines the agent workflow: drive an isolated tmux session, assert the target state, capture the artifact set, inspect it, and clean up the owned session.
- [capture-session](scripts/capture-session) composes the `tui-*` commands supplied by the companion skill. It resolves an explicit `TUI_PUPPETEERING_DIR` first, then a sibling skill installation, and finally the Codex skill directory; it does not call tmux directly or create another PTY.
- [render-ansi.ts](scripts/render-ansi.ts) replays the captured ANSI screen through the pinned Ghostty Web parser and canvas renderer, using Playwright Core only to operate an installed headless Chrome or Chromium.
- [package.json](package.json) and [bun.lock](bun.lock) pin the renderer dependencies so an intentional dependency update marks a change to the visual reference. If those packages are absent on first use, the renderer installs the locked dependency set with Bun before rendering, including when it is invoked directly outside the capture wrapper.

### Core Implementation

- The capture wrapper resizes the isolated tmux window to the requested grid, optionally reasserts expected text, and writes plain-text and ANSI screen captures before rendering.
- The renderer serves a short-lived loopback harness, loads Ghostty Web's JavaScript and WASM assets, replays the ANSI rows with end-of-line normalization, and screenshots only the terminal canvas.
- The output metadata records grid and pixel dimensions, renderer version, PNG size, and SHA-256 so downstream review can identify the exact rendered artifact.
- The optional color guard rejects captures without foreground or background color SGR sequences before a PNG is produced.
- Capture output is transactional: all artifacts are built in a temporary sibling directory, and the completed directory is published only after capture, validation, rendering, and metadata generation succeed.

### Things to Know

- The fixed palette, terminal grid, device scale factor, disabled cursor blink, and disabled animations keep one capture environment stable; the skill does not claim native Ghostty pixel parity across hosts or fonts.
- tmux remains the source of truth for both visible terminal state and keyboard input. Ghostty Web never launches the target application or accepts interaction.
- Chrome or Chromium must already be installed. `GHOSTTY_WEB_CHROME` selects a nonstandard executable location without changing the capture contract.
- The destination must be absent or empty. Existing artifact contents are never replaced, and a failed capture leaves no partial artifact set at the requested path.
- The four files in one artifact directory form one capture and should be reviewed together; a valid PNG alone does not prove that the intended TUI state was captured.

Created and maintained by Nori.
