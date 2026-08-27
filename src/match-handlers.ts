import { Telegraf, Context } from 'telegraf';
import {
  cleanupStaleMatches,
  clearDraft,
  createMatchSession,
  createSetupToken,
  ensureDraftFromToken,
  formatMatchCard,
  formatRosterMessage,
  formatSetupPreview,
  getDraft,
  getMatch,
  isSetupComplete,
  isValidDateLabel,
  isValidLocation,
  isValidMatchCapacity,
  isValidTime,
  matchDrafts,
  matches,
  participantDisplayName,
  tryJoinMatch,
  tryLeaveMatch,
  validateSetupToken,
} from './match.js';
import {
  groupMatchLinkKeyboard,
  matchCapacityKeyboard,
  matchCardKeyboard,
  matchEditMenuKeyboard,
  matchPreviewKeyboard,
  matchRosterKeyboard,
} from './match-keyboards.js';
import { MatchSetupDraft } from './types.js';
import { parsePositiveInt, safeEditMessage } from './utils.js';
import { startKeyboard } from './keyboards.js';
import { t } from './i18n.js';
import { Language } from './types.js';

type BotContext = Context;

let botUsername = '';

export function setBotUsername(username: string): void {
  botUsername = username.replace(/^@/, '');
}

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

function setupDeepLink(token: string): string {
  return `https://t.me/${botUsername}?start=match_${token}`;
}

function draftPrompt(draft: MatchSetupDraft): string {
  switch (draft.step) {
    case 'DATE':
    case 'EDIT_DATE':
      return [
        '⚽ Yangi o\'yin',
        '',
        '📅 Qachon o\'ynaysiz?',
        '',
        'Masalan:',
        'Juma',
        '28-avgust',
        'Bugun',
      ].join('\n');
    case 'TIME':
    case 'EDIT_TIME':
      return ['🕘 Soat nechida?', '', 'Masalan:', '21:00'].join('\n');
    case 'LOCATION':
    case 'EDIT_LOCATION':
      return [
        '📍 Qayerda o\'ynaysiz?',
        '',
        'Stadion yoki joy nomini yozing:',
      ].join('\n');
    case 'CAPACITY':
    case 'EDIT_CAPACITY':
      return '👥 Nechta o\'yinchi kerak?';
    case 'CUSTOM_CAPACITY':
    case 'EDIT_CUSTOM_CAPACITY':
      return 'O\'yinchilar sonini yozing:';
    case 'PREVIEW':
      return formatSetupPreview(draft);
    case 'EDIT_MENU':
      return 'Nimani o\'zgartiramiz?';
    default:
      return formatSetupPreview(draft);
  }
}

function draftKeyboard(draft: MatchSetupDraft) {
  switch (draft.step) {
    case 'CAPACITY':
    case 'EDIT_CAPACITY':
      return matchCapacityKeyboard();
    case 'PREVIEW':
      return matchPreviewKeyboard();
    case 'EDIT_MENU':
      return matchEditMenuKeyboard();
    default:
      return undefined;
  }
}

async function sendDraftStep(
  ctx: BotContext,
  draft: MatchSetupDraft,
  edit = false,
) {
  const text = draftPrompt(draft);
  const extra = draftKeyboard(draft);
  if (edit && ctx.callbackQuery) {
    await safeEditMessage(ctx, text, extra);
  } else {
    await ctx.reply(text, extra);
  }
}

async function goToPreview(draft: MatchSetupDraft) {
  draft.step = 'PREVIEW';
}

function matchInstructionsText(): string {
  return [
    'O\'yinni groupga chiqarish uchun:',
    '',
    '1. Bolinvolni futbol groupingizga qo\'shing',
    '2. Groupda /match yuboring',
    '3. "O\'yinni sozlash"ni bosing',
  ].join('\n');
}

