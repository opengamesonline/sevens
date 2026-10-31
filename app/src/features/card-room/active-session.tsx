import type { ReactNode } from 'react';
import { BusyIndicator, RoomScreen } from '@/components/room/room-ui';
import { SevensMultiplayerProvider } from '../sevens/session-provider';
import { HeartsMultiplayerProvider } from '../hearts/session-provider';
import { useCardRoom } from './room-provider';

export function ActiveSession({ children }: { children: ReactNode }) {
  const { ready, gameType } = useCardRoom();
  if (!ready) return <RoomScreen><BusyIndicator /></RoomScreen>;
  // Keep the navigator mounted when selecting a game. Only the selected provider
  // starts a transport/recovery process; the inactive context has no side effects.
  return <SevensMultiplayerProvider enabled={gameType === 'sevens'}>
    <HeartsMultiplayerProvider enabled={gameType === 'hearts'}>{children}</HeartsMultiplayerProvider>
  </SevensMultiplayerProvider>;
}
