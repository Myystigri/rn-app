import { Story } from 'inkjs';

import {
  ConversationDefinition,
  ConversationState,
  GameEvent,
  MessageDirection,
  PendingChoice,
  PersistedDeliveryState,
  StoryDefinition,
} from '@/game/types';

type ParsedTags = Record<string, string>;

export type ConversationSessionSaveSnapshot = {
  status: ConversationState['status'];
  events: GameEvent[];
  pendingChoices: PendingChoice[];
  delivery: PersistedDeliveryState;
};

export type InkStorySaveSnapshot = {
  storyId?: string;
  storyVersion?: string;
  inkStateJson?: string;
  sequence: number;
  conversationsById: Record<string, ConversationSessionSaveSnapshot>;
};

export class InkStorySession {
  private readonly storyDefinition: StoryDefinition;
  private readonly conversationDefinitions: ConversationDefinition[];
  private readonly conversationDefinitionById: Record<string, ConversationDefinition>;
  private readonly story: Story;
  private conversationsById: Record<string, ConversationState>;
  private sequence = 0;

  constructor(
    storyDefinition: StoryDefinition,
    conversationDefinitions: ConversationDefinition[],
    saveSnapshot?: InkStorySaveSnapshot
  ) {
    this.storyDefinition = storyDefinition;
    this.conversationDefinitions = conversationDefinitions;
    this.conversationDefinitionById = Object.fromEntries(
      conversationDefinitions.map((definition) => [definition.id, definition])
    ) as Record<string, ConversationDefinition>;
    this.story = new Story(storyDefinition.compiledStory);
    this.conversationsById = createInitialConversationStates(conversationDefinitions);

    if (saveSnapshot) {
      this.restore(saveSnapshot);
    }
  }

  static restore(
    storyDefinition: StoryDefinition,
    conversationDefinitions: ConversationDefinition[],
    saveSnapshot: InkStorySaveSnapshot
  ) {
    return new InkStorySession(storyDefinition, conversationDefinitions, saveSnapshot);
  }

  startConversation(conversationId: string) {
    const conversation = this.conversationsById[conversationId];
    const definition = this.conversationDefinitionById[conversationId];
    if (!conversation || !definition || conversation.status !== 'idle') {
      return this.snapshot();
    }

    this.story.ChoosePathString(definition.startSceneId);
    conversation.status = 'active';
    return this.advance(conversationId, definition.startSceneId);
  }

  choose(conversationId: string, choiceIndex: number) {
    const conversation = this.conversationsById[conversationId];
    if (!conversation || conversation.status !== 'active') {
      return this.snapshot();
    }

    conversation.pendingChoices = [];
    this.story.ChooseChoiceIndex(choiceIndex);
    return this.advance(conversationId, this.conversationDefinitionById[conversationId]?.startSceneId);
  }

  conversationSnapshot(conversationId: string): ConversationState | null {
    const conversation = this.conversationsById[conversationId];
    if (!conversation) {
      return null;
    }

    return cloneConversationState(conversation);
  }

  snapshot() {
    return Object.fromEntries(
      this.conversationDefinitions.map((definition) => [
        definition.id,
        cloneConversationState(this.conversationsById[definition.id]),
      ])
    ) as Record<string, ConversationState>;
  }

  serialize(deliveryByConversationId: Record<string, PersistedDeliveryState>): InkStorySaveSnapshot {
    return {
      storyId: this.storyDefinition.id,
      storyVersion: this.storyDefinition.contentVersion,
      inkStateJson: this.hasStarted() ? this.story.state.ToJson() : undefined,
      sequence: this.sequence,
      conversationsById: Object.fromEntries(
        this.conversationDefinitions.map((definition) => {
          const conversation = this.conversationsById[definition.id];

          return [
            definition.id,
            {
              status: conversation.status,
              events: [...conversation.events],
              pendingChoices: [...conversation.pendingChoices],
              delivery: {
                visibleEventCount:
                  deliveryByConversationId[definition.id]?.visibleEventCount ?? conversation.events.length,
                pendingEventId: deliveryByConversationId[definition.id]?.pendingEventId ?? null,
                availableAt: deliveryByConversationId[definition.id]?.availableAt ?? null,
                deliveredAt: deliveryByConversationId[definition.id]?.deliveredAt ?? null,
              },
            },
          ];
        })
      ),
    };
  }

  private advance(defaultConversationId: string, sceneId = defaultConversationId) {
    while (this.story.canContinue) {
      const rawText = (this.story.Continue() ?? '').trim();
      const tags = parseTags(this.story.currentTags ?? []);
      const events = toEvents({
        conversationId: defaultConversationId,
        rawText,
        tags,
        nextId: () => this.nextGeneratedId(),
      });

      this.pushEvents(defaultConversationId, events);
    }

    const conversation = this.conversationsById[defaultConversationId];
    if (!conversation) {
      return this.snapshot();
    }

    if (this.story.currentChoices.length > 0) {
      conversation.status = 'active';
      conversation.pendingChoices = this.story.currentChoices.map((choice, index) => ({
        id: index,
        text: choice.text,
      }));
    } else {
      conversation.pendingChoices = [];
      conversation.status = 'ended';
      conversation.events.push({
        type: 'scene-ended',
        id: this.nextGeneratedId('scene'),
        sceneId,
      });
    }

    return this.snapshot();
  }

