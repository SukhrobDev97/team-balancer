import { Telegraf, Context } from 'telegraf';
import {
  applyParsedDetails,
  createGroupMatchDraft,
  formatCapacityStep,
  formatCustomCapacityStep,
  formatEditDetailsPrompt,
  formatMatchDetailsPrompt,
  formatPreviewStep,
  getGroupMatchDraft,
  getGroupMatchDraftById,
  invalidTimeHelpText,
  isDraftReadyToOpen,
  parseCustomCapacity,
  parseMatchDetails,
  removeGroupMatchDraft,
  setDraftCapacity,
  shouldConsumeGroupMatchDraftText,
} from './group-match-setup.js';
import {
  groupCapacityKeyboard,
  groupEditMenuKeyboard,
  groupPreviewKeyboard,
  groupSetupCancelKeyboard,
} from './group-match-keyboards.js';
import {
  cleanupStaleMatches,
  createMatchSession,
  formatMatchCard,
  formatRosterMessage,
  getMatch,
  isValidMatchCapacity,
  matches,
  participantDisplayName,
  tryJoinMatch,
  tryLeaveMatch,
} from './match.js';
import {
  matchCardKeyboard,
  matchRosterKeyboard,
} from './match-keyboards.js';

type BotContext = Context;

function uid(ctx: BotContext): number | undefined {
  return ctx.from?.id;
}

function isGroupChat(ctx: BotContext): boolean {
  const type = ctx.chat?.type;
  return type === 'group' || type === 'supergroup';
}

function isPrivateChat(ctx: BotContext): boolean {
  return ctx.chat?.type === 'private';
}

function createMatchInstructionsText(): string {
  return [
    '⚽ O\'yin yaratish',
    '',
    'Bolinvolni futbol groupingizga qo\'shing va groupda:',
    '',
    '/match',
    '',
    'yuboring.',
  ].join('\n');
}

async function editDraftMessage(
  ctx: BotContext,
  draft: NonNullable<ReturnType<typeof getGroupMatchDraftById>>,
  text: string,
  extra?: object,
): Promise<void> {
  try {
    await ctx.telegram.editMessageText(
      draft.chatId,
      draft.messageId,
      undefined,
      text,
      extra,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('message is not modified')) {
      throw err;
    }
  }
}

function requireDraftOrganizer(
  ctx: BotContext,
  draft: NonNullable<ReturnType<typeof getGroupMatchDraftById>>,
): boolean {
  const userId = uid(ctx);
  return userId != null && userId === draft.organizerTelegramId;
}

async function beginGroupMatchSetup(ctx: BotContext): Promise<void> {
  const userId = uid(ctx);
  if (!userId || !ctx.chat) return;

  const text = formatMatchDetailsPrompt();
  const existing = getGroupMatchDraft(ctx.chat.id, userId);

  if (existing) {
    await editDraftMessage(ctx, existing, text, groupSetupCancelKeyboard(existing.id));
    existing.step = 'MATCH_DETAILS';
    existing.dateLabel = undefined;
    existing.time = undefined;
    existing.location = undefined;
    existing.capacity = undefined;
    return;
  }

  const sent = await ctx.reply(text);
  const draft = createGroupMatchDraft(ctx.chat.id, userId, sent.message_id);
  await ctx.telegram.editMessageReplyMarkup(
    ctx.chat.id,
    sent.message_id,
    undefined,
    groupSetupCancelKeyboard(draft.id).reply_markup,
  );
}

export async function handleGroupMatchSetupText(
  ctx: BotContext,
  userId: number,
  text: string,
): Promise<'handled' | 'ignored'> {
  if (!ctx.chat || !isGroupChat(ctx)) return 'ignored';

  const draft = getGroupMatchDraft(ctx.chat.id, userId);
  if (!shouldConsumeGroupMatchDraftText(draft, userId)) {
    return 'ignored';
  }

  if (draft!.step === 'WAITING_CUSTOM_CAPACITY') {
    const capacity = parseCustomCapacity(text);
    if (capacity == null) {
      await editDraftMessage(
        ctx,
        draft!,
        formatCustomCapacityStep(draft!) + '\n\n❌ 4 dan 50 gacha son kiriting.',
        groupSetupCancelKeyboard(draft!.id),
      );
      return 'handled';
    }
    setDraftCapacity(draft!, capacity);
    await editDraftMessage(
      ctx,
      draft!,
      formatPreviewStep(draft!),
      groupPreviewKeyboard(draft!.id),
    );
    return 'handled';
  }

  const parsed = parseMatchDetails(text);
  if (!parsed.ok) {
    const errorText =
      parsed.reason === 'invalid_time'
        ? invalidTimeHelpText()
        : parsed.reason === 'too_few_lines'
          ? [
              '❌ Kamida 3 qator kerak.',
              '',
              'Masalan:',
              'Juma',
              '21:00',
              'Mega Arena',
            ].join('\n')
          : '❌ Ma\'lumotlarni tekshirib, qayta yuboring.';
    await editDraftMessage(
      ctx,
      draft!,
      formatMatchDetailsPrompt() + '\n\n' + errorText,
      groupSetupCancelKeyboard(draft!.id),
    );
    return 'handled';
  }

  applyParsedDetails(draft!, parsed);
  if (draft!.step === 'PREVIEW') {
    await editDraftMessage(
      ctx,
      draft!,
      formatPreviewStep(draft!),
      groupPreviewKeyboard(draft!.id),
    );
  } else {
    await editDraftMessage(
      ctx,
      draft!,
      formatCapacityStep(draft!),
      groupCapacityKeyboard(draft!.id),
    );
  }
  return 'handled';
}

