import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { MessageEvent } from '@/game/types';
import { useGame } from '@/game/game-provider';
import { useTheme } from '@/hooks/use-theme';

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const { conversationsById, startConversation, choose, restartConversation } = useGame();
  const conversation = conversationId ? conversationsById[conversationId] : undefined;

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [conversation?.events.length, conversation?.pendingChoices.length]);

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

  const messageEvents = conversation.events.filter(
    (event): event is MessageEvent => event.type === 'message'
  );

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: conversation.title }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {messageEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText type="smallBold">{conversation.title}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Enter the thread, then start the scene to let Ink drive the messages.
              </ThemedText>
            </View>
          ) : (
            messageEvents.map((event) => (
              <MessageBubble
                key={event.id}
                event={event}
                isPlayer={event.direction === 'outgoing'}
                accentColor={theme.text}
              />
            ))
          )}
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

          {conversation.status === 'ended' ? (
            <ThemedView type="backgroundElement" style={styles.sceneEnded}>
              <ThemedText type="small" themeColor="textSecondary">
                Scene ended
              </ThemedText>
            </ThemedView>
          ) : null}

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

function MessageBubble({
  event,
  isPlayer,
  accentColor,
}: {
  event: MessageEvent;
  isPlayer: boolean;
  accentColor: string;
}) {
  return (
    <View style={[styles.bubbleRow, isPlayer && styles.bubbleRowPlayer]}>
      <ThemedView
        type={isPlayer ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.bubble, isPlayer && styles.bubblePlayer]}>
        <ThemedText
          type="smallBold"
          themeColor="textSecondary"
          style={[styles.speakerLabel, isPlayer && { color: accentColor }]}>
          {isPlayer ? 'You' : event.speakerId}
        </ThemedText>
        <ThemedText>{event.text}</ThemedText>
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
  sceneEnded: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.72,
  },
});
