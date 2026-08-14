import { DarkTheme, DefaultTheme, Link, Stack, ThemeProvider, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { InAppNotifications } from '@/components/in-app-notifications';
import { ThemedView } from '@/components/themed-view';
import { GameProvider } from '@/game/game-provider';
import { migrateGameDbIfNeeded } from '@/game/persistence/migrations';
import { GAME_DATABASE_NAME } from '@/game/persistence/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const bottomNavigationHeight = 72;

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SafeAreaProvider>
        <SQLiteProvider databaseName={GAME_DATABASE_NAME} onInit={migrateGameDbIfNeeded}>
          <GameProvider>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <AppNavigator colorScheme={colorScheme} />
            <InAppNotifications />
          </GameProvider>
        </SQLiteProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function AppNavigator({ colorScheme }: { colorScheme: ReturnType<typeof useColorScheme> }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const showBottomNavigation = pathname !== '/';

  return (
    <View style={styles.navigator}>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerBackTitle: 'Back',
          contentStyle: {
            backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff',
            paddingBottom: showBottomNavigation ? bottomNavigationHeight + insets.bottom : 0,
          },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
      {showBottomNavigation ? <BottomHomeNavigation bottomInset={insets.bottom} /> : null}
    </View>
  );
}

function BottomHomeNavigation({ bottomInset }: { bottomInset: number }) {
  const theme = useTheme();

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.bottomNavigation, { paddingBottom: Math.max(bottomInset, 8) }]}>
      <Link href="/" dismissTo asChild>
        <Pressable
          accessibilityLabel="Go to phone home"
          accessibilityRole="button"
          style={({ pressed }) => [styles.homeButtonPressable, pressed && styles.pressed]}>
          <ThemedView type="backgroundSelected" style={styles.homeButtonSurface}>
            <View style={[styles.homeButtonDot, { backgroundColor: theme.text }]} />
          </ThemedView>
        </Pressable>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  navigator: {
    flex: 1,
  },
  bottomNavigation: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: bottomNavigationHeight,
    paddingTop: 8,
    alignItems: 'center',
  },
  homeButtonPressable: {
    borderRadius: 999,
  },
  homeButtonSurface: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  pressed: {
    opacity: 0.64,
    transform: [{ scale: 0.92 }],
  },
});
