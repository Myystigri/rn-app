# MYYST

React Native / Expo app for a text-driven narrative game presented through an in-world phone UI.

## Stack

- Expo SDK 56
- Expo Router
- React Native
- TypeScript
- `inkjs` for authored branching story content
- `expo-sqlite` for save state and settings

## Project shape

- `src/game/*`: story runtime, delivery scheduling, derived side effects, persistence
- `src/story/main.ink`: canonical authored Ink source
- `src/story/generated/main.story.json`: checked-in compiled story asset used at runtime
- `src/app/*`: presentation routes for the phone shell, messages, and settings

## Commands

```bash
npm run compile:ink
npx tsc --noEmit
npm run lint
```

## Notes

- Ink is compiled ahead of runtime. The app should never compile `.ink` files inside route components.
- Screens consume app-owned models from `src/game/*`; they should not parse raw Ink output or tags directly.
- SQLite stores saves and settings, but Ink remains the source of branching logic.
