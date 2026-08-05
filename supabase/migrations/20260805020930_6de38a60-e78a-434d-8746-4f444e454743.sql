SET LOCAL app.bypass_profile_guard = 'on';
UPDATE public.profiles
SET stripe_account_id = 'acct_smoketest_' || left(replace(user_id::text,'-',''), 12),
    stripe_onboarding_complete = true
WHERE email LIKE '%@fleatest.dev';