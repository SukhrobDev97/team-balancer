import { Telegraf, Context } from 'telegraf';
import {
  allParticipantsRated,
  beginTeamPreparation,
  canStartTeamPreparation,
  formatEditRatingListPrompt,
  formatEditRatingTierPrompt,
  formatGroupTeamPreview,
  formatPrepCompleteCard,
  formatPublicTeamResult,
  formatRatingCompleteSummary,
  formatRatingPrompt,
  formatTeamCountPrompt,
  generateTeamsForMatch,
  getGeneratedTeams,
  getNextUnratedParticipant,
  getRating,
  isExpectedPrepView,
  isPrepActive,
  setRating,
} from './match-preparation.js';
import {
  formatMatchCard,
  closeMatchRoster,
  editMatchMessage,
  getMatch,
  isOrganizer,
} from './match.js';
import {
  matchCardKeyboard,
  publishedTeamsKeyboard,
} from './match-keyboards.js';
import {
  ratingEditListKeyboard,
  ratingEditTierKeyboard,
  ratingSummaryKeyboard,
  ratingTierKeyboard,
  teamCountKeyboard,
  teamPreviewKeyboard,
} from './team-prep-keyboards.js';
import { PlayerTier } from './types.js';
import { isMissingEditTargetError, matchTelegramExtra } from './utils.js';

type BotContext = Context;

const ORGANIZER_ONLY_MSG =
  'Bu amalni faqat o\'yin tashkilotchisi bajarishi mumkin.';

function uid(ctx: BotContext): number | undefined {
  return ctx.from?.id;
}

async function editMatch(
  ctx: BotContext,
  match: NonNullable<ReturnType<typeof getMatch>>,
  text: string,
  extra?: object,
): Promise<void> {
  await editMatchMessage(ctx.telegram, match, text, extra);
}

async function requireOrganizer(
  ctx: BotContext,
  match: NonNullable<ReturnType<typeof getMatch>>,
): Promise<boolean> {
  const userId = uid(ctx);
  if (!userId || !isOrganizer(match, userId)) {
    await ctx.answerCbQuery(ORGANIZER_ONLY_MSG);
    return false;
  }
  return true;
}

async function showRatingStep(
  ctx: BotContext,
  match: NonNullable<ReturnType<typeof getMatch>>,
): Promise<void> {
  const next = getNextUnratedParticipant(match);
  if (!next) {
    await showRatingSummary(ctx, match);
    return;
  }

  match.teamPreparation!.view = 'RATING';
  await editMatch(
    ctx,
    match,
    formatRatingPrompt(match, next),
    ratingTierKeyboard(match.id, next.telegramId),
  );
}

async function showRatingSummary(
  ctx: BotContext,
  match: NonNullable<ReturnType<typeof getMatch>>,
): Promise<void> {
  match.teamPreparation!.view = 'SUMMARY';
  await editMatch(
    ctx,
    match,
    formatRatingCompleteSummary(match),
    ratingSummaryKeyboard(match.id),
  );
}

async function showEditList(
  ctx: BotContext,
  match: NonNullable<ReturnType<typeof getMatch>>,
): Promise<void> {
  match.teamPreparation!.view = 'EDIT_LIST';
  await editMatch(
    ctx,
    match,
    formatEditRatingListPrompt(),
    ratingEditListKeyboard(match),
  );
}

async function showTeamCount(
  ctx: BotContext,
  match: NonNullable<ReturnType<typeof getMatch>>,
): Promise<void> {
  match.teamPreparation!.view = 'TEAM_COUNT';
  await editMatch(
    ctx,
    match,
    formatTeamCountPrompt(),
    teamCountKeyboard(match),
  );
}

async function showTeamPreview(
  ctx: BotContext,
  match: NonNullable<ReturnType<typeof getMatch>>,
  teams: NonNullable<ReturnType<typeof getGeneratedTeams>>,
): Promise<void> {
  match.teamPreparation!.view = 'PREVIEW';
  await editMatch(
    ctx,
    match,
    formatGroupTeamPreview(teams),
    teamPreviewKeyboard(match.id),
  );
}

