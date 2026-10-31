import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { GameColors } from '@/constants/theme';
import { CardRoomProvider } from '@/features/card-room/room-provider';
import { ActiveSession } from '@/features/card-room/active-session';

export default function RootLayout() {
  return (
    <CardRoomProvider>
      <KeyboardProvider>
        <ActiveSession>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: GameColors.feltDeep },
            animation: 'fade_from_bottom',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="games" />
          <Stack.Screen name="session" options={{ gestureEnabled: false }} />
        </Stack>
        </ActiveSession>
      </KeyboardProvider>
    </CardRoomProvider>
  );
}
