import {
  CARD_RANKS,
  CARD_SUITS,
  BotPlaystyle,
  GameStatus,
  SevensVariant,
  TurnActionType,
  type Card,
  type StandardCard,
  type TurnAction,
} from '@opengamesonline/sevens';

import {
  MAX_SEVENS_PLAYERS,
  MIN_SEVENS_PLAYERS,
  SEVENS_APP_ID,
  SEVENS_BOT_TURN_EVENT,
  SEVENS_GAME_VERSION,
  type SevensLobbyMetadata,
  type SevensBot,
  type SevensBotTurnEvent,
  type SevensParticipantMetadata,
  type SevensParticipantRole,
  type SevensGameState,
  type SevensMoveLogEntry,
  type SevensScore,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isSevensParticipantRole(value: unknown): value is SevensParticipantRole {
  return value === 'player' || value === 'spectator';
}

export function isSevensParticipantMetadata(
  value: unknown,
): value is SevensParticipantMetadata {
  return (
    isRecord(value) &&
    value.appId === SEVENS_APP_ID &&
    value.gameVersion === SEVENS_GAME_VERSION &&
    isSevensParticipantRole(value.role)
  );
}

export function isSevensLobbyMetadata(value: unknown): value is SevensLobbyMetadata {
  const bots = isRecord(value) && Array.isArray(value.bots) ? value.bots : null;
  const latestScores = isRecord(value) && Array.isArray(value.latestScores)
    ? value.latestScores
    : null;
  const cumulativeScores = isRecord(value) && Array.isArray(value.cumulativeScores)
    ? value.cumulativeScores
    : null;
  return (
    isRecord(value) &&
    value.appId === SEVENS_APP_ID &&
    value.gameVersion === SEVENS_GAME_VERSION &&
    Number.isInteger(value.playerCount) &&
    (value.playerCount as number) >= 0 &&
    Number.isInteger(value.maxPlayers) &&
    (value.maxPlayers as number) >= MIN_SEVENS_PLAYERS &&
    (value.maxPlayers as number) <= MAX_SEVENS_PLAYERS &&
    (value.playerCount as number) <= (value.maxPlayers as number) &&
    Number.isInteger(value.spectatorCount) &&
    (value.spectatorCount as number) >= 0 &&
    value.minPlayers === MIN_SEVENS_PLAYERS &&
    bots !== null &&
    bots.every(isSevensBot) &&
    new Set(bots.map((bot) => bot.id)).size === bots.length &&
    bots.length <= (value.playerCount as number) &&
    Number.isInteger(value.roundsPlayed) &&
    (value.roundsPlayed as number) >= 0 &&
    latestScores !== null &&
    latestScores.every(isSevensScore) &&
    new Set(latestScores.map((score) => score.playerId)).size === latestScores.length &&
    cumulativeScores !== null &&
    cumulativeScores.every(isSevensScore) &&
    new Set(cumulativeScores.map((score) => score.playerId)).size === cumulativeScores.length &&
    latestScores.every((score) =>
      cumulativeScores.some((total) => total.playerId === score.playerId)) &&
    (((value.roundsPlayed as number) === 0 &&
      latestScores.length === 0 &&
      cumulativeScores.length === 0) ||
      ((value.roundsPlayed as number) > 0 &&
        latestScores.length >= MIN_SEVENS_PLAYERS &&
        cumulativeScores.length >= latestScores.length)) &&
    typeof value.showPlayableCards === 'boolean' &&
    typeof value.preventIllegalDraw === 'boolean' &&
    Object.values(SevensVariant).includes(value.variant as SevensVariant)
  );
}

function isSevensScore(value: unknown): value is SevensScore {
  return (
    isRecord(value) &&
    typeof value.playerId === 'string' &&
    value.playerId.length > 0 &&
    typeof value.playerName === 'string' &&
    value.playerName.length > 0 &&
    Number.isInteger(value.points) &&
    (value.points as number) >= 0
  );
}

function isSevensMoveLogEntry(value: unknown): value is SevensMoveLogEntry {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    value.key.length > 0 &&
    typeof value.text === 'string' &&
    value.text.length > 0
  );
}

