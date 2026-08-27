import { isOrganizer } from './match.js';
import {
  participantPlayerId,
  sortedParticipants,
} from './match-preparation.js';
import {
  getRandomMotmMessage,
  getRandomMotmTieMessage,
} from './motm-messages.js';
import {
  MatchParticipant,
  MatchSession,
  MotmPodiumEntry,
  MotmState,
  MotmStatus,
} from './types.js';

/** MOTM lives on in-memory MatchSession only. Votes are lost on bot restart. */
export const MOTM_PAGE_SIZE = 22;

const PODIUM_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export function motmStatus(match: MatchSession): MotmStatus {
  return match.motm?.status ?? 'NOT_STARTED';
}

export function areTeamsPublished(match: MatchSession): boolean {
  return (
    match.teamsPublishedAt != null &&
    (match.teamPreparation?.generatedTeams?.length ?? 0) > 0
  );
}

export function isMatchParticipant(
  match: MatchSession,
  telegramId: number,
): boolean {
  return match.participants.some((p) => p.telegramId === telegramId);
}

export function findParticipantByPlayerId(
  match: MatchSession,
  participantId: string,
): MatchParticipant | undefined {
  return match.participants.find(
    (p) => participantPlayerId(p.telegramId) === participantId,
  );
}

export function motmVoteCount(motm: MotmState): number {
  return Object.keys(motm.votes).length;
}

export function motmCallback(
  action: string,
  matchId: string,
  extra?: string,
): string {
  return extra ? `${action}:${matchId}:${extra}` : `${action}:${matchId}`;
}

export type StartMotmReason =
  | 'not_published'
  | 'not_participant'
  | 'already_open'
  | 'already_finished';

export type StartMotmResult =
  | { ok: true }
  | { ok: false; reason: StartMotmReason };

export function canStartMotm(
  match: MatchSession,
  userId: number,
): StartMotmResult {
  if (!areTeamsPublished(match)) {
    return { ok: false, reason: 'not_published' };
  }
  const status = motmStatus(match);
  if (status === 'OPEN') return { ok: false, reason: 'already_open' };
  if (status === 'FINISHED') return { ok: false, reason: 'already_finished' };
  if (!isMatchParticipant(match, userId) && !isOrganizer(match, userId)) {
    return { ok: false, reason: 'not_participant' };
  }
  return { ok: true };
}

export function startMotm(
  match: MatchSession,
  userId: number,
  now = Date.now(),
): StartMotmResult {
  const check = canStartMotm(match, userId);
  if (!check.ok) return check;
  match.motm = {
    status: 'OPEN',
    startedByTelegramId: userId,
    startedAt: now,
    votes: {},
    keyboardPage: 0,
  };
  return { ok: true };
}

export type CastVoteResult =
  | { ok: true; kind: 'first' | 'changed' | 'same'; displayName: string }
  | {
      ok: false;
      reason:
        | 'not_open'
        | 'finished'
        | 'not_participant'
        | 'self'
        | 'unknown_candidate';
    };

export function castVote(
  match: MatchSession,
  voterTelegramId: number,
  candidateId: string,
): CastVoteResult {
  const motm = match.motm;
  if (!motm) return { ok: false, reason: 'not_open' };
  if (motm.status === 'FINISHED') return { ok: false, reason: 'finished' };
  if (motm.status !== 'OPEN') return { ok: false, reason: 'not_open' };
  if (!isMatchParticipant(match, voterTelegramId)) {
    return { ok: false, reason: 'not_participant' };
  }

  const candidate = findParticipantByPlayerId(match, candidateId);
  if (!candidate) return { ok: false, reason: 'unknown_candidate' };
  if (candidate.telegramId === voterTelegramId) {
    return { ok: false, reason: 'self' };
  }

  const voterKey = String(voterTelegramId);
  const previous = motm.votes[voterKey];
  if (previous === candidateId) {
    return { ok: true, kind: 'same', displayName: candidate.displayName };
  }

  motm.votes[voterKey] = candidateId;
  return {
    ok: true,
    kind: previous ? 'changed' : 'first',
    displayName: candidate.displayName,
  };
}

export function isMotmCloser(match: MatchSession, userId: number): boolean {
  const motm = match.motm;
  if (!motm) return false;
  return (
    userId === motm.startedByTelegramId || userId === match.organizerTelegramId
  );
}

