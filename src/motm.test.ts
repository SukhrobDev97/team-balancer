import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isCallbackDataSafe } from './match.js';
import { publishedTeamsKeyboard } from './match-keyboards.js';
import { participantPlayerId } from './match-preparation.js';
import {
  areTeamsPublished,
  canStartMotm,
  castVote,
  finishMotm,
  formatMotmOpenText,
  formatMotmResultText,
  motmCallback,
  motmStatus,
  motmVoteCount,
  startMotm,
  tallyVotes,
} from './motm.js';
import { motmVotingKeyboard } from './motm-keyboards.js';
import {
  fillMotmName,
  MOTM_TIE_TEMPLATES,
  MOTM_WINNER_TEMPLATES,
} from './motm-messages.js';
import { MatchSession, PlayerTier } from './types.js';

function publishedMatch(
  names: string[],
  overrides: Partial<MatchSession> = {},
): MatchSession {
  const participants = names.map((displayName, i) => ({
    telegramId: 1000 + i,
    displayName,
    joinedAt: i * 1000,
  }));
  const ratings = Object.fromEntries(
    participants.map((p) => [participantPlayerId(p.telegramId), 'B' as PlayerTier]),
  );
  return {
    id: 'mtestmotm01',
    chatId: -100,
    messageId: 1,
    organizerTelegramId: 42,
    dateLabel: 'Juma',
    time: '21:00',
    location: 'Arena',
    capacity: Math.max(16, names.length),
    participants,
    status: 'CLOSED',
    createdAt: Date.now(),
    teamsPublishedAt: Date.now(),
    teamsMessageId: 99,
    teamPreparation: {
      locked: true,
      ratings,
      generatedTeams: [
        { index: 0, players: [], skillScore: 5, maxPlayers: 2 },
        { index: 1, players: [], skillScore: 5, maxPlayers: 2 },
      ],
    },
    ...overrides,
  };
}

function pid(telegramId: number): string {
  return participantPlayerId(telegramId);
}

function vote(match: MatchSession, voterId: number, targetId: number) {
  return castVote(match, voterId, pid(targetId));
}

function keyboardData(match: MatchSession, page?: number) {
  return motmVotingKeyboard(match, page).reply_markup.inline_keyboard;
}

function callbackData(btn: object): string {
  return 'callback_data' in btn && typeof btn.callback_data === 'string'
    ? btn.callback_data
    : '';
}

describe('MOTM availability', () => {
  it('cannot start before teams are published', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur'], {
      teamsPublishedAt: undefined,
      teamPreparation: { locked: true, ratings: {} },
    });
    assert.equal(areTeamsPublished(match), false);
    assert.deepEqual(canStartMotm(match, 1000), {
      ok: false,
      reason: 'not_published',
    });
  });

  it('roster participant can start MOTM after publish', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    assert.equal(startMotm(match, 1000).ok, true);
    assert.equal(motmStatus(match), 'OPEN');
    assert.equal(match.motm?.startedByTelegramId, 1000);
  });

  it('non-participant cannot start', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    assert.deepEqual(canStartMotm(match, 99), {
      ok: false,
      reason: 'not_participant',
    });
  });

  it('organizer can start even if not on roster', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    assert.equal(startMotm(match, 42).ok, true);
  });

  it('only one MOTM lifecycle per match', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    assert.equal(startMotm(match, 1000).ok, true);
    assert.deepEqual(startMotm(match, 1001), {
      ok: false,
      reason: 'already_open',
    });
    vote(match, 1000, 1001);
    assert.equal(finishMotm(match, 1000, Date.now(), () => 0).ok, true);
    assert.deepEqual(startMotm(match, 1001), {
      ok: false,
      reason: 'already_finished',
    });
    assert.equal(motmStatus(match), 'FINISHED');
  });
});

