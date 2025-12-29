-- Fix Auth Trigger Logic
-- Description: Makes the handle_new_user function more robust with error handling and logging.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_family_id INTEGER;
  v_invite_record RECORD;
  v_user_email TEXT;
BEGIN
  -- Set search path for security
  -- This prevents malicious code from hijacking the function
  -- (though less relevant here, it's best practice for SECURITY DEFINER)
  -- SET search_path = public; 
  
  v_user_email := NEW.email;
  
  RAISE LOG 'handle_new_user triggered for email: %', v_user_email;

  BEGIN
      -- SPECIAL LOGIC: Link site4people@gmail.com to existing data (Family ID 1)
      IF v_user_email = 'site4people@gmail.com' THEN
        -- Check if Family 1 exists
        SELECT id INTO v_family_id FROM families WHERE id = 1;
        
        IF v_family_id IS NOT NULL THEN
           RAISE LOG 'Linking site4people@gmail.com to existing Family ID %', v_family_id;
        ELSE
           -- Fallback: Create new family if ID 1 doesn't exist
           RAISE LOG 'Family ID 1 not found for special user, creating new family';
           INSERT INTO families (name, member_count) 
           VALUES ('Семья ' || SPLIT_PART(v_user_email, '@', 1), 1)
           RETURNING id INTO v_family_id;
        END IF;

      ELSE
          -- STANDARD LOGIC for other users
          
          -- Check for existing pending invitation
          SELECT * INTO v_invite_record FROM family_invitations 
          WHERE email = v_user_email AND status = 'pending' 
          LIMIT 1;
          
          IF FOUND THEN
            -- Join existing family
            v_family_id := v_invite_record.family_id;
            RAISE LOG 'Found pending invitation for family %', v_family_id;
            
            -- Update invitation status
            UPDATE family_invitations SET status = 'accepted' WHERE id = v_invite_record.id;
            
            -- Increment family member count
            UPDATE families SET member_count = member_count + 1 WHERE id = v_family_id;
          ELSE
            -- Create new family
            RAISE LOG 'Creating new family for %', v_user_email;
            INSERT INTO families (name, member_count) 
            VALUES ('Семья ' || SPLIT_PART(v_user_email, '@', 1), 1)
            RETURNING id INTO v_family_id;
          END IF;
      END IF;

      -- Ensure v_family_id is not null
      IF v_family_id IS NULL THEN
         RAISE EXCEPTION 'Failed to determine family_id for user %', v_user_email;
      END IF;

      -- Create user profile
      RAISE LOG 'Creating user_profile for % with family_id %', NEW.id, v_family_id;
      
      INSERT INTO user_profiles (id, email, family_id)
      VALUES (NEW.id, v_user_email, v_family_id)
      ON CONFLICT (id) DO UPDATE
      SET 
        email = EXCLUDED.email,
        family_id = EXCLUDED.family_id,
        updated_at = NOW();

  EXCEPTION WHEN OTHERS THEN
      -- Log the error but don't fail the transaction if possible? 
      -- Actually, for auth trigger, failing the transaction is usually what we want 
      -- so the user isn't created in a broken state.
      -- But we want to see the error.
      RAISE LOG 'Error in handle_new_user: % %', SQLERRM, SQLSTATE;
      RAISE EXCEPTION 'Database error saving new user: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger to be safe (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();





