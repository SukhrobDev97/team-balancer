import { Markup } from 'telegraf';
import { t } from './i18n.js';
import { GameSession, Language, Player, PLAYER_TIERS } from './types.js';
import { goalkeeperCount, isComplete } from './game.js';
import { truncateLabel, validTeamCounts } from './utils.js';
import { MAX_TEAMS, MIN_PER_TEAM, MIN_TEAMS } from './types.js';

export function languageKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t('uz', 'langUz'), 'lang:uz')],
    [Markup.button.callback(t('uz', 'langRu'), 'lang:ru')],
    [Markup.button.callback(t('uz', 'langEn'), 'lang:en')],
  ]);
}

export function startKeyboard(lang: Language) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, 'createTeams'), 'new_game')],
    [Markup.button.callback(t(lang, 'createMatch'), 'create_match')],
    [Markup.button.callback(t(lang, 'changeLanguage'), 'change_lang')],
  ]);
}

export function playerCountKeyboard(lang: Language) {
  return Markup.inlineKeyboard([
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
    [Markup.button.callback(t(lang, 'customOther'), 'custom_pc')],
  ]);
}

export function backToPlayerCountKeyboard(lang: Language) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, 'back'), 'back_pc')],
  ]);
}

export function teamCountKeyboard(lang: Language, playerCount: number) {
  const options = validTeamCounts(
    playerCount,
    MIN_TEAMS,
    MAX_TEAMS,
    MIN_PER_TEAM,
  );
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < options.length; i += 2) {
    const row = options.slice(i, i + 2).map((n) =>
      Markup.button.callback(
        t(lang, 'teamCountOption', { count: n }),
        `tc:${n}`,
      ),
    );
    rows.push(row);
  }
  rows.push([Markup.button.callback(t(lang, 'back'), 'back_pc')]);
  return Markup.inlineKeyboard(rows);
}

export function dashboardKeyboard(session: GameSession) {
  const lang = session.language;
  const generateLabel = isComplete(session)
    ? t(lang, 'generateTeamsReady')
    : t(lang, 'generateTeamsProgress', {
        current: session.players.length,
        total: session.playerCount ?? 0,
      });

  const gkCount = goalkeeperCount(session.players);
  const gkLabel =
    gkCount > 0
      ? t(lang, 'goalkeepersButtonCount', { count: gkCount })
      : t(lang, 'goalkeepersButton');

  const rows: ReturnType<typeof Markup.button.callback>[][] = [
    [
      Markup.button.callback('A', 'add_tier:A'),
      Markup.button.callback('B', 'add_tier:B'),
    ],
    [
      Markup.button.callback('C', 'add_tier:C'),
      Markup.button.callback('D', 'add_tier:D'),
    ],
    [Markup.button.callback('E', 'add_tier:E')],
  ];

  if (session.players.length > 0) {
    rows.push([Markup.button.callback(gkLabel, 'goalkeepers')]);
  }

  rows.push(
    [Markup.button.callback(t(lang, 'playersButton'), 'players')],
    [Markup.button.callback(generateLabel, 'build_teams')],
    [Markup.button.callback(t(lang, 'resetGame'), 'new_game')],
  );

  return Markup.inlineKeyboard(rows);
}

export function bulkInputKeyboard(lang: Language) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, 'back'), 'back_menu')],
  ]);
}

export function playerListKeyboard(lang: Language) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, 'editList'), 'edit_list')],
    [Markup.button.callback(t(lang, 'back'), 'back_menu')],
  ]);
}

export function playerEditListKeyboard(lang: Language, players: Player[]) {
  const rows = players.map((p) => [
    Markup.button.callback(
      truncateLabel(`${p.name} · ${p.tier}`),
      `pe:${p.id}`,
    ),
  ]);
  rows.push([Markup.button.callback(t(lang, 'back'), 'players')]);
  return Markup.inlineKeyboard(rows);
}

export function playerActionKeyboard(lang: Language, player: Player) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        t(lang, 'changeTierButton'),
        `ptm:${player.id}`,
      ),
    ],
    [Markup.button.callback(t(lang, 'removeButton'), `pd:${player.id}`)],
    [Markup.button.callback(t(lang, 'back'), 'edit_list')],
  ]);
}

export function playerTierKeyboard(lang: Language, player: Player) {
  const others = PLAYER_TIERS.filter((tier) => tier !== player.tier);
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < others.length; i += 3) {
    rows.push(
      others
        .slice(i, i + 3)
        .map((tier) => Markup.button.callback(tier, `pt:${player.id}:${tier}`)),
    );
  }
  rows.push([Markup.button.callback(t(lang, 'back'), `pe:${player.id}`)]);
  return Markup.inlineKeyboard(rows);
}

export function goalkeeperKeyboard(lang: Language, players: Player[]) {
  const rows = players.map((p) => {
    const base = `${p.name} · ${p.tier}`;
    const label = p.isGoalkeeper
      ? truncateLabel(`🧤 ${base} ✓`)
      : truncateLabel(base);
    return [Markup.button.callback(label, `gk_toggle:${p.id}`)];
  });
  rows.push([Markup.button.callback(t(lang, 'goalkeeperDone'), 'gk_done')]);
  rows.push([Markup.button.callback(t(lang, 'back'), 'gk_back')]);
  return Markup.inlineKeyboard(rows);
}

export function resultKeyboard(lang: Language) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(t(lang, 'reshuffle'), 'reshuffle')],
    [Markup.button.callback(t(lang, 'playersButton'), 'players')],
    [Markup.button.callback(t(lang, 'newGame'), 'new_game')],
  ]);
}