function isSevensBot(value: unknown): value is SevensBot {  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    Object.values(BotPlaystyle).includes(value.playstyle as BotPlaystyle)
  );
}

function isCard(value: unknown): value is Card {
  if (!isRecord(value)) return false;
  if (value.kind === 'joker') return true;
  return (
    CARD_SUITS.includes(value.suit as StandardCard['suit']) &&
    CARD_RANKS.includes(value.rank as StandardCard['rank'])
  );
}

export function isSevensGameState(value: unknown): value is SevensGameState {
  if (!isRecord(value) || !isRecord(value.board) || !Array.isArray(value.players)) {
    return false;
  }
  const board = value.board;
  const players = value.players;
  const playerIds = players.flatMap((player) =>
    isRecord(player) && typeof player.id === 'string' ? [player.id] : []);
  const bots = Array.isArray(value.bots) ? value.bots : null;
  const latestScores = Array.isArray(value.latestScores) ? value.latestScores : null;
  const cumulativeScores = Array.isArray(value.cumulativeScores) ? value.cumulativeScores : null;
  const moveLog = Array.isArray(value.moveLog) ? value.moveLog : null;
  const validPlayerId = (id: unknown) => typeof id === 'string' && playerIds.includes(id);
  const pendingDraw = value.pendingDraw;
  return (
    Object.values(SevensVariant).includes(value.variant as SevensVariant) &&
    Object.values(GameStatus).includes(value.status as GameStatus) &&
    CARD_SUITS.every((suit) => {
      const lane = board[suit];
      return isRecord(lane) &&
        (lane.min === null || CARD_RANKS.includes(lane.min as StandardCard['rank'])) &&
        (lane.max === null || CARD_RANKS.includes(lane.max as StandardCard['rank']));
    }) &&
    players.length >= MIN_SEVENS_PLAYERS &&
    players.length <= MAX_SEVENS_PLAYERS &&
    players.every((player) =>
      isRecord(player) &&
      typeof player.id === 'string' &&
      player.id.length > 0 &&
      Array.isArray(player.hand) &&
      player.hand.every(isCard)) &&
    playerIds.length === players.length &&
    new Set(playerIds).size === playerIds.length &&
    validPlayerId(value.currentPlayerId) &&
    (value.winnerId === null || validPlayerId(value.winnerId)) &&
    (pendingDraw === null ||
      (isRecord(pendingDraw) &&
        validPlayerId(pendingDraw.requesterId) &&
        validPlayerId(pendingDraw.donorId) &&
        pendingDraw.requesterId !== pendingDraw.donorId)) &&
    (value.lastIllegalMovePlayerId === null || validPlayerId(value.lastIllegalMovePlayerId)) &&
    bots !== null &&
    bots.every(isSevensBot) &&
    new Set(bots.map((bot) => bot.id)).size === bots.length &&
    bots.every((bot) => playerIds.includes(bot.id)) &&
    Number.isInteger(value.roundNumber) &&
    (value.roundNumber as number) >= 1 &&
    latestScores !== null &&
    latestScores.every(isSevensScore) &&
    cumulativeScores !== null &&
    cumulativeScores.every(isSevensScore) &&
    moveLog !== null &&
    moveLog.every(isSevensMoveLogEntry)
  );
}

export function isTurnAction(value: unknown): value is TurnAction {
  if (!isRecord(value)) return false;

  switch (value.type) {
    case TurnActionType.Play:
    case TurnActionType.GiveCard:
      return isCard(value.card);
    case TurnActionType.RequestDraw:
      return true;
    default:
      return false;
  }
}

export function isSevensBotTurnEvent(value: unknown): value is SevensBotTurnEvent {
  return (
    isRecord(value) &&
    value.type === SEVENS_BOT_TURN_EVENT &&
    typeof value.botId === 'string' &&
    value.botId.length > 0 &&
    isTurnAction(value.action)
  );
}
