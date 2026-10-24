# Stage Themes vary arena layout and palette on a seeded four-stage cycle

An Endless Run's Stages currently differ only in rival count and AI scaling: the arena is always the same lattice, so the "endless stages" promise reads as repetition and a shared Seed changes only brick noise. **Stage Themes** give each Stage a recognizable terrain layout and palette, and the theme sequence is reproducible from the run Seed.

Decisions that future readers would otherwise have to guess at:

- **Four themes ship together: Pillar Hall, Brickworks, Crossroads, and Twin Courts.** Pillar Hall is the existing classic lattice and stays the anchor. The other three each bend the layout in a different direction: dense brick kilns, open crossroads, or two chambers joined by doorways.
- **The theme cycle is four Stages long, seeded per cycle, and Pillar Hall opens every cycle.** Stage 1 and every fourth Stage after it are Pillar Hall. The other three Stages use a seeded permutation of the remaining themes. Every cycle shows all four, no two adjacent Stages repeat a theme, and the same Seed reproduces the sequence. A pure random pick could skip a theme for a whole run; a fixed global order would make every run identical.
- **A Stage Theme changes terrain and palette only.** Bombs, blasts, pickups, AI, scoring, upgrades, Techniques, lives, and spawn corners keep their existing rules. Themes are not modifiers, hazards, or difficulty settings.
- **The simulation exposes a theme ID and never a colour.** The render layer owns the palette per theme; the app owns the display name and accent. Actor, blast, and pickup colours stay fixed so hazards never blend into decor, and High Contrast's outlines remain authoritative.
- **Every theme keeps the arena fair and traversable.** The border is solid, all four spawn corners and their orthogonal interior neighbours are clear, every non-wall tile is reachable from the player spawn once bricks are cleared, layout walls are 180° rotationally symmetric, and the hidden power-up guarantee still holds.
- **No profile or Run Record change.** A Run Record already stores its Seed and Stage; replaying the Seed reproduces the theme sequence. Storing a theme would duplicate a derived value and create a migration for no player-facing gain.
- **Theme identity is palette and layout, not new art or audio.** No sprite matrices, samples, fonts, or animations are added; the stage intro names the theme, and the arena shell uses a theme accent.

**Considered Options**: one random theme per Stage (can repeat and skip themes); a fixed global theme order (identical every run); layout variety without palettes (weak identity, easy to miss); palettes over the same lattice (cosmetic); Boss Stages or hazards bundled in (separate rules surfaces, separate slice).

**Consequences**: a new `themes.ts` seam owns definitions and selection; arena generation gains per-theme wall layouts and densities; `StageState` grows a theme ID; the renderer needs one terrain sprite set per theme; the stage intro, How to Play, README, browser checklist, and tests all gain theme coverage. Future themes must preserve the spawn, connectivity, symmetry, density, and power-up invariants.
