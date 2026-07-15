import { Href, Link, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { buildConversationDisplayItems, ConversationDisplayItem } from '@/game/side-effects';
import { resolveStoryImage } from '@/game/story-images';
import { MessageEvent } from '@/game/types';
import { toDisplayName, useGame } from '@/game/game-provider';
import { useTheme } from '@/hooks/use-theme';

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    conversationsById,
    conversationTimelineById,
    startConversation,
    choose,
    restartConversation,
  } = useGame();
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

  const displayItems = buildConversationDisplayItems(
    conversation,
    conversationTimelineById[conversation.id] ?? []
  );

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: conversation.title }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <Link href={`/conversations/${conversation.id}/contact` as Href} asChild>
          <Pressable style={({ pressed }) => [styles.contactHeader, pressed && styles.pressed]}>
            <ThemedText type="smallBold">{conversation.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Contact details
            </ThemedText>
          </Pressable>
        </Link>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {displayItems.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText type="smallBold">{conversation.title}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Enter the thread, then start the scene to let Ink drive the messages.
              </ThemedText>
            </View>
          ) : (
            displayItems.map((item) =>
              item.type === 'message' ? (
                <MessageBubble
                  key={item.id}
                  event={item.event}
                  isPlayer={item.event.direction === 'outgoing'}
                  accentColor={theme.text}
                />
              ) : (
                <TimelineMarker key={item.id} item={item} />
              )
            )
          )}

          {conversation.activeTyping ? (
            <TypingBubble speakerId={conversation.activeTyping.speakerId} />
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {conversation.status === 'idle' ? (
            <FooterButton label="Start scene" onPress={() => startConversation(conversation.id)} />
          ) : null}

          {conversation.pendingChoices.map((choice) => (
            <FooterButton
              key={choice.id}
              label={choice.text}
              onPress={() => choose(conversation.id, choice.id)}
            />
          ))}

          {conversation.status !== 'idle' ? (
            <Pressable
              onPress={() => restartConversation(conversation.id)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold">Restart</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function TimelineMarker({ item }: { item: Extract<ConversationDisplayItem, { type: 'meta' }> }) {
  return (
    <View style={styles.metaRow}>
      <ThemedView type="backgroundElement" style={styles.metaSurface}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {toMetaLabel(item.eventType)}
        </ThemedText>
        <ThemedText>{item.title}</ThemedText>
        {item.detail ? (
          <ThemedText type="small" themeColor="textSecondary">
            {item.detail}
          </ThemedText>
        ) : null}
      </ThemedView>
    </View>
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

function toMetaLabel(eventType: Extract<ConversationDisplayItem, { type: 'meta' }>['eventType']) {
  if (eventType === 'notification') {
    return 'Notification';
  }

  if (eventType === 'unlock-app') {
    return 'Unlocked';
  }

  if (eventType === 'unlock-conversation') {
    return 'New conversation';
  }

  return 'Status';
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
  contactHeader: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: Spacing.half,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#9095A133',
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
  metaRow: {
    alignItems: 'center',
  },
  metaSurface: {
    maxWidth: '92%',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: Spacing.half,
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
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.72,
  },
});