export function registerMatchHandlers(bot: Telegraf<BotContext>): void {
  bot.command('match', async (ctx) => {
    try {
      if (!isGroupChat(ctx)) {
        if (isPrivateChat(ctx)) {
          await ctx.reply(createMatchInstructionsText());
        }
        return;
      }

      await beginGroupMatchSetup(ctx);
    } catch (err) {
      console.error(err);
      await ctx.reply('❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
    }
  });

  bot.action('create_match', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.reply(createMatchInstructionsText());
    } catch (err) {
      console.error(err);
    }
  });

  bot.action(/^mc:(.+):(\d+)$/, async (ctx) => {
    try {
      const draftId = ctx.match[1]!;
      const capacity = Number(ctx.match[2]);
      const draft = getGroupMatchDraftById(draftId);
      if (!draft) {
        await ctx.answerCbQuery();
        return;
      }
      if (!requireDraftOrganizer(ctx, draft)) {
        await ctx.answerCbQuery('❌ Bu o\'yinni faqat tashkilotchi sozlay oladi.');
        return;
      }
      if (!isValidMatchCapacity(capacity)) {
        await ctx.answerCbQuery('❌ 4 dan 50 gacha son kiriting.');
        return;
      }

      setDraftCapacity(draft, capacity);
      await ctx.answerCbQuery();
      await editDraftMessage(
        ctx,
        draft,
        formatPreviewStep(draft),
        groupPreviewKeyboard(draft.id),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mco:(.+)$/, async (ctx) => {
    try {
      const draft = getGroupMatchDraftById(ctx.match[1]!);
      if (!draft) {
        await ctx.answerCbQuery();
        return;
      }
      if (!requireDraftOrganizer(ctx, draft)) {
        await ctx.answerCbQuery('❌ Bu o\'yinni faqat tashkilotchi sozlay oladi.');
        return;
      }

      draft.step = 'WAITING_CUSTOM_CAPACITY';
      await ctx.answerCbQuery();
      await editDraftMessage(
        ctx,
        draft,
        formatCustomCapacityStep(draft),
        groupSetupCancelKeyboard(draft.id),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mcf:(.+)$/, async (ctx) => {
    try {
      const draft = getGroupMatchDraftById(ctx.match[1]!);
      if (!draft) {
        await ctx.answerCbQuery();
        return;
      }
      if (!requireDraftOrganizer(ctx, draft)) {
        await ctx.answerCbQuery('❌ Bu o\'yinni faqat tashkilotchi sozlay oladi.');
        return;
      }
      if (!isDraftReadyToOpen(draft)) {
        await ctx.answerCbQuery('❌ Avval barcha ma\'lumotlarni to\'ldiring.');
        return;
      }

      cleanupStaleMatches();
      const match = createMatchSession(draft, draft.messageId);
      matches.set(match.id, match);
      removeGroupMatchDraft(draft);

      await ctx.answerCbQuery('✅ O\'yin ochildi!');
      await ctx.telegram.editMessageText(
        match.chatId,
        match.messageId,
        undefined,
        formatMatchCard(match),
        matchCardKeyboard(match),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery('❌ Xatolik yuz berdi.', { show_alert: true });
    }
  });

  bot.action(/^mce:(.+)$/, async (ctx) => {
    try {
      const draft = getGroupMatchDraftById(ctx.match[1]!);
      if (!draft) {
        await ctx.answerCbQuery();
        return;
      }
      if (!requireDraftOrganizer(ctx, draft)) {
        await ctx.answerCbQuery('❌ Bu o\'yinni faqat tashkilotchi sozlay oladi.');
        return;
      }

      draft.step = 'EDIT_MENU';
      await ctx.answerCbQuery();
      await editDraftMessage(
        ctx,
        draft,
        'Nimani o\'zgartiramiz?',
        groupEditMenuKeyboard(draft.id),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mced:(.+)$/, async (ctx) => {
    try {
      const draft = getGroupMatchDraftById(ctx.match[1]!);
      if (!draft) {
        await ctx.answerCbQuery();
        return;
      }
      if (!requireDraftOrganizer(ctx, draft)) {
        await ctx.answerCbQuery('❌ Bu o\'yinni faqat tashkilotchi sozlay oladi.');
        return;
      }

      draft.step = 'EDIT_DETAILS';
      await ctx.answerCbQuery();
      await editDraftMessage(
        ctx,
        draft,
        formatEditDetailsPrompt(),
        groupSetupCancelKeyboard(draft.id),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mcec:(.+)$/, async (ctx) => {
    try {
      const draft = getGroupMatchDraftById(ctx.match[1]!);
      if (!draft) {
        await ctx.answerCbQuery();
        return;
      }
      if (!requireDraftOrganizer(ctx, draft)) {
        await ctx.answerCbQuery('❌ Bu o\'yinni faqat tashkilotchi sozlay oladi.');
        return;
      }

      draft.step = 'EDIT_CAPACITY';
      await ctx.answerCbQuery();
      await editDraftMessage(
        ctx,
        draft,
        formatCapacityStep(draft),
        groupCapacityKeyboard(draft.id),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mcb:(.+)$/, async (ctx) => {
    try {
      const draft = getGroupMatchDraftById(ctx.match[1]!);
      if (!draft) {
        await ctx.answerCbQuery();
        return;
      }
      if (!requireDraftOrganizer(ctx, draft)) {
        await ctx.answerCbQuery('❌ Bu o\'yinni faqat tashkilotchi sozlay oladi.');
        return;
      }

      draft.step = 'PREVIEW';
      await ctx.answerCbQuery();
      await editDraftMessage(
        ctx,
        draft,
        formatPreviewStep(draft),
        groupPreviewKeyboard(draft.id),
      );
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mcc:(.+)$/, async (ctx) => {
    try {
      const draft = getGroupMatchDraftById(ctx.match[1]!);
      if (!draft) {
        await ctx.answerCbQuery();
        return;
      }
      if (!requireDraftOrganizer(ctx, draft)) {
        await ctx.answerCbQuery('❌ Bu o\'yinni faqat tashkilotchi sozlay oladi.');
        return;
      }

      removeGroupMatchDraft(draft);
      await ctx.answerCbQuery('Bekor qilindi.');
      await editDraftMessage(ctx, draft, '❌ O\'yin sozlash bekor qilindi.');
    } catch (err) {
      console.error(err);
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mj:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId || !ctx.from) {
        await ctx.answerCbQuery();
        return;
      }

      const displayName = participantDisplayName(
        ctx.from.first_name,
        ctx.from.last_name,
        ctx.from.username,
      );

      const result = tryJoinMatch(match, {
        telegramId: userId,
        displayName,
        username: ctx.from.username,
      });

      switch (result) {
        case 'already':
          await ctx.answerCbQuery('✅ Siz allaqachon ro\'yxatdasiz.');
          return;
        case 'full':
          await ctx.answerCbQuery(
            `❌ Joy qolmagan — ${match.capacity} / ${match.capacity}`,
          );
          return;
        case 'closed':
          await ctx.answerCbQuery('🔒 Ro\'yxat yopildi.');
          return;
        case 'locked':
          await ctx.answerCbQuery('❌ Tarkib jamoalar uchun tayyorlanmoqda.');
          return;
        case 'joined':
          await ctx.answerCbQuery('✅ Ro\'yxatga qo\'shildingiz!');
          break;
      }

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
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^ml:(.+)$/, async (ctx) => {
    try {
      const matchId = ctx.match[1]!;
      const match = getMatch(matchId);
      const userId = uid(ctx);
      if (!match || !userId) {
        await ctx.answerCbQuery();
        return;
      }

      const result = tryLeaveMatch(match, userId);
      if (result === 'not_joined') {
        await ctx.answerCbQuery('Siz ro\'yxatda yo\'qsiz.');
        return;
      }
      if (result === 'locked') {
        await ctx.answerCbQuery('❌ Tarkib jamoalar uchun tayyorlanmoqda.');
        return;
      }

      await ctx.answerCbQuery('Ro\'yxatdan chiqdingiz.');

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
      await ctx.answerCbQuery().catch(() => {});
    }
  });

  bot.action(/^mr:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const match = getMatch(ctx.match[1]!);
      if (!match) return;

      await ctx.telegram.editMessageText(
        match.chatId,
        match.messageId,
        undefined,
        formatRosterMessage(match),
        matchRosterKeyboard(match),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('message is not modified')) {
        console.error(err);
      }
    }
  });

  bot.action(/^mb:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const match = getMatch(ctx.match[1]!);
      if (!match) return;

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
  });
}
