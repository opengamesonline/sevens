import { placeCard } from "./board.js";
import { cardEquals } from "./cards.js";
import {
  GameStatus,
  TurnActionType,
  type Card,
  type DrawAction,
  type PlayAction,
  type PlayerState,
  type SevensGameObject,
  type TurnAction,
} from "./types.js";
import { getPlayableCards } from "./variants.js";

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

function validatePlay(game: SevensGameObject, action: PlayAction): SevensGameObject | null {
  if (action.playerId !== game.currentPlayerId) {
    return null;
  }

  const playerIndex = game.players.findIndex(({ id }) => id === action.playerId);
  const player = game.players[playerIndex];
  if (player === undefined) {
    return null;
  }

  const nextHand = removeCard(player.hand, action.card);
  if (nextHand === null) {
    return null;
  }

  const playableCards = getPlayableCards(game.board, player.hand, game.variant);
  if (!playableCards.some((card) => cardEquals(card, action.card))) {
    return null;
  }

  const players = game.players.map((candidate) =>
    candidate.id === player.id ? { ...candidate, hand: nextHand } : candidate,
  );
  const hasWinner = nextHand.length === 0;

  return {
    ...game,
    board: placeCard(game.board, action.card),
    players,
    status: hasWinner ? GameStatus.Finished : GameStatus.Active,
    currentPlayerId: hasWinner ? player.id : getNextPlayerId(game.players, playerIndex),
    winnerId: hasWinner ? player.id : null,
  };
}

function validateDraw(game: SevensGameObject, action: DrawAction): SevensGameObject | null {
  if (action.playerId !== game.currentPlayerId) {
    return null;
  }

  const playerIndex = game.players.findIndex(({ id }) => id === action.playerId);
  if (playerIndex === -1 || action.fromPlayerId !== getRightPlayerId(game.players, playerIndex)) {
    return null;
  }

  const donor = game.players.find(({ id }) => id === action.fromPlayerId);
  const currentPlayer = game.players[playerIndex];
  if (donor === undefined || currentPlayer === undefined) {
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
    if (player.id === currentPlayer.id) {
      return { ...player, hand: [...player.hand, action.card] };
    }
    return player;
  });
  const hasWinner = donorHand.length === 0;

  return {
    ...game,
    players,
    status: hasWinner ? GameStatus.Finished : GameStatus.Active,
    currentPlayerId: hasWinner
      ? game.currentPlayerId
      : getNextPlayerId(game.players, playerIndex),
    winnerId: hasWinner ? donor.id : null,
  };
}

export function validateTurn(
  game: SevensGameObject,
  action: TurnAction,
): SevensGameObject | null {
  if (game.status !== GameStatus.Active) {
    return null;
  }

  switch (action.type) {
    case TurnActionType.Play:
      return validatePlay(game, action);
    case TurnActionType.Draw:
      return validateDraw(game, action);
    default:
      return null;
  }
}
