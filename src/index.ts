import { config } from 'dotenv';
import { Telegraf } from 'telegraf';
import { balanceTeams } from './team-balancer.js';
import {
  playerCountKeyboard,
  resultKeyboard,
  startKeyboard,
  teamCountKeyboard,
  tierMenuKeyboard,
} from './keyboards.js';
import { GameSession, Player, PlayerTier, PLAYER_TIERS } from './types.js';
import { parsePlayerNames, parsePositiveInt } from './utils.js';

config();

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 50;
const MIN_TEAMS = 2;
const TEAM_EMOJIS = ['🔵', '🔴', '🟢', '🟡', '🟣'];

const sessions = new Map<number, GameSession>();

function getUserId(ctx: { from?: { id: number } }): number | undefined {
  return ctx.from?.id;
}

function getSession(userId: number): GameSession | undefined {
  return sessions.get(userId);
}

function resetSession(userId: number): GameSession {
  const session: GameSession = { userId, players: [], step: 'PLAYER_COUNT' };
  sessions.set(userId, session);
  return session;
}

function deleteSession(userId: number): void {
  sessions.delete(userId);
}

function remainingSlots(session: GameSession): number {
  return (session.playerCount ?? 0) - session.players.length;
}

function isComplete(session: GameSession): boolean {
  return (
    session.playerCount != null && session.players.length === session.playerCount
  );
}

function tierMenuText(session: GameSession, prefix?: string): string {
  const total = session.playerCount ?? 0;
  const counts = Object.fromEntries(PLAYER_TIERS.map((t) => [t, 0])) as Record<
    PlayerTier,
    number
  >;
  for (const p of session.players) counts[p.tier]++;

  const lines = [
    `O'yinchilar: ${session.players.length} / ${total}`,
    '',
    ...PLAYER_TIERS.map((t) => `${t} — ${counts[t]}`),
  ];

  if (isComplete(session)) {
    lines.push('', "✅ Barcha o'yinchilar kiritildi.");
  } else {
    lines.push('', 'Darajani tanlang:');
  }

  return prefix ? `${prefix}\n\n${lines.join('\n')}` : lines.join('\n');
}

function bulkInputPrompt(tier: PlayerTier): string {
  return `${tier} darajadagi o'yinchilarni bitta xabarda kiriting.`;
}

function formatTeams(players: Player[], teamCount: number): string {
  const teams = balanceTeams(players, teamCount);
  const scores = teams.map((t) => t.skillScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  const blocks = teams.map((team, i) => {
    const emoji = TEAM_EMOJIS[i] ?? '⚪';
    const lines = team.players.map(
      (p, idx) => `${idx + 1}. ${p.name} — ${p.tier}`,
    );
    return [`${emoji} TEAM ${i + 1}`, ...lines, '', `Kuch: ${team.skillScore}`].join(
      '\n',
    );
  });

  return [
    '⚽ JAMOALAR TAYYOR',
    '',
    ...blocks,
    '',
    `Balans: ${min}–${max}`,
    `Farq: ${max - min}`,
  ].join('\n');
}

function isValidPlayerCount(n: number): boolean {
  return n >= MIN_PLAYERS && n <= MAX_PLAYERS;
}

function isValidTeamCount(n: number, playerCount: number): boolean {
  return n >= MIN_TEAMS && n <= playerCount && playerCount / n <= 20;
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
  const userId = getUserId(ctx);
  if (!userId) return;
  deleteSession(userId);
  await ctx.reply("⚽ Yangi o'yin", startKeyboard);
});

bot.command('cancel', async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) return;
  deleteSession(userId);
  await ctx.reply("O'yin bekor qilindi.", startKeyboard);
});

async function beginNewGame(ctx: {
  from?: { id: number };
  answerCbQuery: () => Promise<true>;
  editMessageText: (text: string, extra?: object) => Promise<unknown>;
}) {
  const userId = getUserId(ctx);
  if (!userId) return;
  await ctx.answerCbQuery();
  resetSession(userId);
  await ctx.editMessageText("Nechta o'yinchi qatnashadi?", playerCountKeyboard);
}

