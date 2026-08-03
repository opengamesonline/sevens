import { Rank, Suit, type Card } from "./types.js";

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

export function cardEquals(left: Card, right: Card): boolean {
  return left.suit === right.suit && left.rank === right.rank;
}

export function createDeck(): readonly Card[] {
  return CARD_SUITS.flatMap((suit) =>
    CARD_RANKS.map((rank) => ({ suit, rank })),
  );
}
