import { isBoardEmpty, isStandardPlayable, placeCard } from "./board.js";
import { JOKER_CARD, cardEquals, createDeck, isJokerCard } from "./cards.js";
import {
  Rank,
  SevensVariant,
  type BoardState,
  type Card,
  type PlayResolution,
  type PlayableCardsContext,
  type PlayerState,
  type SevensGameObject,
  type StandardCard,
  type VariantRules,
} from "./types.js";

type VariantRulesFactory = () => VariantRules;

interface AssistedMove {
  readonly bridge: StandardCard;
  readonly holderId: string;
}

function removeCard(hand: readonly Card[], card: Card): readonly Card[] | null {
  const index = hand.findIndex((candidate) => cardEquals(candidate, card));
  return index === -1 ? null : [...hand.slice(0, index), ...hand.slice(index + 1)];
}

function resolveStandardPlay(
  game: SevensGameObject,
  actorId: string,
  card: Card,
): PlayResolution | null {
  if (isJokerCard(card) || !isStandardPlayable(game.board, card)) {
    return null;
  }

  const actor = game.players.find((player) => player.id === actorId);
  if (actor === undefined) {
    return null;
  }

  const nextHand = removeCard(actor.hand, card);
  if (nextHand === null) {
    return null;
  }

  return {
    board: placeCard(game.board, card),
    players: game.players.map((player) =>
      player.id === actorId ? { ...player, hand: nextHand } : player,
    ),
  };
}

function findAssistedMove(
  board: BoardState,
  actorId: string,
  hand: readonly Card[],
  players: readonly PlayerState[],
  selected: StandardCard,
): AssistedMove | null {
  if (isBoardEmpty(board) || !hand.some(isJokerCard)) {
    return null;
  }

  for (const rank of [selected.rank - 1, selected.rank + 1]) {
    if (rank < Rank.Ace || rank > Rank.King) {
      continue;
    }

    const bridge: StandardCard = { suit: selected.suit, rank };
    if (
      hand.some((card) => cardEquals(card, bridge)) ||
      !isStandardPlayable(board, bridge) ||
      !isStandardPlayable(placeCard(board, bridge), selected)
    ) {
      continue;
    }

    const holder = players.find(
      (player) =>
        player.id !== actorId && player.hand.some((card) => cardEquals(card, bridge)),
    );
    if (holder !== undefined) {
      return { bridge, holderId: holder.id };
    }
  }

  return null;
}

function getJokerPlayableCards(
  board: BoardState,
  hand: readonly Card[],
  context?: PlayableCardsContext,
): readonly Card[] {
  return hand.filter((card) => {
    if (isJokerCard(card)) {
      return false;
    }

    return (
      isStandardPlayable(board, card) ||
      (context !== undefined &&
        findAssistedMove(board, context.playerId, hand, context.players, card) !== null)
    );
  });
}

function resolveJokerPlay(
  game: SevensGameObject,
  actorId: string,
  selected: Card,
): PlayResolution | null {
  const standardResolution = resolveStandardPlay(game, actorId, selected);
  if (standardResolution !== null || isJokerCard(selected)) {
    return standardResolution;
  }

  const actor = game.players.find((player) => player.id === actorId);
  if (actor === undefined) {
    return null;
  }

  const handWithoutSelected = removeCard(actor.hand, selected);
  const assistedMove = findAssistedMove(
    game.board,
    actorId,
    actor.hand,
    game.players,
    selected,
  );
  if (handWithoutSelected === null || assistedMove === null) {
    return null;
  }

  const actorHand = removeCard(handWithoutSelected, JOKER_CARD);
  const holder = game.players.find((player) => player.id === assistedMove.holderId);
  const holderHand = holder === undefined ? null : removeCard(holder.hand, assistedMove.bridge);
  if (actorHand === null || holderHand === null) {
    return null;
  }

  return {
    board: placeCard(placeCard(game.board, assistedMove.bridge), selected),
    players: game.players.map((player) => {
      if (player.id === actorId) {
        return { ...player, hand: actorHand };
      }
      if (player.id === assistedMove.holderId) {
        return { ...player, hand: [...holderHand, JOKER_CARD] };
      }
      return player;
    }),
  };
}

function createStandardRules(): VariantRules {
  return Object.freeze({
    createDeck,
    getPlayableCards: (board: BoardState, hand: readonly Card[]) =>
      hand.filter((card) => isStandardPlayable(board, card)),
    resolvePlay: resolveStandardPlay,
  });
}

function createJokerRules(): VariantRules {
  return Object.freeze({
    createDeck: () => Object.freeze([...createDeck(), JOKER_CARD]),
    getPlayableCards: getJokerPlayableCards,
    resolvePlay: resolveJokerPlay,
  });
}

const VARIANT_RULE_FACTORIES: ReadonlyMap<SevensVariant, VariantRulesFactory> = new Map([
  [SevensVariant.Standard, createStandardRules],
  [SevensVariant.Joker, createJokerRules],
]);

function createUnsupportedRulesFactory(variant: SevensVariant): VariantRulesFactory {
  return () => {
    throw new RangeError(`Unsupported Sevens variant: ${String(variant)}`);
  };
}

export function getVariantRules(variant: SevensVariant): VariantRules {
  const factory = VARIANT_RULE_FACTORIES.get(variant) ?? createUnsupportedRulesFactory(variant);
  return factory();
}

export function getPlayableCards(
  board: BoardState,
  hand: readonly Card[],
  variant: SevensVariant,
  context?: PlayableCardsContext,
): readonly Card[] {
  return getVariantRules(variant).getPlayableCards(board, hand, context);
}
