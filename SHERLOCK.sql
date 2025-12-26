-- SHERLOCK HOLMES SCRIPT
-- Purpose: Find WHERE the error string is hiding in the entire database.

-- 1. Search in ALL functions in ALL schemas
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    'FUNCTION' as type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosrc ILIKE '%Database error saving new user%';

-- 2. Check Triggers on ALL tables in 'auth' schema
SELECT 
    event_object_table as table_name,
    trigger_name,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth';

-- 3. Check if there are any other triggers on public tables that might be involved
SELECT 
    event_object_table as table_name,
    trigger_name
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND action_statement ILIKE '%handle_new_user%';

