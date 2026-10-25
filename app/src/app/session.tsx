import { BotPlaystyle, GameStatus, SevensVariant } from '@opengamesonline/sevens';
import type { Participant } from '@opengamesonline/expo-lan-multiplayer';
import { router } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

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
import type {
  SevensBot,
  SevensParticipantMetadata,
} from '@/features/multiplayer';
import { sortByLobbyStandings } from '@/features/multiplayer/presentation';

const botPlaystyles = [
  {
    value: BotPlaystyle.Random,
    label: 'Random',
    description: 'Chooses any valid move.',
  },
  {
    value: BotPlaystyle.Cautious,
    label: 'Cautious',
    description: 'Keeps useful runs for itself.',
  },
] as const;

export default function SessionScreen() {
  const {
    addBot,
    busy,
    continueGame,
    error,
    leave,
    reconnecting,
    removeBot,
    removeDisconnectedParticipant,
    retryConnection,
    send,
    sending,
    snapshot,
    start,
  } = useSevensMultiplayer();
  const [botPlaystyle, setBotPlaystyle] = useState(BotPlaystyle.Random);

  async function leaveSession() {
    await leave();
    router.replace('/');
  }

  function confirmLeave() {
    const isHost = snapshot?.role === 'host';
    const endsTable =
      snapshot?.phase !== 'lobby' &&
      (isHost || snapshot?.state?.status === GameStatus.Active);
    Alert.alert(
      'Leave this table?',
      endsTable
        ? 'Leaving ends the game for everyone.'
        : isHost
          ? 'Leaving closes the table for everyone.'
          : 'Leaving permanently gives up your reserved seat and recovery identity.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
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

  if (snapshot.status === 'left') {
    return (
      <RoomScreen>
        <BrandHeader eyebrow="TABLE CLOSED" title="The game has ended" />
        <ErrorBanner message={snapshot.error ?? error} />
        <RoomPanel style={styles.centered}>
          <Text style={styles.waitTitle}>This table is no longer active.</Text>
          <Text style={styles.waitBody}>Return home to create or find another local game.</Text>
        </RoomPanel>
        <RoomButton label="Back to home" onPress={() => void leaveSession()} />
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
          continuePending={busy || sending}
          reconnecting={reconnecting}
          onContinue={continueGame}
          onRetryConnection={retryConnection}
          onSend={send}
          onLeave={() => void leaveSession()}
        />
      </RoomScreen>
    );
  }

  const lobby = snapshot.lobbyMetadata;
  const isHost = snapshot.role === 'host';
  const canStart = Boolean(lobby && lobby.playerCount >= lobby.minPlayers);
  const disconnected = snapshot.status === 'disconnected' || snapshot.status === 'reconnecting';
  const lobbyFull = Boolean(lobby && lobby.playerCount >= lobby.maxPlayers);
  const latestPoints = new Map(
    lobby?.latestScores.map(({ playerId, points }) => [playerId, points]) ?? [],
  );
  const cumulativePoints = new Map(
    lobby?.cumulativeScores.map(({ playerId, points }) => [playerId, points]) ?? [],
  );
  const currentPlayerIds = new Set([
    ...snapshot.participants.map(({ id }) => id),
    ...(lobby?.bots.map(({ id }) => id) ?? []),
  ]);
  const historicalScores = [...(lobby?.cumulativeScores ?? [])].filter(
    ({ playerId }) => !currentPlayerIds.has(playerId),
  );
  const showScores = Boolean(lobby && lobby.roundsPlayed > 0);
  const showBotActions = !disconnected && isHost;
  const humanPlayers = snapshot.participants.filter(
    ({ metadata }) => metadata.role === 'player',
  );
  const spectators = snapshot.participants.filter(
    ({ metadata }) => metadata.role !== 'player',
  );
  const scoringRows = showScores
    ? sortByLobbyStandings(
        [...humanPlayers, ...(lobby?.bots ?? [])],
        (row) => row.id,
        latestPoints,
        cumulativePoints,
      )
    : [...humanPlayers, ...(lobby?.bots ?? [])];
  const sortedHistoricalScores = showScores
    ? sortByLobbyStandings(
        historicalScores,
        (score) => score.playerId,
        latestPoints,
        cumulativePoints,
      )
    : historicalScores;
  const session = snapshot;

  function scoreCells(playerId: string, eligible: boolean) {
    if (!showScores) return null;
    return (
      <View style={styles.scoreColumns}>
        <Text style={styles.standingPoints}>
          {eligible ? latestPoints.get(playerId) ?? '—' : '—'}
        </Text>
        <Text style={styles.standingPoints}>
          {eligible ? cumulativePoints.get(playerId) ?? 0 : '—'}
        </Text>
      </View>
    );
  }

  function renderParticipantRow(participant: Participant<SevensParticipantMetadata>) {
    const isSelf = participant.id === session.self?.id;
    const isParticipantHost = participant.id === session.hostParticipantId;
    const isPlayer = participant.metadata.role === 'player';
    const isConnected = session.connectedParticipantIds.includes(participant.id);
    const canRemove = showBotActions && !isConnected && !isSelf;
    return (
      <View key={participant.id} style={styles.participant}>
        <View
          style={[
            styles.roleMark,
            participant.metadata.role === 'spectator' && styles.spectatorMark,
          ]}
        >
          <Text style={styles.roleMarkText}>
            {isPlayer ? 'P' : 'S'}
          </Text>
        </View>
        <View style={styles.participantCopy}>
          <Text style={styles.participantName}>{participant.name}</Text>
          <View style={styles.badges}>
            {isParticipantHost ? <Text style={styles.badge}>HOST</Text> : null}
            {isSelf ? <Text style={styles.badge}>YOU</Text> : null}
            {!isConnected ? <Text style={styles.offlineBadge}>OFFLINE</Text> : null}
          </View>
        </View>
        {scoreCells(participant.id, isPlayer)}
        {canRemove ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void removeDisconnectedParticipant(participant.id)}
            style={styles.removeBot}
          >
            <Text style={styles.removeBotText}>REMOVE</Text>
          </Pressable>
        ) : showBotActions && showScores ? (
          <View style={styles.rowActionSpace} />
        ) : null}
      </View>
    );
  }

  function renderBotRow(bot: SevensBot) {
    return (
      <View key={bot.id} style={styles.participant}>
        <View style={[styles.roleMark, styles.botMark]}>
          <Text style={styles.roleMarkText}>B</Text>
        </View>
        <View style={styles.participantCopy}>
          <Text style={styles.participantName}>{bot.name}</Text>
          <Text style={styles.botPlaystyle}>{bot.playstyle.toUpperCase()} BOT</Text>
        </View>
        {scoreCells(bot.id, true)}
        {showBotActions ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void removeBot(bot.id)}
            style={styles.removeBot}
          >
            <Text style={styles.removeBotText}>REMOVE</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <RoomScreen>
      <BrandHeader eyebrow="GAME LOBBY" title="The Table" />
      <ErrorBanner message={snapshot.error ?? error} />

      <RoomPanel>
        <View style={styles.lobbyHeader}>
          <View style={styles.headerCopy}>
            <Text style={styles.lobbyTitle}>
              {disconnected
                  ? reconnecting ? 'Recovering the table.' : 'Connection lost.'
                : isHost
                  ? 'You run this table.'
                  : 'Waiting for the host.'}
            </Text>
            <Text style={styles.waitBody}>
              {disconnected
                  ? 'Your seat and scores are reserved while recovery runs.'
                : isHost
                  ? 'Add bots or wait for players, then start with at least three seats filled.'
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

        {showScores && lobby ? (
          <View style={styles.rosterHeader}>
            <View style={styles.rosterHeaderCopy}>
              <Text style={styles.rosterLabel}>PLAYERS & STANDINGS</Text>
              <Text style={styles.rosterHint}>
                {lobby.roundsPlayed} round{lobby.roundsPlayed === 1 ? '' : 's'} · low score wins
              </Text>
            </View>
            <View style={styles.scoreColumns}>
              <Text style={styles.scoreColumnLabel}>LAST</Text>
              <Text style={styles.scoreColumnLabel}>TOTAL</Text>
            </View>
            {showBotActions ? <View style={styles.rowActionSpace} /> : null}
          </View>
        ) : null}

        <View style={styles.participantList}>
          {scoringRows.map((row) =>
            'playstyle' in row ? renderBotRow(row) : renderParticipantRow(row),
          )}
          {spectators.map((participant) => renderParticipantRow(participant))}
          {sortedHistoricalScores.map((score) => (
            <View key={score.playerId} style={[styles.participant, styles.historicalParticipant]}>
              <View style={[styles.roleMark, styles.historicalMark]}>
                <Text style={styles.roleMarkText}>P</Text>
              </View>
              <View style={styles.participantCopy}>
                <Text style={styles.participantName}>{score.playerName}</Text>
                <Text style={styles.historicalLabel}>LEFT TABLE</Text>
              </View>
              {scoreCells(score.playerId, true)}
              {showBotActions && showScores ? <View style={styles.rowActionSpace} /> : null}
            </View>
          ))}
        </View>

        {!disconnected && isHost ? (
          <View style={styles.botControls}>
            <View>
              <Text style={styles.botControlLabel}>ADD A BOT</Text>
              <Text style={styles.botControlHint}>Choose how the next bot will play.</Text>
            </View>
            <View style={styles.botOptions}>
              {botPlaystyles.map((option) => {
                const selected = option.value === botPlaystyle;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setBotPlaystyle(option.value)}
                    style={[styles.botOption, selected && styles.selectedBotOption]}
                  >
                    <Text style={[styles.botOptionName, selected && styles.selectedBotOptionName]}>
                      {option.label}
                    </Text>
                    <Text style={styles.botOptionDescription}>{option.description}</Text>
                  </Pressable>
                );
              })}
            </View>
            <RoomButton
              label={lobbyFull ? 'Player seats full' : `Add ${botPlaystyle} bot`}
              compact
              disabled={busy || lobbyFull}
              onPress={() => void addBot(botPlaystyle)}
            />
          </View>
        ) : null}

        {lobby ? (
          <Text style={styles.lobbySummary}>
            {lobby.playerCount >= lobby.minPlayers
              ? 'Ready to deal'
              : `Need ${lobby.minPlayers - lobby.playerCount} more player${lobby.minPlayers - lobby.playerCount === 1 ? '' : 's'}`}
            {' · '}
            {lobby.spectatorCount} watching
            {' · '}
            {lobby.bots.length} bot{lobby.bots.length === 1 ? '' : 's'}
            {' · '}
            {lobby.variant === SevensVariant.Joker ? 'joker' : 'standard'}
            {' · '}
            hints {lobby.showPlayableCards ? 'on' : 'off'}
            {' · '}
            draws {lobby.preventIllegalDraw ? 'locked' : 'free'}
          </Text>
        ) : null}

        {!disconnected && isHost ? (
          <RoomButton
            label={busy ? 'Starting…' : lobby && lobby.roundsPlayed > 0 ? 'Start next round' : 'Start game'}
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
        {disconnected ? (
          <RoomButton
            label={reconnecting ? 'Recovering…' : 'Retry connection'}
            disabled={reconnecting || busy}
            onPress={() => void retryConnection()}
          />
        ) : null}
      </RoomPanel>

      <RoomButton
        label={isHost ? 'Close lobby' : 'Leave lobby'}
        variant="danger"
        disabled={busy}
        onPress={confirmLeave}
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
  botMark: { backgroundColor: GameColors.creamMuted },
  roleMarkText: { color: GameColors.feltDeep, fontWeight: '900' },
  participantCopy: { flex: 1, minWidth: 0 },
  participantName: { color: GameColors.white, fontSize: 15, fontWeight: '600' },
  botPlaystyle: { color: GameColors.whiteMuted, fontSize: 9, fontWeight: '800', marginTop: 2 },
  historicalParticipant: { opacity: 0.66 },
  historicalMark: { backgroundColor: GameColors.whiteMuted },
  historicalLabel: { color: GameColors.whiteMuted, fontSize: 8, fontWeight: '800', marginTop: 2 },
  removeBot: { width: 55, paddingVertical: 8, alignItems: 'flex-end' },
  removeBotText: { color: GameColors.danger, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  rowActionSpace: { width: 55 },
  badges: { flexDirection: 'row', gap: 5, marginTop: 3 },
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
  offlineBadge: {
    color: GameColors.danger,
    borderColor: GameColors.danger,
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  lobbySummary: { color: GameColors.creamMuted, textAlign: 'center', fontSize: 13 },
  rosterHeader: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10 },
  rosterHeaderCopy: { flex: 1 },
  rosterLabel: { color: GameColors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  rosterHint: { color: GameColors.whiteMuted, fontSize: 10, marginTop: 3 },
  scoreColumns: { width: 92, flexDirection: 'row', justifyContent: 'space-between' },
  scoreColumnLabel: { width: 42, color: GameColors.whiteMuted, fontSize: 8, fontWeight: '900', textAlign: 'right' },
  standingPoints: { width: 42, color: GameColors.white, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  botControls: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: GameColors.border,
    paddingTop: 14,
  },
  botControlLabel: { color: GameColors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  botControlHint: { color: GameColors.whiteMuted, fontSize: 11, marginTop: 3 },
  botOptions: { flexDirection: 'row', gap: 8 },
  botOption: {
    flex: 1,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: GameColors.border,
    padding: 9,
    backgroundColor: 'rgba(246,240,223,0.04)',
  },
  selectedBotOption: {
    borderColor: GameColors.gold,
    backgroundColor: 'rgba(215,174,90,0.13)',
  },
  botOptionName: { color: GameColors.creamMuted, fontSize: 13, fontWeight: '800' },
  selectedBotOptionName: { color: GameColors.gold },
  botOptionDescription: { color: GameColors.whiteMuted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  hostWait: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 9, padding: 10 },
  hostWaitText: { color: GameColors.whiteMuted, fontSize: 13 },
});
