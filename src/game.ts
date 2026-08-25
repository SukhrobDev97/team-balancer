import {
  GameSession,
  Language,
  Player,
  PlayerTier,
  PLAYER_TIERS,
  TIER_STARS,
} from './types.js';
import { t } from './i18n.js';
import { remainingSlots } from './utils.js';

export function emptySession(userId: number, language: Language = 'uz'): GameSession {
  return {
    userId,
    language,
    players: [],
    nextPlayerSeq: 1,
    sawTierIntro: false,
    step: 'START',
  };
}

export function resetGame(session: GameSession): void {
  session.playerCount = undefined;
  session.teamCount = undefined;
  session.players = [];
  session.selectedTier = undefined;
  session.selectedPlayerId = undefined;
  session.nextPlayerSeq = 1;
  session.sawTierIntro = false;
  session.listOrigin = undefined;
  session.promptMessageId = undefined;
  session.step = 'PLAYER_COUNT';
}

export function remaining(session: GameSession): number {
  return remainingSlots(session.players.length, session.playerCount ?? 0);
}

export function isComplete(session: GameSession): boolean {
  return (
    session.playerCount != null &&
    session.players.length === session.playerCount &&
    session.playerCount > 0
  );
}

export function addPlayers(
  session: GameSession,
  names: string[],
  tier: PlayerTier,
): { ok: true; added: number } | { ok: false; remaining: number } {
  const left = remaining(session);
  if (names.length === 0 || names.length > left) {
    return { ok: false, remaining: left };
  }
  for (const name of names) {
    session.players.push({
      id: `p${session.nextPlayerSeq++}`,
      name,
      tier,
      isGoalkeeper: false,
    });
  }
  return { ok: true, added: names.length };
}

export function goalkeeperCount(players: Player[]): number {
  return players.filter((p) => p.isGoalkeeper).length;
}

export function toggleGoalkeeper(
  session: GameSession,
  id: string,
): Player | undefined {
  const player = findPlayer(session, id);
  if (!player) return undefined;
  player.isGoalkeeper = !player.isGoalkeeper;
  return player;
}

export function findPlayer(
  session: GameSession,
  id: string,
): Player | undefined {
  return session.players.find((p) => p.id === id);
}

export function removePlayer(session: GameSession, id: string): Player | undefined {
  const i = session.players.findIndex((p) => p.id === id);
  if (i < 0) return undefined;
  const [removed] = session.players.splice(i, 1);
  return removed;
}

export function changePlayerTier(
  session: GameSession,
  id: string,
  tier: PlayerTier,
): { name: string; from: PlayerTier; to: PlayerTier } | undefined {
  const player = findPlayer(session, id);
  if (!player || player.tier === tier) return undefined;
  const from = player.tier;
  player.tier = tier;
  return { name: player.name, from, to: tier };
}

export function markRosterDirty(session: GameSession): void {
  if (session.step === 'FINISHED') session.step = 'TIER_MENU';
}

export function tierCounts(players: Player[]): Record<PlayerTier, number> {
  const counts = Object.fromEntries(PLAYER_TIERS.map((t) => [t, 0])) as Record<
    PlayerTier,
    number
  >;
  for (const p of players) counts[p.tier]++;
  return counts;
}

export function dashboardText(session: GameSession, prefix?: string): string {
  const lang = session.language;
  const total = session.playerCount ?? 0;
  const counts = tierCounts(session.players);
  const left = remaining(session);

  const lines: string[] = [
    t(lang, 'playersProgress', { current: session.players.length, total }),
    t(lang, 'teamsLabel', { count: session.teamCount ?? 0 }),
    t(lang, 'goalkeepersLabel', {
      count: goalkeeperCount(session.players),
    }),
    '',
  ];

  if (!session.sawTierIntro) {
    lines.push(
      t(lang, 'tiersHeader'),
      '',
      `A ${TIER_STARS.A} — ${t(lang, 'tierStrongest')}`,
      `B ${TIER_STARS.B}`,
      `C ${TIER_STARS.C}`,
      `D ${TIER_STARS.D}`,
      `E ${TIER_STARS.E} — ${t(lang, 'tierBeginner')}`,
      '',
      t(lang, 'tierEntry'),
    );
  } else {
    lines.push(
      ...PLAYER_TIERS.map((tier) => `${tier} ${TIER_STARS[tier]}  ${counts[tier]}`),
    );
    if (left > 0) {
      lines.push('', t(lang, 'remainingPlayers', { left }));
    } else {
      lines.push('', t(lang, 'readyState'));
    }
  }

  return prefix ? `${prefix}\n\n${lines.join('\n')}` : lines.join('\n');
}

export function bulkPrompt(lang: Language, tier: PlayerTier): string {
  return [
    t(lang, 'bulkPromptTitle', { tier }),
    '',
    t(lang, 'bulkPromptBody'),
    '',
    t(lang, 'bulkPromptExamples'),
  ].join('\n');
}

export function playerListText(session: GameSession): string {
  const lang = session.language;
  const total = session.playerCount ?? 0;
  const lines = [
    t(lang, 'playerListTitle', {
      current: session.players.length,
      total,
    }),
    '',
  ];
  for (const tier of PLAYER_TIERS) {
    const names = session.players
      .filter((p) => p.tier === tier)
      .map((p) => (p.isGoalkeeper ? `🧤 ${p.name}` : p.name));
    lines.push(`${tier} ${TIER_STARS[tier]}`);
    lines.push(names.length ? names.join(', ') : t(lang, 'emptyList'));
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

export function goalkeeperSelectText(session: GameSession): string {
  const lang = session.language;
  const count = goalkeeperCount(session.players);
  return [
    t(lang, 'goalkeeperSelectTitle'),
    '',
    t(lang, 'goalkeepersSelected', { count }),
    '',
    t(lang, 'goalkeeperSelectHint'),
    t(lang, 'goalkeeperSelectMulti'),
  ].join('\n');
}
