import { isJokerCard } from "./cards.js";
import {
  BotPlaystyle,
  GameStatus,
  Suit,
  TurnActionType,
  type BotStrategy,
  type BotStrategyOptions,
  type Card,
  type PlayerState,
  type RandomSource,
  type SevensGameObject,
  type StandardCard,
} from "./types.js";
import { getPlayableCards } from "./variants.js";

type PlaySelector = (
  game: SevensGameObject,
  player: PlayerState,
  playableCards: readonly Card[],
  random: RandomSource,
) => Card;

type BotStrategyFactory = (options?: BotStrategyOptions) => BotStrategy;

function chooseRandom<T>(values: readonly T[], random: RandomSource): T {
  if (values.length === 1) {
    return values[0]!;
  }

  const randomValue = random();
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError("Random source must return a number from 0 (inclusive) to 1 (exclusive)");
  }
  return values[Math.floor(randomValue * values.length)]!;
}

function hasCardBeyond(
  hand: readonly Card[],
  selected: StandardCard,
  direction: "lower" | "higher",
): boolean {
  return hand.some(
    (card) =>
      !isJokerCard(card) &&
      card.suit === selected.suit &&
      (direction === "lower" ? card.rank < selected.rank : card.rank > selected.rank),
  );
}

function opensUsefulSpadeRank(
  game: SevensGameObject,
  hand: readonly Card[],
  selected: StandardCard,
): boolean {
  if (selected.suit !== Suit.Spades) {
    return false;
  }

  const spades = game.board[Suit.Spades];
  return hand.some(
    (card) =>
      !isJokerCard(card) &&
      card.suit !== Suit.Spades &&
      card.rank === selected.rank &&
      (spades.min === null ||
        spades.max === null ||
        card.rank < spades.min ||
        card.rank > spades.max),
  );
}

function advancesOwnHand(
  game: SevensGameObject,
  hand: readonly Card[],
  selected: Card,
): boolean {
  if (isJokerCard(selected)) {
    return false;
  }

  const run = game.board[selected.suit];
  if (run.min === null || run.max === null) {
    return hand.some(
      (card) => !isJokerCard(card) && card.suit === selected.suit && card !== selected,
    );
  }

  if (selected.rank < run.min) {
    return hasCardBeyond(hand, selected, "lower") || opensUsefulSpadeRank(game, hand, selected);
  }
  if (selected.rank > run.max) {
    return hasCardBeyond(hand, selected, "higher") || opensUsefulSpadeRank(game, hand, selected);
  }
  return false;
}

function createStrategy(selectPlay: PlaySelector, options?: BotStrategyOptions): BotStrategy {
  const random = options?.random ?? Math.random;
  return Object.freeze((game: SevensGameObject, actorId: string) => {
    if (game.status !== GameStatus.Active) {
      return null;
    }

    const player = game.players.find(({ id }) => id === actorId);
    if (player === undefined) {
      return null;
    }

    if (game.pendingDraw !== null) {
      return game.pendingDraw.donorId === actorId && player.hand.length > 0
        ? {
            type: TurnActionType.GiveCard,
            card: chooseRandom(player.hand, random),
          }
        : null;
    }

    if (game.currentPlayerId !== actorId) {
      return null;
    }

    const playableCards = getPlayableCards(game.board, player.hand, game.variant, {
      playerId: actorId,
      players: game.players,
    });
    return playableCards.length > 0
      ? {
          type: TurnActionType.Play,
          card: selectPlay(game, player, playableCards, random),
        }
      : { type: TurnActionType.RequestDraw };
  });
}

function createRandomStrategy(options?: BotStrategyOptions): BotStrategy {
  return createStrategy((_game, _player, playableCards, random) =>
    chooseRandom(playableCards, random), options);
}

function createCautiousStrategy(options?: BotStrategyOptions): BotStrategy {
  return createStrategy((game, player, playableCards, random) => {
    const usefulCards = playableCards.filter((card) =>
      advancesOwnHand(game, player.hand, card));
    return chooseRandom(usefulCards.length > 0 ? usefulCards : playableCards, random);
  }, options);
}

const BOT_STRATEGY_FACTORIES: ReadonlyMap<BotPlaystyle, BotStrategyFactory> = new Map([
  [BotPlaystyle.Random, createRandomStrategy],
  [BotPlaystyle.Cautious, createCautiousStrategy],
]);

function createUnsupportedStrategyFactory(playstyle: BotPlaystyle): BotStrategyFactory {
  return () => {
    throw new RangeError(`Unsupported bot playstyle: ${String(playstyle)}`);
  };
}

export function createBotStrategy(
  playstyle: BotPlaystyle,
  options?: BotStrategyOptions,
): BotStrategy {
  const factory =
    BOT_STRATEGY_FACTORIES.get(playstyle) ?? createUnsupportedStrategyFactory(playstyle);
  return factory(options);
}
