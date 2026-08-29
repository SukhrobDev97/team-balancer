import { Language } from './types.js';

type MatchParams = {
  matchCountLine: { current: number; capacity: number };
  matchFullCapacity: { capacity: number };
  matchPreviewPlayers: { count: number };
  matchRatingProgress: { current: number; total: number };
  matchRatingSaved: { name: string; tier: string };
  matchRatingChanged: { name: string; from: string; to: string };
  matchPrepComplete: { players: number; teams: number };
  matchCapacityRange: { min: number; max: number };
  matchTeamCountOption: { count: number };
  matchTeamPreviewLabel: { index: number };
  matchTeamPublishLabel: { index: number };
};

type MatchStaticKey = {
  [K in keyof MatchParams]: never;
} & {
  matchCreateInstructionsTitle: never;
  matchCreateInstructionsBody: never;
  matchDetailsTitle: never;
  matchDetailsHint: never;
  matchDetailsDate: never;
  matchDetailsTime: never;
  matchDetailsLocation: never;
  matchDetailsExample: never;
  matchEditDetailsHint: never;
  matchCapacityQuestion: never;
  matchCustomCapacityPrompt: never;
  matchPreviewConfirm: never;
  matchInvalidTime: never;
  matchTooFewLines: never;
  matchInvalidDetails: never;
  matchGenericError: never;
  matchOrganizerOnly: never;
  matchDraftIncomplete: never;
  matchOpened: never;
  matchEditMenu: never;
  matchCancelled: never;
  matchSetupCancelled: never;
  matchNoSignups: never;
  matchRosterFull: never;
  matchRosterClosed: never;
  matchCancelledBanner: never;
  matchRosterTitle: never;
  matchJoin: never;
  matchLeave: never;
  matchRoster: never;
  matchCloseRoster: never;
  matchPrepareTeams: never;
  matchMotm: never;
  matchSquad: never;
  matchBack: never;
  matchCancel: never;
  matchCustomCapacity: never;
  matchOpenGame: never;
  matchEdit: never;
  matchEditDetailsMenu: never;
  matchEditCapacityMenu: never;
  matchAlreadyJoined: never;
  matchRosterClosedToast: never;
  matchPrepLocked: never;
  matchJoined: never;
  matchNotOnRoster: never;
  matchLeft: never;
  matchCloseRosterDone: never;
  matchCloseRosterFail: never;
  matchPrepStarted: never;
  matchPrepAlreadyStarted: never;
  matchTeamsAlreadyPublished: never;
  matchPrepTooFew: never;
  matchPrepWrongStatus: never;
  matchStaleStep: never;
  matchPlayerNotFound: never;
  matchRateAllFirst: never;
  matchInvalidTeamCount: never;
  matchBuildTeamsFirst: never;
  matchTeamsPublished: never;
  matchTeamsAlreadyPublishedToast: never;
  matchPrepTitle: never;
  matchRatePrompt: never;
  matchAllRated: never;
  matchEditRatingList: never;
  matchEditRatingTier: never;
  matchTeamCountQuestion: never;
  matchTeamsReadyPreview: never;
  matchTeamsReadyPublish: never;
  matchTeamsPublishedCard: never;
  matchReshuffle: never;
  matchEditRatings: never;
  matchConfirmTeams: never;
  matchContinue: never;
  matchBalanceExcellent: never;
  matchBalanceGood: never;
  matchBalanceFair: never;
  matchTeamsDeepLinkDeprecated: never;
  matchPrepOrganizerOnly: never;
  matchDefaultPlayer: never;
};

export type MatchMessageKey = keyof MatchStaticKey;

type MatchMessageValue<K extends MatchMessageKey> = K extends keyof MatchParams
  ? (params: MatchParams[K]) => string
  : string;

type MatchLocaleMessages = {
  [K in MatchMessageKey]: MatchMessageValue<K>;
};

