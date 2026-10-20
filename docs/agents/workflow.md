# Agent workflow

This repository uses the Matt Pocock engineering skills, installed under `.agents/skills/` and tracked by `skills-lock.json`.

## Ticket flow

- The spec is issue #1. Its tickets are sub-issues #2–#9 with native blocking links.
- A ticket is ready when every issue in its `blockedBy` list is closed.
- `to-tickets` publishes vertical slices; `implement-spec` runs the frontier, merges to an integration branch, and closes tickets.
- Each ticket is implemented test-first and verified against its acceptance criteria before it is closed.

## Skills

User-invoked skills are loaded by name: `setup-matt-pocock-skills`, `grill-with-docs`, `to-spec`, `to-tickets`, `implement-spec`. Model-invoked helpers such as `tdd`, `code-review`, `domain-modeling`, and `writing-for-agents` may be loaded when the task matches.

To refresh the installed skills, run `npx skills@latest update` inside the repo.
