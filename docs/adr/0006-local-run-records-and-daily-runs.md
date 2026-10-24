# Run records and daily runs stay local, with history capped and a local-date seed

Bomb Blitz is a score chase, but the profile remembers only the single best score, the best stage, and a run count. Every other run disappears. The game also has one mode, so there is no recurring reason to return. This slice gives runs a memory and adds a Daily Run that every player can replay on the same arena sequence for their local date.

Decisions that future readers would otherwise have to guess at:

- **Run History is local-only and capped at 20 records.** The profile grows by one record per finished run, newest first. A cap keeps `localStorage` bounded and keeps the Records screen legible. There is no server, account, or shared leaderboard.
- **A Run Record captures the run, not the whole build.** It stores mode, finish time, daily date, score, stage, the four run stats, and the owned techniques. Techniques are the build identity after the technique slice; full upgrade counts would add schema and UI weight without changing how a player reads a past run.
- **The profile key moves to `bomb-blitz.profile.v2`.** v1 is read once when v2 is absent and is left untouched. A malformed v2 falls back to defaults rather than resurrecting v1, so a corrupted new profile cannot silently restore stale bests.
- **A Daily Run is seeded from the player's local calendar date.** The date key is `YYYY-MM-DD` in local time and is hashed to a stable unsigned 32-bit seed. UTC would roll the challenge over at an arbitrary local hour. Changing the device clock changes the challenge; that is accepted because there is no backend and no anti-cheat.
- **Daily Runs are replayable all day and track only the current date's Daily Best.** A static site cannot enforce one attempt without a backend, and this is a casual score chase. The Daily Best is `{ date, score }`; on a new date it starts empty. Older daily runs remain in Run History, but an old best never appears as today's.
- **Daily Runs count toward all-time bests.** They use the same Run rules, so excluding them would make the mode feel second-class and split the profile's definition of "best."
- **The simulation stays mode-agnostic.** The app computes the seed and passes it to the run controller. Nothing in `src/game` knows about dates, modes, or storage.

**Considered Options**: a server-backed global leaderboard (adds a backend and identity to a deliberately static game); one attempt per day enforced locally (trivially bypassed and hostile to a casual game); UTC daily rollover (simple but rolls over at an arbitrary local hour); a single unbounded history (unbounded storage and a noisy screen); persisting full upgrade counts (more schema and UI for little reading value); seed entry and sharing (a separate feature, not needed to prove the daily loop).

**Consequences**: profile schema v2 and a one-way migration; a new Records screen and mode presentation; a pure date-key/daily-seed module that must stay stable across releases; the title, game over, How to Play, README, and browser-verification checklist all gain a mode distinction.
