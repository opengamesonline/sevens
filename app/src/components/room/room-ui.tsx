import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameColors } from '@/constants/theme';
import type { SevensParticipantRole } from '@/features/multiplayer';

export function RoomScreen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.feltGlow} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function BrandHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkRank}>7</Text>
        <Text style={styles.brandMarkSuit}>♦</Text>
      </View>
      <View style={styles.brandCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.brandTitle}>{title}</Text>
      </View>
    </View>
  );
}

export function RoomPanel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function RoomButton({
  label,
  onPress,
  disabled = false,
  variant = 'secondary',
  compact = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.primaryButton,
        variant === 'danger' && styles.dangerButton,
        compact && styles.compactButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.primaryButtonText,
          variant === 'danger' && styles.dangerButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function RoomInput({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        autoCapitalize={props.autoCapitalize ?? 'words'}
        placeholderTextColor={GameColors.whiteMuted}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

export function RolePicker({
  value,
  onChange,
  playerDisabled = false,
}: {
  value: SevensParticipantRole;
  onChange(role: SevensParticipantRole): void;
  playerDisabled?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>JOIN AS</Text>
      <View style={styles.segmented}>
        {(['player', 'spectator'] as const).map((role) => {
          const disabled = role === 'player' && playerDisabled;
          return (
            <Pressable
              key={role}
              disabled={disabled}
              onPress={() => onChange(role)}
              style={[
                styles.segment,
                value === role && styles.segmentSelected,
                disabled && styles.disabled,
              ]}
            >
              <Text style={[styles.segmentText, value === role && styles.segmentTextSelected]}>
                {role === 'player' ? 'Player' : 'Spectator'}
              </Text>
              <Text style={styles.segmentHint}>
                {role === 'player' ? 'Receive a hand' : 'Watch the table'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function BusyIndicator() {
  return <ActivityIndicator color={GameColors.gold} size="small" />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: GameColors.feltDeep },
  feltGlow: {
    position: 'absolute',
    top: -120,
    left: -90,
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: GameColors.feltLight,
    opacity: 0.38,
  },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, gap: 18 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 8 },
  brandMark: {
    width: 56,
    height: 76,
    borderRadius: 10,
    backgroundColor: GameColors.cream,
    padding: 7,
    shadowColor: GameColors.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  brandMarkRank: { color: GameColors.red, fontSize: 22, fontWeight: '800', lineHeight: 23 },
  brandMarkSuit: { color: GameColors.red, fontSize: 18, lineHeight: 19 },
  brandCopy: { gap: 2 },
  eyebrow: { color: GameColors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 2.2 },
  brandTitle: { color: GameColors.white, fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  panel: {
    backgroundColor: GameColors.panel,
    borderColor: GameColors.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 14,
    shadowColor: GameColors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GameColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(246,240,223,0.07)',
  },
  primaryButton: { backgroundColor: GameColors.gold, borderColor: GameColors.gold },
  dangerButton: { borderColor: GameColors.danger, backgroundColor: 'rgba(213,107,98,0.12)' },
  compactButton: { minHeight: 42, paddingHorizontal: 14 },
  buttonText: { color: GameColors.white, fontSize: 16, fontWeight: '700' },
  primaryButtonText: { color: GameColors.feltDeep },
  dangerButtonText: { color: '#FFD8D2' },
  disabled: { opacity: 0.38 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.88 },
  field: { gap: 8 },
  label: { color: GameColors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  input: {
    minHeight: 52,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: GameColors.border,
    backgroundColor: 'rgba(0,0,0,0.16)',
    color: GameColors.white,
    fontSize: 17,
    paddingHorizontal: 15,
  },
  segmented: { flexDirection: 'row', gap: 10 },
  segment: {
    flex: 1,
    minHeight: 68,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: GameColors.border,
    padding: 11,
    justifyContent: 'center',
  },
  segmentSelected: { borderColor: GameColors.gold, backgroundColor: 'rgba(215,174,90,0.13)' },
  segmentText: { color: GameColors.whiteMuted, fontWeight: '700', fontSize: 15 },
  segmentTextSelected: { color: GameColors.gold },
  segmentHint: { color: GameColors.whiteMuted, fontSize: 11, marginTop: 3 },
  errorBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GameColors.danger,
    backgroundColor: 'rgba(213,107,98,0.14)',
    padding: 12,
  },
  errorText: { color: '#FFD8D2', fontWeight: '600', lineHeight: 20 },
});
