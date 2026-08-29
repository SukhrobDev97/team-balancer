import { Context, Telegraf } from 'telegraf';
import { getMatch } from './match.js';
import {
  castVote,
  finishMotm,
  formatMotmOpenText,
  formatMotmResultText,
  motmStatus,
  startMotm,
} from './motm.js';
import { motmFinishedKeyboard, motmVotingKeyboard } from './motm-keyboards.js';
import { matchTelegramExtra } from './utils.js';

type BotContext = Context;

function uid(ctx: BotContext): number | undefined {
  return ctx.from?.id;
}

async function refreshMotmMessage(
  ctx: BotContext,
  matchId: string,
  allowResultFallback = false,
): Promise<void> {
  const match = getMatch(matchId);
  const motm = match?.motm;
  if (!match || !motm?.messageId) return;

  const finished = motm.status === 'FINISHED';
  const text = finished
    ? formatMotmResultText(match)
    : formatMotmOpenText(match);
  const extra = finished
    ? motmFinishedKeyboard()
    : motmVotingKeyboard(match);

  try {
    await ctx.telegram.editMessageText(
      match.chatId,
      motm.messageId,
      undefined,
      text,
      matchTelegramExtra(match, extra),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('message is not modified')) return;
    if (allowResultFallback && finished) {
      const sent = await ctx.telegram.sendMessage(
        match.chatId,
        text,
        matchTelegramExtra(match, extra),
      );
      motm.messageId = sent.message_id;
      return;
    }
    console.error(err);
  }
}

export function registerMotmHandlers(bot: Telegraf<BotContext>): void {
  bot.action(/^ms:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }

      const started = startMotm(match, userId);
      if (!started.ok) {
        const msg =
          started.reason === 'not_participant'
            ? "❌ Faqat o'yinda qatnashganlar MOTM ovozini boshlay oladi."
            : started.reason === 'already_open'
              ? '🗳 Ovoz berish allaqachon boshlangan.'
              : started.reason === 'already_finished'
                ? '🏆 MOTM allaqachon aniqlandi.'
                : "❌ Avval jamoalar chiqarilishi kerak.";
        await ctx.answerCbQuery(msg);
        return;
      }

      try {
        const sent = await ctx.telegram.sendMessage(
          match.chatId,
          formatMotmOpenText(match),
          matchTelegramExtra(match, motmVotingKeyboard(match)),
        );
        match.motm!.messageId = sent.message_id;
        await ctx.answerCbQuery('🗳 Ovoz berish boshlandi.');
      } catch (err) {
        match.motm = undefined;
        console.error(err);
        await ctx.answerCbQuery('❌ Xatolik yuz berdi.', { show_alert: true });
      }
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mv:(.+):(t\d+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const candidateId = ctx.match[2]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }

      const result = castVote(match, userId, candidateId);
      if (!result.ok) {
        const msg =
          result.reason === 'not_participant'
            ? "❌ Faqat o'yinda qatnashganlar ovoz bera oladi."
            : result.reason === 'self'
              ? "😂 O'zingizga ovoz berib bo'lmaydi."
              : result.reason === 'finished'
                ? '🏆 MOTM allaqachon aniqlandi.'
                : "❌ Ovoz berib bo'lmadi.";
        await ctx.answerCbQuery(msg);
        return;
      }

      if (result.kind === 'same') {
        await ctx.answerCbQuery(`✅ Siz ${result.displayName}ga ovoz bergansiz.`);
        return;
      }

      await ctx.answerCbQuery(
        result.kind === 'changed'
          ? `🔄 Ovoz o'zgartirildi: ${result.displayName}`
          : `✅ Ovoz berildi: ${result.displayName}`,
      );
      await refreshMotmMessage(ctx, matchId);
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mpg:(.+):(\d+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const page = Number(ctx.match[2]);
      const match = getMatch(matchId);
      if (!match?.motm || match.motm.status !== 'OPEN') {
        await ctx.answerCbQuery();
        return;
      }

      match.motm.keyboardPage = page;
      await ctx.answerCbQuery();
      await refreshMotmMessage(ctx, matchId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('message is not modified')) {
        console.error(err);
      }
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^me:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }

      if (motmStatus(match) === 'FINISHED') {
        await ctx.answerCbQuery('🏆 MOTM allaqachon aniqlandi.');
        await refreshMotmMessage(ctx, matchId, true);
        return;
      }

      const result = finishMotm(match, userId);
      if (!result.ok) {
        const msg =
          result.reason === 'not_authorized'
            ? "❌ Ovoz berishni faqat boshlagan odam yoki tashkilotchi yakunlay oladi."
            : result.reason === 'no_votes'
              ? '❌ Hali hech kim ovoz bermadi.'
              : "❌ Ovoz berishni yakunlab bo'lmadi.";
        await ctx.answerCbQuery(msg);
        return;
      }

      if (result.alreadyFinished) {
        await ctx.answerCbQuery('🏆 MOTM allaqachon aniqlandi.');
      } else {
        await ctx.answerCbQuery('🏆 MOTM aniqlandi!');
      }
      await refreshMotmMessage(ctx, matchId, true);
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });
}
