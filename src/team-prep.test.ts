import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allParticipantsRated,
  beginTeamPreparation,
  canStartTeamPreparation,
  createTeamSetupToken,
  formatPublicTeamResult,
  generateTeamsForMatch,
  isAttendanceLocked,
  isValidMatchTeamCount,
  participantsToPlayers,
  setRating,
  sortedParticipants,
  TEAM_SETUP_TOKEN_TTL_MS,
  validateTeamSetupToken,
  validMatchTeamCounts,
} from './match-preparation.js';
import {
  closeMatchRoster,
  isOrganizer,
  tryJoinMatch,
  tryLeaveMatch,
} from './match.js';
import { teamCapacities } from './team-balancer.js';
import { MatchSession } from './types.js';

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

  it('allows 3 participants', () => {
    const match = matchWithParticipants(3, { status: 'FULL' });
    assert.deepEqual(canStartTeamPreparation(match, 42), { ok: true });
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

describe('rating', () => {
  it('rates each participant by telegram id', () => {
    const match = matchWithParticipants(4);
    beginTeamPreparation(match);
    for (const p of sortedParticipants(match)) {
      setRating(match, p.telegramId, 'C');
    }
    assert.equal(allParticipantsRated(match), true);
    const players = participantsToPlayers(match);
    assert.equal(players.length, 4);
    assert.equal(new Set(players.map((p) => p.id)).size, 4);
  });

  it('handles duplicate display names', () => {
    const match = matchWithParticipants(2);
    match.participants[0]!.displayName = 'Sardor';
    match.participants[1]!.displayName = 'Sardor';
    beginTeamPreparation(match);
    setRating(match, 1000, 'A');
    setRating(match, 1001, 'B');
    const players = participantsToPlayers(match);
    assert.deepEqual(
      players.map((p) => p.tier).sort(),
      ['A', 'B'],
    );
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

  it('calculates valid team counts for 3 players', () => {
    const match = matchWithParticipants(3);
    assert.deepEqual(validMatchTeamCounts(match), [2, 3]);
  });

  it('rejects 3 teams for 4 players', () => {
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
    const sizes = teams.map((t) => t.players.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  });

  it('reshuffle preserves roster and tiers', () => {
    const match = matchWithParticipants(8);
    beginTeamPreparation(match);
    const tiers = ['A', 'B', 'C', 'D', 'E', 'A', 'B', 'C'] as const;
    sortedParticipants(match).forEach((p, i) => {
      setRating(match, p.telegramId, tiers[i]!);
    });
    match.teamPreparation!.teamCount = 2;
    const first = generateTeamsForMatch(match)!;
    const second = generateTeamsForMatch(match)!;
    const roster1 = first.flatMap((t) => t.players.map((p) => `${p.id}:${p.tier}`)).sort();
    const roster2 = second.flatMap((t) => t.players.map((p) => `${p.id}:${p.tier}`)).sort();
    assert.deepEqual(roster1, roster2);
  });

  it('uses teamCapacities with gap <= 1', () => {
    const caps = teamCapacities(14, 3);
    assert.ok(Math.max(...caps) - Math.min(...caps) <= 1);
  });
});

describe('public publish formatting', () => {
  it('strips A–E labels from group output', () => {
    const match = matchWithParticipants(4);
    beginTeamPreparation(match);
    for (const p of sortedParticipants(match)) {
      setRating(match, p.telegramId, 'A');
    }
    match.teamPreparation!.teamCount = 2;
    const teams = generateTeamsForMatch(match)!;
    const text = formatPublicTeamResult(teams);
    assert.doesNotMatch(text, / · [ABCDE]/);
    assert.doesNotMatch(text, /\n.* · A/);
    assert.match(text, /Sardor/);
  });
});

describe('team setup tokens', () => {
  it('is organizer-only', () => {
    const entry = createTeamSetupToken('mabc', 42);
    assert.deepEqual(validateTeamSetupToken(entry.token, 42), {
      ok: true,
      entry,
    });
    assert.deepEqual(validateTeamSetupToken(entry.token, 99), {
      ok: false,
      reason: 'wrong_user',
    });
  });

  it('rejects expired token', () => {
    const entry = createTeamSetupToken('mabc', 42, 0);
    assert.deepEqual(
      validateTeamSetupToken(entry.token, 42, TEAM_SETUP_TOKEN_TTL_MS + 1),
      { ok: false, reason: 'expired' },
    );
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
