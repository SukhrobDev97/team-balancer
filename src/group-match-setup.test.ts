import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyParsedDetails,
  createGroupMatchDraft,
  draftCallback,
  draftKey,
  getGroupMatchDraft,
  groupMatchDrafts,
  groupMatchDraftsById,
  isDraftReadyToOpen,
  parseCustomCapacity,
  parseMatchDetails,
  removeGroupMatchDraft,
  replaceGroupMatchDraft,
  setDraftCapacity,
  shouldConsumeGroupMatchDraftText,
  shouldRouteGroupMatchText,
  updateDraftMessageId,
  draftTelegramExtra,
  isCanonicalDraftMessageId,
  isMissingEditTargetError,
} from './group-match-setup.js';
import { isGroupChatType } from './utils.js';
import { createMatchSession } from './match.js';
import { isCallbackDataSafe } from './match.js';
import { shouldHandlePrivateGameText } from './utils.js';

describe('parseMatchDetails', () => {
  it('parses 3-line input correctly', () => {
    const result = parseMatchDetails('Juma\n21:00\nMega Arena');
    assert.deepEqual(result, {
      ok: true,
      dateLabel: 'Juma',
      time: '21:00',
      location: 'Mega Arena',
    });
  });

  it('trims whitespace', () => {
    const result = parseMatchDetails('  Juma \n 21:00 \n Mega Arena ');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.dateLabel, 'Juma');
      assert.equal(result.time, '21:00');
      assert.equal(result.location, 'Mega Arena');
    }
  });

  it('joins line 3+ into location', () => {
    const result = parseMatchDetails('Juma\n21:00\nMega\nArena\nPark');
    assert.deepEqual(result, {
      ok: true,
      dateLabel: 'Juma',
      time: '21:00',
      location: 'Mega Arena Park',
    });
  });

  it('rejects fewer than 3 non-empty lines', () => {
    assert.deepEqual(parseMatchDetails('Juma\n21:00'), {
      ok: false,
      reason: 'too_few_lines',
    });
  });

  it('rejects invalid HH:MM', () => {
    assert.deepEqual(parseMatchDetails('Juma\n25:00\nMega Arena'), {
      ok: false,
      reason: 'invalid_time',
    });
  });
});

describe('group match draft lifecycle', () => {
  it('creates draft with organizer identity', () => {
    groupMatchDrafts.clear();
    groupMatchDraftsById.clear();
    const draft = createGroupMatchDraft(-100, 42, 99);
    assert.equal(draft.organizerTelegramId, 42);
    assert.equal(draft.chatId, -100);
    assert.equal(draft.step, 'MATCH_DETAILS');
    assert.equal(getGroupMatchDraft(-100, 42)?.id, draft.id);
  });

  it('replaces unfinished draft for same organizer in same group', () => {
    groupMatchDrafts.clear();
    groupMatchDraftsById.clear();
    const first = createGroupMatchDraft(-100, 42, 101);
    const second = replaceGroupMatchDraft(-100, 42, 202);
    assert.notEqual(first.id, second.id);
    assert.equal(groupMatchDrafts.size, 1);
    assert.equal(getGroupMatchDraft(-100, 42)?.id, second.id);
    assert.equal(second.messageId, 202);
    assert.equal(groupMatchDraftsById.has(first.id), false);
  });

  it('keeps different organizers and groups separate', () => {
    groupMatchDrafts.clear();
    groupMatchDraftsById.clear();
    const a = createGroupMatchDraft(-100, 42, 1);
    const b = createGroupMatchDraft(-100, 77, 2);
    const c = createGroupMatchDraft(-200, 42, 3);
    assert.equal(groupMatchDrafts.size, 3);
    assert.equal(draftKey(-100, 42), '-100:42');
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.id, c.id);
  });

  it('moves to capacity after valid details', () => {
    const draft = createGroupMatchDraft(-100, 42, 1);
    const parsed = parseMatchDetails('Juma\n21:00\nMega Arena');
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(applyParsedDetails(draft, parsed), 'CAPACITY');
    assert.equal(draft.dateLabel, 'Juma');
    assert.equal(draft.time, '21:00');
    assert.equal(draft.location, 'Mega Arena');
  });

  it('supports preset capacity and preview', () => {
    const draft = createGroupMatchDraft(-100, 42, 1);
    const parsed = parseMatchDetails('Juma\n21:00\nMega Arena');
    if (!parsed.ok) return;
    applyParsedDetails(draft, parsed);
    setDraftCapacity(draft, 16);
    assert.equal(draft.step, 'PREVIEW');
    assert.equal(isDraftReadyToOpen(draft), true);
  });

  it('validates custom capacity 1–50', () => {
    assert.equal(parseCustomCapacity('1'), 1);
    assert.equal(parseCustomCapacity('16'), 16);
    assert.equal(parseCustomCapacity('0'), null);
    assert.equal(parseCustomCapacity('51'), null);
    assert.equal(parseCustomCapacity('abc'), null);
  });

  it('creates MatchSession on confirm-ready draft', () => {
    const draft = createGroupMatchDraft(-100, 777, 55);
    const parsed = parseMatchDetails('Juma\n21:00\nMega Arena');
    if (!parsed.ok) return;
    applyParsedDetails(draft, parsed);
    setDraftCapacity(draft, 16);
    const match = createMatchSession(draft, draft.messageId);
    assert.equal(match.organizerTelegramId, 777);
    assert.equal(match.chatId, -100);
    assert.equal(match.messageId, 55);
    assert.equal(match.capacity, 16);
    removeGroupMatchDraft(draft);
    assert.equal(getGroupMatchDraft(-100, 777), undefined);
  });
});

