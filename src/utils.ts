export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function parsePositiveInt(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parsePlayerNames(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}
