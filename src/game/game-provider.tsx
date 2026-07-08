import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { conversationDefinitionById, conversationDefinitions, mainStoryDefinition } from '@/game/catalog';
import { InkStorySession } from '@/game/ink-session';
import { defaultGameSettings, getIncomingMessageDelayMs } from '@/game/settings';
import { loadGameSettings, saveGameSettings } from '@/game/persistence/game-settings-store';
import {
  deleteGameSnapshot,
  loadGameSnapshot,
  saveGameSnapshot,
} from '@/game/persistence/game-save-store';
import { ConversationState, GameSettings, MessageEvent, TypingEvent } from '@/game/types';

type GameContextValue = {
  conversations: ConversationState[];
  conversationsById: Record<string, ConversationState>;
  settings: GameSettings;
  startConversation: (conversationId: string) => Promise<void>;
  choose: (conversationId: string, choiceId: number) => Promise<void>;
  restartConversation: (conversationId: string) => Promise<void>;
  updateSettings: (nextSettings: Partial<GameSettings>) => Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);

type DeliveryRuntime = {
  activeTyping: TypingEvent | null;
  timerId: ReturnType<typeof setTimeout> | null;
  visibleEventCount: number;
};

function createIdleConversationState(definition: (typeof conversationDefinitions)[number]): ConversationState {
  return {
    id: definition.id,
    title: definition.title,
    status: 'idle',
    events: [],
    pendingChoices: [],
    activeTyping: null,
  };
}

function createInitialConversationState() {
  return Object.fromEntries(
    conversationDefinitions.map((definition) => [
      definition.id,
      createIdleConversationState(definition),
    ])
  ) as Record<string, ConversationState>;
}