  private pushEvents(defaultConversationId: string, events: GameEvent[]) {
    for (const event of events) {
      const conversationId = getEventConversationId(event, defaultConversationId);
      const conversation = this.conversationsById[conversationId];
      if (!conversation || event.type === 'choices') {
        continue;
      }

      if (conversation.status === 'idle') {
        conversation.status = 'active';
      }

      conversation.events.push(event);
    }
  }

  private nextGeneratedId(prefix = 'event') {
    this.sequence += 1;
    return `${this.storyDefinition.id}.${prefix}.${this.sequence}`;
  }

  private restore(saveSnapshot: InkStorySaveSnapshot) {
    const hasStartedConversation = Object.values(saveSnapshot.conversationsById).some(
      (conversation) => conversation.status !== 'idle'
    );

    if (hasStartedConversation && !saveSnapshot.inkStateJson) {
      throw new Error(`Missing Ink state for persisted story "${this.storyDefinition.id}"`);
    }

    if (saveSnapshot.storyId !== this.storyDefinition.id) {
      throw new Error(
        `Story id mismatch. Expected "${this.storyDefinition.id}", received "${saveSnapshot.storyId ?? 'unknown'}"`
      );
    }

    if (saveSnapshot.storyVersion !== this.storyDefinition.contentVersion) {
      throw new Error(
        `Story version mismatch. Expected "${this.storyDefinition.contentVersion}", received "${saveSnapshot.storyVersion ?? 'unknown'}"`
      );
    }

    this.sequence = saveSnapshot.sequence;

    for (const definition of this.conversationDefinitions) {
      const savedConversation = saveSnapshot.conversationsById[definition.id];
      if (!savedConversation) {
        continue;
      }

      this.conversationsById[definition.id] = {
        id: definition.id,
        title: definition.title,
        status: savedConversation.status,
        events: [...savedConversation.events],
        pendingChoices: [...savedConversation.pendingChoices],
        activeTyping: null,
      };
    }

    if (saveSnapshot.inkStateJson) {
      this.story.state.LoadJson(saveSnapshot.inkStateJson);
    }
  }

  private hasStarted() {
    return Object.values(this.conversationsById).some((conversation) => conversation.status !== 'idle');
  }
}

function createInitialConversationStates(conversationDefinitions: ConversationDefinition[]) {
  return Object.fromEntries(
    conversationDefinitions.map((definition) => [
      definition.id,
      {
        id: definition.id,
        title: definition.title,
        status: 'idle',
        events: [],
        pendingChoices: [],
        activeTyping: null,
      },
    ])
  ) as Record<string, ConversationState>;
}

function cloneConversationState(conversation: ConversationState): ConversationState {
  return {
    ...conversation,
    events: [...conversation.events],
    pendingChoices: [...conversation.pendingChoices],
    activeTyping: null,
  };
}

function getEventConversationId(event: GameEvent, defaultConversationId: string) {
  if (event.type === 'message') {
    return event.conversationId;
  }

  return defaultConversationId;
}

function toEvents({
  conversationId,
  rawText,
  tags,
  nextId,
}: {
  conversationId: string;
  rawText: string;
  tags: ParsedTags;
  nextId: () => string;
}): GameEvent[] {
  const tagType = tags.type;

  if (tagType === 'unlock-app' && tags.app) {
    return [
      {
        type: 'unlock-app',
        id: tags.id ?? nextId(),
        appId: tags.app,
      },
    ];
  }

  if (tagType === 'notification' && tags.app && tags.title && tags.body) {
    return [
      {
        type: 'notification',
        id: tags.id ?? nextId(),
        appId: tags.app,
        title: tags.title,
        body: tags.body,
      },
    ];
  }

  const imagePath = tags.image || undefined;

  if (!rawText && !imagePath) {
    return [];
  }

  const speakerId = normalizeSpeakerId(tags.speaker);
  const normalizedText = stripSpeakerPrefix(rawText, speakerId);
  const delayMs = toNumber(tags.delay);

  return [
    {
      type: 'message',
      id: tags.id ?? nextId(),
      conversationId: tags.conversation ?? conversationId,
      speakerId,
      direction: toMessageDirection(speakerId),
      text: normalizedText,
      imagePath,
      delayMs,
    },
  ];
}

function parseTags(tags: string[]): ParsedTags {
  return tags.reduce<ParsedTags>((result, tag) => {
    const separatorIndex = tag.indexOf(':');

    if (separatorIndex === -1) {
      result[tag.trim()] = 'true';
      return result;
    }

    const key = tag.slice(0, separatorIndex).trim();
    const value = tag.slice(separatorIndex + 1).trim();
    result[key] = value;
    return result;
  }, {});
}

function normalizeSpeakerId(speakerId: string | undefined) {
  return speakerId?.trim().toLowerCase() || 'system';
}

function toMessageDirection(speakerId: string): MessageDirection {
  if (speakerId === 'player') {
    return 'outgoing';
  }

  if (speakerId === 'system') {
    return 'system';
  }

  return 'incoming';
}

function stripSpeakerPrefix(rawText: string, speakerId: string) {
  const separatorIndex = rawText.indexOf(':');
  if (separatorIndex === -1) {
    return rawText;
  }

  const candidate = rawText.slice(0, separatorIndex).trim().toLowerCase();
  if (candidate !== speakerId.toLowerCase()) {
    return rawText;
  }

  return rawText.slice(separatorIndex + 1).trim();
}

function toNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