export function tallyVotes(match: MatchSession): MotmPodiumEntry[] {
  const motm = match.motm;
  if (!motm) return [];

  const counts = new Map<string, number>();
  for (const participantId of Object.values(motm.votes)) {
    counts.set(participantId, (counts.get(participantId) ?? 0) + 1);
  }
  if (counts.size === 0) return [];

  const order = new Map(
    sortedParticipants(match).map((p, i) => [
      participantPlayerId(p.telegramId),
      i,
    ]),
  );

  const ranked: MotmPodiumEntry[] = [...counts.entries()]
    .map(([participantId, votes]) => {
      const p = findParticipantByPlayerId(match, participantId);
      return {
        participantId,
        displayName: p?.displayName ?? "O'yinchi",
        votes,
        place: 0,
      };
    })
    .sort(
      (a, b) =>
        b.votes - a.votes ||
        (order.get(a.participantId) ?? 0) - (order.get(b.participantId) ?? 0),
    );

  let i = 0;
  while (i < ranked.length) {
    const place = i + 1;
    const score = ranked[i]!.votes;
    let j = i;
    while (j < ranked.length && ranked[j]!.votes === score) {
      ranked[j]!.place = place;
      j++;
    }
    i = j;
  }
  return ranked;
}

export function podiumFromRanks(ranks: MotmPodiumEntry[]): MotmPodiumEntry[] {
  return ranks.filter((r) => r.place <= 3);
}

export type FinishMotmResult =
  | { ok: true; alreadyFinished: boolean }
  | { ok: false; reason: 'not_open' | 'not_authorized' | 'no_votes' };

export function finishMotm(
  match: MatchSession,
  userId: number,
  now = Date.now(),
  random: () => number = Math.random,
): FinishMotmResult {
  const motm = match.motm;
  if (!motm) return { ok: false, reason: 'not_open' };
  if (motm.status === 'FINISHED') return { ok: true, alreadyFinished: true };
  if (motm.status !== 'OPEN') return { ok: false, reason: 'not_open' };
  if (!isMotmCloser(match, userId)) {
    return { ok: false, reason: 'not_authorized' };
  }
  if (motmVoteCount(motm) === 0) {
    return { ok: false, reason: 'no_votes' };
  }

  const ranks = tallyVotes(match);
  const podium = podiumFromRanks(ranks);
  const winners = ranks.filter((r) => r.place === 1);
  const joke =
    winners.length === 1
      ? getRandomMotmMessage(winners[0]!.displayName, random)
      : getRandomMotmTieMessage(random);

  motm.status = 'FINISHED';
  motm.finishedAt = now;
  motm.winnerParticipantIds = winners.map((w) => w.participantId);
  motm.finalJoke = joke;
  motm.podium = podium;
  return { ok: true, alreadyFinished: false };
}

export function formatMotmOpenText(match: MatchSession): string {
  const total = match.participants.length;
  const count = match.motm ? motmVoteCount(match.motm) : 0;
  return [
    '🏆 MAN OF THE MATCH',
    '',
    "Bugungi eng yaxshi o'yinchi kim? 👀",
    '',
    `🗳 ${count} / ${total} ovoz berildi`,
  ].join('\n');
}

export function formatMotmResultText(match: MatchSession): string {
  const motm = match.motm;
  if (motm?.status !== 'FINISHED' || !motm.podium || !motm.finalJoke) {
    return '';
  }

  const podiumLines = motm.podium.map((r) => {
    const medal = PODIUM_MEDALS[r.place] ?? '•';
    return `${medal} ${r.displayName} — ${r.votes} ovoz`;
  });

  const winners = motm.podium.filter((r) => r.place === 1);
  const winnerBlock =
    winners.length === 1
      ? `👑 Bugungi MOTM: ${winners[0]!.displayName.toUpperCase()}`
      : `👑 Bugungi MOTM:\n${winners.map((w) => w.displayName).join(' & ')}`;

  return [
    '🏆 MAN OF THE MATCH',
    '',
    ...podiumLines,
    '',
    winnerBlock,
    '',
    motm.finalJoke,
  ].join('\n');
}

export function motmPageCount(rosterSize: number): number {
  return Math.max(1, Math.ceil(rosterSize / MOTM_PAGE_SIZE));
}

export function clampMotmPage(page: number, rosterSize: number): number {
  const max = motmPageCount(rosterSize) - 1;
  if (!Number.isInteger(page) || page < 0) return 0;
  return Math.min(page, max);
}
