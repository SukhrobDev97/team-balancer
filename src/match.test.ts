import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanupStaleMatches,
  closeMatchRoster,
  createMatchSession,
  editMatchMessage,
  formatMatchCard,
  generateMatchId,
  isCallbackDataSafe,
  isOrganizer,
  isValidDateLabel,
  isValidMatchCapacity,
  isValidTime,
  matchCallbackData,
  matches,
  participantDisplayName,
  reopenMatchRoster,
  shouldShowReopenRosterButton,
  tryJoinMatch,
  tryLeaveMatch,
} from './match.js';
import { GroupMatchDraft, MatchSession } from './types.js';
import { matchTelegramExtra, shouldHandlePrivateGameText } from './utils.js';
import { matchCardKeyboard } from './match-keyboards.js';
import { canShowShareButton } from './external-rsvp.js';
import { canStartTeamPreparation } from './match-preparation.js';

function emptyMatch(overrides: Partial<MatchSession> = {}): MatchSession {
  return {
    id: 'mtest123',
    chatId: -1001,
    messageId: 42,
    organizerTelegramId: 111,
    language: 'uz',
    dateLabel: 'Juma',
    time: '21:00',
    location: 'Mega Arena',
    capacity: 4,
    participants: [],
    status: 'OPEN',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('match setup validation', () => {
  it('validates capacity 1–50', () => {
    assert.equal(isValidMatchCapacity(1), true);
    assert.equal(isValidMatchCapacity(4), true);
    assert.equal(isValidMatchCapacity(50), true);
    assert.equal(isValidMatchCapacity(0), false);
    assert.equal(isValidMatchCapacity(51), false);
  });

  it('validates HH:MM time', () => {
    assert.equal(isValidTime('21:00'), true);
    assert.equal(isValidTime('9:05'), true);
    assert.equal(isValidTime('25:00'), false);
    assert.equal(isValidTime('21:60'), false);
    assert.equal(isValidTime('invalid'), false);
  });

  it('validates date label and location', () => {
    assert.equal(isValidDateLabel('Juma'), true);
    assert.equal(isValidDateLabel('   '), false);
    assert.equal(isValidDateLabel('a'.repeat(81)), false);
  });
});

describe('participant display name', () => {
  it('uses first and last name', () => {
    assert.equal(participantDisplayName('Sardor', 'Azizov'), 'Sardor Azizov');
  });

  it('falls back to username', () => {
    assert.equal(participantDisplayName(undefined, undefined, 'sardor'), '@sardor');
  });

  it('falls back to default label', () => {
    assert.equal(participantDisplayName(), "O'yinchi");
  });
});

describe('attendance logic', () => {
  it('joins participant', () => {
    const match = emptyMatch();
    const result = tryJoinMatch(match, {
      telegramId: 1,
      displayName: 'Sardor',
    });
    assert.equal(result, 'joined');
    assert.equal(match.participants.length, 1);
  });

  it('rejects duplicate join', () => {
    const match = emptyMatch();
    tryJoinMatch(match, { telegramId: 1, displayName: 'Sardor' });
    const result = tryJoinMatch(match, { telegramId: 1, displayName: 'Sardor' });
    assert.equal(result, 'already');
    assert.equal(match.participants.length, 1);
  });

  it('removes participant on leave', () => {
    const match = emptyMatch();
    tryJoinMatch(match, { telegramId: 1, displayName: 'Sardor' });
    const result = tryLeaveMatch(match, 1);
    assert.equal(result, 'left');
    assert.equal(match.participants.length, 0);
  });

  it('ignores leave for non-participant', () => {
    const match = emptyMatch();
    assert.equal(tryLeaveMatch(match, 99), 'not_joined');
  });

  it('never exceeds capacity', () => {
    const match = emptyMatch({ capacity: 2 });
    assert.equal(
      tryJoinMatch(match, { telegramId: 1, displayName: 'A' }),
      'joined',
    );
    assert.equal(
      tryJoinMatch(match, { telegramId: 2, displayName: 'B' }),
      'joined',
    );
    assert.equal(
      tryJoinMatch(match, { telegramId: 3, displayName: 'C' }),
      'full',
    );
    assert.equal(match.participants.length, 2);
  });

  it('sets FULL on final join and OPEN after leave', () => {
    const match = emptyMatch({ capacity: 2 });
    tryJoinMatch(match, { telegramId: 1, displayName: 'A' });
    assert.equal(match.status, 'OPEN');
    tryJoinMatch(match, { telegramId: 2, displayName: 'B' });
    assert.equal(match.status, 'FULL');
    tryLeaveMatch(match, 2);
    assert.equal(match.status, 'OPEN');
  });

  it('rejects join when CLOSED', () => {
    const match = emptyMatch({ status: 'CLOSED' });
    assert.equal(
      tryJoinMatch(match, { telegramId: 1, displayName: 'A' }),
      'closed',
    );
  });

  it('rejects join and leave when preparation locked', () => {
    const match = emptyMatch({
      teamPreparation: { locked: true, ratings: {} },
    });
    match.participants.push({ telegramId: 1, displayName: 'A', joinedAt: 1 });
    assert.equal(
      tryJoinMatch(match, { telegramId: 2, displayName: 'A' }),
      'locked',
    );
    assert.equal(tryLeaveMatch(match, 1), 'locked');
  });

  it('preserves organizer id on publish', () => {
    const draft: GroupMatchDraft = {
      id: 'dtest123',
      chatId: -100,
      organizerTelegramId: 777,
      messageId: 99,
      step: 'PREVIEW',
      language: 'uz',
      dateLabel: 'Juma',
      time: '21:00',
      location: 'Arena',
      capacity: 10,
      createdAt: Date.now(),
    };
    const match = createMatchSession(draft, 99);
    assert.equal(match.organizerTelegramId, 777);
    assert.equal(isOrganizer(match, 777), true);
    assert.equal(isOrganizer(match, 888), false);
  });

  it('copies forum topic thread id from draft', () => {
    const draft: GroupMatchDraft = {
      id: 'dtopic',
      chatId: -100,
      organizerTelegramId: 777,
      messageId: 99,
      messageThreadId: 555,
      step: 'PREVIEW',
      language: 'uz',
      dateLabel: 'Juma',
      time: '21:00',
      location: 'Arena',
      capacity: 10,
      createdAt: Date.now(),
    };
    const match = createMatchSession(draft, 99);
    assert.equal(match.messageThreadId, 555);
  });
});

describe('callback payloads', () => {
  it('keeps callback data within Telegram limit', () => {
    const id = generateMatchId();
    const join = matchCallbackData('mj', id);
    const leave = matchCallbackData('ml', id);
    const roster = matchCallbackData('mr', id);
    assert.equal(isCallbackDataSafe(join), true);
    assert.equal(isCallbackDataSafe(leave), true);
    assert.equal(isCallbackDataSafe(roster), true);
    assert.ok(join.length <= 64);
  });
});

describe('group /match routing', () => {
  it('does not route group /match through the private game text handler', () => {
    assert.equal(shouldHandlePrivateGameText('group', '/match'), false);
    assert.equal(shouldHandlePrivateGameText('supergroup', '/match'), false);
  });

  it('still routes private free text to the game handler', () => {
    assert.equal(shouldHandlePrivateGameText('private', 'Salom'), true);
  });

  it('leaves bot commands to dedicated command handlers', () => {
    assert.equal(shouldHandlePrivateGameText('private', '/match'), false);
    assert.equal(shouldHandlePrivateGameText('private', '/start'), false);
  });
});

describe('match card formatting', () => {
  it('shows full banner when roster complete', () => {
    const match = emptyMatch({ capacity: 2 });
    tryJoinMatch(match, { telegramId: 1, displayName: 'A' });
    tryJoinMatch(match, { telegramId: 2, displayName: 'B' });
    const text = formatMatchCard(match);
    assert.match(text, /TARKIB TO'LDI/);
    assert.match(text, /2 \/ 2/);
  });
});

describe('stale match cleanup', () => {
  it('removes old matches', () => {
    matches.clear();
    const old = emptyMatch({ createdAt: 0 });
    matches.set(old.id, old);
    cleanupStaleMatches(Number.MAX_SAFE_INTEGER);
    assert.equal(matches.has(old.id), false);
  });
});

function flatKeyboardButtons(
  keyboard: ReturnType<typeof matchCardKeyboard>,
): { text?: string; callback_data?: string; url?: string }[] {
  return keyboard.reply_markup.inline_keyboard.flat();
}

describe('roster reopen', () => {
  it('organizer can reopen CLOSED roster to OPEN when below capacity', () => {
    const match = emptyMatch({ status: 'CLOSED', capacity: 10 });
    match.participants.push({ telegramId: 1, displayName: 'A', joinedAt: 1 });
    assert.equal(reopenMatchRoster(match), 'reopened');
    assert.equal(match.status, 'OPEN');
  });

  it('non-organizer can reopen CLOSED roster', () => {
    const match = emptyMatch({ status: 'CLOSED', capacity: 10 });
    assert.equal(reopenMatchRoster(match), 'reopened');
    assert.equal(match.status, 'OPEN');
  });

  it('arbitrary group user can reopen CLOSED roster', () => {
    const match = emptyMatch({ status: 'CLOSED', capacity: 10 });
    match.participants.push({ telegramId: 777, displayName: 'Member', joinedAt: 1 });
    assert.equal(reopenMatchRoster(match), 'reopened');
    assert.equal(match.status, 'OPEN');
  });

  it('reopens CLOSED roster to FULL when already at capacity', () => {
    const match = emptyMatch({ status: 'CLOSED', capacity: 2 });
    match.participants.push(
      { telegramId: 1, displayName: 'A', joinedAt: 1 },
      { telegramId: 2, displayName: 'B', joinedAt: 2 },
    );
    assert.equal(reopenMatchRoster(match), 'reopened');
    assert.equal(match.status, 'FULL');
  });

  it('rejects CANCELLED reopen', () => {
    const match = emptyMatch({ status: 'CANCELLED' });
    assert.equal(reopenMatchRoster(match), 'cancelled');
  });

  it('rejects locked team-prep reopen', () => {
    const match = emptyMatch({
      status: 'CLOSED',
      teamPreparation: { locked: true, ratings: {} },
    });
    assert.equal(reopenMatchRoster(match), 'locked');
  });

  it('shows reopen button on CLOSED unlocked match for everyone', () => {
    const match = emptyMatch({ status: 'CLOSED' });
    assert.equal(shouldShowReopenRosterButton(match), true);
    const buttons = flatKeyboardButtons(matchCardKeyboard(match));
    assert.ok(buttons.some((b) => b.callback_data?.startsWith('mro:')));
  });

  it('hides reopen button after team prep locked', () => {
    const match = emptyMatch({
      status: 'CLOSED',
      teamPreparation: { locked: true, ratings: {} },
    });
    assert.equal(shouldShowReopenRosterButton(match), false);
  });

  it('allows attendance join after reopen', () => {
    const match = emptyMatch({ status: 'CLOSED', capacity: 10 });
    match.participants.push({ telegramId: 1, displayName: 'A', joinedAt: 1 });
    reopenMatchRoster(match);
    assert.equal(
      tryJoinMatch(match, { telegramId: 2, displayName: 'B' }),
      'joined',
    );
  });

  it('returns share button after reopen when eligible', () => {
    const match = emptyMatch({ status: 'CLOSED', capacity: 10 });
    reopenMatchRoster(match);
    assert.equal(canShowShareButton(match), true);
    const buttons = flatKeyboardButtons(matchCardKeyboard(match));
    assert.ok(buttons.some((b) => b.callback_data?.startsWith('mj:')));
  });

  it('preserves forum topic on reopen card edit', async () => {
    const match = emptyMatch({ status: 'CLOSED', messageThreadId: 888 });
    reopenMatchRoster(match);
    const edits: object[] = [];
    await editMatchMessage(
      {
        editMessageText: async (
          _chatId: number,
          _messageId: number,
          _inline: undefined,
          _text: string,
          extra?: object,
        ) => {
          edits.push(extra ?? {});
        },
        sendMessage: async () => ({ message_id: 99 }),
      },
      match,
      formatMatchCard(match),
      matchCardKeyboard(match),
    );
    assert.equal((edits[0] as { message_thread_id?: number }).message_thread_id, 888);
  });

  it('close roster still works from OPEN', () => {
    const match = emptyMatch({ status: 'OPEN' });
    assert.equal(closeMatchRoster(match, 111), true);
    assert.equal(match.status, 'CLOSED');
  });

  it('team prep minimum-player validation unchanged after reopen', () => {
    const match = emptyMatch({ status: 'CLOSED', capacity: 10 });
    match.participants.push(
      { telegramId: 1, displayName: 'A', joinedAt: 1 },
      { telegramId: 2, displayName: 'B', joinedAt: 2 },
    );
    assert.deepEqual(canStartTeamPreparation(match, 111), {
      ok: false,
      reason: 'too_few',
    });
    reopenMatchRoster(match);
    closeMatchRoster(match, 111);
    assert.deepEqual(canStartTeamPreparation(match, 111), {
      ok: false,
      reason: 'too_few',
    });
  });

  it('external RSVP join works after reopen', () => {
    const match = emptyMatch({ status: 'CLOSED', capacity: 10 });
    reopenMatchRoster(match);
    assert.equal(
      tryJoinMatch(match, { telegramId: 555, displayName: 'External' }),
      'joined',
    );
  });

  it('team prep start remains organizer-only', () => {
    const match = emptyMatch({ status: 'CLOSED', capacity: 10 });
    match.participants.push(
      { telegramId: 1, displayName: 'A', joinedAt: 1 },
      { telegramId: 2, displayName: 'B', joinedAt: 2 },
      { telegramId: 3, displayName: 'C', joinedAt: 3 },
    );
    assert.deepEqual(canStartTeamPreparation(match, 999), {
      ok: false,
      reason: 'not_organizer',
    });
  });

  it('non-organizer cannot start team prep after reopen', () => {
    const match = emptyMatch({ status: 'CLOSED', capacity: 10 });
    match.participants.push(
      { telegramId: 1, displayName: 'A', joinedAt: 1 },
      { telegramId: 2, displayName: 'B', joinedAt: 2 },
      { telegramId: 3, displayName: 'C', joinedAt: 3 },
    );
    reopenMatchRoster(match);
    assert.deepEqual(canStartTeamPreparation(match, 999), {
      ok: false,
      reason: 'not_organizer',
    });
  });
});