const uz: MatchLocaleMessages = {
  matchCreateInstructionsTitle: '⚽ O\'yin yaratish',
  matchCreateInstructionsBody: 'Bolinvolni futbol groupingizga qo\'shing va groupda:\n\n/match\n\nyuboring.',
  matchDetailsTitle: '⚽ Yangi o\'yin',
  matchDetailsHint: 'Ma\'lumotlarni 3 qatorda yuboring:',
  matchDetailsDate: '📅 Kun',
  matchDetailsTime: '🕘 Vaqt',
  matchDetailsLocation: '📍 Joy',
  matchDetailsExample: 'Masalan:',
  matchEditDetailsHint: 'Yangi ma\'lumotlarni 3 qatorda yuboring:',
  matchCapacityQuestion: '👥 Nechta o\'yinchi kerak?',
  matchCustomCapacityPrompt: '👥 O\'yinchilar sonini yozing:',
  matchPreviewConfirm: 'Hammasi to\'g\'rimi?',
  matchInvalidTime: '❌ Vaqtni HH:MM ko\'rinishida kiriting.',
  matchTooFewLines: '❌ Kamida 3 qator kerak.',
  matchInvalidDetails: '❌ Ma\'lumotlarni tekshirib, qayta yuboring.',
  matchGenericError: '❌ Xatolik yuz berdi. Qaytadan urinib ko\'ring.',
  matchOrganizerOnly: '❌ Bu o\'yinni faqat tashkilotchi sozlay oladi.',
  matchDraftIncomplete: '❌ Avval barcha ma\'lumotlarni to\'ldiring.',
  matchOpened: '✅ O\'yin ochildi!',
  matchEditMenu: 'Nimani o\'zgartiramiz?',
  matchCancelled: 'Bekor qilindi.',
  matchSetupCancelled: '❌ O\'yin sozlash bekor qilindi.',
  matchNoSignups: 'Hali hech kim yozilmadi.',
  matchRosterFull: '✅ TARKIB TO\'LDI',
  matchRosterClosed: '🔒 RO\'YXAT YOPILDI',
  matchCancelledBanner: '❌ O\'YIN BEKOR QILINDI',
  matchRosterTitle: '👥 Ro\'yxat',
  matchJoin: '✅ Boraman',
  matchLeave: '❌ Bormayman',
  matchRoster: '👥 Ro\'yxat',
  matchCloseRoster: '🔒 Ro\'yxatni yopish',
  matchPrepareTeams: '⚙️ Jamoalarni tayyorlash',
  matchMotm: '🏆 MOTM',
  matchSquad: '👥 Tarkib',
  matchBack: '⬅️ Orqaga',
  matchCancel: '❌ Bekor qilish',
  matchCustomCapacity: '✏️ Boshqa',
  matchOpenGame: '✅ O\'yinni ochish',
  matchEdit: '✏️ O\'zgartirish',
  matchEditDetailsMenu: '📅 Kun / 🕘 Vaqt / 📍 Joy',
  matchEditCapacityMenu: '👥 O\'yinchi soni',
  matchAlreadyJoined: '✅ Siz allaqachon ro\'yxatdasiz.',
  matchRosterClosedToast: '🔒 Ro\'yxat yopildi.',
  matchPrepLocked: '❌ Tarkib jamoalar uchun tayyorlanmoqda.',
  matchJoined: '✅ Ro\'yxatga qo\'shildingiz!',
  matchNotOnRoster: 'Siz ro\'yxatda yo\'qsiz.',
  matchLeft: 'Ro\'yxatdan chiqdingiz.',
  matchCloseRosterDone: '🔒 Ro\'yxat yopildi.',
  matchCloseRosterFail: '❌ Ro\'yxatni yopib bo\'lmaydi.',
  matchPrepStarted: '⚙️ Jamoa tayyorlash boshlandi.',
  matchPrepAlreadyStarted: '⚙️ Jamoa tayyorlash allaqachon boshlangan.',
  matchTeamsAlreadyPublished: '✅ Jamoalar allaqachon tayyorlangan.',
  matchPrepTooFew: '❌ Jamoa tuzish uchun kamida 3 ta o\'yinchi kerak.',
  matchPrepWrongStatus: '❌ Avval ro\'yxatni yoping yoki tarkib to\'lsin.',
  matchStaleStep: '❌ Bu bosqich endi faol emas.',
  matchPlayerNotFound: '❌ O\'yinchi topilmadi.',
  matchRateAllFirst: '❌ Avval barcha o\'yinchilarni baholang.',
  matchInvalidTeamCount: '❌ Bu jamoa soni mos emas.',
  matchBuildTeamsFirst: '❌ Avval jamoalarni tuzing.',
  matchTeamsPublished: '✅ Jamoalar e\'lon qilindi.',
  matchTeamsAlreadyPublishedToast: '✅ Jamoalar allaqachon e\'lon qilingan.',
  matchPrepTitle: '⚙️ Jamoalarni tayyorlash',
  matchRatePrompt: 'Darajasini tanlang:',
  matchAllRated: '✅ Barcha o\'yinchilar baholandi',
  matchEditRatingList: '✏️ Kimning bahosini o\'zgartiramiz?',
  matchEditRatingTier: 'Yangi darajani tanlang:',
  matchTeamCountQuestion: '⚽ Nechta jamoa qilamiz?',
  matchTeamsReadyPreview: '⚽ Jamoalar tayyor',
  matchTeamsReadyPublish: '⚽ JAMOALAR TAYYOR',
  matchTeamsPublishedCard: '✅ Jamoalar tayyorlandi',
  matchReshuffle: '🔀 Qayta qurish',
  matchEditRatings: '✏️ Baholarni o\'zgartirish',
  matchConfirmTeams: '✅ Tasdiqlash',
  matchContinue: '➡️ Davom etish',
  matchBalanceExcellent: '⚖️ Balans: A\'lo',
  matchBalanceGood: '⚖️ Balans: Yaxshi',
  matchBalanceFair: '⚖️ Balans: Imkon qadar tenglashtirildi',
  matchTeamsDeepLinkDeprecated: '❌ Jamoa tayyorlash endi guruh ichida amalga oshiriladi.',
  matchPrepOrganizerOnly: 'Bu amalni faqat o\'yin tashkilotchisi bajarishi mumkin.',
  matchDefaultPlayer: "O'yinchi",
  matchFullCapacity: ({ capacity }) => `❌ Joy qolmagan — ${capacity} / ${capacity}`,
  matchPreviewPlayers: ({ count }) => `👥 ${count} ta o'yinchi`,
  matchRatingProgress: ({ current, total }) => `${current} / ${total}`,
  matchRatingSaved: ({ name, tier }) => `✅ ${name}: ${tier}`,
  matchRatingChanged: ({ name, from, to }) => `✅ ${name}: ${from} → ${to}`,
  matchPrepComplete: ({ players, teams }) =>
    `👥 ${players} ta o'yinchi\n⚽ ${teams} ta jamoa`,
  matchCapacityRange: ({ min, max }) => `❌ ${min} dan ${max} gacha son kiriting.`,
  matchTeamCountOption: ({ count }) => `${count} ta`,
  matchTeamPreviewLabel: ({ index }) => `${index}-jamoa`,
  matchTeamPublishLabel: ({ index }) => `JAMOA ${index}`,
  matchCountLine: ({ current, capacity }) => `👥 ${current} / ${capacity}`,
};