function createInitialDeliveryRuntime() {
  return Object.fromEntries(
    conversationDefinitions.map((definition) => [definition.id, createDeliveryRuntime(0)])
  ) as Record<string, DeliveryRuntime>;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const storySessionRef = useRef<InkStorySession | null>(null);
  const deliveryRef = useRef<Record<string, DeliveryRuntime>>(createInitialDeliveryRuntime());
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const flushAllConversationDeliveryRef = useRef<() => void>(() => {});
  const clearAllDeliveryTimersRef = useRef<() => void>(() => {});
  const [conversationsById, setConversationsById] =
    useState<Record<string, ConversationState>>(createInitialConversationState);
  const [settings, setSettings] = useState<GameSettings>(defaultGameSettings);
  const [isHydrated, setIsHydrated] = useState(false);
  const settingsRef = useRef<GameSettings>(defaultGameSettings);

  useEffect(() => {
    flushAllConversationDeliveryRef.current = flushAllConversationDelivery;
    clearAllDeliveryTimersRef.current = clearAllDeliveryTimers;
  });

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      let nextStorySession = new InkStorySession(mainStoryDefinition, conversationDefinitions);
      const nextDelivery = createInitialDeliveryRuntime();
      let nextConversationsById = createInitialConversationState();

      try {
        const [snapshot, savedSettings] = await Promise.all([
          loadGameSnapshot(db),
          loadGameSettings(db),
        ]);

        if (snapshot) {
          try {
            nextStorySession = InkStorySession.restore(
              mainStoryDefinition,
              conversationDefinitions,
              snapshot
            );

            for (const definition of conversationDefinitions) {
              const conversationSnapshot = nextStorySession.conversationSnapshot(definition.id);
              if (!conversationSnapshot) {
                continue;
              }

              const visibleEventCount = clampVisibleEventCount(
                snapshot.conversationsById[definition.id]?.visibleEventCount ?? conversationSnapshot.events.length,
                conversationSnapshot.events.length
              );

              nextDelivery[definition.id] = createDeliveryRuntime(visibleEventCount);
              nextConversationsById[definition.id] = buildConversationState(
                conversationSnapshot,
                nextDelivery[definition.id]
              );
            }
          } catch (error) {
            console.error('Failed to restore shared Ink story state', error);
            await deleteGameSnapshot(db);
            nextStorySession = new InkStorySession(mainStoryDefinition, conversationDefinitions);
            nextConversationsById = createInitialConversationState();
          }
        }

        if (isMounted) {
          settingsRef.current = savedSettings;
          setSettings(savedSettings);
        }
      } catch (error) {
        console.error('Failed to hydrate game state from SQLite', error);
      }

      if (!isMounted) {
        return;
      }

      storySessionRef.current = nextStorySession;
      deliveryRef.current = nextDelivery;
      setConversationsById(nextConversationsById);
      setIsHydrated(true);
      flushAllConversationDeliveryRef.current();
    }

    void hydrate();

    return () => {
      isMounted = false;
      clearAllDeliveryTimersRef.current();
    };
  }, [db]);

  async function startConversation(conversationId: string) {
    if (!isHydrated || !conversationDefinitionById[conversationId]) {
      return;
    }

    const session = storySessionRef.current;
    if (!session) {
      return;
    }

    const conversation = session.conversationSnapshot(conversationId);
    if (conversation?.status === 'idle') {
      resetConversationDelivery(conversationId);
    }

    session.startConversation(conversationId);
    commitAllConversationStates();
    await persistGame();
    flushAllConversationDelivery();
  }

  async function choose(conversationId: string, choiceId: number) {
    if (!isHydrated) {
      return;
    }

    const session = storySessionRef.current;
    if (!session) {
      return;
    }

    session.choose(conversationId, choiceId);
    commitAllConversationStates();
    await persistGame();
    flushAllConversationDelivery();
  }

  async function restartConversation(conversationId: string) {
    if (!isHydrated || !conversationDefinitionById[conversationId]) {
      return;
    }

    clearAllDeliveryTimers();
    storySessionRef.current = new InkStorySession(mainStoryDefinition, conversationDefinitions);
    deliveryRef.current = createInitialDeliveryRuntime();
    setConversationsById(createInitialConversationState());

    await runGamePersistence(async () => {
      await deleteGameSnapshot(db);
    }, 'Failed to clear game state before restart');

    await startConversation(conversationId);
  }

  async function updateSettings(nextSettings: Partial<GameSettings>) {
    const mergedSettings = {
      ...settingsRef.current,
      ...nextSettings,
    };

    settingsRef.current = mergedSettings;
    setSettings(mergedSettings);

    try {
      await saveGameSettings(db, mergedSettings);
    } catch (error) {
      console.error('Failed to persist game settings', error);
    }

    for (const definition of conversationDefinitions) {
      const conversationId = definition.id;
      const runtime = deliveryRef.current[conversationId];
      if (!runtime || !runtime.activeTyping) {
        continue;
      }

      clearConversationDeliveryTimer(conversationId);
      runtime.activeTyping = null;
      commitConversationState(conversationId);
      flushConversationDelivery(conversationId);
    }
  }

  function commitConversationState(conversationId: string) {
    const session = storySessionRef.current;
    const runtime = deliveryRef.current[conversationId];
    const sessionState = session?.conversationSnapshot(conversationId);

    if (!sessionState || !runtime) {
      return;
    }

    const nextState = buildConversationState(sessionState, runtime);

    setConversationsById((current) => ({
      ...current,
      [conversationId]: nextState,
    }));
  }

  function commitAllConversationStates() {
    const session = storySessionRef.current;
    if (!session) {
      return;
    }

    setConversationsById((current) => {
      const nextConversationsById = { ...current };

      for (const definition of conversationDefinitions) {
        const sessionState = session.conversationSnapshot(definition.id);
        const runtime = deliveryRef.current[definition.id];

        if (!sessionState || !runtime) {
          continue;
        }

        nextConversationsById[definition.id] = buildConversationState(sessionState, runtime);
      }

      return nextConversationsById;
    });
  }

  async function persistGame() {
    const session = storySessionRef.current;
    if (!session) {
      return;
    }

    const visibleEventCounts = Object.fromEntries(
      conversationDefinitions.map((definition) => [
        definition.id,
        deliveryRef.current[definition.id]?.visibleEventCount ?? 0,
      ])
    ) as Record<string, number>;

    await runGamePersistence(async () => {
      await saveGameSnapshot(db, session.serialize(visibleEventCounts));
    }, 'Failed to persist game state');
  }

  if (!isHydrated) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <GameContext.Provider
      value={{
        conversations: conversationDefinitions.map((definition) => conversationsById[definition.id]),
        conversationsById,
        settings,
        startConversation,
        choose,
        restartConversation,
        updateSettings,
      }}>
      {children}
    </GameContext.Provider>
  );

  function flushAllConversationDelivery() {
    for (const definition of conversationDefinitions) {
      flushConversationDelivery(definition.id);
    }
  }

  function flushConversationDelivery(conversationId: string) {
    const session = storySessionRef.current;
    const runtime = deliveryRef.current[conversationId];

    if (!session || !runtime) {
      return;
    }

    clearConversationDeliveryTimer(conversationId);
    runtime.activeTyping = null;

    const sessionState = session.conversationSnapshot(conversationId);
    if (!sessionState) {
      return;
    }

    while (runtime.visibleEventCount < sessionState.events.length) {
      const nextEvent = sessionState.events[runtime.visibleEventCount];
      const delayMs = getEventDelayMs(nextEvent, settingsRef.current);

      if (delayMs > 0 && nextEvent.type === 'message') {
        runtime.activeTyping = {
          type: 'typing',
          id: `${nextEvent.id}.typing`,
          speakerId: nextEvent.speakerId,
          durationMs: delayMs,
        };
        commitConversationState(conversationId);
        runtime.timerId = setTimeout(() => {
          runtime.timerId = null;
          runtime.activeTyping = null;
          runtime.visibleEventCount += 1;
          commitConversationState(conversationId);
          void persistGame();
          flushConversationDelivery(conversationId);
        }, delayMs);
        return;
      }

      runtime.visibleEventCount += 1;
    }

    commitConversationState(conversationId);
    void persistGame();
  }

  function resetConversationDelivery(conversationId: string) {
    return prepareConversationDelivery(conversationId, 0);
  }

  function prepareConversationDelivery(conversationId: string, visibleEventCount: number) {
    clearConversationDeliveryTimer(conversationId);

    const runtime = createDeliveryRuntime(visibleEventCount);
    deliveryRef.current[conversationId] = runtime;
    return runtime;
  }

  function clearConversationDeliveryTimer(conversationId: string) {
    const runtime = deliveryRef.current[conversationId];
    if (!runtime?.timerId) {
      return;
    }

    clearTimeout(runtime.timerId);
    runtime.timerId = null;
  }

  function clearAllDeliveryTimers() {
    for (const definition of conversationDefinitions) {
      clearConversationDeliveryTimer(definition.id);
    }
  }

  async function runGamePersistence(task: () => Promise<void>, errorMessage: string) {
    const nextTask = persistenceQueueRef.current
      .catch(() => {})
      .then(task)
      .catch((error: unknown) => {
        console.error(errorMessage, error);
      });

    persistenceQueueRef.current = nextTask;
    await nextTask;
  }
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) {
    throw new Error('useGame must be used inside GameProvider');
  }

  return value;
}

