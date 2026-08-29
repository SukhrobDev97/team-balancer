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

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 50;
export const MIN_TEAMS = 2;
export const MAX_TEAMS = 5;
export const MIN_PER_TEAM = 2;

export type MatchStatus = 'OPEN' | 'FULL' | 'CLOSED' | 'CANCELLED';

export interface MatchParticipant {
  telegramId: number;
  displayName: string;
  username?: string;
  joinedAt: number;
}

export type MotmStatus = 'NOT_STARTED' | 'OPEN' | 'FINISHED';

export interface MotmPodiumEntry {
  participantId: string;
  displayName: string;
  votes: number;
  place: number;
}

export interface MotmState {
  status: 'OPEN' | 'FINISHED';
  startedByTelegramId: number;
  startedAt: number;
  votes: Record<string, string>;
  messageId?: number;
  keyboardPage?: number;
  finishedAt?: number;
  winnerParticipantIds?: string[];
  finalJoke?: string;
  podium?: MotmPodiumEntry[];
}

export type TeamPrepView =
  | 'RATING'
  | 'SUMMARY'
  | 'EDIT_LIST'
  | 'EDIT_TIER'
  | 'TEAM_COUNT'
  | 'PREVIEW';

export interface MatchSession {
  id: string;
  organizerTelegramId: number;
  chatId: number;
  messageId: number;
  messageThreadId?: number;
  dateLabel: string;
  time: string;
  location: string;
  capacity: number;
  participants: MatchParticipant[];
  status: MatchStatus;
  createdAt: number;
  teamPreparation?: TeamPreparation;
  teamsMessageId?: number;
  teamsPublishedAt?: number;
  motm?: MotmState;
}

export interface TeamPreparation {
  locked: boolean;
  ratings: Record<string, PlayerTier>;
  view?: TeamPrepView;
  editingTelegramId?: number;
  teamCount?: number;
  generatedTeams?: Team[];
}

export type GroupMatchDraftStep =
  | 'MATCH_DETAILS'
  | 'CAPACITY'
  | 'WAITING_CUSTOM_CAPACITY'
  | 'PREVIEW'
  | 'EDIT_MENU'
  | 'EDIT_DETAILS'
  | 'EDIT_CAPACITY';

export interface GroupMatchDraft {
  id: string;
  chatId: number;
  organizerTelegramId: number;
  messageId: number;
  messageThreadId?: number;
  step: GroupMatchDraftStep;
  dateLabel?: string;
  time?: string;
  location?: string;
  capacity?: number;
  createdAt: number;
}

export const MIN_MATCH_CAPACITY = 1;
export const MAX_MATCH_CAPACITY = 50;
export const MATCH_CLEANUP_AGE_MS = 48 * 60 * 60 * 1000;
export const INLINE_ROSTER_MAX = 12;