const ru: MatchLocaleMessages = {
  matchCreateInstructionsTitle: '⚽ Создание игры',
  matchCreateInstructionsBody: 'Добавьте Bolinvol в футбольную группу и отправьте:\n\n/match',
  matchDetailsTitle: '⚽ Новая игра',
  matchDetailsHint: 'Отправьте данные в 3 строках:',
  matchDetailsDate: '📅 День',
  matchDetailsTime: '🕘 Время',
  matchDetailsLocation: '📍 Место',
  matchDetailsExample: 'Например:',
  matchEditDetailsHint: 'Отправьте новые данные в 3 строках:',
  matchCapacityQuestion: '👥 Сколько игроков нужно?',
  matchCustomCapacityPrompt: '👥 Введите число игроков:',
  matchPreviewConfirm: 'Всё верно?',
  matchInvalidTime: '❌ Введите время в формате HH:MM.',
  matchTooFewLines: '❌ Нужно минимум 3 строки.',
  matchInvalidDetails: '❌ Проверьте данные и отправьте снова.',
  matchGenericError: '❌ Ошибка. Попробуйте снова.',
  matchOrganizerOnly: '❌ Настраивать игру может только организатор.',
  matchDraftIncomplete: '❌ Сначала заполните все данные.',
  matchOpened: '✅ Игра открыта!',
  matchEditMenu: 'Что изменить?',
  matchCancelled: 'Отменено.',
  matchSetupCancelled: '❌ Настройка игры отменена.',
  matchNoSignups: 'Пока никто не записался.',
  matchRosterFull: '✅ СОСТАВ НАБРАН',
  matchRosterClosed: '🔒 СПИСОК ЗАКРЫТ',
  matchCancelledBanner: '❌ ИГРА ОТМЕНЕНА',
  matchRosterTitle: '👥 Список',
  matchJoin: '✅ Буду',
  matchLeave: '❌ Не смогу',
  matchRoster: '👥 Список',
  matchCloseRoster: '🔒 Закрыть список',
  matchPrepareTeams: '⚙️ Подготовить команды',
  matchMotm: '🏆 MOTM',
  matchSquad: '👥 Состав',
  matchBack: '⬅️ Назад',
  matchCancel: '❌ Отмена',
  matchCustomCapacity: '✏️ Другое',
  matchOpenGame: '✅ Открыть игру',
  matchEdit: '✏️ Изменить',
  matchEditDetailsMenu: '📅 День / 🕘 Время / 📍 Место',
  matchEditCapacityMenu: '👥 Число игроков',
  matchAlreadyJoined: '✅ Вы уже в списке.',
  matchRosterClosedToast: '🔒 Список закрыт.',
  matchPrepLocked: '❌ Состав готовится для команд.',
  matchJoined: '✅ Вы записались!',
  matchNotOnRoster: 'Вас нет в списке.',
  matchLeft: 'Вы вышли из списка.',
  matchCloseRosterDone: '🔒 Список закрыт.',
  matchCloseRosterFail: '❌ Не удалось закрыть список.',
  matchPrepStarted: '⚙️ Подготовка команд начата.',
  matchPrepAlreadyStarted: '⚙️ Подготовка команд уже начата.',
  matchTeamsAlreadyPublished: '✅ Команды уже готовы.',
  matchPrepTooFew: '❌ Нужно минимум 3 игрока для команд.',
  matchPrepWrongStatus: '❌ Сначала закройте список или наберите состав.',
  matchStaleStep: '❌ Этот шаг больше не активен.',
  matchPlayerNotFound: '❌ Игрок не найден.',
  matchRateAllFirst: '❌ Сначала оцените всех игроков.',
  matchInvalidTeamCount: '❌ Такое число команд не подходит.',
  matchBuildTeamsFirst: '❌ Сначала создайте команды.',
  matchTeamsPublished: '✅ Команды опубликованы.',
  matchTeamsAlreadyPublishedToast: '✅ Команды уже опубликованы.',
  matchPrepTitle: '⚙️ Подготовка команд',
  matchRatePrompt: 'Выберите уровень:',
  matchAllRated: '✅ Все игроки оценены',
  matchEditRatingList: '✏️ Чью оценку изменить?',
  matchEditRatingTier: 'Выберите новый уровень:',
  matchTeamCountQuestion: '⚽ Сколько команд?',
  matchTeamsReadyPreview: '⚽ Команды готовы',
  matchTeamsReadyPublish: '⚽ КОМАНДЫ ГОТОВЫ',
  matchTeamsPublishedCard: '✅ Команды готовы',
  matchReshuffle: '🔀 Перемешать',
  matchEditRatings: '✏️ Изменить оценки',
  matchConfirmTeams: '✅ Подтвердить',
  matchContinue: '➡️ Продолжить',
  matchBalanceExcellent: '⚖️ Баланс: Отлично',
  matchBalanceGood: '⚖️ Баланс: Хорошо',
  matchBalanceFair: '⚖️ Баланс: Максимально выровнено',
  matchTeamsDeepLinkDeprecated: '❌ Подготовка команд теперь в группе.',
  matchPrepOrganizerOnly: 'Это действие доступно только организатору.',
  matchDefaultPlayer: 'Игрок',
  matchCountLine: ({ current, capacity }) => `👥 ${current} / ${capacity}`,
  matchFullCapacity: ({ capacity }) => `❌ Мест нет — ${capacity} / ${capacity}`,
  matchPreviewPlayers: ({ count }) => `👥 ${count} игроков`,
  matchRatingProgress: ({ current, total }) => `${current} / ${total}`,
  matchRatingSaved: ({ name, tier }) => `✅ ${name}: ${tier}`,
  matchRatingChanged: ({ name, from, to }) => `✅ ${name}: ${from} → ${to}`,
  matchPrepComplete: ({ players, teams }) =>
    `👥 ${players} игроков\n⚽ ${teams} команд`,
  matchCapacityRange: ({ min, max }) => `❌ Введите число от ${min} до ${max}.`,
  matchTeamCountOption: ({ count }) => `${count}`,
  matchTeamPreviewLabel: ({ index }) => `Команда ${index}`,
  matchTeamPublishLabel: ({ index }) => `КОМАНДА ${index}`,
};

