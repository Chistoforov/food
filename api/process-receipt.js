// Vercel Serverless Function for background receipt processing
// This function is called immediately after a receipt is uploaded
// It processes the receipt asynchronously so users can close the app

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Perplexity API configuration
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Parses receipt image using Perplexity API
 */
async function parseReceiptWithPerplexity(imageUrl) {
  const prompt = `Проанализируй этот чек из магазина и извлеки следующую информацию в формате JSON:

{
  "items": [
    {
      "name": "русское название продукта (понятное и читаемое)",
      "originalName": "оригинальное название с чека (как написано в магазине)",
      "quantity": число (сколько единиц товара куплено),
      "unit": "единица измерения (кг, л, шт, г, мл)",
      "price": цена (число - ТОЧНАЯ цена из чека),
      "calories": общее количество калорий для ВСЕГО купленного количества (не на 100г!)
    }
  ],
  "total": общая сумма,
  "date": "дата в формате YYYY-MM-DD"
}

ВАЖНО про названия:
- "name" - это красивое русское название (например: "Молоко 3.2% 1L", "Хлеб белый", "Яблоки")
- "originalName" - это точное название с чека как оно написано (например: "MILK 3.2% 1L", "BREAD WHITE", "APPLES")
- Если чек на русском, то оба поля могут быть одинаковыми

КРИТИЧЕСКИ ВАЖНО про quantity и price:
- "quantity" - это количество купленного товара в ЕДИНИЦАХ ИЗМЕРЕНИЯ
- "price" - это ТОЧНАЯ итоговая цена из чека (сколько заплатили)
- НИКОГДА не пересчитывай цену! Бери только финальную цену из чека!

Примеры:
1. Упакованные товары (фиксированный вес в названии):
   - "Гуакамоле 200г - 1.95€" → quantity=1, unit="шт", price=1.95
   - "Молоко 3 X 1.50€" → quantity=3, unit="шт", price=4.50

2. Товары на вес (цена за кг/г):
   - "Сыр Rambol 0.212 X 19.98 = 4.24€" → quantity=0.212, unit="кг", price=4.24
   - "Яблоки 0.5 X 2.99 = 1.50€" → quantity=0.5, unit="кг", price=1.50
   
ПРАВИЛО: price - это ВСЕГДА итоговая цена покупки (правая колонка в чеке)!

ВАЖНО про калории:
- Калории должны быть для ВСЕГО купленного количества (quantity)
- Не указывай калории "на 100г" - всегда для полного количества!

Примеры:
- Куплено 212г сыра → укажи калории для 212г
- Куплен 1 литр молока → укажи калории для 1000мл
- Куплено 0.5 кг яблок → укажи калории для 500г
- Куплено 2 упаковки по 200г → укажи калории для 400г (2 × 200г)

ПРАВИЛО: calories = (калории на 100г/100мл) × (quantity в граммах/мл)

Верни только JSON без дополнительного текста.`;

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Perplexity API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content;
  
  if (!responseText) {
    throw new Error('No response from Perplexity API');
  }

  // Parse JSON response
  let jsonText = responseText.trim();
  
  // Remove <think> tags and their content
  jsonText = jsonText.replace(/<think>[\s\S]*?<\/think>/g, '');
  jsonText = jsonText.replace(/<[^>]+>/g, '');
  
  // Remove markdown code blocks
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '');
  }
  
  jsonText = jsonText.trim();

  // Handle escaped JSON string
  if ((jsonText.startsWith('"') && jsonText.endsWith('"')) || 
      (jsonText.startsWith("'") && jsonText.endsWith("'"))) {
    try {
      jsonText = JSON.parse(jsonText);
    } catch (e) {
      jsonText = jsonText.slice(1, -1)
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\');
    }
  }

  const parsedData = JSON.parse(jsonText);

  if (!parsedData.items || !Array.isArray(parsedData.items)) {
    throw new Error('Invalid response structure: missing items array');
  }

  return parsedData;
}

/**
 * Process receipt and save to database
 */
