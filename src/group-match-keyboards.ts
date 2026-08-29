import { Markup } from 'telegraf';
import { draftCallback } from './group-match-setup.js';
import { mt } from './match-i18n.js';
import { GroupMatchDraft } from './types.js';

export function groupSetupCancelKeyboard(draft: GroupMatchDraft) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(mt(draft.language, 'matchCancel'), draftCallback('mcc', draft.id))],
  ]);
}

export function groupCapacityKeyboard(draft: GroupMatchDraft) {
  const draftId = draft.id;
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
      Markup.button.callback(mt(draft.language, 'matchCustomCapacity'), draftCallback('mco', draftId)),
      Markup.button.callback(mt(draft.language, 'matchCancel'), draftCallback('mcc', draftId)),
    ],
  ]);
}

export function groupPreviewKeyboard(draft: GroupMatchDraft) {
  const draftId = draft.id;
  return Markup.inlineKeyboard([
    [Markup.button.callback(mt(draft.language, 'matchOpenGame'), draftCallback('mcf', draftId))],
    [
      Markup.button.callback(mt(draft.language, 'matchEdit'), draftCallback('mce', draftId)),
      Markup.button.callback(mt(draft.language, 'matchCancel'), draftCallback('mcc', draftId)),
    ],
  ]);
}

export function groupEditMenuKeyboard(draft: GroupMatchDraft) {
  const draftId = draft.id;
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        mt(draft.language, 'matchEditDetailsMenu'),
        draftCallback('mced', draftId),
      ),
    ],
    [Markup.button.callback(mt(draft.language, 'matchEditCapacityMenu'), draftCallback('mcec', draftId))],
    [Markup.button.callback(mt(draft.language, 'matchBack'), draftCallback('mcb', draftId))],
  ]);
}
