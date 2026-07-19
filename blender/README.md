# ROOM/50 deterministic ArchViz generator

This Blender 5.x pipeline turns the canonical `demo/fixtures/pass.scene-brief.json`
and `demo/fixtures/fail.scene-brief.json` files into a matched pair of warm European
café scenes. It is a **concept demo — not for construction**.

The visual layer stays separate from validation: fixture positions and bounding-box
metadata are stored on `SEM_*` root objects, while softened furniture, props,
materials, and lighting are child geometry. The output is therefore richer than a
validator proxy without changing the source decisions.

The generator consumes scene-brief schema `1.0.0`. `semanticGroup` is the
authoritative Blender collection destination (with `semanticTag` inference only
for legacy briefs), positions are `(x, z)` on the finished floor, rotations are
radians around `+y`, and each semantic root starts at `elevationM`. Child geometry
then rises by `bbox.h`, so elevation is never mistaken for an object's vertical
centre.

## Generate everything

From the `ROOM_50` repository root on macOS:

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background \
  --factory-startup \
  --python blender/generate_archviz.py \
  -- \
  --variant all \
  --resolution 1280 800 \
  --samples 64 \
  --texture-size 512
```

Fast geometry/export check without rerendering posters:

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background \
  --factory-startup \
  --python blender/generate_archviz.py \
  -- \
  --variant all \
  --skip-render
```

Use `--variant pass` or `--variant fail` to build one state. Random seeds are fixed,
and all material images are regenerated from deterministic numerical fields.

## Outputs

The exact web-facing files are:

- `assets/archviz/room50-cafe-pass.glb`
- `assets/archviz/room50-cafe-fail.glb`
- `assets/archviz/room50-cafe-pass.png` and `.webp`
- `assets/archviz/room50-cafe-fail.png` and `.webp`
- `assets/archviz/room50-cafe-pass.blend`
- `assets/archviz/room50-cafe-fail.blend`
- `assets/archviz/room50-cafe-{pass,fail}-top-evidence.png` and `.webp`
- `assets/archviz/textures/*-{basecolor,normal}.png`
- `assets/archviz/manifest.json`

The `.blend` files contain the required independently toggleable collections:

```text
00_SHELL
01_ARCHITECTURE
02_SERVICE
03_FURNITURE
04_ACCESSIBILITY
05_LIGHTING
```

The axonometric hero PNG/WebP is rendered with `04_ACCESSIBILITY` hidden so it can
serve as a clean loading/non-WebGL fallback. The `*-top-evidence.*` images render
that collection visible. Evidence is therefore never baked into the clean hero.

In the GLB, semantic source roots begin with `SEM_` and toggleable accessibility
guides begin with `ACCESS_`. Custom glTF extras retain source IDs, tags,
bounding-box dimensions, route targets, and concept status. They never contain a
validator result.

Capacity is derived exclusively from `seats` entries whose
`countsTowardCapacity` value is `true`; no separate `seatCount` field is read or
written. Blender scene metadata exposes this derived value as
`derivedSeatCapacity`. Seat entries are markers only: solid chairs come from
`objects`, and an unreferenced wheelchair position remains empty.

## Coordinate contract

ROOM/50 fixture positions are Three.js floor-plane `(x, z)` values. Blender glTF
Y-up export maps Blender `(x, y, z)` to glTF `(x, z, -y)`, so the generator maps
contract `(x, z, height)` to Blender `(x, -z, height)` before building.

After every GLB export the script parses the binary JSON chunk and hard-fails unless
these landmarks match:

- rear wall: Three/glTF `z = -2.50`
- accessible table: Three/glTF `z = +1.35`
- table B3: Three/glTF `z = +0.02`

This prevents an attractive but spatially mirrored model from reaching the web
scene.

## Modeled targets

- fixed shell: 10.00 m × 5.00 m × 3.20 m, 50 m²
- step-free entrance target: 0.90 m clear
- lowered counter: 0.76 m high
- accessible table knee-clearance target: 0.70 m
- entrance, service-counter, and WC turning zones: Ø 1.50 m
- continuous route target: at least 1.20 m
- capacity markers derived from the brief: 15 before, 14 after

These are the fixture's demonstration targets. Local accessibility rules, fire and
egress, structure, MEP, plumbing, fabrication, and site conditions remain
unverified.

## Asset provenance

No external models, HDRIs, images, or downloaded textures are used.

- Geometry is created by `blender/generate_archviz.py` from Blender primitives.
- Oak, plaster, linen, clay, stone, and terrazzo base-color/normal maps are generated
  numerically by the same script and embedded by the GLB exporter.
- Typography uses Blender's bundled Bfont and is exported as geometry.
- Layout data comes only from `demo/fixtures/{pass,fail}.scene-brief.json` and the
  repository's canonical 10 m × 5 m × 3.2 m contract.

The route centreline, 1.20 m target width, and turning-zone geometry come from the
canonical brief's `accessibility` object. The generator does not read a validation
report and never labels the GLB pass or fail. At runtime, the independently loaded
`validation-report.json` supplies the measured cross-section and corner-clearance
results and is the only source for pass/fail status and overlays.

The procedural source and generated assets therefore do not introduce third-party
asset-license or attribution obligations.

## Known limitations

- Eevee Area lights make the Blender poster but are not represented by the glTF
  punctual-lights extension; the web viewer should provide its own environment,
  key, and fill lights.
- The front and right walls are deliberately opened for the axonometric cutaway.
  Brass boundary rails and the floor slab retain the exact 10 m × 5 m footprint.
- Furniture and café props are concept-level visual models, not fabrication assets.
- Material textures are 512 px by default to keep each web GLB near 12 MB. Increase
  `--texture-size` for offline poster work; doing so also increases the GLB size.
- The checked-in Blender binaries predate the validator-integration reconciliation
  of the route centreline and turning-zone locations. The web layer hides their
  `04_ACCESSIBILITY` / `ACCESS_*` guides and draws current evidence from the report,
  but rerun this generator before using the `.blend` guide collection or the
  `*-top-evidence` renders as handoff evidence.
