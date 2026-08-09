import {
  CARD_RANKS,
  CARD_SUITS,
  BotPlaystyle,
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
    typeof value.showPlayableCards === 'boolean' &&
    Object.values(SevensVariant).includes(value.variant as SevensVariant)
  );
}

function isSevensBot(value: unknown): value is SevensBot {
  return (
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
