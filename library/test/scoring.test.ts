import { describe, expect, test } from "bun:test";
import {
  createEmptyBoard,
  createFinalScores,
  GameStatus,
  Rank,
  SevensVariant,
  Suit,
  type Card,
  type SevensGameObject,
} from "../src/index.js";

const card = (rank: Rank): Card => ({ suit: Suit.Spades, rank });

function finishedGame(): SevensGameObject {
  return {
    variant: SevensVariant.Standard,
    status: GameStatus.Finished,
    board: createEmptyBoard(),
    players: [
      { id: "alice", hand: [] },
      {
        id: "bob",
        hand: [
          card(Rank.Two),
          card(Rank.Nine),
          card(Rank.Ten),
          card(Rank.Jack),
          card(Rank.Queen),
          card(Rank.King),
          card(Rank.Ace),
        ],
      },
      { id: "carol", hand: [card(Rank.Three), card(Rank.Ace)] },
    ],
    currentPlayerId: "alice",
    pendingDraw: null,
    winnerId: "alice",
  };
}

describe("final scoring", () => {
  test("scores every remaining hand without mutating the game", () => {
    const game = finishedGame();
    const snapshot = structuredClone(game);

    expect(createFinalScores(game)).toEqual([
      { playerId: "alice", score: 0 },
      { playerId: "bob", score: 65 },
      { playerId: "carol", score: 20 },
    ]);
    expect(game).toEqual(snapshot);
  });

  test("rejects scoring before the game is finished", () => {
    const game = { ...finishedGame(), status: GameStatus.Active, winnerId: null };

    expect(() => createFinalScores(game)).toThrow("only available after the game has finished");
  });
});
