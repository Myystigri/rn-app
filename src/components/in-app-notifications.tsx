import { Href, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useGame } from '@/game/game-provider';
import {
  collectNewInAppNotifications,
  getActiveConversationId,
  InAppNotification,
  mergeInAppNotifications,
} from '@/game/in-app-notifications';
import { useTheme } from '@/hooks/use-theme';

const notificationLifetimeMs = 6000;

export function InAppNotifications() {
  const { apps, conversationsById } = useGame();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);
  const [visibleNotifications, setVisibleNotifications] = useState<InAppNotification[]>([]);
  const activeConversationId = getActiveConversationId(pathname);

  useEffect(() => {
    const result = collectNewInAppNotifications(
      conversationsById,
      seenEventIdsRef.current,
      activeConversationId
    );

    if (!isInitializedRef.current) {
      seenEventIdsRef.current = result.seenEventIds;
      isInitializedRef.current = true;
      return;
    }

    const timeout = setTimeout(() => {
      seenEventIdsRef.current = result.seenEventIds;

      if (result.notifications.length > 0) {
        setVisibleNotifications((current) =>
          mergeInAppNotifications(current, result.notifications)
        );
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [activeConversationId, conversationsById]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    const timeout = setTimeout(() => {
      setVisibleNotifications((current) =>
        current.filter(
          (notification) =>
            notification.kind !== 'message' ||
            notification.conversationId !== activeConversationId
        )
      );
    }, 0);

    return () => clearTimeout(timeout);
  }, [activeConversationId]);

  const dismiss = useCallback((key: string) => {
    setVisibleNotifications((current) =>
      current.filter((notification) => notification.key !== key)
    );
  }, []);

  function openNotification(notification: InAppNotification) {
    dismiss(notification.key);

    if (notification.kind === 'message' && notification.conversationId) {
      router.push(
        `/conversations/${encodeURIComponent(notification.conversationId)}` as Href
      );
      return;
    }

    const appRoute = apps.find((app) => app.id === notification.appId)?.route;
    if (appRoute) {
      router.push(appRoute as Href);
    }
  }

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.stack, { paddingTop: Math.max(insets.top, Spacing.two) }]}>
      {visibleNotifications.map((notification) => (
        <NotificationBanner
          key={notification.key}
          notification={notification}
          onDismiss={dismiss}
          onPress={() => openNotification(notification)}
        />
      ))}
    </View>
  );
}

function NotificationBanner({
  notification,
  onDismiss,
  onPress,
}: {
  notification: InAppNotification;
  onDismiss: (key: string) => void;
  onPress: () => void;
}) {
  const theme = useTheme();
  const [animation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    animation.setValue(0);
    Animated.spring(animation, {
      toValue: 1,
      damping: 18,
      stiffness: 210,
      mass: 0.75,
      useNativeDriver: true,
    }).start();

    const timeout = setTimeout(() => onDismiss(notification.key), notificationLifetimeMs);
    return () => clearTimeout(timeout);
  }, [animation, notification.key, notification.sourceEventId, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.bannerAnimation,
        {
          opacity: animation,
          transform: [
            {
              translateY: animation.interpolate({
                inputRange: [0, 1],
                outputRange: [-24, 0],
              }),
            },
          ],
        },
      ]}>
      <Pressable
        accessibilityLabel={`${notification.title}. ${notification.body}`}
        accessibilityLiveRegion="polite"
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.banner,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
          pressed && styles.pressed,
        ]}>
        <View style={[styles.appMark, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">
            {notification.kind === 'message' ? '●' : '!'}
          </ThemedText>
        </View>
        <View style={styles.copy}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {notification.title}
          </ThemedText>
          <ThemedText type="small" numberOfLines={2} style={{ color: theme.textSecondary }}>
            {notification.body}
          </ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    zIndex: 1000,
    elevation: 1000,
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  bannerAnimation: {
    width: '100%',
    maxWidth: 520,
  },
  banner: {
    minHeight: 70,
    width: '100%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  appMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
});
