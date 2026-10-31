import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { GameColors } from '@/constants/theme';
import { GAME_INFO, GAME_TYPES } from './registry';
import { useCardRoom } from './room-provider';

export function GamePicker({ disabled = false }: { disabled?: boolean }) {
  const room = useCardRoom();
  const [error, setError] = useState<string | null>(null);
  return <View style={styles.container}>
    <View style={styles.row}>{GAME_TYPES.map((type) => <Pressable key={type} disabled={disabled}
      accessibilityRole="button" accessibilityState={{ selected: room.gameType === type }}
      onPress={() => { setError(null); void room.selectGame(type).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not select game')); }}
      style={[styles.option, room.gameType === type && styles.selected]}>
      <Text style={styles.name}>{GAME_INFO[type].mark}  {GAME_INFO[type].name}</Text>
      <Text style={styles.detail}>{GAME_INFO[type].players}</Text>
    </Pressable>)}</View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 8 }, row: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: GameColors.border, gap: 4 },
  selected: { borderColor: GameColors.gold, backgroundColor: GameColors.panelSolid },
  name: { color: GameColors.cream, fontSize: 19, fontWeight: '700' },
  detail: { color: GameColors.whiteMuted, fontSize: 11 }, error: { color: GameColors.danger },
});
