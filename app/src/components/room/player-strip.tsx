import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GameColors } from '@/constants/theme';

export type TablePlayer = {
  id: string; name: string; cardCount: number; isCurrentPlayer: boolean;
  isSelf?: boolean; detail?: string; offline?: boolean;
};

export function PlayerStrip({ players, mark }: { players: readonly TablePlayer[]; mark: string }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.players}>
    {players.map((player) => <View key={player.id} style={[styles.player, player.isCurrentPlayer && styles.current]}
      accessible accessibilityLabel={`${player.name}${player.isSelf ? ', you' : ''}, ${player.cardCount} cards${player.isCurrentPlayer ? ', current turn' : ''}${player.detail ? `, ${player.detail}` : ''}${player.offline ? ', offline' : ''}`}>
      <View style={styles.cardBack}><Text style={styles.mark}>{mark}</Text></View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>{player.name}{player.isSelf ? ' · YOU' : ''}</Text>
        <Text style={styles.count}>{player.cardCount} {player.cardCount === 1 ? 'card' : 'cards'}</Text>
        {player.isCurrentPlayer ? <Text style={styles.active}>TURN</Text> : null}
        {player.detail || player.offline ? <Text style={styles.detail}>{[player.detail, player.offline ? 'OFFLINE' : null].filter(Boolean).join(' · ')}</Text> : null}
      </View>
    </View>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  players: { gap: 9, paddingVertical: 2 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1, borderColor: GameColors.border, padding: 9, minWidth: 144, maxWidth: 220, backgroundColor: 'rgba(0,0,0,0.13)' },
  current: { borderColor: GameColors.gold, backgroundColor: 'rgba(215,174,90,0.1)' },
  cardBack: { width: 30, height: 42, borderRadius: 5, borderWidth: 2, borderColor: GameColors.creamMuted, backgroundColor: GameColors.red, alignItems: 'center', justifyContent: 'center' },
  mark: { color: GameColors.cream, fontWeight: '900' }, copy: { flexShrink: 1 },
  name: { color: GameColors.white, fontSize: 14, fontWeight: '700' },
  count: { color: GameColors.whiteMuted, fontSize: 12, marginTop: 2 },
  active: { color: GameColors.gold, fontSize: 10, fontWeight: '800', marginTop: 2 },
  detail: { color: GameColors.whiteMuted, fontSize: 10, marginTop: 2 },
});
