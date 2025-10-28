# Receipt Scanning Feature 📸

## Overview

The Grocery Tracker app now includes AI-powered receipt scanning functionality using Perplexity AI. This feature allows users to photograph their grocery receipts and automatically extract product information, prices, quantities, and calorie data.

## Features

- 📸 **Camera Support**: Take photos directly from your device camera
- 🖼️ **Gallery Upload**: Select existing receipt images from your gallery
- 🤖 **AI Parsing**: Perplexity AI automatically extracts:
  - Product names
  - Quantities and units (kg, L, шт, etc.)
  - Prices
  - Total amount
  - Receipt date
  - **Calorie data for the FULL purchased quantity** (not per 100g/100ml)
- 💾 **Automatic Storage**: All data is saved to the database
- 📊 **Statistics Update**: Monthly statistics are recalculated automatically

## How It Works

### User Flow

1. Navigate to the "Чек" (Receipt) tab
2. Click "Камера" to take a photo or "Галерея" to select an existing image
3. Wait while the AI processes the receipt (typically 5-15 seconds)
4. Review the extracted items in the success message
5. Data is automatically added to your product list

### Technical Flow

1. **Image Upload**: User selects/captures an image
2. **Image Validation**: Check file type and size (max 10MB)
3. **Base64 Conversion**: Convert image to base64 for API transmission
4. **Perplexity API Call**: Send image with detailed parsing instructions
5. **Response Parsing**: Extract JSON data from AI response
6. **Data Processing**:
   - Create or update products in database
   - Add purchase history entries
   - Update product statistics
   - Recalculate monthly statistics
7. **UI Update**: Display success message with parsed items

## Calorie Calculation Logic

### Important: Full Quantity Calories

The AI is instructed to calculate calories for the **entire purchased quantity**, not per 100g/100ml:

- ✅ 1 liter of milk → calories for 1000ml
- ✅ 500g cottage cheese → calories for 500g
- ✅ 1 loaf of bread (400-500g) → calories for the whole loaf
- ✅ 2 items → calories for both items

This ensures accurate tracking of actual calorie consumption from purchases.

### Database Storage

- **product_history.quantity**: The purchased quantity (e.g., 1 for 1L milk)
- **products.calories**: Calories **per unit** (total calories / quantity)
- This allows flexible calculations when displaying data

## API Configuration

### Perplexity API

- **Endpoint**: `https://api.perplexity.ai/chat/completions`
- **Model**: `llama-3.1-sonar-large-128k-online`
- **API Key**: Stored in `perplexityService.ts`
- **Temperature**: 0.2 (for consistent structured output)
- **Max Tokens**: 2000

### Request Structure

```typescript
{
  model: 'llama-3.1-sonar-large-128k-online',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: '<detailed prompt>' },
        { type: 'image_url', image_url: { url: '<base64 image>' } }
      ]
    }
  ],
  temperature: 0.2,
  max_tokens: 2000
}
```

### Expected Response Format

```json
{
  "items": [
    {
      "name": "Product name",
      "quantity": 1,
      "unit": "л",
      "price": 1.89,
      "calories": 620
    }
  ],
  "total": 9.08,
  "date": "2024-10-28"
}
```

## Files Modified

### New Files

- **`src/services/perplexityService.ts`**: Perplexity API integration service
  - `parseReceiptImage()`: Main parsing function
  - `imageToBase64()`: Image conversion utility
  - `parseReceiptImageMock()`: Mock function for testing

### Modified Files

- **`src/GroceryTrackerApp.tsx`**: Updated UploadPage component
  - Added camera/file input
  - Integrated receipt parsing
  - Added loading and error states
  - Success message with parsed items
  
- **`src/services/supabaseService.ts`**: Added receipt processing
  - `processReceipt()`: Process parsed receipt and save to database
  - Creates/updates products
  - Adds purchase history
  - Triggers statistics recalculation

## Error Handling

The feature includes comprehensive error handling:

1. **File Validation**:
   - File type check (must be image)
   - File size limit (max 10MB)

2. **API Errors**:
   - Network failures
   - Invalid API responses
   - JSON parsing errors

3. **Database Errors**:
   - Supabase connection issues
   - Data validation failures

4. **User Feedback**:
   - Loading spinner during processing
   - Success message with item details
   - Error message with actionable information

## UI Components

### Upload Area

- Drag-and-drop-style interface
- Two buttons: "Камера" and "Галерея"
- Disabled state during processing
- Animated loading spinner

### Success Message

- Green notification box
- List of extracted items with details
- Auto-dismisses after 5 seconds

### Error Message

- Red notification box
- Clear error description
- Dismissible with X button

### Info Box

- Blue informational box
- Explains how the feature works
- Sets user expectations

## Testing

### Manual Testing

1. **Test with real receipt**:
   ```bash
   # Take a photo of a receipt and upload
   # Verify all items are correctly extracted
   ```

2. **Test with mock data**:
   ```typescript
   // In perplexityService.ts, use parseReceiptImageMock()
   // instead of parseReceiptImage() for testing without API calls
   ```

3. **Test error scenarios**:
   - Upload non-image file
   - Upload very large file (>10MB)
   - Test with no internet connection

### Database Verification

After processing a receipt, verify:

```sql
-- Check receipt was created
SELECT * FROM receipts ORDER BY created_at DESC LIMIT 1;

-- Check products were created/updated
SELECT * FROM products WHERE last_purchase = CURRENT_DATE;

-- Check history entries
SELECT * FROM product_history ORDER BY created_at DESC LIMIT 10;

-- Check monthly stats were updated
SELECT * FROM monthly_stats WHERE family_id = 1;
```

## Future Improvements

1. **Receipt Image Storage**: Save receipt images to Supabase Storage
2. **Manual Editing**: Allow users to edit parsed data before saving
3. **Receipt History**: View details of past receipts with items
4. **OCR Fallback**: Use backup OCR service if Perplexity fails
5. **Offline Support**: Queue receipts for processing when online
6. **Multi-language**: Support receipts in different languages
7. **Store Detection**: Automatically detect store name from receipt

## Troubleshooting

### Common Issues

1. **"No response from Perplexity API"**
   - Check API key is valid
   - Verify network connection
   - Check Perplexity service status

2. **"Invalid response structure"**
   - Receipt image may be unclear
   - Try taking a clearer photo
   - Ensure receipt is well-lit and flat

3. **Incorrect calorie data**
   - AI may misinterpret quantities
   - Manually edit product calories if needed
   - Report patterns to improve prompts

4. **Products not appearing**
   - Check browser console for errors
   - Verify Supabase connection
   - Refresh page to reload data

## Security Considerations

1. **API Key**: Store securely (consider environment variables for production)
2. **Image Data**: Base64 images can be large, consider size limits
3. **Input Validation**: Always validate file types and sizes
4. **Error Messages**: Don't expose sensitive information in errors

## Performance

- **Image Conversion**: ~100-500ms (depends on image size)
- **API Call**: ~5-15 seconds (depends on image complexity)
- **Database Operations**: ~1-2 seconds (for typical 5-10 items)
- **Total Time**: ~6-18 seconds for complete process

## Conclusion

The receipt scanning feature provides a seamless way for users to track their grocery purchases without manual data entry. The AI-powered parsing ensures accurate extraction of product information and calorie data, making the app more valuable and user-friendly.

