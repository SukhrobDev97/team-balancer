import { Markup } from 'telegraf';
import { MatchSession, PLAYER_TIERS, PlayerTier } from './types.js';
import {
  prepCallback,
  ratingTierButtonLabel,
  validMatchTeamCounts,
} from './match-preparation.js';

export function teamSetupLinkKeyboard(deepLink: string) {
  return Markup.inlineKeyboard([
    [Markup.button.url('⚙️ Jamoalarni tayyorlash', deepLink)],
  ]);
}

export function ratingTierKeyboard(matchId: string, telegramId: number) {
  const row1 = ['A', 'B'] as PlayerTier[];
  const row2 = ['C', 'D', 'E'] as PlayerTier[];
  return Markup.inlineKeyboard([
    row1.map((tier) =>
      Markup.button.callback(
        ratingTierButtonLabel(tier),
        prepCallback('rt', matchId, `${telegramId}:${tier}`),
      ),
    ),
    row2.map((tier) =>
      Markup.button.callback(
        ratingTierButtonLabel(tier),
        prepCallback('rt', matchId, `${telegramId}:${tier}`),
      ),
    ),
  ]);
}

export function ratingSummaryKeyboard(matchId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎲 Jamoalarni tuzish', prepCallback('mts', matchId))],
    [Markup.button.callback('✏️ Darajalarni ko\'rish', prepCallback('mrv', matchId))],
    [Markup.button.callback('⬅️ Bekor qilish', prepCallback('mpx', matchId))],
  ]);
}

export function ratingReviewKeyboard(matchId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✏️ O\'zgartirish', prepCallback('mre', matchId))],
    [Markup.button.callback('⬅️ Orqaga', prepCallback('mrb', matchId))],
  ]);
}

export function ratingEditListKeyboard(match: MatchSession) {
  const prep = match.teamPreparation!;
  const rows = [...match.participants]
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => {
      const tier = prep.ratings[`t${p.telegramId}`] ?? '?';
      const label =
        p.displayName.length > 20
          ? `${p.displayName.slice(0, 19)}… · ${tier}`
          : `${p.displayName} · ${tier}`;
      return [
        Markup.button.callback(label, prepCallback('mep', match.id, String(p.telegramId))),
      ];
    });
  rows.push([Markup.button.callback('⬅️ Orqaga', prepCallback('mrv', match.id))]);
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
    [Markup.button.callback('📢 Groupga yuborish', prepCallback('mtp', matchId))],
    [Markup.button.callback('✏️ Darajalar', prepCallback('mrv', matchId))],
  ]);
}
