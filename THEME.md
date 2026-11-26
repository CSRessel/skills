# Theme

Every HTML surface in this repository uses one set of token names: the code
orientation viewer, the rendered HTML plan, the isometric system map, and the
swipe-card review deck.

## Themes

- **`light` / `dark`** (the default): the swipe-card review palette, built on
  IBM Carbon's cool greys. White or near-black sheets on a grey canvas, grey
  ink, and green only where something is active or emphasised. The page
  follows the OS setting until a reader pins a theme.
- **`paper`** (override): black on warm paper, drawn in charcoal. No coloured
  accent; emphasis comes from how strongly the charcoal is stated, so links
  carry an underline.
- **`carbon`** (override): white on black, drawn in green. It matches the
  terminal palette that `tui-capture-with-ghostty-web` renders with.

Pin a theme with `data-theme="light|dark|paper|carbon"` on `<html>`. The viewer
and plan accept `?theme=`, and the map has a theme picker.

## Tokens

[`theme/tokens.css`](theme/tokens.css) is the source of truth. The default
pair uses CSS `light-dark()`, so one block serves both modes.

| Token | Role | `light` | `dark` | `paper` | `carbon` |
| --- | --- | --- | --- | --- | --- |
| `--canvas` | the page, the drawing surface | `#f2f4f8` | `#161616` | `#ece6d8` | `#161616` |
| `--panel` | sheets and flanking chrome | `#ffffff` | `#1c1c1c` | `#e7e0d0` | `#1c1c1c` |
| `--raised` | insets: code, table heads, hover | `#e8ebf0` | `#262626` | `#d9d1bf` | `#262626` |
| `--rule` | hairlines, borders, dividers | `#dde1e6` | `#393939` | `#b7ad99` | `#393939` |
| `--ink` | body text, headings | `#393939` | `#dde1e6` | `#1f1c18` | `#dde1e6` |
| `--muted-ink` | labels, captions | `#525252` | `#8a8f98` | `#5a564f` | `#8a8f98` |
| `--faint` | de-emphasised text and strokes | `#8a8f98` | `#525252` | `#a09c94` | `#4a4a4a` |
| `--accent` | active state, links, the one pointer | `#198038` | `#42be65` | `#26231e` | `#42be65` |
| `--accent-ink` | text on a solid `--accent` fill | `#ffffff` | `#161616` | `#f4efe3` | `#0e0e0e` |
| `--draw` | ordinary drawing stroke | `#697077` | `#697077` | `#6d6a64` | `#3f9e59` |
| `--draw-strong` | the emphasised stroke | `#198038` | `#6fdc8c` | `#1f1c18` | `#7bf2a4` |
| `--edge` | connector between drawn units | `#4d5358` | `#a2a9b0` | `#6b6660` | `#b9bec4` |
| `--danger` | errors and refusals | `#da1e28` | `#f47067` | `#da1e28` | `#f47067` |

`light` uses `#198038` for `--accent` because it is text-safe on white. The
deck's brighter `#24a148` button fill is a deck-only token.

Surface-only tokens sit beside the shared block, never inside it:

- **The map:** `--grid-line`, `--zone-line`, `--plate`, `--plate-ink`, and a
  fifth `cyanotype` theme.
- **The deck:** its fills, tints, and shadow.

## Mermaid

Mermaid needs literal colours, so [`theme/mermaid.js`](theme/mermaid.js) holds
one variable set per theme. It also holds `mermaidThemeVariables()`, which
resolves the page's theme. Never use Mermaid's built-in `default` or `dark`
themes; they impose their own hues.

## Print

Print follows no theme. The plan scaffold prints black on white.

## Changing a token

Each asset directory is copied out and served on its own, so a shared
stylesheet would not survive the copy. Each surface inlines the tokens between
`theme:tokens` (or `theme:mermaid`) markers instead. Never edit those regions
by hand:

1. Edit `theme/tokens.css` or `theme/mermaid.js`.
2. Run `node theme/sync.mjs` to rewrite every surface.
3. Run `node theme/sync.mjs --check`. It fails when any surface has drifted.

To theme a new surface, add the markers to it and list it in `SURFACES` in
`theme/sync.mjs`.
