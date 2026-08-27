import { Telegraf, Context } from 'telegraf';
import {
  allParticipantsRated,
  beginTeamPreparation,
  canStartTeamPreparation,
  createTeamSetupToken,
  formatPrepStartText,
  formatPrivateTeamPreview,
  formatPublicTeamResult,
  formatRatingPrompt,
  formatRatingReview,
  formatRatingSummary,
  generateTeamsForMatch,
  getGeneratedTeams,
  getNextUnratedParticipant,
  getRating,
  setRating,
  sortedParticipants,
  TEAM_SETUP_TOKEN_TTL_MS,
  validateTeamSetupToken,
} from './match-preparation.js';
import {
  closeMatchRoster,
  formatMatchCard,
  getMatch,
  isOrganizer,
  matches,
} from './match.js';
import {
  matchCardKeyboard,
  publishedTeamsKeyboard,
} from './match-keyboards.js';
import {
  ratingEditListKeyboard,
  ratingEditTierKeyboard,
  ratingReviewKeyboard,
  ratingSummaryKeyboard,
  ratingTierKeyboard,
  teamCountKeyboard,
  teamPreviewKeyboard,
  teamSetupLinkKeyboard,
} from './team-prep-keyboards.js';
import { OrganizerPrepSession, PlayerTier } from './types.js';
import { safeEditMessage } from './utils.js';
import { startKeyboard } from './keyboards.js';

type BotContext = Context;

let botUsername = '';

export const organizerPrepSessions = new Map<number, OrganizerPrepSession>();

export function setTeamPrepBotUsername(username: string): void {
  botUsername = username.replace(/^@/, '');
}

function uid(ctx: BotContext): number | undefined {
  return ctx.from?.id;
}

function teamsDeepLink(token: string): string {
  return `https://t.me/${botUsername}?start=teams_${token}`;
}

function prepSessionOf(userId: number): OrganizerPrepSession | undefined {
  return organizerPrepSessions.get(userId);
}

function setPrepSession(session: OrganizerPrepSession): void {
  organizerPrepSessions.set(session.userId, session);
}

function clearPrepSession(userId: number): void {
  organizerPrepSessions.delete(userId);
}

async function editPrepMessage(
  ctx: BotContext,
  userId: number,
  text: string,
  extra?: object,
): Promise<void> {
  const prep = prepSessionOf(userId);
  if (prep?.privateMessageId) {
    try {
      await ctx.telegram.editMessageText(
        userId,
        prep.privateMessageId,
        undefined,
        text,
        extra,
      );
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('message is not modified')) return;
    }
  }
  const sent = await ctx.reply(text, extra);
  if (prep) {
    prep.privateMessageId = sent.message_id;
  }
}

async function requireOrganizer(
  ctx: BotContext,
  match: NonNullable<ReturnType<typeof getMatch>>,
): Promise<boolean> {
  const userId = uid(ctx);
  if (!userId || !isOrganizer(match, userId)) {
    await ctx.answerCbQuery('❌ Bu amal faqat tashkilotchi uchun.', {
      show_alert: true,
    });
    return false;
  }
  return true;
}

async function updateGroupCard(ctx: BotContext, matchId: string): Promise<void> {
  const match = getMatch(matchId);
  if (!match) return;
  try {
    await ctx.telegram.editMessageText(
      match.chatId,
      match.messageId,
      undefined,
      formatMatchCard(match),
      matchCardKeyboard(match),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('message is not modified')) {
      console.error(err);
    }
  }
}

async function showRatingStep(
  ctx: BotContext,
  userId: number,
  matchId: string,
): Promise<void> {
  const match = getMatch(matchId);
  if (!match) return;

  const next = getNextUnratedParticipant(match);
  if (!next) {
    await showRatingSummary(ctx, userId, matchId);
    return;
  }

  const prep = prepSessionOf(userId);
  if (prep) prep.view = 'RATING';

  await editPrepMessage(
    ctx,
    userId,
    formatRatingPrompt(match, next),
    ratingTierKeyboard(matchId, next.telegramId),
  );
}

async function showRatingSummary(
  ctx: BotContext,
  userId: number,
  matchId: string,
): Promise<void> {
  const match = getMatch(matchId);
  if (!match) return;

  const prep = prepSessionOf(userId);
  if (prep) prep.view = 'SUMMARY';

  await editPrepMessage(
    ctx,
    userId,
    formatRatingSummary(match),
    ratingSummaryKeyboard(matchId),
  );
}

