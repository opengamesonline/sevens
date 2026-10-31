import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BrandHeader, BusyIndicator, ErrorBanner, RolePicker, RoomButton, RoomInput, RoomPanel, RoomScreen } from '@/components/room/room-ui';
import { GameColors } from '@/constants/theme';
import { GamePicker } from '../card-room/game-picker';
import { useHeartsMultiplayer } from './session-provider';

export default function HeartsHome() {
  const room = useHeartsMultiplayer();
  const [gameName, setGameName] = useState('Hearts Table');
  const [role, setRole] = useState<'player' | 'spectator'>('player');
  const [error, setError] = useState<string | null>(null);
  async function create() {
    if (!room.username.trim() || !gameName.trim()) { setError('Enter your name and a room name.'); return; }
    setError(null);
    if (await room.create({ gameName: gameName.trim(), participantName: room.username.trim(), role })) router.push('/session');
  }
  async function discover() {
    if (!room.username.trim()) { setError('Enter your name first.'); return; }
    if (await room.discover()) router.push('/games');
  }
  return <RoomScreen>
    <BrandHeader eyebrow="BY DRASO LABS" title="Card Room" />
    <GamePicker disabled={room.busy} />
    <RoomPanel>
      <Text style={styles.title}>Hearts</Text>
      <Text style={styles.body}>Avoid hearts and the queen of spades. Four seats, filled by friends or bots.</Text>
      <Text style={styles.body}>Pass three cards left, right, across, then hold. Lowest score wins when someone reaches 100.</Text>
      <Text style={styles.body}>2♣ leads. Follow suit. No penalty cards on the first trick unless forced; hearts cannot lead until broken (or only hearts remain).</Text>
    </RoomPanel>
    <ErrorBanner message={error ?? room.error} />
    <RoomPanel>
      <RoomInput label="YOUR NAME" value={room.username} onChangeText={room.setUsername} maxLength={24} />
      <RoomInput label="ROOM NAME" value={gameName} onChangeText={setGameName} maxLength={40} />
      <RolePicker value={role} onChange={setRole} />
      <RoomButton label="Create Hearts room" variant="primary" disabled={room.busy} onPress={() => void create()} />
      <RoomButton label="Find nearby rooms" disabled={room.busy} onPress={() => void discover()} />
      {room.busy ? <BusyIndicator /> : null}
    </RoomPanel>
  </RoomScreen>;
}
const styles = StyleSheet.create({ title: { color: GameColors.cream, fontSize: 30, fontWeight: '700' }, body: { color: GameColors.whiteMuted, lineHeight: 21 } });
