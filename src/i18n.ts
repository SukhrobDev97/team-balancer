import { Language } from './types.js';

type ParamMap = {
  playersProgress: { current: number; total: number };
  teamsLabel: { count: number };
  goalkeepersLabel: { count: number };
  goalkeepersSelected: { count: number };
  goalkeepersButtonCount: { count: number };
  remainingPlayers: { left: number };
  generateTeamsProgress: { current: number; total: number };
  teamCountHeader: { count: number };
  teamCountOption: { count: number };
  playerListTitle: { current: number; total: number };
  playerActions: { name: string; tier: string };
  newTierPrompt: { name: string; tier: string };
  tierChanged: { name: string; from: string; to: string };
  playerRemoved: { name: string };
  needMorePlayersAlert: { left: number };
  bulkPromptTitle: { tier: string };
  playersAdded: { tier: string; count: number };
  tooManyNames: { remaining: number };
  teamName: { index: number };
  balanceLabel: { diff: number };
};

type StaticMessageKey = {
  [K in keyof ParamMap]: never;
} & {
  languageSelectTitle: never;
  langUz: never;
  langRu: never;
  langEn: never;
  startText: never;
  createTeams: never;
  changeLanguage: never;
  newGame: never;
  playerCount: never;
  customOther: never;
  customPlayerCountPrompt: never;
  invalidPlayerCount: never;
  invalidTeamCount: never;
  tierStrongest: never;
  tierBeginner: never;
  tiersHeader: never;
  tierEntry: never;
  readyState: never;
  generateTeams: never;
  generateTeamsReady: never;
  playersButton: never;
  goalkeepersButton: never;
  goalkeeperSelectTitle: never;
  goalkeeperSelectHint: never;
  goalkeeperSelectMulti: never;
  goalkeeperDone: never;
  resetGame: never;
  back: never;
  editList: never;
  changeTierButton: never;
  removeButton: never;
  whichPlayerEdit: never;
  allEnteredAlert: never;
  bulkPromptBody: never;
  bulkPromptExamples: never;
  emptyList: never;
  enterNameRetry: never;
  useButtonsPlayerCount: never;
  useButtonsTeamCount: never;
  useButtons: never;
  cancelMessage: never;
  cancelMultilingual: never;
  genericError: never;
  resultTitle: never;
  buildTeamsFirst: never;
  reshuffle: never;
};

export type MessageKey = keyof StaticMessageKey | keyof ParamMap;

type MessageValue<K extends MessageKey> = K extends keyof ParamMap
  ? (params: ParamMap[K]) => string
  : string;

type LocaleMessages = {
  [K in MessageKey]: MessageValue<K>;
};

