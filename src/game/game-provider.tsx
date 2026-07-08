import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { conversationDefinitionById, conversationDefinitions } from '@/game/catalog';
import { InkConversationSession } from '@/game/ink-session';
import { defaultGameSettings, getIncomingMessageDelayMs } from '@/game/settings';
import { loadGameSettings, saveGameSettings } from '@/game/persistence/game-settings-store';
import {
  deleteConversationSnapshot,
  loadConversationSnapshots,
  saveConversationSnapshot,
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

export function GameProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const sessionsRef = useRef<Record<string, InkConversationSession>>({});
  const deliveryRef = useRef<Record<string, DeliveryRuntime>>({});
  const persistenceQueueRef = useRef<Record<string, Promise<void>>>({});
  const flushConversationDeliveryRef = useRef<
    (
      conversationId: string,
      activeSessions?: Record<string, InkConversationSession>,
      activeDelivery?: Record<string, DeliveryRuntime>
    ) => void
  >(() => {});
  const clearAllDeliveryTimersRef = useRef<() => void>(() => {});
  const [conversationsById, setConversationsById] =
    useState<Record<string, ConversationState>>(createInitialConversationState);
  const [settings, setSettings] = useState<GameSettings>(defaultGameSettings);
  const [isHydrated, setIsHydrated] = useState(false);
  const settingsRef = useRef<GameSettings>(defaultGameSettings);

  useEffect(() => {
    flushConversationDeliveryRef.current = flushConversationDelivery;
    clearAllDeliveryTimersRef.current = clearAllDeliveryTimers;
  });

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const nextSessions: Record<string, InkConversationSession> = {};
      const nextDelivery: Record<string, DeliveryRuntime> = {};
      const nextConversationsById = createInitialConversationState();

      try {
        const [snapshots, savedSettings] = await Promise.all([
          loadConversationSnapshots(db),
          loadGameSettings(db),
        ]);

        for (const definition of conversationDefinitions) {
          const snapshot = snapshots[definition.id];
          if (!snapshot) {
            continue;
          }

          try {
            const session = InkConversationSession.restore(definition, snapshot);
            const sessionState = session.snapshot();
            const visibleEventCount = clampVisibleEventCount(
              snapshot.visibleEventCount,
              sessionState.events.length
            );

            nextSessions[definition.id] = session;
            nextDelivery[definition.id] = createDeliveryRuntime(visibleEventCount);
            nextConversationsById[definition.id] = buildConversationState(
              sessionState,
              nextDelivery[definition.id]
            );
          } catch (error) {
            console.error(`Failed to restore conversation "${definition.id}"`, error);
            await deleteConversationSnapshot(db, definition.id);
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

      sessionsRef.current = nextSessions;
      deliveryRef.current = nextDelivery;
      setConversationsById(nextConversationsById);
      setIsHydrated(true);

      for (const definition of conversationDefinitions) {
        flushConversationDeliveryRef.current(definition.id, nextSessions, nextDelivery);
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
      clearAllDeliveryTimersRef.current();
    };
  }, [db]);

  async function startConversation(conversationId: string) {
    if (!isHydrated) {
      return;
    }

    const definition = conversationDefinitionById[conversationId];
    if (!definition) {
      return;
    }

    const session = new InkConversationSession(definition);
    sessionsRef.current[conversationId] = session;
    const runtime = resetConversationDelivery(conversationId);
    session.start();
    commitConversationState(conversationId);
    await persistConversation(conversationId, session, runtime.visibleEventCount);
    flushConversationDelivery(conversationId);
  }

  async function choose(conversationId: string, choiceId: number) {
    if (!isHydrated) {
      return;
    }

    const session = sessionsRef.current[conversationId];
    if (!session) {
      return;
    }

    const visibleEventCount = deliveryRef.current[conversationId]?.visibleEventCount ?? 0;
    const runtime = prepareConversationDelivery(conversationId, visibleEventCount);
    session.choose(choiceId);
    commitConversationState(conversationId);
    await persistConversation(conversationId, session, runtime.visibleEventCount);
    flushConversationDelivery(conversationId);
  }

  async function restartConversation(conversationId: string) {
    if (!isHydrated) {
      return;
    }

    delete sessionsRef.current[conversationId];
    clearConversationDeliveryTimer(conversationId);
    delete deliveryRef.current[conversationId];

    await runConversationPersistence(conversationId, async () => {
      await deleteConversationSnapshot(db, conversationId);
    }, `Failed to clear conversation "${conversationId}" before restart`);

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
    const session = sessionsRef.current[conversationId];
    const runtime = deliveryRef.current[conversationId];

    if (!session || !runtime) {
      return;
    }

    const nextState = buildConversationState(session.snapshot(), runtime);

    setConversationsById((current) => ({
      ...current,
      [conversationId]: nextState,
    }));
  }

  async function persistConversation(
    conversationId: string,
    session: InkConversationSession,
    visibleEventCount: number
  ) {
    await runConversationPersistence(conversationId, async () => {
      await saveConversationSnapshot(db, conversationId, {
        ...session.serialize(),
        visibleEventCount,
      });
    }, `Failed to persist conversation "${conversationId}"`);
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

  function flushConversationDelivery(
    conversationId: string,
    activeSessions = sessionsRef.current,
    activeDelivery = deliveryRef.current
  ) {
    const session = activeSessions[conversationId];
    const runtime = activeDelivery[conversationId];

    if (!session || !runtime) {
      return;
    }

    clearConversationDeliveryTimer(conversationId, activeDelivery);
    runtime.activeTyping = null;

    const sessionState = session.snapshot();

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
          void persistConversation(conversationId, session, runtime.visibleEventCount);
          flushConversationDelivery(conversationId);
        }, delayMs);
        return;
      }

      runtime.visibleEventCount += 1;
    }

    commitConversationState(conversationId);
    void persistConversation(conversationId, session, runtime.visibleEventCount);
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

  function clearConversationDeliveryTimer(
    conversationId: string,
    activeDelivery = deliveryRef.current
  ) {
    const runtime = activeDelivery[conversationId];
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

  async function runConversationPersistence(
    conversationId: string,
    task: () => Promise<void>,
    errorMessage: string
  ) {
    const previousTask = persistenceQueueRef.current[conversationId] ?? Promise.resolve();
    const nextTask = previousTask
      .catch(() => {})
      .then(task)
      .catch((error: unknown) => {
        console.error(errorMessage, error);
      });

    persistenceQueueRef.current[conversationId] = nextTask;
    await nextTask;

    if (persistenceQueueRef.current[conversationId] === nextTask) {
      delete persistenceQueueRef.current[conversationId];
    }
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
