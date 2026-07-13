# Project Context

This is an Expo SDK 56 / React Native / TypeScript app for a text-driven narrative game. The primary UI is an in-world phone messaging app. Prioritize story content, progression, and runtime correctness over decorative UI.

Use the Expo 56 documentation when version-specific behavior matters:
https://docs.expo.dev/versions/v56.0.0/

# Architecture

- Keep game logic and runtime orchestration under `src/game/*`.
- Keep Expo Router files focused on presentation and user interaction.
- UI consumes app-owned domain models such as `GameEvent` and `ConversationState`.
- Do not expose Ink runtime objects, raw Ink output, or raw tags to screens.
- Keep story content, runtime state, and UI projections separate.
- SQLite persists saves and settings; Ink remains the source of branching logic.

Pipeline:

`Ink source/tags -> Ink adapter -> app-owned events/state -> UI`

# Ink

- Authored Ink lives under `src/story/`.
- Runtime uses checked-in generated `.story.json`; never compile Ink on-device.
- `Story` comes from `inkjs`; `Compiler` comes from `inkjs/full`.
- Compilation is handled by `scripts/compile-ink.js`.
- Extend that script for story validation when needed.
- Use one shared Ink project/runtime for global progression and cross-conversation state.
- Conversations map to Ink knots or entry points through `src/game/catalog.ts`.
- Do not create independent Ink state silos per conversation.

Runtime/domain boundaries include:

- `src/game/ink-session.ts`
- `src/game/catalog.ts`
- `src/game/types.ts`

Tags such as `id`, `speaker`, `conversation`, and `delay` are parsed by the adapter and converted into app-owned events. New narrative side effects should be represented as new domain event types.

# Persistence

- Keep SQLite access behind `src/game/persistence/*` and the game provider.
- Persist serialized Ink state and UI projections separately.
- Do not couple route components directly to SQLite.
- Preserve compatibility between story/content versions and saved state when adding persistence features.

# UI Direction

The app should feel like a restrained, utilitarian phone interface, not a generic visual novel or marketing page. Replace Expo starter/demo surfaces with in-world phone functionality as they are touched.

# Verification

Run:

```sh
npx tsc --noEmit
npm run lint

# only if there's change in ink file
npm run compile:ink
```

Do not start the Expo project in this environment.
