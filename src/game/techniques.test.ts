import { describe, expect, it } from 'vitest';
import type { Stage } from './stage';
import { createStage, getStageState, tickStage } from './stage';
import { INITIAL_TECHNIQUES, type TechniqueCounts } from './techniques';
import type { Intent, StageEvent } from './types';

/** Room wide enough to place two bombs and step between them. */
const ROOM = ['#########', '#.......#', '#.......#', '#.......#', '#P......#', '#########'];

/** Player and rival approach through a one-row corridor with no escape. */
const CONTACT_CORRIDOR = ['#############', '#P.........R#', '#############'];

const REMOTE: TechniqueCounts = { ...INITIAL_TECHNIQUES, remote: 1 };

function stageFrom(
  rows: readonly string[],
  options: Partial<Parameters<typeof createStage>[0]> = {},
): Stage {
  return createStage({ seed: 1, arena: rows, ...options });
}

function remoteStage(
  rows: readonly string[],
  options: Partial<Parameters<typeof createStage>[0]> = {},
): Stage {
  return stageFrom(rows, { techniques: REMOTE, ...options });
}

function collect(
  stage: Stage,
  ticks: number,
  intent: Intent = {},
): { events: StageEvent[]; states: ReturnType<typeof getStageState>[] } {
  const events: StageEvent[] = [];
  const states: ReturnType<typeof getStageState>[] = [];
  for (let index = 0; index < ticks; index += 1) {
    events.push(...tickStage(stage, intent));
    states.push(getStageState(stage));
  }
  return { events, states };
}

function withoutTick(events: readonly StageEvent[]): Record<string, unknown>[] {
  return events.map((event) => {
    const copy: Record<string, unknown> = { ...event };
    delete copy['tick'];
    return copy;
  });
}

