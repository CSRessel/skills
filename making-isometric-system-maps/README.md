# Isometric system maps — draft

This package contains the authoring workflow in [SKILL.md](SKILL.md) and the approved
[starter](assets/starter/): the page, map data, renderer, geometry and its existing
test file, styles, and bundled fonts. It is not installed into active skill
directories or published to the skill registry.

The default [map data](assets/starter/data.js) follows a simplified SQLite
`SELECT`: compile SQL, run bytecode, read uncached pages, and return a result row
to the caller. It is grounded in
[pinned SQLite source](https://github.com/sqlite/sqlite/tree/d92acf1afe6dbd4c8aec9aa9513a518f690c2acf);
source paths in the map are relative to that repository. It is not a complete
transaction or WAL model.

The page's font link is local; font notices are included in
[fonts.css](assets/starter/fonts.css). See [NOTICE](../NOTICE).

Pending: spatial-judgment guidance, then validation and blind subagent tests.
The package and workflow have not been validated or tested.

TODO: Future optional customization or features may use progressively disclosed
supporting Markdown files; none are included now.
