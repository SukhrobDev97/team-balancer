import {
  INLINE_ROSTER_MAX,
  MATCH_CLEANUP_AGE_MS,
  GroupMatchDraft,
  MatchParticipant,
  MatchSession,
  MatchStatus,
  MAX_MATCH_CAPACITY,
  MIN_MATCH_CAPACITY,
} from './types.js';
import { isMissingEditTargetError, matchTelegramExtra } from './utils.js';
import { mt } from './match-i18n.js';

export const MAX_DATE_LABEL_LENGTH = 80;
export const MAX_LOCATION_LENGTH = 120;

export const matches = new Map<string, MatchSession>();

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateShortId(length = 8): string {
  let id = '';
  for (let i = 0; i < length; i++) {
    id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]!;
  }
  return id;
}

export function generateMatchId(): string {
  let id: string;
  do {
    id = `m${generateShortId(10)}`;
  } while (matches.has(id));
  return id;
}

export function matchCallbackData(prefix: string, matchId: string): string {
  return `${prefix}:${matchId}`;
}

export function isCallbackDataSafe(data: string): boolean {
  return data.length > 0 && data.length <= 64;
}

export function cleanupStaleMatches(now = Date.now()): void {
  for (const [id, match] of matches) {
    if (now - match.createdAt > MATCH_CLEANUP_AGE_MS) {
      matches.delete(id);
    }
  }
}

export function isValidTime(text: string): boolean {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(text.trim());
}

export function isValidMatchCapacity(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_MATCH_CAPACITY && n <= MAX_MATCH_CAPACITY;
}

export function isValidDateLabel(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_DATE_LABEL_LENGTH;
}

export function isValidLocation(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_LOCATION_LENGTH;
}

export function participantDisplayName(
  firstName?: string,
  lastName?: string,
  username?: string,
  language: MatchSession['language'] = 'uz',
): string {
  const first = (firstName ?? '').trim();
  const last = (lastName ?? '').trim();
  const combined = [first, last].filter(Boolean).join(' ');
  if (combined) return combined;
  if (username) return `@${username.replace(/^@/, '')}`;
  return mt(language, 'matchDefaultPlayer');
}

export function isOrganizer(match: MatchSession, telegramId: number): boolean {
  return match.organizerTelegramId === telegramId;
}

export function syncMatchStatus(match: MatchSession): void {
  if (match.status === 'CLOSED' || match.status === 'CANCELLED') return;
  match.status =
    match.participants.length >= match.capacity ? 'FULL' : 'OPEN';
}

export type JoinResult = 'joined' | 'already' | 'full' | 'closed' | 'locked';

export function tryJoinMatch(
  match: MatchSession,
  participant: Omit<MatchParticipant, 'joinedAt'>,
  now = Date.now(),
): JoinResult {
  if (match.teamPreparation?.locked) {
    return 'locked';
  }
  if (match.status === 'CLOSED' || match.status === 'CANCELLED') {
    return 'closed';
  }
  if (match.participants.some((p) => p.telegramId === participant.telegramId)) {
    return 'already';
  }
  if (match.participants.length >= match.capacity) {
    return 'full';
  }

  match.participants.push({ ...participant, joinedAt: now });
  syncMatchStatus(match);
  return 'joined';
}

export type LeaveResult = 'left' | 'not_joined' | 'locked';

export function tryLeaveMatch(
  match: MatchSession,
  telegramId: number,
): LeaveResult {
  if (match.teamPreparation?.locked) {
    return 'locked';
  }
  const idx = match.participants.findIndex((p) => p.telegramId === telegramId);
  if (idx < 0) return 'not_joined';
  match.participants.splice(idx, 1);
  syncMatchStatus(match);
  return 'left';
}

function participantLines(match: MatchSession): string[] {
  return match.participants.map(
    (p, i) => `${i + 1}. ${p.displayName}`,
  );
}

