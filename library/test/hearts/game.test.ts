import { describe, expect, test } from "bun:test";
import { BotPlaystyle, GameStatus, Rank, Suit, createDeck, cardEquals, shuffleCards } from "../../src/index.js";
import { chooseHeartsBotAction, getHeartsPlayableCards, heartsTrickWinner, initializeHearts, nextHeartsRound,
  passDirection, passHeartsCards, penaltyPoints, playHeartsCard, type HeartsGame } from "../../src/hearts/index.js";
import type { StandardCard } from "../../src/shared/types.js";

const ids = ["a", "b", "c", "d"];
const card = (suit: Suit, rank: Rank): StandardCard => ({ suit, rank });
const club = (rank: Rank) => card(Suit.Clubs, rank);
const heart = (rank: Rank) => card(Suit.Hearts, rank);
const spade = (rank: Rank) => card(Suit.Spades, rank);
const identity = { random: () => 0.999 };

function position(hands: readonly (readonly StandardCard[])[], extra: Partial<HeartsGame> = {}): HeartsGame {
  const base = initializeHearts(ids, identity);
  return { ...base, phase: "playing", currentPlayerId: "a", players: base.players.map((p, i) => ({ ...p, hand: hands[i] ?? [] })), ...extra };
}
function seedRandom(seed: number) {
  let value = seed;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 0x100000000; };
}

describe("Hearts dealing and passing", () => {
  test("requires exactly four distinct players, deals 13 unique cards and starts with left passing", () => {
    for (const roster of [[], ["a", "b", "c"], ["a", "b", "c", "c"], ["a", "b", "c", " "]]) expect(() => initializeHearts(roster)).toThrow();
    const game = initializeHearts(ids, identity);
    expect(game.players.map((p) => p.hand.length)).toEqual([13, 13, 13, 13]);
    expect(new Set(game.players.flatMap((p) => p.hand.map((c) => `${c.suit}:${c.rank}`))).size).toBe(52);
    expect(game.phase).toBe("passing");
    expect([1, 2, 3, 4, 5].map(passDirection)).toEqual(["left", "right", "across", "hold", "left"]);
  });
  test("commits all four passes simultaneously, rejects invalid or repeated submissions", () => {
    let game = initializeHearts(ids, identity);
    const original = JSON.stringify(game);
    const first = game.players[0]!.hand.slice(0, 3);
    expect(passHeartsCards(game, "a", [first[0]!, first[0]!, first[1]!])).toBeNull();
    expect(passHeartsCards(game, "a", first.slice(0, 2))).toBeNull();
    expect(passHeartsCards(game, "nobody", first)).toBeNull();
    expect(passHeartsCards(game, "b", first)).toBeNull();
    const next = passHeartsCards(game, "a", first)!;
    expect(JSON.stringify(game)).toBe(original);
    expect(next.players).toEqual(game.players);
    expect(passHeartsCards(next, "a", first)).toBeNull();
    game = next;
    for (const id of ["b", "c", "d"]) game = passHeartsCards(game, id, game.players.find((p) => p.id === id)!.hand.slice(0, 3))!;
    expect(game.phase).toBe("playing");
    expect(game.players[1]!.hand).toEqual(expect.arrayContaining(first));
    expect(game.players.map((p) => p.hand.length)).toEqual([13, 13, 13, 13]);
    expect(game.players.find((p) => p.id === game.currentPlayerId)!.hand.some((c) => cardEquals(c, club(Rank.Two)))).toBe(true);
  });
  test("right and across passes reach the right recipients", () => {
    for (const [round, destination] of [[2, 3], [3, 2]] as const) {
      let game: HeartsGame = { ...initializeHearts(ids, identity), roundNumber: round, passDirection: passDirection(round) };
      const passed = game.players[0]!.hand.slice(0, 3);
      for (const id of ids) game = passHeartsCards(game, id, game.players.find((p) => p.id === id)!.hand.slice(0, 3))!;
      expect(game.players[destination]!.hand).toEqual(expect.arrayContaining(passed));
    }
  });
});

