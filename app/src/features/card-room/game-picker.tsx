import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GameColors } from '@/constants/theme';
import { GAME_INFO, GAME_TYPES, type GameType } from './registry';

export function GamePicker({ value, onChange, disabled = false }: { value: GameType; onChange(value: GameType): void; disabled?: boolean }) {
  return <View style={styles.container}>
    <View style={styles.row}>{GAME_TYPES.map((type) => <Pressable key={type} disabled={disabled}
      accessibilityRole="button" accessibilityState={{ selected: value === type, disabled }}
      onPress={() => onChange(type)}
      style={[styles.option, value === type && styles.selected]}>
      <Text style={styles.name}>{GAME_INFO[type].mark}  {GAME_INFO[type].name}</Text>
      <Text style={styles.detail}>{GAME_INFO[type].players}</Text>
    </Pressable>)}</View>
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 8 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { flexGrow: 1, flexBasis: 140, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: GameColors.border, gap: 4 },
  selected: { borderColor: GameColors.gold, backgroundColor: GameColors.panelSolid },
  name: { color: GameColors.cream, fontSize: 19, fontWeight: '700' },
  detail: { color: GameColors.whiteMuted, fontSize: 11 },
});