const en: MatchLocaleMessages = {
  matchCreateInstructionsTitle: '⚽ Create a match',
  matchCreateInstructionsBody: 'Add Bolinvol to your football group and send:\n\n/match',
  matchDetailsTitle: '⚽ New match',
  matchDetailsHint: 'Send details in 3 lines:',
  matchDetailsDate: '📅 Day',
  matchDetailsTime: '🕘 Time',
  matchDetailsLocation: '📍 Venue',
  matchDetailsExample: 'Example:',
  matchEditDetailsHint: 'Send updated details in 3 lines:',
  matchCapacityQuestion: '👥 How many players?',
  matchCustomCapacityPrompt: '👥 Enter number of players:',
  matchPreviewConfirm: 'Everything correct?',
  matchInvalidTime: '❌ Enter time as HH:MM.',
  matchTooFewLines: '❌ At least 3 lines required.',
  matchInvalidDetails: '❌ Check the details and try again.',
  matchGenericError: '❌ Something went wrong. Please try again.',
  matchOrganizerOnly: '❌ Only the organizer can configure this match.',
  matchDraftIncomplete: '❌ Fill in all details first.',
  matchOpened: '✅ Match is open!',
  matchEditMenu: 'What to change?',
  matchCancelled: 'Cancelled.',
  matchSetupCancelled: '❌ Match setup cancelled.',
  matchNoSignups: 'No sign-ups yet.',
  matchRosterFull: '✅ ROSTER FULL',
  matchRosterClosed: '🔒 ROSTER CLOSED',
  matchCancelledBanner: '❌ MATCH CANCELLED',
  matchRosterTitle: '👥 Roster',
  matchJoin: '✅ I\'m in',
  matchLeave: '❌ Can\'t make it',
  matchRoster: '👥 Roster',
  matchCloseRoster: '🔒 Close roster',
  matchPrepareTeams: '⚙️ Prepare teams',
  matchMotm: '🏆 MOTM',
  matchSquad: '👥 Squad',
  matchBack: '⬅️ Back',
  matchCancel: '❌ Cancel',
  matchCustomCapacity: '✏️ Custom',
  matchOpenGame: '✅ Open match',
  matchEdit: '✏️ Edit',
  matchEditDetailsMenu: '📅 Day / 🕘 Time / 📍 Venue',
  matchEditCapacityMenu: '👥 Player count',
  matchAlreadyJoined: '✅ You\'re already on the list.',
  matchRosterClosedToast: '🔒 Roster closed.',
  matchPrepLocked: '❌ Roster locked for team preparation.',
  matchJoined: '✅ You joined the roster!',
  matchNotOnRoster: 'You\'re not on the roster.',
  matchLeft: 'You left the roster.',
  matchCloseRosterDone: '🔒 Roster closed.',
  matchCloseRosterFail: '❌ Could not close roster.',
  matchPrepStarted: '⚙️ Team preparation started.',
  matchPrepAlreadyStarted: '⚙️ Team preparation already started.',
  matchTeamsAlreadyPublished: '✅ Teams already published.',
  matchPrepTooFew: '❌ At least 3 players required for teams.',
  matchPrepWrongStatus: '❌ Close the roster or fill it first.',
  matchStaleStep: '❌ This step is no longer active.',
  matchPlayerNotFound: '❌ Player not found.',
  matchRateAllFirst: '❌ Rate all players first.',
  matchInvalidTeamCount: '❌ That team count doesn\'t work.',
  matchBuildTeamsFirst: '❌ Build teams first.',
  matchTeamsPublished: '✅ Teams published.',
  matchTeamsAlreadyPublishedToast: '✅ Teams already published.',
  matchPrepTitle: '⚙️ Prepare teams',
  matchRatePrompt: 'Choose skill level:',
  matchAllRated: '✅ All players rated',
  matchEditRatingList: '✏️ Whose rating to change?',
  matchEditRatingTier: 'Choose new level:',
  matchTeamCountQuestion: '⚽ How many teams?',
  matchTeamsReadyPreview: '⚽ Teams ready',
  matchTeamsReadyPublish: '⚽ TEAMS READY',
  matchTeamsPublishedCard: '✅ Teams ready',
  matchReshuffle: '🔀 Reshuffle',
  matchEditRatings: '✏️ Edit ratings',
  matchConfirmTeams: '✅ Confirm',
  matchContinue: '➡️ Continue',
  matchBalanceExcellent: '⚖️ Balance: Excellent',
  matchBalanceGood: '⚖️ Balance: Good',
  matchBalanceFair: '⚖️ Balance: Best effort',
  matchTeamsDeepLinkDeprecated: '❌ Team prep now happens inside the group.',
  matchPrepOrganizerOnly: 'Only the match organizer can do this.',
  matchDefaultPlayer: 'Player',
  matchCountLine: ({ current, capacity }) => `👥 ${current} / ${capacity}`,
  matchFullCapacity: ({ capacity }) => `❌ Full — ${capacity} / ${capacity}`,
  matchPreviewPlayers: ({ count }) => `👥 ${count} players`,
  matchRatingProgress: ({ current, total }) => `${current} / ${total}`,
  matchRatingSaved: ({ name, tier }) => `✅ ${name}: ${tier}`,
  matchRatingChanged: ({ name, from, to }) => `✅ ${name}: ${from} → ${to}`,
  matchPrepComplete: ({ players, teams }) =>
    `👥 ${players} players\n⚽ ${teams} teams`,
  matchCapacityRange: ({ min, max }) => `❌ Enter a number from ${min} to ${max}.`,
  matchTeamCountOption: ({ count }) => `${count}`,
  matchTeamPreviewLabel: ({ index }) => `Team ${index}`,
  matchTeamPublishLabel: ({ index }) => `TEAM ${index}`,
};

