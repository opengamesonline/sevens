import SevensSession from '@/features/sevens/session-screen';
import HeartsSession from '@/features/hearts/session-screen';
import { useCardRoom } from '@/features/card-room/room-provider';

export default function SessionScreen() {
  const { gameType } = useCardRoom();
  return gameType === 'sevens' ? <SevensSession /> : <HeartsSession />;
}
