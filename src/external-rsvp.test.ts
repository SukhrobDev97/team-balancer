import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearBotUsernameForTests,
  getBotUsername,
  initBotUsernameFromEnv,
  resolveBotUsernameAtStartup,
  setBotUsername,
} from './bot-config.js';
import {
  buildJoinDeepLink,
  buildShareUrl,
  canShowShareButton,
  externalRsvpCallbackRows,
  formatExternalRsvpCard,
  formatShareText,
  isExternalRsvpParticipant,
  isValidJoinMatchId,
} from './external-rsvp.js';
import {
  editMatchMessage,
  formatMatchCard,
  generateMatchId,
  getMatch,
  matches,
  tryJoinMatch,
  tryLeaveMatch,
} from './match.js';
import { matchCardKeyboard, externalRsvpKeyboard } from './match-keyboards.js';
import { handleExternalRsvpStart } from './match-handlers.js';
import {
  generateTeamsForMatch,
  participantsToPlayers,
  sortedParticipants,
} from './match-preparation.js';
import { MatchSession } from './types.js';
import { matchTelegramExtra } from './utils.js';
import { mt } from './match-i18n.js';

function emptyMatch(overrides: Partial<MatchSession> = {}): MatchSession {
  return {
    id: 'mabcdefghij',
    chatId: -1001,
    messageId: 42,
    organizerTelegramId: 111,
    language: 'uz',
    dateLabel: 'Seshanba',
    time: '20:00',
    location: 'Chonnam & Co',
    capacity: 15,
    participants: [],
    status: 'OPEN',
    createdAt: Date.now(),
    ...overrides,
  };
}

function flatButtons(
  keyboard: ReturnType<typeof matchCardKeyboard>,
): { text: string; url?: string; callback_data?: string }[] {
  return keyboard.reply_markup.inline_keyboard.flat();
}

function privateButtons(
  keyboard: ReturnType<typeof externalRsvpKeyboard>,
): { callback_data?: string; url?: string }[] {
  return keyboard.reply_markup.inline_keyboard.flat() as {
    callback_data?: string;
    url?: string;
  }[];
}

