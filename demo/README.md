# ROOM/50 evidence demo

Use the Node release pinned in `.nvmrc`, install the pnpm dependencies, and start
Vite from the repository root:

```bash
pnpm install
pnpm dev
```

Append `/demo/` to the local URL printed by Vite. To test the production bundle,
run `pnpm build`, then `pnpm preview`, and use the preview URL instead.

The demo reads a scene brief and validation report through the same public interface used by the final harness. `fail` and `pass` fixtures make the story deterministic when a live agent run is unsuitable for a stage demo.

Useful URLs:

- `/demo/#fail` — B3 constrains the route to 1.05 m.
- `/demo/#pass` — B3 moves, one chair is removed, and the route clears at 1.24 m.

The evidence overlay is generated from `violationGeometry` or `evidenceGeometry` in the report. It is not inferred from scene styling.

The viewer also attempts to load the matching ArchViz GLB from `/assets/archviz/`. Until that presentation asset is ready—or whenever it fails to load—the semantic procedural scene remains visible automatically. Validator overlays use the same independent report path in both modes.

| Validator fail | Repaired scene |
| --- | --- |
| ![Route width failure](./screenshots/fail.png) | ![All checks passing](./screenshots/pass.png) |

## Reuse the kit

```js
import { createStarterScene } from "/kit/starter-scene.js";

const viewer = await createStarterScene({
  container: document.querySelector("#viewer"),
  brief: "/scene-brief.json",
  report: "/validation-report.json",
  visual: { url: "/assets/archviz/room50-cafe-pass.glb", variant: "pass" },
  preset: "hearth",
  view: "accessibility",
});

viewer.setView("top");
viewer.setPreset("linen");
viewer.setLighting("night");
```

Canonical briefs follow `/agent/scene-brief.schema.json` 1.0.0. Core object fields
are `{ id, semanticTag, semanticGroup, position: [x,z], elevationM, rotation,
bbox: {w,d,h} }`; `elevationM` is the bottom of the object, and the renderer places
its vertical centre at `elevationM + bbox.h / 2`. Capacity comes only from `seats`
whose `countsTowardCapacity` is `true`. A seat `objectId` points at existing solid
geometry, while an unreferenced wheelchair position remains an empty marker.

The loader retains aliases and semantic-tag group inference only for legacy,
non-1.0.0 briefs. Canonical IDs, references, route stops, turning zones, doors, and
accessible-table references are checked before rendering. Validation reports must
contain non-empty checks and a matching summary; malformed reports fail closed.

All dimensions are concept-demo targets, not code certification or construction guidance.
