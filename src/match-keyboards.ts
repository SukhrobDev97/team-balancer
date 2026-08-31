import { Markup } from 'telegraf';
import { MatchSession } from './types.js';
import {
  canPrepareTeams,
  matchCallbackData,
  shouldShowReopenRosterButton,
} from './match.js';
import { isPrepActive } from './match-preparation.js';
import { mt } from './match-i18n.js';
import {
  buildShareUrl,
  canShowShareButton,
  externalRsvpCallbackRows,
} from './external-rsvp.js';

export function matchCardKeyboard(match: MatchSession) {
  const lang = match.language;
  const rows: (
    | ReturnType<typeof Markup.button.callback>
    | ReturnType<typeof Markup.button.url>
  )[][] = [];

  if (!match.teamPreparation?.locked) {
    if (match.status === 'OPEN') {
      rows.push([
        Markup.button.callback(mt(lang, 'matchJoin'), matchCallbackData('mj', match.id)),
        Markup.button.callback(mt(lang, 'matchLeave'), matchCallbackData('ml', match.id)),
      ]);
    } else if (match.status === 'FULL') {
      rows.push([
        Markup.button.callback(mt(lang, 'matchLeave'), matchCallbackData('ml', match.id)),
      ]);
    }
  }

  if (canShowShareButton(match)) {
    const shareUrl = buildShareUrl(match);
    if (shareUrl) {
      rows.push([Markup.button.url(mt(lang, 'matchShare'), shareUrl)]);
    }
  }

  if (match.status !== 'CANCELLED') {
    rows.push([
      Markup.button.callback(mt(lang, 'matchRoster'), matchCallbackData('mr', match.id)),
    ]);
  }

  if (match.status === 'OPEN' && !match.teamPreparation?.locked) {
    rows.push([
      Markup.button.callback(
        mt(lang, 'matchCloseRoster'),
        matchCallbackData('mcl', match.id),
      ),
    ]);
  }

  if (shouldShowReopenRosterButton(match)) {
    rows.push([
      Markup.button.callback(
        mt(lang, 'matchReopenRoster'),
        matchCallbackData('mro', match.id),
      ),
    ]);
  }

  if (canPrepareTeams(match) && !match.teamPreparation?.locked && !isPrepActive(match)) {
    rows.push([
      Markup.button.callback(
        mt(lang, 'matchPrepareTeams'),
        matchCallbackData('mp', match.id),
      ),
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

export function publishedTeamsKeyboard(match: MatchSession) {
  const lang = match.language;
  return Markup.inlineKeyboard([
    [Markup.button.callback(mt(lang, 'matchMotm'), matchCallbackData('ms', match.id))],
    [Markup.button.callback(mt(lang, 'matchSquad'), matchCallbackData('mr', match.id))],
  ]);
}

export function matchRosterKeyboard(match: MatchSession) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(mt(match.language, 'matchBack'), matchCallbackData('mb', match.id))],
  ]);
}

export function externalRsvpKeyboard(match: MatchSession, userId: number) {
  const rows = externalRsvpCallbackRows(match, userId).map((btn) => [
    Markup.button.callback(btn.text, btn.callback_data),
  ]);
  return Markup.inlineKeyboard(rows);
}
