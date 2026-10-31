import { GAME_ADAPTERS } from '@/features/card-room/game-adapters';
import { useCardRoom } from '@/features/card-room/room-provider';

export default function SessionScreen() {
  const { gameType } = useCardRoom();
  const Session = GAME_ADAPTERS[gameType].Session;
  return <Session />;
}