export async function handleMatchStartPayload(
  ctx: BotContext,
  userId: number,
  tokenValue: string,
  language: Language = 'uz',
): Promise<boolean> {
  const result = validateSetupToken(tokenValue, userId);
  if (!result.ok) {
    const msg =
      result.reason === 'wrong_user'
        ? '❌ Bu havola faqat tashkilotchi uchun.'
        : result.reason === 'expired'
          ? '❌ Havola muddati tugagan. Groupda /match yuboring.'
          : '❌ Havola topilmadi. Groupda /match yuboring.';
    await ctx.reply(msg, startKeyboard(language));
    return true;
  }

  const draft = ensureDraftFromToken(result.entry, userId);
  if (draft.step === 'PREVIEW' && isSetupComplete(draft)) {
    await sendDraftStep(ctx, draft);
  } else if (!isSetupComplete(draft)) {
    draft.step = draft.step === 'PREVIEW' ? 'PREVIEW' : draft.step;
    if (!draft.dateLabel) draft.step = 'DATE';
    else if (!draft.time) draft.step = 'TIME';
    else if (!draft.location) draft.step = 'LOCATION';
    else if (!draft.capacity) draft.step = 'CAPACITY';
    await sendDraftStep(ctx, draft);
  } else {
    await sendDraftStep(ctx, draft);
  }
  return true;
}

