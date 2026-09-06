import type {
  DiscoveredGame,
  GameSession,
  LanMultiplayer,
  SessionSnapshot,
  SessionRecoveryState,
} from '@opengamesonline/expo-lan-multiplayer';
import type {
  BotPlaystyle,
  SevensGameObject,
  SevensVariant,
  TurnAction,
} from '@opengamesonline/sevens';

export const SEVENS_APP_ID = 'com.opengamesonline.sevens' as const;
export const SEVENS_GAME_VERSION = 3 as const;
export const MIN_SEVENS_PLAYERS = 3 as const;
export const MAX_SEVENS_PLAYERS = 7 as const;

export type SevensParticipantRole = 'player' | 'spectator';

export const SEVENS_BOT_TURN_EVENT = 'botTurn' as const;

export type SevensBot = {
  id: string;
  name: string;
  playstyle: BotPlaystyle;
};

export type SevensBotTurnEvent = {
  type: typeof SEVENS_BOT_TURN_EVENT;
  botId: string;
  action: TurnAction;
};

export type SevensGameEvent = TurnAction | SevensBotTurnEvent;

export type SevensScore = {
  playerId: string;
  playerName: string;
  points: number;
};

export type SevensGameState = SevensGameObject & {
  readonly lastIllegalMovePlayerId: string | null;
  readonly bots: readonly SevensBot[];
  readonly roundNumber: number;
  readonly latestScores: readonly SevensScore[];
  readonly cumulativeScores: readonly SevensScore[];
};

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
  bots: SevensBot[];
  roundsPlayed: number;
  latestScores: SevensScore[];
  cumulativeScores: SevensScore[];
  showPlayableCards: boolean;
  variant: SevensVariant;
};

export type SevensMultiplayer = LanMultiplayer<
  SevensParticipantMetadata,
  SevensLobbyMetadata
>;

export type SevensSession = GameSession<
  SevensGameState,
  SevensGameEvent,
  SevensParticipantMetadata,
  SevensLobbyMetadata
>;

export type SevensSessionSnapshot = SessionSnapshot<
  SevensGameState,
  SevensParticipantMetadata,
  SevensLobbyMetadata
>;

export type SevensRecoveryState = SessionRecoveryState<
  SevensGameState,
  SevensParticipantMetadata,
  SevensLobbyMetadata
>;

export type SevensDiscoveredGame = DiscoveredGame<SevensLobbyMetadata>;
