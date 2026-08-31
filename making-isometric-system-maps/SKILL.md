---
name: making-isometric-system-maps
description: Use when someone wants an interactive isometric system map of a codebase or project.
---

<required>
CRITICAL: Add the following steps to your task list:

1. Announce the skill with the orientation template.
2. Ask: "What source code or project do you want me to map out?"
3. Ask: "Do you have high-level regions in mind? (or leave it up to me)"
4. Ask: "Should I interview you in depth? (or rely on my own research)"
5. Research the target project extensively, ideally using multiple subagents.
6. Begin implementation: copy the starter into the working directory.
7. Edit the data and layout to implement the new system map.
8. Optionally, if browser tools or skills are available, inspect the results
   in a browser and make final corrections.
</required>

## 1. Announce

Use this template only to orient the user; ask the questions in steps 2–4 afterward.

```text
We're going to create an isometric system map. I'm going to ask:
- What project to map?
- What areas of interest?
- And offer a more in-depth interview.

Then I go build it!
```

## 2. Identify the target

Use my answer to locate the repository, directory, or project to research.

## 3. Establish the regions

Use the high-level regions I suggest. If I leave them up to you, choose them
from your project research.

## 4. Choose the interview depth

Wait for answers to the three questions. If I want an in-depth interview,
conduct it before the full research pass; otherwise proceed with your own research.

During the interview, ask one question at a time with a recommended answer,
resolve dependent decisions, and investigate questions the code can answer.

## 5. Research

Research the project extensively before implementation. Where available,
divide subsystem research among multiple subagents. Ground the components
and relationships in source code, recording useful source paths.

## 6. Copy the starter

`assets/starter/` is beside this `SKILL.md`. Copy the entire folder into a
map directory in the project's working directory. It contains the HTML page,
map data, renderer, geometry, styles, bundled fonts, and existing geometry
tests. The page needs no package installation or build step.

## 7. Implement the map

Set `title` to the project name only, such as `SQLite`. The page and browser
tab use `system map / PROJECT`; do not write a narrative headline.

Replace the example's zones, nodes, edges, and optional flow in `data.js`.
Edit the plan coordinates and dimensions there to lay out the new map;
include component names, descriptions, and relevant source paths.

## 8. Inspect in a browser (optional)

If browser tools or skills are available, serve the map over HTTP and inspect
its layout and interactions. Make any final corrections. Otherwise, skip
this step.
