-- FIND AND DESTROY SCRIPT
-- 1. Find the function that contains the specific error message
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT n.nspname, p.proname 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.prosrc ILIKE '%Database error saving new user%'
    LOOP
        RAISE NOTICE 'Found culprit function: %.%', r.nspname, r.proname;
        -- Nuke it
        EXECUTE 'DROP FUNCTION ' || r.nspname || '.' || r.proname || '() CASCADE';
        RAISE NOTICE 'Destroyed %.%', r.nspname, r.proname;
    END LOOP;
END $$;

-- 2. Ensure V3 is the ONLY trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_v3();




