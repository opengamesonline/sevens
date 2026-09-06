import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { GameColors } from '@/constants/theme';
import { SevensMultiplayerProvider } from '@/features/multiplayer';

export default function RootLayout() {
  return (
    <SevensMultiplayerProvider>
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
    </SevensMultiplayerProvider>
  );
}
