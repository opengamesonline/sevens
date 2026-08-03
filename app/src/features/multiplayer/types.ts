import type {
  DiscoveredGame,
  GameSession,
  LanMultiplayer,
  SessionSnapshot,
} from '@opengamesonline/expo-lan-multiplayer';
import type { SevensGameObject, TurnAction } from '@opengamesonline/sevens';

export const SEVENS_APP_ID = 'com.opengamesonline.sevens' as const;
export const SEVENS_GAME_VERSION = 1 as const;
export const MIN_SEVENS_PLAYERS = 3 as const;
export const MAX_SEVENS_PLAYERS = 7 as const;

export type SevensParticipantRole = 'player' | 'spectator';

export type SevensParticipantMetadata = {
  appId: typeof SEVENS_APP_ID;
  gameVersion: typeof SEVENS_GAME_VERSION;
  role: SevensParticipantRole;
};

export type SevensLobbyMetadata = {
  appId: typeof SEVENS_APP_ID;
  gameVersion: typeof SEVENS_GAME_VERSION;
  playerCount: number;
  spectatorCount: number;
  minPlayers: typeof MIN_SEVENS_PLAYERS;
  maxPlayers: number;
};

export type SevensMultiplayer = LanMultiplayer<
  SevensParticipantMetadata,
  SevensLobbyMetadata
>;

export type SevensSession = GameSession<
  SevensGameObject,
  TurnAction,
  SevensParticipantMetadata,
  SevensLobbyMetadata
>;

export type SevensSessionSnapshot = SessionSnapshot<
  SevensGameObject,
  SevensParticipantMetadata,
  SevensLobbyMetadata
>;

export type SevensDiscoveredGame = DiscoveredGame<SevensLobbyMetadata>;
