import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { conversationDefinitionById, conversationDefinitions } from '@/game/catalog';
import { InkConversationSession } from '@/game/ink-session';
import { ConversationState } from '@/game/types';
import {
  deleteConversationSnapshot,
  loadConversationSnapshots,
  saveConversationSnapshot,
} from '@/game/persistence/game-save-store';

type GameContextValue = {
  conversations: ConversationState[];
  conversationsById: Record<string, ConversationState>;
  startConversation: (conversationId: string) => Promise<void>;
  choose: (conversationId: string, choiceId: number) => Promise<void>;
  restartConversation: (conversationId: string) => Promise<void>;
};

const GameContext = createContext<GameContextValue | null>(null);

function createIdleConversationState(definition: (typeof conversationDefinitions)[number]): ConversationState {
  return {
    id: definition.id,
    title: definition.title,
    status: 'idle',
    events: [],
    pendingChoices: [],
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
  const [conversationsById, setConversationsById] =
    useState<Record<string, ConversationState>>(createInitialConversationState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const nextSessions: Record<string, InkConversationSession> = {};
      const nextConversationsById = createInitialConversationState();

      try {
        const snapshots = await loadConversationSnapshots(db);

        for (const definition of conversationDefinitions) {
          const snapshot = snapshots[definition.id];
          if (!snapshot) {
            continue;
          }

          try {
            const session = InkConversationSession.restore(definition, snapshot);
            nextSessions[definition.id] = session;
            nextConversationsById[definition.id] = session.snapshot();
          } catch (error) {
            console.error(`Failed to restore conversation "${definition.id}"`, error);
            await deleteConversationSnapshot(db, definition.id);
          }
        }
      } catch (error) {
        console.error('Failed to hydrate game state from SQLite', error);
      }

      if (!isMounted) {
        return;
      }

      sessionsRef.current = nextSessions;
      setConversationsById(nextConversationsById);
      setIsHydrated(true);
    }

    void hydrate();

    return () => {
      isMounted = false;
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
    const nextState = session.start();
    commitConversationState(conversationId, nextState);
    await persistConversation(conversationId, session);
  }

  async function choose(conversationId: string, choiceId: number) {
    if (!isHydrated) {
      return;
    }

    const session = sessionsRef.current[conversationId];
    if (!session) {
      return;
    }

    const nextState = session.choose(choiceId);
    commitConversationState(conversationId, nextState);
    await persistConversation(conversationId, session);
  }

  async function restartConversation(conversationId: string) {
    if (!isHydrated) {
      return;
    }

    delete sessionsRef.current[conversationId];

    await deleteConversationSnapshot(db, conversationId).catch((error: unknown) => {
      console.error(`Failed to clear conversation "${conversationId}" before restart`, error);
    });

    await startConversation(conversationId);
  }

  function commitConversationState(conversationId: string, nextState: ConversationState) {
    setConversationsById((current) => ({
      ...current,
      [conversationId]: nextState,
    }));
  }

  async function persistConversation(conversationId: string, session: InkConversationSession) {
    try {
      await saveConversationSnapshot(db, conversationId, session.serialize());
    } catch (error) {
      console.error(`Failed to persist conversation "${conversationId}"`, error);
    }
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
        startConversation,
        choose,
        restartConversation,
      }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const value = useContext(GameContext);
  if (!value) {
    throw new Error('useGame must be used inside GameProvider');
  }

  return value;
}

export function getConversationPreview(conversation: ConversationState) {
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

const styles = StyleSheet.create({
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
