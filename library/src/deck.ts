import type { Card, PlayerState, RandomSource } from "./types.js";

export function shuffleCards(
  cards: readonly Card[],
  random: RandomSource = Math.random,
): readonly Card[] {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = random();
    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
      throw new RangeError("Random source must return a number from 0 (inclusive) to 1 (exclusive)");
    }

    const swapIndex = Math.floor(randomValue * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }

  return shuffled;
}

export function dealCards(
  cards: readonly Card[],
  playerIds: readonly string[],
): readonly PlayerState[] {
  if (playerIds.length === 0) {
    throw new RangeError("At least one player is required to deal cards");
  }

  const hands = playerIds.map((): Card[] => []);
  cards.forEach((card, index) => {
    hands[index % playerIds.length]!.push(card);
  });

  return playerIds.map((id, index) => ({ id, hand: hands[index]! }));
}
