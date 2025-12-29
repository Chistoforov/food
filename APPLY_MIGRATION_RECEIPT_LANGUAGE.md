# Apply Migration: Receipt Language

This update adds support for user-specific receipt languages to improve recognition accuracy.

## Changes
1. Adds `receipt_language` column to `user_profiles`.
2. Adds `uploaded_by` column to `pending_receipts` to track who uploaded the receipt.
3. Updates `handle_new_user` trigger to manage default language settings (invited users get default 'Russian', creators get NULL to trigger onboarding modal).

## How to Apply

Run the SQL script in your Supabase SQL Editor:

1. Open [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor**.
3. Create a new query.
4. Copy and paste the contents of `migration_add_receipt_language.sql`.
5. Click **Run**.

## Verification

After applying the migration:
1. Reload the application.
2. If you are the account creator, you might see the "Welcome" modal asking for receipt language (if your profile was created before this migration, `receipt_language` will be NULL, so you will see it).
3. Check the "Account" page - you should see the "Receipt Language" selector.
4. Try uploading a receipt - the system will now use your selected language for recognition.