describe('Remote Detonation', () => {
  it('exposes owned techniques in the stage snapshot', () => {
    const state = getStageState(remoteStage(ROOM));

    expect(state.techniques).toEqual(REMOTE);
    expect(getStageState(stageFrom(ROOM)).techniques).toEqual(INITIAL_TECHNIQUES);
  });

  it('detonates every live player bomb on a press, including same-tick placement', () => {
    const stage = remoteStage(ROOM, { bombCapacity: 2 });

    const placedSameTick = tickStage(stage, { bomb: true, detonate: true });

    expect(placedSameTick.filter((event) => event.type === 'bomb-placed')).toEqual([
      {
        type: 'bomb-placed',
        tick: 1,
        bombId: 1,
        tile: { x: 1, y: 4 },
        owner: 'player',
        fuseTicks: 132,
        range: 1,
      },
    ]);
    expect(placedSameTick.filter((event) => event.type === 'bomb-detonated')).toEqual([
      {
        type: 'bomb-detonated',
        tick: 1,
        bombId: 1,
        tile: { x: 1, y: 4 },
        owner: 'player',
        range: 1,
        chain: false,
      },
    ]);
    expect(placedSameTick.some((event) => event.type === 'blast-started')).toBe(true);
    expect(getStageState(stage).bombs).toHaveLength(0);

    // A second bomb placed after the first press, then both live bombs are
    // queued together by one press.
    const now = remoteStage(ROOM, { bombCapacity: 2 });
    tickStage(now, { bomb: true });
    for (let index = 0; index < 30; index += 1) {
      tickStage(now, { direction: 'right' });
    }
    tickStage(now, { bomb: true });

    const before = getStageState(now);
    expect(before.bombs).toHaveLength(2);
    const bombIds = before.bombs.map((bomb) => bomb.id);
    const bombTiles = before.bombs.map((bomb) => bomb.tile);

    const events = tickStage(now, { detonate: true });
    const after = getStageState(now);

    expect(after.bombs).toHaveLength(0);
    const detonations = events.filter((event) => event.type === 'bomb-detonated');
    expect(detonations.map((event) => event.bombId)).toEqual(bombIds);
    expect(detonations.map((event) => event.tile)).toEqual(bombTiles);
    expect(detonations.every((event) => event.chain === false)).toBe(true);
    expect(events.filter((event) => event.type === 'blast-started')).toHaveLength(2);
  });

  it('leaves the fuse running and lets an untriggered bomb detonate on time', () => {
    const stage = remoteStage(ROOM, { fuseMs: 1000 });

    tickStage(stage, { bomb: true });
    const countdown = collect(stage, 59);
    const oneTickLeft = countdown.states.at(-1);

    expect(oneTickLeft?.tick).toBe(60);
    expect(oneTickLeft?.bombs).toHaveLength(1);
    expect(oneTickLeft?.bombs[0]?.fuseRemainingTicks).toBe(1);
    expect(countdown.events.some((event) => event.type === 'bomb-detonated')).toBe(false);

    const expiry = collect(stage, 1);
    expect(expiry.states[0]?.tick).toBe(61);
    expect(expiry.states[0]?.bombs).toHaveLength(0);
    expect(expiry.events).toContainEqual({
      type: 'bomb-detonated',
      tick: 61,
      bombId: 1,
      tile: { x: 1, y: 4 },
      owner: 'player',
      range: 1,
      chain: false,
    });
  });

  it('keeps the Short Fuse duration while Remote Detonation is owned', () => {
    const stage = remoteStage(ROOM, { fuseMs: 1400 });

    tickStage(stage, { bomb: true });
    expect(getStageState(stage).bombs[0]?.fuseTicks).toBe(84);

    const countdown = collect(stage, 83);
    expect(countdown.states.at(-1)?.tick).toBe(84);
    expect(countdown.states.at(-1)?.bombs[0]?.fuseRemainingTicks).toBe(1);

    const expiry = collect(stage, 1);
    expect(expiry.states[0]?.tick).toBe(85);
    expect(expiry.states[0]?.bombs).toHaveLength(0);
    expect(expiry.events.some((event) => event.type === 'bomb-detonated')).toBe(true);
  });

  it('resolves a remote detonation with the same events as a fuse detonation', () => {
    const remote = remoteStage(ROOM);
    const remoteEvents: StageEvent[] = [...tickStage(remote, { bomb: true })];
    remoteEvents.push(...tickStage(remote, { detonate: true }));

    const fused = stageFrom(ROOM);
    const fuseEvents: StageEvent[] = [...tickStage(fused, { bomb: true })];
    fuseEvents.push(...collect(fused, 132).events);

    expect(withoutTick(remoteEvents)).toEqual(withoutTick(fuseEvents));
    expect(new Set(remoteEvents.map((event) => event.type))).toEqual(
      new Set(['bomb-placed', 'bomb-detonated', 'blast-started', 'player-hit', 'life-lost']),
    );
  });

  it('chain-detonates a rival bomb reached by the remote blast', () => {
    const stage = createStage({
      seed: 1,
      stage: 1,
      arena: [
        '##########',
        '#........#',
        '#.RB.....#',
        '#........#',
        '#........#',
        '#........#',
        '#........#',
        '#P.......#',
        '##########',
      ],
      rivalCount: 1,
      rivalSpawns: [{ x: 2, y: 2 }],
      techniques: REMOTE,
      blastRange: 4,
      fuseMs: 10000,
    });

    // Cinder opens by bombing the brick beside its spawn, so the rival bomb is
    // at (2,2) by the time the player reaches the same column.
    for (let index = 0; index < 20; index += 1) {
      tickStage(stage, {});
    }
    const rivalBomb = getStageState(stage).bombs.find((bomb) => bomb.owner === 'cinder');
    expect(rivalBomb?.tile).toEqual({ x: 2, y: 2 });

    const target = { x: 2, y: 6 };
    for (let index = 0; index < 120; index += 1) {
      const player = getStageState(stage).player;
      if (!player.moving && player.tile.x === target.x && player.tile.y === target.y) {
        break;
      }
      const at = player.moving ? player.to : player.tile;
      const direction: 'up' | 'right' | null =
        at.y > target.y ? 'up' : at.x < target.x ? 'right' : null;
      tickStage(stage, { direction });
    }
    expect(getStageState(stage).player.tile).toEqual(target);

    const events = tickStage(stage, { bomb: true, detonate: true });
    const detonations = events.filter((event) => event.type === 'bomb-detonated');

    expect(detonations).toContainEqual(expect.objectContaining({ owner: 'player', chain: false }));
    expect(detonations).toContainEqual(expect.objectContaining({ owner: 'cinder', chain: true }));
    expect(getStageState(stage).bombs).toHaveLength(0);
  });

  it('does nothing when Remote Detonation is not owned', () => {
    const stage = stageFrom(ROOM, { bombCapacity: 2 });

    tickStage(stage, { bomb: true });
    for (let index = 0; index < 30; index += 1) {
      tickStage(stage, { direction: 'right' });
    }
    tickStage(stage, { bomb: true });

    const events = tickStage(stage, { detonate: true });
    const state = getStageState(stage);

    expect(state.bombs).toHaveLength(2);
    expect(state.blasts).toHaveLength(0);
    expect(events).toEqual([]);
  });

  it('does nothing while the player is dead', () => {
    const stage = remoteStage(CONTACT_CORRIDOR, {
      rivalCount: 1,
      rivalSpawns: [{ x: 11, y: 1 }],
      fuseMs: 10000,
    });

    tickStage(stage, { bomb: true });
    for (let index = 0; index < 300 && getStageState(stage).player.alive; index += 1) {
      tickStage(stage, { direction: 'right' });
    }

    const dead = getStageState(stage);
    expect(dead.player.alive).toBe(false);
    expect(dead.bombs.filter((bomb) => bomb.owner === 'player')).toHaveLength(1);

    const events = tickStage(stage, { detonate: true });
    const after = getStageState(stage);

    expect(after.player.alive).toBe(false);
    expect(after.bombs.filter((bomb) => bomb.owner === 'player')).toHaveLength(1);
    expect(
      events.filter((event) => event.type === 'bomb-detonated' && event.owner === 'player'),
    ).toEqual([]);
  });

  it('replays identical states for the same seed and remote intent script', () => {
    const runScript = (stage: Stage): { events: StageEvent[]; state: StageStateSnapshot } => {
      const events: StageEvent[] = [];
      for (let index = 0; index < 180; index += 1) {
        const direction = index < 40 ? 'right' : index % 45 === 0 ? 'left' : null;
        const bomb = index === 0 || index === 40;
        const detonate = index === 60;
        events.push(...tickStage(stage, { direction, bomb, detonate }));
      }
      return { events, state: getStageState(stage) };
    };

    const first = remoteStage(ROOM, { bombCapacity: 2 });
    const second = remoteStage(ROOM, { bombCapacity: 2 });

    const firstRun = runScript(first);
    const secondRun = runScript(second);

    expect(firstRun.events).toEqual(secondRun.events);
    expect(firstRun.state).toEqual(secondRun.state);
    expect(firstRun.state.tick).toBe(180);
    expect(firstRun.events.filter((event) => event.type === 'bomb-detonated')).toHaveLength(2);
  });
});

type StageStateSnapshot = ReturnType<typeof getStageState>;
