import type { JsonValue, SessionSnapshot } from '@opengamesonline/expo-lan-multiplayer';
import { BotPlaystyle, GameStatus } from '@opengamesonline/sevens';
import { router } from 'expo-router';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, BusyIndicator, ErrorBanner, RoomButton, RoomPanel, RoomScreen } from '@/components/room/room-ui';
import { GameColors } from '@/constants/theme';
import type { LobbyBase, ParticipantBase, StateBase } from './session-types';

type Score = { playerId: string; playerName: string; points: number };
type Lobby = LobbyBase & { minPlayers: number; maxPlayers: number; roundsPlayed: number; latestScores: Score[]; cumulativeScores: Score[] };
type Controls<S, P extends JsonValue, L extends JsonValue> = {
  snapshot: SessionSnapshot<S, P, L> | null; busy: boolean; error: string | null; reconnecting: boolean;
  leave(): Promise<void>; start(): Promise<void>; addBot(style: BotPlaystyle): Promise<void>; removeBot(id: string): Promise<void>;
  retryConnection(): Promise<void>; removeDisconnectedParticipant(id: string): Promise<void>;
};

export function SessionShell<S extends StateBase, P extends JsonValue & ParticipantBase, L extends JsonValue & Lobby>({
  controls, gameName, summary, children,
}: { controls: Controls<S, P, L>; gameName: string; summary: string; children(onLeave: () => void): ReactNode }) {
  const { snapshot, busy, error, reconnecting, leave, start, addBot, removeBot, retryConnection, removeDisconnectedParticipant } = controls;
  const [playstyle, setPlaystyle] = useState(BotPlaystyle.Cautious);
  async function leaveSession() { await leave(); router.replace('/'); }
  function confirmLeave() {
    const active = snapshot?.phase === 'started' && snapshot.state?.status === GameStatus.Active && snapshot.self?.metadata.role === 'player';
    Alert.alert('Leave this table?', active ? 'Leaving ends the game for everyone.' : snapshot?.role === 'host'
      ? 'Leaving closes the table for everyone.' : 'Leaving gives up your seat and recovery identity.', [
      { text: 'Stay', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => void leaveSession() },
    ]);
  }
  const back = useEffectEvent(confirmLeave);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => subscription.remove();
  }, []);
  if (!snapshot) return <RoomScreen>
    <BrandHeader eyebrow={gameName.toUpperCase()} title="Connecting" />
    <ErrorBanner message={error} />
    {busy ? <BusyIndicator /> : null}
    <Text style={styles.body}>{error ? 'Could not open the table. Return home and try again.' : 'Setting the table…'}</Text>
    <RoomButton label="Back to home" onPress={() => void leaveSession()} />
  </RoomScreen>;
  if (snapshot.status === 'left') return <RoomScreen>
    <BrandHeader eyebrow="TABLE CLOSED" title="The game has ended" />
    <ErrorBanner message={snapshot.error ?? error} />
    <RoomButton label="Back to home" onPress={() => void leaveSession()} />
  </RoomScreen>;
  if (snapshot.phase === 'started') return <RoomScreen>
    <ErrorBanner message={snapshot.error ?? error} />
    {children(confirmLeave)}
  </RoomScreen>;
  const lobby = snapshot.lobbyMetadata;
  const host = snapshot.role === 'host';
  const disconnected = snapshot.status !== 'connected';
  const latest = new Map(lobby?.latestScores.map((s) => [s.playerId, s.points]));
  const totals = new Map(lobby?.cumulativeScores.map((s) => [s.playerId, s.points]));
  const roster = [
    ...snapshot.participants.map((p) => ({ id: p.id, name: p.name, role: p.metadata.role, bot: false,
      connected: snapshot.connectedParticipantIds.includes(p.id) })),
    ...(lobby?.bots ?? []).map((b) => ({ id: b.id, name: `${b.name} · ${b.playstyle}`, role: 'player' as const, bot: true, connected: true })),
  ];
  const showScores = (lobby?.roundsPlayed ?? 0) > 0;
  const players = roster.filter((p) => p.role === 'player');
  if (showScores) players.sort((a, b) => (totals.get(a.id) ?? 0) - (totals.get(b.id) ?? 0) || (latest.get(a.id) ?? 0) - (latest.get(b.id) ?? 0));
  return <RoomScreen>
    <BrandHeader eyebrow={`${gameName.toUpperCase()} LOBBY`} title="The Table" />
    <ErrorBanner message={snapshot.error ?? error} />
    <RoomPanel>
      <Text style={styles.title}>{disconnected ? 'Connection lost' : host ? 'You run this table.' : 'Waiting for the host.'}</Text>
      <Text style={styles.body}>{summary}</Text>
      <Text style={styles.capacity}>{lobby?.playerCount ?? 0}/{lobby?.maxPlayers ?? 0} players · {lobby?.spectatorCount ?? 0} watching</Text>
      {showScores ? <Text style={styles.hint}>Standings · last / total · lowest score first</Text> : null}
      {[...players, ...roster.filter((p) => p.role === 'spectator')].map((p) => <View key={p.id} style={styles.row}>
        <View style={styles.grow}>
          <Text style={styles.name}>{p.name}{p.id === snapshot.self?.id ? ' · YOU' : ''}{p.id === snapshot.hostParticipantId ? ' · HOST' : ''}</Text>
          <Text style={styles.hint}>{p.bot ? 'BOT' : p.role.toUpperCase()}{!p.connected ? ' · OFFLINE' : ''}</Text>
        </View>
        {showScores && p.role === 'player' ? <Text style={styles.name}>{latest.get(p.id) ?? '—'} / {totals.get(p.id) ?? 0}</Text> : null}
        {host && !disconnected && (p.bot || (!p.connected && p.id !== snapshot.self?.id)) ?
          <RoomButton compact label="Remove" disabled={busy} onPress={() => void (p.bot ? removeBot(p.id) : removeDisconnectedParticipant(p.id))} /> : null}
      </View>)}
      {lobby?.cumulativeScores.filter((s) => !roster.some((p) => p.id === s.playerId)).map((s) => <Text key={s.playerId} style={styles.hint}>{s.playerName} · LEFT TABLE · {s.points} total</Text>)}
      {host && !disconnected ? <>
        <Text style={styles.hint}>Bot strategy</Text>
        <View style={styles.row}>{Object.values(BotPlaystyle).map((style) => <RoomButton key={style} compact
          label={`${style === playstyle ? '✓ ' : ''}${style}`} disabled={busy} onPress={() => setPlaystyle(style)} />)}</View>
        <RoomButton label="Add bot" disabled={busy || !lobby || lobby.playerCount >= lobby.maxPlayers} onPress={() => void addBot(playstyle)} />
        <RoomButton label={busy ? 'Starting…' : 'Deal cards'} variant="primary" disabled={busy || !lobby || lobby.playerCount < lobby.minPlayers || players.some((p) => !p.connected)} onPress={() => void start()} />
      </> : null}
      {disconnected ? <RoomButton label={reconnecting ? 'Recovering…' : 'Retry connection'} disabled={busy || reconnecting} onPress={() => void retryConnection()} /> : null}
      {busy ? <BusyIndicator /> : null}
    </RoomPanel>
    <RoomButton label={host ? 'Close room' : 'Leave room'} variant="danger" disabled={busy} onPress={confirmLeave} />
  </RoomScreen>;
}
const styles = StyleSheet.create({
  title: { color: GameColors.cream, fontSize: 25, fontWeight: '700' }, body: { color: GameColors.whiteMuted, lineHeight: 21 },
  capacity: { color: GameColors.gold, fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }, grow: { flex: 1 },
  name: { color: GameColors.cream, fontSize: 15 }, hint: { color: GameColors.whiteMuted, fontSize: 11, marginTop: 3 },
});