describe('external RSVP share', () => {
  beforeEach(() => {
    setBotUsername('bolinvol_bot');
    matches.clear();
  });

  it('shows share button when OPEN with short Uzbek label', () => {
    const buttons = flatButtons(matchCardKeyboard(emptyMatch()));
    const share = buttons.find((b) => b.url?.includes('t.me/share/url'));
    assert.ok(share);
    assert.equal(share!.text, mt('uz', 'matchShare'));
    assert.equal(share!.text, '📤 Ulashish');
  });

  it('shows share button when FULL', () => {
    const match = emptyMatch({ status: 'FULL', capacity: 1 });
    match.participants.push({ telegramId: 1, displayName: 'A', joinedAt: 1 });
    const buttons = flatButtons(matchCardKeyboard(match));
    assert.ok(buttons.some((b) => b.url?.includes('t.me/share/url')));
  });

  it('hides share when CLOSED', () => {
    const buttons = flatButtons(matchCardKeyboard(emptyMatch({ status: 'CLOSED' })));
    assert.equal(buttons.some((b) => b.url?.includes('t.me/share/url')), false);
  });

  it('hides share when CANCELLED', () => {
    const buttons = flatButtons(
      matchCardKeyboard(emptyMatch({ status: 'CANCELLED' })),
    );
    assert.equal(buttons.some((b) => b.url?.includes('t.me/share/url')), false);
  });

  it('hides share when team prep locked', () => {
    const buttons = flatButtons(
      matchCardKeyboard(
        emptyMatch({
          teamPreparation: { locked: true, ratings: {} },
        }),
      ),
    );
    assert.equal(buttons.some((b) => b.url?.includes('t.me/share/url')), false);
  });

  it('share URL contains join_<matchId>', () => {
    const match = emptyMatch();
    const url = buildShareUrl(match);
    assert.match(url, /join_mabcdefghij/);
    assert.match(decodeURIComponent(url), /start=join_mabcdefghij/);
  });

  it('share URL encodes special characters in date/location', () => {
    const match = emptyMatch({
      dateLabel: 'Seshanba & Co',
      location: 'Chonnam?yes',
    });
    const url = buildShareUrl(match);
    const parsed = new URL(url);
    const textParam = parsed.searchParams.get('text') ?? '';
    const urlParam = parsed.searchParams.get('url') ?? '';
    assert.match(textParam, /Seshanba & Co/);
    assert.match(textParam, /Chonnam\?yes/);
    assert.match(urlParam, /start=join_mabcdefghij/);
    assert.doesNotMatch(textParam, /t\.me\/bolinvol_bot/);
  });

  it('does not duplicate deep link in share text parameter', () => {
    const match = emptyMatch();
    const text = formatShareText(match);
    assert.doesNotMatch(text, /t\.me\//);
    const parsed = new URL(buildShareUrl(match));
    assert.doesNotMatch(parsed.searchParams.get('text') ?? '', /t\.me\//);
    assert.match(parsed.searchParams.get('url') ?? '', /start=join_mabcdefghij/);
  });

  it('hides share button when bot username is unavailable', () => {
    clearBotUsernameForTests();
    const buttons = flatButtons(matchCardKeyboard(emptyMatch()));
    assert.equal(buttons.some((b) => b.url?.includes('t.me/share/url')), false);
    setBotUsername('bolinvol_bot');
  });

  it('canShowShareButton matches keyboard visibility rules', () => {
    assert.equal(canShowShareButton(emptyMatch()), true);
    assert.equal(canShowShareButton(emptyMatch({ status: 'FULL' })), true);
    assert.equal(canShowShareButton(emptyMatch({ status: 'CLOSED' })), false);
    assert.equal(
      canShowShareButton(
        emptyMatch({ teamPreparation: { locked: true, ratings: {} } }),
      ),
      false,
    );
  });
});

describe('external RSVP deep link validation', () => {
  it('accepts valid match ids', () => {
    assert.equal(isValidJoinMatchId('mabcdefghij'), true);
    assert.equal(isValidJoinMatchId(generateMatchId()), true);
  });

  it('rejects invalid match ids', () => {
    assert.equal(isValidJoinMatchId(''), false);
    assert.equal(isValidJoinMatchId('mshort'), false);
    assert.equal(isValidJoinMatchId('xabcdefghij'), false);
    assert.equal(isValidJoinMatchId('mABCDEFGHIJ'), false);
  });

  it('keeps start payload within Telegram limit', () => {
    const id = generateMatchId();
    const payload = `join_${id}`;
    assert.ok(payload.length <= 64);
  });
});

describe('external RSVP private card', () => {
  it('shows not-joined state with join action', () => {
    const match = emptyMatch();
    const text = formatExternalRsvpCard(match, 999);
    assert.match(text, /ro'yxatda emassiz/i);
    const rows = externalRsvpCallbackRows(match, 999);
    assert.equal(rows.length, 1);
    assert.match(rows[0]!.callback_data, /^mj:/);
  });

  it('shows joined state with leave action', () => {
    const match = emptyMatch();
    tryJoinMatch(match, { telegramId: 999, displayName: 'Guest' });
    const text = formatExternalRsvpCard(match, 999);
    assert.match(text, /ro'yxatdasiz/i);
    const rows = externalRsvpCallbackRows(match, 999);
    assert.equal(rows.length, 1);
    assert.match(rows[0]!.callback_data, /^ml:/);
  });

  it('shows full-no-spot state without join for non-participant', () => {
    const match = emptyMatch({ capacity: 1, status: 'FULL' });
    match.participants.push({ telegramId: 1, displayName: 'A', joinedAt: 1 });
    const text = formatExternalRsvpCard(match, 999);
    assert.match(text, /Joy qolmadi/);
    assert.doesNotMatch(text, /TARKIB TO'LDI/);
    assert.equal(externalRsvpCallbackRows(match, 999).length, 0);
  });

  it('allows leave when FULL and joined', () => {
    const match = emptyMatch({ capacity: 1, status: 'FULL' });
    match.participants.push({ telegramId: 999, displayName: 'Guest', joinedAt: 1 });
    assert.equal(externalRsvpCallbackRows(match, 999).length, 1);
  });

  it('shows closed state without actions', () => {
    const match = emptyMatch({ status: 'CLOSED' });
    assert.match(formatExternalRsvpCard(match, 999), /yopildi/i);
    assert.equal(externalRsvpCallbackRows(match, 999).length, 0);
  });

  it('shows cancelled state without actions', () => {
    const match = emptyMatch({ status: 'CANCELLED' });
    assert.match(formatExternalRsvpCard(match, 999), /bekor/i);
    assert.equal(externalRsvpCallbackRows(match, 999).length, 0);
  });

  it('shows locked state without actions', () => {
    const match = emptyMatch({
      teamPreparation: { locked: true, ratings: {} },
    });
    assert.match(formatExternalRsvpCard(match, 999), /qulflangan/i);
    assert.equal(externalRsvpCallbackRows(match, 999).length, 0);
  });
});

describe('external RSVP start handler', () => {
  beforeEach(() => {
    matches.clear();
  });

  it('renders private RSVP card for valid match', async () => {
    const match = emptyMatch();
    matches.set(match.id, match);
    const replies: string[] = [];
    await handleExternalRsvpStart(
      {
        chat: { type: 'private', id: 999 },
        reply: async (text: string) => {
          replies.push(text);
          return { message_id: 1 };
        },
      } as never,
      999,
      match.id,
    );
    assert.equal(replies.length, 1);
    assert.match(replies[0]!, /Chonnam/);
    assert.match(replies[0]!, /0 \/ 15/);
  });

  it('returns friendly error for missing match', async () => {
    const replies: string[] = [];
    await handleExternalRsvpStart(
      {
        chat: { type: 'private', id: 999 },
        reply: async (text: string) => {
          replies.push(text);
          return { message_id: 1 };
        },
      } as never,
      999,
      'mabcdefghij',
    );
    assert.match(replies[0]!, /topilmadi|eskirgan/i);
  });

  it('rejects non-private chat', async () => {
    const match = emptyMatch();
    matches.set(match.id, match);
    const replies: string[] = [];
    await handleExternalRsvpStart(
      {
        chat: { type: 'group', id: -100 },
        reply: async (text: string) => {
          replies.push(text);
          return { message_id: 1 };
        },
      } as never,
      999,
      match.id,
    );
    assert.match(replies[0]!, /shaxsiy chat/i);
  });
});

describe('external RSVP participant reuse', () => {
  beforeEach(() => {
    matches.clear();
  });

  it('stores external user in same participants array', () => {
    const match = emptyMatch();
    matches.set(match.id, match);
    assert.equal(
      tryJoinMatch(match, { telegramId: 555, displayName: 'External' }),
      'joined',
    );
    assert.equal(match.participants.length, 1);
    assert.equal(match.participants[0]!.telegramId, 555);
  });

  it('does not duplicate group + external join by telegramId', () => {
    const match = emptyMatch();
    matches.set(match.id, match);
    tryJoinMatch(match, { telegramId: 555, displayName: 'Same User' });
    assert.equal(
      tryJoinMatch(match, { telegramId: 555, displayName: 'Same User' }),
      'already',
    );
    assert.equal(match.participants.length, 1);
  });

  it('removes external participant on leave', () => {
    const match = emptyMatch();
    tryJoinMatch(match, { telegramId: 555, displayName: 'External' });
    assert.equal(tryLeaveMatch(match, 555), 'left');
    assert.equal(match.participants.length, 0);
  });

  it('respects FULL capacity for external join', () => {
    const match = emptyMatch({ capacity: 1 });
    tryJoinMatch(match, { telegramId: 1, displayName: 'A' });
    assert.equal(match.status, 'FULL');
    assert.equal(
      tryJoinMatch(match, { telegramId: 2, displayName: 'B' }),
      'full',
    );
  });

  it('respects CLOSED for external join', () => {
    const match = emptyMatch({ status: 'CLOSED' });
    assert.equal(
      tryJoinMatch(match, { telegramId: 2, displayName: 'B' }),
      'closed',
    );
  });

  it('respects CANCELLED for external join', () => {
    const match = emptyMatch({ status: 'CANCELLED' });
    assert.equal(
      tryJoinMatch(match, { telegramId: 2, displayName: 'B' }),
      'closed',
    );
  });

  it('respects team prep lock for external join/leave', () => {
    const match = emptyMatch({
      teamPreparation: { locked: true, ratings: {} },
    });
    match.participants.push({ telegramId: 1, displayName: 'A', joinedAt: 1 });
    assert.equal(
      tryJoinMatch(match, { telegramId: 2, displayName: 'B' }),
      'locked',
    );
    assert.equal(tryLeaveMatch(match, 1), 'locked');
  });

  it('includes external participant in team-prep roster', () => {
    const match = emptyMatch({ capacity: 3, status: 'FULL' });
    tryJoinMatch(match, { telegramId: 1, displayName: 'G1' });
    tryJoinMatch(match, { telegramId: 2, displayName: 'G2' });
    tryJoinMatch(match, { telegramId: 555, displayName: 'External' });
    const roster = sortedParticipants(match);
    assert.equal(roster.length, 3);
    assert.ok(roster.some((p) => p.telegramId === 555));
    match.teamPreparation = { locked: true, ratings: {} };
    for (const p of match.participants) {
      match.teamPreparation.ratings[`t${p.telegramId}`] = 'C';
    }
    const players = participantsToPlayers(match);
    assert.equal(players.length, 3);
    assert.ok(players.some((p) => p.id === 't555'));
  });

  it('team generation works with external participant', () => {
    const match = emptyMatch({ capacity: 6, status: 'FULL' });
    for (let i = 0; i < 5; i++) {
      tryJoinMatch(match, { telegramId: 100 + i, displayName: `P${i}` });
    }
    tryJoinMatch(match, { telegramId: 555, displayName: 'External' });
    match.teamPreparation = { locked: true, ratings: {} };
    for (const p of match.participants) {
      match.teamPreparation.ratings[`t${p.telegramId}`] = 'C';
    }
    match.teamPreparation.teamCount = 2;
    const teams = generateTeamsForMatch(match);
    assert.ok(teams);
    assert.equal(teams.length, 2);
    const allIds = teams.flatMap((t) => t.players.map((p) => p.id));
    assert.ok(allIds.includes('t555'));
  });
});

describe('group card sync via editMatchMessage', () => {
  it('preserves messageThreadId when updating group card', async () => {
    const match = emptyMatch({ messageThreadId: 777 });
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
    assert.deepEqual(edits[0], matchTelegramExtra(match, matchCardKeyboard(match)));
    assert.equal((edits[0] as { message_thread_id?: number }).message_thread_id, 777);
  });
});

describe('share text and deep link helpers', () => {
  beforeEach(() => {
    setBotUsername('bolinvol_bot');
  });

  it('builds join deep link without hard-coded username in domain logic consumer', () => {
    assert.equal(
      buildJoinDeepLink('mabcdefghij'),
      'https://t.me/bolinvol_bot?start=join_mabcdefghij',
    );
  });

  it('formatShareText includes match summary and invite line without link', () => {
    const text = formatShareText(emptyMatch());
    assert.match(text, /Seshanba — 20:00/);
    assert.match(text, /Chonnam/);
    assert.match(text, /O'yinga qo'shilish/i);
    assert.doesNotMatch(text, /t\.me\//);
  });
});

describe('share button i18n labels', () => {
  it('uses short Uzbek share label', () => {
    assert.equal(mt('uz', 'matchShare'), '📤 Ulashish');
  });

  it('uses short Russian share label', () => {
    assert.equal(mt('ru', 'matchShare'), '📤 Поделиться');
  });

  it('uses short English share label', () => {
    assert.equal(mt('en', 'matchShare'), '📤 Share');
  });
});

describe('bot username handling', () => {
  afterEach(() => {
    clearBotUsernameForTests();
    delete process.env.BOT_USERNAME;
  });

  it('normalizes BOT_USERNAME without @', () => {
    setBotUsername('bolinvol_bot');
    assert.equal(getBotUsername(), 'bolinvol_bot');
  });

  it('normalizes BOT_USERNAME with @', () => {
    setBotUsername('@bolinvol_bot');
    assert.equal(getBotUsername(), 'bolinvol_bot');
  });

  it('trims whitespace from BOT_USERNAME', () => {
    setBotUsername('  @bolinvol_bot  ');
    assert.equal(getBotUsername(), 'bolinvol_bot');
  });

  it('loads username from env when valid', () => {
    clearBotUsernameForTests();
    process.env.BOT_USERNAME = '  @bolinvol_bot  ';
    assert.equal(initBotUsernameFromEnv(), true);
    assert.equal(getBotUsername(), 'bolinvol_bot');
  });

  it('falls back to getMe username', async () => {
    clearBotUsernameForTests();
    await resolveBotUsernameAtStartup(async () => ({ username: 'from_getme' }));
    assert.equal(getBotUsername(), 'from_getme');
  });

  it('missing username does not throw during resolution', async () => {
    clearBotUsernameForTests();
    await assert.doesNotReject(async () => {
      await resolveBotUsernameAtStartup(async () => ({}));
    });
  });
});

describe('existing group attendance unchanged', () => {
  it('group join still works', () => {
    const match = emptyMatch();
    assert.equal(
      tryJoinMatch(match, { telegramId: 1, displayName: 'Group User' }),
      'joined',
    );
    assert.equal(isExternalRsvpParticipant(match, 1), true);
  });

  it('group leave still works', () => {
    const match = emptyMatch();
    tryJoinMatch(match, { telegramId: 1, displayName: 'Group User' });
    assert.equal(tryLeaveMatch(match, 1), 'left');
  });

  it('group card keyboard still has join/leave in OPEN state', () => {
    const buttons = flatButtons(matchCardKeyboard(emptyMatch()));
    assert.ok(buttons.some((b) => b.callback_data?.startsWith('mj:')));
    assert.ok(buttons.some((b) => b.callback_data?.startsWith('ml:')));
  });
});

describe('no external participant store', () => {
  it('resolves match only through matches map', () => {
    const match = emptyMatch();
    matches.set(match.id, match);
    assert.equal(getMatch(match.id), match);
    matches.delete(match.id);
    assert.equal(getMatch(match.id), undefined);
  });
});

describe('private RSVP keyboard callbacks reuse mj/ml', () => {
  it('uses mj/ml prefixes', () => {
    const match = emptyMatch();
    const joinBtns = privateButtons(externalRsvpKeyboard(match, 999));
    assert.equal(joinBtns[0]?.callback_data, 'mj:mabcdefghij');
    tryJoinMatch(match, { telegramId: 999, displayName: 'U' });
    const leaveBtns = privateButtons(externalRsvpKeyboard(match, 999));
    assert.equal(leaveBtns[0]?.callback_data, 'ml:mabcdefghij');
  });
});