export function getConversationPreview(conversation: ConversationState) {
  if (conversation.activeTyping) {
    return `${toDisplayName(conversation.activeTyping.speakerId)} is typing...`;
  }

  const latestMessage = [...conversation.events]
    .reverse()
    .find((event) => event.type === 'message');

  if (latestMessage?.type === 'message') {
    return latestMessage.text;
  }

  if (conversation.status === 'ended') {
    return 'Conversation complete';
  }

  return 'Open the thread and start the scene.';
}

function buildConversationState(
  sessionState: ConversationState,
  runtime: DeliveryRuntime
): ConversationState {
  const visibleEventCount = clampVisibleEventCount(runtime.visibleEventCount, sessionState.events.length);
  const hasPendingDeliveries = visibleEventCount < sessionState.events.length;

  return {
    ...sessionState,
    status: hasPendingDeliveries ? 'active' : sessionState.status,
    events: sessionState.events.slice(0, visibleEventCount),
    pendingChoices: hasPendingDeliveries ? [] : sessionState.pendingChoices,
    activeTyping: runtime.activeTyping,
  };
}

function createDeliveryRuntime(visibleEventCount: number): DeliveryRuntime {
  return {
    activeTyping: null,
    timerId: null,
    visibleEventCount,
  };
}

function clampVisibleEventCount(visibleEventCount: number, totalEventCount: number) {
  return Math.max(0, Math.min(visibleEventCount, totalEventCount));
}

function getEventDelayMs(event: ConversationState['events'][number], settings: GameSettings) {
  if (event.type !== 'message') {
    return 0;
  }

  return getIncomingMessageDelayMs(event as MessageEvent, settings);
}

export function toDisplayName(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
