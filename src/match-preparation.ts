import { balanceTeams } from './team-balancer.js';
import {
  MatchParticipant,
  MatchSession,
  MAX_TEAMS,
  MIN_PER_TEAM,
  MIN_TEAMS,
  Player,
  PLAYER_TIERS,
  PlayerTier,
  Team,
  TeamPreparation,
  TeamSetupToken,
  TIER_STARS,
} from './types.js';
import { generateShortId, isOrganizer } from './match.js';
import { validTeamCounts } from './utils.js';

export const TEAM_SETUP_TOKEN_TTL_MS = 20 * 60 * 1000;
export const MIN_TEAM_PREP_PLAYERS = 4;
export const TEAM_EMOJIS = ['🔵', '🔴', '🟢', '🟡', '🟣'];

export const teamSetupTokens = new Map<string, TeamSetupToken>();

export function participantPlayerId(telegramId: number): string {
  return `t${telegramId}`;
}

export function sortedParticipants(match: MatchSession): MatchParticipant[] {
  return [...match.participants].sort((a, b) => a.joinedAt - b.joinedAt);
}

export function isAttendanceLocked(match: MatchSession): boolean {
  return match.teamPreparation?.locked === true;
}

export type PrepStartResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'wrong_status' | 'too_few' | 'not_organizer' };

export function canStartTeamPreparation(
  match: MatchSession,
  organizerId: number,
): PrepStartResult {
  if (!isOrganizer(match, organizerId)) {
    return { ok: false, reason: 'not_organizer' };
  }
  if (match.status === 'CANCELLED') {
    return { ok: false, reason: 'cancelled' };
  }
  if (match.status !== 'FULL' && match.status !== 'CLOSED') {
    return { ok: false, reason: 'wrong_status' };
  }
  if (match.participants.length < MIN_TEAM_PREP_PLAYERS) {
    return { ok: false, reason: 'too_few' };
  }
  return { ok: true };
}

export function beginTeamPreparation(match: MatchSession): TeamPreparation {
  if (!match.teamPreparation) {
    match.teamPreparation = { locked: true, ratings: {} };
  } else {
    match.teamPreparation.locked = true;
  }
  return match.teamPreparation;
}

export function ensureTeamPreparation(match: MatchSession): TeamPreparation {
  if (!match.teamPreparation) {
    match.teamPreparation = { locked: false, ratings: {} };
  }
  return match.teamPreparation;
}

export function cleanupExpiredTeamSetupTokens(now = Date.now()): void {
  for (const [token, entry] of teamSetupTokens) {
    if (now - entry.createdAt > TEAM_SETUP_TOKEN_TTL_MS) {
      teamSetupTokens.delete(token);
    }
  }
}

export function createTeamSetupToken(
  matchId: string,
  organizerTelegramId: number,
  now = Date.now(),
): TeamSetupToken {
  cleanupExpiredTeamSetupTokens(now);
  let token: string;
  do {
    token = generateShortId(8);
  } while (teamSetupTokens.has(token));

  const entry: TeamSetupToken = {
    token,
    matchId,
    organizerTelegramId,
    createdAt: now,
  };
  teamSetupTokens.set(token, entry);
  return entry;
}

export type TeamSetupTokenValidation =
  | { ok: true; entry: TeamSetupToken }
  | { ok: false; reason: 'not_found' | 'expired' | 'wrong_user' };

export function validateTeamSetupToken(
  token: string,
  userId: number,
  now = Date.now(),
): TeamSetupTokenValidation {
  const entry = teamSetupTokens.get(token);
  if (!entry) {
    cleanupExpiredTeamSetupTokens(now);
    return { ok: false, reason: 'not_found' };
  }
  if (now - entry.createdAt > TEAM_SETUP_TOKEN_TTL_MS) {
    teamSetupTokens.delete(token);
    cleanupExpiredTeamSetupTokens(now);
    return { ok: false, reason: 'expired' };
  }
  cleanupExpiredTeamSetupTokens(now);
  if (entry.organizerTelegramId !== userId) {
    return { ok: false, reason: 'wrong_user' };
  }
  return { ok: true, entry };
}

export function getRating(
  match: MatchSession,
  telegramId: number,
): PlayerTier | undefined {
  return match.teamPreparation?.ratings[participantPlayerId(telegramId)];
}

export function setRating(
  match: MatchSession,
  telegramId: number,
  tier: PlayerTier,
): void {
  const prep = ensureTeamPreparation(match);
  prep.ratings[participantPlayerId(telegramId)] = tier;
}

export function getNextUnratedParticipant(
  match: MatchSession,
): MatchParticipant | undefined {
  const prep = match.teamPreparation;
  if (!prep) return sortedParticipants(match)[0];
  return sortedParticipants(match).find(
    (p) => prep.ratings[participantPlayerId(p.telegramId)] == null,
  );
}

export function ratedCount(match: MatchSession): number {
  const prep = match.teamPreparation;
  if (!prep) return 0;
  return sortedParticipants(match).filter(
    (p) => prep.ratings[participantPlayerId(p.telegramId)] != null,
  ).length;
}

