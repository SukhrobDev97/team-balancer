import { Markup } from 'telegraf';
import { MatchSession } from './types.js';
import { canPrepareTeams, matchCallbackData } from './match.js';

export function groupMatchLinkKeyboard(deepLink: string) {
  return Markup.inlineKeyboard([
    [Markup.button.url('⚙️ O\'yinni sozlash', deepLink)],
  ]);
}

export function matchCapacityKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('10', 'ms_cap:10'),
      Markup.button.callback('12', 'ms_cap:12'),
      Markup.button.callback('14', 'ms_cap:14'),
    ],
    [
      Markup.button.callback('16', 'ms_cap:16'),
      Markup.button.callback('18', 'ms_cap:18'),
      Markup.button.callback('20', 'ms_cap:20'),
    ],
    [Markup.button.callback('✏️ Boshqa', 'ms_cap_custom')],
  ]);
}

export function matchPreviewKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📢 Groupga chiqarish', 'ms_publish')],
    [Markup.button.callback('✏️ O\'zgartirish', 'ms_edit')],
    [Markup.button.callback('❌ Bekor qilish', 'ms_cancel')],
  ]);
}

export function matchEditMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📅 Kun', 'ms_edit_date')],
    [Markup.button.callback('🕘 Vaqt', 'ms_edit_time')],
    [Markup.button.callback('📍 Joy', 'ms_edit_location')],
    [Markup.button.callback('👥 O\'yinchi soni', 'ms_edit_capacity')],
    [Markup.button.callback('⬅️ Orqaga', 'ms_back_preview')],
  ]);
}

export function matchCardKeyboard(match: MatchSession) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];

  if (!match.teamPreparation?.locked) {
    if (match.status === 'OPEN') {
      rows.push([
        Markup.button.callback('✅ Boraman', matchCallbackData('mj', match.id)),
        Markup.button.callback('❌ Bormayman', matchCallbackData('ml', match.id)),
      ]);
    } else if (match.status === 'FULL') {
      rows.push([
        Markup.button.callback('❌ Bormayman', matchCallbackData('ml', match.id)),
      ]);
    }
  }

  if (match.status !== 'CANCELLED') {
    rows.push([
      Markup.button.callback('👥 Ro\'yxat', matchCallbackData('mr', match.id)),
    ]);
  }

  if (match.status === 'OPEN' && !match.teamPreparation?.locked) {
    rows.push([
      Markup.button.callback(
        '🔒 Ro\'yxatni yopish',
        matchCallbackData('mcl', match.id),
      ),
    ]);
  }

  if (canPrepareTeams(match) && !match.teamPreparation?.locked) {
    rows.push([
      Markup.button.callback(
        '⚙️ Jamoalarni tayyorlash',
        matchCallbackData('mp', match.id),
      ),
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

export function publishedTeamsKeyboard(matchId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏆 MOTM', matchCallbackData('ms', matchId))],
    [Markup.button.callback('👥 Tarkib', matchCallbackData('mr', matchId))],
  ]);
}

export function matchRosterKeyboard(match: MatchSession) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Orqaga', matchCallbackData('mb', match.id))],
  ]);
}
