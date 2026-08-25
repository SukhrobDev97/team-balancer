import {
  GameSession,
  Player,
  PlayerTier,
  PLAYER_TIERS,
  TIER_STARS,
} from './types.js';
import { remainingSlots } from './utils.js';

export function emptySession(userId: number): GameSession {
  return {
    userId,
    players: [],
    nextPlayerSeq: 1,
    sawTierIntro: false,
    step: 'PLAYER_COUNT',
  };
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
    });
  }
  return { ok: true, added: names.length };
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
  const total = session.playerCount ?? 0;
  const counts = tierCounts(session.players);
  const left = remaining(session);

  const lines: string[] = [
    `👥 O'yinchilar: ${session.players.length} / ${total}`,
    `⚽ Jamoalar: ${session.teamCount ?? 0}`,
    '',
  ];

  if (!session.sawTierIntro) {
    lines.push(
      'Darajalar:',
      '',
      `A ${TIER_STARS.A} — eng kuchli`,
      `B ${TIER_STARS.B}`,
      `C ${TIER_STARS.C}`,
      `D ${TIER_STARS.D}`,
      `E ${TIER_STARS.E} — boshlovchi`,
      '',
      "Darajani tanlab o'yinchilarni qo'shing:",
    );
  } else {
    lines.push(
      ...PLAYER_TIERS.map((t) => `${t} ${TIER_STARS[t]}  ${counts[t]}`),
    );
    if (left > 0) {
      lines.push('', `Yana ${left} ta o'yinchi kerak.`);
    } else {
      lines.push('', "✅ Hammasi tayyor. Jamoalarni tuzing.");
    }
  }

  return prefix ? `${prefix}\n\n${lines.join('\n')}` : lines.join('\n');
}

export function bulkPrompt(tier: PlayerTier): string {
  return [
    `⭐ ${tier} daraja`,
    '',
    "O'yinchilarni bitta xabarda yozing:",
    '',
    'Sardor',
    'Aziz',
    'Jasur',
  ].join('\n');
}

export function playerListText(session: GameSession): string {
  const total = session.playerCount ?? 0;
  const lines = [
    `👥 O'yinchilar — ${session.players.length} / ${total}`,
    '',
  ];
  for (const tier of PLAYER_TIERS) {
    const names = session.players
      .filter((p) => p.tier === tier)
      .map((p) => p.name);
    lines.push(`${tier} ${TIER_STARS[tier]}`);
    lines.push(names.length ? names.join(', ') : '—');
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
