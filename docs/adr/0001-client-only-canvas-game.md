# Client-only browser game on Canvas 2D

Bomb Blitz ships as a static browser application built with Vite, strict TypeScript, and the Canvas 2D API. There is no backend, no accounts, and no framework: the game loop and UI live entirely in the client, and progress is persisted in `localStorage`. This keeps deployment to a static host trivial and keeps the full game state available to a deterministic simulation.

**Considered Options**: React plus a game library, Phaser, a networked server-authoritative design. All three add surface area without solving a problem this game has: the arena has tens of tiles, not thousands of entities, and there is no online play.
