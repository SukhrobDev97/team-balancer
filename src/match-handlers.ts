import { Telegraf, Context } from 'telegraf';
import {
  applyParsedDetails,
  draftTelegramExtra,
  findActiveGroupMatchDraft,
  formatCapacityStep,
  formatCustomCapacityStep,
  formatEditDetailsPrompt,
  formatMatchDetailsPrompt,
  formatPreviewStep,
  getGroupMatchDraftById,
  invalidTimeHelpText,
  isDraftReadyToOpen,
  isCanonicalDraftMessageId,
  isMissingEditTargetError,
  parseCustomCapacity,
  parseMatchDetails,
  removeGroupMatchDraft,
  replaceGroupMatchDraft,
  setDraftCapacity,
  shouldRouteGroupMatchText,
  updateDraftMessageId,
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
import { MAX_MATCH_CAPACITY, MIN_MATCH_CAPACITY } from './types.js';
import {
  matchCardKeyboard,
  matchRosterKeyboard,
} from './match-keyboards.js';
import {
  getMessageThreadId,
  isGroupChatType,
  resolveMessageSenderId,
} from './utils.js';

type BotContext = Context;

function uid(ctx: BotContext): number | undefined {
  return resolveMessageSenderId(ctx);
}

function isGroupChat(ctx: BotContext): boolean {
  return isGroupChatType(ctx.chat?.type);
}

function isPrivateChat(ctx: BotContext): boolean {
  return ctx.chat?.type === 'private';
}

function capacityRangeError(): string {
  return `❌ ${MIN_MATCH_CAPACITY} dan ${MAX_MATCH_CAPACITY} gacha son kiriting.`;
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
  if (!isCanonicalDraftMessageId(draft.messageId)) {
    throw new Error('Cannot edit draft without a canonical bot message id');
  }

  try {
    await ctx.telegram.editMessageText(
      draft.chatId,
      draft.messageId,
      undefined,
      text,
      draftTelegramExtra(draft, extra),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('message is not modified')) return;
    if (isMissingEditTargetError(msg)) {
      const sent = await ctx.telegram.sendMessage(
        draft.chatId,
        text,
        draftTelegramExtra(draft, extra),
      );
      updateDraftMessageId(draft, sent.message_id);
      return;
    }
    throw err;
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
  if (!userId || !ctx.chat || !ctx.message || !('text' in ctx.message)) return;

  const text = formatMatchDetailsPrompt();
  const threadId = getMessageThreadId(ctx.message);
  const sent = await ctx.reply(
    text,
    threadId != null ? { message_thread_id: threadId } : undefined,
  );
  const draft = replaceGroupMatchDraft(
    ctx.chat.id,
    userId,
    sent.message_id,
    threadId,
  );
  await ctx.telegram.editMessageReplyMarkup(
    ctx.chat.id,
    draft.messageId,
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

  const draft = findActiveGroupMatchDraft(ctx.chat.id, userId);
  const route = shouldRouteGroupMatchText(ctx.chat.type, draft, userId);
  if (route === 'ignore' || !draft) return 'ignored';

  if (route === 'custom_capacity') {
    const capacity = parseCustomCapacity(text);
    if (capacity == null) {
      await editDraftMessage(
        ctx,
        draft,
        formatCustomCapacityStep(draft) + '\n\n' + capacityRangeError(),
        groupSetupCancelKeyboard(draft.id),
      );
      return 'handled';
    }
    setDraftCapacity(draft, capacity);
    await editDraftMessage(
      ctx,
      draft,
      formatPreviewStep(draft),
      groupPreviewKeyboard(draft.id),
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
      draft,
      formatMatchDetailsPrompt() + '\n\n' + errorText,
      groupSetupCancelKeyboard(draft.id),
    );
    return 'handled';
  }

  applyParsedDetails(draft, parsed);
  if (draft.step === 'PREVIEW') {
    await editDraftMessage(
      ctx,
      draft,
      formatPreviewStep(draft),
      groupPreviewKeyboard(draft.id),
    );
  } else {
    await editDraftMessage(
      ctx,
      draft,
      formatCapacityStep(draft),
      groupCapacityKeyboard(draft.id),
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
        await ctx.answerCbQuery(capacityRangeError());
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
      const editExtra = draftTelegramExtra(draft, matchCardKeyboard(match));
      removeGroupMatchDraft(draft);

      await ctx.answerCbQuery('✅ O\'yin ochildi!');
      await ctx.telegram.editMessageText(
        match.chatId,
        match.messageId,
        undefined,
        formatMatchCard(match),
        editExtra,
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