bot.action('new_game', async (ctx) => {
  try {
    await beginNewGame(ctx);
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

async function setPlayerCount(
  ctx: {
    from?: { id: number };
    reply: (text: string, extra?: object) => Promise<unknown>;
    editMessageText?: (text: string, extra?: object) => Promise<unknown>;
  },
  count: number,
  edit: boolean,
) {
  const userId = getUserId(ctx);
  if (!userId) return;
  const session = getSession(userId);
  if (!session || session.step !== 'PLAYER_COUNT') {
    await ctx.reply("Avval ⚽ Yangi o'yin ni bosing.");
    return;
  }
  if (!isValidPlayerCount(count)) {
    await ctx.reply(
      `O'yinchilar soni ${MIN_PLAYERS}–${MAX_PLAYERS} oralig'ida bo'lishi kerak.`,
    );
    return;
  }
  session.playerCount = count;
  session.step = 'TEAM_COUNT';
  const text = 'Nechta jamoaga ajratamiz?';
  if (edit && ctx.editMessageText) {
    await ctx.editMessageText(text, teamCountKeyboard);
  } else {
    await ctx.reply(text, teamCountKeyboard);
  }
}

bot.action(/^pc:(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const count = Number(ctx.match[1]);
    await setPlayerCount(ctx, count, true);
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

async function setTeamCount(
  ctx: {
    from?: { id: number };
    reply: (text: string, extra?: object) => Promise<unknown>;
    editMessageText?: (text: string, extra?: object) => Promise<unknown>;
  },
  count: number,
  edit: boolean,
) {
  const userId = getUserId(ctx);
  if (!userId) return;
  const session = getSession(userId);
  if (!session || session.step !== 'TEAM_COUNT' || !session.playerCount) {
    await ctx.reply("Avval o'yinchilar sonini kiriting.");
    return;
  }
  if (!isValidTeamCount(count, session.playerCount)) {
    await ctx.reply(
      "Jamoalar soni kamida 2 bo'lishi va o'yinchilar sonidan oshmasligi kerak.",
    );
    return;
  }
  session.teamCount = count;
  session.step = 'TIER_MENU';
  session.selectedTier = undefined;
  const text = tierMenuText(session);
  if (edit && ctx.editMessageText) {
    await ctx.editMessageText(text, tierMenuKeyboard);
  } else {
    await ctx.reply(text, tierMenuKeyboard);
  }
}

bot.action(/^tc:(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const count = Number(ctx.match[1]);
    await setTeamCount(ctx, count, true);
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

bot.action(/^add_tier:([ABCDE])$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = getUserId(ctx);
    if (!userId) return;
    const session = getSession(userId);
    if (
      !session ||
      (session.step !== 'TIER_MENU' && session.step !== 'TIER_PLAYER_INPUT')
    ) {
      await ctx.reply('Avval jamoalar sonini tanlang.');
      return;
    }
    const remaining = remainingSlots(session);
    if (remaining <= 0) {
      await ctx.editMessageText(tierMenuText(session), tierMenuKeyboard);
      return;
    }
    const tier = ctx.match[1] as PlayerTier;
    session.selectedTier = tier;
    session.step = 'TIER_PLAYER_INPUT';
    await ctx.editMessageText(bulkInputPrompt(tier));
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

bot.action('build_teams', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = getUserId(ctx);
    if (!userId) return;
    const session = getSession(userId);
    if (!session || !session.teamCount) {
      await ctx.reply("Avval o'yinchilarni kiriting.");
      return;
    }

    if (
      session.step === 'TIER_MENU' ||
      session.step === 'TIER_PLAYER_INPUT'
    ) {
      const left = remainingSlots(session);
      if (left > 0) {
        await ctx.reply(`❌ Yana ${left} ta o'yinchi kiritish kerak.`);
        session.step = 'TIER_MENU';
        session.selectedTier = undefined;
        await ctx.reply(tierMenuText(session), tierMenuKeyboard);
        return;
      }
    } else if (session.step !== 'FINISHED') {
      await ctx.reply("Hali barcha o'yinchilar kiritilmagan.");
      return;
    }

    if (!isComplete(session) || session.players.length === 0) {
      const left = remainingSlots(session);
      await ctx.reply(`❌ Yana ${left} ta o'yinchi kiritish kerak.`);
      return;
    }

    session.step = 'FINISHED';
    await ctx.editMessageText(
      formatTeams(session.players, session.teamCount),
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
    const userId = getUserId(ctx);
    if (!userId) return;
    const session = getSession(userId);
    if (!session || session.step !== 'FINISHED' || !session.teamCount) {
      await ctx.reply('Avval jamoalarni tuzing.');
      return;
    }
    await ctx.editMessageText(
      formatTeams(session.players, session.teamCount),
      resultKeyboard,
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});

bot.on('text', async (ctx) => {
  try {
    const userId = getUserId(ctx);
    if (!userId) return;
    const session = getSession(userId);
    const text = ctx.message.text;

    if (!session) {
      await ctx.reply("⚽ Yangi o'yin", startKeyboard);
      return;
    }

    if (session.step === 'PLAYER_COUNT') {
      const n = parsePositiveInt(text);
      if (n === null) {
        await ctx.reply("Raqam kiriting yoki tugmalardan birini bosing.");
        return;
      }
      await setPlayerCount(ctx, n, false);
      return;
    }

    if (session.step === 'TEAM_COUNT') {
      const n = parsePositiveInt(text);
      if (n === null) {
        await ctx.reply("Raqam kiriting yoki tugmalardan birini bosing.");
        return;
      }
      await setTeamCount(ctx, n, false);
      return;
    }

    if (session.step === 'TIER_MENU') {
      await ctx.reply('Darajani tugmalardan tanlang.', tierMenuKeyboard);
      return;
    }

    if (session.step === 'TIER_PLAYER_INPUT') {
      const tier = session.selectedTier;
      if (!tier) {
        session.step = 'TIER_MENU';
        await ctx.reply(tierMenuText(session), tierMenuKeyboard);
        return;
      }

      const names = parsePlayerNames(text);
      if (names.length === 0) {
        await ctx.reply("Ism bo'sh bo'lmasin. Qayta kiriting:");
        return;
      }

      const remaining = remainingSlots(session);
      if (names.length > remaining) {
        await ctx.reply(
          [
            `❌ ${names.length} ta o'yinchi kiritildi, lekin faqat ${remaining} ta joy qoldi.`,
            '',
            `Hozir: ${session.players.length} / ${session.playerCount}`,
          ].join('\n'),
        );
        return;
      }

      for (const name of names) {
        session.players.push({
          id: `${userId}-${Date.now()}-${session.players.length}`,
          name,
          tier,
        });
      }

      session.selectedTier = undefined;
      session.step = 'TIER_MENU';
      await ctx.reply(
        tierMenuText(
          session,
          `✅ ${tier} — ${names.length} ta o'yinchi qo'shildi.`,
        ),
        tierMenuKeyboard,
      );
      return;
    }

    if (session.step === 'FINISHED') {
      await ctx.reply('Tugmalardan birini bosing.', resultKeyboard);
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