describe('MOTM voting rules', () => {
  it('roster participant can vote', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    const result = vote(match, 1000, 1001);
    assert.deepEqual(result, {
      ok: true,
      kind: 'first',
      displayName: 'Aziz',
    });
    assert.equal(match.motm!.votes['1000'], pid(1001));
  });

  it('outsider cannot vote', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    const before = { ...match.motm!.votes };
    assert.deepEqual(vote(match, 99, 1001), {
      ok: false,
      reason: 'not_participant',
    });
    assert.deepEqual(match.motm!.votes, before);
  });

  it('self-vote is rejected', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    assert.deepEqual(vote(match, 1000, 1000), {
      ok: false,
      reason: 'self',
    });
    assert.equal(motmVoteCount(match.motm!), 0);
  });

  it('first vote is stored', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1002, 1000);
    assert.equal(match.motm!.votes['1002'], pid(1000));
    assert.equal(motmVoteCount(match.motm!), 1);
  });

  it('same vote repeated does not duplicate', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1000, 1001);
    const again = vote(match, 1000, 1001);
    assert.deepEqual(again, {
      ok: true,
      kind: 'same',
      displayName: 'Aziz',
    });
    assert.equal(motmVoteCount(match.motm!), 1);
    assert.equal(tallyVotes(match)[0]?.votes, 1);
  });

  it('vote can be changed and previous choice is removed', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1000, 1001);
    const changed = vote(match, 1000, 1002);
    assert.deepEqual(changed, {
      ok: true,
      kind: 'changed',
      displayName: 'Jasur',
    });
    assert.equal(match.motm!.votes['1000'], pid(1002));
    const tallied = tallyVotes(match);
    assert.equal(tallied.length, 1);
    assert.equal(tallied[0]?.participantId, pid(1002));
    assert.equal(tallied[0]?.votes, 1);
  });

  it('one Telegram ID has exactly one vote', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1000, 1001);
    vote(match, 1000, 1002);
    vote(match, 1000, 1003);
    assert.equal(Object.keys(match.motm!.votes).length, 1);
    assert.equal(motmVoteCount(match.motm!), 1);
  });

  it('vote counts follow the vote map', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1000, 1001);
    vote(match, 1002, 1001);
    vote(match, 1003, 1000);
    assert.equal(motmVoteCount(match.motm!), 3);
    const byId = Object.fromEntries(
      tallyVotes(match).map((r) => [r.participantId, r.votes]),
    );
    assert.equal(byId[pid(1001)], 2);
    assert.equal(byId[pid(1000)], 1);
  });
});

describe('MOTM open formatting', () => {
  it('does not expose live leaders', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1000, 1001);
    vote(match, 1002, 1001);
    vote(match, 1003, 1000);
    const text = formatMotmOpenText(match);
    assert.match(text, /🗳 3 \/ 4 ovoz berildi/);
    assert.doesNotMatch(text, /🥇|🥈|🥉/);
    assert.doesNotMatch(text, /Sardor —/);
    assert.doesNotMatch(text, /Aziz —/);
    for (const p of match.participants) {
      assert.equal(text.includes(p.displayName), false);
    }
  });
});

