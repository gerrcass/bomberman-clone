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

**Technique**:
A run-scoped upgrade that changes how the player's bombs behave rather than improving a stat. Each technique is owned at most once per run.
_Avoid_: Perk, ability, modifier, item

**Bomb Kick**:
A technique that lets the player push a resting bomb by walking into it. The bomb slides until terrain, another bomb, or a bomber blocks it.
_Avoid_: Push, shove, kick

**Remote Detonation**:
A technique that lets the player detonate their own live bombs before their fuse runs out. The fuse still runs and still detonates the bomb on its own.
_Avoid_: Detonator, manual bomb, trigger

**Piercing Blast**:
A technique whose blasts destroy every brick in range instead of stopping at the first.
_Avoid_: Drill bomb, power blast, strong blast

### The run

**Run**:
One continuous playthrough from stage 1 until the player's lives are exhausted.
_Avoid_: Game, session, campaign

**Endless Run**:
The default Run, seeded from a fresh value and unconnected to the calendar.
_Avoid_: Normal run, classic run, main mode

**Daily Run**:
A Run whose seed comes from the player's local calendar date, so the same date gives the same run. The Run rules are unchanged.
_Avoid_: Daily challenge, daily mode, seeded run

**Daily Best**:
The highest score recorded for the current local date's Daily Run.
_Avoid_: Daily high score, daily record

**Run Record**:
The saved summary of one finished Run: its mode, finish time, score, stage, statistics, and owned techniques.
_Avoid_: History entry, result, log

**Run History**:
The newest-first list of Run Records on the Profile, capped at 20.
_Avoid_: Run log, match history, archive

**Run Mode**:
Whether a Run is an Endless Run or a Daily Run.
_Avoid_: Game type, challenge type

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
