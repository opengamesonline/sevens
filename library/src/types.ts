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
  Joker = "joker",
}

export enum BotPlaystyle {
  Random = "random",
  Cautious = "cautious",
}

export enum GameStatus {
  Active = "active",
  Finished = "finished",
}

export enum TurnActionType {
  Play = "play",
  RequestDraw = "requestDraw",
  GiveCard = "giveCard",
}

export interface StandardCard {
  readonly kind?: never;
  readonly suit: Suit;
  readonly rank: Rank;
}

export interface JokerCard {
  readonly kind: "joker";
}

export type Card = StandardCard | JokerCard;

export interface SuitBoardState {
  readonly min: Rank | null;
  readonly max: Rank | null;
}

export type BoardState = Readonly<Record<Suit, SuitBoardState>>;

export interface PlayerState {
  readonly id: string;
  readonly hand: readonly Card[];
}

export interface FinalScore {
  readonly playerId: string;
  readonly score: number;
}

export interface PendingDraw {
  readonly requesterId: string;
  readonly donorId: string;
}

export interface SevensGameObject {
  readonly variant: SevensVariant;
  readonly status: GameStatus;
  readonly board: BoardState;
  readonly players: readonly PlayerState[];
  readonly currentPlayerId: string;
  readonly pendingDraw: PendingDraw | null;
  readonly winnerId: string | null;
}

export interface PlayAction {
  readonly type: TurnActionType.Play;
  readonly card: Card;
}

export interface RequestDrawAction {
  readonly type: TurnActionType.RequestDraw;
}

export interface GiveCardAction {
  readonly type: TurnActionType.GiveCard;
  readonly card: Card;
}

export type TurnAction = PlayAction | RequestDrawAction | GiveCardAction;
export type RandomSource = () => number;

export interface InitializeOptions {
  readonly random?: RandomSource;
}

export interface BotStrategyOptions {
  readonly random?: RandomSource;
}

export type BotStrategy = (
  game: SevensGameObject,
  actorId: string,
) => TurnAction | null;

export type PlayableCardsCalculator = (
  board: BoardState,
  hand: readonly Card[],
  context?: PlayableCardsContext,
) => readonly Card[];

export interface PlayableCardsContext {
  readonly playerId: string;
  readonly players: readonly PlayerState[];
}

export interface PlayResolution {
  readonly board: BoardState;
  readonly players: readonly PlayerState[];
}

export type PlayResolver = (
  game: SevensGameObject,
  actorId: string,
  card: Card,
) => PlayResolution | null;

export interface VariantRules {
  readonly createDeck: () => readonly Card[];
  readonly getPlayableCards: PlayableCardsCalculator;
  readonly resolvePlay: PlayResolver;
}
