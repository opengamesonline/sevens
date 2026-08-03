import { Rank, Suit, type Card } from '@opengamesonline/sevens';
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
  return `${card.suit}:${card.rank}`;
}

export function PlayingCard({
  card,
  compact = false,
  selected = false,
  playable = true,
  selectable = false,
  placeholder = false,
  onPress,
}: {
  card: Card;
  compact?: boolean;
  selected?: boolean;
  playable?: boolean;
  selectable?: boolean;
  placeholder?: boolean;
  onPress?(): void;
}) {
  const red = card.suit === Suit.Diamonds || card.suit === Suit.Hearts;
  const color = red ? GameColors.red : GameColors.blackSuit;

  return (
    <Pressable
      accessibilityRole={selectable ? 'button' : undefined}
      accessibilityLabel={`${rankLabels[card.rank]} of ${card.suit}${playable ? '' : ', not playable'}`}
      disabled={!selectable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact ? styles.compactCard : styles.fullCard,
        placeholder && styles.placeholder,
        selected && styles.selected,
        !playable && selectable && styles.unplayable,
        pressed && selectable && styles.pressed,
      ]}
    >
      <View style={styles.corner}>
        <Text style={[compact ? styles.compactRank : styles.rank, { color }]}>
          {rankLabels[card.rank]}
        </Text>
        <Text style={[compact ? styles.compactSuit : styles.suit, { color }]}>
          {suitGlyphs[card.suit]}
        </Text>
      </View>
      {!compact ? <Text style={[styles.centerSuit, { color }]}>{suitGlyphs[card.suit]}</Text> : null}
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
  corner: { alignItems: 'center', alignSelf: 'flex-start' },
  rank: { fontSize: 23, lineHeight: 24, fontWeight: '800' },
  suit: { fontSize: 18, lineHeight: 19 },
  compactRank: { fontSize: 13, lineHeight: 14, fontWeight: '800' },
  compactSuit: { fontSize: 11, lineHeight: 12 },
  centerSuit: { position: 'absolute', alignSelf: 'center', top: 50, fontSize: 42 },
  selected: {
    borderColor: GameColors.gold,
    borderWidth: 3,
    transform: [{ translateY: -12 }],
    shadowColor: GameColors.gold,
    shadowOpacity: 0.55,
  },
  unplayable: { opacity: 0.54 },
  placeholder: { opacity: 0.26, backgroundColor: 'transparent', borderStyle: 'dashed' },
  pressed: { transform: [{ translateY: -5 }] },
});
