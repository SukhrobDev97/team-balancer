import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanupExpiredSetupTokens,
  cleanupStaleMatches,
  createMatchSession,
  createSetupToken,
  ensureDraftFromToken,
  formatMatchCard,
  generateMatchId,
  isCallbackDataSafe,
  isOrganizer,
  isValidDateLabel,
  isValidMatchCapacity,
  isValidTime,
  matchCallbackData,
  matches,
  matchDrafts,
  participantDisplayName,
  setupTokens,
  SETUP_TOKEN_TTL_MS,
  tryJoinMatch,
  tryLeaveMatch,
  validateSetupToken,
} from './match.js';
import { MatchSession, MatchSetupDraft } from './types.js';

function emptyMatch(overrides: Partial<MatchSession> = {}): MatchSession {
  return {
    id: 'mtest123',
    chatId: -1001,
    messageId: 42,
    organizerTelegramId: 111,
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
  it('validates capacity 4–50', () => {
    assert.equal(isValidMatchCapacity(4), true);
    assert.equal(isValidMatchCapacity(50), true);
    assert.equal(isValidMatchCapacity(3), false);
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
    const draft: MatchSetupDraft = {
      userId: 777,
      chatId: -100,
      step: 'PREVIEW',
      dateLabel: 'Juma',
      time: '21:00',
      location: 'Arena',
      capacity: 10,
    };
    const match = createMatchSession(draft, 99);
    assert.equal(match.organizerTelegramId, 777);
    assert.equal(isOrganizer(match, 777), true);
    assert.equal(isOrganizer(match, 888), false);
  });
});

describe('setup tokens', () => {
  it('allows only creator to use token', () => {
    const entry = createSetupToken(-100, 42, 'Football Boys', 1_000);
    assert.deepEqual(validateSetupToken(entry.token, 42, 1_000), {
      ok: true,
      entry,
    });
    assert.deepEqual(validateSetupToken(entry.token, 99, 1_000), {
      ok: false,
      reason: 'wrong_user',
    });
  });

  it('rejects expired token', () => {
    const entry = createSetupToken(-100, 42, undefined, 0);
    const expiredAt = entry.createdAt + SETUP_TOKEN_TTL_MS + 1;
    assert.deepEqual(validateSetupToken(entry.token, 42, expiredAt), {
      ok: false,
      reason: 'expired',
    });
  });

  it('creates draft from valid token', () => {
    matchDrafts.clear();
    const entry = createSetupToken(-200, 55, 'Group A');
    const draft = ensureDraftFromToken(entry, 55);
    assert.equal(draft.chatId, -200);
    assert.equal(draft.groupTitle, 'Group A');
    assert.equal(draft.step, 'DATE');
  });

  it('cleans expired tokens opportunistically', () => {
    setupTokens.clear();
    createSetupToken(-1, 1, undefined, 0);
    cleanupExpiredSetupTokens(SETUP_TOKEN_TTL_MS + 1);
    assert.equal(setupTokens.size, 0);
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
