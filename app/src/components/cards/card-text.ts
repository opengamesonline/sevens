import { Rank, Suit, isJokerCard, type Card } from '@opengamesonline/sevens';

export const rankLabels: Record<Rank, string> = {
  [Rank.Ace]: 'A',
  [Rank.Two]: '2',
  [Rank.Three]: '3',
  [Rank.Four]: '4',
  [Rank.Five]: '5',
  [Rank.Six]: '6',
  [Rank.Seven]: '7',
  [Rank.Eight]: '8',
  [Rank.Nine]: '9',
  [Rank.Ten]: '10',
  [Rank.Jack]: 'J',
  [Rank.Queen]: 'Q',
  [Rank.King]: 'K',
};

export const suitGlyphs: Record<Suit, string> = {
  [Suit.Clubs]: '♣',
  [Suit.Diamonds]: '♦',
  [Suit.Hearts]: '♥',
  [Suit.Spades]: '♠',
};

export function suitGlyph(suit: Suit): string {
  return suitGlyphs[suit];
}

export function cardLabel(card: Card): string {
  if (isJokerCard(card)) return 'Joker';
  return `${rankLabels[card.rank]}${suitGlyphs[card.suit]}`;
}