describe("Hearts legal play", () => {
  test("2 of clubs is the only opening lead and only the current player can play", () => {
    const game = position([[club(Rank.Two), club(Rank.Ace)], [club(Rank.Three)]]);
    expect(getHeartsPlayableCards(game, "a")).toEqual([club(Rank.Two)]);
    expect(playHeartsCard(game, "a", club(Rank.Ace))).toBeNull();
    expect(playHeartsCard(game, "b", club(Rank.Three))).toBeNull();
    expect(playHeartsCard(game, "a", club(Rank.Two))!.currentPlayerId).toBe("b");
  });
  test("must follow suit, otherwise cannot discard first-trick penalties unless forced", () => {
    const lead = { playerId: "d", card: club(Rank.Two) };
    const hand = [club(Rank.King), heart(Rank.Ace), spade(Rank.Queen)];
    expect(getHeartsPlayableCards(position([hand], { trick: [lead] }), "a")).toEqual([club(Rank.King)]);
    const voidHand = [heart(Rank.Ace), spade(Rank.Queen), card(Suit.Diamonds, Rank.Four)];
    expect(getHeartsPlayableCards(position([voidHand], { trick: [lead] }), "a")).toEqual([voidHand[2]!]);
    expect(getHeartsPlayableCards(position([voidHand.slice(0, 2)], { trick: [lead] }), "a")).toEqual(voidHand.slice(0, 2));
    expect(getHeartsPlayableCards(position([voidHand], { trick: [lead], tricksPlayed: 1 }), "a")).toEqual(voidHand);
  });
  test("cannot lead hearts until broken, except with an all-hearts hand", () => {
    const game = position([[heart(Rank.Two), club(Rank.Three)]], { tricksPlayed: 1 });
    expect(getHeartsPlayableCards(game, "a")).toEqual([club(Rank.Three)]);
    expect(getHeartsPlayableCards({ ...game, heartsBroken: true }, "a")).toHaveLength(2);
    const onlyHearts = position([[heart(Rank.Two)]], { tricksPlayed: 1 });
    expect(playHeartsCard(onlyHearts, "a", heart(Rank.Two))!.heartsBroken).toBe(true);
  });
  test("queen of spades does not break hearts; a discarded heart does", () => {
    const game = position([[spade(Rank.Queen), heart(Rank.Two)]], { tricksPlayed: 1, trick: [{ playerId: "d", card: club(Rank.Ace) }] });
    expect(playHeartsCard(game, "a", spade(Rank.Queen))!.heartsBroken).toBe(false);
    expect(playHeartsCard(game, "a", heart(Rank.Two))!.heartsBroken).toBe(true);
  });
  test("highest card of led suit wins, ace high, no trump; winner leads next", () => {
    expect(heartsTrickWinner([{ playerId: "a", card: club(Rank.King) }, { playerId: "b", card: club(Rank.Ace) },
      { playerId: "c", card: heart(Rank.Ace) }, { playerId: "d", card: spade(Rank.Ace) }])).toBe("b");
    let game = position([[club(Rank.King)], [club(Rank.Ace)], [heart(Rank.Three)], [spade(Rank.Queen)]], { tricksPlayed: 1 });
    const before = JSON.stringify(game);
    for (const id of ids) game = playHeartsCard(game, id, game.players.find((p) => p.id === id)!.hand[0]!)!;
    expect(game.currentPlayerId).toBe("b");
    expect(game.trick).toEqual([]);
    expect(game.lastTrick).toHaveLength(4);
    expect(game.players[1]!.captured).toHaveLength(4);
    expect(game.tricksPlayed).toBe(2);
    expect(before).not.toBe(JSON.stringify(game));
  });
});

