import { Rank, Suit, isJokerCard, type Card } from '@opengamesonline/sevens';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GameCardSize, GameColors } from '@/constants/theme';

const rankLabels: Record<Rank, string> = {
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

const suitGlyphs: Record<Suit, string> = {
  [Suit.Clubs]: '♣',
  [Suit.Diamonds]: '♦',
  [Suit.Hearts]: '♥',
  [Suit.Spades]: '♠',
};

export function cardKey(card: Card): string {
  if (isJokerCard(card)) return 'joker';
  return `${card.suit}:${card.rank}`;
}

export function PlayingCard({
  card,
  compact = false,
  handSize = false,
  selected = false,
  playable = true,
  selectable = false,
  placeholder = false,
  onPress,
}: {
  card: Card;
  compact?: boolean;
  handSize?: boolean;
  selected?: boolean;
  playable?: boolean;
  selectable?: boolean;
  placeholder?: boolean;
  onPress?(): void;
}) {
  const red = !isJokerCard(card) && (card.suit === Suit.Diamonds || card.suit === Suit.Hearts);
  const color = red ? GameColors.red : GameColors.blackSuit;
  const accessibilityLabel = isJokerCard(card)
    ? `Joker${playable ? '' : ', not playable'}`
    : `${rankLabels[card.rank]} of ${card.suit}${playable ? '' : ', not playable'}`;

  return (
    <Pressable
      accessibilityRole={selectable ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!selectable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compactCard : handSize ? styles.handCard : styles.fullCard,
        placeholder && styles.placeholder,
        selected && (compact || handSize ? styles.compactSelected : styles.selected),
        !playable && selectable && styles.unplayable,
        pressed && selectable && styles.pressed,
      ]}
    >
      {isJokerCard(card) ? (
        <>
          <View style={[styles.jokerRail, compact && styles.compactJokerRail]}>
            <Text style={[styles.jokerRailText, compact && styles.compactJokerRailText]}>
              {compact ? 'JKR' : 'J\nO\nK\nE\nR'}
            </Text>
          </View>
          {!compact ? (
            <Text style={[styles.jokerCenter, handSize && styles.handJokerCenter]}>JOKER</Text>
          ) : null}
        </>
      ) : (
        <>
          <View style={styles.corner}>
            <Text
              style={[
                compact ? styles.compactRank : handSize ? styles.handRank : styles.rank,
                { color },
              ]}
            >
              {rankLabels[card.rank]}
            </Text>
            <Text
              style={[
                compact ? styles.compactSuit : handSize ? styles.handSuit : styles.suit,
                { color },
              ]}
            >
              {suitGlyphs[card.suit]}
            </Text>
          </View>
          {!compact && !handSize ? (
            <Text style={[styles.centerSuit, { color }]}>{suitGlyphs[card.suit]}</Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function suitGlyph(suit: Suit): string {
  return suitGlyphs[suit];
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GameColors.cream,
    borderColor: '#FFFDF4',
    borderWidth: 1,
    shadowColor: GameColors.shadow,
    shadowOpacity: 0.34,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  fullCard: {
    width: GameCardSize.width,
    height: GameCardSize.height,
    borderRadius: 12,
    padding: 9,
  },
  compactCard: {
    width: GameCardSize.compactWidth,
    height: GameCardSize.compactHeight,
    borderRadius: 6,
    padding: 4,
  },
  handCard: {
    width: GameCardSize.compactWidth * 2,
    height: GameCardSize.compactHeight * 2,
    borderRadius: 10,
    padding: 7,
  },
  corner: { alignItems: 'center', alignSelf: 'flex-start' },
  rank: { fontSize: 23, lineHeight: 24, fontWeight: '800' },
  suit: { fontSize: 18, lineHeight: 19 },
  compactRank: { fontSize: 13, lineHeight: 14, fontWeight: '800' },
  compactSuit: { fontSize: 11, lineHeight: 12 },
  handRank: { fontSize: 19, lineHeight: 20, fontWeight: '800' },
  handSuit: { fontSize: 15, lineHeight: 16 },
  centerSuit: { position: 'absolute', alignSelf: 'center', top: 50, fontSize: 42 },
  jokerRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
    backgroundColor: GameColors.red,
  },
  compactJokerRail: { width: 18, borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  jokerRailText: {
    color: GameColors.cream,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  compactJokerRailText: { fontSize: 7, lineHeight: 8 },
  jokerCenter: {
    position: 'absolute',
    alignSelf: 'center',
    top: 66,
    color: GameColors.blackSuit,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.8,
    transform: [{ rotate: '-90deg' }],
  },
  handJokerCenter: { top: 50, fontSize: 10, letterSpacing: 1.2 },
  selected: {
    borderColor: GameColors.gold,
    borderWidth: 3,
    transform: [{ translateY: -12 }],
    shadowColor: GameColors.gold,
    shadowOpacity: 0.55,
  },
  compactSelected: {
    borderColor: GameColors.gold,
    borderWidth: 3,
    transform: [{ translateY: -4 }],
    shadowColor: GameColors.gold,
    shadowOpacity: 0.55,
  },
  unplayable: { opacity: 0.54 },
  placeholder: { opacity: 0.26, backgroundColor: 'transparent', borderStyle: 'dashed' },
  pressed: { transform: [{ translateY: -5 }] },
});
