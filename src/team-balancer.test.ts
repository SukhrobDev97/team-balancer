import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { balanceTeams, teamCapacities } from './team-balancer.js';
import { Player, PlayerTier, PLAYER_TIERS, TIER_SCORE } from './types.js';

function makePlayers(
  specs: Array<{ n: number; tier: PlayerTier }> | number,
  goalkeeperIds: string[] = [],
): Player[] {
  const gk = new Set(goalkeeperIds);
  if (typeof specs === 'number') {
    const n = specs;
    return Array.from({ length: n }, (_, i) => ({
      id: String(i),
      name: `P${i}`,
      tier: PLAYER_TIERS[i % PLAYER_TIERS.length]!,
      isGoalkeeper: gk.has(String(i)),
    }));
  }
  const players: Player[] = [];
  let id = 0;
  for (const { n, tier } of specs) {
    for (let i = 0; i < n; i++) {
      const pid = String(id++);
      players.push({
        id: pid,
        name: `P${id}`,
        tier,
        isGoalkeeper: gk.has(pid),
      });
    }
  }
  return players;
}

function assertInvariants(players: Player[], teamCount: number, runs = 20) {
  for (let r = 0; r < runs; r++) {
    const teams = balanceTeams(players, teamCount);
    assert.equal(teams.length, teamCount);

    const sizes = teams.map((t) => t.players.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);

    const all = teams.flatMap((t) => t.players);
    assert.equal(all.length, players.length);
    const ids = all.map((p) => p.id).sort();
    const expected = players.map((p) => p.id).sort();
    assert.deepEqual(ids, expected);

    for (const t of teams) {
      const expectedScore = t.players.reduce((s, p) => s + TIER_SCORE[p.tier], 0);
      assert.equal(t.skillScore, expectedScore);
      assert.ok(t.players.length <= t.maxPlayers);
    }

    const caps = teams.map((t) => t.maxPlayers);
    assert.equal(caps.reduce((a, b) => a + b, 0), players.length);
  }
}

function maxTierSpread(players: Player[], teamCount: number, tier: PlayerTier) {
  const teams = balanceTeams(players, teamCount);
  const counts = teams.map((t) => t.players.filter((p) => p.tier === tier).length);
  return Math.max(...counts) - Math.min(...counts);
}

describe('teamCapacities', () => {
  it('17 players / 4 teams differ by at most 1', () => {
    const caps = teamCapacities(17, 4);
    assert.equal(caps.reduce((a, b) => a + b, 0), 17);
    assert.ok(Math.max(...caps) - Math.min(...caps) <= 1);
    assert.deepEqual([...caps].sort().reverse(), [5, 4, 4, 4]);
  });
});

describe('balanceTeams', () => {
  it('20 players / 4 teams', () => {
    assertInvariants(makePlayers(20), 4);
  });

  it('17 players / 4 teams', () => {
    assertInvariants(makePlayers(17), 4);
  });

  it('10 players / 2 teams', () => {
    assertInvariants(makePlayers(10), 2);
  });

  it('24 players / 3 teams', () => {
    assertInvariants(makePlayers(24), 3);
  });

  it('many A players are spread', () => {
    const players = makePlayers([
      { n: 8, tier: 'A' },
      { n: 4, tier: 'B' },
      { n: 4, tier: 'C' },
      { n: 4, tier: 'D' },
    ]);
    assertInvariants(players, 4);
    for (let i = 0; i < 15; i++) {
      assert.ok(maxTierSpread(players, 4, 'A') <= 1);
    }
  });

  it('4 A players / 4 teams each get one A', () => {
    const players = makePlayers([
      { n: 4, tier: 'A' },
      { n: 4, tier: 'B' },
      { n: 4, tier: 'C' },
      { n: 4, tier: 'D' },
    ]);
    for (let i = 0; i < 15; i++) {
      const teams = balanceTeams(players, 4);
      for (const t of teams) {
        assert.equal(t.players.filter((p) => p.tier === 'A').length, 1);
      }
    }
  });

  it('6 A players / 4 teams is 2-2-1-1', () => {
    const players = makePlayers([
      { n: 6, tier: 'A' },
      { n: 4, tier: 'B' },
      { n: 4, tier: 'C' },
      { n: 2, tier: 'D' },
    ]);
    assertInvariants(players, 4);
    for (let i = 0; i < 15; i++) {
      const teams = balanceTeams(players, 4);
      const aCounts = teams
        .map((t) => t.players.filter((p) => p.tier === 'A').length)
        .sort((a, b) => b - a);
      assert.deepEqual(aCounts, [2, 2, 1, 1]);
    }
  });

  it('uneven tier distributions', () => {
    const players = makePlayers([
      { n: 1, tier: 'A' },
      { n: 2, tier: 'B' },
      { n: 10, tier: 'C' },
      { n: 4, tier: 'D' },
      { n: 3, tier: 'E' },
    ]);
    assertInvariants(players, 3);
  });

  it('includes E-tier players and spreads them', () => {
    const players = makePlayers([
      { n: 4, tier: 'A' },
      { n: 4, tier: 'B' },
      { n: 4, tier: 'C' },
      { n: 4, tier: 'D' },
      { n: 4, tier: 'E' },
    ]);
    assertInvariants(players, 4);
    for (let i = 0; i < 15; i++) {
      const teams = balanceTeams(players, 4);
      const ePlayers = teams.flatMap((t) => t.players.filter((p) => p.tier === 'E'));
      assert.equal(ePlayers.length, 4);
      const ids = ePlayers.map((p) => p.id).sort();
      assert.deepEqual(ids, ['16', '17', '18', '19']);
      assert.ok(maxTierSpread(players, 4, 'E') <= 1);
      for (const t of teams) {
        assert.equal(t.players.filter((p) => p.tier === 'E').length, 1);
      }
    }
  });
});

