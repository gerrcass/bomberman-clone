# PR evidence gate

Every pull request body is written with the **`pr` skill** (`.agents/skills/pr/SKILL.md`) and must pass `npm run check:pr-body`. The **Evidence** section is the gate: a reviewer must be able to see the change working without checking out the branch.

## Required shape

Use the `pr` skill template. Do not hand-write a different structure. Every body has:

- `## Summary`
- `## Evidence` with **Before:** and **After:**
- `## Merge Danger` with **Door:** and **Blast Radius:**

The `PR body / Evidence gate` CI job checks those sections and rejects external evidence hosts. It cannot judge whether the evidence is honest or sufficient; the reviewer does.

## GitHub-hosted evidence

All screenshots and videos must be hosted by GitHub. Do not link to Imgur, Loom, YouTube, Google Drive, Dropbox, Streamable, Vimeo, or any other external service.

Upload local files with GitHub CLI `--attach`:

```bash
gh pr create --body-file /tmp/pr-body.md \
  --attach evidence/seed-runs/before.png \
  --attach evidence/seed-runs/after.png

# Updating an existing pull request:
gh pr edit <number> --body-file /tmp/pr-body.md \
  --attach evidence/seed-runs/before.png \
  --attach evidence/seed-runs/after.png
```

GitHub CLI uploads the files to GitHub's attachment store and rewrites the matching local references in the body. The body keeps ordinary image Markdown such as `![Before](evidence/seed-runs/before.png)`; after the command it points at a GitHub URL.

For a short video, put the reference in its own paragraph and attach the file:

```markdown
**After:**

![](evidence/seed-runs/after.mp4)
```

GitHub renders the uploaded video as a player. Use a short clip, keep it under 10 MB on a free plan (100 MB on a paid plan), and prefer H.264 MP4 for browser compatibility.

**Fallback:** commit the evidence under `docs/evidence/<slug>/` and link the relative path. That is still GitHub-hosted, but adds the media to the repository. If an upload fails, do not fall back to an external host; commit the file or report the blocker.

## Before and after

- **Visual or presentation change:** capture **before** and **after** at the same viewport (1280×900) and browser context from the production build. Attach both with `gh --attach`; a committed pair goes under `docs/evidence/<slug>/`.
- **New screen or feature with no previous UI:** show the nearest before state (the title or screen without the control) and the after state. If no honest before state exists, say so under **Before:** and show the after plus the test or behaviour that proves the new capability.
- **Gameplay or rules change:** show the failing test and the passing test, or a scripted state diff. Screenshots are optional but useful.
- **Tooling, docs, or CI change:** show before/after command output. A screenshot is not required when there is no visual surface.
- **Performance change:** show before/after measurements from the same scenario.
- Never claim a check that was not run. If the before state cannot be reproduced, explain why and show the closest honest baseline.

## Capture

- Run `npm run build` and `npm run preview`; use an isolated browser context and clear `localStorage` before each state.
- For an old state, use a temporary worktree at the merge-base or previous release. Do not hand-edit the current UI to imitate the old one.
- Keep the viewport, settings, and scenario identical between the two states.
- README screenshots in `docs/screenshots/` are current-state documentation; PR evidence is a separate before/after pair.

## Local check

```bash
PR_BODY="$(gh pr view --json body -q .body)" npm run check:pr-body
```