export async function handleTeamPrepStartPayload(
  ctx: BotContext,
  userId: number,
  tokenValue: string,
): Promise<boolean> {
  const result = validateTeamSetupToken(tokenValue, userId);
  if (!result.ok) {
    const msg =
      result.reason === 'wrong_user'
        ? '❌ Bu havola faqat tashkilotchi uchun.'
        : result.reason === 'expired'
          ? '❌ Havola muddati tugagan.'
          : '❌ Havola topilmadi.';
    await ctx.reply(msg, startKeyboard('uz'));
    return true;
  }

  const match = getMatch(result.entry.matchId);
  if (!match) {
    await ctx.reply('❌ O\'yin topilmadi.', startKeyboard('uz'));
    return true;
  }

  const prepCheck = canStartTeamPreparation(match, userId);
  if (!prepCheck.ok) {
    const msg =
      prepCheck.reason === 'too_few'
        ? '❌ Jamoa tuzish uchun kamida 4 ta o\'yinchi kerak.'
        : prepCheck.reason === 'wrong_status'
          ? '❌ Avval ro\'yxatni yoping yoki tarkib to\'lsin.'
          : '❌ Bu o\'yin uchun jamoa tayyorlab bo\'lmaydi.';
    await ctx.reply(msg, startKeyboard('uz'));
    return true;
  }

  beginTeamPreparation(match);

  try {
    await ctx.telegram.editMessageText(
      match.chatId,
      match.messageId,
      undefined,
      formatMatchCard(match),
      matchCardKeyboard(match),
    );
  } catch {
    // ignore edit errors
  }

  const sent = await ctx.reply(formatPrepStartText(match));
  setPrepSession({
    matchId: match.id,
    userId,
    privateMessageId: sent.message_id,
    view: 'RATING',
  });

  await showRatingStep(ctx, userId, match.id);
  return true;
}

