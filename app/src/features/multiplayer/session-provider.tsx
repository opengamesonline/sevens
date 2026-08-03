import { LanMultiplayer } from '@opengamesonline/expo-lan-multiplayer';
import type { SevensGameObject, TurnAction } from '@opengamesonline/sevens';
import { AppState } from 'react-native';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  createSevensParticipantMetadata,
  createSevensPolicy,
  type CreateSevensPolicyOptions,
} from './sevens-policy';
import type {
  SevensDiscoveredGame,
  SevensLobbyMetadata,
  SevensMultiplayer,
  SevensParticipantMetadata,
  SevensParticipantRole,
  SevensSession,
  SevensSessionSnapshot,
} from './types';
import { isSevensLobbyMetadata } from './validation';

export type JoinSevensGameOptions = {
  game: SevensDiscoveredGame;
  participantName: string;
  role: SevensParticipantRole;
};

export type SevensMultiplayerContextValue = {
  games: readonly SevensDiscoveredGame[];
  snapshot: SevensSessionSnapshot | null;
  busy: boolean;
  sending: boolean;
  error: string | null;
  create(options: CreateSevensPolicyOptions): Promise<boolean>;
  discover(): Promise<boolean>;
  refresh(): Promise<void>;
  join(options: JoinSevensGameOptions): Promise<boolean>;
  start(): Promise<void>;
  send(action: TurnAction): Promise<void>;
  leave(): Promise<void>;
  stop(): Promise<void>;
};

const SevensMultiplayerContext = createContext<SevensMultiplayerContextValue | null>(null);

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'An unexpected multiplayer error occurred';
}

