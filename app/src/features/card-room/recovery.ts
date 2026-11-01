import type { JsonValue, SessionRecoveryState } from '@opengamesonline/expo-lan-multiplayer';
import type { LobbyBase, ParticipantBase, StateBase } from './session-types';

export type SavedSession<S, P extends JsonValue, L extends JsonValue> = {
  selfParticipantId: string; recovery: SessionRecoveryState<S, P, L>;
};
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export function createRecoveryValidator<S extends StateBase, P extends JsonValue & ParticipantBase, L extends JsonValue & LobbyBase>(spec: {
  isParticipant(value: unknown): value is P; isLobby(value: unknown): value is L; isState(value: unknown): value is S;
  stateMatchesLobby(state: S, lobby: L): boolean;
}) {
  return function validSaved(value: unknown): value is SavedSession<S, P, L> {
    if (!record(value) || typeof value.selfParticipantId !== 'string' || !record(value.recovery)) return false;
    const r = value.recovery;
    if (typeof r.name !== 'string' || !r.name || typeof r.tableId !== 'string' || !r.tableId ||
      typeof r.hostParticipantId !== 'string' || !Number.isSafeInteger(r.authorityTerm) || (r.authorityTerm as number) < 1 ||
      !Number.isSafeInteger(r.revision) || (r.revision as number) < 0 || !spec.isLobby(r.lobbyMetadata) ||
      !Array.isArray(r.participants) || !r.participants.every((p) => record(p) && typeof p.id === 'string' && p.id.length > 0 &&
        typeof p.name === 'string' && p.name.length > 0 && Number.isSafeInteger(p.slot) && (p.slot as number) >= 0 && spec.isParticipant(p.metadata)) ||
      !Array.isArray(r.hostOrder) || !Array.isArray(r.connectedParticipantIds) || !record(r.resumeTokens)) return false;
    const ids = r.participants.map((p) => p.id);
    const slots = r.participants.map((p) => p.slot);
    if (new Set(ids).size !== ids.length || new Set(slots).size !== slots.length || !ids.includes(r.hostParticipantId) || !ids.includes(value.selfParticipantId) ||
      new Set(r.hostOrder).size !== ids.length || r.hostOrder.length !== ids.length || !r.hostOrder.every((id) => ids.includes(id)) ||
      new Set(r.connectedParticipantIds).size !== r.connectedParticipantIds.length || !r.connectedParticipantIds.every((id) => ids.includes(id)) ||
      Object.keys(r.resumeTokens).length !== ids.length || !Object.entries(r.resumeTokens).every(([id, token]) => ids.includes(id) && typeof token === 'string' && token.length >= 16)) return false;
    const lobby = r.lobbyMetadata;
    const bots = lobby.bots;
    if (bots.some((b) => ids.includes(b.id)) || lobby.playerCount !== r.participants.filter((p) => p.metadata.role === 'player').length + bots.length ||
      lobby.spectatorCount !== r.participants.filter((p) => p.metadata.role === 'spectator').length) return false;
    if (r.phase === 'lobby') return r.state === null;
    if (r.phase !== 'started' || !spec.isState(r.state) || !spec.stateMatchesLobby(r.state, lobby)) return false;
    const state = r.state;
    const playerIds = [...r.participants.filter((p) => p.metadata.role === 'player').map((p) => p.id), ...bots.map((b) => b.id)];
    return playerIds.length === state.players.length && playerIds.every((id) => state.players.some((p) => p.id === id)) &&
      state.bots.length === bots.length && state.bots.every((b) => bots.some((saved) => saved.id === b.id && saved.name === b.name && saved.playstyle === b.playstyle));
  };
}
