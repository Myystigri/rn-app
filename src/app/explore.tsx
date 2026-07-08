import { Href, Link, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGame } from '@/game/game-provider';
import { NotificationEvent, PhoneAppState } from '@/game/types';

export default function ExploreScreen() {
  const { apps, notifications } = useGame();
  const recentNotifications = [...notifications].reverse();

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Phone' }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              MYYST
            </ThemedText>
            <ThemedText type="subtitle">Phone</ThemedText>
            <ThemedText themeColor="textSecondary">
              Unlocked apps and recent system activity.
            </ThemedText>
          </View>

          <View style={styles.appGrid}>
            {apps.map((app) => (
              <AppTile key={app.id} app={app} />
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <ThemedText type="smallBold">Notifications</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {recentNotifications.length === 0
                ? 'No system alerts yet.'
                : `${recentNotifications.length} stored`}
            </ThemedText>
          </View>

          <View style={styles.notificationList}>
            {recentNotifications.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyNotification}>
                <ThemedText themeColor="textSecondary">
                  Story-driven alerts will appear here.
                </ThemedText>
              </ThemedView>
            ) : (
              recentNotifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function AppTile({ app }: { app: PhoneAppState }) {
  const tile = (
    <ThemedView
      type={app.isUnlocked ? 'backgroundElement' : 'background'}
      style={[styles.appTile, !app.isUnlocked && styles.appTileLocked]}>
      <View style={styles.appTileTopRow}>
        <ThemedText type="smallBold">{app.title}</ThemedText>
        {app.badgeCount > 0 ? (
          <ThemedView type="backgroundSelected" style={styles.badge}>
            <ThemedText type="smallBold">{app.badgeCount}</ThemedText>
          </ThemedView>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {app.isUnlocked ? app.description : 'Locked'}
      </ThemedText>
    </ThemedView>
  );

  if (app.isUnlocked && app.route) {
    return (
      <Link href={app.route as Href} asChild>
        <Pressable style={({ pressed }) => [styles.tilePressable, pressed && styles.pressed]}>
          {tile}
        </Pressable>
      </Link>
    );
  }

  return <View style={styles.tilePressable}>{tile}</View>;
}

function NotificationCard({ notification }: { notification: NotificationEvent }) {
  return (
    <ThemedView type="backgroundElement" style={styles.notificationCard}>
      <ThemedText type="smallBold">{notification.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {notification.body}
      </ThemedText>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.three,
  },
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tilePressable: {
    width: '48%',
  },
  appTile: {
    minHeight: 118,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  appTileLocked: {
    opacity: 0.56,
  },
  appTileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  badge: {
    minWidth: 24,
    borderRadius: 999,
    paddingHorizontal: Spacing.one,
    paddingVertical: 1,
    alignItems: 'center',
  },
  sectionHeader: {
    gap: Spacing.half,
  },
  notificationList: {
    gap: Spacing.two,
  },
  notificationCard: {
    borderRadius: 8,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  emptyNotification: {
    borderRadius: 8,
    padding: Spacing.three,
  },
  pressed: {
    opacity: 0.72,
  },
});
