import type { JsonValue, SessionSnapshot } from '@opengamesonline/expo-lan-multiplayer';
import { BotPlaystyle, GameStatus } from '@opengamesonline/sevens';
import { router } from 'expo-router';
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandHeader, BusyIndicator, ErrorBanner, RoomButton, RoomPanel, RoomScreen } from '@/components/room/room-ui';
import { GameColors } from '@/constants/theme';
import type { LobbyBase, ParticipantBase, StateBase } from './session-types';
import { GameHelpButton } from './help-ui';
import type { GameType } from './registry';

type Score = { playerId: string; playerName: string; points: number };
type Lobby = LobbyBase & { minPlayers: number; maxPlayers: number; roundsPlayed: number; latestScores: Score[]; cumulativeScores: Score[] };
type Controls<S, P extends JsonValue, L extends JsonValue> = {
  snapshot: SessionSnapshot<S, P, L> | null; busy: boolean; error: string | null; reconnecting: boolean;
  leave(): Promise<void>; start(): Promise<void>; addBot(style: BotPlaystyle): Promise<void>; removeBot(id: string): Promise<void>;
  retryConnection(): Promise<void>; removeDisconnectedParticipant(id: string): Promise<void>;
};

export function SessionShell<S extends StateBase, P extends JsonValue & ParticipantBase, L extends JsonValue & Lobby>({
  controls, gameType, gameName, summary, selectedVariant, cautiousBotDescription = 'Makes considered moves.', children,
}: { controls: Controls<S, P, L>; gameType: GameType; gameName: string; summary: string; selectedVariant?: string; cautiousBotDescription?: string; children(onLeave: () => void): ReactNode }) {
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
    <GameHelpButton gameType={gameType} selectedVariant={selectedVariant} gameInProgress />
    {children(confirmLeave)}
  </RoomScreen>;
  const lobby = snapshot.lobbyMetadata;
  const host = snapshot.role === 'host';
  const disconnected = snapshot.status !== 'connected';
  const latest = new Map(lobby?.latestScores.map((s) => [s.playerId, s.points]));
  const totals = new Map(lobby?.cumulativeScores.map((s) => [s.playerId, s.points]));
  const roster = [
    ...snapshot.participants.map((p) => ({ id: p.id, name: p.name, role: p.metadata.role, bot: false,
      playstyle: null, connected: snapshot.connectedParticipantIds.includes(p.id) })),
    ...(lobby?.bots ?? []).map((b) => ({ id: b.id, name: b.name, role: 'player' as const, bot: true, playstyle: b.playstyle, connected: true })),
  ];
  const showScores = (lobby?.roundsPlayed ?? 0) > 0;
  const players = roster.filter((p) => p.role === 'player');
  if (showScores) players.sort((a, b) => (totals.get(a.id) ?? 0) - (totals.get(b.id) ?? 0) || (latest.get(a.id) ?? 0) - (latest.get(b.id) ?? 0));
  const lobbyFull = Boolean(lobby && lobby.playerCount >= lobby.maxPlayers);
  const botOptions = [
    { value: BotPlaystyle.Random, label: 'Random', description: 'Chooses any valid move.' },
    { value: BotPlaystyle.Cautious, label: 'Cautious', description: cautiousBotDescription },
  ] as const;
  return <RoomScreen>
    <BrandHeader eyebrow={`${gameName.toUpperCase()} LOBBY`} title="The Table" />
    <ErrorBanner message={snapshot.error ?? error} />
    <GameHelpButton gameType={gameType} selectedVariant={selectedVariant} />
    <RoomPanel>
      <Text style={styles.title}>{disconnected ? 'Connection lost' : host ? 'You run this table.' : 'Waiting for the host.'}</Text>
      <Text style={styles.body}>{summary}</Text>
      <Text style={styles.capacity}>{lobby?.playerCount ?? 0}/{lobby?.maxPlayers ?? 0} players · {lobby?.spectatorCount ?? 0} watching</Text>
      {showScores ? <Text style={styles.hint}>Standings · last / total · lowest score first</Text> : null}
      <View style={styles.participantList}>
        {[...players, ...roster.filter((p) => p.role === 'spectator')].map((p) => <View key={p.id} style={styles.participant}>
          <View style={[styles.roleMark, p.bot && styles.botMark, p.role === 'spectator' && styles.spectatorMark]}>
            <Text style={styles.roleMarkText}>{p.bot ? 'B' : p.role === 'spectator' ? 'S' : 'P'}</Text>
          </View>
          <View style={styles.participantCopy}>
            <Text numberOfLines={1} style={styles.participantName}>{p.name}</Text>
            {p.bot ? <Text style={styles.botPlaystyle}>{p.playstyle?.toUpperCase()} BOT</Text> : <View style={styles.badges}>
              {p.id === snapshot.hostParticipantId ? <Text style={styles.badge}>HOST</Text> : null}
              {p.id === snapshot.self?.id ? <Text style={styles.badge}>YOU</Text> : null}
              {!p.connected ? <Text style={styles.offlineBadge}>OFFLINE</Text> : null}
            </View>}
          </View>
          {showScores && p.role === 'player' ? <Text style={styles.score}>{latest.get(p.id) ?? '—'} / {totals.get(p.id) ?? 0}</Text> : null}
          {host && !disconnected && (p.bot || (!p.connected && p.id !== snapshot.self?.id)) ?
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} disabled={busy}
              onPress={() => void (p.bot ? removeBot(p.id) : removeDisconnectedParticipant(p.id))} style={[styles.removeBot, busy && styles.disabled]}>
              <Text style={styles.removeBotText}>REMOVE</Text>
            </Pressable> : null}
        </View>)}
        {lobby?.cumulativeScores.filter((s) => !roster.some((p) => p.id === s.playerId)).map((s) => <View key={s.playerId} style={[styles.participant, styles.historicalParticipant]}>
          <View style={[styles.roleMark, styles.historicalMark]}><Text style={styles.roleMarkText}>P</Text></View>
          <View style={styles.participantCopy}><Text numberOfLines={1} style={styles.participantName}>{s.playerName}</Text><Text style={styles.botPlaystyle}>LEFT TABLE</Text></View>
          <Text style={styles.score}>{s.points} total</Text>
        </View>)}
      </View>
      {host && !disconnected ? <>
        <View style={styles.botControls}>
          <View><Text style={styles.botControlLabel}>ADD A BOT</Text><Text style={styles.botControlHint}>Choose how the next bot will play.</Text></View>
          <View style={styles.botOptions}>{botOptions.map((option) => {
            const selected = option.value === playstyle;
            return <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected, disabled: busy }} disabled={busy}
              onPress={() => setPlaystyle(option.value)} style={[styles.botOption, selected && styles.selectedBotOption, busy && styles.disabled]}>
              <Text style={[styles.botOptionName, selected && styles.selectedBotOptionName]}>{option.label}</Text>
              <Text style={styles.botOptionDescription}>{option.description}</Text>
            </Pressable>;
          })}</View>
          <RoomButton label={lobbyFull ? 'Player seats full' : `Add ${playstyle} bot`} compact
            disabled={busy || !lobby || lobbyFull} onPress={() => void addBot(playstyle)} />
        </View>
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
  hint: { color: GameColors.whiteMuted, fontSize: 11, marginTop: 3 },
  participantList: { gap: 7 },
  participant: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 12, paddingHorizontal: 11, backgroundColor: 'rgba(246,240,223,0.05)' },
  roleMark: { width: 30, height: 30, borderRadius: 15, backgroundColor: GameColors.gold, alignItems: 'center', justifyContent: 'center' },
  spectatorMark: { backgroundColor: GameColors.feltLight, borderWidth: 1, borderColor: GameColors.border },
  botMark: { backgroundColor: GameColors.creamMuted }, roleMarkText: { color: GameColors.feltDeep, fontWeight: '900' },
  participantCopy: { flex: 1, minWidth: 0 }, participantName: { color: GameColors.white, fontSize: 15, fontWeight: '600' },
  botPlaystyle: { color: GameColors.whiteMuted, fontSize: 9, fontWeight: '800', marginTop: 2 },
  historicalParticipant: { opacity: 0.66 }, historicalMark: { backgroundColor: GameColors.whiteMuted },
  score: { color: GameColors.white, fontSize: 14, fontWeight: '800' },
  removeBot: { width: 55, paddingVertical: 8, alignItems: 'flex-end' },
  removeBotText: { color: GameColors.danger, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  badges: { flexDirection: 'row', gap: 5, marginTop: 3 },
  badge: { color: GameColors.gold, borderColor: GameColors.goldDark, borderWidth: 1, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  offlineBadge: { color: GameColors.danger, borderColor: GameColors.danger, borderWidth: 1, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  botControls: { gap: 10, borderTopWidth: 1, borderTopColor: GameColors.border, paddingTop: 14 },
  botControlLabel: { color: GameColors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  botControlHint: { color: GameColors.whiteMuted, fontSize: 11, marginTop: 3 },
  botOptions: { flexDirection: 'row', gap: 8 },
  botOption: { flex: 1, borderRadius: 11, borderWidth: 1, borderColor: GameColors.border, padding: 9, backgroundColor: 'rgba(246,240,223,0.04)' },
  selectedBotOption: { borderColor: GameColors.gold, backgroundColor: 'rgba(215,174,90,0.13)' },
  botOptionName: { color: GameColors.creamMuted, fontSize: 13, fontWeight: '800' },
  selectedBotOptionName: { color: GameColors.gold },
  botOptionDescription: { color: GameColors.whiteMuted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  disabled: { opacity: 0.38 },
});
