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
  isComplete,
  markRosterDirty,
  playerListText,
  remaining,
  removePlayer,
} from './game.js';
import {
  backToPlayerCountKeyboard,
  bulkInputKeyboard,
  dashboardKeyboard,
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
  MAX_PLAYERS,
  MAX_TEAMS,
  MIN_PER_TEAM,
  MIN_PLAYERS,
  MIN_TEAMS,
  Player,
  PlayerTier,
} from './types.js';
import {
  balanceLabel,
  isValidPlayerCount,
  isValidTeamCount,
  parsePlayerNames,
  parsePositiveInt,
} from './utils.js';

config();

const TEAM_EMOJIS = ['🔵', '🔴', '🟢', '🟡', '🟣'];
const sessions = new Map<number, GameSession>();

const START_TEXT = [
  "⚽ Jamoalarni adolatli tuzamiz",
  '',
  "O'yinchilarni kuchiga qarab kiriting,",
  'qolganini bot hal qiladi 😎',
].join('\n');

function uid(ctx: { from?: { id: number } }): number | undefined {
  return ctx.from?.id;
}

function sessionOf(userId: number): GameSession | undefined {
  return sessions.get(userId);
}

function reset(userId: number): GameSession {
  const s = emptySession(userId);
  sessions.set(userId, s);
  return s;
}

function clear(userId: number): void {
  sessions.delete(userId);
}

function formatResult(players: Player[], teamCount: number): string {
  const teams = balanceTeams(players, teamCount);
  const scores = teams.map((t) => t.skillScore);
  const diff = Math.max(...scores) - Math.min(...scores);

  const blocks = teams.map((team, i) => {
    const emoji = TEAM_EMOJIS[i] ?? '⚪';
    const lines = team.players.map((p) => `${p.name} · ${p.tier}`);
    return [`${emoji} JAMOA ${i + 1}`, ...lines].join('\n');
  });

  return ['⚽ JAMOALAR TAYYOR', '', ...blocks, '', balanceLabel(diff)].join(
    '\n',
  );
}

async function safeEdit(
  ctx: {
    editMessageText: (text: string, extra?: object) => Promise<unknown>;
    reply: (text: string, extra?: object) => Promise<unknown>;
  },
  text: string,
  extra?: object,
) {
  try {
    await ctx.editMessageText(text, extra);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('message is not modified')) return;
    await ctx.reply(text, extra);
  }
}

function dash(session: GameSession, prefix?: string) {
  return {
    text: dashboardText(session, prefix),
    extra: dashboardKeyboard(session),
  };
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
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  } catch (replyErr) {
    console.error(replyErr);
  }
});

bot.start(async (ctx) => {
  const userId = uid(ctx);
  if (!userId) return;
  clear(userId);
  await ctx.reply(START_TEXT, startKeyboard);
});

bot.command('cancel', async (ctx) => {
  const userId = uid(ctx);
  if (!userId) return;
  clear(userId);
  await ctx.reply("O'yin bekor qilindi.", startKeyboard);
});

