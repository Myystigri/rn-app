import { createStoryContentVersion } from '@/game/story-version';
import { ConversationDefinition, PhoneAppDefinition, StoryDefinition } from '@/game/types';
import mainStory from '@/story/generated/main.story.json';

export const mainStoryDefinition: StoryDefinition = {
  id: 'main',
  entryPoint: 'maya_introduction',
  compiledStory: mainStory,
  contentVersion: createStoryContentVersion(mainStory),
};

export const conversationDefinitions: ConversationDefinition[] = [
  {
    id: 'maya',
    title: 'Maya',
    unlockedByDefault: true,
  },
  {
    id: 'bob',
    title: 'unknown',
    unlockedByDefault: false,
  },
];

export const conversationDefinitionById = Object.fromEntries(
  conversationDefinitions.map((definition) => [definition.id, definition])
) as Record<string, ConversationDefinition>;

export const phoneAppDefinitions: PhoneAppDefinition[] = [
  {
    id: 'messages',
    title: 'Messages',
    description: 'Active conversations and replies.',
    route: '/',
    unlockedByDefault: true,
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Delivery speed and app behavior.',
    route: '/settings',
    unlockedByDefault: true,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'System alerts and unlocked surfaces.',
    route: null,
    unlockedByDefault: true,
  },
  {
    id: 'case-files',
    title: 'Case Files',
    description: 'Locked',
    route: null,
    unlockedByDefault: false,
  },
  {
    id: 'contacts',
    title: 'Contacts',
    description: 'Locked',
    route: null,
    unlockedByDefault: false,
  },
  {
    id: 'network',
    title: 'Network',
    description: 'Locked',
    route: null,
    unlockedByDefault: false,
  },
];

export const phoneAppDefinitionById = Object.fromEntries(
  phoneAppDefinitions.map((definition) => [definition.id, definition])
) as Record<string, PhoneAppDefinition>;