export function SevensMultiplayerProvider({ children }: { children: ReactNode }) {
  const multiplayerRef = useRef<SevensMultiplayer | null>(null);
  const sessionRef = useRef<SevensSession | null>(null);
  const unsubscribeSessionRef = useRef<(() => void) | null>(null);
  const joinAttemptRef = useRef(0);
  const discoveryGenerationRef = useRef(0);
  const sendingRef = useRef(false);
  const mountedRef = useRef(false);
  const [games, setGames] = useState<SevensDiscoveredGame[]>([]);
  const [snapshot, setSnapshot] = useState<SevensSessionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const multiplayer = new LanMultiplayer<
      SevensParticipantMetadata,
      SevensLobbyMetadata
    >();
    multiplayerRef.current = multiplayer;
    const unsubscribeGames = multiplayer.subscribeToGames((nextGames) => {
      setGames(
        nextGames.filter(({ lobbyMetadata }) => isSevensLobbyMetadata(lobbyMetadata)),
      );
    });
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'background') return;
      discoveryGenerationRef.current += 1;
      joinAttemptRef.current += 1;
      multiplayer.cancelPendingJoin();
      sendingRef.current = false;
      setSending(false);
      void multiplayer.stopDiscovery().catch(() => undefined);
      const activeSession = sessionRef.current;
      if (activeSession) {
        setBusy(true);
        void activeSession
          .leaveGame()
          .catch(() => undefined)
          .finally(() => {
            clearSession(activeSession);
            if (mountedRef.current) {
              setBusy(false);
              setError('The LAN session ended when the app moved to the background.');
            }
          });
      } else {
        setBusy(false);
        setError('The pending LAN operation ended when the app moved to the background.');
      }
    });

    return () => {
      mountedRef.current = false;
      joinAttemptRef.current += 1;
      multiplayer.cancelPendingJoin();
      appStateSubscription.remove();
      unsubscribeGames();
      unsubscribeSessionRef.current?.();
      unsubscribeSessionRef.current = null;
      sessionRef.current = null;
      if (multiplayerRef.current === multiplayer) multiplayerRef.current = null;
      void multiplayer.dispose().catch(() => undefined);
    };
  }, []);

  function watchSession(session: SevensSession) {
    unsubscribeSessionRef.current?.();
    sessionRef.current = session;
    unsubscribeSessionRef.current = session.subscribe((nextSnapshot) => {
      if (!mountedRef.current || sessionRef.current !== session) return;
      setSnapshot(nextSnapshot);
      if (nextSnapshot.error) setError(nextSnapshot.error);
    });
  }

  function clearSession(session?: SevensSession) {
    if (session && sessionRef.current !== session) return;
    unsubscribeSessionRef.current?.();
    unsubscribeSessionRef.current = null;
    sessionRef.current = null;
    if (mountedRef.current) setSnapshot(null);
  }

  function waitForJoin(session: SevensSession, attempt: number): Promise<boolean> {
    if (session.snapshot.status === 'connected') return Promise.resolve(true);
    if (session.snapshot.status === 'disconnected' || session.snapshot.status === 'left') {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      let settled = false;
      let unsubscribe: () => void = () => undefined;
      const finish = (accepted: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unsubscribe();
        resolve(accepted);
      };
      const timeout = setTimeout(() => {
        if (mountedRef.current && attempt === joinAttemptRef.current) {
          setError('The host did not accept the join request in time.');
        }
        finish(false);
      }, 8_000);

      unsubscribe = session.subscribe((nextSnapshot) => {
        if (!mountedRef.current || attempt !== joinAttemptRef.current) {
          finish(false);
          return;
        }
        if (nextSnapshot.status === 'connected') {
          finish(true);
        } else if (nextSnapshot.status === 'disconnected' || nextSnapshot.status === 'left') {
          if (nextSnapshot.error) setError(nextSnapshot.error);
          finish(false);
        }
      });
    });
  }

  async function create(options: CreateSevensPolicyOptions) {
    const multiplayer = multiplayerRef.current;
    if (!multiplayer) return false;

    const attempt = ++joinAttemptRef.current;
    multiplayer.cancelPendingJoin();
    setBusy(true);
    setError(null);
    try {
      const session = await multiplayer.createGame(createSevensPolicy(options));
      if (!mountedRef.current || attempt !== joinAttemptRef.current) {
        await session.leaveGame();
        return false;
      }
      watchSession(session);
      return true;
    } catch (cause) {
      if (mountedRef.current && attempt === joinAttemptRef.current) {
        setError(errorMessage(cause));
      }
      return false;
    } finally {
      if (mountedRef.current && attempt === joinAttemptRef.current) setBusy(false);
    }
  }

  async function discover() {
    const multiplayer = multiplayerRef.current;
    if (!multiplayer) return false;
    const generation = ++discoveryGenerationRef.current;
    setBusy(true);
    setError(null);
    try {
      await multiplayer.startDiscovery();
      if (generation !== discoveryGenerationRef.current) {
        await multiplayer.stopDiscovery();
        return false;
      }
      return true;
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
      return false;
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function refresh() {
    const multiplayer = multiplayerRef.current;
    if (!multiplayer) return;
    const generation = ++discoveryGenerationRef.current;
    setBusy(true);
    setError(null);
    try {
      await multiplayer.refreshDiscovery();
      if (generation !== discoveryGenerationRef.current) {
        await multiplayer.stopDiscovery();
      }
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function join({ game, participantName, role }: JoinSevensGameOptions) {
    const multiplayer = multiplayerRef.current;
    if (!multiplayer) return false;

    const attempt = ++joinAttemptRef.current;
    multiplayer.cancelPendingJoin();
    setBusy(true);
    setError(null);
    try {
      if (!isSevensLobbyMetadata(game.lobbyMetadata)) {
        throw new Error('This game is not compatible with this version of Sevens');
      }
      const session = await multiplayer.joinGame<SevensGameObject, TurnAction>({
        service: game,
        participantName,
        participantMetadata: createSevensParticipantMetadata(role),
      });
      if (!mountedRef.current || attempt !== joinAttemptRef.current) {
        await session.leaveGame();
        return false;
      }
      watchSession(session);
      const accepted = await waitForJoin(session, attempt);
      if (!accepted) {
        await session.leaveGame().catch(() => undefined);
        clearSession(session);
      }
      return accepted;
    } catch (cause) {
      if (mountedRef.current && attempt === joinAttemptRef.current) {
        setError(errorMessage(cause));
      }
      return false;
    } finally {
      if (mountedRef.current && attempt === joinAttemptRef.current) setBusy(false);
    }
  }

  async function start() {
    const session = sessionRef.current;
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await session.startGame();
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function send(action: TurnAction) {
    const session = sessionRef.current;
    if (!session || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      await session.sendGameEvent(action);
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) setSending(false);
    }
  }

  async function leave() {
    const multiplayer = multiplayerRef.current;
    const session = sessionRef.current;
    joinAttemptRef.current += 1;
    multiplayer?.cancelPendingJoin();
    setBusy(true);
    setError(null);
    try {
      await session?.leaveGame();
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
    } finally {
      clearSession(session ?? undefined);
      if (mountedRef.current) setBusy(false);
    }
  }

  async function stop() {
    const multiplayer = multiplayerRef.current;
    if (!multiplayer) return;
    discoveryGenerationRef.current += 1;
    joinAttemptRef.current += 1;
    multiplayer.cancelPendingJoin();
    setBusy(true);
    setError(null);
    try {
      await multiplayer.stopDiscovery();
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  return (
    <SevensMultiplayerContext.Provider
      value={{
        games,
        snapshot,
        busy,
        sending,
        error,
        create,
        discover,
        refresh,
        join,
        start,
        send,
        leave,
        stop,
      }}
    >
      {children}
    </SevensMultiplayerContext.Provider>
  );
}

export function useSevensMultiplayer(): SevensMultiplayerContextValue {
  const context = useContext(SevensMultiplayerContext);
  if (!context) {
    throw new Error('useSevensMultiplayer must be used inside SevensMultiplayerProvider');
  }
  return context;
}
