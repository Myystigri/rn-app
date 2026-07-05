import { ConversationDefinition } from '@/game/types';
import mayaStory from '@/story/generated/maya.story.json';

export const conversationDefinitions: ConversationDefinition[] = [
  {
    id: 'maya',
    title: 'Maya',
    startSceneId: 'introduction',
    compiledStory: mayaStory,
  },
];

export const conversationDefinitionById = Object.fromEntries(
  conversationDefinitions.map((definition) => [definition.id, definition])
) as Record<string, ConversationDefinition>;
