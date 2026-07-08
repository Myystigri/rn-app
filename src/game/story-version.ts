import { CompiledInkStory } from '@/game/types';

export function createStoryContentVersion(compiledStory: CompiledInkStory) {
  const source = JSON.stringify(compiledStory);
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a-${(hash >>> 0).toString(16)}`;
}
