import { DelayProfileId, GameSettings, MessageEvent } from '@/game/types';

type DelayProfile = {
  label: string;
  baseDelayMs: number;
  perCharacterMs: number;
  minDelayMs: number;
  maxDelayMs: number;
};

export const defaultGameSettings: GameSettings = {
  incomingMessageDelayEnabled: true,
  incomingMessageDelayProfile: 'normal',
};

export const delayProfiles: Record<DelayProfileId, DelayProfile> = {
  fast: {
    label: 'Fast',
    baseDelayMs: 200,
    perCharacterMs: 16,
    minDelayMs: 350,
    maxDelayMs: 1400,
  },
  normal: {
    label: 'Normal',
    baseDelayMs: 375,
    perCharacterMs: 24,
    minDelayMs: 550,
    maxDelayMs: 2400,
  },
  slow: {
    label: 'Slow',
    baseDelayMs: 600,
    perCharacterMs: 34,
    minDelayMs: 850,
    maxDelayMs: 3600,
  },
};

export function isDelayProfileId(value: string): value is DelayProfileId {
  return value === 'fast' || value === 'normal' || value === 'slow';
}

export function getIncomingMessageDelayMs(event: MessageEvent, settings: GameSettings) {
  if (event.direction !== 'incoming' || !settings.incomingMessageDelayEnabled) {
    return 0;
  }

  if (typeof event.delayMs === 'number' && Number.isFinite(event.delayMs)) {
    return Math.max(0, event.delayMs);
  }

  const profile = delayProfiles[settings.incomingMessageDelayProfile];
  const textLength = event.text.trim().length;
  const computedDelay = profile.baseDelayMs + textLength * profile.perCharacterMs;

  return clamp(computedDelay, profile.minDelayMs, profile.maxDelayMs);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
