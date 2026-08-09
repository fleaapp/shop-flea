# Fix search accuracy and make searches persist

## What's wrong

**1. Fuzzy matching is far too loose.**
Search scoring (`src/utils/searchUtils.ts`) falls back to `isSimilar()` (`src/utils/fuzzyMatch.ts`) when nothing else matches. That helper accepts any word within a Levenshtein distance of 1 for short queries, and it also compares only the first N characters of a word. So "fur" matches the start of words like "purchased", "further", "fun", "furniture" - and any listing whose description contains one of those (a navy Puma sneaker, for example) is treated as a hit. Fuzzy matching also runs against every field including description, condition and size, which massively widens the false-positive surface.

**2. Search is component state only.**
The home feed keeps the query in local React state (`src/pages/Index.tsx`, `searchQuery` / `listingFilters` via `useState`). Navigating to another tab unmounts the page, so returning resets the query and chips to empty.

## Plan

### Accuracy
- Tighten `tokenMatchScore` in `src/utils/searchUtils.ts`:
  - Only allow fuzzy/typo matching for tokens of 5+ characters, and only against high-signal fields (title, brand, category, tags) - never description, size or condition.
  - Require a real prefix match (`word.startsWith(token)`) rather than "prefix within 1 edit".
  - For short tokens (under 4 chars) require an exact word-boundary match so "fur" only matches the word "fur".
- Restrict substring matching on description to word-boundary matches, so "fur" no longer hits "furniture" in a paragraph.
- Add a relevance floor: drop items whose average token score falls below a sensible threshold, so weak fuzzy hits never surface.
- Sort results by score as today, with title/brand hits ranked above description hits.

### Persistence
- Add a small persisted-search store (`src/utils/searchPersistence.ts`) backed by `localStorage`, holding the query text, the active filter set, and a saved-at timestamp.
- `Index.tsx` initialises `searchQuery` and `listingFilters` from that store on mount (synchronously, so no flash of unfiltered feed) and writes back on every change.
- Expiry: restore only if saved within the last 30 minutes; older entries are cleared on read. Clearing the chip or clearing filters wipes the stored value immediately.

### Technical notes
- Files touched: `src/utils/searchUtils.ts`, `src/utils/fuzzyMatch.ts` (leave existing exports intact, add a stricter helper), `src/pages/Index.tsx`, new `src/utils/searchPersistence.ts`.
- No database or edge function changes; search filtering stays client-side.
- Verify by searching "fur" (should return only genuine fur items), then navigating to Cart and back to Home to confirm the chip and results are still there.
