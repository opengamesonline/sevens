import { LanMultiplayer } from '@opengamesonline/expo-lan-multiplayer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BotPlaystyle,
  GameStatus,
  createBotStrategy,
  type TurnAction,
} from '@opengamesonline/sevens';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
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
  SevensRecoveryState,
  SevensSession,
  SevensSessionSnapshot,
} from './types';
import { SEVENS_BOT_TURN_EVENT } from './types';
import {
  isSevensGameState,
  isSevensLobbyMetadata,
  isSevensParticipantMetadata,
} from './validation';
import { selectMissingLeaverId } from './selectors';

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
  reconnecting: boolean;
  error: string | null;
  create(options: CreateSevensPolicyOptions): Promise<boolean>;
  discover(): Promise<boolean>;
  refresh(): Promise<void>;
  join(options: JoinSevensGameOptions): Promise<boolean>;
  start(): Promise<void>;
  continueGame(): Promise<void>;
  addBot(playstyle: BotPlaystyle): Promise<void>;
  removeBot(botId: string): Promise<void>;
  removeDisconnectedParticipant(participantId: string): Promise<void>;
  send(action: TurnAction): Promise<void>;
  leave(): Promise<void>;
  stop(): Promise<void>;
  retryConnection(): Promise<void>;
};

const SevensMultiplayerContext = createContext<SevensMultiplayerContextValue | null>(null);
const RECOVERY_STORAGE_KEY = 'sevens.active-table.v1';

