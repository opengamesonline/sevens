import { isStandardPlayable } from "./board.js";
import {
  SevensVariant,
  type BoardState,
  type Card,
  type VariantRules,
} from "./types.js";

const standardRules = Object.freeze({
  getPlayableCards: (board: BoardState, hand: readonly Card[]) =>
    hand.filter((card) => isStandardPlayable(board, card)),
}) satisfies VariantRules;

export function getVariantRules(variant: SevensVariant): VariantRules {
  switch (variant) {
    case SevensVariant.Standard:
      return standardRules;
    default:
      throw new RangeError(`Unsupported Sevens variant: ${String(variant)}`);
  }
}

export function getPlayableCards(
  board: BoardState,
  hand: readonly Card[],
  variant: SevensVariant,
): readonly Card[] {
  return getVariantRules(variant).getPlayableCards(board, hand);
}
