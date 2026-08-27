import {
  generateShortId,
  isValidDateLabel,
  isValidLocation,
  isValidMatchCapacity,
  isValidTime,
} from './match.js';
import { GroupMatchDraft, GroupMatchDraftStep } from './types.js';
import { parsePositiveInt, isGroupChatType } from './utils.js';

/** In-memory group drafts. Lost on bot restart. */
export const groupMatchDrafts = new Map<string, GroupMatchDraft>();
export const groupMatchDraftsById = new Map<string, GroupMatchDraft>();

export function draftKey(chatId: number, organizerTelegramId: number): string {
  return `${chatId}:${organizerTelegramId}`;
}

export function draftCallback(action: string, draftId: string, extra?: string): string {
  return extra ? `${action}:${draftId}:${extra}` : `${action}:${draftId}`;
}

export type ParsedMatchDetails =
  | { ok: true; dateLabel: string; time: string; location: string }
  | {
      ok: false;
      reason: 'too_few_lines' | 'invalid_date' | 'invalid_time' | 'invalid_location';
    };

export function parseMatchDetails(text: string): ParsedMatchDetails {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 3) {
    return { ok: false, reason: 'too_few_lines' };
  }

  const dateLabel = lines[0]!;
  const time = lines[1]!;
  const location = lines.slice(2).join(' ');

  if (!isValidDateLabel(dateLabel)) {
    return { ok: false, reason: 'invalid_date' };
  }
  if (!isValidTime(time)) {
    return { ok: false, reason: 'invalid_time' };
  }
  if (!isValidLocation(location)) {
    return { ok: false, reason: 'invalid_location' };
  }

  return { ok: true, dateLabel, time, location };
}

export function invalidTimeHelpText(): string {
  return [
    "❌ Vaqtni HH:MM ko'rinishida kiriting.",
    '',
    'Masalan:',
    'Juma',
    '21:00',
    'Mega Arena',
  ].join('\n');
}

export function formatMatchDetailsPrompt(): string {
  return [
    '⚽ Yangi o\'yin',
    '',
    'Ma\'lumotlarni 3 qatorda yuboring:',
    '',
    '📅 Kun',
    '🕘 Vaqt',
    '📍 Joy',
    '',
    'Masalan:',
    'Juma',
    '21:00',
    'Mega Arena',
  ].join('\n');
}

export function formatEditDetailsPrompt(): string {
  return [
    'Yangi ma\'lumotlarni 3 qatorda yuboring:',
    '',
    'Masalan:',
    'Juma',
    '21:00',
    'Mega Arena',
  ].join('\n');
}

export function formatDraftHeader(draft: GroupMatchDraft): string[] {
  const lines = ['⚽ Yangi o\'yin', ''];
  if (draft.dateLabel) lines.push(`📅 ${draft.dateLabel}`);
  if (draft.time) lines.push(`🕘 ${draft.time}`);
  if (draft.location) lines.push(`📍 ${draft.location}`);
  return lines;
}

export function formatCapacityStep(draft: GroupMatchDraft): string {
  return [...formatDraftHeader(draft), '', '👥 Nechta o\'yinchi kerak?'].join('\n');
}

export function formatCustomCapacityStep(draft: GroupMatchDraft): string {
  return [
    ...formatDraftHeader(draft),
    '',
    '👥 O\'yinchilar sonini yozing:',
  ].join('\n');
}

export function formatPreviewStep(draft: GroupMatchDraft): string {
  return [
    ...formatDraftHeader(draft),
    `👥 ${draft.capacity} o'yinchi`,
    '',
    'Hammasi to\'g\'rimi?',
  ].join('\n');
}

export function isDraftReadyToOpen(draft: GroupMatchDraft): boolean {
  return (
    draft.dateLabel != null &&
    draft.time != null &&
    draft.location != null &&
    draft.capacity != null &&
    isValidMatchCapacity(draft.capacity)
  );
}

export function findActiveGroupMatchDraft(
  chatId: number,
  userId: number,
): GroupMatchDraft | undefined {
  return getGroupMatchDraft(chatId, userId);
}

export type GroupMatchTextRoute =
  | 'match_details'
  | 'custom_capacity'
  | 'edit_details'
  | 'ignore';

