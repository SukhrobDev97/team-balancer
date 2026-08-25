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

export function isValidPlayerCount(
  n: number,
  min: number,
  max: number,
): boolean {
  return Number.isInteger(n) && n >= min && n <= max;
}

export function validTeamCounts(
  playerCount: number,
  minTeams: number,
  maxTeams: number,
  minPerTeam: number,
): number[] {
  const max = Math.min(maxTeams, Math.floor(playerCount / minPerTeam));
  const out: number[] = [];
  for (let t = minTeams; t <= max; t++) out.push(t);
  return out;
}

export function isValidTeamCount(
  n: number,
  playerCount: number,
  minTeams: number,
  maxTeams: number,
  minPerTeam: number,
): boolean {
  return validTeamCounts(playerCount, minTeams, maxTeams, minPerTeam).includes(
    n,
  );
}

export function remainingSlots(entered: number, total: number): number {
  return Math.max(0, total - entered);
}

export function canAddNames(entered: number, total: number, incoming: number): boolean {
  return incoming > 0 && entered + incoming <= total;
}

export function truncateLabel(text: string, max = 28): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
