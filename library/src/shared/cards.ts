import {
  Rank,
  Suit,
  type Card,
  type JokerCard,
  type StandardCard,
} from "./types.js";

export const CARD_SUITS: readonly Suit[] = Object.freeze([
  Suit.Clubs,
  Suit.Diamonds,
  Suit.Hearts,
  Suit.Spades,
]);

export const CARD_RANKS: readonly Rank[] = Object.freeze([
  Rank.Ace,
  Rank.Two,
  Rank.Three,
  Rank.Four,
  Rank.Five,
  Rank.Six,
  Rank.Seven,
  Rank.Eight,
  Rank.Nine,
  Rank.Ten,
  Rank.Jack,
  Rank.Queen,
  Rank.King,
]);

export const JOKER_CARD: JokerCard = Object.freeze({ kind: "joker" });

export function isJokerCard(card: Card): card is JokerCard {
  return card.kind === "joker";
}

export function cardEquals(left: Card, right: Card): boolean {
  if (isJokerCard(left) || isJokerCard(right)) {
    return isJokerCard(left) && isJokerCard(right);
  }

  return left.suit === right.suit && left.rank === right.rank;
}

export function createDeck(): readonly StandardCard[] {
  return CARD_SUITS.flatMap((suit) =>
    CARD_RANKS.map((rank) => ({ suit, rank })),
  );
}