async function renderCurrentPrepView(
  ctx: BotContext,
  match: NonNullable<ReturnType<typeof getMatch>>,
): Promise<void> {
  const view = match.teamPreparation?.view;
  switch (view) {
    case 'RATING':
      await showRatingStep(ctx, match);
      break;
    case 'SUMMARY':
      await showRatingSummary(ctx, match);
      break;
    case 'EDIT_LIST':
      await showEditList(ctx, match);
      break;
    case 'EDIT_TIER': {
      const telegramId = match.teamPreparation?.editingTelegramId;
      const participant = match.participants.find((p) => p.telegramId === telegramId);
      if (!participant) {
        await showEditList(ctx, match);
        return;
      }
      await editMatch(
        ctx,
        match,
        formatEditRatingTierPrompt(participant.displayName),
        ratingEditTierKeyboard(match.id, participant.telegramId),
      );
      break;
    }
    case 'TEAM_COUNT':
      await showTeamCount(ctx, match);
      break;
    case 'PREVIEW': {
      const teams = getGeneratedTeams(match);
      if (teams) await showTeamPreview(ctx, match, teams);
      else await showTeamCount(ctx, match);
      break;
    }
    default:
      await showRatingStep(ctx, match);
  }
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
      await editMatch(ctx, match, formatMatchCard(match), matchCardKeyboard(match));
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

      if (isPrepActive(match)) {
        await ctx.answerCbQuery('⚙️ Jamoa tayyorlash allaqachon boshlangan.');
        await renderCurrentPrepView(ctx, match);
        return;
      }

      if (match.teamsPublishedAt != null) {
        await ctx.answerCbQuery('✅ Jamoalar allaqachon tayyorlangan.');
        return;
      }

      const prepCheck = canStartTeamPreparation(match, userId);
      if (!prepCheck.ok) {
        const msg =
          prepCheck.reason === 'too_few'
            ? '❌ Jamoa tuzish uchun kamida 3 ta o\'yinchi kerak.'
            : '❌ Avval ro\'yxatni yoping yoki tarkib to\'lsin.';
        await ctx.answerCbQuery(msg);
        return;
      }

      beginTeamPreparation(match);
      await ctx.answerCbQuery('⚙️ Jamoa tayyorlash boshlandi.');
      await showRatingStep(ctx, match);
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

      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;
      if (!isPrepActive(match) || !isExpectedPrepView(match, 'RATING')) {
        await ctx.answerCbQuery('❌ Bu bosqich endi faol emas.');
        return;
      }

      const participant = match.participants.find((p) => p.telegramId === telegramId);
      if (!participant) {
        await ctx.answerCbQuery('❌ O\'yinchi topilmadi.');
        return;
      }

      setRating(match, telegramId, tier);
      await ctx.answerCbQuery(`✅ ${participant.displayName}: ${tier}`);

      if (allParticipantsRated(match)) {
        await showRatingSummary(ctx, match);
      } else {
        await showRatingStep(ctx, match);
      }
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mre:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;
      if (!isPrepActive(match)) {
        await ctx.answerCbQuery('❌ Bu bosqich endi faol emas.');
        return;
      }
      if (!allParticipantsRated(match)) {
        await ctx.answerCbQuery('❌ Avval barcha o\'yinchilarni baholang.');
        return;
      }

      await ctx.answerCbQuery();
      await showEditList(ctx, match);
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mep:(.+):(\d+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const telegramId = Number(ctx.match[2]);
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;
      if (!isPrepActive(match) || !isExpectedPrepView(match, 'EDIT_LIST')) {
        await ctx.answerCbQuery('❌ Bu bosqich endi faol emas.');
        return;
      }

      const participant = match.participants.find(
        (p) => p.telegramId === telegramId,
      );
      if (!participant) {
        await ctx.answerCbQuery('❌ O\'yinchi topilmadi.');
        return;
      }

      match.teamPreparation!.view = 'EDIT_TIER';
      match.teamPreparation!.editingTelegramId = telegramId;

      await ctx.answerCbQuery();
      await editMatch(
        ctx,
        match,
        formatEditRatingTierPrompt(participant.displayName),
        ratingEditTierKeyboard(matchId, telegramId),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^rc:(.+):(\d+):([ABCDE])$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const telegramId = Number(ctx.match[2]);
      const tier = ctx.match[3] as PlayerTier;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;
      if (!isPrepActive(match) || !isExpectedPrepView(match, 'EDIT_TIER')) {
        await ctx.answerCbQuery('❌ Bu bosqich endi faol emas.');
        return;
      }

      const participant = match.participants.find(
        (p) => p.telegramId === telegramId,
      );
      if (!participant) {
        await ctx.answerCbQuery('❌ O\'yinchi topilmadi.');
        return;
      }

      const oldTier = getRating(match, telegramId);
      setRating(match, telegramId, tier);

      await ctx.answerCbQuery(
        oldTier
          ? `✅ ${participant.displayName}: ${oldTier} → ${tier}`
          : `✅ ${participant.displayName}: ${tier}`,
      );

      match.teamPreparation!.editingTelegramId = undefined;
      await showEditList(ctx, match);
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mrb:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;
      if (!isPrepActive(match)) {
        await ctx.answerCbQuery('❌ Bu bosqich endi faol emas.');
        return;
      }

      await ctx.answerCbQuery();
      await showRatingSummary(ctx, match);
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mts:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;
      if (!isPrepActive(match) || !isExpectedPrepView(match, 'SUMMARY')) {
        await ctx.answerCbQuery('❌ Bu bosqich endi faol emas.');
        return;
      }

      if (!allParticipantsRated(match)) {
        await ctx.answerCbQuery('❌ Avval barcha o\'yinchilarni baholang.');
        return;
      }

      await ctx.answerCbQuery();
      await showTeamCount(ctx, match);
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mtc:(.+):(\d+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const teamCount = Number(ctx.match[2]);
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;
      if (!isPrepActive(match) || !isExpectedPrepView(match, 'TEAM_COUNT')) {
        await ctx.answerCbQuery('❌ Bu bosqich endi faol emas.');
        return;
      }

      if (!allParticipantsRated(match)) {
        await ctx.answerCbQuery('❌ Avval barcha o\'yinchilarni baholang.');
        return;
      }

      match.teamPreparation!.teamCount = teamCount;
      const teams = generateTeamsForMatch(match);
      if (!teams) {
        await ctx.answerCbQuery('❌ Bu jamoa soni mos emas.');
        return;
      }

      await ctx.answerCbQuery();
      await showTeamPreview(ctx, match, teams);
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mtr:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;
      if (!isPrepActive(match) || !isExpectedPrepView(match, 'PREVIEW')) {
        await ctx.answerCbQuery('❌ Bu bosqich endi faol emas.');
        return;
      }

      const teams = generateTeamsForMatch(match);
      if (!teams) {
        await ctx.answerCbQuery('❌ Avval jamoalarni tuzing.');
        return;
      }

      await ctx.answerCbQuery();
      await showTeamPreview(ctx, match, teams);
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mtp:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;
      if (!isPrepActive(match) || !isExpectedPrepView(match, 'PREVIEW')) {
        await ctx.answerCbQuery('❌ Bu bosqich endi faol emas.');
        return;
      }

      if (match.teamsPublishedAt != null) {
        await ctx.answerCbQuery('✅ Jamoalar allaqachon e\'lon qilingan.');
        return;
      }

      const teams = getGeneratedTeams(match);
      if (!teams) {
        await ctx.answerCbQuery('❌ Avval jamoalarni tuzing.');
        return;
      }

      await ctx.answerCbQuery('✅ Jamoalar e\'lon qilindi.');

      const text = formatPublicTeamResult(teams);
      const keyboard = publishedTeamsKeyboard(matchId);
      const telegramExtra = matchTelegramExtra(match, keyboard);

      if (match.teamsMessageId) {
        try {
          await ctx.telegram.editMessageText(
            match.chatId,
            match.teamsMessageId,
            undefined,
            text,
            telegramExtra,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes('message is not modified')) {
            const sent = await ctx.telegram.sendMessage(match.chatId, text, telegramExtra);
            match.teamsMessageId = sent.message_id;
          }
        }
      } else {
        const sent = await ctx.telegram.sendMessage(match.chatId, text, telegramExtra);
        match.teamsMessageId = sent.message_id;
      }

      match.teamsPublishedAt = Date.now();
      match.teamPreparation!.view = undefined;

      await editMatch(
        ctx,
        match,
        formatPrepCompleteCard(match),
        matchCardKeyboard(match),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery('❌ Xatolik yuz berdi.').catch(() => {});
    }
  });

  bot.action(/^mpx:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }
      if (!(await requireOrganizer(ctx, match))) return;
      if (!isPrepActive(match)) {
        await ctx.answerCbQuery('❌ Bu bosqich endi faol emas.');
        return;
      }

      match.teamPreparation = undefined;
      await ctx.answerCbQuery('Bekor qilindi.');
      await editMatch(ctx, match, formatMatchCard(match), matchCardKeyboard(match));
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });
}
