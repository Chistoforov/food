# Fix: Early Depletion Status Priority Logic

**Date:** November 15, 2025  
**Status:** ✅ Fixed

## Problem

When clicking the "Product ran out early" button for a product type (e.g., "shrimp"):

1. ✅ All products of this type were successfully marked as early depleted
2. ✅ History entries with `quantity=-1` were added
3. ✅ `last_purchase` was updated to today
4. ✅ `avg_days` was recalculated (decreased)
5. ❌ **BUT product status remained `'ok'` (Available) instead of `'ending-soon'` (Running Out)**

## Root Cause

The issue was in the `calculateProductStats()` function logic in `src/services/supabaseService.ts`.

### Old Logic (INCORRECT):

```typescript
if (daysSincePurchase < 2 && !isEarlyDepletion) {
  status = 'ok'
} else if (daysUntilEnd <= 2) {
  status = 'ending-soon'
}
```

### What Was Happening:

1. Product marked as early depleted
2. `last_purchase` = today (Nov 15)
3. `avg_days` decreased, e.g., from 10 to 3 days
4. `predicted_end` = today + avg_days = Nov 15 + 3 days = **Nov 18**
5. `daysUntilEnd` = 3 days (**> 2 days!**)
6. Condition `daysUntilEnd <= 2` was not met
7. ❌ Status remained `'ok'` by default

**Problem:** Even if product ran out TODAY, `predicted_end` is always in the future because it's calculated as `today + avg_days`.

## Solution

Changed the status check logic - **early depletion now has the highest priority**.

### New Logic (CORRECT):

```typescript
// PRIORITY 1: If last entry is early depletion, product HAS ALREADY run out
if (isEarlyDepletion) {
  status = 'ending-soon'
}
// PRIORITY 2: If product was purchased recently (< 2 days ago)
else if (daysSincePurchase < 2) {
  status = 'ok'
}
// PRIORITY 3: Check predicted end date
else if (daysUntilEnd <= 2) {
  status = 'ending-soon'
}
```

### Status Priority Levels:

1. **PRIORITY 1 (HIGHEST):** Early depletion (`quantity=-1`) → status **ALWAYS** `'ending-soon'`
2. **PRIORITY 2:** Recent purchase (< 2 days) → status `'ok'` (2-day guarantee)
3. **PRIORITY 3:** Predicted end (≤ 2 days) → status `'ending-soon'`

## How It Works Now

### Regular Purchase (from receipt)
- Last entry: `quantity > 0`
- `isEarlyDepletion = false`
- **Result:** Guaranteed 2-day `'ok'` status after purchase

### Early Depletion (button)
- Last entry: `quantity = -1`
- `isEarlyDepletion = true`
- **Result:** Status **IMMEDIATELY** changes to `'ending-soon'`, regardless of:
  - Purchase date
  - `avg_days` value
  - `predicted_end` value
  - `daysUntilEnd` value

### Early Depletion for Product TYPE
Button works **for the entire category**:

1. User clicks button on type card (e.g., "shrimp")
2. System finds **ALL** products of this type from DB
3. For **EACH** product:
   - History entry added with `quantity=-1`
   - `last_purchase` updated to today
   - Statistics recalculated
   - **Status changes to `'ending-soon'`**
4. Product type stats cache is recalculated
5. UI updates

## Files Changed

### Modified:
- ✅ `src/services/supabaseService.ts` - `calculateProductStats()` function (lines 335-359)

### Added:
- ✅ `FIX_EARLY_DEPLETION_STATUS_PRIORITY.md` - this documentation (English)
- ✅ `ИСПРАВЛЕНИЕ_ЛОГИКИ_ДОСРОЧНОГО_ОКОНЧАНИЯ.md` - this documentation (Russian)

## Testing

1. Open the home page
2. Find a product type card with "Available" status (green border)
3. Click the orange triangle button (early depletion)
4. **Expected:** Card should **immediately** change color to orange ("Running Out")
5. All products of this type should get "Running Out" status

## Related Documents

- `EARLY_DEPLETION_FEATURE.md` - early depletion feature description
- `FIX_EARLY_DEPLETION_BUTTON.md` - previous fix (2-day rule)
- `FIX_EARLY_DEPLETION_GROUP_HISTORY.md` - group history fix
- `FIX_EARLY_DEPLETION_CACHE.md` - type stats cache fix

## Technical Details

### The Priority System

The status calculation now follows a clear priority hierarchy:

**Priority 1 - Early Depletion (Highest):**
- Checked FIRST
- If `quantity=-1` in last history entry
- Status is ALWAYS `'ending-soon'`
- Overrides all other conditions

**Priority 2 - Recent Purchase Guarantee:**
- Checked if Priority 1 doesn't apply
- If purchased < 2 days ago
- Status is `'ok'`
- Ensures freshly bought products show as available

**Priority 3 - Predicted End Date:**
- Checked if Priority 1 and 2 don't apply
- If predicted end ≤ 2 days away
- Status is `'ending-soon'`
- Based on historical purchase patterns

**Default:**
- If none of the above apply
- Status is `'ok'`

This ensures that user actions (early depletion) always take precedence over automatic predictions.

