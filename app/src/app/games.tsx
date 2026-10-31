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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { useCardRoom } from '@/features/card-room/room-provider';
import { filterRooms, GAME_INFO, GAME_TYPES, roomDetail, roomGameType, type DiscoveredRoom, type GameType } from '@/features/card-room/registry';

export default function GamesScreen() {
  const insets = useSafeAreaInsets();
  const { busy, error, games, requestJoin, refresh, stop, username } = useCardRoom();
  const stopDiscovery = useEffectEvent(() => {
    void stop();
  });
  const [selectedGame, setSelectedGame] = useState<DiscoveredRoom | null>(null);
  const [role, setRole] = useState<'player' | 'spectator'>('player');
  const [filter, setFilter] = useState<GameType | 'all'>('all');
  const [query, setQuery] = useState('');
  const visibleGames = filterRooms(games, filter, query);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => () => stopDiscovery(), []);

  const liveSelectedGame = selectedGame
    ? games.find(({ serviceId }) => serviceId === selectedGame.serviceId)
    : null;
  const playerFull = liveSelectedGame
    ? liveSelectedGame.lobbyMetadata.playerCount >= liveSelectedGame.lobbyMetadata.maxPlayers
    : false;

  function openJoin(game: DiscoveredRoom) {
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
    const cleanName = username.trim();
    if (!cleanName) {
      setFormError('Enter the name other people will see at the table.');
      return;
    }
    if (role === 'player' && playerFull) {
      setFormError('Player seats are full. You can still join as a spectator.');
      return;
    }
    setFormError(null);
    try {
      await requestJoin({ game: currentGame, participantName: cleanName, role });
      setSelectedGame(null);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not open the room');
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
      <View style={styles.filters}>{(['all', ...GAME_TYPES] as const).map((type) => (
        <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected: type === filter }} onPress={() => setFilter(type)}>
          <Text style={[styles.filter, type === filter && styles.selectedFilter]}>{type === 'all' ? 'All games' : GAME_INFO[type].name}</Text>
        </Pressable>
      ))}</View>

      <View style={styles.listHeader}>
        <Text style={styles.intro}>Choose a table discovered on this Wi-Fi network.</Text>
        <Pressable disabled={busy} onPress={() => void refresh()} style={styles.refresh}>
          <Text style={styles.refreshText}>REFRESH</Text>
        </Pressable>
      </View>

      <RoomInput label="SEARCH ROOMS" value={query} onChangeText={setQuery} placeholder="Room name" maxLength={80} />
      {visibleGames.length === 0 ? (
        <RoomPanel style={styles.empty}>
          <ActivityIndicator color={GameColors.gold} />
          <Text style={styles.emptyTitle}>Listening for a host</Text>
          <Text style={styles.emptyBody}>
            Keep this screen open while another device creates a lobby.
          </Text>
        </RoomPanel>
      ) : (
         visibleGames.map((game) => {
          const full = game.lobbyMetadata.playerCount >= game.lobbyMetadata.maxPlayers;
          return (
            <Pressable key={game.serviceId} onPress={() => openJoin(game)}>
              {({ pressed }) => (
                <RoomPanel style={pressed ? styles.gamePressed : undefined}>
                  <View style={styles.gameRow}>
                    <View style={styles.gameMark}>
                      <Text style={styles.gameMarkText}>{GAME_INFO[roomGameType(game.lobbyMetadata)!].mark}</Text>
                    </View>
                    <View style={styles.gameInfo}>
                      <Text style={styles.gameName}>{game.name}</Text>
                      <Text style={styles.gameMeta}>
                        {game.lobbyMetadata.playerCount}/{game.lobbyMetadata.maxPlayers} PLAYERS ·{' '}
                        {game.lobbyMetadata.bots.length} BOTS ·{' '}
                        {game.lobbyMetadata.spectatorCount} WATCHING
                      </Text>
                      <Text style={styles.hintMeta}>
                        {roomDetail(game.lobbyMetadata)}
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
          <View
            style={[
              styles.modalCard,
              { paddingBottom: Math.max(22, insets.bottom + 16) },
            ]}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalEyebrow}>JOIN TABLE</Text>
            <Text style={styles.modalTitle}>{selectedGame?.name}</Text>
            <View style={styles.identityRow}>
              <Text style={styles.identityLabel}>PLAYING AS</Text>
              <Text style={styles.identityName}>{username.trim()}</Text>
            </View>
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  filter: { color: GameColors.whiteMuted, paddingVertical: 10, fontWeight: '700' },
  selectedFilter: { color: GameColors.gold },
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
  hintMeta: { color: GameColors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
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
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(246,240,223,0.06)',
  },
  identityLabel: { color: GameColors.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  identityName: { color: GameColors.cream, fontSize: 16, fontWeight: '700' },
});
