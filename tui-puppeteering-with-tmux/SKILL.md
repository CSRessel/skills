---
name: tui-puppeteering-with-tmux
description: Use when automating or testing TUI/CLI applications - provides isolated tmux sessions with scripts for input, output capture, and state verification
---

# TUI Puppeteering

<required>
**CRITICAL**: Interact with tmux ONLY through the bundled scripts in `{{skills_dir}}/tui-puppeteering-with-tmux/`.
The scripts use an isolated socket. Direct tmux commands can destroy my sessions.
</required>

## Workflow

<required>
Add to update tasks before ANY interaction:

1. Write a **Test Plan** (required before execution)
2. Start session with `tui-start`
3. **Assert-Act-Assert loop**: verify state, send input, verify result
4. Cleanup with `tui-stop`
</required>

## Test Plan

Before you run any command, write a one-line plan with each input and its expected screen:

<good-example>
**Plan:** Start `./my-app`, expect "Welcome". Press Enter, expect "Menu". Press 'q' to exit.
</good-example>

## Scripts

Every script uses the socket `nori-agent-sock`.

### tui-start

```bash
{{skills_dir}}/tui-puppeteering-with-tmux/tui-start <session-name> "<command>"
```

Starts a 120x40 session with no status bar and runs the command.

### tui-assert

```bash
# Fixed string match (default)
{{skills_dir}}/tui-puppeteering-with-tmux/tui-assert <session> "<text>" [timeout]

# Regex match
{{skills_dir}}/tui-puppeteering-with-tmux/tui-assert <session> -E "<pattern>" [timeout]
```

Default timeout is 5s. On failure it writes `<session>_failure.log`. Wait with `tui-assert`, never with a blind `sleep`:

<good-example>
`tui-assert "mytest" "Ready>" 10`
`tui-assert "mytest" -E "Error:.*code [0-9]+" 5`
</good-example>

### tui-send

```bash
# Literal text (no Enter)
{{skills_dir}}/tui-puppeteering-with-tmux/tui-send <session> "<text>"

# Special keys
{{skills_dir}}/tui-puppeteering-with-tmux/tui-send <session> --keys "Enter"
{{skills_dir}}/tui-puppeteering-with-tmux/tui-send <session> --keys "C-c"
```

Use `--keys` for Enter, Escape, Tab, Space, BSpace, Up, Down, Left, Right, C-a to C-z, and F1-F12.

After `Escape`, wait 0.2s before the next key. Otherwise the TUI can read the pair as Alt+key:
```bash
$SCRIPTS/tui-send "$SESSION" --keys "Escape"
sleep 0.2
$SCRIPTS/tui-send "$SESSION" --keys "j"
```

If a prompt does not submit after Enter, send Enter a second time. Nori CLI and Codex CLI often need two.

### tui-capture

```bash
{{skills_dir}}/tui-puppeteering-with-tmux/tui-capture <session>
```

Prints the visible screen. Use it to debug mid-flow. Default to no flags. Add a flag only for its case:

| Flag | Use Case |
|------|----------|
| `-e` | Preserve ANSI color codes (for testing colored output) |
| `-S N` | Include N lines of scrollback history |
| `-a` | Capture inactive buffer instead of active |

### tui-stop

```bash
{{skills_dir}}/tui-puppeteering-with-tmux/tui-stop <session>
```

Kills the session and cleans up. **Always call it when done, even on failure.**

### tmux-isolated

For any other tmux command, use the isolated wrapper:

```bash
{{skills_dir}}/tui-puppeteering-with-tmux/tmux-isolated <tmux-args>
```

## Assert-Act-Assert Loop

```bash
SCRIPTS="{{skills_dir}}/tui-puppeteering-with-tmux"
SESSION="test-feature"

# Start
$SCRIPTS/tui-start "$SESSION" "./my-app"

# ASSERT initial state
$SCRIPTS/tui-assert "$SESSION" "Welcome" 10

# ACT
$SCRIPTS/tui-send "$SESSION" "hello"
$SCRIPTS/tui-send "$SESSION" --keys "Enter"

# ASSERT result
$SCRIPTS/tui-assert "$SESSION" "Response:" 10

# Cleanup
$SCRIPTS/tui-stop "$SESSION"
```

If an assertion fails, read `<session-name>_failure.log`.

## Safety

**NEVER** run `tmux kill-server` without the isolated socket. It destroys ALL my sessions. To end a session, use `tui-stop` or `tmux-isolated kill-session -t <session>`.

## Verification

Run the test suite to verify scripts work:

```bash
bash {{skills_dir}}/tui-puppeteering-with-tmux/test_tui_scripts.sh
```
