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

function countGoalkeepers(team: Team): number {
  return team.players.filter((p) => p.isGoalkeeper).length;
}

function pickTeam(teams: Team[], player: Player): Team {
  const eligible = teams.filter((t) => t.players.length < t.maxPlayers);
  let candidates = eligible;

  if (player.isGoalkeeper) {
    const minGk = Math.min(...candidates.map(countGoalkeepers));
    candidates = candidates.filter((t) => countGoalkeepers(t) === minGk);
  }

  const minTier = Math.min(...candidates.map((t) => countTier(t, player.tier)));
  candidates = candidates.filter((t) => countTier(t, player.tier) === minTier);

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

export function goalkeeperRange(teams: Team[]): number {
  const counts = teams.map(countGoalkeepers);
  return Math.max(...counts) - Math.min(...counts);
}

function optimize(teams: Team[]): void {
  for (let iter = 0; iter < MAX_OPTIMIZE_ITERS; iter++) {
    let improved = false;
    const currentGk = goalkeeperRange(teams);
    const currentSkill = skillRange(teams);

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const ta = teams[i]!;
        const tb = teams[j]!;

        for (let pa = 0; pa < ta.players.length; pa++) {
          for (let pb = 0; pb < tb.players.length; pb++) {
            const playerA = ta.players[pa]!;
            const playerB = tb.players[pb]!;
            if (
              playerA.tier === playerB.tier &&
              playerA.isGoalkeeper === playerB.isGoalkeeper
            ) {
              continue;
            }

            const scoreA =
              ta.skillScore - TIER_SCORE[playerA.tier] + TIER_SCORE[playerB.tier];
            const scoreB =
              tb.skillScore - TIER_SCORE[playerB.tier] + TIER_SCORE[playerA.tier];

            const scores = teams.map((t, idx) => {
              if (idx === i) return scoreA;
              if (idx === j) return scoreB;
              return t.skillScore;
            });
            const nextSkill = Math.max(...scores) - Math.min(...scores);

            const gkCounts = teams.map((t, idx) => {
              if (idx === i) {
                return (
                  countGoalkeepers(t) -
                  (playerA.isGoalkeeper ? 1 : 0) +
                  (playerB.isGoalkeeper ? 1 : 0)
                );
              }
              if (idx === j) {
                return (
                  countGoalkeepers(t) -
                  (playerB.isGoalkeeper ? 1 : 0) +
                  (playerA.isGoalkeeper ? 1 : 0)
                );
              }
              return countGoalkeepers(t);
            });
            const nextGk = Math.max(...gkCounts) - Math.min(...gkCounts);

            const better =
              nextGk < currentGk ||
              (nextGk === currentGk && nextSkill < currentSkill);

            if (better) {
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
