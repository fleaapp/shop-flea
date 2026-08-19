# Fix the toggle switches app wide

You are right - they are broken, and the cause is a colour that does not exist.

## What is actually wrong

`src/components/ui/switch.tsx` styles the switch like this:

- Track when on: `bg-charcoal` (dark)
- Circle when on: `bg-lime`

There is no `lime` colour defined in `tailwind.config.ts`. The palette has `primary`, `mint`, `cream`, `charcoal`, `price` and so on, but nothing called `lime`. So `bg-lime` produces no CSS at all, the circle renders with no fill, and you get the solid charcoal pill with no visible toggle in your screenshot.

Because every toggle in the app uses this one shared component, fixing this file fixes Settings, listing forms, admin, and every sheet at once. No screen overrides the switch colours.

## The fix

Keep the off state exactly as it is now, and only change the on state:

- **Off**: track uses `bg-input`, circle uses `bg-muted-foreground` (the current light grey / medium grey look)
- **On**: track uses the brand lime `primary` token, circle keeps the same `bg-muted-foreground` medium grey
- Keep the existing size, slide animation and focus ring

## One more instance of the same bug

`src/pages/Checkout.tsx:995` also uses `bg-lime` (and `hover:bg-lime/90`) on a button, so that button is currently unstyled for the same reason. I will swap it to the `primary` token while I am in there.

## Technical notes

- Files touched: `src/components/ui/switch.tsx`, `src/pages/Checkout.tsx`.
- Only Tailwind class changes, no logic or behaviour changes.
- Optionally I can add a `lime` alias to `tailwind.config.ts` pointing at the primary token so the name stops silently failing in future - say the word if you want that too.
