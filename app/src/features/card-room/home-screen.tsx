import { Rank, Suit } from '@opengamesonline/sevens';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayingCard } from '@/components/cards/playing-card';
import { BrandHeader, BusyIndicator, ErrorBanner, RolePicker, RoomButton, RoomInput, RoomPanel, RoomScreen } from '@/components/room/room-ui';
import { GameColors } from '@/constants/theme';
import { GAME_ADAPTERS } from './game-adapters';
import { GamePicker } from './game-picker';
import { useCardRoom } from './room-provider';
import type { GameType } from './registry';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const room = useCardRoom();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameType>(room.gameType);
  const [gameName, setGameName] = useState('The Green Table');
  const [role, setRole] = useState<'player' | 'spectator'>('player');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const Setup = GAME_ADAPTERS[selectedGame].CreateOptions;
  const creating = room.busy || Boolean(room.pendingCreate);

  function requireUsername() {
    const name = room.username.trim();
    if (!name) { setUsernameError('Enter the name other people will see at the table.'); return false; }
    if (name !== room.username) room.setUsername(name);
    setUsernameError(null);
    return true;
  }
  function openCreate() {
    if (!requireUsername()) return;
    setSelectedGame(room.gameType);
    setShowCreate(true);
  }
  async function listGames() {
    if (requireUsername() && await room.discover()) router.push('/games');
  }
  function closeCreate() { if (!creating) setShowCreate(false); }

  return <RoomScreen>
    <BrandHeader eyebrow="BY DRASO LABS" title="Card Room" />
    <View style={styles.hero}>
      <View style={styles.cardFan}>
        <View style={[styles.fanCard, styles.leftCard]}><PlayingCard card={{ suit: Suit.Clubs, rank: Rank.Seven }} /></View>
        <View style={[styles.fanCard, styles.rightCard]}><PlayingCard card={{ suit: Suit.Hearts, rank: Rank.Seven }} /></View>
        <View style={styles.centerCard}><PlayingCard card={{ suit: Suit.Spades, rank: Rank.Seven }} /></View>
      </View>
      <Text style={styles.heroTitle}>A table for every game.</Text>
      <Text style={styles.heroBody}>Host a table on your local network. No account, server, or internet connection required.</Text>
    </View>
    <ErrorBanner message={usernameError ?? room.error} />
    <RoomPanel>
      <RoomInput label="YOUR NAME" value={room.username} onChangeText={(value) => { room.setUsername(value); setUsernameError(null); }} maxLength={24} placeholder="Player" />
      <RoomButton label="Create room" variant="primary" disabled={room.busy || !room.sessionReady} onPress={openCreate} />
      <RoomButton label="List games" disabled={room.busy || !room.sessionReady} onPress={() => void listGames()} />
      {room.busy || !room.sessionReady ? <BusyIndicator /> : null}
    </RoomPanel>
    <Text style={styles.footer}>ANDROID + iOS · SAME WI-FI</Text>
    <Modal animationType="slide" transparent visible={showCreate} onRequestClose={closeCreate}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeCreate} />
        <KeyboardAwareScrollView style={styles.modalSheet} contentContainerStyle={styles.modalSheetContent}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bottomOffset={16}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(22, insets.bottom + 16) }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>OPEN A TABLE</Text>
            <Text style={styles.modalTitle}>Create room</Text>
            <Text style={styles.fieldLabel}>GAME</Text>
            <GamePicker value={selectedGame} onChange={setSelectedGame} disabled={creating} />
            <RoomInput label="LOBBY NAME" value={gameName} onChangeText={setGameName} maxLength={40} placeholder="The Green Table" editable={!creating} />
            <View style={styles.setup} pointerEvents={creating ? 'none' : 'auto'}>
              <RolePicker value={role} onChange={setRole} />
              <Setup gameName={gameName} participantName={room.username} role={role} onCancel={closeCreate}
                onCreated={() => { setShowCreate(false); router.push('/session'); }} />
            </View>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  </RoomScreen>;
}

const styles = StyleSheet.create({
  hero: { flex: 1, minHeight: 330, alignItems: 'center', justifyContent: 'center', gap: 10 },
  cardFan: { width: 240, height: 178, alignItems: 'center', justifyContent: 'flex-end' },
  fanCard: { position: 'absolute', bottom: 8 }, leftCard: { left: 38, transform: [{ rotate: '-12deg' }] },
  rightCard: { right: 38, transform: [{ rotate: '12deg' }] }, centerCard: { zIndex: 3 },
  heroTitle: { color: GameColors.white, fontSize: 29, lineHeight: 34, fontWeight: '700', textAlign: 'center', letterSpacing: -0.8 },
  heroBody: { color: GameColors.whiteMuted, textAlign: 'center', lineHeight: 21, maxWidth: 390 },
  footer: { color: GameColors.whiteMuted, fontSize: 10, letterSpacing: 2, textAlign: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,18,14,0.74)' },
  modalSheet: { width: '100%', maxHeight: '100%' }, modalSheetContent: { flexGrow: 1, justifyContent: 'flex-end' },
  modalCard: { width: '100%', maxWidth: 720, alignSelf: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: GameColors.panelSolid, borderColor: GameColors.border, borderWidth: 1, padding: 20, gap: 14 },
  modalHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: GameColors.whiteMuted, opacity: 0.45, alignSelf: 'center' },
  modalEyebrow: { color: GameColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  modalTitle: { color: GameColors.white, fontSize: 27, fontWeight: '700' },
  fieldLabel: { color: GameColors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  setup: { gap: 14 },
});
