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
  reopenMatchRoster,
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
import { mt } from './match-i18n.js';

type BotContext = Context;

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
    await ctx.answerCbQuery(mt(match.language, 'matchPrepOrganizerOnly'));
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
    ratingSummaryKeyboard(match),
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
    formatEditRatingListPrompt(match),
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
    formatTeamCountPrompt(match),
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
    formatGroupTeamPreview(match, teams),
    teamPreviewKeyboard(match),
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
        formatEditRatingTierPrompt(match, participant.displayName),
        ratingEditTierKeyboard(match.id, participant.telegramId, match.language),
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
        await ctx.answerCbQuery(mt(match.language, 'matchCloseRosterFail'));
        return;
      }

      await ctx.answerCbQuery(mt(match.language, 'matchCloseRosterDone'));
      await editMatch(
        ctx,
        match,
        formatMatchCard(match),
        matchCardKeyboard(match),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mro:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }

      const result = reopenMatchRoster(match);
      if (result !== 'reopened') {
        await ctx.answerCbQuery(mt(match.language, 'matchReopenRosterFail'));
        return;
      }

      await ctx.answerCbQuery(mt(match.language, 'matchReopenRosterDone'));
      await editMatch(
        ctx,
        match,
        formatMatchCard(match),
        matchCardKeyboard(match),
      );
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
        await ctx.answerCbQuery(mt(match.language, 'matchPrepAlreadyStarted'));
        await renderCurrentPrepView(ctx, match);
        return;
      }

      if (match.teamsPublishedAt != null) {
        await ctx.answerCbQuery(mt(match.language, 'matchTeamsAlreadyPublished'));
        return;
      }

      const prepCheck = canStartTeamPreparation(match, userId);
      if (!prepCheck.ok) {
        const msg =
          prepCheck.reason === 'too_few'
            ? mt(match.language, 'matchPrepTooFew')
            : mt(match.language, 'matchPrepWrongStatus');
        await ctx.answerCbQuery(msg);
        return;
      }

      beginTeamPreparation(match);
      await ctx.answerCbQuery(mt(match.language, 'matchPrepStarted'));
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
        await ctx.answerCbQuery(mt(match.language, 'matchStaleStep'));
        return;
      }

      const participant = match.participants.find((p) => p.telegramId === telegramId);
      if (!participant) {
        await ctx.answerCbQuery(mt(match.language, 'matchPlayerNotFound'));
        return;
      }

      setRating(match, telegramId, tier);
      await ctx.answerCbQuery(
        mt(match.language, 'matchRatingSaved', { name: participant.displayName, tier }),
      );

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
        await ctx.answerCbQuery(mt(match.language, 'matchStaleStep'));
        return;
      }
      if (!allParticipantsRated(match)) {
        await ctx.answerCbQuery(mt(match.language, 'matchRateAllFirst'));
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
        await ctx.answerCbQuery(mt(match.language, 'matchStaleStep'));
        return;
      }

      const participant = match.participants.find(
        (p) => p.telegramId === telegramId,
      );
      if (!participant) {
        await ctx.answerCbQuery(mt(match.language, 'matchPlayerNotFound'));
        return;
      }

      match.teamPreparation!.view = 'EDIT_TIER';
      match.teamPreparation!.editingTelegramId = telegramId;

      await ctx.answerCbQuery();
      await editMatch(
        ctx,
        match,
        formatEditRatingTierPrompt(match, participant.displayName),
        ratingEditTierKeyboard(matchId, telegramId, match.language),
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
        await ctx.answerCbQuery(mt(match.language, 'matchStaleStep'));
        return;
      }

      const participant = match.participants.find(
        (p) => p.telegramId === telegramId,
      );
      if (!participant) {
        await ctx.answerCbQuery(mt(match.language, 'matchPlayerNotFound'));
        return;
      }

      const oldTier = getRating(match, telegramId);
      setRating(match, telegramId, tier);

      await ctx.answerCbQuery(
        oldTier
          ? mt(match.language, 'matchRatingChanged', {
              name: participant.displayName,
              from: oldTier,
              to: tier,
            })
          : mt(match.language, 'matchRatingSaved', {
              name: participant.displayName,
              tier,
            }),
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
        await ctx.answerCbQuery(mt(match.language, 'matchStaleStep'));
        return;
      }

      if (!allParticipantsRated(match)) {
        await ctx.answerCbQuery(mt(match.language, 'matchRateAllFirst'));
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
        await ctx.answerCbQuery(mt(match.language, 'matchStaleStep'));
        return;
      }

      if (!allParticipantsRated(match)) {
        await ctx.answerCbQuery(mt(match.language, 'matchRateAllFirst'));
        return;
      }

      match.teamPreparation!.teamCount = teamCount;
      const teams = generateTeamsForMatch(match);
      if (!teams) {
        await ctx.answerCbQuery(mt(match.language, 'matchInvalidTeamCount'));
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
        await ctx.answerCbQuery(mt(match.language, 'matchStaleStep'));
        return;
      }

      const teams = generateTeamsForMatch(match);
      if (!teams) {
        await ctx.answerCbQuery(mt(match.language, 'matchBuildTeamsFirst'));
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
        await ctx.answerCbQuery(mt(match.language, 'matchTeamsAlreadyPublishedToast'));
        return;
      }

      const teams = getGeneratedTeams(match);
      if (!teams) {
        await ctx.answerCbQuery(mt(match.language, 'matchBuildTeamsFirst'));
        return;
      }

      await ctx.answerCbQuery(mt(match.language, 'matchTeamsPublished'));

      const text = formatPublicTeamResult(match, teams);
      const keyboard = publishedTeamsKeyboard(match);
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
      const failed = getMatch(ctx.match[1]!);
      await ctx.answerCbQuery(mt(failed?.language ?? 'uz', 'matchGenericError')).catch(() => {});
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
      await ctx.answerCbQuery(mt(match.language, 'matchCancelled'));
      await editMatch(ctx, match, formatMatchCard(match), matchCardKeyboard(match));
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });
}
