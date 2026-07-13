import { storyImageSources } from '@/game/generated/story-images';

export function resolveStoryImage(imagePath: string) {
  return storyImageSources[imagePath];
}
