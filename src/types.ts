export type Language = 'uz' | 'ru' | 'en';

export type PlayerTier = 'A' | 'B' | 'C' | 'D' | 'E';

export type SessionStep =
  | 'START'
  | 'PLAYER_COUNT'
  | 'CUSTOM_PLAYER_COUNT'
  | 'TEAM_COUNT'
  | 'TIER_MENU'
  | 'TIER_PLAYER_INPUT'
  | 'PLAYER_LIST'
  | 'PLAYER_EDIT'
  | 'PLAYER_TIER_CHANGE'
  | 'GOALKEEPER_SELECT'
  | 'FINISHED';

export interface Player {
  id: string;
  name: string;
  tier: PlayerTier;
  isGoalkeeper: boolean;
}

export interface GameSession {
  userId: number;
  language: Language;
  playerCount?: number;
  teamCount?: number;
  players: Player[];
  selectedTier?: PlayerTier;
  selectedPlayerId?: string;
  nextPlayerSeq: number;
  sawTierIntro: boolean;
  listOrigin?: 'TIER_MENU' | 'FINISHED';
  promptMessageId?: number;
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

export const TIER_STARS: Record<PlayerTier, string> = {
  A: '⭐⭐⭐⭐⭐',
  B: '⭐⭐⭐⭐',
  C: '⭐⭐⭐',
  D: '⭐⭐',
  E: '⭐',
};

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 50;
export const MIN_TEAMS = 2;
export const MAX_TEAMS = 5;
export const MIN_PER_TEAM = 2;
