import { SevensVariant } from '@opengamesonline/sevens';
import { router } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';

import { GameTable } from '@/components/game/game-table';
import {
  BrandHeader,
  BusyIndicator,
  ErrorBanner,
  RoomButton,
  RoomPanel,
  RoomScreen,
} from '@/components/room/room-ui';
import { GameColors } from '@/constants/theme';
import { useSevensMultiplayer } from '@/features/multiplayer';

export default function SessionScreen() {
  const { busy, error, leave, send, sending, snapshot, start } = useSevensMultiplayer();

  async function leaveSession() {
    await leave();
    router.replace('/');
  }

  function confirmLeave() {
    const isHost = snapshot?.role === 'host';
    Alert.alert(
      isHost ? 'Close this table?' : 'Leave this table?',
      isHost
        ? 'The lobby or game will end for everyone.'
        : 'You will not be able to reconnect to this game.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: isHost ? 'Close table' : 'Leave',
          style: 'destructive',
          onPress: () => void leaveSession(),
        },
      ],
    );
  }

  const handleHardwareBack = useEffectEvent(() => {
    confirmLeave();
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleHardwareBack();
      return true;
    });
    return () => subscription.remove();
  }, []);

  if (!snapshot) {
    return (
      <RoomScreen>
        <BrandHeader eyebrow="LOCAL CARD ROOM" title="Connecting" />
        <ErrorBanner message={error} />
        <RoomPanel style={styles.centered}>
          {busy ? <BusyIndicator /> : null}
          <Text style={styles.waitTitle}>{error ? 'Could not open the table' : 'Setting the table'}</Text>
          <Text style={styles.waitBody}>
            {error ? 'Return home and try again.' : 'Waiting for the local session to respond.'}
          </Text>
        </RoomPanel>
        <RoomButton label="Back to home" onPress={() => router.replace('/')} />
      </RoomScreen>
    );
  }

  if (snapshot.phase === 'started') {
    return (
      <RoomScreen>
        <ErrorBanner message={snapshot.error ?? error} />
        <GameTable
          snapshot={snapshot}
          actionPending={sending}
          onSend={send}
          onLeave={confirmLeave}
        />
      </RoomScreen>
    );
  }

  const lobby = snapshot.lobbyMetadata;
  const isHost = snapshot.role === 'host';
  const canStart = Boolean(lobby && lobby.playerCount >= lobby.minPlayers);
  const disconnected = snapshot.status === 'disconnected' || snapshot.status === 'left';

  return (
    <RoomScreen>
      <BrandHeader eyebrow="GAME LOBBY" title="The Table" />
      <ErrorBanner message={snapshot.error ?? error} />

      <RoomPanel>
        <View style={styles.lobbyHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.lobbyTitle}>
              {disconnected
                ? 'The table closed.'
                : isHost
                  ? 'You run this table.'
                  : 'Waiting for the host.'}
            </Text>
            <Text style={styles.waitBody}>
              {disconnected
                ? 'Return home to create or find another game.'
                : isHost
                  ? 'Start when at least three players have taken a seat.'
                  : 'The cards will be dealt when the host starts.'}
            </Text>
          </View>
          {lobby ? (
            <View style={styles.capacity}>
              <Text style={styles.capacityValue}>
                {lobby.playerCount}/{lobby.maxPlayers}
              </Text>
              <Text style={styles.capacityLabel}>PLAYERS</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.participantList}>
          {snapshot.participants.map((participant) => {
            const isSelf = participant.id === snapshot.self?.id;
            const isParticipantHost = participant.slot === 0;
            return (
              <View key={participant.id} style={styles.participant}>
                <View
                  style={[
                    styles.roleMark,
                    participant.metadata.role === 'spectator' && styles.spectatorMark,
                  ]}
                >
                  <Text style={styles.roleMarkText}>
                    {participant.metadata.role === 'player' ? 'P' : 'S'}
                  </Text>
                </View>
                <Text style={styles.participantName}>{participant.name}</Text>
                <View style={styles.badges}>
                  {isParticipantHost ? <Text style={styles.badge}>HOST</Text> : null}
                  {isSelf ? <Text style={styles.badge}>YOU</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        {lobby ? (
          <Text style={styles.lobbySummary}>
            {lobby.playerCount >= lobby.minPlayers
              ? 'Ready to deal'
              : `Need ${lobby.minPlayers - lobby.playerCount} more player${lobby.minPlayers - lobby.playerCount === 1 ? '' : 's'}`}
            {' · '}
            {lobby.spectatorCount} watching
            {' · '}
            {lobby.variant === SevensVariant.Joker ? 'joker' : 'standard'}
            {' · '}
            hints {lobby.showPlayableCards ? 'on' : 'off'}
          </Text>
        ) : null}

        {!disconnected && isHost ? (
          <RoomButton
            label={busy ? 'Starting…' : 'Start game'}
            variant="primary"
            disabled={busy || !canStart}
            onPress={() => void start()}
          />
        ) : null}
        {!disconnected && !isHost ? (
          <View style={styles.hostWait}>
            <BusyIndicator />
            <Text style={styles.hostWaitText}>Host controls the deal</Text>
          </View>
        ) : null}
      </RoomPanel>

      <RoomButton
        label={disconnected ? 'Back to home' : isHost ? 'Close lobby' : 'Leave lobby'}
        variant={disconnected ? 'secondary' : 'danger'}
        disabled={busy}
        onPress={disconnected ? () => void leaveSession() : confirmLeave}
      />
    </RoomScreen>
  );
}

const styles = StyleSheet.create({
  centered: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  waitTitle: { color: GameColors.white, fontSize: 21, fontWeight: '700' },
  waitBody: { color: GameColors.whiteMuted, lineHeight: 20 },
  lobbyHeader: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  headerCopy: { flex: 1, gap: 5 },
  lobbyTitle: { color: GameColors.white, fontSize: 23, fontWeight: '700' },
  capacity: { alignItems: 'center', minWidth: 72 },
  capacityValue: { color: GameColors.gold, fontSize: 25, fontWeight: '800' },
  capacityLabel: { color: GameColors.whiteMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  participantList: { gap: 7 },
  participant: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 12,
    paddingHorizontal: 11,
    backgroundColor: 'rgba(246,240,223,0.05)',
  },
  roleMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GameColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spectatorMark: { backgroundColor: GameColors.feltLight, borderWidth: 1, borderColor: GameColors.border },
  roleMarkText: { color: GameColors.feltDeep, fontWeight: '900' },
  participantName: { flex: 1, color: GameColors.white, fontSize: 15, fontWeight: '600' },
  badges: { flexDirection: 'row', gap: 5 },
  badge: {
    color: GameColors.gold,
    borderColor: GameColors.goldDark,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  lobbySummary: { color: GameColors.creamMuted, textAlign: 'center', fontSize: 13 },
  hostWait: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, padding: 10 },
  hostWaitText: { color: GameColors.whiteMuted, fontSize: 13 },
});
