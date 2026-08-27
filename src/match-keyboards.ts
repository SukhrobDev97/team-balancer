import { Markup } from 'telegraf';
import { MatchSession } from './types.js';
import { canPrepareTeams, matchCallbackData } from './match.js';

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
