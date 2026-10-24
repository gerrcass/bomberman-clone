# Bomb Blitz

Bomb Blitz is a browser Bomberman clone: a single-player, endless arena run of maze combat against AI rivals. It is a Vite + strict TypeScript + Canvas 2D app with a deterministic simulation, runtime-generated pixel art, synthesized audio, and no backend.

## Start here

- **Live game**: https://gerrcass.github.io/bomberman-clone/
- **Spec**: [issue #1](https://github.com/gerrcass/bomberman-clone/issues/1) is the source of truth for rules, balance, scope, and testing. The latest completed slice is #17, **Run records and the Daily Run**. The active slice is #23, **Seed Runs and Share Links**, with tickets #24–#28.
- **Tickets**: `gh issue list --state open --json number,title,blockedBy` describes the task graph. Work only the frontier: a ticket whose blockers are all closed.
- **Vocabulary**: `GLOSSARY.md`. Use its terms in code, tests, tickets, and comments.
- **Decisions**: `docs/adr/`. Read the ADRs that touch the area before changing it; surface conflicts rather than silently overriding them.
- **Tracker, domain, and triage rules**: `docs/agents/`.
- **Browser checks**: `docs/agents/browser-verification.md` before reporting presentation work done.

The original build (#2–#9), the bomb-techniques slice (#11–#15), and the run-records slice (#17–#21) are complete and deployed. Treat those closed tickets and the ADRs as precedent for new work. Leave #1 open as the umbrella spec.

## Workflow

Use the installed `implement-spec` skill for multi-ticket work. For a single ticket:

1. Claim it with `gh issue edit <number> --add-assignee @me`.
2. Build it test-first with the `tdd` skill.
3. Keep the integration branch tip merged into your branch before reporting done.
4. Verify every acceptance criterion, then close the ticket with a comment naming the verification.
5. Leave the umbrella spec #1 open; close a slice spec only after all its tickets and its PR are done.

Do not start a ticket whose blockers are open. Do not modify or close #1.

One agent owns a worktree at a time. Before committing or merging, run `git status` and `git log -1`; another session's edits can land in a shared checkout.

## Architecture

- `src/game/` — deterministic simulation and run rules. No DOM, Canvas, or Web Audio imports. Fixed 1/60-second ticks; seeded randomness; the public simulation/run API is the test seam.
- `src/render/` — Canvas renderer, sprites, and effects. Reads state and events; never mutates gameplay.
- `src/audio/` — synthesized Web Audio. Reads events and settings.
- `src/app/` — browser shell: loop, input, screens, persistence, and UI wiring.
- Tests live beside game modules and use ASCII arena fixtures.

See `docs/agents/architecture.md` for module ownership and invariants.

## Commands

These are established by ticket 01 and must stay working:

```bash
npm run dev        # local dev server
npm run build      # production static build
npm run preview    # serve the production build
npm run test       # Vitest, single run
npm run typecheck  # tsc --noEmit
npm run lint       # Biome check
npm run format     # Biome write
npm run check      # lint + typecheck + test + build
```

## Conventions

- Speak the glossary: **Bomber**, **Rival**, **Tile**, **Blast**, **Stage**, **Run**, **Endless Run**, **Daily Run**, **Run Record**, **Run History**, **Intermission**, **Upgrade**, **Technique**.
- Every gameplay change needs a test at the simulation or run seam. Renderer tests are not a substitute.
- Gameplay randomness comes from the seeded generator. `Math.random()` stays out of `src/game/`. A Daily Run seed comes from the pure local-date helper, not from the wall clock inside the simulation.
- Nothing is fetched at runtime. Art is generated from pixel matrices, audio is synthesized, and only a bundled display font is packaged.
- Strict TypeScript. Avoid `any`; when a browser boundary truly needs it, keep the cast narrow and explain why.
- No DOM or canvas work inside the simulation, and no per-tick allocation spikes.
- Every screen and action stays keyboard-reachable and keyboard-operable.
- Honor Reduced Motion and High Contrast preferences in every new visual.

## Gotchas

- The arena is 15 wide by 13 tall; x runs 0–14 and y runs 0–12.
- A technique is player-only and run-scoped; rival bombs keep classic geometry.
- A bomb placed mid-step goes on the tile being left, never the destination.
- A rival occupies `movement.to` for hazards. A decision based only on `movement.from` walks rivals into fresh blasts.
- A blast destroys the first brick and stops unless the bomb is piercing; it does not destroy revealed power-ups.
- Losing the last life ends the run even if the last rival dies in the same tick.
- The game auto-pauses when the document becomes hidden and resumes paused.
- Walls stop blast rays without producing a blast tile.
- Profile v2 is authoritative once present. The v1 key is a read-only migration source; a malformed v2 falls back to defaults rather than resurrecting v1.
- Profile v3 is authoritative once present. v2 is read once when v3 is absent; v1 is read only when both are absent. Migrated records have no Seed and offer no replay. Old keys are never written.
- Every new Run Record stores its Seed. A Seed Run is a Run Mode, not a gameplay modifier; the simulation still receives only a Seed and never learns the mode, date, Seed Code, or Share Link.
- A Seed Code is uppercase base36, 1–7 characters, and maps to an unsigned 32-bit Seed. The same Seed reproduces arenas and draft offers, not the player's inputs.
- Run History is local, newest-first, and capped at 20. A finished run records once; a daily run also updates the current date's Daily Best.

## Quality bar

A ticket is done when every acceptance criterion is verified, new behavior is covered by tests, `npm run check`, `npm run test`, and `npm run build` pass, and presentation or feel changes have been verified with `docs/agents/browser-verification.md`.
