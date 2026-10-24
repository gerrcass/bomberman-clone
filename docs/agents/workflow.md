# Agent workflow

This repository uses the Matt Pocock engineering skills, installed under `.agents/skills/` and tracked by `skills-lock.json`.

## Ticket flow

- The umbrella spec is issue #1. Its original tickets are sub-issues #2–#9 with native blocking links; they are complete and serve as precedent. The umbrella spec is closed; it remains the project record for the original rules.
- The bomb-techniques slice #11–#15, the run-records slice #17–#21, and the seed-runs slice #23–#28 are closed. New work starts from a new spec issue.
- The latest slice added Seed Runs and Share Links: `src/app/seed.ts` owns Seed Codes and Share Links, `src/app/session.ts` owns Run Mode labels/retry/replay, and the profile key is `bomb-blitz.profile.v3` with one-way v2/v1 migration.
- The Stage Themes slice #33–#36 is the current slice: four seeded Stage Themes, per-theme terrain palettes, and a theme line in the stage intro.
- A ticket is ready when every issue in its `blockedBy.nodes` is closed. Work only the frontier.
- `to-tickets` publishes vertical slices; `implement-spec` runs the frontier, merges to an integration branch, and closes tickets.
- Each ticket is implemented test-first and verified against its acceptance criteria before it is closed.
- A fresh worktree has no `node_modules`; run `npm ci` there before `npm run check`.
- The `implement-spec` orchestrator keeps its turn open while an implementer runs. A subagent that outlives the turn leaves work unmerged; continue the thread and inspect its worktree before spawning anything new.
- A slice ends with one integration PR to `main`, written with the `pr` skill, using GitHub-hosted evidence uploaded with `gh --attach`, and passing the gate in `docs/agents/pr-evidence.md`. After it merges, close the slice spec with a verification comment and remove its worktrees. Closed specs are not reopened; new scope gets a new spec issue.

## Skills

User-invoked skills are loaded by name: `setup-matt-pocock-skills`, `grill-with-docs`, `to-spec`, `to-tickets`, `implement-spec`. Model-invoked helpers such as `tdd`, `code-review`, `domain-modeling`, and `writing-for-agents` may be loaded when the task matches.

To refresh the installed skills, run `npx skills@latest update` inside the repo.
