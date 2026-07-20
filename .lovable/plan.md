## Problem

`src/utils/contentModeration.ts` is blocking normal English like:

> "Label has been removed. I believe around a size 12. Good condition."

Users can't list items or comment with common words ("I", "a") or single/small numbers ("12"). This is a client-side false positive in the moderation utility used by both listing creation and comments.

## Root cause investigation (step 1)

Add a one-off script to run the exact failing text through `moderateContent` and log which detector fires (`profanity` / `contact` / `social` / `url`) and on which normalized form. Likely culprits based on reading the current code:

- `CHAR_SUBSTITUTIONS` is over-broad: e.g. `'i': ['1','!','|','l','¡','í']` rewrites every `l` in the text to `i`, `'s': [...,'z']` and `'z': [...,'s']` swap letters — this can synthesize profanity/social terms that aren't there.
- `NUMBER_WORDS` maps single letter `'o': '0'`, so any standalone "O" (or word-boundary "o") becomes a digit that then feeds phone detection.
- `makeLooseBoundedPattern` with `[^a-z0-9]*` between letters can match short profanity across word boundaries after aggressive substitutions.
- Phone detector's 7-digit threshold is fine, but `normalizeText`-derived digits may inflate the count after substitutions.

## Fix (step 2)

Tighten `src/utils/contentModeration.ts`:

1. **Character substitutions**: only apply when a token contains at least one non-alphabetic character (i.e. only run leet decoding on suspicious tokens, not plain English words). Remove the ambiguous letter↔letter swaps (`l↔i`, `s↔z`, `z↔s`, `l↔1`-only-in-letters context, `o↔0` inside words).
2. **Number words**: drop the single-letter entries (`'o'`, `'oh'`) — too false-positive-prone. Keep multi-letter number words.
3. **Phone digits**: count digits from the original text (already done via `rawDigits`), but stop using `normalizedDigits` since normalization now injects digits from letters. Keep the 7+ threshold on `rawDigits` only.
4. **Profanity/social loose matching**: change `[^a-z0-9]*` to `[^a-z0-9]{0,2}` between letters so short banned words like `ass`, `die`, `kys` can't span an entire phrase.
5. **Whitelist common short English tokens** (`i`, `a`, `an`, `is`, `it`, `to`, `of`, etc.) so they short-circuit before any detector runs on the token.

## Verification (step 3)

Add a small test script (temporary) that runs a batch of realistic phrases through `moderateContent`:
- "Label has been removed. I believe around a size 12. Good condition." → allowed
- "Size 8, worn once, great condition" → allowed
- "DM me on insta @flea" → blocked (social)
- "Call me on 0412 345 678" → blocked (contact)
- "fuck this" → blocked (profanity)

Delete the script after confirmation.

## Files

- `src/utils/contentModeration.ts` — tighten normalization and detection.
- No server changes needed for listing/comment flow (client util is the gate for both).

## Out of scope

- `supabase/functions/moderate-content/index.ts` isn't invoked by the listing/comment flow (they call `useContentModeration` → client util). I'll leave the edge function alone unless you want it aligned in the same pass.
