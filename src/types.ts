export type PlayerTier = 'A' | 'B' | 'C' | 'D' | 'E';

export type SessionStep =
  | 'PLAYER_COUNT'
  | 'TEAM_COUNT'
  | 'TIER_MENU'
  | 'TIER_PLAYER_INPUT'
  | 'FINISHED';

export interface Player {
  id: string;
  name: string;
  tier: PlayerTier;
}

export interface GameSession {
  userId: number;
  playerCount?: number;
  teamCount?: number;
  players: Player[];
  selectedTier?: PlayerTier;
  step: SessionStep;
}

export interface Team {
  index: number;
  players: Player[];
  skillScore: number;
  maxPlayers: number;
}

export const PLAYER_TIERS: PlayerTier[] = ['A', 'B', 'C', 'D', 'E'];

export const TIER_SCORE: Record<PlayerTier, number> = {
  A: 5,
  B: 4,
  C: 3,
  D: 2,
  E: 1,
};
