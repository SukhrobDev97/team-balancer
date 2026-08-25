import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { balanceTeams, teamCapacities } from './team-balancer.js';
import { Player, PlayerTier, PLAYER_TIERS, TIER_SCORE } from './types.js';

function makePlayers(
  specs: Array<{ n: number; tier: PlayerTier }> | number,
): Player[] {
  if (typeof specs === 'number') {
    const n = specs;
    return Array.from({ length: n }, (_, i) => ({
      id: String(i),
      name: `P${i}`,
      tier: PLAYER_TIERS[i % PLAYER_TIERS.length]!,
    }));
  }
  const players: Player[] = [];
  let id = 0;
  for (const { n, tier } of specs) {
    for (let i = 0; i < n; i++) {
      players.push({ id: String(id++), name: `P${id}`, tier });
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
