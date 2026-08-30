# Capture brief template

Copy this block into each delegated capture task and replace every placeholder.

```text
Capture: <feature and visible state>
Command: <exact command run inside the isolated session>
Session: <unique isolated session name>
Grid: <cols>x<rows>
Actions: <ordered tui-send key:/text:... operations>
Ready assertion: <unique text proving the target state>
Artifacts: <absolute output directory>

Rules:
- Read and follow both tui-puppeteering-with-tmux and tui-capture-with-ghostty-web.
- Use only the bundled tui-* scripts; never call tmux directly.
- Use scripts/capture-session for the final text, ANSI, PNG, and metadata files.
- Prefix visual-capture commands with `env -u NO_COLOR COLORTERM=truecolor` and
  pass `--require-color` unless the target is intentionally monochrome.
- Inspect screen.png and screen.txt. Correct the capture if the target feature is
  missing, stale, clipped, shifted, or obscured.
- Stop only the isolated session you created.
- Return the artifact paths, assertion used, actions taken, and any caveat.
```
