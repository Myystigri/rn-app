import { Href, Link, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { buildConversationDisplayItems } from '@/game/side-effects';
import { resolveStoryImage } from '@/game/story-images';
import { MessageEvent } from '@/game/types';
import { toDisplayName, useGame } from '@/game/game-provider';
import { useTheme } from '@/hooks/use-theme';

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const { conversationsById, choose } = useGame();
  const conversation = conversationId ? conversationsById[conversationId] : undefined;

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [conversation?.events.length, conversation?.pendingChoices.length, conversation?.activeTyping?.id]);

  if (!conversation) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredState}>
          <ThemedText type="subtitle">Thread missing</ThemedText>
          <ThemedText themeColor="textSecondary">
            The requested conversation is not registered.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const displayItems = buildConversationDisplayItems(conversation);

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          title: conversation.title,
          headerTitle: () => (
            <Link href={`/conversations/${conversation.id}/contact` as Href} asChild>
              <Pressable
                accessibilityLabel={`Open details for ${conversation.title}`}
                accessibilityRole="link"
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="default" numberOfLines={1}>
                  {conversation.title}
                </ThemedText>
              </Pressable>
            </Link>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {displayItems.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText type="smallBold">{conversation.title}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                No messages yet.
              </ThemedText>
            </View>
          ) : (
            displayItems.map((item) => (
              <MessageBubble
                key={item.id}
                event={item.event}
                isPlayer={item.event.direction === 'outgoing'}
                accentColor={theme.text}
              />
            ))
          )}

          {conversation.activeTyping ? (
            <TypingBubble speakerId={conversation.activeTyping.speakerId} />
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {conversation.pendingChoices.map((choice) => (
            <FooterButton
              key={choice.id}
              label={choice.text}
              onPress={() => choose(conversation.id, choice.id)}
            />
          ))}

        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function TypingBubble({ speakerId }: { speakerId: string }) {
  return (
    <View style={styles.bubbleRow}>
      <ThemedView type="backgroundElement" style={[styles.bubble, styles.typingBubble]}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.speakerLabel}>
          {toDisplayName(speakerId)}
        </ThemedText>
        <ThemedText themeColor="textSecondary">Typing...</ThemedText>
      </ThemedView>
    </View>
  );
}

function MessageBubble({
  event,
  isPlayer,
  accentColor,
}: {
  event: MessageEvent;
  isPlayer: boolean;
  accentColor: string;
}) {
  const imageSource = event.imagePath ? resolveStoryImage(event.imagePath) : undefined;

  return (
    <View style={[styles.bubbleRow, isPlayer && styles.bubbleRowPlayer]}>
      <ThemedView
        type={isPlayer ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.bubble, isPlayer && styles.bubblePlayer]}>
        <ThemedText
          type="smallBold"
          themeColor="textSecondary"
          style={[styles.speakerLabel, isPlayer && { color: accentColor }]}>
          {isPlayer ? 'You' : toDisplayName(event.speakerId)}
        </ThemedText>
        {imageSource ? <Image source={imageSource} contentFit="cover" style={styles.messageImage} /> : null}
        {event.text ? <ThemedText>{event.text}</ThemedText> : null}
      </ThemedView>
    </View>
  );
}

function FooterButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.choiceButton, pressed && styles.pressed]}>
      <ThemedView type="backgroundSelected" style={styles.choiceSurface}>
        <ThemedText style={styles.choiceText}>{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.one,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bubbleRowPlayer: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  bubblePlayer: {
    borderBottomRightRadius: 6,
  },
  messageImage: {
    width: 232,
    maxWidth: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
  },
  typingBubble: {
    minWidth: 120,
  },
  speakerLabel: {
    textTransform: 'capitalize',
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  choiceButton: {
    borderRadius: 16,
  },
  choiceSurface: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  choiceText: {
    lineHeight: 22,
  },
  pressed: {
    opacity: 0.72,
  },
});
