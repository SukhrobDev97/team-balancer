import { Markup } from 'telegraf';
import { draftCallback } from './group-match-setup.js';

export function groupSetupCancelKeyboard(draftId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❌ Bekor qilish', draftCallback('mcc', draftId))],
  ]);
}

export function groupCapacityKeyboard(draftId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('10', draftCallback('mc', draftId, '10')),
      Markup.button.callback('12', draftCallback('mc', draftId, '12')),
      Markup.button.callback('14', draftCallback('mc', draftId, '14')),
    ],
    [
      Markup.button.callback('16', draftCallback('mc', draftId, '16')),
      Markup.button.callback('18', draftCallback('mc', draftId, '18')),
      Markup.button.callback('20', draftCallback('mc', draftId, '20')),
    ],
    [
      Markup.button.callback('✏️ Boshqa', draftCallback('mco', draftId)),
      Markup.button.callback('❌ Bekor qilish', draftCallback('mcc', draftId)),
    ],
  ]);
}

export function groupPreviewKeyboard(draftId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ O\'yinni ochish', draftCallback('mcf', draftId))],
    [
      Markup.button.callback('✏️ O\'zgartirish', draftCallback('mce', draftId)),
      Markup.button.callback('❌ Bekor qilish', draftCallback('mcc', draftId)),
    ],
  ]);
}

export function groupEditMenuKeyboard(draftId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '📅 Kun / 🕘 Vaqt / 📍 Joy',
        draftCallback('mced', draftId),
      ),
    ],
    [Markup.button.callback('👥 O\'yinchi soni', draftCallback('mcec', draftId))],
    [Markup.button.callback('⬅️ Orqaga', draftCallback('mcb', draftId))],
  ]);
}
