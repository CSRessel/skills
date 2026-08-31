# Customize the visuals

Start with the requested change. If it is vague, ask what should be easier to
understand or what visual reference I prefer. Preserve the mapped facts.

## Spatial judgment

Make proximity mean something: cluster closely related parts, separate real
boundaries, and leave room for connections. Regions are not automatically
machines or processes; say what they group. For a full-stack request path,
actors/clients → edge/API → services → processing → storage is a useful reading
direction, not a reason to turn shared state or feedback loops into a pipeline.

Use boxes by default, dashed floor regions for groups, a user bust for an actor,
cylinders for stores, and stacks for queues, streams, or stacked units. Introduce
other conventions only when requested. Keep sparse maps close enough to read;
use tighter clusters as the count grows. Avoid routes that appear to pass through
an unrelated component.

## Make the smallest edit

- Change coordinates, dimensions, shapes, and regions in the copied `data.js`.
- Choose `paper`, `carbon`, or `cyanotype` with `theme`. A saved browser choice
  overrides this default. Start monochromatic; add colors only when requested.
- Use `style.css` for appearance and `map.js` for rendering or interaction changes.
  Check the existing schema before adding data fields; unsupported fields do nothing.

Keep floor lines in perspective, shaded faces opaque over hidden connections,
and selection distinct. Preserve pan/pinch, deselection, flow focus, and readable
nameplates. Inspect the affected desktop/mobile states when browser tools exist;
do not add a control panel or theme system for a small adjustment.