export function allParticipantsRated(match: MatchSession): boolean {
  return ratedCount(match) === match.participants.length;
}

export function ratingTierCounts(
  match: MatchSession,
): Record<PlayerTier, number> {
  const counts = Object.fromEntries(PLAYER_TIERS.map((t) => [t, 0])) as Record<
    PlayerTier,
    number
  >;
  const prep = match.teamPreparation;
  if (!prep) return counts;
  for (const tier of Object.values(prep.ratings)) {
    counts[tier]++;
  }
  return counts;
}

export function participantsToPlayers(match: MatchSession): Player[] {
  const prep = match.teamPreparation!;
  return sortedParticipants(match).map((p) => ({
    id: participantPlayerId(p.telegramId),
    name: p.displayName,
    tier: prep.ratings[participantPlayerId(p.telegramId)]!,
    isGoalkeeper: false,
  }));
}

export function validMatchTeamCounts(match: MatchSession): number[] {
  return validTeamCounts(
    match.participants.length,
    MIN_TEAMS,
    MAX_TEAMS,
    MIN_PER_TEAM,
  );
}

export function isValidMatchTeamCount(
  match: MatchSession,
  teamCount: number,
): boolean {
  return validMatchTeamCounts(match).includes(teamCount);
}

export function generateTeamsForMatch(match: MatchSession): Team[] | undefined {
  const prep = match.teamPreparation;
  if (!prep || !allParticipantsRated(match) || prep.teamCount == null) {
    return undefined;
  }
  if (!isValidMatchTeamCount(match, prep.teamCount)) {
    return undefined;
  }
  const players = participantsToPlayers(match);
  const teams = balanceTeams(players, prep.teamCount);
  prep.generatedTeams = teams;
  return teams;
}

export function getGeneratedTeams(match: MatchSession): Team[] | undefined {
  return match.teamPreparation?.generatedTeams;
}

export function formatBalanceLabel(diff: number): string {
  if (diff <= 1) return "⚖️ Balans: A'lo";
  if (diff === 2) return '⚖️ Balans: Yaxshi';
  return '⚖️ Balans: Imkon qadar tenglashtirildi';
}

export function teamSkillDiff(teams: Team[]): number {
  const scores = teams.map((t) => t.skillScore);
  return Math.max(...scores) - Math.min(...scores);
}

export function formatPrepStartText(match: MatchSession): string {
  return [
    `⚽ ${match.dateLabel} — ${match.time}`,
    `📍 ${match.location}`,
    `👥 ${match.participants.length} o'yinchi`,
    '',
    'O\'yinchilar darajasini belgilang.',
  ].join('\n');
}

export function formatRatingPrompt(
  match: MatchSession,
  participant: MatchParticipant,
): string {
  const total = match.participants.length;
  const order = sortedParticipants(match);
  const index = order.findIndex((p) => p.telegramId === participant.telegramId);
  return [
    `${index + 1} / ${total}`,
    '',
    `👤 ${participant.displayName}`,
    '',
    'Darajasini tanlang:',
  ].join('\n');
}

export function formatRatingSummary(match: MatchSession): string {
  const total = match.participants.length;
  const counts = ratingTierCounts(match);
  const lines = [
    `✅ ${total} / ${total} baholandi`,
    '',
    ...PLAYER_TIERS.map((t) => `${t} — ${counts[t]}`),
  ];
  return lines.join('\n');
}

export function formatRatingReview(match: MatchSession): string {
  const order = sortedParticipants(match);
  const prep = match.teamPreparation!;
  const lines = order.map((p, i) => {
    const tier = prep.ratings[participantPlayerId(p.telegramId)]!;
    return `${i + 1}. ${p.displayName} — ${tier}`;
  });
  return lines.join('\n');
}

export function formatPrivateTeamPreview(match: MatchSession, teams: Team[]): string {
  const diff = teamSkillDiff(teams);
  const blocks = teams.map((team, i) => {
    const emoji = TEAM_EMOJIS[i] ?? '⚪';
    const lines = team.players.map((p) => `${p.name} · ${p.tier}`);
    return [`${emoji} JAMOA ${i + 1}`, ...lines].join('\n');
  });
  return [
    '⚽ JAMOALAR TAYYOR',
    '',
    ...blocks,
    '',
    formatBalanceLabel(diff),
  ].join('\n');
}

export function formatPublicTeamResult(teams: Team[]): string {
  const diff = teamSkillDiff(teams);
  const blocks = teams.map((team, i) => {
    const emoji = TEAM_EMOJIS[i] ?? '⚪';
    const lines = team.players.map((p) => p.name);
    return [`${emoji} JAMOA ${i + 1}`, ...lines].join('\n');
  });
  return [
    '⚽ JAMOALAR TAYYOR',
    '',
    ...blocks,
    '',
    formatBalanceLabel(diff),
  ].join('\n');
}

export function ratingTierButtonLabel(tier: PlayerTier): string {
  return `${tier} ${TIER_STARS[tier]}`;
}

export function prepCallback(prefix: string, matchId: string, suffix = ''): string {
  return suffix ? `${prefix}:${matchId}:${suffix}` : `${prefix}:${matchId}`;
}
