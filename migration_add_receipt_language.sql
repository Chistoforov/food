-- Migration: Add receipt language preference and uploaded_by tracking
-- Description: Adds receipt_language to user_profiles and uploaded_by to pending_receipts

-- 1. Add receipt_language to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS receipt_language VARCHAR(50);

-- 2. Add uploaded_by to pending_receipts
ALTER TABLE pending_receipts
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

-- 3. Update handle_new_user function to handle default language
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_family_id INTEGER;
  v_invite_record RECORD;
  v_default_language VARCHAR(50);
BEGIN
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
    
    -- For invited users, set default language to Russian (or we could try to copy from family, but this is safer)
    -- This prevents the onboarding modal from showing up for them
    v_default_language := 'Russian';
  ELSE
    -- Create new family
    INSERT INTO families (name, member_count) 
    VALUES ('Семья ' || SPLIT_PART(NEW.email, '@', 1), 1)
    RETURNING id INTO v_family_id;
    
    -- For new family creators, leave language as NULL to trigger the onboarding modal
    v_default_language := NULL;
  END IF;

  -- Create user profile
  INSERT INTO user_profiles (id, email, family_id, receipt_language)
  VALUES (NEW.id, NEW.email, v_family_id, v_default_language);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

