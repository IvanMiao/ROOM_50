# Build for Codex: Agent-First Requirement

ROOM/50 is a Netlify-deployable **Build for Codex** web demo. The website itself must be designed for agents - not merely a human interface with agent documentation added afterward.

## Non-negotiable requirements

- An agent must be able to visit the deployed URL and understand the task without repository access.
- Keep `/llms.txt`, `/AGENT.md`, `/agent/scene-contract.json`, and `/.well-known/agent.json` publicly accessible.
- Put essential instructions, constraints, workflows, and completion checks in readable HTML, text, or JSON - not only in images, canvas, or visual styling.
- The generated prompt must send the agent to the website first and tell it which machine-readable resources to inspect.
- Clearly distinguish observed information, user intent, fixed constraints, and assumptions.
- Never imply that an agent can access a browser-local upload unless it can inspect that browser session. Otherwise, ask the user to attach the image.

Keep the demo bounded to one case: a **50 m2 accessible cafe** modeled with Three.js or Blender MCP. Preserve the agent-facing experience whenever the site is changed.
