import { Player, PlayerTier, PLAYER_TIERS, Team, TIER_SCORE } from './types.js';
import { randomChoice, shuffle } from './utils.js';

const MAX_OPTIMIZE_ITERS = 100;

export function teamCapacities(playerCount: number, teamCount: number): number[] {
  const base = Math.floor(playerCount / teamCount);
  const extra = playerCount % teamCount;
  const caps = Array.from({ length: teamCount }, () => base);
  const extraSlots = shuffle([...Array(teamCount).keys()]).slice(0, extra);
  for (const i of extraSlots) caps[i] = (caps[i] ?? 0) + 1;
  return caps;
}

function countTier(team: Team, tier: PlayerTier): number {
  return team.players.filter((p) => p.tier === tier).length;
}

function pickTeam(teams: Team[], player: Player): Team {
  const eligible = teams.filter((t) => t.players.length < t.maxPlayers);
  const currentTierCounts = eligible.map((t) => countTier(t, player.tier));
  const minTier = Math.min(...currentTierCounts);
  let candidates = eligible.filter((t) => countTier(t, player.tier) === minTier);

  const minScore = Math.min(...candidates.map((t) => t.skillScore));
  candidates = candidates.filter((t) => t.skillScore === minScore);

  const minSize = Math.min(...candidates.map((t) => t.players.length));
  candidates = candidates.filter((t) => t.players.length === minSize);

  return randomChoice(candidates);
}

function skillRange(teams: Team[]): number {
  const scores = teams.map((t) => t.skillScore);
  return Math.max(...scores) - Math.min(...scores);
}

function canSwap(a: Team, b: Team): boolean {
  return a.players.length === b.players.length;
}

function optimize(teams: Team[]): void {
  for (let iter = 0; iter < MAX_OPTIMIZE_ITERS; iter++) {
    let improved = false;
    const current = skillRange(teams);

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const ta = teams[i]!;
        const tb = teams[j]!;
        if (!canSwap(ta, tb)) continue;

        for (let pa = 0; pa < ta.players.length; pa++) {
          for (let pb = 0; pb < tb.players.length; pb++) {
            const playerA = ta.players[pa]!;
            const playerB = tb.players[pb]!;
            if (playerA.tier === playerB.tier) continue;

            const scoreA =
              ta.skillScore - TIER_SCORE[playerA.tier] + TIER_SCORE[playerB.tier];
            const scoreB =
              tb.skillScore - TIER_SCORE[playerB.tier] + TIER_SCORE[playerA.tier];

            const scores = teams.map((t, idx) => {
              if (idx === i) return scoreA;
              if (idx === j) return scoreB;
              return t.skillScore;
            });
            const next = Math.max(...scores) - Math.min(...scores);
            if (next < current) {
              ta.players[pa] = playerB;
              tb.players[pb] = playerA;
              ta.skillScore = scoreA;
              tb.skillScore = scoreB;
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
        if (improved) break;
      }
      if (improved) break;
    }

    if (!improved) break;
  }
}

export function balanceTeams(players: Player[], teamCount: number): Team[] {
  const caps = teamCapacities(players.length, teamCount);
  const teams: Team[] = caps.map((maxPlayers, index) => ({
    index,
    players: [],
    skillScore: 0,
    maxPlayers,
  }));

  const byTier = Object.fromEntries(
    PLAYER_TIERS.map((tier) => [tier, [] as Player[]]),
  ) as Record<PlayerTier, Player[]>;
  for (const p of players) byTier[p.tier].push(p);
  for (const tier of PLAYER_TIERS) byTier[tier] = shuffle(byTier[tier]);

  for (const tier of PLAYER_TIERS) {
    for (const player of byTier[tier]) {
      const team = pickTeam(teams, player);
      team.players.push(player);
      team.skillScore += TIER_SCORE[player.tier];
    }
  }

  optimize(teams);
  return teams;
}
