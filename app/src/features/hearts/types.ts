import type { DiscoveredGame, SessionSnapshot } from '@opengamesonline/expo-lan-multiplayer';
import type { BotPlaystyle, HeartsAction, HeartsGame } from '@opengamesonline/sevens';

export const HEARTS_APP_ID = 'com.drasolabs.cardroom.hearts' as const;
export const HEARTS_GAME_VERSION = 1 as const;
export type HeartsParticipantMetadata = {
  appId: typeof HEARTS_APP_ID;
  gameVersion: typeof HEARTS_GAME_VERSION;
  role: 'player' | 'spectator';
};
export type HeartsBot = { id: string; name: string; playstyle: BotPlaystyle };
export type HeartsScore = { playerId: string; playerName: string; points: number };
export type HeartsLobbyMetadata = {
  appId: typeof HEARTS_APP_ID;
  gameVersion: typeof HEARTS_GAME_VERSION;
  minPlayers: 4;
  maxPlayers: 4;
  playerCount: number;
  spectatorCount: number;
  bots: HeartsBot[];
  roundsPlayed: number;
  latestScores: HeartsScore[];
  cumulativeScores: HeartsScore[];
};
export type HeartsGameState = HeartsGame & { readonly bots: readonly HeartsBot[] };
export type HeartsGameEvent = HeartsAction | { type: 'botTurn'; botId: string; action: HeartsAction };
export type HeartsSessionSnapshot = SessionSnapshot<HeartsGameState, HeartsParticipantMetadata, HeartsLobbyMetadata>;
export type HeartsDiscoveredGame = DiscoveredGame<HeartsLobbyMetadata>;