export function registerTeamPrepHandlers(bot: Telegraf<BotContext>): void {
  bot.action(/^mcl:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;

      if (!closeMatchRoster(match, userId)) {
        await ctx.answerCbQuery('❌ Ro\'yxatni yopib bo\'lmaydi.');
        return;
      }

      await ctx.answerCbQuery('🔒 Ro\'yxat yopildi.');
      await updateGroupCard(ctx, matchId);
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mp:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;

      const prepCheck = canStartTeamPreparation(match, userId);
      if (!prepCheck.ok) {
        const msg =
          prepCheck.reason === 'too_few'
            ? '❌ Jamoa tuzish uchun kamida 4 ta o\'yinchi kerak.'
            : '❌ Avval ro\'yxatni yoping yoki tarkib to\'lsin.';
        await ctx.answerCbQuery(msg, { show_alert: true });
        return;
      }

      const token = createTeamSetupToken(matchId, userId);
      const deepLink = teamsDeepLink(token.token);

      await ctx.answerCbQuery('Private chatga havola yuborildi.');
      await ctx.telegram.sendMessage(
        userId,
        [
          '⚙️ Jamoalarni tayyorlash',
          '',
          'Davom etish uchun tugmani bosing:',
        ].join('\n'),
        teamSetupLinkKeyboard(deepLink),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^rt:(.+):(\d+):([ABCDE])$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const telegramId = Number(ctx.match[2]);
      const tier = ctx.match[3] as PlayerTier;
      const userId = uid(ctx);
      const match = getMatch(matchId);

      if (!match || !userId || !isOrganizer(match, userId)) {
        await ctx.answerCbQuery('❌ Bu amal faqat tashkilotchi uchun.');
        return;
      }

      setRating(match, telegramId, tier);
      await ctx.answerCbQuery();

      if (allParticipantsRated(match)) {
        await showRatingSummary(ctx, userId, matchId);
      } else {
        await showRatingStep(ctx, userId, matchId);
      }
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mrv:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId || !isOrganizer(match, userId)) return;

      const prep = prepSessionOf(userId);
      if (prep) prep.view = 'REVIEW';

      await editPrepMessage(
        ctx,
        userId,
        formatRatingReview(match),
        ratingReviewKeyboard(matchId),
      );
    } catch (err) {
      console.error(err);
    }
  });

  bot.action(/^mre:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId || !isOrganizer(match, userId)) return;

      const prep = prepSessionOf(userId);
      if (prep) prep.view = 'EDIT_LIST';

      await editPrepMessage(
        ctx,
        userId,
        'O\'zgartirmoqchi bo\'lgan o\'yinchini tanlang:',
        ratingEditListKeyboard(match),
      );
    } catch (err) {
      console.error(err);
    }
  });

  bot.action(/^mep:(.+):(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const matchId = ctx.match[1]!;
      const telegramId = Number(ctx.match[2]);
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId || !isOrganizer(match, userId)) return;

      const participant = match.participants.find(
        (p) => p.telegramId === telegramId,
      );
      if (!participant) return;

      const tier = getRating(match, telegramId) ?? '?';
      const prep = prepSessionOf(userId);
      if (prep) {
        prep.view = 'EDIT_TIER';
        prep.editingTelegramId = telegramId;
      }

      await editPrepMessage(
        ctx,
        userId,
        `${participant.displayName} · ${tier}\n\nYangi darajani tanlang:`,
        ratingEditTierKeyboard(matchId, telegramId),
      );
    } catch (err) {
      console.error(err);
    }
  });

  bot.action(/^rc:(.+):(\d+):([ABCDE])$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const telegramId = Number(ctx.match[2]);
      const tier = ctx.match[3] as PlayerTier;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId || !isOrganizer(match, userId)) {
        await ctx.answerCbQuery();
        return;
      }

      const oldTier = getRating(match, telegramId);
      setRating(match, telegramId, tier);

      const participant = match.participants.find(
        (p) => p.telegramId === telegramId,
      );
      await ctx.answerCbQuery(
        participant && oldTier
          ? `✅ ${participant.displayName}: ${oldTier} → ${tier}`
          : '✅ Yangilandi',
      );

      await editPrepMessage(
        ctx,
        userId,
        formatRatingReview(match),
        ratingReviewKeyboard(matchId),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mrb:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = uid(ctx);
      if (!userId) return;
      await showRatingSummary(ctx, userId, ctx.match[1]!);
    } catch (err) {
      console.error(err);
    }
  });

  bot.action(/^mts:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId || !isOrganizer(match, userId)) return;

      if (!allParticipantsRated(match)) {
        await ctx.reply('❌ Avval barcha o\'yinchilarni baholang.');
        return;
      }

      const prep = prepSessionOf(userId);
      if (prep) prep.view = 'TEAM_COUNT';

      await editPrepMessage(
        ctx,
        userId,
        '⚽ Nechta jamoa qilamiz?',
        teamCountKeyboard(match),
      );
    } catch (err) {
      console.error(err);
    }
  });

  bot.action(/^mtc:(.+):(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const matchId = ctx.match[1]!;
      const teamCount = Number(ctx.match[2]);
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId || !isOrganizer(match, userId)) return;

      if (!allParticipantsRated(match)) return;

      const prep = match.teamPreparation!;
      prep.teamCount = teamCount;
      const teams = generateTeamsForMatch(match);
      if (!teams) {
        await ctx.reply('❌ Bu jamoa soni mos emas.');
        return;
      }

      const session = prepSessionOf(userId);
      if (session) session.view = 'PREVIEW';

      await editPrepMessage(
        ctx,
        userId,
        formatPrivateTeamPreview(match, teams),
        teamPreviewKeyboard(matchId),
      );
    } catch (err) {
      console.error(err);
    }
  });

  bot.action(/^mtr:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId || !isOrganizer(match, userId)) return;

      const teams = generateTeamsForMatch(match);
      if (!teams) return;

      await editPrepMessage(
        ctx,
        userId,
        formatPrivateTeamPreview(match, teams),
        teamPreviewKeyboard(matchId),
      );
    } catch (err) {
      console.error(err);
    }
  });

  bot.action(/^mtp:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId || !isOrganizer(match, userId)) {
        await ctx.answerCbQuery();
        return;
      }

      const teams = getGeneratedTeams(match);
      if (!teams) {
        await ctx.answerCbQuery('❌ Avval jamoalarni tuzing.');
        return;
      }

      await ctx.answerCbQuery();

      const text = formatPublicTeamResult(teams);
      const keyboard = publishedTeamsKeyboard(matchId);

      if (match.teamsMessageId) {
        try {
          await ctx.telegram.editMessageText(
            match.chatId,
            match.teamsMessageId,
            undefined,
            text,
            keyboard,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('message is not modified')) {
            const sent = await ctx.telegram.sendMessage(match.chatId, text, keyboard);
            match.teamsMessageId = sent.message_id;
          }
        }
      } else {
        const sent = await ctx.telegram.sendMessage(match.chatId, text, keyboard);
        match.teamsMessageId = sent.message_id;
      }

      match.teamsPublishedAt = Date.now();

      await editPrepMessage(
        ctx,
        userId,
        '✅ Jamoalar groupga yuborildi.',
        teamPreviewKeyboard(matchId),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery('❌ Xatolik yuz berdi.', { show_alert: true });
    }
  });

  bot.action(/^mpx:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = uid(ctx);
      if (!userId) return;
      clearPrepSession(userId);
      await safeEditMessage(ctx, 'Bekor qilindi.', startKeyboard('uz'));
    } catch (err) {
      console.error(err);
    }
  });
}

export { TEAM_SETUP_TOKEN_TTL_MS };
