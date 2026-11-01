import type { GameStatus, StandardCard } from "../shared/types.js";

export type HeartsPhase = "passing" | "playing" | "roundEnd" | "matchEnd";
export type PassDirection = "left" | "right" | "across" | "hold";
export interface HeartsPlayer {
  readonly id: string;
  readonly hand: readonly StandardCard[];
  readonly captured: readonly StandardCard[];
  readonly score: number;
  readonly roundPoints: number;
}
export interface TrickPlay { readonly playerId: string; readonly card: StandardCard }
export interface HeartsGame {
  readonly status: GameStatus;
  readonly phase: HeartsPhase;
  readonly players: readonly HeartsPlayer[];
  readonly roundNumber: number;
  readonly passDirection: PassDirection;
  readonly passes: Readonly<Record<string, readonly StandardCard[]>>;
  readonly currentPlayerId: string;
  readonly trick: readonly TrickPlay[];
  readonly lastTrick: readonly TrickPlay[];
  readonly tricksPlayed: number;
  readonly heartsBroken: boolean;
  readonly moonShooterId: string | null;
  readonly winnerIds: readonly string[];
}
export type HeartsAction =
  | { readonly type: "pass"; readonly cards: readonly StandardCard[] }
  | { readonly type: "play"; readonly card: StandardCard }
  | { readonly type: "nextRound" };
