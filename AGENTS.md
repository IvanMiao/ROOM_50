# ROOM/50 agent instructions

## Build for Codex: agent-first requirement

ROOM/50 is a Netlify-deployable **Build for Codex** web demo. The website itself must be designed for agents, not merely as a human interface with agent documentation added afterward.

These constraints are non-negotiable:

- An agent must be able to visit the deployed URL and understand the task without repository access.
- Keep `/llms.txt`, `/AGENT.md`, `/AGENTS.md`, `/agent/scene-contract.json`, and `/.well-known/agent.json` publicly accessible.
- Put essential instructions, constraints, workflows, and completion checks in readable HTML, text, or JSON, not only in images, canvas, or visual styling.
- The generated prompt must send the agent to the website first and identify the machine-readable resources it should inspect.
- Clearly distinguish observed information, user intent, fixed constraints, and assumptions.
- Never claim access to a browser-local upload unless the agent can inspect that browser session. Otherwise, ask the user to attach the image.
- Preserve this agent-facing experience whenever the website changes.

## Purpose

ROOM/50 is an exploratory handoff surface for one bounded spatial-modeling task: create a concept-level 3D model of a **50 m² accessible neighbourhood café** from a reference image and a user intent.

This repository is not a generic room generator, code-compliance checker, construction-document tool, or image-to-3D service. Keep the use case narrow.

## Canonical sources

Read these before changing or generating model code:

1. `/llms.txt` for the public discovery map.
2. `/agent/scene-contract.json` for canonical dimensions, required zones, accessibility targets, and completion checks.
3. `/agent/workflow.md` for Three.js and Blender MCP build sequences.
4. The visible upload preview on `/` for the current user reference.

For a built-in selection, `/assets/plans/catalog.json` identifies the exact public SVG. Its catalog description is context; observations must still come from inspecting the selected plan.

If prose conflicts with `scene-contract.json`, the JSON contract wins. If an uploaded drawing conflicts with the fixed 50 m² scenario, report the conflict instead of silently changing scale.

## Browser exploration protocol

When an agent is asked to explore the deployed page:

1. Open the page and read `/llms.txt`.
2. Fetch `/agent/scene-contract.json` rather than inferring measurements from pixels.
3. Inspect the DOM labels and the reference image shown in `#uploadPreview`.
4. If a built-in plan is selected, fetch that exact SVG rather than reusing the fallback sample.
5. Distinguish observed reference facts from scenario assumptions.
6. Ask for the original image attachment if the upload is not visible in your browser session. Uploads are local-only and are never stored by the site.
7. Do not edit files until the user explicitly asks you to build.

## Build boundary

The fixed baseline is:

- Rectangular 10 m × 5 m shell, 50 m² gross area, 3.2 m clear-height assumption.
- Step-free entrance, ordering/pick-up counter, compact back bar, mixed seating, one accessible table position, and one accessible WC concept zone.
- One continuous entrance → order → pick-up → accessible seat → WC route.
- Target route width of at least 1.2 m.
- Visible 1.5 m diameter turning zones at entrance, counter, and WC.
- Concept LOD: shell, large partitions, major furniture, route evidence, and simple materials only.

These are demo modeling targets, not a claim of regulatory compliance. Always flag local-code, structure, fire-egress, plumbing, MEP, and site assumptions as unverified.

## Three.js output

When Three.js is selected:

- Use metres as world units: `1 unit = 1 metre`.
- Create named scene groups: `shell`, `architecture`, `service`, `furniture`, `accessibility`, `lighting`.
- Provide Perspective, Top, and Accessibility views.
- Keep accessibility overlays independently toggleable.
- Include a non-WebGL fallback and responsive layout.
- Produce at minimum `index.html`, `scene.js`, `styles.css`, `scene-brief.json`, and `README.md`.
- Prefer the smallest static deployment that works on Netlify.

## Blender MCP output

When Blender MCP is selected:

- Confirm an actual Blender MCP connection before claiming any modeling work.
- Set Metric units and unit scale 1.0.
- Use named collections: `00_SHELL`, `01_ARCHITECTURE`, `02_SERVICE`, `03_FURNITURE`, `04_ACCESSIBILITY`, `05_LIGHTING`.
- Save a `.blend`, export a `.glb`, and render an axonometric image plus a top-down evidence image.
- Put route and turning-zone geometry in `04_ACCESSIBILITY` so it can be independently shown or hidden.

## Definition of done

A modeling task is complete only when the agent reports evidence for all of the following:

- True scale and an obvious 50 m² boundary.
- Semantic object or group names.
- A visible continuous accessible route.
- Three visible 1.5 m turning zones.
- Door, lowered counter, and accessible-table dimensions.
- Files created and how to open or deploy them.
- Known gaps and the next decision required from the user.
- A visible “concept demo — not for construction” label.
- A Top view that visibly corresponds to observed entrance, walls, openings, and fixed zones in the selected reference, with deviations reported.

Do not hide unresolved spatial conflicts with photoreal materials or additional scope.
