export enum Suit {
  Clubs = "clubs",
  Diamonds = "diamonds",
  Hearts = "hearts",
  Spades = "spades",
}

export enum Rank {
  Ace = 1, Two, Three, Four, Five, Six, Seven, Eight, Nine, Ten, Jack, Queen, King,
}

export enum BotPlaystyle {
  Random = "random",
  Cautious = "cautious",
}

export enum GameStatus {
  Active = "active",
  Finished = "finished",
}

export interface StandardCard {
  readonly kind?: never;
  readonly suit: Suit;
  readonly rank: Rank;
}
export interface JokerCard { readonly kind: "joker" }
export type Card = StandardCard | JokerCard;
export interface PlayerState { readonly id: string; readonly hand: readonly Card[] }
export type RandomSource = () => number;
export interface InitializeOptions { readonly random?: RandomSource }
export interface BotStrategyOptions { readonly random?: RandomSource }
