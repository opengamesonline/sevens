import { chooseHeartsBotAction, type HeartsAction } from '@opengamesonline/sevens';
import { createSessionProvider } from '../card-room/create-session-provider';
import { createHeartsParticipantMetadata, createHeartsPolicy, type CreateHeartsPolicyOptions } from './hearts-policy';
import { isHeartsGameState, isHeartsLobbyMetadata, isHeartsParticipantMetadata } from './validation';
import type { HeartsGameState, HeartsGameEvent, HeartsParticipantMetadata, HeartsLobbyMetadata } from './types';

const session = createSessionProvider<HeartsGameState, HeartsGameEvent, HeartsAction, HeartsParticipantMetadata, HeartsLobbyMetadata, CreateHeartsPolicyOptions>({
  storageKey: 'hearts.active-table.v1',
  isParticipant: isHeartsParticipantMetadata, isLobby: isHeartsLobbyMetadata, isState: isHeartsGameState,
  stateMatchesLobby: () => true,
  createPolicy: createHeartsPolicy,
  restorePolicy(recovery, selfId) {
    const self = recovery.participants.find((p) => p.id === selfId);
    if (!self) throw new Error('Saved participant is missing');
    return createHeartsPolicy({ gameName: recovery.name, participantName: self.name, role: self.metadata.role,
      recovery: { lobbyMetadata: recovery.lobbyMetadata, participants: recovery.participants } });
  },
  participant: createHeartsParticipantMetadata,
  botEvent(state) {
    const bot = state.phase === 'passing' ? state.bots.find((b) => !state.passes[b.id]) : state.bots.find((b) => b.id === state.currentPlayerId);
    const action = bot ? chooseHeartsBotAction(state, bot.id, bot.playstyle) : null;
    return action && bot ? { type: 'botTurn', botId: bot.id, action } : null;
  },
});
export const HeartsMultiplayerProvider = session.Provider;
export const useHeartsMultiplayer = session.useSession;
