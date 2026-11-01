import type { ReactNode } from 'react';
import { BusyIndicator, RoomScreen } from '@/components/room/room-ui';
import { GAME_ADAPTERS } from './game-adapters';
import { GAME_TYPES } from './registry';
import { useCardRoom } from './room-provider';

export function ActiveSession({ children }: { children: ReactNode }) {
  const { ready, gameType } = useCardRoom();
  if (!ready) return <RoomScreen><BusyIndicator /></RoomScreen>;
  // Keep the navigator mounted when selecting a game. Only the selected provider
  // starts a transport/recovery process; the inactive context has no side effects.
  return GAME_TYPES.reduceRight<ReactNode>((content, type) => {
    const Provider = GAME_ADAPTERS[type].Provider;
    return <Provider key={type} enabled={gameType === type}>{content}</Provider>;
  }, children);
}