export function shouldRouteGroupMatchText(
  chatType: string | undefined,
  draft: GroupMatchDraft | undefined,
  userId: number,
): GroupMatchTextRoute {
  if (!isGroupChatType(chatType)) return 'ignore';
  if (!draft || draft.organizerTelegramId !== userId) return 'ignore';
  switch (draft.step) {
    case 'MATCH_DETAILS':
      return 'match_details';
    case 'WAITING_CUSTOM_CAPACITY':
      return 'custom_capacity';
    case 'EDIT_DETAILS':
      return 'edit_details';
    default:
      return 'ignore';
  }
}

export function shouldConsumeGroupMatchDraftText(
  draft: GroupMatchDraft | undefined,
  userId: number,
): boolean {
  if (!draft || draft.organizerTelegramId !== userId) return false;
  return (
    draft.step === 'MATCH_DETAILS' ||
    draft.step === 'WAITING_CUSTOM_CAPACITY' ||
    draft.step === 'EDIT_DETAILS'
  );
}

export function isCanonicalDraftMessageId(messageId: number | undefined): boolean {
  return Number.isInteger(messageId) && messageId! > 0;
}

export function isMissingEditTargetError(message: string): boolean {
  return (
    message.includes('message to edit not found') ||
    message.includes("message can't be edited")
  );
}

export function updateDraftMessageId(draft: GroupMatchDraft, messageId: number): void {
  if (!isCanonicalDraftMessageId(messageId)) {
    throw new Error('Draft messageId must be a bot-owned message id');
  }
  draft.messageId = messageId;
}

export function replaceGroupMatchDraft(
  chatId: number,
  organizerTelegramId: number,
  botMessageId: number,
  messageThreadId?: number,
  now = Date.now(),
): GroupMatchDraft {
  if (!isCanonicalDraftMessageId(botMessageId)) {
    throw new Error('Draft messageId must be a bot-owned message id');
  }
  const existing = getGroupMatchDraft(chatId, organizerTelegramId);
  if (existing) {
    removeGroupMatchDraft(existing);
  }
  return createGroupMatchDraft(
    chatId,
    organizerTelegramId,
    botMessageId,
    messageThreadId,
    now,
  );
}

export function createGroupMatchDraft(
  chatId: number,
  organizerTelegramId: number,
  messageId: number,
  messageThreadId?: number,
  now = Date.now(),
): GroupMatchDraft {
  if (!isCanonicalDraftMessageId(messageId)) {
    throw new Error('Draft messageId must be a bot-owned message id');
  }

  let id: string;
  do {
    id = `d${generateShortId(8)}`;
  } while (groupMatchDraftsById.has(id));

  const draft: GroupMatchDraft = {
    id,
    chatId,
    organizerTelegramId,
    messageId,
    messageThreadId,
    step: 'MATCH_DETAILS',
    createdAt: now,
  };

  groupMatchDrafts.set(draftKey(chatId, organizerTelegramId), draft);
  groupMatchDraftsById.set(id, draft);
  return draft;
}

export function getGroupMatchDraft(
  chatId: number,
  organizerTelegramId: number,
): GroupMatchDraft | undefined {
  return groupMatchDrafts.get(draftKey(chatId, organizerTelegramId));
}

export function getGroupMatchDraftById(draftId: string): GroupMatchDraft | undefined {
  return groupMatchDraftsById.get(draftId);
}

export function removeGroupMatchDraft(draft: GroupMatchDraft): void {
  groupMatchDrafts.delete(draftKey(draft.chatId, draft.organizerTelegramId));
  groupMatchDraftsById.delete(draft.id);
}

export function applyParsedDetails(
  draft: GroupMatchDraft,
  parsed: Extract<ParsedMatchDetails, { ok: true }>,
): GroupMatchDraftStep {
  draft.dateLabel = parsed.dateLabel;
  draft.time = parsed.time;
  draft.location = parsed.location;
  if (draft.step === 'EDIT_DETAILS') {
    draft.step = 'PREVIEW';
    return 'PREVIEW';
  }
  draft.step = 'CAPACITY';
  return 'CAPACITY';
}

export function parseCustomCapacity(text: string): number | null {
  const n = parsePositiveInt(text.trim());
  if (n === null || !isValidMatchCapacity(n)) return null;
  return n;
}

export function draftTelegramExtra(
  draft: GroupMatchDraft,
  extra?: object,
): object {
  if (draft.messageThreadId == null) return extra ?? {};
  return { ...extra, message_thread_id: draft.messageThreadId };
}

export function setDraftCapacity(draft: GroupMatchDraft, capacity: number): void {
  draft.capacity = capacity;
  draft.step = 'PREVIEW';
}
