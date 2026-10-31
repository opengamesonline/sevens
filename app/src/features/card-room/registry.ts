import type { DiscoveredGame } from '@opengamesonline/expo-lan-multiplayer';
import type { SevensLobbyMetadata } from '../sevens/types';
import { isSevensLobbyMetadata } from '../sevens/validation';
import type { HeartsLobbyMetadata } from '../hearts/types';
import { isHeartsLobbyMetadata } from '../hearts/validation';

export const GAME_TYPES = ['sevens', 'hearts'] as const;
export type GameType = typeof GAME_TYPES[number];
export type RoomLobby = SevensLobbyMetadata | HeartsLobbyMetadata;
export type DiscoveredRoom = DiscoveredGame<RoomLobby>;
export const GAME_INFO = {
  sevens: { name: 'Sevens', mark: '7♠', description: 'Build every suit from seven.', players: '3–7 players' },
  hearts: { name: 'Hearts', mark: '♥', description: 'Avoid hearts and the queen of spades.', players: '4 players · lowest score wins' },
} as const;
export function roomGameType(value: unknown): GameType | null {
  if (isSevensLobbyMetadata(value)) return 'sevens';
  if (isHeartsLobbyMetadata(value)) return 'hearts';
  return null;
}
export function isRoomLobby(value: unknown): value is RoomLobby { return roomGameType(value) !== null; }

export function filterRooms<T extends { name: string; lobbyMetadata: RoomLobby }>(rooms: readonly T[], game: GameType | 'all', query = ''): readonly T[] {
  const search = query.trim().toLowerCase();
  return rooms.filter((room) => (game === 'all' || roomGameType(room.lobbyMetadata) === game) && room.name.toLowerCase().includes(search));
}