const uzMessages: LocaleMessages = {
  languageSelectTitle: 'Tilni tanlang / Выберите язык / Choose language',
  langUz: "🇺🇿 O'zbekcha",
  langRu: '🇷🇺 Русский',
  langEn: '🇬🇧 English',
  startText: [
    '⚽ Jamoalarni adolatli tuzamiz',
    '',
    "O'yinchilarni kuchiga qarab kiriting,",
    'qolganini bot hal qiladi 😎',
  ].join('\n'),
  createTeams: '⚽ Jamoa tuzish',
  changeLanguage: '🌐 Til',
  newGame: "🆕 Yangi o'yin",
  playerCount: "👥 Nechta o'yinchi bor?",
  customOther: '✏️ Boshqa',
  customPlayerCountPrompt: "O'yinchilar sonini yozing:",
  invalidPlayerCount: '❌ 4 dan 50 gacha son kiriting.',
  invalidTeamCount: '❌ Bu jamoa soni mos emas.',
  tierStrongest: 'eng kuchli',
  tierBeginner: 'boshlovchi',
  tiersHeader: 'Darajalar:',
  tierEntry: "Darajani tanlab o'yinchilarni qo'shing:",
  readyState: '✅ Hammasi tayyor. Jamoalarni tuzing.',
  generateTeams: '🎲 Jamoalarni tuzish',
  generateTeamsReady: '🎲 JAMOALARNI TUZISH',
  playersButton: "👥 O'yinchilar",
  goalkeepersButton: '🧤 Darvozabonlar',
  goalkeeperSelectTitle: '🧤 Darvozabonlarni tanlang',
  goalkeeperSelectHint: "Darvozada o'ynaydigan futbolchilarni belgilang.",
  goalkeeperSelectMulti: 'Bir nechta tanlash mumkin.',
  goalkeeperDone: '✅ Tayyor',
  resetGame: '🔄 Boshidan',
  back: '⬅️ Orqaga',
  editList: "✏️ O'zgartirish",
  changeTierButton: "⭐ Darajani o'zgartirish",
  removeButton: "🗑 O'chirish",
  whichPlayerEdit: "Qaysi o'yinchini o'zgartiramiz?",
  allEnteredAlert: 'Hammasi kiritildi.',
  bulkPromptBody: "O'yinchilarni bitta xabarda yozing:",
  bulkPromptExamples: ['Sardor', 'Aziz', 'Jasur'].join('\n'),
  emptyList: '—',
  enterNameRetry: 'Ism yozing, qayta yuboring.',
  useButtonsPlayerCount: "Tugmalardan tanlang yoki ✏️ Boshqa ni bosing.",
  useButtonsTeamCount: 'Jamoa sonini tugmalardan tanlang.',
  useButtons: 'Tugmalardan foydalaning.',
  cancelMessage: "O'yin bekor qilindi.",
  cancelMultilingual:
    "O'yin bekor qilindi. / Игра отменена. / Game cancelled.",
  genericError: "❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.",
  resultTitle: '⚽ JAMOALAR TAYYOR',
  buildTeamsFirst: 'Avval jamoalarni tuzing.',
  reshuffle: '🔀 Qayta qurish',
  playersProgress: ({ current, total }) =>
    `👥 O'yinchilar: ${current} / ${total}`,
  teamsLabel: ({ count }) => `⚽ Jamoalar: ${count}`,
  goalkeepersLabel: ({ count }) => `🧤 Darvozabonlar: ${count}`,
  goalkeepersSelected: ({ count }) => `Tanlandi: ${count}`,
  goalkeepersButtonCount: ({ count }) => `🧤 Darvozabonlar · ${count}`,
  remainingPlayers: ({ left }) => `Yana ${left} ta o'yinchi kerak.`,
  generateTeamsProgress: ({ current, total }) =>
    `🎲 Jamoalarni tuzish · ${current}/${total}`,
  teamCountHeader: ({ count }) =>
    `👥 ${count} o'yinchi\n\n⚽ Nechta jamoa qilamiz?`,
  teamCountOption: ({ count }) => `${count} ta`,
  playerListTitle: ({ current, total }) =>
    `👥 O'yinchilar — ${current} / ${total}`,
  playerActions: ({ name, tier }) => `${name} · ${tier}\n\nNima qilamiz?`,
  newTierPrompt: ({ name, tier }) => `${name} · ${tier}\n\nYangi daraja:`,
  tierChanged: ({ name, from, to }) => `✅ ${name}: ${from} → ${to}`,
  playerRemoved: ({ name }) => `✅ ${name} o'chirildi.`,
  needMorePlayersAlert: ({ left }) => `❌ Yana ${left} ta o'yinchi kerak.`,
  bulkPromptTitle: ({ tier }) => `⭐ ${tier} daraja`,
  playersAdded: ({ tier, count }) =>
    `✅ ${tier} darajaga ${count} ta o'yinchi qo'shildi.`,
  tooManyNames: ({ remaining }) =>
    `❌ Faqat ${remaining} ta joy qoldi.\n\n${remaining} ta o'yinchi kiriting.`,
  teamName: ({ index }) => `JAMOA ${index}`,
  balanceLabel: ({ diff }) => {
    if (diff <= 1) return "⚖️ Balans: A'lo";
    if (diff === 2) return '⚖️ Balans: Yaxshi';
    return '⚖️ Balans: Imkon qadar tenglashtirildi';
  },
};

