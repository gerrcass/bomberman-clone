# PR evidence gate

Every pull request body is written with the **`pr` skill** (`.agents/skills/pr/SKILL.md`) and must pass `npm run check:pr-body`. The **Evidence** section is the gate: a reviewer must be able to see the change working without checking out the branch.

## Required shape

Use the `pr` skill template. Do not hand-write a different structure. Every body has:

- `## Summary`
- `## Evidence` with **Before:** and **After:**
- `## Merge Danger` with **Door:** and **Blast Radius:**

The `PR body / Evidence gate` CI job checks those sections. The check cannot judge whether the evidence is honest or sufficient; the reviewer does.

## Before and after

- **Visual or presentation change:** capture **before** and **after** at the same viewport (1280×900) and browser context from the production build. Commit `docs/screenshots/<slug>-before.png` and `docs/screenshots/<slug>-after.png`; embed both in the PR body.
- **New screen or feature with no previous UI:** show the nearest before state (the title or screen without the control) and the after state. If no honest before state exists, say so under **Before:** and show the after plus the test or behaviour that proves the new capability.
- **Gameplay or rules change:** show the failing test and the passing test, or a scripted state diff. Screenshots are optional but useful.
- **Tooling, docs, or CI change:** show before/after command output. A screenshot is not required when there is no visual surface.
- **Performance change:** show before/after measurements from the same scenario.
- Never claim a check that was not run. If the before state cannot be reproduced, explain why and show the closest honest baseline.

## Capture

- Run `npm run build` and `npm run preview`; use an isolated browser context and clear `localStorage` before each state.
- For an old state, use a temporary worktree at the merge-base or previous release. Do not hand-edit the current UI to imitate the old one.
- Keep the viewport, settings, and scenario identical between the two states.
- Store committed evidence pairs in `docs/screenshots/` and reference them with relative paths. README screenshots are current-state documentation; PR evidence pairs are separate.

## Local check

```bash
PR_BODY="$(gh pr view --json body -q .body)" npm run check:pr-body
```