const messages: Record<Language, MatchLocaleMessages> = { uz, ru, en };

export function mt<K extends MatchMessageKey>(
  lang: Language,
  key: K,
  ...args: K extends keyof MatchParams ? [MatchParams[K]] : []
): string {
  const locale = messages[lang] ?? messages.uz;
  const fallback = messages.uz;
  const msg = locale[key] ?? fallback[key];
  if (typeof msg === 'function') {
    return (msg as (params: MatchParams[keyof MatchParams]) => string)(args[0]!);
  }
  return msg;
}

export const MATCH_MESSAGE_KEYS: MatchMessageKey[] = Object.keys(uz) as MatchMessageKey[];

export const MATCH_PARAM_KEYS = [
  'matchCountLine',
  'matchFullCapacity',
  'matchPreviewPlayers',
  'matchRatingProgress',
  'matchRatingSaved',
  'matchRatingChanged',
  'matchPrepComplete',
  'matchCapacityRange',
  'matchTeamCountOption',
  'matchTeamPreviewLabel',
  'matchTeamPublishLabel',
] as const satisfies readonly (keyof MatchParams)[];

export const MATCH_STATIC_KEYS = MATCH_MESSAGE_KEYS.filter(
  (key) => !(MATCH_PARAM_KEYS as readonly string[]).includes(key),
);
