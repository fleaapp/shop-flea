// Persists per-user "resume seller onboarding" state. When set, a global
// mount reopens the SellerOnboardingSheet on the next app launch so the user
// lands back on the same step (with saved draft fields prefilled) — e.g. after
// leaving the app to look up their BSB / account number.
//
// The step itself is stored locally too (independent of the DB round-trip and
// RLS) so backgrounding on step 4 always resumes on step 4.

const resumeKey = (userId?: string | null) =>
  userId ? `flea_seller_onboarding_resume_${userId}` : null;

const stepKey = (userId?: string | null) =>
  userId ? `flea_seller_onboarding_step_${userId}` : null;

export const setOnboardingResume = (userId?: string | null) => {
  const k = resumeKey(userId);
  if (!k) return;
  try { localStorage.setItem(k, '1'); } catch { /* non-blocking */ }
};

export const clearOnboardingResume = (userId?: string | null) => {
  const rk = resumeKey(userId);
  const sk = stepKey(userId);
  try { if (rk) localStorage.removeItem(rk); } catch { /* non-blocking */ }
  try { if (sk) localStorage.removeItem(sk); } catch { /* non-blocking */ }
};

export const hasOnboardingResume = (userId?: string | null): boolean => {
  const k = resumeKey(userId);
  if (!k) return false;
  try { return localStorage.getItem(k) === '1'; } catch { return false; }
};

export const setOnboardingStep = (userId: string | null | undefined, step: 1 | 2 | 3 | 4 | 5) => {
  const k = stepKey(userId);
  if (!k) return;
  try { localStorage.setItem(k, String(step)); } catch { /* non-blocking */ }
};

export const getOnboardingStep = (userId?: string | null): 1 | 2 | 3 | 4 | 5 | null => {
  const k = stepKey(userId);
  if (!k) return null;
  try {
    const n = Number(localStorage.getItem(k));
    return n >= 1 && n <= 5 ? (n as 1 | 2 | 3 | 4 | 5) : null;
  } catch { return null; }
};
