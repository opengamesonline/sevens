export enum Suit {
  Clubs = "clubs",
  Diamonds = "diamonds",
  Hearts = "hearts",
  Spades = "spades",
}

export enum Rank {
  Ace = 1,
  Two,
  Three,
  Four,
  Five,
  Six,
  Seven,
  Eight,
  Nine,
  Ten,
  Jack,
  Queen,
  King,
}

export enum SevensVariant {
  Standard = "standard",
}

export enum GameStatus {
  Active = "active",
  Finished = "finished",
}

export enum TurnActionType {
  Play = "play",
  Draw = "draw",
}

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

export interface SuitBoardState {
  readonly min: Rank | null;
  readonly max: Rank | null;
}

export type BoardState = Readonly<Record<Suit, SuitBoardState>>;

export interface PlayerState {
  readonly id: string;
  readonly hand: readonly Card[];
}

export interface SevensGameObject {
  readonly variant: SevensVariant;
  readonly status: GameStatus;
  readonly board: BoardState;
  readonly players: readonly PlayerState[];
  readonly currentPlayerId: string;
  readonly winnerId: string | null;
}

export interface PlayAction {
  readonly type: TurnActionType.Play;
  readonly playerId: string;
  readonly card: Card;
}

export interface DrawAction {
  readonly type: TurnActionType.Draw;
  readonly playerId: string;
  readonly fromPlayerId: string;
  readonly card: Card;
}

export type TurnAction = PlayAction | DrawAction;
export type RandomSource = () => number;

export interface InitializeOptions {
  readonly random?: RandomSource;
}

export type PlayableCardsCalculator = (
  board: BoardState,
  hand: readonly Card[],
) => readonly Card[];

export interface VariantRules {
  readonly getPlayableCards: PlayableCardsCalculator;
}
