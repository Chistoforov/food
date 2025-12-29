-- Function to manually create a profile if the trigger failed
-- This acts as a self-healing mechanism for the "infinite loading" bug

CREATE OR REPLACE FUNCTION create_my_profile()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_family_id INTEGER;
  v_invite_record RECORD;
  v_profile_exists BOOLEAN;
  v_result jsonb;
BEGIN
  -- Get current user ID
  v_uid := auth.uid();
  
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  
  IF v_email IS NULL THEN
      -- Fallback if email not found (should not happen for valid user)
      v_email := 'unknown@user.com';
  END IF;

  -- Check if profile already exists
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = v_uid) INTO v_profile_exists;
  
  IF v_profile_exists THEN
     SELECT row_to_json(up) INTO v_result FROM public.user_profiles up WHERE id = v_uid;
     RETURN v_result;
  END IF;

  RAISE LOG 'Manually creating profile for %', v_email;

  -- Logic to determine family (similar to trigger)
  
  -- Check for existing pending invitation
  SELECT * INTO v_invite_record FROM public.family_invitations 
  WHERE email = v_email AND status = 'pending' 
  LIMIT 1;
  
  IF FOUND THEN
    -- Join existing family
    v_family_id := v_invite_record.family_id;
    
    -- Update invitation status
    UPDATE public.family_invitations SET status = 'accepted' WHERE id = v_invite_record.id;
    
    -- Increment family member count
    UPDATE public.families SET member_count = member_count + 1 WHERE id = v_family_id;
  ELSE
    -- Create new family
    INSERT INTO public.families (name, member_count) 
    VALUES ('Семья ' || SPLIT_PART(v_email, '@', 1), 1)
    RETURNING id INTO v_family_id;
  END IF;

  -- Create user profile
  INSERT INTO public.user_profiles (id, email, family_id)
  VALUES (v_uid, v_email, v_family_id)
  RETURNING row_to_json(user_profiles) INTO v_result;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in create_my_profile: % %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;