async function processReceipt(familyId, parsedData) {
  const { items, total, date } = parsedData;
  const receiptDate = date || new Date().toISOString().split('T')[0];

  // Create receipt
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .insert({
      family_id: familyId,
      date: receiptDate,
      items_count: items.length,
      total_amount: total,
      status: 'processed'
    })
    .select()
    .single();

  if (receiptError) throw receiptError;

  // Process each item
  for (const item of items) {
    // Find existing product or create new one
    const { data: existingProducts } = await supabase
      .from('products')
      .select('*')
      .eq('family_id', familyId)
      .ilike('name', item.name)
      .limit(1);

    let product;

    if (existingProducts && existingProducts.length > 0) {
      // Update existing product
      product = existingProducts[0];
      
      const { error: updateError } = await supabase
        .from('products')
        .update({
          last_purchase: receiptDate,
          price: item.price,
          calories: item.calories,
          purchase_count: (product.purchase_count || 0) + 1,
          original_name: item.originalName || product.original_name
        })
        .eq('id', product.id);

      if (updateError) throw updateError;
    } else {
      // Create new product
      const { data: newProduct, error: createError } = await supabase
        .from('products')
        .insert({
          name: item.name,
          original_name: item.originalName,
          family_id: familyId,
          last_purchase: receiptDate,
          price: item.price,
          calories: item.calories,
          purchase_count: 1,
          status: 'calculating',
          avg_days: null,
          predicted_end: null
        })
        .select()
        .single();

      if (createError) throw createError;
      product = newProduct;
    }

    // Add to purchase history
    const { error: historyError } = await supabase
      .from('product_history')
      .insert({
        product_id: product.id,
        family_id: familyId,
        date: receiptDate,
        quantity: item.quantity,
        price: item.price,
        unit_price: item.quantity > 0 ? item.price / item.quantity : item.price,
        receipt_id: receipt.id
      });

    if (historyError) throw historyError;
  }

  // Recalculate monthly stats
  const receiptDateObj = new Date(receiptDate);
  const year = receiptDateObj.getFullYear();
  const month = String(receiptDateObj.getMonth() + 1).padStart(2, '0');

  // Call RPC function to recalculate stats
  await supabase.rpc('recalculate_monthly_stats', {
    p_family_id: familyId,
    p_month: `${year}-${month}`,
    p_year: year
  });

  return receipt;
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pendingReceiptId } = req.body;

    if (!pendingReceiptId) {
      return res.status(400).json({ error: 'Missing pendingReceiptId' });
    }

    // Get pending receipt
    const { data: pendingReceipt, error: fetchError } = await supabase
      .from('pending_receipts')
      .select('*')
      .eq('id', pendingReceiptId)
      .single();

    if (fetchError || !pendingReceipt) {
      return res.status(404).json({ error: 'Pending receipt not found' });
    }

    // Update status to processing
    await supabase
      .from('pending_receipts')
      .update({
        status: 'processing',
        attempts: (pendingReceipt.attempts || 0) + 1
      })
      .eq('id', pendingReceiptId);

    // Get public URL for the image
    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(pendingReceipt.image_url);

    // Parse receipt with Perplexity
    console.log('Parsing receipt:', pendingReceiptId);
    const parsedData = await parseReceiptWithPerplexity(urlData.publicUrl);

    // Process and save receipt
    console.log('Processing receipt:', pendingReceiptId);
    await processReceipt(pendingReceipt.family_id, parsedData);

    // Update pending receipt status to completed
    await supabase
      .from('pending_receipts')
      .update({
        status: 'completed',
        parsed_data: parsedData,
        processed_at: new Date().toISOString()
      })
      .eq('id', pendingReceiptId);

    console.log('Receipt processed successfully:', pendingReceiptId);
    
    return res.status(200).json({
      success: true,
      message: 'Receipt processed successfully',
      parsedData
    });

  } catch (error) {
    console.error('Error processing receipt:', error);

    const { pendingReceiptId } = req.body;
    
    // Update pending receipt with error
    if (pendingReceiptId) {
      await supabase
        .from('pending_receipts')
        .update({
          status: 'failed',
          error_message: error.message,
          processed_at: new Date().toISOString()
        })
        .eq('id', pendingReceiptId);
    }

    return res.status(500).json({
      error: 'Failed to process receipt',
      message: error.message
    });
  }
}