export function registerMatchHandlers(bot: Telegraf<BotContext>): void {
  bot.command('match', async (ctx) => {
    try {
      if (!isGroupChat(ctx)) {
        if (isPrivateChat(ctx)) {
          await ctx.reply('📅 O\'yin yaratish uchun groupda /match yuboring.');
        }
        return;
      }

      const userId = uid(ctx);
      if (!userId) return;

      const groupTitle =
        'title' in ctx.chat! ? ctx.chat.title : undefined;
      const token = createSetupToken(ctx.chat!.id, userId, groupTitle);
      const deepLink = setupDeepLink(token.token);

      await ctx.reply(
        [
          '⚽ Yangi o\'yin',
          '',
          'O\'yinni private chatda sozlang:',
        ].join('\n'),
        groupMatchLinkKeyboard(deepLink),
      );
    } catch (err) {
      console.error(err);
      await ctx.reply('❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.');
    }
  });

  bot.action('create_match', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      await ctx.reply(matchInstructionsText());
    } catch (err) {
      console.error(err);
    }
  });

  bot.action(/^ms_cap:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = uid(ctx);
      if (!userId || !isPrivateChat(ctx)) return;

      const draft = getDraft(userId);
      if (
        !draft ||
        (draft.step !== 'CAPACITY' && draft.step !== 'EDIT_CAPACITY')
      ) {
        return;
      }

      const capacity = Number(ctx.match[1]);
      if (!isValidMatchCapacity(capacity)) {
        await ctx.reply('❌ 4 dan 50 gacha son kiriting.');
        return;
      }

      draft.capacity = capacity;
      if (draft.step === 'EDIT_CAPACITY') {
        await goToPreview(draft);
        await sendDraftStep(ctx, draft, true);
      } else {
        await goToPreview(draft);
        await sendDraftStep(ctx, draft, true);
      }
    } catch (err) {
      console.error(err);
    }
  });

  bot.action('ms_cap_custom', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = uid(ctx);
      if (!userId) return;
      const draft = getDraft(userId);
      if (
        !draft ||
        (draft.step !== 'CAPACITY' && draft.step !== 'EDIT_CAPACITY')
      ) {
        return;
      }
      draft.step =
        draft.step === 'EDIT_CAPACITY' ? 'EDIT_CUSTOM_CAPACITY' : 'CUSTOM_CAPACITY';
      await sendDraftStep(ctx, draft, true);
    } catch (err) {
      console.error(err);
    }
  });

  bot.action('ms_publish', async (ctx) => {
    try {
      const userId = uid(ctx);
      if (!userId) return;

      const draft = getDraft(userId);
      if (!draft || draft.step !== 'PREVIEW' || !isSetupComplete(draft)) {
        await ctx.answerCbQuery();
        return;
      }

      if (draft.published && draft.publishedMatchId) {
        await ctx.answerCbQuery('✅ O\'yin allaqachon groupga chiqarilgan.');
        return;
      }

      await ctx.answerCbQuery();

      cleanupStaleMatches();
      const match = createMatchSession(draft, 0);
      const sent = await ctx.telegram.sendMessage(
        draft.chatId,
        formatMatchCard(match),
        matchCardKeyboard(match),
      );
      match.messageId = sent.message_id;
      matches.set(match.id, match);

      draft.published = true;
      draft.publishedMatchId = match.id;

      await safeEditMessage(
        ctx,
        '✅ O\'yin groupga chiqarildi.',
        startKeyboard('uz'),
      );
      clearDraft(userId);
    } catch (err) {
      console.error(err);
      try {
        await ctx.answerCbQuery('❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.', {
          show_alert: true,
        });
      } catch {
        // ignore
      }
    }
  });

  bot.action('ms_edit', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = uid(ctx);
      if (!userId) return;
      const draft = getDraft(userId);
      if (!draft) return;
      draft.step = 'EDIT_MENU';
      await sendDraftStep(ctx, draft, true);
    } catch (err) {
      console.error(err);
    }
  });

  bot.action('ms_edit_date', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const draft = getDraft(uid(ctx)!);
      if (!draft) return;
      draft.step = 'EDIT_DATE';
      await sendDraftStep(ctx, draft, true);
    } catch (err) {
      console.error(err);
    }
  });

  bot.action('ms_edit_time', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const draft = getDraft(uid(ctx)!);
      if (!draft) return;
      draft.step = 'EDIT_TIME';
      await sendDraftStep(ctx, draft, true);
    } catch (err) {
      console.error(err);
    }
  });

  bot.action('ms_edit_location', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const draft = getDraft(uid(ctx)!);
      if (!draft) return;
      draft.step = 'EDIT_LOCATION';
      await sendDraftStep(ctx, draft, true);
    } catch (err) {
      console.error(err);
    }
  });

  bot.action('ms_edit_capacity', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const draft = getDraft(uid(ctx)!);
      if (!draft) return;
      draft.step = 'EDIT_CAPACITY';
      await sendDraftStep(ctx, draft, true);
    } catch (err) {
      console.error(err);
    }
  });

  bot.action('ms_back_preview', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const draft = getDraft(uid(ctx)!);
      if (!draft) return;
      draft.step = 'PREVIEW';
      await sendDraftStep(ctx, draft, true);
    } catch (err) {
      console.error(err);
    }
  });

  bot.action('ms_cancel', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const userId = uid(ctx);
      if (!userId) return;
      clearDraft(userId);
      const lang = 'uz' as Language;
      await safeEditMessage(
        ctx,
        t(lang, 'startText'),
        startKeyboard(lang),
      );
    } catch (err) {
      console.error(err);
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

export async function handleMatchSetupText(
  ctx: BotContext,
  userId: number,
  text: string,
): Promise<boolean> {
  const draft = getDraft(userId);
  if (!draft || !isPrivateChat(ctx)) return false;

  const trimmed = text.trim();

  switch (draft.step) {
    case 'DATE':
    case 'EDIT_DATE': {
      if (!isValidDateLabel(trimmed)) {
        await ctx.reply('❌ Bo\'sh qoldirmang.');
        return true;
      }
      draft.dateLabel = trimmed;
      if (draft.step === 'EDIT_DATE') {
        draft.step = 'PREVIEW';
        await sendDraftStep(ctx, draft);
      } else {
        draft.step = 'TIME';
        await sendDraftStep(ctx, draft);
      }
      return true;
    }
    case 'TIME':
    case 'EDIT_TIME': {
      if (!isValidTime(trimmed)) {
        await ctx.reply('❌ Vaqtni 21:00 ko\'rinishida kiriting.');
        return true;
      }
      draft.time = trimmed;
      if (draft.step === 'EDIT_TIME') {
        draft.step = 'PREVIEW';
        await sendDraftStep(ctx, draft);
      } else {
        draft.step = 'LOCATION';
        await sendDraftStep(ctx, draft);
      }
      return true;
    }
    case 'LOCATION':
    case 'EDIT_LOCATION': {
      if (!isValidLocation(trimmed)) {
        await ctx.reply('❌ Bo\'sh qoldirmang.');
        return true;
      }
      draft.location = trimmed;
      if (draft.step === 'EDIT_LOCATION') {
        draft.step = 'PREVIEW';
        await sendDraftStep(ctx, draft);
      } else {
        draft.step = 'CAPACITY';
        await sendDraftStep(ctx, draft);
      }
      return true;
    }
    case 'CUSTOM_CAPACITY':
    case 'EDIT_CUSTOM_CAPACITY': {
      const n = parsePositiveInt(trimmed);
      if (n === null || !isValidMatchCapacity(n)) {
        await ctx.reply('❌ 4 dan 50 gacha son kiriting.');
        return true;
      }
      draft.capacity = n;
      draft.step = 'PREVIEW';
      await sendDraftStep(ctx, draft);
      return true;
    }
    default:
      return false;
  }
}

export { matchDrafts };
