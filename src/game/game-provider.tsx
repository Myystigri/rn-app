import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import {
  conversationDefinitionById,
  conversationDefinitions,
  mainStoryDefinition,
  phoneAppDefinitionById,
  phoneAppDefinitions,
} from '@/game/catalog';
import {
  buildConversationState,
  clearPendingDelivery,
  createDeliveryRuntime,
  DeliveryRuntime,
  getEventDelayMs,
  hasDuePendingDelivery,
  markEventDelivered,
  reconcileDeliveryRuntime,
  resetDeliveryRuntime,
  scheduleDelayedDelivery,
  toPersistedDeliveryState,
} from '@/game/delivery';
import { InkStorySession } from '@/game/ink-session';
import { loadGameSettings, saveGameSettings } from '@/game/persistence/game-settings-store';
import { loadContactNames, saveContactNames } from '@/game/persistence/contact-store';
import {
  deleteGameSnapshot,
  loadGameSnapshot,
  saveGameSnapshot,
} from '@/game/persistence/game-save-store';
import {
  buildPhoneApps,
  createInitialSideEffectsState,
  reduceGameSideEffects,
} from '@/game/side-effects';
import { defaultGameSettings } from '@/game/settings';
import {
  ConversationState,
  ConversationTimelineEntry,
  GameSettings,
  NotificationEvent,
  PhoneAppState,
} from '@/game/types';

