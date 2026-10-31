import { createBotStrategy, SevensVariant, type TurnAction } from '@opengamesonline/sevens';
import { createSessionProvider } from '../card-room/create-session-provider';
import { createSevensParticipantMetadata, createSevensPolicy, type CreateSevensPolicyOptions } from './sevens-policy';
import { isSevensGameState, isSevensLobbyMetadata, isSevensParticipantMetadata } from './validation';
import { SEVENS_BOT_TURN_EVENT, type SevensGameState, type SevensGameEvent, type SevensParticipantMetadata, type SevensLobbyMetadata, type SevensDiscoveredGame } from './types';

const session = createSessionProvider<SevensGameState, SevensGameEvent, TurnAction, SevensParticipantMetadata, SevensLobbyMetadata, CreateSevensPolicyOptions>({
  gameType: 'sevens',
  isCreateOptions(value): value is CreateSevensPolicyOptions {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return typeof v.gameName === 'string' && typeof v.participantName === 'string' && (v.role === 'player' || v.role === 'spectator') &&
      typeof v.maxPlayers === 'number' && typeof v.showPlayableCards === 'boolean' && typeof v.preventIllegalDraw === 'boolean' &&
      (v.variant === SevensVariant.Standard || v.variant === SevensVariant.Joker);
  },
  storageKey: 'sevens.active-table.v1',
  isParticipant: isSevensParticipantMetadata, isLobby: isSevensLobbyMetadata, isState: isSevensGameState,
  stateMatchesLobby: (state, lobby) => state.variant === lobby.variant,
  createPolicy: createSevensPolicy,
  restorePolicy(recovery, selfId) {
    const self = recovery.participants.find((p) => p.id === selfId);
    if (!self) throw new Error('Saved participant is missing');
    return createSevensPolicy({ gameName: recovery.name, participantName: self.name, role: self.metadata.role,
      maxPlayers: recovery.lobbyMetadata.maxPlayers, showPlayableCards: recovery.lobbyMetadata.showPlayableCards,
      preventIllegalDraw: recovery.lobbyMetadata.preventIllegalDraw, variant: recovery.lobbyMetadata.variant,
      recovery: { lobbyMetadata: recovery.lobbyMetadata, participants: recovery.participants } });
  },
  participant: createSevensParticipantMetadata,
  botEvent(state) {
    const actor = state.pendingDraw?.donorId ?? state.currentPlayerId;
    const bot = state.bots.find((b) => b.id === actor);
    const action = bot ? createBotStrategy(bot.playstyle)(state, bot.id) : null;
    return action && bot ? { type: SEVENS_BOT_TURN_EVENT, botId: bot.id, action } : null;
  },
});
export const SevensMultiplayerProvider = session.Provider;
export const useSevensMultiplayer = session.useSession;
export type SevensMultiplayerContextValue = ReturnType<typeof useSevensMultiplayer>;
export type JoinSevensGameOptions = { game: SevensDiscoveredGame; participantName: string; role: 'player' | 'spectator' };
