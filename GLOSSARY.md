# Bomb Blitz

Bomb Blitz is a browser game in the Bomberman tradition: a single player navigates a maze arena, places bombs, and outlasts AI rivals across an endless run of stages.

## Language

### Arena and terrain

**Arena**:
The fixed 15×13 tile battlefield for one stage.
_Avoid_: Board, map, level

**Tile**:
A single grid cell in the arena.
_Avoid_: Cell, square, block

**Wall**:
An indestructible arena block.
_Avoid_: Rock, hard block, steel

**Brick**:
A destructible arena block that may hide a power-up.
_Avoid_: Crate, soft block, box

### Bombers and hazards

**Bomber**:
An actor that moves through the arena and places bombs. The player and every rival are bombers.
_Avoid_: Character, entity, unit

**Rival**:
An AI-controlled bomber opposing the player.
_Avoid_: Enemy, bot, opponent

**Bomb**:
An explosive placed on a tile, with a fuse and a blast range.
_Avoid_: Mine, explosive

**Fuse**:
The time a bomb waits before detonating.
_Avoid_: Timer, countdown

**Blast**:
The temporary cross-shaped hazard produced by a bomb.
_Avoid_: Explosion, flame, fire

**Chain reaction**:
A bomb detonating because another bomb's blast reached its tile.
_Avoid_: Combo, cascade

**Danger tile**:
A tile predicted to be covered by a blast before it expires.
_Avoid_: Hot tile, threat tile

**Safe tile**:
A reachable tile that is not a danger tile.
_Avoid_: Escape tile, refuge

**Power-up**:
A collectible that improves a bomber's stats. Power-ups are revealed by destroying bricks.
_Avoid_: Pickup, item, bonus

**Shield**:
A power-up charge that absorbs one lethal hit instead of costing a life.
_Avoid_: Armor, health

### The run

**Run**:
One continuous playthrough from stage 1 until the player's lives are exhausted.
_Avoid_: Game, session, campaign

**Stage**:
One arena encounter, cleared by defeating every rival.
_Avoid_: Round, level, wave

**Intermission**:
The between-stage screen where the player chooses one upgrade.
_Avoid_: Shop, draft screen, between-level

**Upgrade**:
A permanent-for-the-run stat improvement chosen during an intermission.
_Avoid_: Perk, boon, card

**Life**:
A respawn credit. Losing the last life ends the run.
_Avoid_: Health, HP, retry

**Spawn corner**:
One of the four arena corners where bombers begin a stage.
_Avoid_: Start point, spawn

**Profile**:
The locally persisted record of high score, best stage, runs played, and settings.
_Avoid_: Save file, account

### Simulation

**Tick**:
One fixed simulation step, 1/60th of a second.
_Avoid_: Frame, update

**Intent**:
A bomber's desired action for a tick: a movement direction and a bomb press.
_Avoid_: Command, input

**Seed**:
The value that makes arena generation and AI tie-breaking reproducible.
_Avoid_: Random number, RNG state

**Score multiplier**:
The factor applied to points earned, increased by upgrades.
_Avoid_: Bonus multiplier, combo
