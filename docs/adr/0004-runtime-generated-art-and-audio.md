# Art and audio generated at runtime

All visuals are pixel-art sprites defined as character matrices in TypeScript and painted into offscreen canvases at startup; all sound effects and music are synthesized with the Web Audio API. Nothing is fetched at runtime. The only bundled third-party asset is an OFL pixel display font for UI headings, packaged at build time. This keeps the bundle self-contained, gives the game a consistent pixel-art identity, and lets palettes and animations live in code alongside the rules that trigger them.

**Considered Options**: stock sprite sheets, commissioned art, or sampled audio. Runtime generation avoids asset licensing and loading failure modes and is sufficient for a 15×13 arena with a small cast of characters.
