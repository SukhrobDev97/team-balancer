import { config } from 'dotenv';
import { Telegraf } from 'telegraf';
import { balanceTeams } from './team-balancer.js';
import {
  addPlayers,
  bulkPrompt,
  changePlayerTier,
  dashboardText,
  emptySession,
  findPlayer,
  goalkeeperSelectText,
  isComplete,
  markRosterDirty,
  playerListText,
  remaining,
  removePlayer,
  resetGame,
  toggleGoalkeeper,
} from './game.js';
import { t } from './i18n.js';
import {
  backToPlayerCountKeyboard,
  bulkInputKeyboard,
  dashboardKeyboard,
  goalkeeperKeyboard,
  languageKeyboard,
  playerActionKeyboard,
  playerCountKeyboard,
  playerEditListKeyboard,
  playerListKeyboard,
  playerTierKeyboard,
  resultKeyboard,
  startKeyboard,
  teamCountKeyboard,
} from './keyboards.js';
import {
  GameSession,
  Language,
  MAX_PLAYERS,
  MAX_TEAMS,
  MIN_PER_TEAM,
  MIN_PLAYERS,
  MIN_TEAMS,
  PlayerTier,
} from './types.js';
import {
  handleMatchSetupText,
  handleMatchStartPayload,
  registerMatchHandlers,
  setBotUsername,
} from './match-handlers.js';
import {
  handleTeamPrepStartPayload,
  registerTeamPrepHandlers,
  setTeamPrepBotUsername,
} from './team-prep-handlers.js';
import { registerMotmHandlers } from './motm-handlers.js';
import { clearDraft, getDraft } from './match.js';
import {
  isValidPlayerCount,
  isValidTeamCount,
  parsePlayerNames,
  parsePositiveInt,
  safeEditMessage,
  shouldHandlePrivateGameText,
} from './utils.js';

config();

const TEAM_EMOJIS = ['🔵', '🔴', '🟢', '🟡', '🟣'];
const sessions = new Map<number, GameSession>();

function uid(ctx: { from?: { id: number } }): number | undefined {
  return ctx.from?.id;
}

function sessionOf(userId: number): GameSession | undefined {
  return sessions.get(userId);
}

function clear(userId: number): void {
  sessions.delete(userId);
}

function createSession(userId: number, language: Language): GameSession {
  const s = emptySession(userId, language);
  sessions.set(userId, s);
  return s;
}

function formatResult(session: GameSession): string {
  const { language, players, teamCount } = session;
  if (!teamCount) return '';
  const teams = balanceTeams(players, teamCount);
  const scores = teams.map((team) => team.skillScore);
  const diff = Math.max(...scores) - Math.min(...scores);

  const blocks = teams.map((team, i) => {
    const emoji = TEAM_EMOJIS[i] ?? '⚪';
    const lines = team.players.map((p) =>
      p.isGoalkeeper
        ? `🧤 ${p.name} · ${p.tier}`
        : `${p.name} · ${p.tier}`,
    );
    return [
      `${emoji} ${t(language, 'teamName', { index: i + 1 })}`,
      ...lines,
    ].join('\n');
  });

  return [
    t(language, 'resultTitle'),
    '',
    ...blocks,
    '',
    t(language, 'balanceLabel', { diff }),
  ].join('\n');
}

async function safeEdit(
  ctx: {
    editMessageText: (text: string, extra?: object) => Promise<unknown>;
    reply: (text: string, extra?: object) => Promise<unknown>;
  },
  text: string,
  extra?: object,
) {
  await safeEditMessage(ctx, text, extra);
}

function dash(session: GameSession, prefix?: string) {
  return {
    text: dashboardText(session, prefix),
    extra: dashboardKeyboard(session),
  };
}

async function showLanguagePicker(
  ctx: {
    reply: (text: string, extra?: object) => Promise<unknown>;
    editMessageText: (text: string, extra?: object) => Promise<unknown>;
  },
  edit = false,
) {
  const text = t('uz', 'languageSelectTitle');
  const extra = languageKeyboard();
  if (edit) {
    await safeEdit(ctx, text, extra);
  } else {
    await ctx.reply(text, extra);
  }
}