type PersistedTable = {
  selfParticipantId: string;
  recovery: SevensRecoveryState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPersistedTable(value: unknown): value is PersistedTable {
  if (!isRecord(value) || typeof value.selfParticipantId !== 'string') return false;
  const recovery = value.recovery;
  if (
    !isRecord(recovery) ||
    typeof recovery.name !== 'string' ||
    typeof recovery.tableId !== 'string' ||
    !Number.isSafeInteger(recovery.authorityTerm) ||
    (recovery.authorityTerm as number) < 1 ||
    typeof recovery.hostParticipantId !== 'string' ||
    !Array.isArray(recovery.hostOrder) ||
    !recovery.hostOrder.every((id) => typeof id === 'string') ||
    !isRecord(recovery.resumeTokens) ||
    !Object.values(recovery.resumeTokens).every((token) => typeof token === 'string') ||
    !Array.isArray(recovery.participants) ||
    !Array.isArray(recovery.connectedParticipantIds) ||
    !recovery.connectedParticipantIds.every((id) => typeof id === 'string') ||
    !Number.isSafeInteger(recovery.revision) ||
    (recovery.revision as number) < 0 ||
    (recovery.phase !== 'lobby' && recovery.phase !== 'started') ||
    !isSevensLobbyMetadata(recovery.lobbyMetadata)
  ) return false;
  if (
    !recovery.participants.every(
      (participant) =>
        isRecord(participant) &&
        typeof participant.id === 'string' &&
        participant.id.length > 0 &&
        typeof participant.name === 'string' &&
        participant.name.length > 0 &&
        Number.isSafeInteger(participant.slot) &&
        (participant.slot as number) >= 0 &&
      isSevensParticipantMetadata(participant.metadata),
    )
  ) return false;
  const lobbyMetadata = recovery.lobbyMetadata;
  const participantIds = recovery.participants.map(({ id }) => id);
  const participantSlots = recovery.participants.map(({ slot }) => slot);
  const tokenIds = Object.keys(recovery.resumeTokens);
  const botIds = lobbyMetadata.bots.map(({ id }) => id);
  const playerCount = recovery.participants.filter(
    ({ metadata }) => metadata.role === 'player').length + lobbyMetadata.bots.length;
  const spectatorCount = recovery.participants.filter(
    ({ metadata }) => metadata.role === 'spectator').length;
  if (recovery.phase === 'lobby' && recovery.state !== null) return false;
  if (recovery.phase === 'started') {
    if (!isSevensGameState(recovery.state)) return false;
    const expectedPlayerIds = [
      ...recovery.participants.flatMap(({ id, metadata }) =>
        metadata.role === 'player' ? [id] : []),
      ...botIds,
    ];
    const statePlayerIds = recovery.state.players.map(({ id }) => id);
    const spectatorIds = recovery.participants.flatMap(({ id, metadata }) =>
      metadata.role === 'spectator' ? [id] : []);
    if (
      recovery.state.variant !== lobbyMetadata.variant ||
      !expectedPlayerIds.every((id) => statePlayerIds.includes(id)) ||
      spectatorIds.some((id) => statePlayerIds.includes(id)) ||
      recovery.state.bots.length !== lobbyMetadata.bots.length ||
      !recovery.state.bots.every((bot) => lobbyMetadata.bots.some(
        (savedBot) =>
          savedBot.id === bot.id &&
          savedBot.name === bot.name &&
          savedBot.playstyle === bot.playstyle))
    ) return false;
  }
  return (
    recovery.name.length > 0 &&
    recovery.tableId.length > 0 &&
    new Set(participantIds).size === participantIds.length &&
    new Set(participantSlots).size === participantSlots.length &&
    new Set(recovery.hostOrder).size === recovery.hostOrder.length &&
    recovery.hostOrder.length === participantIds.length &&
    recovery.hostOrder.every((id) => participantIds.includes(id)) &&
    botIds.every((id) => !participantIds.includes(id)) &&
    participantIds.includes(recovery.hostParticipantId) &&
    new Set(recovery.connectedParticipantIds).size === recovery.connectedParticipantIds.length &&
    recovery.connectedParticipantIds.every((id) => participantIds.includes(id)) &&
    tokenIds.length === participantIds.length &&
    tokenIds.every((id) => participantIds.includes(id)) &&
    Object.values(recovery.resumeTokens).every(
      (token) => typeof token === 'string' && token.length >= 16) &&
    participantIds.includes(value.selfParticipantId) &&
    typeof recovery.resumeTokens[value.selfParticipantId] === 'string' &&
    lobbyMetadata.playerCount === playerCount &&
    lobbyMetadata.spectatorCount === spectatorCount
  );
}

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
  const recoveryInFlightRef = useRef(false);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const endingTableRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const mountedRef = useRef(false);
  const [games, setGames] = useState<SevensDiscoveredGame[]>([]);
  const [username, setUsername] = useState('Player');
  const [snapshot, setSnapshot] = useState<SevensSessionSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recoverSessionEvent = useEffectEvent(recoverSession);
  const restorePersistedSessionEvent = useEffectEvent(restorePersistedSession);

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
      appStateRef.current = nextState;
      const activeSession = sessionRef.current;
      if (nextState === 'background') {
        discoveryGenerationRef.current += 1;
        joinAttemptRef.current += 1;
        multiplayer.cancelPendingJoin();
        multiplayer.cancelRecovery();
        sendingRef.current = false;
        setSending(false);
        if (activeSession) {
          persistSession(activeSession);
          void multiplayer.suspendSession().catch(() => undefined);
        } else {
          void multiplayer.stopDiscovery().catch(() => undefined);
        }
      } else if (nextState === 'active' && activeSession) {
        void recoverSessionEvent(activeSession);
      }
    });
    void restorePersistedSessionEvent(multiplayer);
    const authorityMonitor = setInterval(() => {
      const session = sessionRef.current;
      if (
        !session ||
        session.snapshot.role !== 'host' ||
        session.snapshot.status !== 'connected'
      ) return;
      void multiplayer.startAuthorityMonitoring().then(() => {
        if (!multiplayer.hasHigherAuthority(session)) return;
        return multiplayer
          .suspendSession()
          .then(() => recoverSessionEvent(session));
      }).catch((cause) => setError(errorMessage(cause)));
    }, 2_000);

    return () => {
      mountedRef.current = false;
      joinAttemptRef.current += 1;
      multiplayer.cancelPendingJoin();
      multiplayer.cancelRecovery();
      clearInterval(authorityMonitor);
      appStateSubscription.remove();
      unsubscribeGames();
      unsubscribeSessionRef.current?.();
      unsubscribeSessionRef.current = null;
      sessionRef.current = null;
      policyRef.current = null;
      if (multiplayerRef.current === multiplayer) multiplayerRef.current = null;
      void multiplayer.dispose({ preserveSession: true }).catch(() => undefined);
    };
  }, []);

  function createRecoveryPolicy(recovery: SevensRecoveryState): SevensPolicy {
    const self = recovery.participants.find(({ id }) => id === sessionRef.current?.snapshot.self?.id)
      ?? recovery.participants[0];
    if (!self || !isSevensParticipantMetadata(self.metadata)) {
      throw new Error('The saved participant metadata is invalid');
    }
    return createSevensPolicy({
      gameName: recovery.name,
      participantName: self.name,
      role: self.metadata.role,
      maxPlayers: recovery.lobbyMetadata.maxPlayers,
      showPlayableCards: recovery.lobbyMetadata.showPlayableCards,
      variant: recovery.lobbyMetadata.variant,
      recovery: {
        lobbyMetadata: recovery.lobbyMetadata,
        participants: recovery.participants,
      },
    });
  }

  function persistSession(session: SevensSession) {
    const selfParticipantId = session.snapshot.self?.id;
    if (!selfParticipantId || session.snapshot.status === 'left') return;
    let recovery: SevensRecoveryState;
    try {
      recovery = session.exportRecoveryState();
    } catch {
      return;
    }
    const value = JSON.stringify({ selfParticipantId, recovery } satisfies PersistedTable);
    persistenceQueueRef.current = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.setItem(RECOVERY_STORAGE_KEY, value));
  }

  function clearPersistedSession() {
    persistenceQueueRef.current = persistenceQueueRef.current
      .catch(() => undefined)
      .then(() => AsyncStorage.removeItem(RECOVERY_STORAGE_KEY));
    return persistenceQueueRef.current;
  }

  async function restorePersistedSession(multiplayer: SevensMultiplayer) {
    setBusy(true);
    let restorationComplete = false;
    try {
      const value = await AsyncStorage.getItem(RECOVERY_STORAGE_KEY);
      if (!value || !mountedRef.current || sessionRef.current) return;
      let saved: unknown;
      try {
        saved = JSON.parse(value);
      } catch {
        await clearPersistedSession().catch(() => undefined);
        return;
      }
      if (!isPersistedTable(saved)) {
        await clearPersistedSession().catch(() => undefined);
        return;
      }
      const policy = createSevensPolicy({
        gameName: saved.recovery.name,
        participantName:
          saved.recovery.participants.find(({ id }) => id === saved.selfParticipantId)?.name
          ?? 'Player',
        role:
          saved.recovery.participants.find(({ id }) => id === saved.selfParticipantId)?.metadata.role
          ?? 'player',
        maxPlayers: saved.recovery.lobbyMetadata.maxPlayers,
        showPlayableCards: saved.recovery.lobbyMetadata.showPlayableCards,
        variant: saved.recovery.lobbyMetadata.variant,
        recovery: {
          lobbyMetadata: saved.recovery.lobbyMetadata,
          participants: saved.recovery.participants,
        },
      });
      const session = multiplayer.restoreGame<SevensGameState, SevensGameEvent>({
        recovery: saved.recovery,
        selfParticipantId: saved.selfParticipantId,
        hostOptions: policy,
      });
      watchSession(session);
      restorationComplete = true;
      router.replace('/session');
      await recoverSession(session);
    } catch (cause) {
      if (!restorationComplete) {
        await clearPersistedSession().catch(() => undefined);
      }
      if (mountedRef.current) setError(errorMessage(cause));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  async function recoverSession(session: SevensSession) {
    const multiplayer = multiplayerRef.current;
    if (
      !multiplayer ||
      sessionRef.current !== session ||
      session.snapshot.status === 'left' ||
      recoveryInFlightRef.current
    ) return;
    if (session.snapshot.status === 'connected') return;

    recoveryInFlightRef.current = true;
    setReconnecting(true);
    setError(null);
    let retryAfterCancellation = false;
    try {
      const recovery = session.exportRecoveryState();
      const policy = createRecoveryPolicy(recovery);
      const result = await multiplayer.recoverGame(session, policy);
      policyRef.current = result === 'promoted' ? policy : null;
      if (result === 'promoted') {
        await multiplayer.startAuthorityMonitoring();
      }
      persistSession(session);
    } catch (cause) {
      retryAfterCancellation = errorMessage(cause) === 'Recovery cancelled';
      if (mountedRef.current && sessionRef.current === session) {
        setError(errorMessage(cause));
      }
    } finally {
      recoveryInFlightRef.current = false;
      if (mountedRef.current) setReconnecting(false);
      if (
        retryAfterCancellation &&
        mountedRef.current &&
        appStateRef.current === 'active' &&
        sessionRef.current === session &&
        session.snapshot.status === 'disconnected'
      ) {
        void recoverSession(session);
      }
    }
  }

  async function retryConnection() {
    const session = sessionRef.current;
    if (session) await recoverSession(session);
  }

  function watchSession(session: SevensSession) {
    unsubscribeSessionRef.current?.();
    sessionRef.current = session;
    botTurnInFlightRef.current = false;
    handledBotRevisionRef.current = null;
    endingTableRef.current = false;
    unsubscribeSessionRef.current = session.subscribe((nextSnapshot) => {
      if (!mountedRef.current || sessionRef.current !== session) return;
      setSnapshot(nextSnapshot);
      if (nextSnapshot.error) setError(nextSnapshot.error);
      if (nextSnapshot.status === 'left') {
        clearPersistedSession();
      } else {
        persistSession(session);
      }
      if (
        nextSnapshot.role === 'host' &&
        nextSnapshot.status === 'connected' &&
        !endingTableRef.current &&
        selectMissingLeaverId(nextSnapshot)
      ) {
        endingTableRef.current = true;
        void leave().catch(() => {
          endingTableRef.current = false;
        });
      }
      if (
        nextSnapshot.role === 'host' &&
        nextSnapshot.status === 'connected' &&
        !endingTableRef.current &&
        selectMissingLeaverId(nextSnapshot)
      ) {
        endingTableRef.current = true;
        void leave().catch(() => {
          endingTableRef.current = false;
        });
      }
      if (
        nextSnapshot.status === 'disconnected' &&
        nextSnapshot.tableId &&
        appStateRef.current === 'active'
      ) {
        void recoverSession(session);
      }
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
    const botIds = new Set(game.bots.map(({ id }) => id));
    if (
      game.players.some(
        ({ id }) =>
          !botIds.has(id) && !nextSnapshot.connectedParticipantIds.includes(id),
      )
    ) return;

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
    recoveryInFlightRef.current = false;
    if (mountedRef.current) setReconnecting(false);
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
      void multiplayer.startAuthorityMonitoring().catch(() => undefined);
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

  async function continueGame() {
    const session = sessionRef.current;
    const game = session?.snapshot.state;
    if (
      !session ||
      session.snapshot.role !== 'host' ||
      session.snapshot.phase !== 'started' ||
      game?.status !== GameStatus.Finished
    ) return;
    setBusy(true);
    setError(null);
    try {
      await session.returnToLobby();
      botTurnInFlightRef.current = false;
      handledBotRevisionRef.current = null;
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause));
    } finally {
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

  async function removeDisconnectedParticipant(participantId: string) {
    const session = sessionRef.current;
    if (!session || session.snapshot.role !== 'host') return;
    setBusy(true);
    setError(null);
    try {
      await session.removeDisconnectedParticipant(participantId);
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
      await clearPersistedSession().catch(() => undefined);
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
        reconnecting,
        error,
        create,
        discover,
        refresh,
        join,
        start,
        continueGame,
        addBot,
        removeBot,
        removeDisconnectedParticipant,
        send,
        leave,
        stop,
        retryConnection,
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