function lastTrickPosition(moon: boolean, scores = [0, 0, 0, 0]): HeartsGame {
  const last = [2, 3, 4, 5].map((rank) => card(Suit.Diamonds, rank));
  const other = createDeck().filter((c) => !last.some((held) => cardEquals(c, held)));
  const penalties = other.filter((c) => penaltyPoints(c) > 0);
  const harmless = other.filter((c) => penaltyPoints(c) === 0);
  const game = initializeHearts(ids, identity);
  return { ...game, phase: "playing", tricksPlayed: 12, currentPlayerId: "a", players: game.players.map((p, i) => ({
    ...p, hand: [last[i]!], score: scores[i]!, captured: i === 0 ? [...harmless, ...(moon ? penalties : penalties.filter((c) => c.suit === Suit.Spades))]
      : !moon && i === 1 ? penalties.filter((c) => c.suit === Suit.Hearts) : [],
  })) };
}
function finish(game: HeartsGame): HeartsGame {
  for (const id of ids) game = playHeartsCard(game, id, game.players.find((p) => p.id === id)!.hand[0]!)!;
  return game;
}
describe("Hearts scoring and matches", () => {
  test("hearts cost one, queen of spades costs thirteen, other cards zero", () => {
    expect(createDeck().reduce((sum, c) => sum + penaltyPoints(c), 0)).toBe(26);
    const game = finish(lastTrickPosition(false));
    expect(game.players.map((p) => p.roundPoints)).toEqual([13, 13, 0, 0]);
    expect(game.phase).toBe("roundEnd");
    expect(game.players.every((p) => !p.hand.length)).toBe(true);
  });
  test("shooting the moon adds 26 to each opponent and zero to shooter", () => {
    const game = finish(lastTrickPosition(true));
    expect(game.players.map((p) => p.score)).toEqual([0, 26, 26, 26]);
    expect(game.moonShooterId).toBe("a");
  });
  test("scores only at hand end, stops at >=100, lowest score wins (ties share victory)", () => {
    const before = lastTrickPosition(false, [90, 80, 20, 20]);
    const halfway = playHeartsCard(before, "a", before.players[0]!.hand[0]!)!;
    expect(halfway.players[0]!.score).toBe(90);
    const game = finish(before);
    expect(game.status).toBe(GameStatus.Finished);
    expect(game.winnerIds).toEqual(["c", "d"]);
    expect(nextHeartsRound(game)).toBeNull();
  });
  test("next rounds preserve totals and seat order, rotate passing, hold on round four", () => {
    let game = finish(lastTrickPosition(true));
    const next = nextHeartsRound(game, identity)!;
    expect(next.roundNumber).toBe(2);
    expect(next.players.map((p) => p.score)).toEqual(game.players.map((p) => p.score));
    expect(next.players.map((p) => p.id)).toEqual(ids);
    game = nextHeartsRound({ ...game, roundNumber: 3 }, identity)!;
    expect(game.phase).toBe("playing");
    expect(game.passDirection).toBe("hold");
    expect(nextHeartsRound(next)).toBeNull();
  });
});

test("bots complete deterministic full matches with legal actions and conserve all 52 cards", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const random = seedRandom(seed);
    let game = initializeHearts(ids, { random });
    let steps = 0;
    while (game.phase !== "matchEnd" && steps++ < 12000) {
      if (game.phase === "roundEnd") { game = nextHeartsRound(game, { random })!; continue; }
      const actor = game.phase === "passing" ? game.players.find((p) => !game.passes[p.id])!.id : game.currentPlayerId;
      const style = seed % 2 ? BotPlaystyle.Cautious : BotPlaystyle.Random;
      const action = chooseHeartsBotAction(game, actor, style, random)!;
      const before = JSON.stringify(game);
      const next = action.type === "pass" ? passHeartsCards(game, actor, action.cards) : action.type === "play" ? playHeartsCard(game, actor, action.card) : null;
      expect(next).not.toBeNull();
      expect(JSON.stringify(game)).toBe(before);
      game = JSON.parse(JSON.stringify(next));
      const cards = [...game.players.flatMap((p) => [...p.hand, ...p.captured]), ...game.trick.map((p) => p.card)];
      expect(cards).toHaveLength(52);
      expect(new Set(cards.map((c) => `${c.suit}:${c.rank}`)).size).toBe(52);
    }
    expect(game.phase).toBe("matchEnd");
    expect(game.winnerIds.length).toBeGreaterThan(0);
    expect(game.players.some((p) => p.score >= 100)).toBe(true);
  }
});

test("bots never consult opponents' hidden hands", () => {
  const base = initializeHearts(ids, identity);
  const shuffled = shuffleCards(base.players[1]!.hand);
  const changed = { ...base, players: base.players.map((p, i) => i === 1 ? { ...p, hand: shuffled } : p) };
  expect(chooseHeartsBotAction(base, "a", BotPlaystyle.Cautious)).toEqual(chooseHeartsBotAction(changed, "a", BotPlaystyle.Cautious));
});