async function renderSession(
  ctx: {
    editMessageText: (text: string, extra?: object) => Promise<unknown>;
    reply: (text: string, extra?: object) => Promise<unknown>;
  },
  session: GameSession,
  prefix?: string,
) {
  const lang = session.language;
  switch (session.step) {
    case 'START':
      await safeEdit(ctx, t(lang, 'startText'), startKeyboard(lang));
      break;
    case 'PLAYER_COUNT':
      await safeEdit(ctx, t(lang, 'playerCount'), playerCountKeyboard(lang));
      break;
    case 'CUSTOM_PLAYER_COUNT':
      await safeEdit(
        ctx,
        t(lang, 'customPlayerCountPrompt'),
        backToPlayerCountKeyboard(lang),
      );
      break;
    case 'TEAM_COUNT':
      if (session.playerCount) {
        await safeEdit(
          ctx,
          t(lang, 'teamCountHeader', { count: session.playerCount }),
          teamCountKeyboard(lang, session.playerCount),
        );
      }
      break;
    case 'TIER_MENU':
    case 'TIER_PLAYER_INPUT': {
      session.step = 'TIER_MENU';
      session.selectedTier = undefined;
      const view = dash(session, prefix);
      await safeEdit(ctx, view.text, view.extra);
      break;
    }
    case 'PLAYER_LIST':
      await safeEdit(
        ctx,
        prefix ? `${prefix}\n\n${playerListText(session)}` : playerListText(session),
        playerListKeyboard(lang),
      );
      break;
    case 'PLAYER_EDIT':
      await safeEdit(
        ctx,
        t(lang, 'whichPlayerEdit'),
        playerEditListKeyboard(lang, session.players),
      );
      break;
    case 'PLAYER_TIER_CHANGE': {
      const player = session.selectedPlayerId
        ? findPlayer(session, session.selectedPlayerId)
        : undefined;
      if (player) {
        await safeEdit(
          ctx,
          t(lang, 'newTierPrompt', { name: player.name, tier: player.tier }),
          playerTierKeyboard(lang, player),
        );
      } else {
        await safeEdit(
          ctx,
          t(lang, 'whichPlayerEdit'),
          playerEditListKeyboard(lang, session.players),
        );
      }
      break;
    }
    case 'GOALKEEPER_SELECT':
      await safeEdit(
        ctx,
        goalkeeperSelectText(session),
        goalkeeperKeyboard(lang, session.players),
      );
      break;
    case 'FINISHED':
      if (session.teamCount) {
        await safeEdit(
          ctx,
          formatResult(session),
          resultKeyboard(lang),
        );
      }
      break;
  }
}

async function replyError(
  ctx: { reply: (text: string, extra?: object) => Promise<unknown> },
  userId?: number,
) {
  const lang = userId ? sessionOf(userId)?.language : undefined;
  await ctx.reply(t(lang ?? 'uz', 'genericError'));
}

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN is required');
  process.exit(1);
}

const bot = new Telegraf(token);

bot.catch(async (err, ctx) => {
  console.error(err);
  try {
    const userId = uid(ctx);
    await replyError(ctx, userId);
  } catch (replyErr) {
    console.error(replyErr);
  }
});

bot.start(async (ctx) => {
  const userId = uid(ctx);
  if (!userId) return;

  const payload = ctx.startPayload;
  if (payload?.startsWith('match_')) {
    const token = payload.slice('match_'.length);
    const lang = sessionOf(userId)?.language ?? 'uz';
    await handleMatchStartPayload(ctx, userId, token, lang);
    return;
  }

  if (payload?.startsWith('teams_')) {
    const token = payload.slice('teams_'.length);
    await handleTeamPrepStartPayload(ctx, userId, token);
    return;
  }

  clear(userId);
  clearDraft(userId);
  await showLanguagePicker(ctx);
});

