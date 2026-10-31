import SevensHome from '@/features/sevens/home-screen';
import HeartsHome from '@/features/hearts/home-screen';
import { useCardRoom } from '@/features/card-room/room-provider';

export default function HomeScreen() {
  const { gameType } = useCardRoom();
  return gameType === 'sevens' ? <SevensHome /> : <HeartsHome />;
}
