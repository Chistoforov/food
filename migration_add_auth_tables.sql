-- Migration: Add Auth Tables
-- Description: Adds user_profiles, family_invitations and triggers for user creation

-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  family_id INTEGER REFERENCES families(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create family_invitations table
CREATE TABLE IF NOT EXISTS family_invitations (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  -- Allow only one pending invitation per email
  UNIQUE(email, status)
);

-- 3. Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policies for family_invitations
DROP POLICY IF EXISTS "Users can view invitations for their family" ON family_invitations;
CREATE POLICY "Users can view invitations for their family"
  ON family_invitations FOR SELECT
  USING (family_id IN (SELECT family_id FROM user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create invitations for their family" ON family_invitations;
CREATE POLICY "Users can create invitations for their family"
  ON family_invitations FOR INSERT
  WITH CHECK (family_id IN (SELECT family_id FROM user_profiles WHERE id = auth.uid()));

-- 4. Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_family_id INTEGER;
  v_invite_record RECORD;
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
    
    -- Increment family member count (optional, good for display)
    UPDATE families SET member_count = member_count + 1 WHERE id = v_family_id;
  ELSE
    -- Create new family
    INSERT INTO families (name, member_count) 
    VALUES ('Семья ' || SPLIT_PART(NEW.email, '@', 1), 1)
    RETURNING id INTO v_family_id;
  END IF;

  -- Create user profile
  INSERT INTO user_profiles (id, email, family_id)
  VALUES (NEW.id, NEW.email, v_family_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. Add policy for existing tables to respect family_id based on user_profile
-- Note: We need to update existing RLS or add RLS to products/receipts if not present.
-- Assuming products/receipts/families are public for now or we need to lock them down.
-- For now, we will rely on frontend passing the correct family_id (which comes from the secure profile),
-- but ideally we should enable RLS on all tables.




