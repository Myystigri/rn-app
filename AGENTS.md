# Expo HAS CHANGED

Read the exact versioned docs if necessary at https://docs.expo.dev/versions/v56.0.0/ 

# Project Summary

This project is a React Native / Expo app for a text-driven narrative game. The player experiences the story through a phone-like interface, primarily a messaging app UI where characters text the player and the player responds through choices.

The project was ported from an Electron app. Keep that in mind when making architecture decisions: game content and progression logic matter more than flashy UI.

# Core Stack

- Expo SDK 56
- Expo Router
- React Native
- TypeScript
- `inkjs` for narrative scripting
- `expo-sqlite` for local save/settings persistence

Current package versions worth respecting:

- `expo`: `~56.0.12`
- `expo-router`: `~56.2.11`
- `react`: `19.2.3`
- `react-native`: `0.85.3`
- `expo-sqlite`: `~56.0.5`
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
5. SQLite persists save state and app settings, but must not replace Ink as the source of branching logic.
6. Story runtime orchestration belongs under `src/game/*`; route files should stay focused on presentation and user interaction.

In practice, that means:

- Ink script/tags -> adapter layer -> app event model -> UI
- Not:
  Ink script/tags -> screen renders raw `story.Continue()` output

# Ink Integration Notes

The app currently uses authored Ink source under:

- `src/story/main.ink`

That source is compiled ahead of runtime into:

- `src/story/generated/main.story.json`

The runtime imports the generated JSON through:

- `src/game/catalog.ts`

The app should not compile Ink source inside React Native route components. Runtime code should instantiate `Story` from compiled story JSON and emit app-owned events.

Important detail:

- `Story` comes from `inkjs`.
- `Compiler` comes from `inkjs/full`, not `inkjs`.
- The current `scripts/compile-ink.js` script is not a custom Ink compiler. It is a project wrapper around `inkjs/full` that finds `.ink` files, compiles them to checked-in `.story.json`, supports includes, and reports compiler errors/warnings in a repeatable way.
- This script is also the right place to grow story validation tooling: duplicate `id:` detection, required tag checks, catalog/start-knot checks, and authored event contract validation.

Current runtime file:

- `src/game/ink-session.ts`

Current story source:

- `src/story/main.ink`

Current generated story:

- `src/story/generated/main.story.json`

Current story catalog:

- `src/game/catalog.ts`

# Story Structure Direction

The current `main.ink` file is the canonical authored Ink project. It only contains sample Maya content right now, but future conversations should be added as knots/entry points in this shared story project.

Current direction:

- Treat Ink as the canonical branching story engine for the whole game.
- Use one main Ink project for shared narrative state, cross-conversation consequences, unlocks, and global progression.
- Model conversations as knots, threads, or named entry points inside that main story project rather than as isolated per-character story files.
- Use includes only as authoring organization when useful, not as separate gameplay state silos.
- Keep the UI conversation list as an app-owned projection of game state. A conversation can be unlocked or updated by Ink tags/events without requiring a separate Ink runtime per conversation.

The catalog maps app conversation IDs to Ink entry points, but future work must not assume "one conversation equals one independent Ink story".

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
- `src/app/settings.tsx`
  Basic settings screen for incoming message delay behavior
- `src/app/explore.tsx`
  Still contains Expo starter/demo content and should be removed or repurposed into an in-world phone app surface
- `src/app/_layout.tsx`
  App root with `SQLiteProvider`, database migration, `GameProvider`, and a simple stack navigator
- `src/game/game-provider.tsx`
  React context that hydrates SQLite state, owns the shared in-memory Ink story session, manages visible message delivery, persists snapshots, and exposes actions to routes
- `src/game/ink-session.ts`
  Shared Ink runtime adapter that restores/advances the compiled story and emits app-owned events into conversation projections
- `src/game/persistence/*`
  SQLite schema, migrations, save store, and settings store
- `scripts/compile-ink.js`
  Project compilation wrapper for authored `.ink` files

# Current Behavior

Right now the app supports:

- Viewing a simple inbox
- Entering a conversation thread
- Starting a sample Ink scene
- Advancing through choices
- Rendering emitted message events in a chat-like layout
- Simulated incoming-message delay / typing previews
- Persisting serialized Ink state, event history, visible event count, pending choices, and delay settings in SQLite
- Restoring active/ended conversations across app restarts

Right now the app does not support:

- Durable delayed delivery deadlines across app restarts
- Multiple apps in the phone shell
- Background/local notifications
- Script validation tooling
- Unlock/progression UI for non-message events

# Persistence Notes

SQLite has been added under the current runtime interfaces. Do not couple screens directly to storage.

Currently persisted:

- Persist serialized Ink state
- Persist event history / timeline
- Persist pending choices
- Persist visible event count for delayed message reveal
- Persist game settings
- Store the shared Ink state once, with per-conversation rows used as UI projections/event history

Still planned:

- Persist unlocked apps and progression metadata
- Persist durable delivery deadlines such as `availableAt` / `deliveredAt`
- Persist story/content version metadata for save compatibility
- Keep scripts/content versioned separately from saves

Native mobile is the primary target for SQLite. Expo SQLite web support is less stable and should not drive architecture decisions unless web becomes a real product requirement.

# Conventions For Future Work

- Prefer small runtime/domain modules over putting game logic in route files.
- Prefer adding to `src/game/*` for game logic and state.
- Keep route files focused on presentation and user interaction.
- When extending persistence, preserve the current app-owned event pipeline.
- If a feature requires a new kind of narrative side effect, model it as a new domain event first.
- Do not make screen components parse raw Ink tags.
- Avoid building more UI around starter/demo screens; replace them with in-world phone surfaces.
- Keep the story structure as one canonical Ink story project with app conversation IDs mapped to Ink entry points.

# Verification

Useful local verification commands:

- `npm run compile:ink`
- `npx tsc --noEmit`
- `npm run lint`

Linting is configured through:

- `eslint.config.js`

# Things Future Codex Sessions Should Know Immediately

- This is not a generic Expo starter anymore; treat it as a game app with a dedicated runtime layer.
- The messaging UI is the primary product surface.
- `inkjs/full` is required by project compile/validation scripts.
- Runtime app code should consume generated `.story.json`, not compile `.ink` on-device.
- Do not render raw Ink output directly in components.
- SQLite persistence exists and is wired through `SQLiteProvider` plus `GameProvider`.
- The story runtime is shared across conversations; do not reintroduce one independent Ink runtime per character.
