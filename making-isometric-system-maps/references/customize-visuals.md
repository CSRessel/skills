# Customize the visuals

Make the change I asked for. If it is vague, ask what should be easier to
understand. Never change the mapped facts.

## Layout

Put related parts close together and leave room for connections. A region is a
group, not necessarily a machine or process; label what it groups. Request paths
read actors → API → services → processing → storage, but do not force shared
state or feedback loops into a pipeline.

Default shapes: box for components, dashed floor region for groups, user bust
for actors, cylinder for stores, stack for queues and streams. Use others only
if I ask. Keep sparse maps compact and tighten clusters as they grow. Never
route a line through an unrelated component.

## Smallest edit

- Layout and shapes: the copied `data.js`.
- Theme: omit `theme` to follow the OS light or dark setting, or set `light`,
  `dark`, `paper`, `carbon`, or `cyanotype`. A saved browser choice overrides
  it. Stay monochrome unless I ask for color.
- Appearance: `style.css`. Rendering and interaction: `map.js`. Check the
  schema before adding a data field; unknown fields do nothing.

Keep floor lines in perspective, shaded faces opaque, and selection distinct.
Keep pan, pinch, deselection, flow focus, and readable nameplates working.
Check desktop and mobile if browser tools exist. Never add a control panel or
theme system for a small change.
