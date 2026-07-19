# ROOM/50 demo script — 3:30 target

## Setup (before going on stage)

- Open the deployed ROOM/50 home page in tab 1 and `/demo/` in tab 2.
- Keep the demo on **Before / Evidence / Day**.
- Keep the real `validation-report.json` open in a text editor as a fallback.
- Attach the same reference image to Codex if Codex cannot inspect the browser-local upload.
- Have `demo/screenshots/fail.png` and `demo/screenshots/pass.png` ready if WebGL or network access fails.

## 0:00–0:30 — The contract

On the home page, upload the café reference image, enter the intent, and generate the prompt.

Say:

> Most agent demos stop when the agent says “done.” ROOM/50 gives Codex a spatial contract, then asks geometry for the last word.

Point out the fixed 10 × 5 m shell, 1.2 m route, three Ø1.5 m turning zones, and the instruction to run the validator.

## 0:30–1:15 — Codex builds

Paste the prompt into Codex. Show the brief being produced and the loop:

```text
build scene-brief.json
→ run the geometry validator
→ read validation-report.json
→ repair geometry
→ validate again
```

Say:

> Codex only describes semantic geometry. The shared style kit turns that brief into a legible scene, so visual quality is consistent and the agent stays focused on spatial reasoning.

## 1:15–2:05 — The fail (hold this beat)

Switch to `/demo/#fail`, click **Evidence**, and pause on the red route.

Read the line that matters:

```text
routeWidth  FAIL  measured 1.05 m  required >= 1.20 m
```

Say:

> This is the important moment. The page does not trust the agent’s claim. The validator found a real bottleneck at table B3 and returned geometry that the overlay can draw.

Orbit slightly, then switch briefly to **Top** and back to **Evidence**. Make clear that the red path comes from `validation-report.json`, not from an agent-authored success label.

## 2:05–2:50 — The trade-off

Explain the repair before clicking **After**:

> Codex moves B3 fifty-five centimetres and removes the route-side chair. We lose one seat—from fifteen to fourteen—because clearance is a higher-priority constraint.

Click **After**. Let the green route and circles settle, then read:

```text
routeWidth  PASS  measured 1.24 m  required >= 1.20 m
seatCount   PASS  measured 14       required 14–18
```

This is the “soul shot”: keep the Before/After controls and the green evidence view visible together.

## 2:50–3:20 — Visual floor, not visual distraction

Toggle **Night light** once, then return to Day.

Say:

> The ArchViz GLB raises the visual floor, while the day and night rigs let us inspect it under different lighting. If that asset cannot load, the procedural fallback exposes two restrained palettes. In both modes, evidence stays independent and comes from the report.

Return to Day for the final frame.

## 3:20–3:30 — Close

Show the deployed Netlify URL in the address bar.

Say:

> CI tests logic. ROOM/50 validates space. The website hands the agent a contract; when the agent delivers, geometry decides—not the agent’s word.

## Recording fallback

Record one clean 1920 × 1080 take with this shot order:

1. Home page contract and generated prompt — 25 s.
2. Terminal/Codex build and first validator fail — 35 s.
3. `/demo/#fail` Evidence view, then Top — 25 s.
4. Before → After transition and the 15 → 14 seat trade-off — 30 s.
5. Day → night → day lighting check — 15 s.
6. Final green report + deployed URL — 10 s.

If the live Codex run is slow, cut from the generated prompt directly to the fail fixture. State that the two fixture files reproduce the same validator interface and do not represent a hidden success claim.
