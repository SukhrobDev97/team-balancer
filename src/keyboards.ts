import { Markup } from 'telegraf';
import { GameSession, Player, PLAYER_TIERS } from './types.js';
import { isComplete } from './game.js';
import { truncateLabel, validTeamCounts } from './utils.js';
import { MAX_TEAMS, MIN_PER_TEAM, MIN_TEAMS } from './types.js';

export const startKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('⚽ Jamoa tuzish', 'new_game')],
]);

export const playerCountKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('10', 'pc:10'),
    Markup.button.callback('12', 'pc:12'),
    Markup.button.callback('14', 'pc:14'),
  ],
  [
    Markup.button.callback('15', 'pc:15'),
    Markup.button.callback('16', 'pc:16'),
    Markup.button.callback('18', 'pc:18'),
  ],
  [
    Markup.button.callback('20', 'pc:20'),
    Markup.button.callback('22', 'pc:22'),
    Markup.button.callback('24', 'pc:24'),
  ],
  [Markup.button.callback('✏️ Boshqa', 'custom_pc')],
]);

export const backToPlayerCountKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('⬅️ Orqaga', 'back_pc')],
]);

export function teamCountKeyboard(playerCount: number) {
  const options = validTeamCounts(
    playerCount,
    MIN_TEAMS,
    MAX_TEAMS,
    MIN_PER_TEAM,
  );
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < options.length; i += 2) {
    const row = options.slice(i, i + 2).map((n) =>
      Markup.button.callback(`${n} ta`, `tc:${n}`),
    );
    rows.push(row);
  }
  rows.push([Markup.button.callback('⬅️ Orqaga', 'back_pc')]);
  return Markup.inlineKeyboard(rows);
}

export function dashboardKeyboard(session: GameSession) {
  const generateLabel = isComplete(session)
    ? '🎲 JAMOALARNI TUZISH'
    : `🎲 Jamoalarni tuzish · ${session.players.length}/${session.playerCount ?? 0}`;

  return Markup.inlineKeyboard([
    [
      Markup.button.callback('A', 'add_tier:A'),
      Markup.button.callback('B', 'add_tier:B'),
    ],
    [
      Markup.button.callback('C', 'add_tier:C'),
      Markup.button.callback('D', 'add_tier:D'),
    ],
    [Markup.button.callback('E', 'add_tier:E')],
    [Markup.button.callback("👥 O'yinchilar", 'players')],
    [Markup.button.callback(generateLabel, 'build_teams')],
    [Markup.button.callback('🔄 Boshidan', 'new_game')],
  ]);
}

export const bulkInputKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('⬅️ Orqaga', 'back_menu')],
]);

export function playerListKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✏️ O'zgartirish", 'edit_list')],
    [Markup.button.callback('⬅️ Orqaga', 'back_menu')],
  ]);
}

export function playerEditListKeyboard(players: Player[]) {
  const rows = players.map((p) => [
    Markup.button.callback(
      truncateLabel(`${p.name} · ${p.tier}`),
      `pe:${p.id}`,
    ),
  ]);
  rows.push([Markup.button.callback('⬅️ Orqaga', 'players')]);
  return Markup.inlineKeyboard(rows);
}

export function playerActionKeyboard(player: Player) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⭐ Darajani o'zgartirish", `ptm:${player.id}`)],
    [Markup.button.callback("🗑 O'chirish", `pd:${player.id}`)],
    [Markup.button.callback('⬅️ Orqaga', 'edit_list')],
  ]);
}

export function playerTierKeyboard(player: Player) {
  const others = PLAYER_TIERS.filter((t) => t !== player.tier);
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < others.length; i += 3) {
    rows.push(
      others
        .slice(i, i + 3)
        .map((t) => Markup.button.callback(t, `pt:${player.id}:${t}`)),
    );
  }
  rows.push([Markup.button.callback('⬅️ Orqaga', `pe:${player.id}`)]);
  return Markup.inlineKeyboard(rows);
}

export const resultKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🔀 Qayta qurish', 'reshuffle')],
  [Markup.button.callback("👥 O'yinchilar", 'players')],
  [Markup.button.callback("🆕 Yangi o'yin", 'new_game')],
]);