type GameContextValue = {
  conversations: ConversationState[];
  conversationsById: Record<string, ConversationState>;
  apps: PhoneAppState[];
  notifications: NotificationEvent[];
  conversationTimelineById: Record<string, ConversationTimelineEntry[]>;
  settings: GameSettings;
  startConversation: (conversationId: string) => Promise<void>;
  choose: (conversationId: string, choiceId: number) => Promise<void>;
  restartConversation: (conversationId: string) => Promise<void>;
  updateSettings: (nextSettings: Partial<GameSettings>) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);

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
    conversationDefinitions.map((definition) => [definition.id, createDeliveryRuntime()])
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
  const [sideEffects, setSideEffects] = useState(createInitialSideEffectsState);
  const [settings, setSettings] = useState<GameSettings>(defaultGameSettings);
  const [isHydrated, setIsHydrated] = useState(false);
  const settingsRef = useRef<GameSettings>(defaultGameSettings);
  const contactNamesRef = useRef<Record<string, string>>({});
  const apps = buildPhoneApps(phoneAppDefinitions, sideEffects);

  useEffect(() => {
    flushAllConversationDeliveryRef.current = flushAllConversationDelivery;
    clearAllDeliveryTimersRef.current = clearAllDeliveryTimers;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        flushAllConversationDeliveryRef.current();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      let nextStorySession = new InkStorySession(mainStoryDefinition, conversationDefinitions);
      const nextDelivery = createInitialDeliveryRuntime();
      let nextConversationsById = createInitialConversationState();

      try {
        const [snapshot, savedSettings, savedContactNames] = await Promise.all([
          loadGameSnapshot(db),
          loadGameSettings(db),
          loadContactNames(db),
        ]);
        contactNamesRef.current = savedContactNames;

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

              nextDelivery[definition.id] = createDeliveryRuntime(
                snapshot.conversationsById[definition.id]?.delivery ?? {
                  visibleEventCount: conversationSnapshot.events.length,
                }
              );
              reconcileDeliveryRuntime(
                nextDelivery[definition.id],
                conversationSnapshot,
                savedSettings
              );
              nextConversationsById[definition.id] = applyContactTitle(buildConversationState(
                conversationSnapshot,
                nextDelivery[definition.id]
              ), savedContactNames[definition.id]);
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
      setConversationsById(applyContactTitles(nextConversationsById, contactNamesRef.current));
      setSideEffects(reduceGameSideEffects(nextConversationsById, phoneAppDefinitionById));
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
    commitAllConversationStates(session);
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
    commitAllConversationStates(session);
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
    setSideEffects(createInitialSideEffectsState());

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
      if (!runtime) {
        continue;
      }

      clearConversationDeliveryTimer(conversationId);
      clearPendingDelivery(runtime);
    }

    flushAllConversationDelivery();
  }

  async function renameConversation(conversationId: string, title: string) {
    if (!conversationDefinitionById[conversationId]) {
      return;
    }

    const trimmedTitle = title.trim();
    const nextContactNames = { ...contactNamesRef.current };
    if (trimmedTitle) {
      nextContactNames[conversationId] = trimmedTitle;
    } else {
      delete nextContactNames[conversationId];
    }

    contactNamesRef.current = nextContactNames;
    setConversationsById((current) => applyContactTitles(current, nextContactNames));
    await saveContactNames(db, nextContactNames);
  }

  function commitAllConversationStates(session = storySessionRef.current) {
    if (!session) {
      return;
    }

    const nextConversationsById = { ...createInitialConversationState() };

    for (const definition of conversationDefinitions) {
      const sessionState = session.conversationSnapshot(definition.id);
      const runtime = deliveryRef.current[definition.id];

      if (!sessionState || !runtime) {
        continue;
      }

      nextConversationsById[definition.id] = applyContactTitle(
        buildConversationState(sessionState, runtime),
        contactNamesRef.current[definition.id]
      );
    }

    setConversationsById(nextConversationsById);
    setSideEffects(reduceGameSideEffects(nextConversationsById, phoneAppDefinitionById));
  }

  async function persistGame() {
    const session = storySessionRef.current;
    if (!session) {
      return;
    }

    const deliveryByConversationId = Object.fromEntries(
      conversationDefinitions.map((definition) => [
        definition.id,
        toPersistedDeliveryState(deliveryRef.current[definition.id] ?? createDeliveryRuntime()),
      ])
    );

    await runGamePersistence(async () => {
      await saveGameSnapshot(db, session.serialize(deliveryByConversationId));
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
        conversations: conversationDefinitions
          .filter((definition) => isConversationUnlocked(definition.id, sideEffects.unlockedConversationIds))
          .map((definition) => conversationsById[definition.id]),
        conversationsById,
        apps,
        notifications: sideEffects.notifications,
        conversationTimelineById: sideEffects.timelineByConversationId,
        settings,
        startConversation,
        choose,
        restartConversation,
        updateSettings,
        renameConversation,
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

    const sessionState = session.conversationSnapshot(conversationId);
    if (!sessionState) {
      return;
    }

    reconcileDeliveryRuntime(runtime, sessionState, settingsRef.current);

    while (runtime.visibleEventCount < sessionState.events.length) {
      const nextEvent = sessionState.events[runtime.visibleEventCount];
      const now = new Date();

      if (hasDuePendingDelivery(runtime, nextEvent, now)) {
        markEventDelivered(runtime, now);
        continue;
      }

      const delayMs = getEventDelayMs(nextEvent, settingsRef.current);

      if (delayMs > 0 && nextEvent.type === 'message') {
        if (runtime.pendingEventId !== nextEvent.id || !runtime.availableAt) {
          scheduleDelayedDelivery(runtime, nextEvent, delayMs, now);
        } else {
          reconcileDeliveryRuntime(runtime, sessionState, settingsRef.current, now);
        }

        const availableAtMs = Date.parse(runtime.availableAt ?? '');
        if (!Number.isFinite(availableAtMs) || availableAtMs <= now.getTime()) {
          markEventDelivered(runtime, now);
          continue;
        }

        commitAllConversationStates(session);
        runtime.timerId = setTimeout(() => {
          runtime.timerId = null;
          markEventDelivered(runtime, new Date());
          commitAllConversationStates(session);
          void persistGame();
          flushConversationDelivery(conversationId);
        }, Math.max(0, availableAtMs - now.getTime()));
        void persistGame();
        return;
      }

      markEventDelivered(runtime, now);
    }

    commitAllConversationStates(session);
    void persistGame();
  }

  function resetConversationDelivery(conversationId: string) {
    const runtime = deliveryRef.current[conversationId] ?? createDeliveryRuntime();
    clearConversationDeliveryTimer(conversationId);
    resetDeliveryRuntime(runtime, 0);
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

function applyContactTitle(conversation: ConversationState, customTitle?: string) {
  return customTitle ? { ...conversation, title: customTitle } : conversation;
}

function applyContactTitles(
  conversations: Record<string, ConversationState>,
  names: Record<string, string>
) {
  return Object.fromEntries(
    Object.entries(conversations).map(([id, conversation]) => [id, applyContactTitle(conversation, names[id])])
  ) as Record<string, ConversationState>;
}

function isConversationUnlocked(conversationId: string, unlockedConversationIds: string[]) {
  const definition = conversationDefinitionById[conversationId];
  return Boolean(definition?.unlockedByDefault || unlockedConversationIds.includes(conversationId));
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
