# ROOM/50 ArchViz delivery plan

## Outcome

Raise the visual ceiling from a procedural concept preview to a warm, editorial-quality café scene without weakening the validation harness.

The visual model is presentation evidence, not geometric truth. `scene-brief.json` remains the canonical spatial description and `validation-report.json` remains the only source for pass/fail overlays.

## Layer contract

```text
scene-brief.json ──► semantic/procedural scene ──► reliable fallback
        │
        └──────────► Blender ArchViz scene ──► optimized GLB ──► visual layer

validation-report.json ──► independent route + turning overlays
```

The renderer must preserve these guarantees:

- one world unit equals one metre;
- the GLB origin is the centre of the 10 m × 5 m shell;
- Blender Z-up is exported as glTF Y-up;
- semantic object names remain inspectable;
- `shell`, `architecture`, `service`, `furniture`, `accessibility`, and `lighting` remain available as scene groups or Blender collections;
- visual loading errors restore the procedural groups automatically;
- the accessibility overlay is never read from, baked into, or inferred from the hero model.

## Art direction

The target is a restrained European neighbourhood café rather than a game-like low-poly room:

- pale oak floor with visible roughness variation;
- warm lime-plaster walls;
- clay-red counter and upholstery accents;
- sage textile and planting;
- thin charcoal metalwork;
- large soft window key light with warmer practical pendants;
- bevelled edges, grounded contact shadows, and small café-scale props;
- acid-green or validator-red evidence geometry kept visually separate.

## Delivery phases

### Phase 1 — deterministic visual pipeline

- Generate fail and pass Blender scenes from the existing demo fixtures.
- Save `.blend` sources, export `.glb` variants, and render poster frames.
- Add an optional GLB presentation layer to the existing Three.js renderer.
- Keep automatic fallback and surface visual loading state in the demo.
- Document asset provenance and repeatable generation commands.

### Phase 2 — curated production assets

- Replace only hero objects whose procedural versions limit realism: chairs, banquette, espresso machine, pendant fixtures, tableware, and plants.
- Prefer Blendkit/BlenderKit assets with CC0 or Royalty Free terms, ambientCG materials, and Poly Haven HDRIs.
- Record creator, source URL, license, downloaded version, and modifications before an asset enters the repository.
- Never use extracted retailer assets or mixed-license marketplace downloads without explicit redistribution rights.

### Phase 3 — web optimization

- Apply mesh instancing for repeated chairs and tables.
- Cap hero textures at 2K and secondary textures at 1K.
- Use KTX2 for GPU textures and Meshopt or Draco for geometry after the uncompressed golden GLB is approved.
- Load a poster immediately, then cross-fade to the interactive model.
- Target a compressed GLB budget of 18 MB per scenario, 30 fps on a current mobile device, and 60 fps on a current laptop.

### Phase 4 — cinematic demo choreography

- Use the same camera for fail and pass variants.
- Cross-fade the repaired furniture arrangement instead of cutting viewpoints.
- Keep Evidence view available at all times.
- Capture one 16:10 hero frame, one top evidence frame, and one short fallback recording.

## Acceptance gates

- Fail and pass scenes align with their corresponding scene briefs.
- GLB failure, timeout, or unsupported compression never removes the procedural fallback.
- Route and turning overlays still render from validator data on top of either visual mode.
- Perspective, Top, and Accessibility views remain functional.
- The page retains a readable non-WebGL fallback and the label `concept demo — not for construction`.
- Every third-party asset has an entry in the provenance ledger before merge.

## Current implementation slice

This branch starts Phase 1 with procedural Blender assets so the pipeline is deterministic and license-clean. Curated external assets can then replace individual named objects without changing the scene contract or viewer integration.
