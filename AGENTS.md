# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing code.

# Project Summary

This project is a React Native / Expo app for a text-driven narrative game. The player experiences the story through a phone-like interface, primarily a messaging app UI where characters text the player and the player responds through choices.

The project was ported from an Electron app. Keep that in mind when making architecture decisions: game content and progression logic matter more than flashy UI.

# Core Stack

- Expo SDK 56
- Expo Router
- React Native
- TypeScript
- `inkjs` for narrative scripting
- SQLite is planned for persistence, but is not implemented yet

Current package versions worth respecting:

- `expo`: `~56.0.12`
- `expo-router`: `~56.2.11`
- `react`: `19.2.3`
- `react-native`: `0.85.3`
- `inkjs`: `^2.4.0`

# Product Direction

- The app should feel like using a phone, not like reading a generic visual novel UI.
- The current slice is intentionally barebones. Prefer building correct runtime architecture first, then polishing the shell.
- Keep the visual language restrained and utilitarian. This is an in-world tool, not a marketing page.

# Architectural Rules

These are important and should not be casually violated:

1. Ink output must not be rendered directly by the UI.
2. `inkjs` belongs in a runtime/adapter layer, not in screen components.
3. The UI should consume app-owned models such as `GameEvent`, `ConversationState`, and similar domain types.
4. Story content and save state must stay separate.
5. SQLite should eventually persist save state, conversation/event history, unlocks, and progression metadata, but not replace Ink as the source of branching logic.

In practice, that means:

- Ink script/tags -> adapter layer -> app event model -> UI
- Not:
  Ink script/tags -> screen renders raw `story.Continue()` output

# Ink Integration Notes

The current implementation compiles Ink source at runtime using `inkjs`.

Important detail:

- `Compiler` must be imported from `inkjs/full`, not `inkjs`.
- The main `inkjs` entrypoint exposes runtime classes like `Story`, but not the compiler bundle.

Current runtime file:

- `src/game/ink-session.ts`

Current sample story:

- `src/game/content/maya-story.ts`

Current story catalog:

- `src/game/catalog.ts`

# Event Model

The game uses an app-owned event model in:

- `src/game/types.ts`

Current `GameEvent` variants:

- `message`
- `choices`
- `notification`
- `unlock-app`
- `typing`
- `scene-ended`

Even if some event types are not fully surfaced in the current UI yet, prefer extending this model rather than leaking raw Ink runtime details into screens.

# Ink Tag Conventions

The current sample story uses tags like:

- `id:<stable-id>`
- `speaker:<speaker-id>`
- `conversation:<conversation-id>`
- `delay:<ms>`

These tags are parsed by the Ink adapter and converted into `GameEvent`s.

If adding richer authored behavior later, continue in this direction. Example future tags:

- `type:notification`
- `type:unlock-app`
- `app:<app-id>`
- `title:<text>`
- `body:<text>`

Do not make screen components parse raw Ink tags themselves.

# Current App Structure

The starter Expo screens were replaced with a minimal vertical slice:

- `src/app/index.tsx`
  Inbox / thread list
- `src/app/conversations/[conversationId].tsx`
  Conversation detail screen with messages, start button, choice buttons, and restart
- `src/app/_layout.tsx`
  App root with `GameProvider` and a simple stack navigator
- `src/game/game-provider.tsx`
  In-memory session/state holder shared across routes
- `src/game/ink-session.ts`
  Ink runtime adapter that compiles the story and emits app-owned events

# Current Behavior

Right now the app supports:

- Viewing a simple inbox
- Entering a conversation thread
- Starting a sample Ink scene
- Advancing through choices
- Rendering emitted message events in a chat-like layout

Right now the app does not support:

- SQLite persistence
- Save/load
- Real delayed delivery scheduling across app restarts
- Multiple apps in the phone shell
- Background/local notifications
- Script validation tooling

# Persistence Plan

SQLite is the intended persistence layer, but it should be added under the current runtime interfaces, not by coupling screens directly to storage.

Planned direction:

- Persist serialized Ink state
- Persist event history / timeline
- Persist unlocked apps and progression metadata
- Keep scripts/content versioned separately from saves

Native mobile is the primary target for SQLite. Expo SQLite web support is less stable and should not drive architecture decisions unless web becomes a real product requirement.

# Conventions For Future Work

- Prefer small runtime/domain modules over putting game logic in route files.
- Prefer adding to `src/game/*` for game logic and state.
- Keep route files focused on presentation and user interaction.
- When introducing persistence, preserve the current app-owned event pipeline.
- If a feature requires a new kind of narrative side effect, model it as a new domain event first.

# Verification

Useful local verification commands:

- `npx tsc --noEmit`
- `npm run lint`

Linting is configured through:

- `eslint.config.js`

# Things Future Codex Sessions Should Know Immediately

- This is not a generic Expo starter anymore; treat it as a game app with a dedicated runtime layer.
- The messaging UI is the primary product surface.
- `inkjs/full` is required for runtime compilation.
- Do not render raw Ink output directly in components.
- SQLite persistence is expected next, but the current implementation is intentionally in-memory.
