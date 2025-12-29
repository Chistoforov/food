-- CLEANUP SCRIPT
-- 1. List existing triggers (for debugging)
SELECT tgname, proname 
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'auth.users'::regclass;

-- 2. NUCLEAR OPTION: Drop the trigger and all functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_v2() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_v3() CASCADE;

-- 3. Verify it's gone
SELECT count(*) as trigger_count 
FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass 
AND tgname = 'on_auth_user_created';




