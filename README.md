# ROOM/50

ROOM/50 is an exploratory, agent-friendly web demo for one bounded task: turn a reference image and a short intent into an executable 3D modeling brief for a **50 m² accessible café**.

The UI generates prompts for either:

- a deployable Three.js concept scene, or
- a Blender MCP workflow producing `.blend`, `.glb`, and review renders.

## Run locally

Serve the repository root with any static file server. No build step is required.

```powershell
python -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

Open `http://127.0.0.1:4173/demo/` for the deterministic fail/pass evidence viewer. It progressively loads a Blender-authored ArchViz GLB when available and falls back to the semantic procedural renderer if that asset is absent or unsupported.

## Deploy to Netlify

Connect this repository in Netlify. `netlify.toml` already configures the repository root as the publish directory with no build command. You can also drag the folder into Netlify Drop.

## Agent entry points

- `/llms.txt` — short discovery map
- `/AGENTS.md` — repository and execution guidance
- `/agent/scene-contract.json` — canonical machine-readable constraints
- `/agent/workflow.md` — engine-specific build sequence
- `/.well-known/agent.json` — small discovery manifest

## ArchViz presentation layer

The high-visual pipeline is documented in [`docs/ARCHVIZ-PLAN.md`](./docs/ARCHVIZ-PLAN.md). Blender sources and repeatable generation commands live under `blender/`; generated browser assets and provenance notes live under `assets/archviz/`.

The presentation layer never replaces the data contract: `scene-brief.json` supplies spatial geometry and `validation-report.json` supplies evidence overlays.

## Privacy and scope

Uploaded images never leave the browser. The user must attach the same image to their agent prompt, or use an agent that can inspect the current browser session. Dimensions in this demo are modeling assumptions, not code-compliance or construction advice.
