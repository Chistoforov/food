# Fix for Infinite Loading Loop on Sign Up

The issue is that for some new users, the database trigger that automatically creates a user profile is failing or being too slow. This leaves the user in a "Signed In" state but without a profile, causing the application to loop indefinitely trying to fetch the missing profile.

To fix this, we've added a self-healing mechanism: if the application can't find a profile, it will ask the database to create one manually.

## Instructions

1. **Go to your Supabase Dashboard** -> **SQL Editor**.
2. **Open the file** `FIX_PROFILE_CREATION.sql` from this repository (or copy its content).
3. **Run the SQL**.

This creates a function `create_my_profile()` that the application will call as a fallback.

## What changed?

- Added `FIX_PROFILE_CREATION.sql`: Creates a secure database function to generate a profile if one is missing.
- Updated `src/contexts/AuthContext.tsx`: Modified the profile fetching logic to call this function if the standard fetch fails.