describe('group text routing guards', () => {
  it('only organizer can consume draft text', () => {
    const draft = createGroupMatchDraft(-100, 42, 1);
    assert.equal(shouldConsumeGroupMatchDraftText(draft, 42), true);
    assert.equal(shouldConsumeGroupMatchDraftText(draft, 99), false);
    assert.equal(shouldConsumeGroupMatchDraftText(undefined, 42), false);
  });

  it('routes MATCH_DETAILS for both group and supergroup', () => {
    const draft = createGroupMatchDraft(-100, 42, 1);
    assert.equal(shouldRouteGroupMatchText('group', draft, 42), 'match_details');
    assert.equal(shouldRouteGroupMatchText('supergroup', draft, 42), 'match_details');
  });

  it('routes custom capacity for both group and supergroup', () => {
    const draft = createGroupMatchDraft(-100, 42, 1);
    draft.step = 'WAITING_CUSTOM_CAPACITY';
    assert.equal(shouldRouteGroupMatchText('group', draft, 42), 'custom_capacity');
    assert.equal(
      shouldRouteGroupMatchText('supergroup', draft, 42),
      'custom_capacity',
    );
  });

  it('ignores unrelated user text in group and supergroup', () => {
    const draft = createGroupMatchDraft(-100, 42, 1);
    assert.equal(shouldRouteGroupMatchText('group', draft, 99), 'ignore');
    assert.equal(shouldRouteGroupMatchText('supergroup', draft, 99), 'ignore');
  });

  it('ignores private chat for group match text routing', () => {
    const draft = createGroupMatchDraft(-100, 42, 1);
    assert.equal(shouldRouteGroupMatchText('private', draft, 42), 'ignore');
  });

  it('ignores normal group/supergroup text without active draft', () => {
    groupMatchDrafts.clear();
    groupMatchDraftsById.clear();
    assert.equal(shouldRouteGroupMatchText('group', undefined, 42), 'ignore');
    assert.equal(shouldRouteGroupMatchText('supergroup', undefined, 42), 'ignore');
  });

  it('does not route group /match through private menu handler', () => {
    assert.equal(shouldHandlePrivateGameText('group', '/match'), false);
    assert.equal(shouldHandlePrivateGameText('supergroup', '/match'), false);
  });
});

describe('group setup callbacks', () => {
  it('keeps callback payloads short and draft-scoped', () => {
    const cap = draftCallback('mc', 'dabc1234', '16');
    const open = draftCallback('mcf', 'dabc1234');
    const cancel = draftCallback('mcc', 'dabc1234');
    for (const data of [cap, open, cancel]) {
      assert.equal(isCallbackDataSafe(data), true);
      assert.ok(data.length <= 64);
      assert.doesNotMatch(data, /Mega Arena/);
    }
  });
});

describe('draft message ownership', () => {
  it('requires a positive bot message id for draft creation', () => {
    assert.throws(() => createGroupMatchDraft(-100, 42, 0));
    assert.throws(() => replaceGroupMatchDraft(-100, 42, 0));
    assert.equal(isCanonicalDraftMessageId(undefined), false);
    assert.equal(isCanonicalDraftMessageId(55), true);
  });

  it('stores the bot reply message id as canonical draft messageId', () => {
    groupMatchDrafts.clear();
    groupMatchDraftsById.clear();
    const botReplyMessageId = 88;
    const commandMessageId = 46;
    const draft = replaceGroupMatchDraft(-100, 42, botReplyMessageId);
    assert.equal(draft.messageId, botReplyMessageId);
    assert.notEqual(draft.messageId, commandMessageId);
  });

  it('replaces unfinished draft with a fresh bot message id on restart', () => {
    groupMatchDrafts.clear();
    groupMatchDraftsById.clear();
    const staleBotMessageId = 46;
    const freshBotMessageId = 91;
    replaceGroupMatchDraft(-100, 42, staleBotMessageId);
    const draft = replaceGroupMatchDraft(-100, 42, freshBotMessageId);
    assert.equal(draft.messageId, freshBotMessageId);
    assert.notEqual(draft.messageId, staleBotMessageId);
  });

  it('updates draft message id when stale edit fallback sends a new message', () => {
    const draft = createGroupMatchDraft(-100, 42, 70);
    updateDraftMessageId(draft, 95);
    assert.equal(draft.messageId, 95);
  });

  it('detects missing edit target errors for stale fallback', () => {
    assert.equal(
      isMissingEditTargetError('400: Bad Request: message to edit not found'),
      true,
    );
    assert.equal(isMissingEditTargetError('message is not modified'), false);
  });

  it('preserves forum topic thread id on draft messages', () => {
    groupMatchDrafts.clear();
    groupMatchDraftsById.clear();
    const draft = replaceGroupMatchDraft(-1004354302889, 42, 91, 12345);
    assert.equal(draft.messageThreadId, 12345);
    assert.deepEqual(draftTelegramExtra(draft), {
      message_thread_id: 12345,
    });
  });

  it('treats group and supergroup as supported group chats', () => {
    assert.equal(isGroupChatType('group'), true);
    assert.equal(isGroupChatType('supergroup'), true);
    assert.equal(isGroupChatType('private'), false);
  });
});
