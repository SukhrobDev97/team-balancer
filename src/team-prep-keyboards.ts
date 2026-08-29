import { Markup } from 'telegraf';
import { MatchSession, PLAYER_TIERS, PlayerTier } from './types.js';
import {
  prepCallback,
  sortedParticipants,
  validMatchTeamCounts,
} from './match-preparation.js';
import { mt } from './match-i18n.js';
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

export function ratingSummaryKeyboard(match: MatchSession) {
  const lang = match.language;
  return Markup.inlineKeyboard([
    [Markup.button.callback(mt(lang, 'matchEditRatings'), prepCallback('mre', match.id))],
    [Markup.button.callback(mt(lang, 'matchContinue'), prepCallback('mts', match.id))],
  ]);
}

export function ratingEditListKeyboard(match: MatchSession) {
  const rows = sortedParticipants(match).map((p) => {
    const label = truncateLabel(p.displayName, 28);
    return [
      Markup.button.callback(label, prepCallback('mep', match.id, String(p.telegramId))),
    ];
  });
  rows.push([Markup.button.callback(mt(match.language, 'matchBack'), prepCallback('mrb', match.id))]);
  return Markup.inlineKeyboard(rows);
}

export function ratingEditTierKeyboard(matchId: string, telegramId: number, lang: MatchSession['language']) {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < PLAYER_TIERS.length; i += 3) {
    rows.push(
      PLAYER_TIERS.slice(i, i + 3).map((tier) =>
        Markup.button.callback(tier, prepCallback('rc', matchId, `${telegramId}:${tier}`)),
      ),
    );
  }
  rows.push([Markup.button.callback(mt(lang, 'matchBack'), prepCallback('mre', matchId))]);
  return Markup.inlineKeyboard(rows);
}

export function teamCountKeyboard(match: MatchSession) {
  const lang = match.language;
  const options = validMatchTeamCounts(match);
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < options.length; i += 2) {
    rows.push(
      options.slice(i, i + 2).map((n) =>
        Markup.button.callback(
          mt(lang, 'matchTeamCountOption', { count: n }),
          prepCallback('mtc', match.id, String(n)),
        ),
      ),
    );
  }
  rows.push([Markup.button.callback(mt(lang, 'matchBack'), prepCallback('mrb', match.id))]);
  return Markup.inlineKeyboard(rows);
}

export function teamPreviewKeyboard(match: MatchSession) {
  const lang = match.language;
  return Markup.inlineKeyboard([
    [Markup.button.callback(mt(lang, 'matchReshuffle'), prepCallback('mtr', match.id))],
    [Markup.button.callback(mt(lang, 'matchEditRatings'), prepCallback('mre', match.id))],
    [Markup.button.callback(mt(lang, 'matchConfirmTeams'), prepCallback('mtp', match.id))],
  ]);
}
