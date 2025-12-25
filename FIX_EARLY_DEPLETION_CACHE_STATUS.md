# Fix: Products Stay "In Stock" After Early Depletion Button Click

**Date:** November 15, 2025  
**Issue:** After clicking the "Early Depletion" button (orange button with triangle), products like shrimp remain with "In Stock" status (green card) instead of changing to "Ending Soon" (orange card)

## Root Cause

The SQL function `calculate_product_type_status()` in the database doesn't account for early depletion. It only checks the `last_purchase` date and applies the "2-day rule" (product is always "in stock" for 2 days after purchase), but doesn't check if the last history entry was an early depletion (quantity=-1).

**Current Flow:**
1. ✅ User clicks "Early Depletion" button for shrimp
2. ✅ History entry created with `quantity=-1`
3. ✅ `last_purchase` updated to today
4. ✅ Product type stats cache recalculated
5. ❌ SQL function sees `last_purchase` = today, returns status `'ok'` (2-day rule)
6. ❌ Shrimp stays "in stock" instead of "ending soon"

## Solution

Update the SQL function `calculate_product_type_status()` to:
1. **PRIORITY 1:** Check the last history entry for each product
2. If last entry = `quantity=-1` → status = `'ending-soon'` (regardless of date)
3. **PRIORITY 2:** Apply 2-day rule only for regular purchases
4. **PRIORITY 3:** Regular logic based on `avg_days` and `predicted_end`

## How to Apply the Fix

### Step 1: Open Supabase Dashboard

1. Go to [supabase.com](https://supabase.com)
2. Open your **Grocery** project
3. Navigate to **SQL Editor** (left menu)

### Step 2: Run the SQL Migration

1. Click **+ New Query**
2. Open the file `migration_fix_early_depletion_in_cache.sql` from your project
3. Copy all the code from the file
4. Paste into SQL Editor
5. Click **Run** (or Ctrl+Enter / Cmd+Enter)

### Step 3: Verify Success

You should see:
```
Success. No rows returned
```

This means the function was successfully recreated.

### Step 4: Recalculate Cache

After applying the migration, recalculate the cache once for your family:

```sql
-- Replace 1 with your family ID if different
SELECT recalculate_product_type_stats(1);
```

### Step 5: Test in the App

1. Open Grocery Tracker app
2. Refresh the page (F5 or Cmd+R)
3. Find a product with "In Stock" status (green card)
4. Click the orange triangle button (Early Depletion)
5. Card should turn orange "Ending Soon" ✅

## Technical Details

### Changes to SQL Function

**Before:**
```sql
-- Only checks purchase date
IF v_days_since_purchase < 2 THEN
  v_has_recent_purchase := true;
  EXIT;
END IF;

IF v_has_recent_purchase THEN
  RETURN 'ok'; -- Always returns 'ok' for recent purchases
END IF;
```

**After:**
```sql
-- First check for early depletion (quantity=-1)
SELECT ph.quantity INTO v_last_history_quantity
FROM product_history ph
WHERE ph.product_id = v_product_record.id
ORDER BY ph.date DESC, ph.id DESC
LIMIT 1;

IF v_last_history_quantity = -1 THEN
  v_is_early_depletion := true;
END IF;

-- PRIORITY 1: Early depletion → 'ending-soon'
IF v_is_early_depletion THEN
  RETURN 'ending-soon';
END IF;

-- PRIORITY 2: 2-day rule (only for regular purchases)
IF v_days_since_purchase < 2 AND v_last_history_quantity != -1 THEN
  RETURN 'ok';
END IF;
```

## Testing

### Test 1: Early Depletion
- ✅ Click early depletion button for shrimp
- ✅ Card should turn orange "Ending Soon"
- ✅ Green "In Stock" button should appear

### Test 2: Virtual Purchase After Early Depletion
- ✅ Click green "In Stock" button
- ✅ Card should turn green "In Stock"
- ✅ Orange early depletion button should appear

### Test 3: 2-Day Rule for Regular Purchases
- ✅ Upload receipt with shrimp
- ✅ First 2 days status should be "In Stock"
- ✅ After 2 days status calculated by `avg_days`

## Files

- `migration_fix_early_depletion_in_cache.sql` - SQL migration to apply
- `ИСПРАВЛЕНИЕ_ДОСРОЧНОГО_ОКОНЧАНИЯ_КЭШ.md` - Russian documentation
- `src/services/supabaseService.ts` - Client logic (no changes needed)
- `src/GroceryTrackerApp.tsx` - UI and handlers (no changes needed)
- `migration_add_product_type_stats_cache.sql` - Original cache migration

## Changelog

- **November 15, 2025:** Created migration to fix `calculate_product_type_status()`
- **Previous fixes:** Client-side logic was already fixed in `calculateProductStats()` (TypeScript)
- **Issue:** SQL function was not synchronized with client-side logic

## Notes

- This fix only affects the SQL function in the database
- Client-side TypeScript code already works correctly
- After applying the migration, everything will work properly
- Migration is backward compatible and won't break existing data





