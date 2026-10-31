import type { DiscoveredGame } from '@opengamesonline/expo-lan-multiplayer';
import type { SevensLobbyMetadata } from '../sevens/types';
import { isSevensLobbyMetadata } from '../sevens/validation';
import type { HeartsLobbyMetadata } from '../hearts/types';
import { isHeartsLobbyMetadata } from '../hearts/validation';
import type { CreateSevensPolicyOptions } from '../sevens/sevens-policy';
import type { CreateHeartsPolicyOptions } from '../hearts/hearts-policy';
import { SevensVariant } from '@opengamesonline/sevens';

type GameDefinition<L> = {
  name: string; mark: string; description: string; players: string;
  isLobby(value: unknown): value is L;
  roomDetail(lobby: L): string;
};
/** Bind a game's lobby and creation options to its registration. */
export function defineRoomGame<L, O>(definition: GameDefinition<L>): GameDefinition<L> & { readonly __options?: O } {
  return definition;
}

/** Register game metadata and protocol validation in one place. */
export function defineRoomGames<const T extends Record<string, {
  name: string; mark: string; description: string; players: string;
  isLobby(value: unknown): boolean; roomDetail(lobby: never): string;
}>>(games: T): T {
  return games;
}
export function findRoomGame<T extends Record<string, { isLobby(value: unknown): boolean }>>(
  games: T, value: unknown,
): keyof T | null {
  for (const type of Object.keys(games) as (keyof T)[]) if (games[type]!.isLobby(value)) return type;
  return null;
}

export const GAME_INFO = defineRoomGames({
  sevens: defineRoomGame<SevensLobbyMetadata, CreateSevensPolicyOptions>({ name: 'Sevens', mark: '7♠', description: 'Build every suit from seven.', players: '3–7 players',
    isLobby: isSevensLobbyMetadata, roomDetail: (lobby) => `SEVENS · ${lobby.variant === SevensVariant.Joker ? 'JOKER' : 'STANDARD'}` }),
  hearts: defineRoomGame<HeartsLobbyMetadata, CreateHeartsPolicyOptions>({ name: 'Hearts', mark: '♥', description: 'Avoid hearts and the queen of spades.', players: '4 players · lowest score wins',
    isLobby: isHeartsLobbyMetadata, roomDetail: () => 'HEARTS · FIRST TO 100 ENDS THE MATCH' }),
});
export type GameType = keyof typeof GAME_INFO;
export type GameOptions<K extends GameType> = NonNullable<(typeof GAME_INFO)[K]['__options']>;
type LobbyOf<T> = T extends { isLobby(value: unknown): value is infer L } ? L : never;
export type RoomLobby = LobbyOf<(typeof GAME_INFO)[GameType]>;
export type DiscoveredRoom = DiscoveredGame<RoomLobby>;
export const GAME_TYPES = Object.keys(GAME_INFO) as GameType[];
export function isGameType(value: unknown): value is GameType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(GAME_INFO, value);
}
export function roomDetail(value: RoomLobby): string {
  for (const type of GAME_TYPES) {
    const definition = GAME_INFO[type] as GameDefinition<RoomLobby>;
    if (definition.isLobby(value)) return definition.roomDetail(value);
  }
  return '';
}
export function roomGameType(value: unknown): GameType | null {
  return findRoomGame(GAME_INFO, value);
}
export function isRoomLobby(value: unknown): value is RoomLobby { return roomGameType(value) !== null; }

export function filterRooms<T extends { name: string; lobbyMetadata: RoomLobby }>(rooms: readonly T[], game: GameType | 'all', query = ''): readonly T[] {
  const search = query.trim().toLowerCase();
  return rooms.filter((room) => (game === 'all' || roomGameType(room.lobbyMetadata) === game) && room.name.toLowerCase().includes(search));
}