describe('MOTM finalization', () => {
  it('rejects zero-vote finalization', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    assert.deepEqual(finishMotm(match, 1000), {
      ok: false,
      reason: 'no_votes',
    });
    assert.equal(motmStatus(match), 'OPEN');
  });

  it('starter can finish', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1001);
    vote(match, 1000, 1001);
    assert.equal(finishMotm(match, 1001, Date.now(), () => 0).ok, true);
    assert.equal(motmStatus(match), 'FINISHED');
  });

  it('organizer can finish', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1001, 1000);
    assert.equal(finishMotm(match, 42, Date.now(), () => 0).ok, true);
  });

  it('unrelated participant cannot finish', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1001, 1000);
    assert.deepEqual(finishMotm(match, 1002), {
      ok: false,
      reason: 'not_authorized',
    });
    assert.equal(motmStatus(match), 'OPEN');
  });

  it('calculates a single winner and top 3', () => {
    const names = [
      'Sardor',
      'Aziz',
      'Jasur',
      'Temur',
      'Bekzod',
      'Sanjar',
      'Ali',
      'Rustam',
      'Javlon',
      'Dilshod',
    ];
    const match = publishedMatch(names);
    startMotm(match, 1000);
    const ballots: Array<[number, number]> = [
      [1001, 1000],
      [1002, 1000],
      [1003, 1000],
      [1004, 1000],
      [1000, 1001],
      [1005, 1001],
      [1006, 1001],
      [1007, 1002],
      [1008, 1002],
      [1009, 1003],
    ];
    for (const [voter, target] of ballots) {
      const r = vote(match, voter, target);
      assert.equal(r.ok, true);
    }
    assert.equal(finishMotm(match, 42, Date.now(), () => 0).ok, true);
    const podium = match.motm!.podium!;
    assert.equal(podium.length, 3);
    assert.deepEqual(
      podium.map((p) => [p.displayName, p.votes, p.place]),
      [
        ['Sardor', 4, 1],
        ['Aziz', 3, 2],
        ['Jasur', 2, 3],
      ],
    );
    assert.deepEqual(match.motm!.winnerParticipantIds, [pid(1000)]);
    const text = formatMotmResultText(match);
    assert.match(text, /🥇 Sardor — 4 ovoz/);
    assert.match(text, /🥈 Aziz — 3 ovoz/);
    assert.match(text, /🥉 Jasur — 2 ovoz/);
    assert.match(text, /👑 Bugungi MOTM: SARDOR/);
    assert.doesNotMatch(text, /Temur/);
  });

  it('omits zero-vote players from the podium', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1001, 1000);
    vote(match, 1002, 1000);
    vote(match, 1003, 1001);
    finishMotm(match, 1000, Date.now(), () => 0);
    const names = match.motm!.podium!.map((p) => p.displayName);
    assert.deepEqual(names, ['Sardor', 'Aziz']);
    assert.equal(names.includes('Jasur'), false);
    assert.equal(names.includes('Temur'), false);
  });

  it('returns joint winners on a first-place tie', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1002, 1000);
    vote(match, 1003, 1001);
    finishMotm(match, 1000, Date.now(), () => 0);
    const podium = match.motm!.podium!;
    assert.equal(podium[0]?.place, 1);
    assert.equal(podium[1]?.place, 1);
    assert.deepEqual(
      match.motm!.winnerParticipantIds?.sort(),
      [pid(1000), pid(1001)].sort(),
    );
    const text = formatMotmResultText(match);
    assert.match(text, /🥇 Sardor — 1 ovoz/);
    assert.match(text, /🥇 Aziz — 1 ovoz/);
    assert.match(text, /Sardor & Aziz/);
    assert.doesNotMatch(text, /Bugungi MOTM: SARDOR\n/);
  });
});

describe('MOTM jokes', () => {
  it('selects a single-winner joke', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1001, 1000);
    finishMotm(match, 1000, Date.now(), () => 0);
    const joke = match.motm!.finalJoke!;
    const expected = MOTM_WINNER_TEMPLATES.map((t) => fillMotmName(t, 'Sardor'));
    assert.ok(expected.includes(joke));
    assert.match(joke, /Sardor/);
  });

  it('selects a tie joke', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1002, 1000);
    vote(match, 1003, 1001);
    finishMotm(match, 1000, Date.now(), () => 0);
    const joke = match.motm!.finalJoke!;
    assert.ok(MOTM_TIE_TEMPLATES.includes(joke));
    const winnerJokes = MOTM_WINNER_TEMPLATES.map((t) =>
      fillMotmName(t, 'Sardor'),
    );
    assert.equal(winnerJokes.includes(joke), false);
  });

  it('keeps the final joke stable after finalization', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1001, 1000);
    finishMotm(match, 1000, Date.now(), () => 0);
    const joke = match.motm!.finalJoke!;
    const text = formatMotmResultText(match);
    finishMotm(match, 42, Date.now(), () => 0.99);
    assert.equal(match.motm!.finalJoke, joke);
    assert.equal(formatMotmResultText(match), text);
  });

  it('has enough winner and tie templates', () => {
    assert.ok(MOTM_WINNER_TEMPLATES.length >= 15);
    assert.ok(MOTM_TIE_TEMPLATES.length >= 5);
  });
});

