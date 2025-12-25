-- Migration: Link existing data to specific Google account
-- Description: Updates the user creation handler to bind site4people@gmail.com to the existing default family (ID 1)

-- 1. Update the handle_new_user function to intercept the specific email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_family_id INTEGER;
  v_invite_record RECORD;
BEGIN
  -- SPECIAL LOGIC: Link site4people@gmail.com to existing data (Family ID 1)
  IF NEW.email = 'site4people@gmail.com' THEN
    -- Check if Family 1 exists (the default family with existing data)
    SELECT id INTO v_family_id FROM families WHERE id = 1;
    
    -- If Family 1 exists, use it. Otherwise fall back to creating a new one (safety check)
    IF v_family_id IS NOT NULL THEN
       -- Optionally verify or update family name if needed, but linking is the priority
       RAISE NOTICE 'Linking site4people@gmail.com to existing Family ID %', v_family_id;
    ELSE
       -- Fallback: Create new family if ID 1 doesn't exist
       INSERT INTO families (name, member_count) 
       VALUES ('Семья ' || SPLIT_PART(NEW.email, '@', 1), 1)
       RETURNING id INTO v_family_id;
    END IF;

  ELSE
      -- STANDARD LOGIC for other users
      
      -- Check for existing pending invitation
      SELECT * INTO v_invite_record FROM family_invitations 
      WHERE email = NEW.email AND status = 'pending' 
      LIMIT 1;
      
      IF FOUND THEN
        -- Join existing family
        v_family_id := v_invite_record.family_id;
        
        -- Update invitation status
        UPDATE family_invitations SET status = 'accepted' WHERE id = v_invite_record.id;
        
        -- Increment family member count
        UPDATE families SET member_count = member_count + 1 WHERE id = v_family_id;
      ELSE
        -- Create new family
        INSERT INTO families (name, member_count) 
        VALUES ('Семья ' || SPLIT_PART(NEW.email, '@', 1), 1)
        RETURNING id INTO v_family_id;
      END IF;
  END IF;

  -- Create user profile with the determined family_id
  INSERT INTO user_profiles (id, email, family_id)
  VALUES (NEW.id, NEW.email, v_family_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger is already attached in migration_add_auth_tables.sql, so we don't need to recreate it
-- unless it was dropped. The CREATE OR REPLACE FUNCTION updates the logic used by the trigger.

-- 3. Safety Check: If the user ALREADY exists (signed up before this migration), fix their link now.
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Try to find the user in auth.users (if permissions allow)
    -- Note: This block might fail if run without sufficient privileges to access auth schema.
    -- In Supabase SQL Editor, this usually works.
    BEGIN
        SELECT id INTO v_user_id FROM auth.users WHERE email = 'site4people@gmail.com';
        
        IF v_user_id IS NOT NULL THEN
            -- Update existing profile to point to family 1
            UPDATE user_profiles 
            SET family_id = 1 
            WHERE id = v_user_id;
            
            RAISE NOTICE 'Fixed existing user site4people@gmail.com to point to Family 1';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not check/update existing user (possibly due to permissions): %', SQLERRM;
    END;
END $$;

