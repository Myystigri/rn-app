import { ConversationDefinition, StoryDefinition } from '@/game/types';
import mainStory from '@/story/generated/main.story.json';

export const mainStoryDefinition: StoryDefinition = {
  id: 'main',
  compiledStory: mainStory,
};

export const conversationDefinitions: ConversationDefinition[] = [
  {
    id: 'maya',
    title: 'Maya',
    startSceneId: 'maya_introduction',
  },
];

export const conversationDefinitionById = Object.fromEntries(
  conversationDefinitions.map((definition) => [definition.id, definition])
) as Record<string, ConversationDefinition>;
