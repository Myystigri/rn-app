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
  private readonly story: Story;
  private conversationsById: Record<string, ConversationState>;
  private activeChoiceConversationId: string | null = null;
  private started = false;
  private sequence = 0;

  constructor(
    storyDefinition: StoryDefinition,
    conversationDefinitions: ConversationDefinition[],
    saveSnapshot?: InkStorySaveSnapshot
  ) {
    this.storyDefinition = storyDefinition;
    this.conversationDefinitions = conversationDefinitions;
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

  start() {
    if (this.started) {
      return this.snapshot();
    }

    this.story.ChoosePathString(this.storyDefinition.entryPoint);
    this.started = true;
    return this.advance();
  }

  choose(conversationId: string, choiceIndex: number) {
    const conversation = this.conversationsById[conversationId];
    if (
      !conversation ||
      this.activeChoiceConversationId !== conversationId ||
      !conversation.pendingChoices.some((choice) => choice.id === choiceIndex)
    ) {
      return this.snapshot();
    }

    this.clearPendingChoices();
    this.story.ChooseChoiceIndex(choiceIndex);
    return this.advance();
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
      inkStateJson: this.started ? this.story.state.ToJson() : undefined,
      sequence: this.sequence,
      conversationsById: Object.fromEntries(
        this.conversationDefinitions.map((definition) => {
          const conversation = this.conversationsById[definition.id];

          return [
            definition.id,
            {
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

  private advance() {
    while (this.story.canContinue) {
      const rawText = (this.story.Continue() ?? '').trim();
      const tagGroups = parseTags(this.story.currentTags ?? []);
      const events = toEvents({
        rawText,
        tagGroups,
        nextId: () => this.nextGeneratedId(),
      });

      this.pushEvents(events);
    }

    this.routeCurrentChoices();

    return this.snapshot();
  }

  private pushEvents(events: GameEvent[]) {
    for (const event of events) {
      const conversation = this.conversationsById[event.conversationId];
      if (!conversation) {
        throw new Error(
          `Story event "${event.id}" targets unknown conversation "${event.conversationId}"`
        );
      }

      conversation.events.push(event);
    }
  }

  private routeCurrentChoices() {
    this.clearPendingChoices();

    if (this.story.currentChoices.length === 0) {
      return;
    }

    const routedChoices = this.story.currentChoices.map((choice) => ({
      conversationId: getChoiceConversationId(choice.tags ?? [], choice.text),
      choice: {
        id: choice.index,
        text: choice.text,
      },
    }));
    const conversationIds = new Set(routedChoices.map((choice) => choice.conversationId));

    if (conversationIds.size !== 1) {
      throw new Error('Every choice at an Ink choice point must target the same conversation');
    }

    const conversationId = routedChoices[0].conversationId;
    const conversation = this.conversationsById[conversationId];
    if (!conversation) {
      throw new Error(`Ink choices target unknown conversation "${conversationId}"`);
    }

    conversation.pendingChoices = routedChoices.map(({ choice }) => choice);
    this.activeChoiceConversationId = conversationId;
  }

  private clearPendingChoices() {
    for (const conversation of Object.values(this.conversationsById)) {
      conversation.pendingChoices = [];
    }
    this.activeChoiceConversationId = null;
  }

  private nextGeneratedId(prefix = 'event') {
    this.sequence += 1;
    return `${this.storyDefinition.id}.${prefix}.${this.sequence}`;
  }

  private restore(saveSnapshot: InkStorySaveSnapshot) {
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

    if (!saveSnapshot.inkStateJson) {
      throw new Error(`Missing Ink state for persisted story "${this.storyDefinition.id}"`);
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
        events: [...savedConversation.events],
        pendingChoices: [...savedConversation.pendingChoices],
        activeTyping: null,
      };
    }

    if (saveSnapshot.inkStateJson) {
      this.story.state.LoadJson(saveSnapshot.inkStateJson);
      this.started = true;
      this.routeCurrentChoices();
    }
  }
}

function createInitialConversationStates(conversationDefinitions: ConversationDefinition[]) {
  return Object.fromEntries(
    conversationDefinitions.map((definition) => [
      definition.id,
      {
        id: definition.id,
        title: definition.title,
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

function toEvents({
  rawText,
  tagGroups,
  nextId,
}: {
  rawText: string;
  tagGroups: ParsedTags[];
  nextId: () => string;
}): GameEvent[] {
  if (rawText && tagGroups.length === 0) {
    throw new Error(`Ink message "${rawText}" is missing tags`);
  }

  return tagGroups.flatMap((tags) => toEventsForTagGroup({ rawText, tags, nextId }));
}

function toEventsForTagGroup({
  rawText,
  tags,
  nextId,
}: {
  rawText: string;
  tags: ParsedTags;
  nextId: () => string;
}): GameEvent[] {
  const tagType = tags.type;
  const conversationId = tags.conversation;

  if (tagType === 'unlock-app' && tags.app) {
    assertConversationTag(conversationId, tagType);
    return [
      {
        type: 'unlock-app',
        id: tags.id ?? nextId(),
        conversationId,
        appId: tags.app,
      },
    ];
  }

  if (tagType === 'notification' && tags.app && tags.title && tags.body) {
    assertConversationTag(conversationId, tagType);
    return [
      {
        type: 'notification',
        id: tags.id ?? nextId(),
        conversationId,
        appId: tags.app,
        title: tags.title,
        body: tags.body,
      },
    ];
  }

  if (tagType === 'unlock-conversation' && tags.conversation) {
    return [
      {
        type: 'unlock-conversation',
        id: tags.id ?? nextId(),
        conversationId: tags.conversation,
      },
    ];
  }

  const imagePath = tags.image || undefined;

  if (!rawText && !imagePath) {
    return [];
  }

  assertConversationTag(conversationId, 'message');

  const speakerId = normalizeSpeakerId(tags.speaker);
  const normalizedText = stripSpeakerPrefix(rawText, speakerId);
  const delayMs = toNumber(tags.delay);

  return [
    {
      type: 'message',
      id: tags.id ?? nextId(),
      conversationId,
      speakerId,
      direction: toMessageDirection(speakerId),
      text: normalizedText,
      imagePath,
      delayMs,
    },
  ];
}

function getChoiceConversationId(tags: string[], choiceText: string) {
  const conversationIds = parseTags(tags)
    .map((tagGroup) => tagGroup.conversation)
    .filter((conversationId): conversationId is string => Boolean(conversationId));

  if (conversationIds.length !== 1) {
    throw new Error(`Ink choice "${choiceText}" must have exactly one conversation tag`);
  }

  return conversationIds[0];
}

function assertConversationTag(
  conversationId: string | undefined,
  eventType: string
): asserts conversationId is string {
  if (!conversationId) {
    throw new Error(`Ink ${eventType} output is missing a conversation tag`);
  }
}

function parseTags(tags: string[]): ParsedTags[] {
  const tagGroups: ParsedTags[] = [{}];

  for (const tag of tags) {
    const separatorIndex = tag.indexOf(':');
    const key = separatorIndex === -1 ? tag.trim() : tag.slice(0, separatorIndex).trim();
    const value = separatorIndex === -1 ? 'true' : tag.slice(separatorIndex + 1).trim();
    let currentGroup = tagGroups[tagGroups.length - 1];

    // Ink can emit several tagged side effects in one Continue call. A new type tag starts
    // the next event while preserving the tags that belong to each prior event.
    if ((key === 'type' && currentGroup.type) || (key === 'id' && currentGroup.id)) {
      currentGroup = {};
      tagGroups.push(currentGroup);
    }

    currentGroup[key] = value;
  }

  return tagGroups.filter((tagGroup) => Object.keys(tagGroup).length > 0);
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
