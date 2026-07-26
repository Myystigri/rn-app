import { Href, Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGame } from '@/game/game-provider';
import { PhoneAppState } from '@/game/types';
import { useTheme } from '@/hooks/use-theme';

const appColumnCount = 4;
const appColumnGap = Spacing.three;
const maxHomeContentWidth = 528;

export default function PhoneHomeScreen() {
  const theme = useTheme();
  const { apps } = useGame();
  const unlockedApps = apps.filter((app) => app.isUnlocked);
  const appRows = Array.from(
    { length: Math.ceil(unlockedApps.length / appColumnCount) },
    (_, rowIndex) =>
      unlockedApps.slice(rowIndex * appColumnCount, (rowIndex + 1) * appColumnCount)
  );

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.homeContent}
          showsVerticalScrollIndicator={false}>

          <View style={styles.appGrid}>
            {appRows.map((row, rowIndex) => (
              <View key={row[0]?.id ?? rowIndex} style={styles.appRow}>
                {row.map((app) => (
                  <HomeApp key={app.id} app={app} badgeColor={theme.background} />
                ))}
                {Array.from({ length: appColumnCount - row.length }, (_, emptyIndex) => (
                  <View key={`empty-${emptyIndex}`} style={styles.appCell} />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function HomeApp({
  app,
  badgeColor,
}: {
  app: PhoneAppState;
  badgeColor: string;
}) {
  const appContents = (
    <View style={styles.appContents}>
      <View style={[styles.icon, { backgroundColor: app.icon.backgroundColor }]}>
        <ThemedText style={[styles.iconGlyph, { color: app.icon.foregroundColor }]}>
          {app.icon.glyph}
        </ThemedText>
        {app.badgeCount > 0 ? (
          <View style={[styles.badge, { borderColor: badgeColor }]}>
            <ThemedText style={styles.badgeText}>{app.badgeCount}</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText type="default" numberOfLines={1} style={styles.appLabel}>
        {app.title}
      </ThemedText>
    </View>
  );

  return (
    <View style={styles.appCell}>
      {app.route ? (
        <Link href={app.route as Href} asChild>
          <Pressable
            accessibilityLabel={`Open ${app.title}`}
            accessibilityRole="link"
            style={({ pressed }) => [styles.appButton, pressed && styles.pressed]}>
            {appContents}
          </Pressable>
        </Link>
      ) : (
        <View
          accessibilityLabel={`${app.title}, not available yet`}
          style={styles.appButton}>
          {appContents}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  scrollView: {
    flex: 1,
  },
  homeContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: maxHomeContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five,
  },
  homeCopy: {
    gap: Spacing.one,
    marginBottom: Spacing.six,
  },
  appGrid: {
    rowGap: Spacing.four,
  },
  appRow: {
    flexDirection: 'row',
    columnGap: appColumnGap,
  },
  appCell: {
    flex: 1,
    minWidth: 0,
  },
  appButton: {
    width: '100%',
  },
  appContents: {
    width: '100%',
    minWidth: 0,
    alignItems: 'center',
    gap: Spacing.two,
  },
  icon: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  iconGlyph: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -3,
    lineHeight: 42,
    marginTop: -4,
  },
  badge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 28,
    height: 28,
    paddingHorizontal: Spacing.one,
    borderRadius: 14,
    borderWidth: 3,
    backgroundColor: '#D63B3B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
  },
  appLabel: {
    maxWidth: '100%',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.96 }],
  },
});
