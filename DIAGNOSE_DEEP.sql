-- DIAGNOSE PROJECT MISMATCH
-- 1. Check if we are even in the right database
SELECT current_database(), current_user, version();

-- 2. Check ALL functions in ALL schemas for the error text
-- (Previous search only checked standard paths, this checks everything)
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    p.prosrc as source_code_snippet
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosrc ILIKE '%Database error saving new user%';

-- 3. Check triggers on auth.identities (just in case)
SELECT 
    trigger_schema,
    trigger_name,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth' 
  AND event_object_table = 'identities';

