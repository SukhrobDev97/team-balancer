import { Markup } from 'telegraf';
import { participantPlayerId, sortedParticipants } from './match-preparation.js';
import {
  clampMotmPage,
  motmCallback,
  motmPageCount,
  MOTM_PAGE_SIZE,
} from './motm.js';
import { MatchSession } from './types.js';
import { truncateLabel } from './utils.js';

export function motmVotingKeyboard(match: MatchSession, page?: number) {
  const roster = sortedParticipants(match);
  const current = clampMotmPage(
    page ?? match.motm?.keyboardPage ?? 0,
    roster.length,
  );
  const start = current * MOTM_PAGE_SIZE;
  const slice = roster.slice(start, start + MOTM_PAGE_SIZE);

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < slice.length; i += 2) {
    rows.push(
      slice.slice(i, i + 2).map((p) =>
        Markup.button.callback(
          truncateLabel(p.displayName, 18),
          motmCallback('mv', match.id, participantPlayerId(p.telegramId)),
        ),
      ),
    );
  }

  if (roster.length > MOTM_PAGE_SIZE) {
    const total = motmPageCount(roster.length);
    rows.push([
      Markup.button.callback(
        '⬅️',
        motmCallback('mpg', match.id, String(Math.max(0, current - 1))),
      ),
      Markup.button.callback(
        `${current + 1} / ${total}`,
        motmCallback('mpg', match.id, String(current)),
      ),
      Markup.button.callback(
        '➡️',
        motmCallback(
          'mpg',
          match.id,
          String(Math.min(total - 1, current + 1)),
        ),
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(
      '🏁 Ovoz berishni yakunlash',
      motmCallback('me', match.id),
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

export function motmFinishedKeyboard() {
  return Markup.inlineKeyboard([]);
}
