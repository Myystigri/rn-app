import { createStoryContentVersion } from '@/game/story-version';
import { ConversationDefinition, PhoneAppDefinition, StoryDefinition } from '@/game/types';
import mainStory from '@/story/generated/main.story.json';

export const mainStoryDefinition: StoryDefinition = {
  id: 'main',
  entryPoint: 'main_start',
  compiledStory: mainStory,
  contentVersion: createStoryContentVersion(mainStory),
};

export const conversationDefinitions: ConversationDefinition[] = [
  {
    id: 'maya',
    title: 'unknown',
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
    route: '/messages',
    unlockedByDefault: true,
    icon: {
      glyph: '🗨️',
      backgroundColor: '#63D56E',
      foregroundColor: '#0B3D18',
    },
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Delivery speed and app behavior.',
    route: '/settings',
    unlockedByDefault: true,
    icon: {
      glyph: '⚙️',
      backgroundColor: '#A9AFB8',
      foregroundColor: '#1D222A',
    },
  },
  {
    id: 'photos',
    title: 'Photos',
    description: 'A recollection of all the images shared by or with you until now',
    route: '/settings',
    unlockedByDefault: true,
    icon: {
      glyph: '🖼️',
      backgroundColor: '#5393f3',
      foregroundColor: '#1D222A',
    },
  },
  {
    id: 'insta',
    title: 'Insta',
    description: 'A picture-based social network !',
    route: null,
    unlockedByDefault: false,
    icon: {
      glyph: '📸',
      backgroundColor: '#b545f4',
      foregroundColor: '#1D222A',
    },
  },
];

export const phoneAppDefinitionById = Object.fromEntries(
  phoneAppDefinitions.map((definition) => [definition.id, definition])
) as Record<string, PhoneAppDefinition>;
