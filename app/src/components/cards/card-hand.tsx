import type { Card } from '@opengamesonline/sevens';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GameCardSize } from '@/constants/theme';
import { cardKey } from './playing-card';

/** Responsive overlapping hand layout shared by card games. */
export function CardHand<T extends Card>({ cards, renderCard }: { cards: readonly T[]; renderCard(card: T): ReactNode }) {
  const [width, setWidth] = useState(0);
  const cardWidth = GameCardSize.compactWidth * 2;
  const perRow = width ? Math.max(1, Math.min(10, Math.floor((width - cardWidth) / 25) + 1)) : 8;
  const rows = Array.from({ length: Math.ceil(cards.length / perRow) }, (_, index) => cards.slice(index * perRow, (index + 1) * perRow));
  const step = perRow > 1 && width > 0 ? Math.max(0, Math.min(cardWidth + 8, (width - cardWidth) / (perRow - 1))) : 0;
  return <View style={styles.hand} onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
    {rows.map((row) => <View key={cardKey(row[0]!)} style={[styles.row, { width: Math.max(cardWidth, cardWidth + step * (row.length - 1)) }]}>
      {row.map((card, index) => <View key={cardKey(card)} style={[styles.card, { left: step * index }]}>{renderCard(card)}</View>)}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  hand: { alignItems: 'center', gap: 8, paddingTop: 9, paddingBottom: 5 },
  row: { position: 'relative', alignSelf: 'flex-start', height: GameCardSize.compactHeight * 2 },
  card: { position: 'absolute', top: 0 },
});