const messages: Record<Language, LocaleMessages> = {
  uz: uzMessages,
  ru: {
    languageSelectTitle: 'Tilni tanlang / Выберите язык / Choose language',
    langUz: "🇺🇿 O'zbekcha",
    langRu: '🇷🇺 Русский',
    langEn: '🇬🇧 English',
    startText: [
      '⚽ Соберём равные команды',
      '',
      'Укажите уровень игроков,',
      'остальное бот сделает сам 😎',
    ].join('\n'),
    createTeams: '⚽ Создать команды',
    changeLanguage: '🌐 Язык',
    newGame: '🆕 Новая игра',
    playerCount: '👥 Сколько игроков?',
    customOther: '✏️ Другое',
    customPlayerCountPrompt: 'Введите число игроков:',
    invalidPlayerCount: '❌ Введите число от 4 до 50.',
    invalidTeamCount: '❌ Такое число команд не подходит.',
    tierStrongest: 'самый сильный',
    tierBeginner: 'новичок',
    tiersHeader: 'Уровни:',
    tierEntry: 'Выберите уровень и добавьте игроков:',
    readyState: '✅ Все на месте. Делим на команды.',
    generateTeams: '🎲 Разделить на команды',
    generateTeamsReady: '🎲 РАЗДЕЛИТЬ НА КОМАНДЫ',
    playersButton: '👥 Игроки',
    goalkeepersButton: '🧤 Вратари',
    goalkeeperSelectTitle: '🧤 Выберите вратарей',
    goalkeeperSelectHint: 'Отметьте игроков, которые могут играть в воротах.',
    goalkeeperSelectMulti: 'Можно выбрать несколько.',
    goalkeeperDone: '✅ Готово',
    resetGame: '🔄 Сначала',
    back: '⬅️ Назад',
    editList: '✏️ Изменить',
    changeTierButton: '⭐ Сменить уровень',
    removeButton: '🗑 Удалить',
    whichPlayerEdit: 'Кого изменить?',
    allEnteredAlert: 'Все игроки добавлены.',
    bulkPromptBody: 'Введите имена в одном сообщении:',
    bulkPromptExamples: ['Sardor', 'Aziz', 'Jasur'].join('\n'),
    emptyList: '—',
    enterNameRetry: 'Введите имя и отправьте снова.',
    useButtonsPlayerCount: 'Выберите кнопку или нажмите ✏️ Другое.',
    useButtonsTeamCount: 'Выберите число команд кнопкой.',
    useButtons: 'Используйте кнопки.',
    cancelMessage: 'Игра отменена.',
    cancelMultilingual:
      "O'yin bekor qilindi. / Игра отменена. / Game cancelled.",
    genericError: '❌ Ошибка. Попробуйте снова.',
    resultTitle: '⚽ КОМАНДЫ ГОТОВЫ',
    buildTeamsFirst: 'Сначала создайте команды.',
    reshuffle: '🔀 Перемешать заново',
    playersProgress: ({ current, total }) => `👥 Игроки: ${current} / ${total}`,
    teamsLabel: ({ count }) => `⚽ Команд: ${count}`,
    goalkeepersLabel: ({ count }) => `🧤 Вратари: ${count}`,
    goalkeepersSelected: ({ count }) => `Выбрано: ${count}`,
    goalkeepersButtonCount: ({ count }) => `🧤 Вратари · ${count}`,
    remainingPlayers: ({ left }) => `Ещё нужно ${left} игроков.`,
    generateTeamsProgress: ({ current, total }) =>
      `🎲 Разделить · ${current}/${total}`,
    teamCountHeader: ({ count }) =>
      `👥 ${count} игроков\n\n⚽ На сколько команд делим?`,
    teamCountOption: ({ count }) => `${count}`,
    playerListTitle: ({ current, total }) =>
      `👥 Игроки — ${current} / ${total}`,
    playerActions: ({ name, tier }) => `${name} · ${tier}\n\nЧто делаем?`,
    newTierPrompt: ({ name, tier }) => `${name} · ${tier}\n\nНовый уровень:`,
    tierChanged: ({ name, from, to }) => `✅ ${name}: ${from} → ${to}`,
    playerRemoved: ({ name }) => `✅ ${name} удалён.`,
    needMorePlayersAlert: ({ left }) => `❌ Нужно ещё ${left} игроков.`,
    bulkPromptTitle: ({ tier }) => `⭐ Уровень ${tier}`,
    playersAdded: ({ tier, count }) =>
      `✅ Добавлено ${count} игроков уровня ${tier}.`,
    tooManyNames: ({ remaining }) =>
      `❌ Осталось только ${remaining} мест.\n\nВведите ${remaining} имён.`,
    teamName: ({ index }) => `КОМАНДА ${index}`,
    balanceLabel: ({ diff }) => {
      if (diff <= 1) return '⚖️ Баланс: Отлично';
      if (diff === 2) return '⚖️ Баланс: Хорошо';
      return '⚖️ Баланс: Максимально выровнено';
    },
  },
  en: {
    languageSelectTitle: 'Tilni tanlang / Выберите язык / Choose language',
    langUz: "🇺🇿 O'zbekcha",
    langRu: '🇷🇺 Русский',
    langEn: '🇬🇧 English',
    startText: [
      "⚽ Let's build balanced teams",
      '',
      'Add players by skill level,',
      'the bot will handle the rest 😎',
    ].join('\n'),
    createTeams: '⚽ Create teams',
    changeLanguage: '🌐 Language',
    newGame: '🆕 New game',
    playerCount: '👥 How many players?',
    customOther: '✏️ Custom',
    customPlayerCountPrompt: 'Enter number of players:',
    invalidPlayerCount: '❌ Enter a number from 4 to 50.',
    invalidTeamCount: "❌ That team count doesn't work.",
    tierStrongest: 'strongest',
    tierBeginner: 'beginner',
    tiersHeader: 'Skill levels:',
    tierEntry: 'Choose a skill level and add players:',
    readyState: '✅ All set. Build the teams.',
    generateTeams: '🎲 Build teams',
    generateTeamsReady: '🎲 BUILD TEAMS',
    playersButton: '👥 Players',
    goalkeepersButton: '🧤 Goalkeepers',
    goalkeeperSelectTitle: '🧤 Select goalkeepers',
    goalkeeperSelectHint: 'Select players who can play in goal.',
    goalkeeperSelectMulti: 'You can choose multiple players.',
    goalkeeperDone: '✅ Done',
    resetGame: '🔄 Restart',
    back: '⬅️ Back',
    editList: '✏️ Edit',
    changeTierButton: '⭐ Change level',
    removeButton: '🗑 Remove',
    whichPlayerEdit: 'Which player to edit?',
    allEnteredAlert: 'All players entered.',
    bulkPromptBody: 'Enter player names in one message:',
    bulkPromptExamples: ['Sardor', 'Aziz', 'Jasur'].join('\n'),
    emptyList: '—',
    enterNameRetry: 'Enter a name and try again.',
    useButtonsPlayerCount: 'Pick a button or tap ✏️ Custom.',
    useButtonsTeamCount: 'Pick a team count from the buttons.',
    useButtons: 'Use the buttons.',
    cancelMessage: 'Game cancelled.',
    cancelMultilingual:
      "O'yin bekor qilindi. / Игра отменена. / Game cancelled.",
    genericError: '❌ Something went wrong. Please try again.',
    resultTitle: '⚽ TEAMS READY',
    buildTeamsFirst: 'Build teams first.',
    reshuffle: '🔀 Reshuffle',
    playersProgress: ({ current, total }) => `👥 Players: ${current} / ${total}`,
    teamsLabel: ({ count }) => `⚽ Teams: ${count}`,
    goalkeepersLabel: ({ count }) => `🧤 Goalkeepers: ${count}`,
    goalkeepersSelected: ({ count }) => `Selected: ${count}`,
    goalkeepersButtonCount: ({ count }) => `🧤 Goalkeepers · ${count}`,
    remainingPlayers: ({ left }) => `${left} more players needed.`,
    generateTeamsProgress: ({ current, total }) =>
      `🎲 Build teams · ${current}/${total}`,
    teamCountHeader: ({ count }) =>
      `👥 ${count} players\n\n⚽ How many teams?`,
    teamCountOption: ({ count }) => `${count}`,
    playerListTitle: ({ current, total }) =>
      `👥 Players — ${current} / ${total}`,
    playerActions: ({ name, tier }) => `${name} · ${tier}\n\nWhat next?`,
    newTierPrompt: ({ name, tier }) => `${name} · ${tier}\n\nNew level:`,
    tierChanged: ({ name, from, to }) => `✅ ${name}: ${from} → ${to}`,
    playerRemoved: ({ name }) => `✅ ${name} removed.`,
    needMorePlayersAlert: ({ left }) => `❌ Need ${left} more players.`,
    bulkPromptTitle: ({ tier }) => `⭐ Tier ${tier}`,
    playersAdded: ({ tier, count }) =>
      `✅ Added ${count} players to tier ${tier}.`,
    tooManyNames: ({ remaining }) =>
      `❌ Only ${remaining} slots left.\n\nEnter ${remaining} names.`,
    teamName: ({ index }) => `TEAM ${index}`,
    balanceLabel: ({ diff }) => {
      if (diff <= 1) return '⚖️ Balance: Excellent';
      if (diff === 2) return '⚖️ Balance: Good';
      return '⚖️ Balance: Best effort';
    },
  },
};

