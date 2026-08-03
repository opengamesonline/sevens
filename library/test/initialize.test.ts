import { describe, expect, test } from "bun:test";
import {
  cardEquals,
  GameStatus,
  initializeSevens,
  Rank,
  SevensVariant,
  Suit,
} from "../src/index.js";

describe("initializeSevens", () => {
  test("deals every card and starts with the holder of the seven of diamonds", () => {
    const ids = ["alice", "bob", "carol"];
    const game = initializeSevens(ids, SevensVariant.Standard, { random: () => 0 });
    const openingPlayer = game.players.find(({ hand }) =>
      hand.some((card) => cardEquals(card, { suit: Suit.Diamonds, rank: Rank.Seven })),
    );

    expect(game.players.flatMap(({ hand }) => hand)).toHaveLength(52);
    expect(openingPlayer).toBeDefined();
    expect(game.currentPlayerId).toBe(openingPlayer!.id);
    expect(game.status).toBe(GameStatus.Active);
    expect(game.pendingDraw).toBeNull();
    expect(game.winnerId).toBeNull();
    expect(ids).toEqual(["alice", "bob", "carol"]);
  });

  test("is deterministic with an injected random source", () => {
    const initialize = () =>
      initializeSevens(["alice", "bob", "carol"], SevensVariant.Standard, {
        random: () => 0.25,
      });

    expect(initialize()).toEqual(initialize());
  });

  test("requires three to seven unique, non-empty player IDs", () => {
    expect(() => initializeSevens(["a", "b"], SevensVariant.Standard)).toThrow(RangeError);
    expect(() =>
      initializeSevens(["a", "b", "c", "d", "e", "f", "g", "h"], SevensVariant.Standard),
    ).toThrow(RangeError);
    expect(() => initializeSevens(["a", "b", "a"], SevensVariant.Standard)).toThrow(TypeError);
    expect(() => initializeSevens(["a", "b", " "], SevensVariant.Standard)).toThrow(TypeError);
  });
});
