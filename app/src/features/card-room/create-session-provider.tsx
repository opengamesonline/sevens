import { LanMultiplayer, type DiscoveredGame, type GameSession, type JsonValue, type SessionRecoveryState, type SessionSnapshot } from '@opengamesonline/expo-lan-multiplayer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BotPlaystyle, GameStatus } from '@opengamesonline/sevens';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import type { LobbyBase, ParticipantBase, RoomPolicy, SessionSpec, StateBase } from './session-types';
import { useCardRoom } from './room-provider';
import { createRecoveryValidator } from './recovery';

const message = (cause: unknown) => cause instanceof Error ? cause.message : 'An unexpected multiplayer error occurred';

// One lifecycle implementation; game adapters supply rules, validation and bot decisions.
export function createSessionProvider<S extends StateBase, E, A extends E, P extends JsonValue & ParticipantBase, L extends JsonValue & LobbyBase, O>(spec: SessionSpec<S, E, P, L, O>) {
  type Session = GameSession<S, E, P, L>;
  type Snapshot = SessionSnapshot<S, P, L>;
  type Recovery = SessionRecoveryState<S, P, L>;
  type Policy = RoomPolicy<S, E, P, L>;
  type Saved = { selfParticipantId: string; recovery: Recovery };
  type JoinOptions = { game: DiscoveredGame<L>; participantName: string; role: 'player' | 'spectator' };
  type Value = {
    snapshot: Snapshot | null; busy: boolean; sending: boolean; reconnecting: boolean; error: string | null;
    create(options: O): Promise<boolean>; join(options: JoinOptions): Promise<boolean>;
    start(): Promise<void>; continueGame(): Promise<void>; addBot(style: BotPlaystyle): Promise<void>;
    removeBot(id: string): Promise<void>; removeDisconnectedParticipant(id: string): Promise<void>;
    send(action: A): Promise<void>; leave(): Promise<void>; retryConnection(): Promise<void>;
  };
  const Context = createContext<Value | null>(null);

  const validSaved = createRecoveryValidator(spec);

  function Provider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
    const room = useCardRoom();
    const { setSessionReady } = room;
    const transport = useRef<LanMultiplayer<P, L> | null>(null);
    const session = useRef<Session | null>(null);
    const policy = useRef<Policy | null>(null);
    const subscription = useRef<(() => void) | null>(null);
    const mounted = useRef(false);
    const appState = useRef(AppState.currentState);
    const generation = useRef(0);
    const recovering = useRef(false);
    const sendingRef = useRef(false);
    const botRunning = useRef(false);
    const botRevision = useRef<number | null>(null);
    const starting = useRef(false);
    const creating = useRef(false);
    const ending = useRef(false);
    const persistence = useRef<Promise<void>>(Promise.resolve());
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [busy, setBusy] = useState(true);
    const [sending, setSending] = useState(false);
    const [reconnecting, setReconnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [initialized, setInitialized] = useState(false);
    const recoverEvent = useEffectEvent(recover);
    const restoreEvent = useEffectEvent(restore);
    const pendingJoinEvent = useEffectEvent(async () => {
      const pending = room.pendingJoin;
      if (!pending || !spec.isLobby(pending.game.lobbyMetadata)) return;
      room.consumeJoin();
      // Navigate after the selected provider and its navigator have mounted.
      router.replace('/session');
      await join({ ...pending, game: { ...pending.game, lobbyMetadata: pending.game.lobbyMetadata } });
    });
    const pendingCreateEvent = useEffectEvent(async () => {
      const pending = room.pendingCreate;
      if (!pending || pending.gameType !== spec.gameType || creating.current) return;
      creating.current = true;
      try {
        if (!spec.isCreateOptions(pending.options)) {
          setError('Invalid room options');
          return;
        }
        if (await create(pending.options)) pending.onCreated();
      } finally {
        creating.current = false;
        room.consumeCreate();
      }
    });

    useEffect(() => {
      if (!enabled) return;
      mounted.current = true;
      setSessionReady(false);
      setInitialized(false);
      setBusy(true); setError(null); setSnapshot(null);
      const multiplayer = new LanMultiplayer<P, L>();
      transport.current = multiplayer;
      const stateSubscription = AppState.addEventListener('change', (state) => {
        appState.current = state;
        if (state === 'background') {
          generation.current++; multiplayer.cancelPendingJoin(); multiplayer.cancelRecovery();
          if (session.current) { persist(session.current); void multiplayer.suspendSession().catch(() => undefined); }
        } else if (state === 'active' && session.current) void recoverEvent(session.current);
      });
      void restoreEvent(multiplayer);
      const monitor = setInterval(() => {
        const current = session.current;
        if (!current || current.snapshot.role !== 'host' || current.snapshot.status !== 'connected') return;
        void multiplayer.startAuthorityMonitoring().then(async () => {
          if (multiplayer.hasHigherAuthority(current)) { await multiplayer.suspendSession(); await recoverEvent(current); }
        }).catch((cause) => { if (mounted.current) setError(message(cause)); });
      }, 2_000);
      return () => {
        mounted.current = false;
        setInitialized(false);
        // This ref is an operation counter, not a DOM/native element.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        generation.current++;
        multiplayer.cancelPendingJoin(); multiplayer.cancelRecovery();
        clearInterval(monitor); stateSubscription.remove(); subscription.current?.(); session.current = null; policy.current = null;
        transport.current = null;
        void multiplayer.dispose({ preserveSession: true }).catch(() => undefined);
      };
    }, [enabled, setSessionReady]);

    useEffect(() => { if (enabled && room.pendingJoin) void pendingJoinEvent(); }, [enabled, room.pendingJoin]);
    useEffect(() => { if (enabled && initialized && room.pendingCreate) void pendingCreateEvent(); }, [enabled, initialized, room.pendingCreate]);

    function persist(current: Session) {
      const selfParticipantId = current.snapshot.self?.id;
      if (!selfParticipantId || current.snapshot.status === 'left') return;
      let saved: Saved;
      try { saved = { selfParticipantId, recovery: current.exportRecoveryState() }; } catch { return; }
      const json = JSON.stringify(saved);
      persistence.current = persistence.current.catch(() => undefined).then(() => AsyncStorage.setItem(spec.storageKey, json));
    }
    function clearSaved() {
      persistence.current = persistence.current.catch(() => undefined).then(() => AsyncStorage.removeItem(spec.storageKey));
      return persistence.current;
    }
    async function restore(multiplayer: LanMultiplayer<P, L>) {
      let restored = false;
      try {
        const raw = await AsyncStorage.getItem(spec.storageKey);
        if (!raw || !mounted.current || transport.current !== multiplayer || room.pendingJoin || room.pendingCreate) return;
        const saved: unknown = JSON.parse(raw);
        if (!validSaved(saved)) { await clearSaved(); return; }
        const options = spec.restorePolicy(saved.recovery, saved.selfParticipantId);
        const current = multiplayer.restoreGame<S, E>({ recovery: saved.recovery, selfParticipantId: saved.selfParticipantId, hostOptions: options });
        watch(current); restored = true; router.replace('/session'); await recover(current);
      } catch (cause) {
        if (!restored) await clearSaved().catch(() => undefined);
        if (mounted.current) setError(message(cause));
      } finally { if (mounted.current && transport.current === multiplayer) { setBusy(false); setInitialized(true); room.setSessionReady(true); } }
    }
    async function recover(current: Session) {
      const multiplayer = transport.current;
      if (!multiplayer || session.current !== current || current.snapshot.status === 'left' || current.snapshot.status === 'connected' || recovering.current) return;
      recovering.current = true; setReconnecting(true); setError(null);
      let retry = false;
      try {
        const recovery = current.exportRecoveryState();
        const options = spec.restorePolicy(recovery, current.snapshot.self?.id ?? '');
        const result = await multiplayer.recoverGame(current, options);
        policy.current = result === 'promoted' ? options : null;
        if (result === 'promoted') await multiplayer.startAuthorityMonitoring();
        persist(current);
      } catch (cause) {
        retry = message(cause) === 'Recovery cancelled';
        if (mounted.current && session.current === current) setError(message(cause));
      } finally {
        recovering.current = false;
        if (mounted.current) setReconnecting(false);
        if (retry && mounted.current && appState.current === 'active' && session.current === current && current.snapshot.status === 'disconnected') void recover(current);
      }
    }
    function watch(current: Session) {
      subscription.current?.(); session.current = current; botRevision.current = null; botRunning.current = false; ending.current = false;
      room.setHasSession(true);
      subscription.current = current.subscribe((next) => {
        if (!mounted.current || session.current !== current) return;
        setSnapshot(next);
        if (next.error) setError(next.error);
        if (next.status === 'left') { void clearSaved(); room.setHasSession(false); }
        else persist(current);
        const state = next.state;
        const missingPlayer = state?.status === GameStatus.Active && state.players.some((p) => !state.bots.some((b) => b.id === p.id) && !next.participants.some((member) => member.id === p.id));
        if (next.role === 'host' && next.status === 'connected' && missingPlayer && !ending.current) {
          ending.current = true; void leave();
        }
        if (next.status === 'disconnected' && next.tableId && appState.current === 'active') void recover(current);
        maybeRunBot(current, next);
      });
    }
    function maybeRunBot(current: Session, next: Snapshot) {
      const state = next.state;
      if (next.role !== 'host' || next.status !== 'connected' || !state || state.status !== GameStatus.Active ||
        starting.current || botRunning.current || ending.current || botRevision.current === next.revision) return;
      if (state.players.some((p) => !state.bots.some((b) => b.id === p.id) && !next.connectedParticipantIds.includes(p.id))) return;
      let event: E | null;
      try { event = spec.botEvent(state); } catch (cause) { setError(message(cause)); return; }
      if (!event) return;
      botRevision.current = next.revision; botRunning.current = true;
      const revision = next.revision;
      void Promise.resolve().then(async () => {
        if (!mounted.current || session.current !== current || current.snapshot.status !== 'connected' || current.snapshot.role !== 'host' || current.snapshot.revision !== revision) {
          if (botRevision.current === revision) botRevision.current = null;
          return;
        }
        await current.sendGameEvent(event);
      }).catch((cause) => { if (mounted.current && session.current === current) setError(message(cause)); })
        .finally(() => {
          if (session.current !== current) return;
          botRunning.current = false;
          if (mounted.current) maybeRunBot(current, current.snapshot);
        });
    }
    async function operation(action: () => Promise<void>) {
      setBusy(true); setError(null);
      try { await action(); } catch (cause) { if (mounted.current) setError(message(cause)); }
      finally { if (mounted.current) setBusy(false); }
    }
    function clearSession() {
      subscription.current?.(); subscription.current = null; session.current = null; policy.current = null;
      botRunning.current = false; botRevision.current = null; starting.current = false; room.setHasSession(false);
      if (mounted.current) { setSnapshot(null); setReconnecting(false); }
    }
    async function create(options: O) {
      const multiplayer = transport.current;
      if (!multiplayer || session.current) {
        setError(session.current ? 'Leave the current room before creating another' : 'The room is not ready yet');
        return false;
      }
      const attempt = ++generation.current;
      room.clearError();
      setBusy(true); setError(null);
      try {
        const optionsPolicy = spec.createPolicy(options);
        const current = await multiplayer.createGame(optionsPolicy);
        if (!mounted.current || generation.current !== attempt) { await current.leaveGame(); return false; }
        policy.current = optionsPolicy; watch(current); void multiplayer.startAuthorityMonitoring().catch(() => undefined); return true;
      } catch (cause) { if (mounted.current) setError(message(cause)); return false; }
      finally { if (mounted.current) setBusy(false); }
    }
    async function join(options: JoinOptions) {
      const multiplayer = transport.current;
      if (!multiplayer || session.current) return false;
      const attempt = ++generation.current;
      setBusy(true); setError(null);
      try {
        if (!spec.isLobby(options.game.lobbyMetadata)) throw new Error('This room uses an incompatible game or version');
        const current = await multiplayer.joinGame<S, E>({ service: options.game, participantName: options.participantName, participantMetadata: spec.participant(options.role) });
        if (!mounted.current || generation.current !== attempt) { await current.leaveGame(); return false; }
        watch(current);
        const accepted = await new Promise<boolean>((resolve) => {
          let unsubscribe = () => {};
          let settled = false;
          const finish = (accepted: boolean) => {
            if (settled) return;
            settled = true; clearTimeout(timer); unsubscribe(); resolve(accepted);
          };
          const timer = setTimeout(() => finish(false), 8_000);
          unsubscribe = current.subscribe((next) => {
            if (next.status === 'connected' || next.status === 'left' || next.status === 'disconnected' || attempt !== generation.current || !mounted.current) {
              finish(next.status === 'connected' && attempt === generation.current && mounted.current);
            }
          });
          if (settled) unsubscribe();
        });
        if (!accepted) { await current.leaveGame().catch(() => undefined); clearSession(); throw new Error('Could not join the table. The host may be unavailable.'); }
        return true;
      } catch (cause) { if (mounted.current) setError(message(cause)); return false; }
      finally { if (mounted.current) setBusy(false); }
    }
    async function start() {
      await operation(async () => {
        const current = session.current;
        if (!current) return;
        starting.current = true;
        try { await current.startGame(); } finally { starting.current = false; }
        maybeRunBot(current, current.snapshot);
      });
    }
    async function continueGame() {
      const current = session.current;
      if (current?.snapshot.role !== 'host' || current.snapshot.state?.status !== GameStatus.Finished) return;
      await operation(async () => { await current.returnToLobby(); botRevision.current = null; });
    }
    async function addBot(style: BotPlaystyle) {
      const current = session.current; const options = policy.current;
      if (!current || !options || current.snapshot.role !== 'host' || current.snapshot.phase !== 'lobby') return;
      await operation(async () => {
        const bot = options.addBot(style, current.snapshot.participants);
        try { await current.refreshLobbyMetadata(); } catch (cause) { options.removeBot(bot.id); await current.refreshLobbyMetadata().catch(() => undefined); throw cause; }
      });
    }
    async function removeBot(id: string) {
      const current = session.current; const options = policy.current;
      if (!current || !options || current.snapshot.role !== 'host' || current.snapshot.phase !== 'lobby') return;
      await operation(async () => { if (options.removeBot(id)) await current.refreshLobbyMetadata(); });
    }
    async function removeDisconnectedParticipant(id: string) {
      const current = session.current;
      if (current?.snapshot.role === 'host') await operation(() => current.removeDisconnectedParticipant(id));
    }
    async function send(action: A) {
      const current = session.current;
      if (!current || sendingRef.current) return;
      sendingRef.current = true; setSending(true); setError(null);
      try { await current.sendGameEvent(action); }
      catch (cause) { if (mounted.current) setError(message(cause)); }
      finally { sendingRef.current = false; if (mounted.current) setSending(false); }
    }
    async function leave() {
      generation.current++; transport.current?.cancelPendingJoin();
      await operation(async () => {
        try { await session.current?.leaveGame(); }
        finally { await clearSaved().catch(() => undefined); clearSession(); }
      });
    }
    return <Context.Provider value={{ snapshot, busy, sending, reconnecting, error, create, join, start, continueGame, addBot, removeBot,
      removeDisconnectedParticipant, send, leave, retryConnection: async () => { if (session.current) await recover(session.current); } }}>{children}</Context.Provider>;
  }
  function useSession() {
    const value = useContext(Context);
    if (!value) throw new Error('The selected game session provider is required');
    const room = useCardRoom();
    return { ...value, busy: value.busy || room.busy, error: value.error ?? room.error,
      username: room.username, setUsername: room.setUsername, discover: room.discover, stop: room.stop };
  }
  return { Provider, useSession };
}
