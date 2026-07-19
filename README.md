# ROOM/50

ROOM/50 is an exploratory, agent-friendly web demo for one bounded task: turn a reference image and a short intent into an executable 3D modeling brief for a **50 m² accessible café**.

The UI generates prompts for either:

- a deployable Three.js concept scene, or
- a Blender MCP workflow producing `.blend`, `.glb`, and review renders.

The reference step includes three public 10 m × 5 m plan variants. A selected plan's entrance, walls, openings, fixed zones, and obstructions must remain traceable in the generated model's Top view. Browser-local uploads remain available as a custom-reference path.

## Run locally

Use Node 22 or newer and pnpm:

```powershell
pnpm install
pnpm dev
```

Open the local URL printed by Vite. Run `pnpm typecheck` for strict TypeScript checks and `pnpm build` to create the production `dist` directory.

## Deploy to Netlify

Connect this repository in Netlify. `netlify.toml` runs the Vite build and publishes `dist`; `.nvmrc` pins a compatible Node version. For Netlify Drop, run `pnpm build` locally and upload the generated `dist` directory.

## Ginse fixed-price action

ROOM/50 exposes one paid hackathon action at `POST /run`: turn a public ROOM/50 plan selection, a café experience intent, experience priorities, and a modeling engine into an agent-ready 50 m² accessible café brief.

- Input schema: `/ginse/input-schema.json`
- Output schema: `/ginse/output-schema.json`
- Marketplace manifest: `/.well-known/ginse.json`
- Contract test: `pnpm test:ginse`

The endpoint accepts only a short-lived Ginse Ed25519 bearer token. It atomically binds every `Idempotency-Key` to a canonical request fingerprint in a strongly consistent, site-wide Netlify Blobs store. The stable operation ID and terminal output survive deploys and are replayed without repeating work; key reuse with a different input is rejected.

## Agent entry points

- `/llms.txt` — short discovery map
- `/AGENTS.md` — repository and execution guidance
- `/agent/scene-contract.json` — canonical machine-readable constraints
- `/agent/workflow.md` — engine-specific build sequence
- `/.well-known/agent.json` — small discovery manifest
- `/assets/plans/catalog.json` — built-in reference-plan variants

## Privacy and scope

Uploaded images never leave the browser. The user must attach the same image to their agent prompt, or use an agent that can inspect the current browser session. Dimensions in this demo are modeling assumptions, not code-compliance or construction advice.
