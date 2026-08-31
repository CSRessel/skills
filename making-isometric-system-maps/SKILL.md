---
name: making-isometric-system-maps
description: Use when someone wants an interactive isometric system map of a codebase or project.
---

<required>
Add these steps to your task list:

1. Announce.
2. Ask about the project.
3. Ask about regions.
4. Ask about interview depth.
5. Research.
6. Copy the starter.
7. Implement the map.
8. Inspect in a browser (optional).
</required>

## 1. Announce

Use this template only to orient the user; ask the questions in steps 2–4 afterward.

We're going to create an isometric system map. I'm going to ask:

- What project to map?
- What areas of interest?
- And offer a more in-depth interview.

Let's begin

## 2. Identify the target

What source code or project do you want me to map out?

Use my answer to locate the repository, directory, or project to research.

## 3. Establish the regions

Do you have high-level regions in mind? (or leave it up to me)

Use the high-level regions I suggest. If I leave them up to you, choose them
from your project research.

## 4. Choose the interview depth

Should I interview you in depth? (or rely on my own research)

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
