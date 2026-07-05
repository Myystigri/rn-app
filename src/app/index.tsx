import { Href, Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getConversationPreview, useGame } from '@/game/game-provider';
import { useTheme } from '@/hooks/use-theme';

export default function InboxScreen() {
  const theme = useTheme();
  const { conversations } = useGame();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            MYYST
          </ThemedText>
          <ThemedText type="subtitle">Messages</ThemedText>
          <ThemedText themeColor="textSecondary">
            One barebones thread wired to Ink.
          </ThemedText>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {conversations.map((conversation) => {
            const preview = getConversationPreview(conversation);
            const statusLabel =
              conversation.status === 'idle'
                ? 'Tap to start'
                : conversation.status === 'ended'
                  ? 'Scene finished'
                  : 'Live';

            return (
              <Link
                key={conversation.id}
                href={`/conversations/${conversation.id}` as Href}
                asChild>
                <Pressable style={({ pressed }) => [styles.threadRow, pressed && styles.pressed]}>
                  <ThemedView type="backgroundElement" style={styles.avatar}>
                    <ThemedText type="smallBold">{conversation.title.slice(0, 1)}</ThemedText>
                  </ThemedView>

                  <View style={styles.threadContent}>
                    <View style={styles.threadMeta}>
                      <ThemedText type="smallBold">{conversation.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {statusLabel}
                      </ThemedText>
                    </View>

                    <ThemedText
                      numberOfLines={2}
                      style={[styles.previewText, { color: theme.text }]}
                      themeColor="textSecondary">
                      {preview}
                    </ThemedText>
                  </View>
                </Pressable>
              </Link>
            );
          })}
        </ScrollView>
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
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#9095A133',
  },
  pressed: {
    opacity: 0.75,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadContent: {
    flex: 1,
    gap: Spacing.half,
  },
  threadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  previewText: {
    lineHeight: 20,
  },
});
