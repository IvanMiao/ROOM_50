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

## Deploy to Netlify

Connect this repository in Netlify. `netlify.toml` already configures the repository root as the publish directory with no build command. You can also drag the folder into Netlify Drop.

## Agent entry points

- `/llms.txt` — short discovery map
- `/AGENTS.md` — repository and execution guidance
- `/agent/scene-contract.json` — canonical machine-readable constraints
- `/agent/workflow.md` — engine-specific build sequence
- `/.well-known/agent.json` — small discovery manifest

## Privacy and scope

Uploaded images never leave the browser. The user must attach the same image to their agent prompt, or use an agent that can inspect the current browser session. Dimensions in this demo are modeling assumptions, not code-compliance or construction advice.
