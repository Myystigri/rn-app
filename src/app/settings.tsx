import { Stack } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { delayProfiles } from '@/game/settings';
import { useGame } from '@/game/game-provider';
import { DelayProfileId } from '@/game/types';

const delayProfileIds = Object.keys(delayProfiles) as DelayProfileId[];

export default function SettingsScreen() {
  const { restartGame, settings, updateSettings } = useGame();

  function confirmRestart() {
    Alert.alert('Restart game?', 'This clears the current story progress and starts from the beginning.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', style: 'destructive', onPress: () => void restartGame() },
    ]);
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <ThemedView type="backgroundElement" style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="smallBold">Incoming messages</ThemedText>
              <ThemedText themeColor="textSecondary">
                Control typing previews and message delivery speed.
              </ThemedText>
            </View>

            <Pressable
              onPress={() =>
                updateSettings({
                  incomingMessageDelayEnabled: !settings.incomingMessageDelayEnabled,
                })
              }
              style={({ pressed }) => [styles.toggleButton, pressed && styles.pressed]}>
              <ThemedView
                type={settings.incomingMessageDelayEnabled ? 'backgroundSelected' : 'background'}
                style={styles.toggleSurface}>
                <ThemedText type="smallBold">
                  {settings.incomingMessageDelayEnabled ? 'Delay enabled' : 'Delay disabled'}
                </ThemedText>
              </ThemedView>
            </Pressable>

            <View style={styles.profileList}>
              {delayProfileIds.map((profileId) => {
                const profile = delayProfiles[profileId];
                const selected = settings.incomingMessageDelayProfile === profileId;

                return (
                  <Pressable
                    key={profileId}
                    onPress={() =>
                      updateSettings({
                        incomingMessageDelayProfile: profileId,
                      })
                    }
                    style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}>
                    <ThemedView
                      type={selected ? 'backgroundSelected' : 'background'}
                      style={styles.profileSurface}>
                      <ThemedText type="smallBold">{profile.label}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {profile.minDelayMs}ms to {profile.maxDelayMs}ms
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="smallBold">Game progress</ThemedText>
              <ThemedText themeColor="textSecondary">
                Clear the current story and return to the beginning.
              </ThemedText>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={confirmRestart}
              style={({ pressed }) => [styles.restartButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold">Restart game</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  section: {
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  sectionHeader: {
    gap: Spacing.one,
  },
  toggleButton: {
    borderRadius: 8,
  },
  toggleSurface: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  profileList: {
    gap: Spacing.two,
  },
  profileButton: {
    borderRadius: 8,
  },
  profileSurface: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.72,
  },
  restartButton: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C94242',
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
