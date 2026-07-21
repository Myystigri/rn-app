import { getIncomingMessageDelayMs } from '@/game/settings';
import {
  ConversationState,
  GameSettings,
  MessageEvent,
  PersistedDeliveryState,
  TypingEvent,
} from '@/game/types';

export type DeliveryRuntime = PersistedDeliveryState & {
  activeTyping: TypingEvent | null;
  timerId: ReturnType<typeof setTimeout> | null;
};

export function buildConversationState(
  sessionState: ConversationState,
  runtime: DeliveryRuntime
): ConversationState {
  const visibleEventCount = clampVisibleEventCount(runtime.visibleEventCount, sessionState.events.length);
  const hasPendingDeliveries = visibleEventCount < sessionState.events.length;

  return {
    ...sessionState,
    events: sessionState.events.slice(0, visibleEventCount),
    pendingChoices: hasPendingDeliveries ? [] : sessionState.pendingChoices,
    activeTyping: runtime.activeTyping,
  };
}

export function createDeliveryRuntime(
  persistedState: Partial<PersistedDeliveryState> = {}
): DeliveryRuntime {
  return {
    activeTyping: null,
    timerId: null,
    visibleEventCount: persistedState.visibleEventCount ?? 0,
    pendingEventId: persistedState.pendingEventId ?? null,
    availableAt: persistedState.availableAt ?? null,
    deliveredAt: persistedState.deliveredAt ?? null,
  };
}

export function toPersistedDeliveryState(runtime: DeliveryRuntime): PersistedDeliveryState {
  return {
    visibleEventCount: runtime.visibleEventCount,
    pendingEventId: runtime.pendingEventId,
    availableAt: runtime.availableAt,
    deliveredAt: runtime.deliveredAt,
  };
}

export function clearPendingDelivery(runtime: DeliveryRuntime) {
  runtime.pendingEventId = null;
  runtime.availableAt = null;
  runtime.activeTyping = null;
}

export function resetDeliveryRuntime(runtime: DeliveryRuntime, visibleEventCount = 0) {
  runtime.visibleEventCount = visibleEventCount;
  runtime.deliveredAt = null;
  clearPendingDelivery(runtime);
}

export function reconcileDeliveryRuntime(
  runtime: DeliveryRuntime,
  sessionState: ConversationState,
  settings: GameSettings,
  now = new Date()
) {
  const clampedVisibleEventCount = clampVisibleEventCount(runtime.visibleEventCount, sessionState.events.length);
  runtime.visibleEventCount = clampedVisibleEventCount;

  const nextEvent = sessionState.events[clampedVisibleEventCount];
  if (!nextEvent || nextEvent.type !== 'message') {
    clearPendingDelivery(runtime);
    return;
  }

  const delayMs = getEventDelayMs(nextEvent, settings);
  if (delayMs <= 0) {
    clearPendingDelivery(runtime);
    return;
  }

  if (runtime.pendingEventId !== nextEvent.id || !runtime.availableAt) {
    clearPendingDelivery(runtime);
    return;
  }

  const availableAtMs = Date.parse(runtime.availableAt);
  if (Number.isNaN(availableAtMs)) {
    clearPendingDelivery(runtime);
    return;
  }

  runtime.activeTyping = createTypingEvent(nextEvent, Math.max(0, availableAtMs - now.getTime()));
}

export function scheduleDelayedDelivery(
  runtime: DeliveryRuntime,
  event: MessageEvent,
  delayMs: number,
  now = new Date()
) {
  const availableAtMs = now.getTime() + delayMs;
  runtime.pendingEventId = event.id;
  runtime.availableAt = new Date(availableAtMs).toISOString();
  runtime.activeTyping = createTypingEvent(event, delayMs);
  return availableAtMs;
}

export function hasDuePendingDelivery(
  runtime: DeliveryRuntime,
  event: ConversationState['events'][number] | undefined,
  now = new Date()
) {
  if (!event || event.type !== 'message' || runtime.pendingEventId !== event.id || !runtime.availableAt) {
    return false;
  }

  const availableAtMs = Date.parse(runtime.availableAt);
  return Number.isFinite(availableAtMs) && availableAtMs <= now.getTime();
}

export function markEventDelivered(runtime: DeliveryRuntime, deliveredAt = new Date()) {
  runtime.visibleEventCount += 1;
  runtime.deliveredAt = deliveredAt.toISOString();
  clearPendingDelivery(runtime);
}

export function getEventDelayMs(event: ConversationState['events'][number], settings: GameSettings) {
  if (event.type !== 'message') {
    return 0;
  }

  return getIncomingMessageDelayMs(event as MessageEvent, settings);
}

function clampVisibleEventCount(visibleEventCount: number, totalEventCount: number) {
  return Math.max(0, Math.min(visibleEventCount, totalEventCount));
}

function createTypingEvent(event: MessageEvent, durationMs: number): TypingEvent {
  return {
    type: 'typing',
    id: `${event.id}.typing`,
    speakerId: event.speakerId,
    durationMs,
  };
}
