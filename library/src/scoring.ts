import { isJokerCard } from "./cards.js";
import { GameStatus, Rank, type Card, type FinalScore, type SevensGameObject } from "./types.js";

function scoreCard(card: Card): number {
  if (isJokerCard(card)) {
    return 0;
  }

  if (card.rank === Rank.Ace) {
    return 15;
  }
  return card.rank >= Rank.Ten ? 10 : 5;
}

export function createFinalScores(game: SevensGameObject): readonly FinalScore[] {
  if (game.status !== GameStatus.Finished) {
    throw new Error("Final scores are only available after the game has finished");
  }

  return game.players.map((player) => ({
    playerId: player.id,
    score: player.hand.reduce((total, card) => total + scoreCard(card), 0),
  }));
}
