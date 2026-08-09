import { LanMultiplayer } from '@opengamesonline/expo-lan-multiplayer';
import {
  BotPlaystyle,
  GameStatus,
  createBotStrategy,
  type TurnAction,
} from '@opengamesonline/sevens';
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
  type SevensPolicy,
} from './sevens-policy';
import type {
  SevensDiscoveredGame,
  SevensGameEvent,
  SevensGameState,
  SevensLobbyMetadata,
  SevensMultiplayer,
  SevensParticipantMetadata,
  SevensParticipantRole,
  SevensSession,
  SevensSessionSnapshot,
} from './types';
import { SEVENS_BOT_TURN_EVENT } from './types';
import { isSevensLobbyMetadata } from './validation';

export type JoinSevensGameOptions = {
  game: SevensDiscoveredGame;
  participantName: string;
  role: SevensParticipantRole;
};

export type SevensMultiplayerContextValue = {
  username: string;
  setUsername(username: string): void;
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
  addBot(playstyle: BotPlaystyle): Promise<void>;
  removeBot(botId: string): Promise<void>;
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
  const policyRef = useRef<SevensPolicy | null>(null);
  const unsubscribeSessionRef = useRef<(() => void) | null>(null);
  const joinAttemptRef = useRef(0);
  const discoveryGenerationRef = useRef(0);
  const sendingRef = useRef(false);
  const botTurnInFlightRef = useRef(false);
  const handledBotRevisionRef = useRef<number | null>(null);
  const startingGameRef = useRef(false);
  const mountedRef = useRef(false);
  const [games, setGames] = useState<SevensDiscoveredGame[]>([]);
  const [username, setUsername] = useState('Player');
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
      policyRef.current = null;
      if (multiplayerRef.current === multiplayer) multiplayerRef.current = null;
      void multiplayer.dispose().catch(() => undefined);
    };
  }, []);

  function watchSession(session: SevensSession) {
    unsubscribeSessionRef.current?.();
    sessionRef.current = session;
    botTurnInFlightRef.current = false;
    handledBotRevisionRef.current = null;
    unsubscribeSessionRef.current = session.subscribe((nextSnapshot) => {
      if (!mountedRef.current || sessionRef.current !== session) return;
      setSnapshot(nextSnapshot);
      if (nextSnapshot.error) setError(nextSnapshot.error);
      maybeRunBotTurn(session, nextSnapshot);
    });
  }

  function maybeRunBotTurn(session: SevensSession, nextSnapshot: SevensSessionSnapshot) {
    const game = nextSnapshot.state;
    if (
      nextSnapshot.role !== 'host' ||
      nextSnapshot.status !== 'connected' ||
      nextSnapshot.phase !== 'started' ||
      !game ||
      game.status !== GameStatus.Active ||
      startingGameRef.current ||
      botTurnInFlightRef.current ||
      handledBotRevisionRef.current === nextSnapshot.revision
    ) {
      return;
    }

    const actorId = game.pendingDraw?.donorId ?? game.currentPlayerId;
    const bot = game.bots.find(({ id }) => id === actorId);
    if (!bot) return;

    let action: TurnAction | null;
    try {
      action = createBotStrategy(bot.playstyle)(game, bot.id);
    } catch (cause) {
      setError(errorMessage(cause));
      return;
    }
    if (!action) return;

    handledBotRevisionRef.current = nextSnapshot.revision;
    botTurnInFlightRef.current = true;
    const event: SevensGameEvent = {
      type: SEVENS_BOT_TURN_EVENT,
      botId: bot.id,
      action,
    };
    void session
      .sendGameEvent(event)
      .catch((cause) => {
        if (mountedRef.current && sessionRef.current === session) {
          setError(errorMessage(cause));
        }
      })
      .finally(() => {
        botTurnInFlightRef.current = false;
        if (mountedRef.current && sessionRef.current === session) {
          maybeRunBotTurn(session, session.snapshot);
        }
      });
  }

  function clearSession(session?: SevensSession) {
    if (session && sessionRef.current !== session) return;
    unsubscribeSessionRef.current?.();
    unsubscribeSessionRef.current = null;
    sessionRef.current = null;
    policyRef.current = null;
    botTurnInFlightRef.current = false;
    handledBotRevisionRef.current = null;
    startingGameRef.current = false;
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
      const policy = createSevensPolicy(options);
      const session = await multiplayer.createGame(policy);
      if (!mountedRef.current || attempt !== joinAttemptRef.current) {
        await session.leaveGame();
        return false;
      }
      policyRef.current = policy;
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
      const session = await multiplayer.joinGame<SevensGameState, SevensGameEvent>({
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
    startingGameRef.current = true;
    try {
      await session.startGame();
      startingGameRef.current = false;
      maybeRunBotTurn(session, session.snapshot);
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
    } finally {
      startingGameRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  async function addBot(playstyle: BotPlaystyle) {
    const session = sessionRef.current;
    const policy = policyRef.current;
    if (
      !session ||
      !policy ||
      session.snapshot.role !== 'host' ||
      session.snapshot.phase !== 'lobby'
    ) return;
    setBusy(true);
    setError(null);
    let botId: string | null = null;
    try {
      botId = policy.addBot(playstyle, session.snapshot.participants).id;
      await session.refreshLobbyMetadata();
    } catch (cause) {
      if (botId) {
        policy.removeBot(botId);
        await session.refreshLobbyMetadata().catch(() => undefined);
      }
      if (mountedRef.current) setError(errorMessage(cause));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function removeBot(botId: string) {
    const session = sessionRef.current;
    const policy = policyRef.current;
    if (
      !session ||
      !policy ||
      session.snapshot.role !== 'host' ||
      session.snapshot.phase !== 'lobby'
    ) return;
    setBusy(true);
    setError(null);
    try {
      if (policy.removeBot(botId)) await session.refreshLobbyMetadata();
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
        username,
        setUsername,
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
        addBot,
        removeBot,
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
