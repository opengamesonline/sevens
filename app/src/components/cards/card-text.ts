import {
  Rank,
  Suit,
  cardEquals,
  isJokerCard,
  type BoardState,
  type Card,
  type StandardCard,
} from '@opengamesonline/sevens';

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

export function gainedCards(prevHand: readonly Card[], hand: readonly Card[]): Card[] {
  const remaining = [...prevHand];
  return hand.filter((card) => {
    const index = remaining.findIndex((held) => cardEquals(card, held));
    if (index === -1) return true;
    remaining.splice(index, 1);
    return false;
  });
}

export function isCardOnBoard(board: BoardState, card: Card): boolean {
  if (isJokerCard(card)) return false;
  const bounds = board[card.suit];
  return (
    bounds.min !== null && bounds.max !== null && card.rank >= bounds.min && card.rank <= bounds.max
  );
}

export function placedCards(
  prevBoard: BoardState,
  board: BoardState,
  cards: readonly Card[],
): StandardCard[] {
  return cards.filter(
    (card): card is StandardCard => !isJokerCard(card) && !isCardOnBoard(prevBoard, card) && isCardOnBoard(board, card),
  );
}
