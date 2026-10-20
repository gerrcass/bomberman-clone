# Deterministic simulation core, renderer as a consumer

All gameplay rules live in a deterministic, fixed-timestep simulation that advances in 1/60th-second ticks. The simulation owns arena state, bombers, bombs, blasts, power-ups, AI decisions, and seeded randomness; it returns events for things that happened. The canvas renderer, audio, and DOM UI read state and consume events but never mutate gameplay. This makes the rules testable without a browser, makes AI and arena generation reproducible from a seed, and lets presentation change freely.

**Considered Options**: rules embedded in render/update callbacks, a component framework driving state, or a server-authoritative model. Those entangle timing with rendering and make deterministic tests and replays much harder.
