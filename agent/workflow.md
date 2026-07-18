# ROOM/50 modeling workflow

Use this workflow only after reading `scene-contract.json` and inspecting the available reference image.

## Phase 1 — Extract

Return a small evidence table with:

- selected built-in plan id and public URL, or the uploaded filename;
- observed feature;
- where it appears in the image;
- confidence (`high`, `medium`, or `low`);
- modeling consequence;
- whether it conflicts with the fixed contract.

Do not infer scale from a reference image when the contract provides dimensions. If the image contains an explicit dimension chain, record both values and flag any conflict.

For a built-in reference, fetch the exact selected SVG listed in `/assets/plans/catalog.json`. Inspect the SVG itself: the catalog challenge is context, not observed evidence. Record the entrance, walls, openings, fixed zones, and obstructions that should remain traceable in the model.

## Phase 2 — Plan

State before building:

- coordinate system and origin;
- unit convention (`1 unit = 1 metre`);
- shell dimensions;
- named zones and approximate areas;
- continuous accessible route;
- object or collection hierarchy;
- assumptions that require later validation.
- a plan-fit map from each observed entrance, wall, opening, fixed zone, or obstruction to its intended modeled object.

Prefer route continuity over seat count. Aim for 14–18 seats only if clearances remain credible.

## Phase 3A — Three.js

1. Create the 10 m × 5 m shell at true scale.
2. Create named groups: `shell`, `architecture`, `service`, `furniture`, `accessibility`, `lighting`.
3. Add the entrance, accessible WC concept zone, back bar, service counter with a lowered segment, mixed tables, and one wheelchair position.
4. Position observed architecture and fixed elements so the Top view corresponds to the selected reference; report rather than hide deviations.
5. Add the accessible route and turning circles as translucent, independently toggleable geometry.
6. Add Perspective, Top, and Accessibility views.
7. Add restrained concept materials, basic lighting, and a non-WebGL fallback.
8. Write `scene-brief.json` containing the selected reference identity, dimensions, assumptions, and modeled checks.
9. Test the page at desktop and mobile widths and provide deployment instructions for Netlify.

## Phase 3B — Blender MCP

1. Verify the Blender MCP connection; do not simulate tool success in text.
2. Set Metric units and unit scale 1.0.
3. Create `00_SHELL`, `01_ARCHITECTURE`, `02_SERVICE`, `03_FURNITURE`, `04_ACCESSIBILITY`, and `05_LIGHTING` collections.
4. Build low-poly, true-scale geometry with clear names.
5. Position observed architecture and fixed elements so the top-down evidence view corresponds to the selected reference; report rather than hide deviations.
6. Add route and turning evidence to `04_ACCESSIBILITY`.
7. Save `room50-accessible-cafe.blend`.
8. Export `room50-accessible-cafe.glb`.
9. Render an axonometric review and a top-down evidence view.

## Phase 4 — Check and report

Measure and report:

- shell area and dimensions;
- minimum width along the modeled continuous route;
- three turning-zone diameters;
- clear entrance and WC door widths;
- lowered service counter height;
- accessible table knee-clearance height;
- achieved seat count;
- selected plan id or uploaded filename;
- Top-view correspondence for observed entrance, walls, openings, fixed zones, and obstructions;
- intentional deviations and ambiguous reference features;
- files created;
- unverified code and site assumptions;
- next user decision.

Every output must be labeled `concept demo — not for construction`.