function markGoalkeepers(players: Player[], count: number): Player[] {
  return players.map((p, i) => ({
    ...p,
    isGoalkeeper: i < count,
  }));
}

function assertGoalkeeperBalance(
  players: Player[],
  teamCount: number,
  runs = 25,
) {
  const gkTotal = players.filter((p) => p.isGoalkeeper).length;
  for (let r = 0; r < runs; r++) {
    const teams = balanceTeams(players, teamCount);
    const sizes = teams.map((t) => t.players.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);

    const all = teams.flatMap((t) => t.players);
    assert.deepEqual(
      all.map((p) => p.id).sort(),
      players.map((p) => p.id).sort(),
    );

    const gkCounts = teams.map(
      (t) => t.players.filter((p) => p.isGoalkeeper).length,
    );
    assert.equal(
      gkCounts.reduce((a, b) => a + b, 0),
      gkTotal,
    );
    if (gkTotal > 0) {
      assert.ok(
        Math.max(...gkCounts) - Math.min(...gkCounts) <= 1,
        `GK spread too high: ${gkCounts.join('/')}`,
      );
    }

    const scores = teams.map((t) => t.skillScore);
    assert.ok(Math.max(...scores) - Math.min(...scores) <= 6);
  }
}

describe('goalkeeper balance', () => {
  it('20 players / 4 teams / 4 GK', () => {
    assertGoalkeeperBalance(markGoalkeepers(makePlayers(20), 4), 4);
  });

  it('20 players / 4 teams / 6 GK', () => {
    assertGoalkeeperBalance(markGoalkeepers(makePlayers(20), 6), 4);
  });

  it('20 players / 4 teams / 2 GK', () => {
    assertGoalkeeperBalance(markGoalkeepers(makePlayers(20), 2), 4);
  });

  it('18 players / 3 teams / 7 GK', () => {
    assertGoalkeeperBalance(markGoalkeepers(makePlayers(18), 7), 3);
  });

  it('17 players / 4 teams / 4 GK', () => {
    assertGoalkeeperBalance(markGoalkeepers(makePlayers(17), 4), 4);
  });

  it('0 GK keeps prior behavior', () => {
    const players = markGoalkeepers(makePlayers(20), 0);
    assertInvariants(players, 4);
    assertGoalkeeperBalance(players, 4);
  });

  it('reshuffle preserves goalkeeper flags', () => {
    const players = markGoalkeepers(makePlayers(20), 5);
    const flags = Object.fromEntries(
      players.map((p) => [p.id, p.isGoalkeeper]),
    );
    const first = balanceTeams(players, 4);
    const second = balanceTeams(players, 4);
    for (const team of [...first, ...second]) {
      for (const p of team.players) {
        assert.equal(p.isGoalkeeper, flags[p.id]);
      }
    }
    assert.equal(
      players.filter((p) => p.isGoalkeeper).length,
      5,
    );
  });
});
