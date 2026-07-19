# ROOM/50

ROOM/50 is an exploratory, agent-friendly web demo for one bounded task: turn a reference image and a short intent into an executable 3D modeling brief for a **50 m² accessible café**.

The UI generates prompts for either:

- a deployable Three.js concept scene, or
- a Blender MCP workflow producing `.blend`, `.glb`, and review renders.

The reference step includes three public 10 m × 5 m plan variants. A selected plan's entrance, walls, openings, fixed zones, and obstructions must remain traceable in the generated model's Top view. Browser-local uploads remain available as a custom-reference path.

## Run locally

Use the exact Node 22.14.0 release pinned in `.nvmrc` and pnpm:

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Run `pnpm typecheck` for strict TypeScript checks and `pnpm build` to create the production `dist` directory.

Validate a schema-compliant scene brief and write `validation-report.json` in the current directory:

```sh
npm run validate -- validator/fixtures/pass.json
```

The command exits `0` when every error-severity check passes, `1` for measured geometry failures, and `2` for invalid input.

Regenerate the deterministic demo reports after editing their scene briefs:

```sh
pnpm reports:demo
```

`pnpm test` verifies that the checked-in demo reports are byte-for-byte outputs of the current validator.

Append `/demo/` to the local URL printed by Vite for the deterministic fail/pass evidence viewer. For a production check, run `pnpm build`, then `pnpm preview`, and append `/demo/` to the preview URL. The viewer progressively loads a Blender-authored ArchViz GLB when available and falls back to the semantic procedural renderer if that asset is absent or unsupported.

## Deploy to Netlify

Connect this repository in Netlify. `netlify.toml` runs the Vite build and publishes `dist`; `.nvmrc` pins a compatible Node version. For Netlify Drop, run `pnpm build` locally and upload the generated `dist` directory.

## Agent entry points

- `/llms.txt` — short discovery map
- `/AGENTS.md` — repository and execution guidance
- `/agent/scene-contract.json` — canonical machine-readable constraints
- `/agent/scene-brief.schema.json` — canonical scene-brief 1.0.0 interface
- `/agent/workflow.md` — engine-specific build sequence
- `/.well-known/agent.json` — small discovery manifest
- `/assets/plans/catalog.json` — built-in reference-plan variants

## ArchViz presentation layer

The high-visual pipeline is documented in [`docs/ARCHVIZ-PLAN.md`](./docs/ARCHVIZ-PLAN.md). Blender sources and repeatable generation commands live under `blender/`; generated browser assets and provenance notes live under `assets/archviz/`.

The presentation layer never replaces the data contract: `scene-brief.json` supplies spatial geometry and `validation-report.json` supplies evidence overlays.

## Privacy and scope

Uploaded images never leave the browser. The user must attach the same image to their agent prompt, or use an agent that can inspect the current browser session. Dimensions in this demo are modeling assumptions, not code-compliance or construction advice.
