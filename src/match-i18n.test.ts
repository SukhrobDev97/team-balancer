import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MATCH_PARAM_KEYS, MATCH_STATIC_KEYS, mt } from './match-i18n.js';
import { setUserLanguage, getUserLanguage } from './user-language.js';
import { createMatchSession } from './match.js';
import { GroupMatchDraft } from './types.js';

describe('match i18n', () => {
  it('resolves all match keys for uz/ru/en', () => {
    for (const lang of ['uz', 'ru', 'en'] as const) {
      for (const key of MATCH_STATIC_KEYS) {
        assert.ok(mt(lang, key).length > 0, `${lang}.${key}`);
      }
      assert.ok(mt(lang, 'matchCountLine', { current: 1, capacity: 10 }).includes('1'));
      assert.ok(mt(lang, 'matchFullCapacity', { capacity: 10 }).includes('10'));
    }
  });

  it('returns Russian match card labels', () => {
    assert.equal(mt('ru', 'matchJoin'), '✅ Буду');
    assert.equal(mt('ru', 'matchPrepareTeams'), '⚙️ Подготовить команды');
  });

  it('returns English match card labels', () => {
    assert.equal(mt('en', 'matchJoin'), '✅ I\'m in');
    assert.equal(mt('en', 'matchPrepareTeams'), '⚙️ Prepare teams');
  });

  it('persists user language for match creation', () => {
    setUserLanguage(999, 'en');
    assert.equal(getUserLanguage(999), 'en');

    const draft: GroupMatchDraft = {
      id: 'dlang',
      chatId: -100,
      organizerTelegramId: 999,
      messageId: 1,
      language: getUserLanguage(999),
      step: 'PREVIEW',
      dateLabel: 'Fri',
      time: '21:00',
      location: 'Arena',
      capacity: 10,
      createdAt: Date.now(),
    };
    const match = createMatchSession(draft, 1);
    assert.equal(match.language, 'en');
  });
});
