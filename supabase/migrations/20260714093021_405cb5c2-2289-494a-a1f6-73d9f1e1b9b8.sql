ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles SET stripe_account_id = 'acct_demo_9465a71e', stripe_onboarding_complete = true WHERE user_id = '9465a71e-73f0-4873-a18f-cb2cffcc914e';
ALTER TABLE public.profiles ENABLE TRIGGER USER;