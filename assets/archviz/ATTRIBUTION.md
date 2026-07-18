# ROOM/50 ArchViz asset provenance

**No third-party visual assets are included.**

All geometry in `room50-cafe-pass.*` and `room50-cafe-fail.*` is generated from
Blender primitives by `blender/generate_archviz.py`. All images under `textures/`
are deterministic numerical base-color and normal maps created by that same
script. Text uses Blender's bundled Bfont and is converted to exported geometry.

Spatial layout comes from the repository-owned
`demo/fixtures/{pass,fail}.scene-brief.json` fixtures and the canonical ROOM/50
scene contract. No BlenderKit, BlendSwap, Poly Haven, ambientCG, stock-photo,
downloaded model, HDRI, or other external asset is redistributed here.

The outputs are a **concept demo — not for construction**.
