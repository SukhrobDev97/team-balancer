import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED_LANGUAGES, staticMessageKeys, t } from './i18n.js';
import {
  addPlayers,
  emptySession,
  resetGame,
} from './game.js';
import { Language } from './types.js';

describe('i18n', () => {
  it('resolves all languages for static keys', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const key of staticMessageKeys()) {
        const msg = t(lang, key);
        assert.ok(msg.length > 0, `${lang}.${key} should not be empty`);
      }
    }
  });

  it('supports dynamic replacements', () => {
    assert.equal(
      t('uz', 'playersProgress', { current: 13, total: 20 }),
      "👥 O'yinchilar: 13 / 20",
    );
    assert.equal(
      t('ru', 'playersProgress', { current: 13, total: 20 }),
      '👥 Игроки: 13 / 20',
    );
    assert.equal(
      t('en', 'playersProgress', { current: 13, total: 20 }),
      '👥 Players: 13 / 20',
    );
    assert.equal(
      t('uz', 'playersAdded', { tier: 'A', count: 3 }),
      "✅ A darajaga 3 ta o'yinchi qo'shildi.",
    );
    assert.equal(
      t('en', 'balanceLabel', { diff: 1 }),
      '⚖️ Balance: Excellent',
    );
  });

  it('falls back to Uzbek without crashing', () => {
    const unknown = 'xx' as Language;
    assert.equal(
      t(unknown, 'startText'),
      t('uz', 'startText'),
    );
    assert.equal(
      t(unknown, 'playersProgress', { current: 1, total: 10 }),
      t('uz', 'playersProgress', { current: 1, total: 10 }),
    );
  });

  it('changing language preserves session data', () => {
    const session = emptySession(1, 'uz');
    session.playerCount = 6;
    session.teamCount = 2;
    addPlayers(session, ['Ali', 'Vali', 'Gani'], 'A');
    addPlayers(session, ['Doni', 'Eni', 'Fozil'], 'B');

    session.language = 'ru';
    assert.equal(session.players.length, 6);
    assert.equal(session.playerCount, 6);
    assert.equal(session.teamCount, 2);
    assert.equal(session.players[0]?.name, 'Ali');

    session.language = 'en';
    resetGame(session);
    assert.equal(session.language, 'en');
    assert.equal(session.players.length, 0);
    assert.equal(session.step, 'PLAYER_COUNT');
    assert.equal(session.playerCount, undefined);
  });
});
