export const MOTM_WINNER_TEMPLATES = [
  "🔥 {name} bugun odam emas ekan 😂",
  "🚀 {name} bugun boshqa levelda edi 😂",
  "🧙 {name} futbol o'ynamadi, sehr ko'rsatdi 😂",
  "📞 {name}ni skautlar qidiryapti, telefonini o'chirib qo'ysin 😂",
  "👑 Maydon bugun {name}niki ekan 😂",
  "🎮 {name} difficulty'ni Easy qilib qo'yibdi shekilli 😂",
  "⚽ {name} bugun to'p bilan alohida gaplashib oldi 😂",
  "🛸 {name}ni tekshirish kerak, bu sayyoradanmas shekilli 😂",
  "📸 {name} bugun highlight yig'ib yurdi 😂",
  "🔥 {name}ga bugun nerf kerak edi 😂",
  "🎩 {name} bugun fokus ko'rsatib ketdi 😂",
  "🚨 {name} bugun himoyachilarga tinchlik bermadi 😂",
  "🧑‍🍳 {name} bugun maydonda ovqat pishirib ketdi 😂",
  "🎬 {name} bugun o'z highlight videosini o'zi suratga oldi 😂",
  "🧱 {name} bugun o'tkazmayman deb kelgan ekan 😂",
  "💀 {name} bugun raqiblarni ishidan chiqarib yubordi 😂",
  "📈 {name}ning transfer narxi bugun ko'tarildi 😂",
  "🫡 {name} bugun vazifani ortig'i bilan bajardi 😂",
  "🌪 {name} o'tgan joyda himoya qolmadi 😂",
  "🏆 {name} bugun sovrinni uyiga olib ketishga kelgan ekan 😂",
];

export const MOTM_TIE_TEMPLATES = [
  "🤝 Bugun taxtni bo'lishishga to'g'ri keldi 😂",
  '👑 Bitta toj kamlik qildi bugun 😂',
  "⚖️ Xalq bir qarorga kela olmadi 😂",
  '🏆 Bugun MOTM ham jamoaviy chiqdi 😂',
  "😂 Ikkalasi ham sovrinni qo'yib yubormadi.",
  '🤝 Bugun taxt ikkita ekan 😂',
  "⚔️ Durrang, lekin ikkalasi ham zo'r o'ynadi 😂",
  '😅 Hakam ham ikkilanib qoldi shekilli 😂',
];

export function fillMotmName(template: string, name: string): string {
  return template.replaceAll('{name}', name);
}

export function getRandomMotmMessage(
  name: string,
  random: () => number = Math.random,
): string {
  const i = Math.floor(random() * MOTM_WINNER_TEMPLATES.length);
  return fillMotmName(MOTM_WINNER_TEMPLATES[i]!, name);
}

export function getRandomMotmTieMessage(
  random: () => number = Math.random,
): string {
  const i = Math.floor(random() * MOTM_TIE_TEMPLATES.length);
  return MOTM_TIE_TEMPLATES[i]!;
}
