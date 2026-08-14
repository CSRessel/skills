# `nh` NetHack Harness

`nh` is a compact, safe interface to the isolated `nethack-together` session.
It invokes only the installed `tui-capture` and `tui-send` helpers; it never calls
`tmux` directly.

## Commands

```text
./nh                         compact live status
./nh do west                 semantic direction
./nh do s                    literal NetHack key (`s` searches)
./nh run 6 east              repeat safely, observing after every key
./nh do escape               special Escape key
./nh do kick                 NetHack kick command (`C-d`)
./nh map                     trimmed map with zero-based row coordinates
./nh raw                     exact capture; debugging only
./nh parse CAPTURE            parse a saved capture without touching the game
./nh --json status           machine-readable output
```

Only full cardinal names are semantic: `north`, `south`, `east`, and `west`.
Diagonal names also accept `ne`, `nw`, `se`, and `sw`. Single characters always
retain their exact NetHack meaning.

## Safety and output

`nh do` captures before input, sends through the isolated helper, waits for a
stable result, then classifies the delta as `MOVED`, `NOOP`, `PROMPT`, `MESSAGE`,
`COMBAT`, or `ALERT`. It does not assume that an action consumes a turn. `nh run`
stops after a prompt, combat, HP loss, unknown UI mode, or two consecutive views
where Ember is hidden.

Normal output is capped to a status line plus message, position, pet, and adjacent
glyphs. Full terminal output appears only with `raw`. Last-known state is stored
in `.nh/state.json` and helps distinguish Clifford or Ember from duplicate glyphs.

## Development

```text
cargo fmt --check
cargo test --all-targets
cargo clippy --all-targets -- -D warnings
cargo build --release
```

Saved captures live under `tests/fixtures/`. CLI integration tests use fake
bundled-style scripts and never touch the live game.

## Structure

```text
main → cli → app → session
                 ↘ screen → event → render
                    ↘ state
```
