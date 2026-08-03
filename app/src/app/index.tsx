import { Rank, Suit } from '@opengamesonline/sevens';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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

export default function HomeScreen() {
  const { busy, create, discover, error } = useSevensMultiplayer();
  const [showCreate, setShowCreate] = useState(false);
  const [gameName, setGameName] = useState('The Green Seven');
  const [participantName, setParticipantName] = useState('Player');
  const [role, setRole] = useState<SevensParticipantRole>('player');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [formError, setFormError] = useState<string | null>(null);

  async function submitCreate() {
    const cleanGameName = gameName.trim();
    const cleanParticipantName = participantName.trim();
    if (!cleanGameName || !cleanParticipantName) {
      setFormError('Enter both a lobby name and your display name.');
      return;
    }

    setFormError(null);
    const created = await create({
      gameName: cleanGameName,
      participantName: cleanParticipantName,
      role,
      maxPlayers,
    });
    if (created) {
      setShowCreate(false);
      router.push('/session');
    }
  }

  async function listGames() {
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
            <PlayingCard card={{ suit: Suit.Diamonds, rank: Rank.Seven }} />
          </View>
        </View>
        <Text style={styles.heroTitle}>Build every suit from seven.</Text>
        <Text style={styles.heroBody}>
          Host a table on your local network. No account, server, or internet connection required.
        </Text>
      </View>

      <ErrorBanner message={error} />

      <RoomPanel>
        <RoomButton
          label="Create Game"
          variant="primary"
          disabled={busy}
          onPress={() => setShowCreate(true)}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCreate(false)} />
          <View style={styles.modalCard}>
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
            <RoomInput
              label="YOUR NAME"
              value={participantName}
              onChangeText={setParticipantName}
              maxLength={24}
              placeholder="Player"
            />
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
            <ErrorBanner message={formError ?? error} />
            <RoomButton
              label={busy ? 'Creating…' : 'Create lobby'}
              variant="primary"
              disabled={busy}
              onPress={() => void submitCreate()}
            />
            <RoomButton label="Cancel" disabled={busy} onPress={() => setShowCreate(false)} />
          </View>
        </KeyboardAvoidingView>
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
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
