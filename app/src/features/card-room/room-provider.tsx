import { LanMultiplayer } from '@opengamesonline/expo-lan-multiplayer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { isGameType, isRoomLobby, roomGameType, type DiscoveredRoom, type GameOptions, type GameType, type RoomLobby } from './registry';

export type PendingJoin = { game: DiscoveredRoom; participantName: string; role: 'player' | 'spectator' };
export type PendingCreate<K extends GameType = GameType> = { gameType: K; options: GameOptions<K>; onCreated(): void };
type RoomContext = {
  ready: boolean; gameType: GameType; selectGame(game: GameType): Promise<void>;
  username: string; setUsername(value: string): void;
  games: readonly DiscoveredRoom[]; busy: boolean; error: string | null;
  clearError(): void;
  discover(): Promise<boolean>; refresh(): Promise<void>; stop(): Promise<void>;
  requestJoin(options: PendingJoin): Promise<void>; pendingJoin: PendingJoin | null; consumeJoin(): void;
  requestCreate<K extends GameType>(options: PendingCreate<K>): Promise<void>; pendingCreate: PendingCreate | null; consumeCreate(): void;
  setHasSession(value: boolean): void;
  sessionReady: boolean; setSessionReady(value: boolean): void;
};
const Context = createContext<RoomContext | null>(null);
const SELECTION_KEY = 'cardroom.selected-game.v1';

export function CardRoomProvider({ children }: { children: ReactNode }) {
  const [gameType, setGameType] = useState<GameType>('sevens');
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState('Player');
  const [games, setGames] = useState<DiscoveredRoom[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingJoin, setPendingJoin] = useState<PendingJoin | null>(null);
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const multiplayer = useRef<LanMultiplayer<null, RoomLobby> | null>(null);
  const activeSession = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    let mounted = true;
    const transport = new LanMultiplayer<null, RoomLobby>();
    multiplayer.current = transport;
    const unsubscribe = transport.subscribeToGames((found) => {
      if (mounted) setGames(found.filter((game) => isRoomLobby(game.lobbyMetadata)));
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background') { generation.current++; void transport.stopDiscovery().catch(() => undefined); }
    });
    void AsyncStorage.getItem(SELECTION_KEY).then((saved) => {
      if (mounted && isGameType(saved)) setGameType(saved);
    }).catch(() => undefined).finally(() => { if (mounted) setReady(true); });
    return () => {
      mounted = false;
      // Operation counter: invalidate outstanding discovery promises on unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      unsubscribe(); appState.remove(); multiplayer.current = null; void transport.dispose().catch(() => undefined);
    };
  }, []);
  async function selectGame(next: GameType) {
    if (next === gameType) return;
    if (activeSession.current) throw new Error('Leave the current room before switching games');
    await AsyncStorage.setItem(SELECTION_KEY, next);
    setError(null);
    setGameType(next);
  }
  async function discover() {
    const transport = multiplayer.current;
    if (!transport) return false;
    const attempt = ++generation.current;
    setBusy(true); setError(null);
    try { await transport.startDiscovery(); if (attempt !== generation.current) { await transport.stopDiscovery(); return false; } return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not discover rooms'); return false; }
    finally { setBusy(false); }
  }
  async function stop() {
    generation.current++;
    try { await multiplayer.current?.stopDiscovery(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not stop discovery'); }
  }
  async function refresh() { await stop(); await discover(); }
  async function requestJoin(options: PendingJoin) {
    const type = roomGameType(options.game.lobbyMetadata);
    if (!type) throw new Error('This room is incompatible with Card Room');
    if (activeSession.current) throw new Error('Leave the current room before joining another');
    await stop();
    await AsyncStorage.setItem(SELECTION_KEY, type);
    setError(null);
    setPendingJoin(options);
    setGameType(type);
  }
  async function requestCreate<K extends GameType>(options: PendingCreate<K>) {
    if (activeSession.current) throw new Error('Leave the current room before creating another');
    if (!sessionReady) throw new Error('The room is not ready yet');
    setBusy(true);
    try {
      await stop();
      await AsyncStorage.setItem(SELECTION_KEY, options.gameType);
      setError(null);
      setPendingCreate(options);
      setGameType(options.gameType);
    } finally { setBusy(false); }
  }
  return <Context.Provider value={{ ready, gameType, selectGame, username, setUsername, games, busy, error, clearError: () => setError(null), discover, refresh, stop,
    requestJoin, pendingJoin, consumeJoin: () => setPendingJoin(null), requestCreate, pendingCreate, consumeCreate: () => setPendingCreate(null),
    sessionReady, setSessionReady, setHasSession: (value) => { activeSession.current = value; } }}>{children}</Context.Provider>;
}
export function useCardRoom() {
  const value = useContext(Context);
  if (!value) throw new Error('CardRoomProvider is required');
  return value;
}
