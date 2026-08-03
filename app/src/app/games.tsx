import { router } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  BrandHeader,
  ErrorBanner,
  RolePicker,
  RoomButton,
  RoomInput,
  RoomPanel,
  RoomScreen,
} from '@/components/room/room-ui';
import { GameColors } from '@/constants/theme';
import {
  useSevensMultiplayer,
  type SevensDiscoveredGame,
  type SevensParticipantRole,
} from '@/features/multiplayer';

export default function GamesScreen() {
  const { busy, error, games, join, refresh, stop } = useSevensMultiplayer();
  const stopDiscovery = useEffectEvent(() => {
    void stop();
  });
  const [selectedGame, setSelectedGame] = useState<SevensDiscoveredGame | null>(null);
  const [participantName, setParticipantName] = useState('Player');
  const [role, setRole] = useState<SevensParticipantRole>('player');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => () => stopDiscovery(), []);

  const liveSelectedGame = selectedGame
    ? games.find(({ serviceId }) => serviceId === selectedGame.serviceId)
    : null;
  const playerFull = liveSelectedGame
    ? liveSelectedGame.lobbyMetadata.playerCount >= liveSelectedGame.lobbyMetadata.maxPlayers
    : false;

  function openJoin(game: SevensDiscoveredGame) {
    const full = game.lobbyMetadata.playerCount >= game.lobbyMetadata.maxPlayers;
    setSelectedGame(game);
    setRole(full ? 'spectator' : 'player');
    setFormError(null);
  }

  async function submitJoin() {
    if (!selectedGame) return;
    const currentGame = games.find(({ serviceId }) => serviceId === selectedGame.serviceId);
    if (!currentGame) {
      setFormError('This lobby is no longer available.');
      return;
    }
    const cleanName = participantName.trim();
    if (!cleanName) {
      setFormError('Enter the name other people will see at the table.');
      return;
    }
    if (role === 'player' && playerFull) {
      setFormError('Player seats are full. You can still join as a spectator.');
      return;
    }
    setFormError(null);
    const joined = await join({ game: currentGame, participantName: cleanName, role });
    if (joined) {
      setSelectedGame(null);
      router.replace('/session');
    }
  }

  async function goBack() {
    await stop();
    router.back();
  }

  return (
    <RoomScreen>
      <BrandHeader eyebrow="LOCAL TABLES" title="Nearby Games" />
      <ErrorBanner message={error} />

      <View style={styles.listHeader}>
        <Text style={styles.intro}>Choose a table discovered on this Wi-Fi network.</Text>
        <Pressable disabled={busy} onPress={() => void refresh()} style={styles.refresh}>
          <Text style={styles.refreshText}>REFRESH</Text>
        </Pressable>
      </View>

      {games.length === 0 ? (
        <RoomPanel style={styles.empty}>
          <ActivityIndicator color={GameColors.gold} />
          <Text style={styles.emptyTitle}>Listening for a host</Text>
          <Text style={styles.emptyBody}>
            Keep this screen open while another device creates a lobby.
          </Text>
        </RoomPanel>
      ) : (
        games.map((game) => {
          const full = game.lobbyMetadata.playerCount >= game.lobbyMetadata.maxPlayers;
          return (
            <Pressable key={game.serviceId} onPress={() => openJoin(game)}>
              {({ pressed }) => (
                <RoomPanel style={pressed ? styles.gamePressed : undefined}>
                  <View style={styles.gameRow}>
                    <View style={styles.gameMark}>
                      <Text style={styles.gameMarkText}>7</Text>
                    </View>
                    <View style={styles.gameInfo}>
                      <Text style={styles.gameName}>{game.name}</Text>
                      <Text style={styles.gameMeta}>
                        {game.lobbyMetadata.playerCount}/{game.lobbyMetadata.maxPlayers} PLAYERS ·{' '}
                        {game.lobbyMetadata.spectatorCount} WATCHING
                      </Text>
                    </View>
                    <Text style={styles.joinText}>{full ? 'WATCH' : 'JOIN'}</Text>
                  </View>
                </RoomPanel>
              )}
            </Pressable>
          );
        })
      )}

      <RoomButton label="Back" disabled={busy} onPress={() => void goBack()} />

      <Modal
        animationType="slide"
        transparent
        visible={selectedGame !== null}
        onRequestClose={() => setSelectedGame(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedGame(null)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>JOIN TABLE</Text>
            <Text style={styles.modalTitle}>{selectedGame?.name}</Text>
            <RoomInput
              label="YOUR NAME"
              value={participantName}
              onChangeText={setParticipantName}
              maxLength={24}
              placeholder="Player"
            />
            <RolePicker
              value={role}
              playerDisabled={playerFull}
              onChange={setRole}
            />
            <ErrorBanner message={formError ?? error} />
            <RoomButton
              label={busy ? 'Joining…' : role === 'player' ? 'Take a seat' : 'Watch game'}
              variant="primary"
              disabled={busy || (role === 'player' && playerFull)}
              onPress={() => void submitJoin()}
            />
            <RoomButton label="Cancel" disabled={busy} onPress={() => setSelectedGame(null)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </RoomScreen>
  );
}

const styles = StyleSheet.create({
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  intro: { flex: 1, color: GameColors.whiteMuted, lineHeight: 20 },
  refresh: { paddingHorizontal: 4, paddingVertical: 8 },
  refreshText: { color: GameColors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  empty: { minHeight: 210, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: GameColors.white, fontSize: 20, fontWeight: '700' },
  emptyBody: { color: GameColors.whiteMuted, textAlign: 'center', lineHeight: 20 },
  gamePressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  gameMark: {
    width: 43,
    height: 58,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GameColors.cream,
  },
  gameMarkText: { color: GameColors.red, fontSize: 24, fontWeight: '900' },
  gameInfo: { flex: 1, gap: 4 },
  gameName: { color: GameColors.white, fontSize: 18, fontWeight: '700' },
  gameMeta: { color: GameColors.whiteMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  joinText: { color: GameColors.gold, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,18,14,0.74)' },
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
});
