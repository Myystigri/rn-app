import { Story } from 'inkjs';

import {
  ConversationDefinition,
  ConversationState,
  GameEvent,
  MessageDirection,
  PendingChoice,
} from '@/game/types';

type ParsedTags = Record<string, string>;
export type InkSessionSaveSnapshot = {
  status: ConversationState['status'];
  events: GameEvent[];
  pendingChoices: PendingChoice[];
  sequence: number;
  inkStateJson?: string;
};

export class InkConversationSession {
  private readonly definition: ConversationDefinition;
  private readonly story: Story;
  private readonly events: GameEvent[] = [];
  private pendingChoices: PendingChoice[] = [];
  private sequence = 0;
  private status: ConversationState['status'] = 'idle';

  constructor(definition: ConversationDefinition, saveSnapshot?: InkSessionSaveSnapshot) {
    this.definition = definition;
    this.story = new Story(definition.compiledStory);

    if (saveSnapshot) {
      this.restore(saveSnapshot);
    }
  }

  static restore(definition: ConversationDefinition, saveSnapshot: InkSessionSaveSnapshot) {
    return new InkConversationSession(definition, saveSnapshot);
  }

  start() {
    if (this.status !== 'idle') {
      return this.snapshot();
    }

    this.story.ChoosePathString(this.definition.startSceneId);
    this.status = 'active';
    return this.advance();
  }

  choose(choiceIndex: number) {
    if (this.status !== 'active') {
      return this.snapshot();
    }

    this.pendingChoices = [];
    this.story.ChooseChoiceIndex(choiceIndex);
    return this.advance();
  }

  snapshot(): ConversationState {
    return {
      id: this.definition.id,
      title: this.definition.title,
      status: this.status,
      events: [...this.events],
      pendingChoices: [...this.pendingChoices],
    };
  }

  serialize(): InkSessionSaveSnapshot {
    return {
      status: this.status,
      events: [...this.events],
      pendingChoices: [...this.pendingChoices],
      sequence: this.sequence,
      inkStateJson: this.status === 'idle' ? undefined : this.story.state.ToJson(),
    };
  }

  private advance() {
    while (this.story.canContinue) {
      const rawText = (this.story.Continue() ?? '').trim();
      const tags = parseTags(this.story.currentTags ?? []);
      this.pushEvents(
        toEvents({
          conversationId: this.definition.id,
          rawText,
          tags,
          nextId: () => this.nextGeneratedId(),
        })
      );
    }

    if (this.story.currentChoices.length > 0) {
      this.pendingChoices = this.story.currentChoices.map((choice, index) => ({
        id: index,
        text: choice.text,
      }));
    } else {
      this.pendingChoices = [];
      this.status = 'ended';
      this.events.push({
        type: 'scene-ended',
        id: this.nextGeneratedId('scene'),
        sceneId: this.definition.startSceneId,
      });
    }

    return this.snapshot();
  }

  private pushEvents(events: GameEvent[]) {
    for (const event of events) {
      if (event.type !== 'choices') {
        this.events.push(event);
      }
    }
  }

  private nextGeneratedId(prefix = 'event') {
    this.sequence += 1;
    return `${this.definition.id}.${prefix}.${this.sequence}`;
  }

  private restore(saveSnapshot: InkSessionSaveSnapshot) {
    if (saveSnapshot.status !== 'idle' && !saveSnapshot.inkStateJson) {
      throw new Error(`Missing Ink state for persisted conversation "${this.definition.id}"`);
    }

    this.status = saveSnapshot.status;
    this.sequence = saveSnapshot.sequence;
    this.events.push(...saveSnapshot.events);
    this.pendingChoices = [...saveSnapshot.pendingChoices];

    if (saveSnapshot.inkStateJson) {
      this.story.state.LoadJson(saveSnapshot.inkStateJson);
    }
  }
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

  if (!rawText) {
    return [];
  }

  const speakerId = normalizeSpeakerId(tags.speaker);
  const normalizedText = stripSpeakerPrefix(rawText, speakerId);
  const delayMs = toNumber(tags.delay);

  const events: GameEvent[] = [];
  if (delayMs && speakerId !== 'player') {
    events.push({
      type: 'typing',
      id: nextId(),
      speakerId,
      durationMs: delayMs,
    });
  }

  events.push({
    type: 'message',
    id: tags.id ?? nextId(),
    conversationId: tags.conversation ?? conversationId,
    speakerId,
    direction: toMessageDirection(speakerId),
    text: normalizedText,
    delayMs,
  });

  return events;
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
