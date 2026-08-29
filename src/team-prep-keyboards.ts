import { Markup } from 'telegraf';
import { MatchSession, PLAYER_TIERS, PlayerTier } from './types.js';
import {
  prepCallback,
  sortedParticipants,
  validMatchTeamCounts,
} from './match-preparation.js';
import { truncateLabel } from './utils.js';

export function ratingTierKeyboard(matchId: string, telegramId: number) {
  const row1 = ['A', 'B'] as PlayerTier[];
  const row2 = ['C', 'D', 'E'] as PlayerTier[];
  return Markup.inlineKeyboard([
    row1.map((tier) =>
      Markup.button.callback(
        tier,
        prepCallback('rt', matchId, `${telegramId}:${tier}`),
      ),
    ),
    row2.map((tier) =>
      Markup.button.callback(
        tier,
        prepCallback('rt', matchId, `${telegramId}:${tier}`),
      ),
    ),
  ]);
}

export function ratingSummaryKeyboard(matchId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✏️ Baholarni o\'zgartirish', prepCallback('mre', matchId))],
    [Markup.button.callback('➡️ Davom etish', prepCallback('mts', matchId))],
  ]);
}

export function ratingEditListKeyboard(match: MatchSession) {
  const rows = sortedParticipants(match).map((p) => {
    const label = truncateLabel(p.displayName, 28);
    return [
      Markup.button.callback(label, prepCallback('mep', match.id, String(p.telegramId))),
    ];
  });
  rows.push([Markup.button.callback('⬅️ Orqaga', prepCallback('mrb', match.id))]);
  return Markup.inlineKeyboard(rows);
}

export function ratingEditTierKeyboard(matchId: string, telegramId: number) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < PLAYER_TIERS.length; i += 3) {
    rows.push(
      PLAYER_TIERS.slice(i, i + 3).map((tier) =>
        Markup.button.callback(tier, prepCallback('rc', matchId, `${telegramId}:${tier}`)),
      ),
    );
  }
  rows.push([Markup.button.callback('⬅️ Orqaga', prepCallback('mre', matchId))]);
  return Markup.inlineKeyboard(rows);
}

export function teamCountKeyboard(match: MatchSession) {
  const options = validMatchTeamCounts(match);
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < options.length; i += 2) {
    rows.push(
      options.slice(i, i + 2).map((n) =>
        Markup.button.callback(`${n} ta`, prepCallback('mtc', match.id, String(n))),
      ),
    );
  }
  rows.push([Markup.button.callback('⬅️ Orqaga', prepCallback('mrb', match.id))]);
  return Markup.inlineKeyboard(rows);
}

export function teamPreviewKeyboard(matchId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔀 Qayta qurish', prepCallback('mtr', matchId))],
    [Markup.button.callback('✏️ Baholarni o\'zgartirish', prepCallback('mre', matchId))],
    [Markup.button.callback('✅ Tasdiqlash', prepCallback('mtp', matchId))],
  ]);
}
