---
name: making-isometric-system-maps
description: Create interactive isometric system maps of codebases or architectures using the bundled starter.
---

# Isometric system maps

The [bundled starter](assets/starter/) supplies the page, drawing, themes,
and interactions. Its `data.js` holds the map's content and spatial layout.

## Workflow

Announce the skill and ask the three questions together with this exact
five-line template:

```text
Isometric system maps
What source code or project do you want me to map out?
Do you have high-level regions in mind? (or leave it up to me)
Should I interview you in depth? (or rely on my own research)
Then I go build it!
```

Wait for the answers. If the user wants an in-depth interview, conduct it
before proceeding; otherwise rely on your own research.

Then follow this order:

1. Research the target project extensively, ideally using multiple subagents
   when available.
2. Begin implementation: copy `assets/starter/` from this skill into a map
   folder in the project's working directory.
3. Edit the data and layout in `data.js` to implement the new system map.
4. Optionally, if browser tools or skills are available, inspect the results
   in a browser and make any final corrections.

## Scope

Author the map using the existing starter. Keep its UI, theme definitions,
and rendering behavior. Choosing a bundled theme is supported; extra UI,
new themes, and renderer customization are outside this skill's scope.