bot.action('new_game', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    reset(userId);
    await safeEdit(ctx, "👥 Nechta o'yinchi bor?", playerCountKeyboard);
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
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
      "O'yinchilar sonini yozing:",
      backToPlayerCountKeyboard,
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
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
    await safeEdit(ctx, "👥 Nechta o'yinchi bor?", playerCountKeyboard);
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
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
  if (!isValidPlayerCount(count, MIN_PLAYERS, MAX_PLAYERS)) {
    await ctx.reply('❌ 4 dan 50 gacha son kiriting.');
    return;
  }
  session.playerCount = count;
  session.step = 'TEAM_COUNT';
  const text = `👥 ${count} o'yinchi\n\n⚽ Nechta jamoa qilamiz?`;
  if (edit && ctx.editMessageText) {
    await ctx.editMessageText(text, teamCountKeyboard(count));
  } else {
    await ctx.reply(text, teamCountKeyboard(count));
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
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
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
      await ctx.reply('❌ Bu jamoa soni mos emas.');
      return;
    }
    session.teamCount = count;
    session.step = 'TIER_MENU';
    const view = dash(session);
    await safeEdit(ctx, view.text, view.extra);
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
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
    const left = remaining(session);
    if (left <= 0) {
      await ctx.answerCbQuery("Hammasi kiritildi.", { show_alert: true });
      session.sawTierIntro = true;
      const view = dash(session);
      await safeEdit(ctx, view.text, view.extra);
      return;
    }
    await ctx.answerCbQuery();
    session.sawTierIntro = true;
    session.selectedTier = ctx.match[1] as PlayerTier;
    session.step = 'TIER_PLAYER_INPUT';
    await safeEdit(ctx, bulkPrompt(session.selectedTier), bulkInputKeyboard);
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

bot.action('back_menu', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;

    if (session.listOrigin === 'FINISHED' && isComplete(session) && session.teamCount) {
      session.step = 'FINISHED';
      session.selectedTier = undefined;
      session.selectedPlayerId = undefined;
      await safeEdit(
        ctx,
        formatResult(session.players, session.teamCount),
        resultKeyboard,
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
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
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
    await safeEdit(ctx, playerListText(session), playerListKeyboard());
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
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
      "Qaysi o'yinchini o'zgartiramiz?",
      playerEditListKeyboard(session.players),
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

bot.action(/^pe:(p\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    const player = findPlayer(session, ctx.match[1]!);
    if (!player) {
      await safeEdit(
        ctx,
        "Qaysi o'yinchini o'zgartiramiz?",
        playerEditListKeyboard(session.players),
      );
      return;
    }
    session.selectedPlayerId = player.id;
    session.step = 'PLAYER_EDIT';
    await safeEdit(
      ctx,
      `${player.name} · ${player.tier}\n\nNima qilamiz?`,
      playerActionKeyboard(player),
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

bot.action(/^ptm:(p\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    const player = findPlayer(session, ctx.match[1]!);
    if (!player) return;
    session.step = 'PLAYER_TIER_CHANGE';
    session.selectedPlayerId = player.id;
    await safeEdit(
      ctx,
      `${player.name} · ${player.tier}\n\nYangi daraja:`,
      playerTierKeyboard(player),
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

bot.action(/^pt:(p\d+):([ABCDE])$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    const result = changePlayerTier(
      session,
      ctx.match[1]!,
      ctx.match[2] as PlayerTier,
    );
    if (!result) {
      session.step = 'PLAYER_LIST';
      await safeEdit(ctx, playerListText(session), playerListKeyboard());
      return;
    }
    markRosterDirty(session);
    session.listOrigin = 'TIER_MENU';
    session.step = 'PLAYER_LIST';
    session.selectedPlayerId = undefined;
    await safeEdit(
      ctx,
      `✅ ${result.name}: ${result.from} → ${result.to}\n\n${playerListText(session)}`,
      playerListKeyboard(),
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

bot.action(/^pd:(p\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session) return;
    const removed = removePlayer(session, ctx.match[1]!);
    markRosterDirty(session);
    session.listOrigin = 'TIER_MENU';
    session.step = 'PLAYER_LIST';
    session.selectedPlayerId = undefined;
    const prefix = removed ? `✅ ${removed.name} o'chirildi.` : '';
    await safeEdit(
      ctx,
      prefix ? `${prefix}\n\n${playerListText(session)}` : playerListText(session),
      playerListKeyboard(),
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
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
    const left = remaining(session);
    if (left > 0 || !isComplete(session)) {
      await ctx.answerCbQuery(`❌ Yana ${left} ta o'yinchi kerak.`, {
        show_alert: true,
      });
      return;
    }
    await ctx.answerCbQuery();
    session.step = 'FINISHED';
    session.listOrigin = 'FINISHED';
    await safeEdit(
      ctx,
      formatResult(session.players, session.teamCount),
      resultKeyboard,
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

bot.action('reshuffle', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    if (!session || session.step !== 'FINISHED' || !session.teamCount) {
      await ctx.reply('Avval jamoalarni tuzing.');
      return;
    }
    await safeEdit(
      ctx,
      formatResult(session.players, session.teamCount),
      resultKeyboard,
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

bot.on('text', async (ctx) => {
  try {
    const userId = uid(ctx);
    if (!userId) return;
    const session = sessionOf(userId);
    const text = ctx.message.text;

    if (!session) {
      await ctx.reply(START_TEXT, startKeyboard);
      return;
    }

    if (session.step === 'PLAYER_COUNT') {
      await ctx.reply('Tugmalardan tanlang yoki ✏️ Boshqa ni bosing.');
      return;
    }

    if (session.step === 'CUSTOM_PLAYER_COUNT') {
      const n = parsePositiveInt(text);
      if (n === null || !isValidPlayerCount(n, MIN_PLAYERS, MAX_PLAYERS)) {
        await ctx.reply('❌ 4 dan 50 gacha son kiriting.');
        return;
      }
      await applyPlayerCount(ctx, session, n, false);
      return;
    }

    if (session.step === 'TEAM_COUNT') {
      await ctx.reply('Jamoa sonini tugmalardan tanlang.');
      return;
    }

    if (
      session.step === 'TIER_MENU' ||
      session.step === 'PLAYER_LIST' ||
      session.step === 'PLAYER_EDIT' ||
      session.step === 'PLAYER_TIER_CHANGE'
    ) {
      await ctx.reply('Tugmalardan foydalaning.');
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
        await ctx.reply("Ism yozing, qayta yuboring.");
        return;
      }

      const result = addPlayers(session, names, tier);
      if (!result.ok) {
        await ctx.reply(
          `❌ Faqat ${result.remaining} ta joy qoldi.\n\n${result.remaining} ta o'yinchi kiriting.`,
        );
        return;
      }

      session.selectedTier = undefined;
      session.step = 'TIER_MENU';
      session.sawTierIntro = true;
      const view = dash(
        session,
        `✅ ${tier} darajaga ${result.added} ta o'yinchi qo'shildi.`,
      );
      await ctx.reply(view.text, view.extra);
      return;
    }

    if (session.step === 'FINISHED') {
      await ctx.reply('Tugmalardan foydalaning.', resultKeyboard);
      return;
    }
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

bot.launch().then(() => {
  console.log('Bot started');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
