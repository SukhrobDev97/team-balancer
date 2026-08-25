import { Markup } from 'telegraf';

export const startKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("⚽ Yangi o'yin", 'new_game')],
]);

export const playerCountKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('12', 'pc:12'),
    Markup.button.callback('15', 'pc:15'),
    Markup.button.callback('18', 'pc:18'),
  ],
  [Markup.button.callback('20', 'pc:20'), Markup.button.callback('24', 'pc:24')],
]);

export const teamCountKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('2', 'tc:2'),
    Markup.button.callback('3', 'tc:3'),
    Markup.button.callback('4', 'tc:4'),
    Markup.button.callback('5', 'tc:5'),
  ],
]);

export const tierMenuKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback("A ga qo'shish", 'add_tier:A'),
    Markup.button.callback("B ga qo'shish", 'add_tier:B'),
  ],
  [
    Markup.button.callback("C ga qo'shish", 'add_tier:C'),
    Markup.button.callback("D ga qo'shish", 'add_tier:D'),
  ],
  [Markup.button.callback("E ga qo'shish", 'add_tier:E')],
  [Markup.button.callback('🎲 Teamlarni tuzish', 'build_teams')],
  [Markup.button.callback('🔄 Boshidan boshlash', 'new_game')],
]);

export const resultKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('🔄 Qayta aralashtirish', 'reshuffle')],
  [Markup.button.callback("⚽ Yangi o'yin", 'new_game')],
]);
