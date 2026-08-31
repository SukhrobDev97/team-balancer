import { MatchSession } from './types.js';
import { getBotUsername } from './bot-config.js';
import { matchCallbackData } from './match.js';
import { mt } from './match-i18n.js';

const JOIN_MATCH_ID_RE = /^m[a-z0-9]{10}$/;

export function isValidJoinMatchId(matchId: string): boolean {
  return JOIN_MATCH_ID_RE.test(matchId);
}

export function isExternalRsvpParticipant(
  match: MatchSession,
  userId: number,
): boolean {
  return match.participants.some((p) => p.telegramId === userId);
}

export function canShowShareButton(match: MatchSession): boolean {
  return (
    (match.status === 'OPEN' || match.status === 'FULL') &&
    !match.teamPreparation?.locked
  );
}

export function buildJoinDeepLink(matchId: string): string {
  const bot = getBotUsername();
  if (!bot) return '';
  return `https://t.me/${bot}?start=join_${matchId}`;
}

export function formatShareText(match: MatchSession): string {
  const lang = match.language;
  return [
    `⚽ ${match.dateLabel} — ${match.time}`,
    `📍 ${match.location}`,
    '',
    mt(lang, 'matchShareInviteLine'),
  ].join('\n');
}

export function buildShareUrl(match: MatchSession): string {
  const deepLink = buildJoinDeepLink(match.id);
  if (!deepLink) return '';
  const text = formatShareText(match);
  return `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`;
}

export function formatExternalRsvpCard(
  match: MatchSession,
  userId: number,
): string {
  const lang = match.language;
  const lines = [
    `⚽ ${match.dateLabel} — ${match.time}`,
    `📍 ${match.location}`,
    '',
    mt(lang, 'matchCountLine', {
      current: match.participants.length,
      capacity: match.capacity,
    }),
  ];

  if (match.teamPreparation?.locked) {
    lines.push('', mt(lang, 'matchExternalPrepLocked'));
  } else if (match.status === 'CANCELLED') {
    lines.push('', mt(lang, 'matchExternalCancelled'));
  } else if (match.status === 'CLOSED') {
    lines.push('', mt(lang, 'matchExternalClosed'));
  } else if (
    match.status === 'FULL' &&
    !isExternalRsvpParticipant(match, userId)
  ) {
    lines.push('', mt(lang, 'matchExternalFullNoSpot'));
  } else if (isExternalRsvpParticipant(match, userId)) {
    lines.push('', mt(lang, 'matchExternalJoined'));
  } else {
    lines.push('', mt(lang, 'matchExternalNotJoined'));
  }

  return lines.join('\n');
}

export function externalRsvpCallbackRows(
  match: MatchSession,
  userId: number,
): { text: string; callback_data: string }[] {
  if (match.teamPreparation?.locked) return [];

  const lang = match.language;
  const joined = isExternalRsvpParticipant(match, userId);

  if (match.status === 'OPEN' && !joined) {
    return [
      {
        text: mt(lang, 'matchJoin'),
        callback_data: matchCallbackData('mj', match.id),
      },
    ];
  }

  if (
    (match.status === 'OPEN' || match.status === 'FULL') &&
    joined
  ) {
    return [
      {
        text: mt(lang, 'matchLeave'),
        callback_data: matchCallbackData('ml', match.id),
      },
    ];
  }

  return [];
}