bot.command('cancel', async (ctx) => {
  const userId = uid(ctx);
  if (!userId) return;
  const session = sessionOf(userId);
  const lang = session?.language;
  clear(userId);
  clearDraft(userId);
  await ctx.reply(
    lang ? t(lang, 'cancelMessage') : t('uz', 'cancelMultilingual'),
    languageKeyboard(),
  );
});

bot.action(/^lang:(uz|ru|en)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const language = ctx.match[1] as Language;
    let session = sessionOf(userId);
    if (!session) {
      session = createSession(userId, language);
    } else {
      session.language = language;
    }
    await renderSession(ctx, session);
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action('change_lang', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await showLanguagePicker(ctx, true);
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action('new_game', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    let session = sessionOf(userId);
    if (!session) {
      await showLanguagePicker(ctx);
      return;
    }
    resetGame(session);
    await safeEdit(
      ctx,
      t(session.language, 'playerCount'),
      playerCountKeyboard(session.language),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action('custom_pc', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session || session.step !== 'PLAYER_COUNT') return;
    session.step = 'CUSTOM_PLAYER_COUNT';
    await safeEdit(
      ctx,
      t(session.language, 'customPlayerCountPrompt'),
      backToPlayerCountKeyboard(session.language),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action('back_pc', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    session.playerCount = undefined;
    session.step = 'PLAYER_COUNT';
    await safeEdit(
      ctx,
      t(session.language, 'playerCount'),
      playerCountKeyboard(session.language),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

async function applyPlayerCount(
  ctx: {
    reply: (text: string, extra?: object) => Promise<unknown>;
    editMessageText?: (text: string, extra?: object) => Promise<unknown>;
  },
  session: GameSession,
  count: number,
  edit: boolean,
) {
  const lang = session.language;
  if (!isValidPlayerCount(count, MIN_PLAYERS, MAX_PLAYERS)) {
    await ctx.reply(t(lang, 'invalidPlayerCount'));
    return;
  }
  session.playerCount = count;
  session.step = 'TEAM_COUNT';
  const text = t(lang, 'teamCountHeader', { count });
  const extra = teamCountKeyboard(lang, count);
  if (edit && ctx.editMessageText) {
    await ctx.editMessageText(text, extra);
  } else {
    await ctx.reply(text, extra);
  }
}

bot.action(/^pc:(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session || session.step !== 'PLAYER_COUNT') return;
    await applyPlayerCount(ctx, session, Number(ctx.match[1]), true);
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action(/^tc:(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session || session.step !== 'TEAM_COUNT' || !session.playerCount) {
      return;
    }
    const count = Number(ctx.match[1]);
    if (
      !isValidTeamCount(
        count,
        session.playerCount,
        MIN_TEAMS,
        MAX_TEAMS,
        MIN_PER_TEAM,
      )
    ) {
      await ctx.reply(t(session.language, 'invalidTeamCount'));
      return;
    }
    session.teamCount = count;
    session.step = 'TIER_MENU';
    const view = dash(session);
    await safeEdit(ctx, view.text, view.extra);
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action(/^add_tier:([ABCDE])$/, async (ctx) => {
  try {
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) {
      await ctx.answerCbQuery();
      return;
    }
    if (session.step !== 'TIER_MENU' && session.step !== 'TIER_PLAYER_INPUT') {
      await ctx.answerCbQuery();
      return;
    }
    const lang = session.language;
    const left = remaining(session);
    if (left <= 0) {
      await ctx.answerCbQuery(t(lang, 'allEnteredAlert'), { show_alert: true });
      session.sawTierIntro = true;
      const view = dash(session);
      await safeEdit(ctx, view.text, view.extra);
      return;
    }
    await ctx.answerCbQuery();
    session.sawTierIntro = true;
    session.selectedTier = ctx.match[1] as PlayerTier;
    session.step = 'TIER_PLAYER_INPUT';
    await safeEdit(
      ctx,
      bulkPrompt(lang, session.selectedTier),
      bulkInputKeyboard(lang),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action('back_menu', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;

    if (
      session.listOrigin === 'FINISHED' &&
      isComplete(session) &&
      session.teamCount
    ) {
      session.step = 'FINISHED';
      session.selectedTier = undefined;
      session.selectedPlayerId = undefined;
      await safeEdit(
        ctx,
        formatResult(session),
        resultKeyboard(session.language),
      );
      return;
    }

    session.step = 'TIER_MENU';
    session.selectedTier = undefined;
    session.selectedPlayerId = undefined;
    session.sawTierIntro = true;
    const view = dash(session);
    await safeEdit(ctx, view.text, view.extra);
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action('players', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    if (session.step === 'FINISHED') session.listOrigin = 'FINISHED';
    else session.listOrigin = 'TIER_MENU';
    session.step = 'PLAYER_LIST';
    session.sawTierIntro = true;
    await safeEdit(
      ctx,
      playerListText(session),
      playerListKeyboard(session.language),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action('goalkeepers', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session || session.players.length === 0) return;
    session.step = 'GOALKEEPER_SELECT';
    session.sawTierIntro = true;
    await safeEdit(
      ctx,
      goalkeeperSelectText(session),
      goalkeeperKeyboard(session.language, session.players),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action(/^gk_toggle:(p\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session || session.step !== 'GOALKEEPER_SELECT') return;
    toggleGoalkeeper(session, ctx.match[1]!);
    await safeEdit(
      ctx,
      goalkeeperSelectText(session),
      goalkeeperKeyboard(session.language, session.players),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action(['gk_done', 'gk_back'], async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    session.step = 'TIER_MENU';
    session.sawTierIntro = true;
    const view = dash(session);
    await safeEdit(ctx, view.text, view.extra);
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action('edit_list', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    session.step = 'PLAYER_EDIT';
    await safeEdit(
      ctx,
      t(session.language, 'whichPlayerEdit'),
      playerEditListKeyboard(session.language, session.players),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action(/^pe:(p\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    const lang = session.language;
    const player = findPlayer(session, ctx.match[1]!);
    if (!player) {
      await safeEdit(
        ctx,
        t(lang, 'whichPlayerEdit'),
        playerEditListKeyboard(lang, session.players),
      );
      return;
    }
    session.selectedPlayerId = player.id;
    session.step = 'PLAYER_EDIT';
    await safeEdit(
      ctx,
      t(lang, 'playerActions', { name: player.name, tier: player.tier }),
      playerActionKeyboard(lang, player),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action(/^ptm:(p\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    const lang = session.language;
    const player = findPlayer(session, ctx.match[1]!);
    if (!player) return;
    session.step = 'PLAYER_TIER_CHANGE';
    session.selectedPlayerId = player.id;
    await safeEdit(
      ctx,
      t(lang, 'newTierPrompt', { name: player.name, tier: player.tier }),
      playerTierKeyboard(lang, player),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action(/^pt:(p\d+):([ABCDE])$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    const lang = session.language;
    const result = changePlayerTier(
      session,
      ctx.match[1]!,
      ctx.match[2] as PlayerTier,
    );
    if (!result) {
      session.step = 'PLAYER_LIST';
      await safeEdit(
        ctx,
        playerListText(session),
        playerListKeyboard(lang),
      );
      return;
    }
    markRosterDirty(session);
    session.listOrigin = 'TIER_MENU';
    session.step = 'PLAYER_LIST';
    session.selectedPlayerId = undefined;
    const prefix = t(lang, 'tierChanged', {
      name: result.name,
      from: result.from,
      to: result.to,
    });
    await safeEdit(
      ctx,
      `${prefix}\n\n${playerListText(session)}`,
      playerListKeyboard(lang),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action(/^pd:(p\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    const lang = session.language;
    const removed = removePlayer(session, ctx.match[1]!);
    markRosterDirty(session);
    session.listOrigin = 'TIER_MENU';
    session.step = 'PLAYER_LIST';
    session.selectedPlayerId = undefined;
    const prefix = removed ? t(lang, 'playerRemoved', { name: removed.name }) : '';
    await safeEdit(
      ctx,
      prefix ? `${prefix}\n\n${playerListText(session)}` : playerListText(session),
      playerListKeyboard(lang),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action('build_teams', async (ctx) => {
  try {
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session || !session.teamCount) {
      await ctx.answerCbQuery();
      return;
    }
    const lang = session.language;
    const left = remaining(session);
    if (left > 0 || !isComplete(session)) {
      await ctx.answerCbQuery(t(lang, 'needMorePlayersAlert', { left }), {
        show_alert: true,
      });
      return;
    }
    await ctx.answerCbQuery();
    session.step = 'FINISHED';
    session.listOrigin = 'FINISHED';
    await safeEdit(ctx, formatResult(session), resultKeyboard(lang));
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.action('reshuffle', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session || session.step !== 'FINISHED' || !session.teamCount) {
      await ctx.reply(t(session?.language ?? 'uz', 'buildTeamsFirst'));
      return;
    }
    await safeEdit(
      ctx,
      formatResult(session),
      resultKeyboard(session.language),
    );
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

registerMatchHandlers(bot);
registerTeamPrepHandlers(bot);
registerMotmHandlers(bot);

bot.on('text', async (ctx) => {
  try {
    const userId = uid(ctx);
    if (!userId) return;
    const text = ctx.message.text;

    if (!shouldHandlePrivateGameText(ctx.chat?.type, text)) {
      return;
    }

    if (getDraft(userId)) {
      const handled = await handleMatchSetupText(ctx, userId, text);
      if (handled) return;
    }

    const session = sessionOf(userId);

    if (!session) {
      await showLanguagePicker(ctx);
      return;
    }

    const lang = session.language;

    if (session.step === 'START') {
      await ctx.reply(t(lang, 'useButtons'), startKeyboard(lang));
      return;
    }

    if (session.step === 'PLAYER_COUNT') {
      await ctx.reply(t(lang, 'useButtonsPlayerCount'));
      return;
    }

    if (session.step === 'CUSTOM_PLAYER_COUNT') {
      const n = parsePositiveInt(text);
      if (n === null || !isValidPlayerCount(n, MIN_PLAYERS, MAX_PLAYERS)) {
        await ctx.reply(t(lang, 'invalidPlayerCount'));
        return;
      }
      await applyPlayerCount(ctx, session, n, false);
      return;
    }

    if (session.step === 'TEAM_COUNT') {
      await ctx.reply(t(lang, 'useButtonsTeamCount'));
      return;
    }

    if (
      session.step === 'TIER_MENU' ||
      session.step === 'PLAYER_LIST' ||
      session.step === 'PLAYER_EDIT' ||
      session.step === 'PLAYER_TIER_CHANGE' ||
      session.step === 'GOALKEEPER_SELECT'
    ) {
      await ctx.reply(t(lang, 'useButtons'));
      return;
    }

    if (session.step === 'TIER_PLAYER_INPUT') {
      const tier = session.selectedTier;
      if (!tier) {
        session.step = 'TIER_MENU';
        const view = dash(session);
        await ctx.reply(view.text, view.extra);
        return;
      }

      const names = parsePlayerNames(text);
      if (names.length === 0) {
        await ctx.reply(t(lang, 'enterNameRetry'));
        return;
      }

      const result = addPlayers(session, names, tier);
      if (!result.ok) {
        await ctx.reply(
          t(lang, 'tooManyNames', { remaining: result.remaining }),
        );
        return;
      }

      session.selectedTier = undefined;
      session.step = 'TIER_MENU';
      session.sawTierIntro = true;
      const view = dash(
        session,
        t(lang, 'playersAdded', { tier, count: result.added }),
      );
      await ctx.reply(view.text, view.extra);
      return;
    }

    if (session.step === 'FINISHED') {
      await ctx.reply(t(lang, 'useButtons'), resultKeyboard(lang));
      return;
    }
  } catch (err) {
    console.error(err);
    await replyError(ctx, uid(ctx));
  }
});

bot.launch().then(async () => {
  const me = await bot.telegram.getMe();
  const username = me.username ?? '';
  setBotUsername(username);
  setTeamPrepBotUsername(username);
  console.log('Bot started');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
