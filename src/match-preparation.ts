import { balanceTeams } from './team-balancer.js';
import {
  MatchParticipant,
  MatchSession,
  MAX_TEAMS,
  MIN_PER_TEAM,
  MIN_TEAMS,
  Player,
  PlayerTier,
  Team,
  TeamPreparation,
  TeamPrepView,
} from './types.js';
import { isOrganizer } from './match.js';
import { validTeamCounts } from './utils.js';

export const MIN_TEAM_PREP_PLAYERS = 3;
export const TEAM_EMOJIS = ['🔵', '🔴', '🟢', '🟡', '🟣'];

function matchMinPerTeam(playerCount: number): number {
  return Math.min(MIN_PER_TEAM, Math.max(1, Math.floor(playerCount / MIN_TEAMS)));
}

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
    match.teamPreparation = { locked: true, ratings: {}, view: 'RATING' };
  } else {
    match.teamPreparation.locked = true;
    match.teamPreparation.view = 'RATING';
  }
  return match.teamPreparation;
}

export function ensureTeamPreparation(match: MatchSession): TeamPreparation {
  if (!match.teamPreparation) {
    match.teamPreparation = { locked: false, ratings: {} };
  }
  return match.teamPreparation;
}

export function isPrepActive(match: MatchSession): boolean {
  return match.teamPreparation?.locked === true && match.teamsPublishedAt == null;
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
    matchMinPerTeam(match.participants.length),
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

export function formatRatingPrompt(
  match: MatchSession,
  participant: MatchParticipant,
): string {
  const total = match.participants.length;
  const order = sortedParticipants(match);
  const index = order.findIndex((p) => p.telegramId === participant.telegramId);
  return [
    '⚙️ Jamoalarni tayyorlash',
    '',
    `${index + 1} / ${total}`,
    '',
    `👤 ${participant.displayName}`,
    '',
    'Darajasini tanlang:',
  ].join('\n');
}

export function formatRatingCompleteSummary(match: MatchSession): string {
  return [
    '✅ Barcha o\'yinchilar baholandi',
    '',
    `👥 ${match.participants.length} ta o'yinchi`,
  ].join('\n');
}

export function formatEditRatingListPrompt(): string {
  return '✏️ Kimning bahosini o\'zgartiramiz?';
}

export function formatEditRatingTierPrompt(displayName: string): string {
  return [`👤 ${displayName}`, '', 'Yangi darajani tanlang:'].join('\n');
}

export function formatTeamCountPrompt(): string {
  return '⚽ Nechta jamoa qilamiz?';
}

export function formatGroupTeamPreview(teams: Team[]): string {
  const diff = teamSkillDiff(teams);
  const blocks = teams.map((team, i) => {
    const emoji = TEAM_EMOJIS[i] ?? '⚪';
    const lines = team.players.map((p) => p.name);
    return [`${emoji} ${i + 1}-jamoa`, ...lines].join('\n');
  });
  return [
    '⚽ Jamoalar tayyor',
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

export function formatPrepCompleteCard(match: MatchSession): string {
  const teamCount = match.teamPreparation?.teamCount ?? 0;
  return [
    '✅ Jamoalar tayyorlandi',
    '',
    `👥 ${match.participants.length} ta o'yinchi`,
    `⚽ ${teamCount} ta jamoa`,
  ].join('\n');
}

export function ratingTierButtonLabel(tier: PlayerTier): string {
  return tier;
}

export function prepCallback(prefix: string, matchId: string, suffix = ''): string {
  return suffix ? `${prefix}:${matchId}:${suffix}` : `${prefix}:${matchId}`;
}

export function isExpectedPrepView(
  match: MatchSession,
  ...views: TeamPrepView[]
): boolean {
  const view = match.teamPreparation?.view;
  return view != null && views.includes(view);
}
