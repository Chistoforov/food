-- DIAGNOSTIC SCRIPT
-- Run this in Supabase SQL Editor to see what triggers and functions really exist.

-- 1. List all triggers on auth.users
SELECT 
    trigger_schema,
    trigger_name,
    action_statement as definition
FROM information_schema.triggers
WHERE event_object_schema = 'auth' 
  AND event_object_table = 'users';

-- 2. List all functions that look like handle_new_user
SELECT 
    n.nspname as schema,
    p.proname as function_name,
    CASE WHEN p.prosrc LIKE '%RAISE EXCEPTION%' THEN 'CONTAINS EXCEPTION' ELSE 'CLEAN' END as has_exception
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%handle_new_user%';



