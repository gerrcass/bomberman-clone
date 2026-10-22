# Bomb techniques are player-only, one-per-draft, and captured per bomb

The intermission draft offers stat improvements only, so every run converges on the same build and the draft stops being a decision. Bomb techniques fix that by changing how the player's bombs behave for the rest of the run. Three techniques ship together: **Bomb Kick**, **Remote Detonation**, and **Piercing Blast**.

Decisions that future readers would otherwise have to guess at:

- **Techniques are player-only.** Rivals keep classic bombs, so their blast geometry stays predictable and the AI's danger map stays honest. Giving rivals techniques would multiply the AI's failure modes for a payoff the player never sees clearly.
- **At most one technique card appears per intermission, and each technique is owned once.** Techniques do not compete with stat cards in one pool. The reserved slot guarantees every run meets a technique early; the one-per-run cap keeps them from crowding out the stat curve that carries the endless stages.
- **A bomb captures its technique flags at placement.** Pierce and remote eligibility live on the bomb, not on the owner. A live bomb never changes behaviour retroactively, and the snapshot the renderer and AI read is self-contained.
- **Remote Detonation adds early detonation; it does not remove the fuse.** The fuse still counts down and still detonates the bomb. Without that, Short Fuse would become dead weight and the player would lose all time pressure.
- **A kicked bomb occupies the tile it is sliding into.** The tile it left is free immediately, so the kicker can follow it. The alternative — blocking the origin until the slide completes — makes kicking feel like walking into glue.

**Considered Options**: a single general pool where techniques compete with stats (dilutes both and makes technique acquisition luck-dependent); fuse-less remote bombs (nullifies Short Fuse); rival techniques (AI cost, unreadable geometry); kicking only your own bombs (loses the defensive play of shoving a rival's bomb away).

**Consequences**: stage state grows to carry technique flags and sliding-bomb motion; the AI danger map must mirror pierce geometry and track moving bombs at their effective tile; the HUD and intermission need to make an owned technique legible; balance is tunable in one place because the draft rule owns technique frequency.
