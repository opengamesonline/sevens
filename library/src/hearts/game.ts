import { cardEquals, createDeck } from "../shared/cards.js";
import { shuffleCards } from "../shared/deck.js";
import { GameStatus, Rank, Suit, type InitializeOptions, type StandardCard } from "../shared/types.js";
import type { HeartsGame, HeartsPlayer, PassDirection, TrickPlay } from "./types.js";

export function heartsRank(card: StandardCard): number {
  return card.rank === Rank.Ace ? 14 : card.rank;
}

export function penaltyPoints(card: StandardCard): number {
  return card.suit === Suit.Hearts ? 1 : card.suit === Suit.Spades && card.rank === Rank.Queen ? 13 : 0;
}

export function passDirection(roundNumber: number): PassDirection {
  return (["left", "right", "across", "hold"] as const)[(roundNumber - 1) % 4]!;
}

function deal(playerIds: readonly string[], scores: readonly number[], roundNumber: number, options: InitializeOptions): HeartsGame {
  const cards = shuffleCards(createDeck(), options.random);
  const hands: StandardCard[][] = playerIds.map(() => []);
  cards.forEach((card, index) => hands[(index + roundNumber - 1) % 4]!.push(card));
  const players: HeartsPlayer[] = playerIds.map((id, index) => ({
    id, hand: hands[index]!, captured: [], score: scores[index]!, roundPoints: 0,
  }));
  const direction = passDirection(roundNumber);
  return {
    status: GameStatus.Active,
    phase: direction === "hold" ? "playing" : "passing",
    players, roundNumber, passDirection: direction, passes: {},
    currentPlayerId: players.find(({ hand }) => hand.some(isTwoClubs))!.id,
    trick: [], lastTrick: [], tricksPlayed: 0, heartsBroken: false, moonShooterId: null, winnerIds: [],
  };
}

export function initializeHearts(playerIds: readonly string[], options: InitializeOptions = {}): HeartsGame {
  if (playerIds.length !== 4 || new Set(playerIds).size !== 4 || playerIds.some((id) => !id.trim())) {
    throw new RangeError("Hearts requires exactly four unique, non-empty player IDs");
  }
  return deal(playerIds, [0, 0, 0, 0], 1, options);
}

export function nextHeartsRound(game: HeartsGame, options: InitializeOptions = {}): HeartsGame | null {
  if (game.phase !== "roundEnd") return null;
  return deal(game.players.map(({ id }) => id), game.players.map(({ score }) => score), game.roundNumber + 1, options);
}

function isTwoClubs(card: StandardCard): boolean {
  return card.suit === Suit.Clubs && card.rank === Rank.Two;
}

export function passHeartsCards(game: HeartsGame, actorId: string, cards: readonly StandardCard[]): HeartsGame | null {
  const actor = game.players.find(({ id }) => id === actorId);
  if (game.phase !== "passing" || !actor || game.passes[actorId] || cards.length !== 3 ||
      new Set(cards.map((card) => `${card.suit}:${card.rank}`)).size !== 3 ||
      cards.some((card) => !actor.hand.some((held) => cardEquals(held, card)))) return null;
  const passes = { ...game.passes, [actorId]: cards.map((card) => ({ ...card })) };
  if (game.players.some(({ id }) => !passes[id])) return { ...game, passes };
  const offset = game.passDirection === "left" ? 1 : game.passDirection === "right" ? 3 : 2;
  const players = game.players.map((player, index) => ({
    ...player,
    hand: [
      ...player.hand.filter((card) => !passes[player.id]!.some((passed) => cardEquals(passed, card))),
      ...passes[game.players[(index - offset + 4) % 4]!.id]!,
    ],
  }));
  return { ...game, players, passes: {}, phase: "playing", currentPlayerId: players.find(({ hand }) => hand.some(isTwoClubs))!.id };
}

export function getHeartsPlayableCards(game: HeartsGame, actorId: string): readonly StandardCard[] {
  const hand = game.players.find(({ id }) => id === actorId)?.hand;
  if (game.phase !== "playing" || game.currentPlayerId !== actorId || !hand) return [];
  const lead = game.trick[0]?.card;
  if (!lead) {
    if (game.tricksPlayed === 0) return hand.filter(isTwoClubs);
    const nonHearts = hand.filter(({ suit }) => suit !== Suit.Hearts);
    return game.heartsBroken || nonHearts.length === 0 ? hand : nonHearts;
  }
  const following = hand.filter(({ suit }) => suit === lead.suit);
  if (following.length) return following;
  const nonPenalty = hand.filter((card) => penaltyPoints(card) === 0);
  return game.tricksPlayed === 0 && nonPenalty.length ? nonPenalty : hand;
}

export function heartsTrickWinner(trick: readonly TrickPlay[]): string {
  if (!trick.length) throw new RangeError("Cannot score an empty trick");
  const lead = trick[0]!;
  return trick.reduce((winner, play) => play.card.suit === lead.card.suit && heartsRank(play.card) > heartsRank(winner.card) ? play : winner, lead).playerId;
}

export function playHeartsCard(game: HeartsGame, actorId: string, card: StandardCard): HeartsGame | null {
  if (!getHeartsPlayableCards(game, actorId).some((legal) => cardEquals(legal, card))) return null;
  const trick = [...game.trick, { playerId: actorId, card: { ...card } }];
  const players = game.players.map((player) => player.id === actorId
    ? { ...player, hand: player.hand.filter((held) => !cardEquals(held, card)) } : player);
  const heartsBroken = game.heartsBroken || card.suit === Suit.Hearts;
  if (trick.length < 4) {
    const index = players.findIndex(({ id }) => id === actorId);
    return { ...game, players, trick, heartsBroken, currentPlayerId: players[(index + 1) % 4]!.id };
  }
  const winnerId = heartsTrickWinner(trick);
  const capturedPlayers = players.map((player) => player.id === winnerId
    ? { ...player, captured: [...player.captured, ...trick.map(({ card: played }) => played)] } : player);
  const tricksPlayed = game.tricksPlayed + 1;
  const next: HeartsGame = { ...game, players: capturedPlayers, heartsBroken, trick: [], lastTrick: trick, tricksPlayed, currentPlayerId: winnerId };
  if (tricksPlayed < 13) return next;
  const points = capturedPlayers.map(({ captured }) => captured.reduce((total, taken) => total + penaltyPoints(taken), 0));
  const moonIndex = points.indexOf(26);
  const scoredPlayers = capturedPlayers.map((player, index) => {
    const roundPoints = moonIndex === -1 ? points[index]! : index === moonIndex ? 0 : 26;
    return { ...player, roundPoints, score: player.score + roundPoints };
  });
  const finished = scoredPlayers.some(({ score }) => score >= 100);
  const minimum = Math.min(...scoredPlayers.map(({ score }) => score));
  return {
    ...next, players: scoredPlayers, moonShooterId: moonIndex === -1 ? null : scoredPlayers[moonIndex]!.id,
    phase: finished ? "matchEnd" : "roundEnd", status: finished ? GameStatus.Finished : GameStatus.Active,
    winnerIds: finished ? scoredPlayers.filter(({ score }) => score === minimum).map(({ id }) => id) : [],
  };
}