describe('MOTM after finish', () => {
  it('rejects votes after FINISHED', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1001, 1000);
    finishMotm(match, 1000, Date.now(), () => 0);
    const snapshot = { ...match.motm!.votes };
    assert.deepEqual(vote(match, 1002, 1001), {
      ok: false,
      reason: 'finished',
    });
    assert.deepEqual(match.motm!.votes, snapshot);
  });

  it('finalization is idempotent', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1001, 1000);
    vote(match, 1002, 1001);
    const first = finishMotm(match, 1000, 1, () => 0);
    const podium = JSON.stringify(match.motm!.podium);
    const joke = match.motm!.finalJoke;
    const second = finishMotm(match, 42, 2, () => 0.99);
    assert.deepEqual(first, { ok: true, alreadyFinished: false });
    assert.deepEqual(second, { ok: true, alreadyFinished: true });
    assert.equal(match.motm!.finalJoke, joke);
    assert.equal(JSON.stringify(match.motm!.podium), podium);
    assert.equal(match.motm!.finishedAt, 1);
  });
});

describe('MOTM identities and callbacks', () => {
  it('does not collide on duplicate display names', () => {
    const match = publishedMatch(['Sardor', 'Sardor', 'Aziz', 'Temur']);
    startMotm(match, 1000);
    vote(match, 1002, 1000);
    vote(match, 1003, 1001);
    const tallied = tallyVotes(match);
    assert.equal(tallied.length, 2);
    assert.equal(tallied[0]?.displayName, 'Sardor');
    assert.equal(tallied[1]?.displayName, 'Sardor');
    assert.notEqual(tallied[0]?.participantId, tallied[1]?.participantId);
    finishMotm(match, 1000, Date.now(), () => 0);
    assert.equal(match.motm!.winnerParticipantIds?.length, 2);
  });

  it('keeps callback payloads short and id-based', () => {
    const match = publishedMatch(['Sardor Azizov', 'Aziz', 'Jasur', 'Temur']);
    const start = motmCallback('ms', match.id);
    const voteData = motmCallback('mv', match.id, pid(1000));
    const end = motmCallback('me', match.id);
    const page = motmCallback('mpg', match.id, '2');
    for (const data of [start, voteData, end, page]) {
      assert.equal(isCallbackDataSafe(data), true);
      assert.doesNotMatch(data, /Sardor/);
      assert.doesNotMatch(data, /Azizov/);
    }
    startMotm(match, 1000);
    const rows = keyboardData(match);
    for (const row of rows) {
      for (const btn of row) {
        assert.doesNotMatch(callbackData(btn), /Sardor/);
        assert.ok(callbackData(btn).length <= 64);
      }
    }
  });

  it('never shows A–E tiers in public MOTM text', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    const open = formatMotmOpenText(match);
    vote(match, 1001, 1000);
    finishMotm(match, 1000, Date.now(), () => 0);
    const result = formatMotmResultText(match);
    for (const text of [open, result]) {
      assert.doesNotMatch(text, / · [ABCDE]/);
      assert.doesNotMatch(text, /⭐/);
    }
  });

  it('adds MOTM to the published teams keyboard', () => {
    const kb = publishedTeamsKeyboard('mtestmotm01');
    const texts = kb.reply_markup.inline_keyboard.flat().map((b) => b.text);
    assert.ok(texts.includes('🏆 MOTM'));
    const motm = kb.reply_markup.inline_keyboard
      .flat()
      .find((b) => b.text === '🏆 MOTM');
    assert.equal(callbackData(motm ?? {}), 'ms:mtestmotm01');
  });

  it('uses two player buttons per row', () => {
    const match = publishedMatch(['Sardor', 'Aziz', 'Jasur', 'Temur']);
    startMotm(match, 1000);
    const rows = keyboardData(match);
    assert.equal(rows[0]?.length, 2);
    assert.equal(rows[1]?.length, 2);
    assert.equal(rows.at(-1)?.[0]?.text, '🏁 Ovoz berishni yakunlash');
  });
});
