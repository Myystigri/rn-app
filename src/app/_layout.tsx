import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';

import { GameProvider } from '@/game/game-provider';
import { migrateGameDbIfNeeded } from '@/game/persistence/migrations';
import { GAME_DATABASE_NAME } from '@/game/persistence/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SQLiteProvider databaseName={GAME_DATABASE_NAME} onInit={migrateGameDbIfNeeded}>
        <GameProvider>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShadowVisible: false,
              headerBackTitle: 'Inbox',
              contentStyle: {
                backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff',
              },
            }}
          />
        </GameProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
