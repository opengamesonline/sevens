import { SevensVariant } from '@opengamesonline/sevens';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { GameColors } from '@/constants/theme';
import { CreateActions, type GameSetupProps } from '../card-room/create-actions';
import { MAX_SEVENS_PLAYERS, MIN_SEVENS_PLAYERS } from './types';
import { useSevensMultiplayer } from './session-provider';
import { sevensHelp } from './help';

const variants = (Object.keys(sevensHelp.variants) as SevensVariant[]).map((value) => ({ value, ...sevensHelp.variants[value] }));

export function SevensCreateOptions(props: GameSetupProps) {
  const session = useSevensMultiplayer();
  const [variant, setVariant] = useState(SevensVariant.Standard);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [showPlayableCards, setShowPlayableCards] = useState(false);
  const [preventIllegalDraw, setPreventIllegalDraw] = useState(false);
  const { onVariantChange } = props;
  useEffect(() => { onVariantChange?.(variant); }, [onVariantChange, variant]);
  return <>
    <View style={styles.field}>
      <Text style={styles.label}>VARIANT</Text>
      <View style={styles.options}>{variants.map((option) => <Pressable key={option.value}
        accessibilityRole="button" accessibilityState={{ selected: variant === option.value }}
        onPress={() => setVariant(option.value)} style={[styles.option, variant === option.value && styles.selected]}>
        <Text style={[styles.optionName, variant === option.value && styles.selectedName]}>{option.label}</Text>
        <Text style={styles.description}>{option.description}</Text>
      </Pressable>)}</View>
    </View>
    <View style={styles.row}>
      <View style={styles.copy}><Text style={styles.label}>PLAYER SEATS</Text><Text style={styles.hint}>Host can start with 3 or more players.</Text></View>
      <View style={styles.stepper}>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove player seat" disabled={maxPlayers <= MIN_SEVENS_PLAYERS}
          onPress={() => setMaxPlayers((value) => Math.max(MIN_SEVENS_PLAYERS, value - 1))} style={styles.stepperButton}><Text style={styles.stepperText}>−</Text></Pressable>
        <Text style={styles.stepperValue}>{maxPlayers}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Add player seat" disabled={maxPlayers >= MAX_SEVENS_PLAYERS}
          onPress={() => setMaxPlayers((value) => Math.min(MAX_SEVENS_PLAYERS, value + 1))} style={styles.stepperButton}><Text style={styles.stepperText}>+</Text></Pressable>
      </View>
    </View>
    <View style={styles.row}><View style={styles.copy}><Text style={styles.label}>SHOW PLAYABLE CARDS</Text><Text style={styles.hint}>Highlight legal moves for everyone at the table.</Text></View>
      <Switch accessibilityLabel="Show playable cards" value={showPlayableCards} onValueChange={setShowPlayableCards}
        trackColor={{ false: GameColors.feltLight, true: GameColors.goldDark }} thumbColor={showPlayableCards ? GameColors.gold : GameColors.creamMuted} />
    </View>
    <View style={styles.row}><View style={styles.copy}><Text style={styles.label}>PREVENT ILLEGAL DRAWS</Text><Text style={styles.hint}>Drawing is only allowed when no legal play exists.</Text></View>
      <Switch accessibilityLabel="Prevent illegal draws" value={preventIllegalDraw} onValueChange={setPreventIllegalDraw}
        trackColor={{ false: GameColors.feltLight, true: GameColors.goldDark }} thumbColor={preventIllegalDraw ? GameColors.gold : GameColors.creamMuted} />
    </View>
    <CreateActions {...props} gameType="sevens" sessionBusy={session.busy} sessionError={session.error}
      options={{ gameName: props.gameName.trim(), participantName: props.participantName.trim(), role: props.role,
        variant, maxPlayers, showPlayableCards, preventIllegalDraw }} />
  </>;
}

const styles = StyleSheet.create({
  field: { gap: 8 }, label: { color: GameColors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  options: { flexDirection: 'row', gap: 9 }, option: { flex: 1, minHeight: 62, borderRadius: 12, borderWidth: 1, borderColor: GameColors.border, padding: 10, backgroundColor: 'rgba(246,240,223,0.04)' },
  selected: { borderColor: GameColors.gold, backgroundColor: 'rgba(215,174,90,0.13)' }, optionName: { color: GameColors.creamMuted, fontSize: 14, fontWeight: '800' },
  selectedName: { color: GameColors.gold }, description: { color: GameColors.whiteMuted, fontSize: 10, lineHeight: 14, marginTop: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 }, copy: { flex: 1 }, hint: { color: GameColors.whiteMuted, fontSize: 11, marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 }, stepperButton: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: GameColors.border, alignItems: 'center', justifyContent: 'center' },
  stepperText: { color: GameColors.gold, fontSize: 23, lineHeight: 25 }, stepperValue: { color: GameColors.white, fontSize: 22, fontWeight: '800', minWidth: 20, textAlign: 'center' },
});
