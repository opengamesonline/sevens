import { cardEquals } from "./cards.js";
import {
  GameStatus,
  TurnActionType,
  type Card,
  type GiveCardAction,
  type PlayAction,
  type PlayerState,
  type SevensGameObject,
  type TurnAction,
} from "./types.js";
import { getVariantRules } from "./variants.js";

function removeCard(hand: readonly Card[], card: Card): readonly Card[] | null {
  const cardIndex = hand.findIndex((candidate) => cardEquals(candidate, card));
  if (cardIndex === -1) {
    return null;
  }

  return [...hand.slice(0, cardIndex), ...hand.slice(cardIndex + 1)];
}

function getNextPlayerId(players: readonly PlayerState[], playerIndex: number): string {
  return players[(playerIndex + 1) % players.length]!.id;
}

function getRightPlayerId(players: readonly PlayerState[], playerIndex: number): string {
  return players[(playerIndex - 1 + players.length) % players.length]!.id;
}

function validatePlay(
  game: SevensGameObject,
  actorId: string,
  action: PlayAction,
): SevensGameObject | null {
  if (actorId !== game.currentPlayerId) {
    return null;
  }

  const playerIndex = game.players.findIndex(({ id }) => id === actorId);
  const player = game.players[playerIndex];
  if (player === undefined) {
    return null;
  }

  const resolution = getVariantRules(game.variant).resolvePlay(game, actorId, action.card);
  if (resolution === null) {
    return null;
  }

  const nextPlayer = resolution.players.find((candidate) => candidate.id === actorId);
  if (nextPlayer === undefined) {
    return null;
  }
  const hasWinner = nextPlayer.hand.length === 0;

  return {
    ...game,
    board: resolution.board,
    players: resolution.players,
    status: hasWinner ? GameStatus.Finished : GameStatus.Active,
    currentPlayerId: hasWinner ? player.id : getNextPlayerId(game.players, playerIndex),
    winnerId: hasWinner ? player.id : null,
  };
}

function validateRequestDraw(
  game: SevensGameObject,
  actorId: string,
): SevensGameObject | null {
  if (actorId !== game.currentPlayerId) {
    return null;
  }

  const requesterIndex = game.players.findIndex(({ id }) => id === actorId);
  if (requesterIndex === -1) {
    return null;
  }

  return {
    ...game,
    pendingDraw: {
      requesterId: actorId,
      donorId: getRightPlayerId(game.players, requesterIndex),
    },
  };
}

function validateGiveCard(
  game: SevensGameObject,
  actorId: string,
  action: GiveCardAction,
): SevensGameObject | null {
  const pendingDraw = game.pendingDraw;
  if (pendingDraw === null || actorId !== pendingDraw.donorId) {
    return null;
  }

  const requesterIndex = game.players.findIndex(({ id }) => id === pendingDraw.requesterId);
  if (
    requesterIndex === -1 ||
    pendingDraw.requesterId !== game.currentPlayerId ||
    pendingDraw.donorId !== getRightPlayerId(game.players, requesterIndex)
  ) {
    return null;
  }

  const donor = game.players.find(({ id }) => id === actorId);
  const requester = game.players[requesterIndex];
  if (donor === undefined || requester === undefined) {
    return null;
  }

  const donorHand = removeCard(donor.hand, action.card);
  if (donorHand === null) {
    return null;
  }

  const players = game.players.map((player) => {
    if (player.id === donor.id) {
      return { ...player, hand: donorHand };
    }
    if (player.id === requester.id) {
      return { ...player, hand: [...player.hand, action.card] };
    }
    return player;
  });
  const hasWinner = donorHand.length === 0;

  return {
    ...game,
    players,
    pendingDraw: null,
    status: hasWinner ? GameStatus.Finished : GameStatus.Active,
    currentPlayerId: getNextPlayerId(game.players, requesterIndex),
    winnerId: hasWinner ? donor.id : null,
  };
}

export function validateTurn(
  game: SevensGameObject,
  actorId: string,
  action: TurnAction,
): SevensGameObject | null {
  if (game.status !== GameStatus.Active) {
    return null;
  }

  switch (action.type) {
    case TurnActionType.Play:
      return game.pendingDraw === null ? validatePlay(game, actorId, action) : null;
    case TurnActionType.RequestDraw:
      return game.pendingDraw === null ? validateRequestDraw(game, actorId) : null;
    case TurnActionType.GiveCard:
      return validateGiveCard(game, actorId, action);
    default:
      return null;
  }
}
