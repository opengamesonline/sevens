import type { CreateGameOptions, JsonValue, Participant, SessionRecoveryState } from '@opengamesonline/expo-lan-multiplayer';
import type { BotPlaystyle, Card, GameStatus } from '@opengamesonline/sevens';

export type RoomBot = { id: string; name: string; playstyle: BotPlaystyle };
export type ParticipantBase = { role: 'player' | 'spectator'; appId: string; gameVersion: number };
export type LobbyBase = { playerCount: number; spectatorCount: number; bots: RoomBot[] };
export type StateBase = { readonly status: GameStatus; readonly players: readonly { readonly id: string; readonly hand: readonly Card[] }[]; readonly bots: readonly RoomBot[] };
export type RoomPolicy<S, E, P extends JsonValue, L extends JsonValue> = CreateGameOptions<S, E, P, L> & {
  addBot(playstyle: BotPlaystyle, participants: readonly Participant<P>[]): RoomBot;
  removeBot(id: string): boolean;
};
export type SessionSpec<S extends StateBase, E, P extends JsonValue & ParticipantBase, L extends JsonValue & LobbyBase, O> = {
  gameType: string;
  isCreateOptions(value: unknown): value is O;
  storageKey: string;
  isParticipant(value: unknown): value is P;
  isLobby(value: unknown): value is L;
  isState(value: unknown): value is S;
  stateMatchesLobby(state: S, lobby: L): boolean;
  createPolicy(options: O): RoomPolicy<S, E, P, L>;
  restorePolicy(recovery: SessionRecoveryState<S, P, L>, selfId: string): RoomPolicy<S, E, P, L>;
  participant(role: 'player' | 'spectator'): P;
  botEvent(state: S): E | null;
};
