

## Create Custom Supabase Client File

### Overview
Create a new Supabase client file at `src/lib/supabase.ts` that connects to your external Supabase project instead of the Lovable Cloud instance.

---

### File to Create

**`src/lib/supabase.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://dzglehiopfgfjmxtejve.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z2xlaGlvcGZnZmpteHRlanZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzI0MjUsImV4cCI6MjA4NDU0ODQyNX0.qfOBjubnuod5iGF_G_gH2ZhMDJ1fVwAO9p5BZSxG0xI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

---

### Important Note

After creating this file, you'll need to update all imports throughout the codebase from:
```typescript
import { supabase } from "@/integrations/supabase/client";
```

To:
```typescript
import { supabase } from "@/lib/supabase";
```

This affects approximately 15+ files including:
- `src/context/AuthContext.tsx`
- `src/context/CartContext.tsx`
- `src/hooks/useListings.ts`
- `src/hooks/useFavoriteListings.ts`
- `src/hooks/useReviews.ts`
- All page components that interact with the database

---

### Technical Consideration

Your external Supabase project will need to have the same database schema (tables, RLS policies, triggers, storage buckets) as the current Lovable Cloud setup for the app to work correctly. The existing `src/integrations/supabase/types.ts` file may not match your external database schema.

