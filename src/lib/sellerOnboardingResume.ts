// Persists a per-user "resume seller onboarding" flag. When set, a global
// mount reopens the SellerOnboardingSheet on the next app launch so the user
// lands back on the same step (with saved draft fields prefilled) — e.g. after
// leaving the app to look up their BSB / account number.

const resumeKey = (userId?: string | null) =>
  userId ? `flea_seller_onboarding_resume_${userId}` : null;

export const setOnboardingResume = (userId?: string | null) => {
  const k = resumeKey(userId);
  if (!k) return;
  try { localStorage.setItem(k, '1'); } catch { /* non-blocking */ }
};

export const clearOnboardingResume = (userId?: string | null) => {
  const k = resumeKey(userId);
  if (!k) return;
  try { localStorage.removeItem(k); } catch { /* non-blocking */ }
};

export const hasOnboardingResume = (userId?: string | null): boolean => {
  const k = resumeKey(userId);
  if (!k) return false;
  try { return localStorage.getItem(k) === '1'; } catch { return false; }
};