export function formatMatchCard(match: MatchSession): string {
  const lang = match.language;
  const header = [`⚽ ${match.dateLabel} — ${match.time}`, `📍 ${match.location}`, ''];
  const countLine = mt(lang, 'matchCountLine', {
    current: match.participants.length,
    capacity: match.capacity,
  });

  if (match.status === 'FULL') {
    const lines = [...header, countLine, ''];
    if (match.participants.length <= INLINE_ROSTER_MAX) {
      lines.push(...participantLines(match), '', mt(lang, 'matchRosterFull'));
    } else {
      lines.push(mt(lang, 'matchRosterFull'));
    }
    return lines.join('\n');
  }

  if (match.status === 'CLOSED') {
    return [...header, countLine, '', mt(lang, 'matchRosterClosed')].join('\n');
  }

  if (match.status === 'CANCELLED') {
    return [
      mt(lang, 'matchCancelledBanner'),
      '',
      `⚽ ${match.dateLabel} — ${match.time}`,
      `📍 ${match.location}`,
    ].join('\n');
  }

  if (match.participants.length === 0) {
    return [...header, countLine, '', mt(lang, 'matchNoSignups')].join('\n');
  }

  const lines = [...header, countLine, ''];
  if (match.participants.length <= INLINE_ROSTER_MAX) {
    lines.push(...participantLines(match));
  }
  return lines.join('\n');
}

export function formatRosterMessage(match: MatchSession): string {
  const lang = match.language;
  const lines = [
    `⚽ ${match.dateLabel} — ${match.time}`,
    `📍 ${match.location}`,
    '',
    `${mt(lang, 'matchRosterTitle')} — ${match.participants.length} / ${match.capacity}`,
    '',
  ];

  if (match.participants.length === 0) {
    lines.push(mt(lang, 'matchNoSignups'));
  } else {
    lines.push(...participantLines(match));
  }

  if (match.status === 'FULL') {
    lines.push('', mt(lang, 'matchRosterFull'));
  }

  return lines.join('\n');
}

export function createMatchSession(
  draft: GroupMatchDraft,
  messageId: number,
  now = Date.now(),
): MatchSession {
  return {
    id: generateMatchId(),
    chatId: draft.chatId,
    messageId,
    messageThreadId: draft.messageThreadId,
    language: draft.language,
    organizerTelegramId: draft.organizerTelegramId,
    dateLabel: draft.dateLabel!,
    time: draft.time!,
    location: draft.location!,
    capacity: draft.capacity!,
    participants: [],
    status: 'OPEN' as MatchStatus,
    createdAt: now,
  };
}

export function getMatch(matchId: string): MatchSession | undefined {
  return matches.get(matchId);
}

export async function editMatchMessage(
  telegram: {
    editMessageText: (
      chatId: number,
      messageId: number,
      inlineMessageId: undefined,
      text: string,
      extra?: object,
    ) => Promise<unknown>;
    sendMessage: (chatId: number, text: string, extra?: object) => Promise<{ message_id: number }>;
  },
  match: MatchSession,
  text: string,
  extra?: object,
): Promise<void> {
  const telegramExtra = matchTelegramExtra(match, extra);
  try {
    await telegram.editMessageText(
      match.chatId,
      match.messageId,
      undefined,
      text,
      telegramExtra,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('message is not modified')) return;
    if (isMissingEditTargetError(msg)) {
      const sent = await telegram.sendMessage(match.chatId, text, telegramExtra);
      match.messageId = sent.message_id;
      return;
    }
    throw err;
  }
}

export function closeMatchRoster(
  match: MatchSession,
  organizerId: number,
): boolean {
  if (!isOrganizer(match, organizerId)) return false;
  if (match.status !== 'OPEN') return false;
  match.status = 'CLOSED';
  return true;
}

export type ReopenRosterResult =
  | 'reopened'
  | 'not_closed'
  | 'cancelled'
  | 'locked';

export function reopenMatchRoster(match: MatchSession): ReopenRosterResult {
  if (match.teamPreparation?.locked) return 'locked';
  if (match.status === 'CANCELLED') return 'cancelled';
  if (match.status !== 'CLOSED') return 'not_closed';
  match.status = 'OPEN';
  syncMatchStatus(match);
  return 'reopened';
}

export function shouldShowReopenRosterButton(match: MatchSession): boolean {
  return match.status === 'CLOSED' && !match.teamPreparation?.locked;
}

export function canPrepareTeams(match: MatchSession): boolean {
  return match.status === 'FULL' || match.status === 'CLOSED';
}
