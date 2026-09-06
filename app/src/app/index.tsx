import { Rank, SevensVariant, Suit } from '@opengamesonline/sevens';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlayingCard } from '@/components/cards/playing-card';
import {
  BrandHeader,
  BusyIndicator,
  ErrorBanner,
  RolePicker,
  RoomButton,
  RoomInput,
  RoomPanel,
  RoomScreen,
} from '@/components/room/room-ui';
import { GameColors } from '@/constants/theme';
import {
  MAX_SEVENS_PLAYERS,
  MIN_SEVENS_PLAYERS,
  useSevensMultiplayer,
  type SevensParticipantRole,
} from '@/features/multiplayer';

const variantOptions = [
  {
    value: SevensVariant.Standard,
    label: 'Standard',
    description: 'Classic 52-card game.',
  },
  {
    value: SevensVariant.Joker,
    label: 'Joker',
    description: 'One Joker enables bridge plays.',
  },
] as const;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { busy, create, discover, error, setUsername, username } = useSevensMultiplayer();
  const [showCreate, setShowCreate] = useState(false);
  const [gameName, setGameName] = useState('The Green Seven');
  const [role, setRole] = useState<SevensParticipantRole>('player');
  const [variant, setVariant] = useState(SevensVariant.Standard);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [showPlayableCards, setShowPlayableCards] = useState(false);
  const [preventIllegalDraw, setPreventIllegalDraw] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  function requireUsername(): string | null {
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setUsernameError('Enter the name other people will see at the table.');
      return null;
    }
    if (cleanUsername !== username) setUsername(cleanUsername);
    setUsernameError(null);
    return cleanUsername;
  }

  function openCreate() {
    if (!requireUsername()) return;
    setFormError(null);
    setShowCreate(true);
  }

  async function submitCreate() {
    const cleanGameName = gameName.trim();
    const cleanUsername = requireUsername();
    if (!cleanGameName) {
      setFormError('Enter a lobby name.');
      return;
    }
    if (!cleanUsername) {
      setShowCreate(false);
      return;
    }

    setFormError(null);
    const created = await create({
      gameName: cleanGameName,
      participantName: cleanUsername,
      role,
      maxPlayers,
      showPlayableCards,
      preventIllegalDraw,
      variant,
    });
    if (created) {
      setShowCreate(false);
      router.push('/session');
    }
  }

  async function listGames() {
    if (!requireUsername()) return;
    if (await discover()) router.push('/games');
  }

  return (
    <RoomScreen>
      <BrandHeader eyebrow="LOCAL CARD ROOM" title="Sevens" />

      <View style={styles.hero}>
        <View style={styles.cardFan}>
          <View style={[styles.fanCard, styles.leftCard]}>
            <PlayingCard card={{ suit: Suit.Clubs, rank: Rank.Seven }} />
          </View>
          <View style={[styles.fanCard, styles.rightCard]}>
            <PlayingCard card={{ suit: Suit.Hearts, rank: Rank.Seven }} />
          </View>
          <View style={styles.centerCard}>
            <PlayingCard card={{ suit: Suit.Spades, rank: Rank.Seven }} />
          </View>
        </View>
        <Text style={styles.heroTitle}>Build every suit from seven.</Text>
        <Text style={styles.heroBody}>
          Host a table on your local network. No account, server, or internet connection required.
        </Text>
      </View>

      <ErrorBanner message={usernameError ?? error} />

      <RoomPanel>
        <RoomInput
          label="YOUR NAME"
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            setUsernameError(null);
          }}
          maxLength={24}
          placeholder="Player"
        />
        <RoomButton
          label="Create Game"
          variant="primary"
          disabled={busy}
          onPress={openCreate}
        />
        <RoomButton label="List Games" disabled={busy} onPress={() => void listGames()} />
        {busy ? <BusyIndicator /> : null}
      </RoomPanel>

      <Text style={styles.footer}>ANDROID + iOS · SAME WI-FI</Text>

      <Modal
        animationType="slide"
        transparent
        visible={showCreate}
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCreate(false)} />
          <KeyboardAwareScrollView
            style={styles.modalSheet}
            contentContainerStyle={styles.modalSheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bottomOffset={16}
          >
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(22, insets.bottom + 16) },
            ]}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>OPEN A TABLE</Text>
            <Text style={styles.modalTitle}>Create Game</Text>
            <RoomInput
              label="LOBBY NAME"
              value={gameName}
              onChangeText={setGameName}
              maxLength={40}
              placeholder="The Green Seven"
            />
            <View style={styles.variantField}>
              <Text style={styles.fieldLabel}>VARIANT</Text>
              <View style={styles.variantOptions}>
                {variantOptions.map((option) => {
                  const selected = option.value === variant;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setVariant(option.value)}
                      style={[styles.variantOption, selected && styles.selectedVariantOption]}
                    >
                      <Text style={[styles.variantName, selected && styles.selectedVariantName]}>
                        {option.label}
                      </Text>
                      <Text style={styles.variantDescription}>{option.description}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <RolePicker value={role} onChange={setRole} />
            <View style={styles.capacityRow}>
              <View>
                <Text style={styles.fieldLabel}>PLAYER SEATS</Text>
                <Text style={styles.capacityHint}>Host can start with 3 or more players.</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  disabled={maxPlayers <= MIN_SEVENS_PLAYERS}
                  onPress={() => setMaxPlayers((value) => Math.max(MIN_SEVENS_PLAYERS, value - 1))}
                  style={styles.stepperButton}
                >
                  <Text style={styles.stepperText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{maxPlayers}</Text>
                <Pressable
                  disabled={maxPlayers >= MAX_SEVENS_PLAYERS}
                  onPress={() => setMaxPlayers((value) => Math.min(MAX_SEVENS_PLAYERS, value + 1))}
                  style={styles.stepperButton}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.fieldLabel}>SHOW PLAYABLE CARDS</Text>
                <Text style={styles.capacityHint}>
                  Highlight legal moves for everyone at the table.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Show playable cards"
                value={showPlayableCards}
                onValueChange={setShowPlayableCards}
                trackColor={{ false: GameColors.feltLight, true: GameColors.goldDark }}
                thumbColor={showPlayableCards ? GameColors.gold : GameColors.creamMuted}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.fieldLabel}>PREVENT ILLEGAL DRAWS</Text>
                <Text style={styles.capacityHint}>
                  Drawing is only allowed when no legal play exists.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Prevent illegal draws"
                value={preventIllegalDraw}
                onValueChange={setPreventIllegalDraw}
                trackColor={{ false: GameColors.feltLight, true: GameColors.goldDark }}
                thumbColor={preventIllegalDraw ? GameColors.gold : GameColors.creamMuted}
              />
            </View>
            <ErrorBanner message={formError ?? error} />
            <RoomButton
              label={busy ? 'Creating…' : 'Create lobby'}
              variant="primary"
              disabled={busy}
              onPress={() => void submitCreate()}
            />
            <RoomButton label="Cancel" disabled={busy} onPress={() => setShowCreate(false)} />
          </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>
    </RoomScreen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, minHeight: 330, alignItems: 'center', justifyContent: 'center', gap: 10 },
  cardFan: { width: 240, height: 178, alignItems: 'center', justifyContent: 'flex-end' },
  fanCard: { position: 'absolute', bottom: 8 },
  leftCard: { left: 38, transform: [{ rotate: '-12deg' }] },
  rightCard: { right: 38, transform: [{ rotate: '12deg' }] },
  centerCard: { zIndex: 3 },
  heroTitle: {
    color: GameColors.white,
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  heroBody: {
    color: GameColors.whiteMuted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 390,
  },
  footer: { color: GameColors.whiteMuted, fontSize: 10, letterSpacing: 2, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,18,14,0.74)',
  },
  modalSheet: { width: '100%', maxHeight: '100%' },
  modalSheetContent: { flexGrow: 1, justifyContent: 'flex-end' },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: GameColors.panelSolid,
    borderColor: GameColors.border,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 22,
    gap: 14,
  },
  modalHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: GameColors.whiteMuted,
    opacity: 0.45,
    alignSelf: 'center',
  },
  modalEyebrow: { color: GameColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  modalTitle: { color: GameColors.white, fontSize: 27, fontWeight: '700' },
  capacityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  settingCopy: { flex: 1 },
  variantField: { gap: 8 },
  variantOptions: { flexDirection: 'row', gap: 9 },
  variantOption: {
    flex: 1,
    minHeight: 62,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GameColors.border,
    padding: 10,
    backgroundColor: 'rgba(246,240,223,0.04)',
  },
  selectedVariantOption: {
    borderColor: GameColors.gold,
    backgroundColor: 'rgba(215,174,90,0.13)',
  },
  variantName: { color: GameColors.creamMuted, fontSize: 14, fontWeight: '800' },
  selectedVariantName: { color: GameColors.gold },
  variantDescription: { color: GameColors.whiteMuted, fontSize: 10, lineHeight: 14, marginTop: 3 },
  fieldLabel: { color: GameColors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  capacityHint: { color: GameColors.whiteMuted, fontSize: 11, marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GameColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { color: GameColors.gold, fontSize: 23, lineHeight: 25 },
  stepperValue: { color: GameColors.white, fontSize: 22, fontWeight: '800', minWidth: 20, textAlign: 'center' },
});
