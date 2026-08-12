# Keyboard handling: audit result and two hardening fixes

## Confirmed working app-wide

The keyboard fix is installed once at the app root (`App.tsx` -> `useKeyboardInputScroll` -> `src/lib/keyboardAware.ts`) using document-level capture listeners, so it applies to every input, textarea and rich-text field on every page, dialog, drawer and sheet without per-screen wiring. Chat composers in Order Chat and Chat Conversation deliberately opt out because they already lift themselves.

Behaviour today: scroll the nearest real scroll container if one exists, otherwise slide the owning surface up by exactly the amount needed to reveal the focused field plus the next field or button, capped so the top of the surface never leaves the screen. Everything reverts on blur or keyboard close, with no padding, spacer or coloured strip left behind.

## Two gaps worth closing

1. **Full-height drawers and page shells.** These are anchored to the bottom of the screen and their body is a scroll area. When the body happens to be shorter than the drawer, there is no scroll parent, so the whole drawer slides up. On a full-height drawer that also drags the header up under the notch. Fix: when the surface is anchored to the bottom of the viewport and taller than the free space, shrink it against the keyboard instead of sliding it, so the header stays put and only the body reflows.

2. **Late layout changes.** Some forms reveal extra fields after focus (validation messages, conditional inputs, address autocomplete lists). The current second pass runs at a fixed 300 ms. Fix: observe the focused surface for size changes while the keyboard is open and re-run the visibility pass, so a field that grows after focus still ends up above the keyboard.

## Technical notes

- Both changes live entirely in `src/lib/keyboardAware.ts`; no screen-level edits.
- Bottom-anchored detection: the surface's computed `bottom` resolves to the viewport edge and its rect already spans to `window.innerHeight`.
- Shrink path reuses the existing temporary `max-height` plus `overflow-y` cap, which is already fully reverted on keyboard close.
- Growth watcher: a single `ResizeObserver` attached only while the keyboard is up, disconnected on hide and on unmount, feeding the existing rAF-throttled pass.