export function t<K extends MessageKey>(
  lang: Language,
  key: K,
  ...args: K extends keyof ParamMap ? [ParamMap[K]] : []
): string {
  const locale = messages[lang] ?? messages.uz;
  const fallback = messages.uz;
  const msg = locale[key] ?? fallback[key];
  if (typeof msg === 'function') {
    return (msg as (params: ParamMap[keyof ParamMap]) => string)(args[0]!);
  }
  return msg;
}

export const SUPPORTED_LANGUAGES: Language[] = ['uz', 'ru', 'en'];

const STATIC_KEYS: MessageKey[] = [
  'languageSelectTitle',
  'langUz',
  'langRu',
  'langEn',
  'startText',
  'createTeams',
  'changeLanguage',
  'newGame',
  'playerCount',
  'customOther',
  'customPlayerCountPrompt',
  'invalidPlayerCount',
  'invalidTeamCount',
  'tierStrongest',
  'tierBeginner',
  'tiersHeader',
  'tierEntry',
  'readyState',
  'generateTeams',
  'generateTeamsReady',
  'playersButton',
  'goalkeepersButton',
  'goalkeeperSelectTitle',
  'goalkeeperSelectHint',
  'goalkeeperSelectMulti',
  'goalkeeperDone',
  'resetGame',
  'back',
  'editList',
  'changeTierButton',
  'removeButton',
  'whichPlayerEdit',
  'allEnteredAlert',
  'bulkPromptBody',
  'bulkPromptExamples',
  'emptyList',
  'enterNameRetry',
  'useButtonsPlayerCount',
  'useButtonsTeamCount',
  'useButtons',
  'cancelMessage',
  'cancelMultilingual',
  'genericError',
  'resultTitle',
  'buildTeamsFirst',
  'reshuffle',
];

export function allMessageKeys(): MessageKey[] {
  return [...STATIC_KEYS, ...(Object.keys({} as ParamMap) as (keyof ParamMap)[])];
}

export function staticMessageKeys(): MessageKey[] {
  return STATIC_KEYS;
}
