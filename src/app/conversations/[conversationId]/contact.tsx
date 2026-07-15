import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useGame } from '@/game/game-provider';
import { useTheme } from '@/hooks/use-theme';

export default function ContactDetailsScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { conversationsById, renameConversation } = useGame();
  const conversation = conversationId ? conversationsById[conversationId] : undefined;
  const [title, setTitle] = useState(conversation?.title ?? '');

  if (!conversation || !conversationId) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.centeredState}>
          <ThemedText type="subtitle">Contact missing</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  async function saveTitle() {
    await renameConversation(conversationId, title);
    router.back();
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Contact details' }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <ThemedText type="smallBold">Contact name</ThemedText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Contact name"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => void saveTitle()}
            style={[styles.input, { color: theme.text, borderColor: theme.textSecondary }]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            This name is only visible on your phone. The story can still reveal who is messaging you.
          </ThemedText>
          <Pressable onPress={() => void saveTitle()} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <ThemedView type="backgroundSelected" style={styles.buttonSurface}>
              <ThemedText type="smallBold">Save name</ThemedText>
            </ThemedView>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, gap: Spacing.two },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 16,
  },
  button: { borderRadius: 8, marginTop: Spacing.two },
  buttonSurface: { borderRadius: 8, alignItems: 'center', padding: Spacing.three },
  pressed: { opacity: 0.72 },
});
