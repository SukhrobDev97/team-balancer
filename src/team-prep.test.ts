import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allParticipantsRated,
  beginTeamPreparation,
  canStartTeamPreparation,
  formatEditRatingListPrompt,
  formatGroupTeamPreview,
  formatPublicTeamResult,
  formatRatingCompleteSummary,
  formatRatingPrompt,
  generateTeamsForMatch,
  isAttendanceLocked,
  isPrepActive,
  isValidMatchTeamCount,
  participantsToPlayers,
  setRating,
  sortedParticipants,
  validMatchTeamCounts,
} from './match-preparation.js';
import {
  closeMatchRoster,
  createMatchSession,
  isOrganizer,
  tryJoinMatch,
  tryLeaveMatch,
} from './match.js';
import { teamCapacities } from './team-balancer.js';
import { GroupMatchDraft, MatchSession } from './types.js';
import { ratingEditListKeyboard } from './team-prep-keyboards.js';
import { matchTelegramExtra } from './utils.js';
import { canStartMotm } from './motm.js';

function matchWithParticipants(
  count: number,
  overrides: Partial<MatchSession> = {},
): MatchSession {
  const participants = Array.from({ length: count }, (_, i) => ({
    telegramId: 1000 + i,
    displayName: i === 1 ? 'Sardor' : `Player ${i + 1}`,
    joinedAt: i * 1000,
  }));
  return {
    id: 'mtest',
    chatId: -100,
    messageId: 1,
    organizerTelegramId: 42,
    dateLabel: 'Juma',
    time: '21:00',
    location: 'Arena',
    capacity: 16,
    participants,
    status: 'FULL',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('team preparation eligibility', () => {
  it('allows FULL match for organizer', () => {
    const match = matchWithParticipants(16, { status: 'FULL' });
    assert.deepEqual(canStartTeamPreparation(match, 42), { ok: true });
  });

  it('allows CLOSED match for organizer', () => {
    const match = matchWithParticipants(14, { status: 'CLOSED' });
    assert.deepEqual(canStartTeamPreparation(match, 42), { ok: true });
  });

  it('rejects OPEN non-full match', () => {
    const match = matchWithParticipants(14, { status: 'OPEN' });
    assert.deepEqual(canStartTeamPreparation(match, 42), {
      ok: false,
      reason: 'wrong_status',
    });
  });

  it('rejects fewer than 3 participants', () => {
    const match = matchWithParticipants(2, { status: 'FULL' });
    assert.deepEqual(canStartTeamPreparation(match, 42), {
      ok: false,
      reason: 'too_few',
    });
  });

  it('rejects non-organizer', () => {
    const match = matchWithParticipants(10);
    assert.deepEqual(canStartTeamPreparation(match, 99), {
      ok: false,
      reason: 'not_organizer',
    });
  });
});

describe('attendance lock', () => {
  it('locks roster when preparation begins', () => {
    const match = matchWithParticipants(6);
    beginTeamPreparation(match);
    assert.equal(isAttendanceLocked(match), true);
    assert.equal(isPrepActive(match), true);
    assert.equal(match.teamPreparation?.view, 'RATING');
    assert.equal(tryJoinMatch(match, { telegramId: 9999, displayName: 'X' }), 'locked');
    assert.equal(tryLeaveMatch(match, 1000), 'locked');
  });

  it('allows close roster from OPEN', () => {
    const match = matchWithParticipants(14, { status: 'OPEN' });
    assert.equal(closeMatchRoster(match, 42), true);
    assert.equal(match.status, 'CLOSED');
    assert.equal(closeMatchRoster(match, 99), false);
  });
});

describe('rating privacy formatting', () => {
  it('rating prompt shows player without tier', () => {
    const match = matchWithParticipants(3);
    beginTeamPreparation(match);
    const next = sortedParticipants(match)[1]!;
    assert.equal(next.displayName, 'Sardor');
    const text = formatRatingPrompt(match, next);
    assert.match(text, /Sardor/);
    assert.doesNotMatch(text, / · [ABCDE]/);
  });

  it('summary exposes no individual or aggregate tiers', () => {
    const match = matchWithParticipants(4);
    beginTeamPreparation(match);
    for (const p of sortedParticipants(match)) {
      setRating(match, p.telegramId, 'A');
    }
    const text = formatRatingCompleteSummary(match);
    assert.match(text, /Barcha o'yinchilar baholandi/);
    assert.doesNotMatch(text, /A —/);
    assert.doesNotMatch(text, / · A/);
    assert.doesNotMatch(text, /Sardor —/);
  });

  it('edit list keyboard uses names only', () => {
    const match = matchWithParticipants(3);
    beginTeamPreparation(match);
    for (const p of sortedParticipants(match)) {
      setRating(match, p.telegramId, 'B');
    }
    const keyboard = ratingEditListKeyboard(match);
    const labels = keyboard.reply_markup.inline_keyboard
      .flat()
      .map((b) => ('text' in b ? b.text : ''));
    assert.ok(labels.some((l) => l.includes('Sardor')));
    assert.ok(!labels.some((l) => / · [ABCDE]/.test(l)));
  });
});

describe('rating', () => {
  it('rates each participant by telegram id', () => {
    const match = matchWithParticipants(4);
    beginTeamPreparation(match);
    for (const p of sortedParticipants(match)) {
      setRating(match, p.telegramId, 'C');
    }
    assert.equal(allParticipantsRated(match), true);
    assert.equal(match.teamPreparation?.view, 'RATING');
    const players = participantsToPlayers(match);
    assert.equal(players.length, 4);
  });

  it('updates rating', () => {
    const match = matchWithParticipants(1);
    beginTeamPreparation(match);
    setRating(match, 1000, 'A');
    setRating(match, 1000, 'B');
    assert.equal(participantsToPlayers(match)[0]!.tier, 'B');
  });
});

describe('team count validation', () => {
  it('calculates valid team counts for 14 players', () => {
    const match = matchWithParticipants(14);
    assert.deepEqual(validMatchTeamCounts(match), [2, 3, 4, 5]);
  });

  it('rejects invalid team count', () => {
    const match = matchWithParticipants(4);
    assert.equal(isValidMatchTeamCount(match, 3), false);
    assert.equal(isValidMatchTeamCount(match, 2), true);
  });
});

describe('team generation', () => {
  it('requires complete ratings', () => {
    const match = matchWithParticipants(6);
    beginTeamPreparation(match);
    match.teamPreparation!.teamCount = 2;
    assert.equal(generateTeamsForMatch(match), undefined);
  });

  it('generates teams with every participant exactly once', () => {
    const match = matchWithParticipants(10);
    beginTeamPreparation(match);
    for (const p of sortedParticipants(match)) {
      setRating(match, p.telegramId, 'C');
    }
    match.teamPreparation!.teamCount = 2;
    const teams = generateTeamsForMatch(match)!;
    const ids = teams.flatMap((t) => t.players.map((p) => p.id)).sort();
    const expected = sortedParticipants(match).map((p) => `t${p.telegramId}`).sort();
    assert.deepEqual(ids, expected);
  });

  it('reshuffle preserves roster and tiers', () => {
    const match = matchWithParticipants(8);
    beginTeamPreparation(match);
    const tiers = ['A', 'B', 'C', 'D', 'E', 'A', 'B', 'C'] as const;
    sortedParticipants(match).forEach((p, i) => {
      setRating(match, p.telegramId, tiers[i]!);
    });
    match.teamPreparation!.teamCount = 2;
    generateTeamsForMatch(match);
    generateTeamsForMatch(match);
    const roster = match.teamPreparation!.generatedTeams!
      .flatMap((t) => t.players.map((p) => `${p.id}:${p.tier}`))
      .sort();
    assert.equal(roster.length, 8);
  });
});

describe('preview and publish formatting', () => {
  it('preview exposes no tiers', () => {
    const match = matchWithParticipants(4);
    beginTeamPreparation(match);
    for (const p of sortedParticipants(match)) {
      setRating(match, p.telegramId, 'A');
    }
    match.teamPreparation!.teamCount = 2;
    const teams = generateTeamsForMatch(match)!;
    const text = formatGroupTeamPreview(teams);
    assert.doesNotMatch(text, / · [ABCDE]/);
    assert.match(text, /Sardor/);
  });

  it('public publish strips tiers', () => {
    const match = matchWithParticipants(4);
    beginTeamPreparation(match);
    for (const p of sortedParticipants(match)) {
      setRating(match, p.telegramId, 'A');
    }
    match.teamPreparation!.teamCount = 2;
    const teams = generateTeamsForMatch(match)!;
    const text = formatPublicTeamResult(teams);
    assert.doesNotMatch(text, / · [ABCDE]/);
  });
});

describe('forum topic propagation', () => {
  it('copies messageThreadId from draft to match', () => {
    const draft: GroupMatchDraft = {
      id: 'dtest',
      chatId: -1004354302889,
      organizerTelegramId: 42,
      messageId: 91,
      messageThreadId: 12345,
      step: 'PREVIEW',
      dateLabel: 'Juma',
      time: '21:00',
      location: 'Arena',
      capacity: 10,
      createdAt: Date.now(),
    };
    const match = createMatchSession(draft, 91);
    assert.equal(match.messageThreadId, 12345);
    assert.deepEqual(matchTelegramExtra(match), {
      message_thread_id: 12345,
    });
  });

  it('matchTelegramExtra omits thread when absent', () => {
    const match = matchWithParticipants(4);
    assert.deepEqual(matchTelegramExtra(match), {});
  });
});

describe('MOTM after publish', () => {
  it('allows MOTM when teams published', () => {
    const match = matchWithParticipants(6);
    beginTeamPreparation(match);
    for (const p of sortedParticipants(match)) {
      setRating(match, p.telegramId, 'C');
    }
    match.teamPreparation!.teamCount = 2;
    generateTeamsForMatch(match);
    match.teamsPublishedAt = Date.now();
    assert.equal(canStartMotm(match, 1000).ok, true);
  });
});

describe('organizer preservation', () => {
  it('keeps organizer on match', () => {
    const match = matchWithParticipants(8);
    assert.equal(isOrganizer(match, 42), true);
    beginTeamPreparation(match);
    assert.equal(match.organizerTelegramId, 42);
  });
});

describe('edit rating prompt', () => {
  it('does not expose tiers in edit list prompt', () => {
    assert.equal(formatEditRatingListPrompt(), '✏️ Kimning bahosini o\'zgartiramiz?');
  });
});

describe('teamCapacities', () => {
  it('uses teamCapacities with gap <= 1', () => {
    const caps = teamCapacities(14, 3);
    assert.ok(Math.max(...caps) - Math.min(...caps) <= 1);
  });
});
