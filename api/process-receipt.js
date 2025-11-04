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
      "productType": "общая категория продукта (см. правила ниже)",
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

КРИТИЧЕСКИ ВАЖНО про productType:
- "productType" - это ОБЩАЯ КАТЕГОРИЯ продукта, БЕЗ брендов и конкретных названий
- Это поле используется для группировки похожих продуктов разных брендов
- Примеры правильных типов:
  * "молоко" (для любого молока: "Простоквашино", "Parmalat", "Домик в деревне" и т.д.)
  * "хлеб белый" (для всех белых хлебов, независимо от бренда)
  * "хлеб черный" (для всех черных хлебов)
  * "сыр плавленный" (для "Дружба", "Филадельфия", "Viola" и т.д.)
  * "сыр твердый" (для Гауда, Чеддер и т.д.)
  * "яблоки" (для всех яблок, независимо от сорта)
  * "апельсины" (для всех апельсинов)
  * "йогурт" (для всех йогуртов)
  * "масло сливочное" (для всех сливочных масел)
  * "масло растительное" (для подсолнечного, оливкового и т.д.)
  * "курица" (для любых частей курицы)
  * "говядина" (для любых частей говядины)
  * "рис" (для всех видов риса)
  * "макароны" (для всех видов пасты)
  * "яйца" (для всех яиц)
  * "сахар" (для всех видов сахара)
  * "соль" (для всех видов соли)
  * "вода" (для всех видов воды)
- ВСЕГДА используй строчные буквы для productType
- НИКОГДА не включай бренд в productType
- Если можешь уточнить тип (например "хлеб белый" вместо просто "хлеб") - уточни
- Для похожих продуктов используй ОДИНАКОВЫЙ productType

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

  // Parse JSON with error handling
  let parsedData;
  try {
    parsedData = JSON.parse(jsonText);
  } catch (parseError) {
    console.error('Failed to parse JSON:', jsonText.substring(0, 500));
    console.error('Parse error details:', parseError);
    
    // Try to extract valid JSON by finding the first { and matching closing }
    // This handles cases where there's extra text after the JSON
    try {
      const firstBrace = jsonText.indexOf('{');
      if (firstBrace !== -1) {
        let braceCount = 0;
        let endIndex = -1;
        
        for (let i = firstBrace; i < jsonText.length; i++) {
          if (jsonText[i] === '{') braceCount++;
          if (jsonText[i] === '}') braceCount--;
          
          if (braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
        
        if (endIndex !== -1) {
          const extractedJson = jsonText.substring(firstBrace, endIndex);
          console.log('Attempting to parse extracted JSON:', extractedJson.substring(0, 200));
          parsedData = JSON.parse(extractedJson);
          console.log('Successfully parsed extracted JSON');
        } else {
          throw parseError;
        }
      } else {
        throw parseError;
      }
    } catch (secondError) {
      throw new Error(`Failed to parse API response. Received text: ${jsonText.substring(0, 200)}... Error: ${parseError.message || 'Unknown error'}`);
    }
  }

  if (!parsedData.items || !Array.isArray(parsedData.items)) {
    throw new Error('Invalid response structure: missing items array');
  }

  return parsedData;
}

/**
 * Normalize product name for consistent matching
 */
function normalizeProductName(name) {
  if (!name) return '';
  // Convert to lowercase, trim, and normalize spaces
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check cache for existing translation
 */
async function getCachedTranslation(originalName, familyId) {
  const { data, error } = await supabase
    .rpc('get_cached_translation', {
      p_original_name: originalName,
      p_family_id: familyId
    });

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0]; // Returns { translated_name, product_type }
}

/**
 * Save translation to cache
 */
async function saveCachedTranslation(originalName, translatedName, productType, familyId) {
  await supabase.rpc('save_translation_cache', {
    p_original_name: originalName,
    p_translated_name: translatedName,
    p_product_type: productType,
    p_family_id: familyId
  });
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

  // Массив для сохранения ID затронутых продуктов
  const affectedProductIds = [];

  // Process each item
  for (const item of items) {
    // Check cache first for this original name
    let cachedTranslation = null;
    if (item.originalName) {
      cachedTranslation = await getCachedTranslation(item.originalName, familyId);
    }

    // Use cached translation if available, otherwise use AI translation
    const finalName = cachedTranslation ? cachedTranslation.translated_name : item.name;
    const finalProductType = cachedTranslation ? cachedTranslation.product_type : item.productType;

    // If we're using AI translation (not cached), save it to cache
    if (!cachedTranslation && item.originalName) {
      await saveCachedTranslation(item.originalName, item.name, item.productType, familyId);
      console.log(`📝 Cached new translation: "${item.originalName}" → "${item.name}" (${item.productType})`);
    } else if (cachedTranslation) {
      console.log(`✅ Using cached translation: "${item.originalName}" → "${finalName}" (${finalProductType})`);
    }

    // Find existing product by product_type first (for better matching)
    let existingProducts = [];
    
    if (finalProductType) {
      // Try to find by product_type
      const { data: typeMatches } = await supabase
        .from('products')
        .select('*')
        .eq('family_id', familyId)
        .eq('product_type', finalProductType)
        .limit(1);
      
      if (typeMatches && typeMatches.length > 0) {
        existingProducts = typeMatches;
      }
    }
    
    // If no match by type, try by name
    if (existingProducts.length === 0) {
      const { data: nameMatches } = await supabase
        .from('products')
        .select('*')
        .eq('family_id', familyId)
        .ilike('name', finalName)
        .limit(1);
      
      if (nameMatches) {
        existingProducts = nameMatches;
      }
    }

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
          original_name: item.originalName || product.original_name,
          product_type: finalProductType || product.product_type
        })
        .eq('id', product.id);

      if (updateError) throw updateError;
    } else {
      // Create new product
      const { data: newProduct, error: createError } = await supabase
        .from('products')
        .insert({
          name: finalName,
          original_name: item.originalName,
          product_type: finalProductType,
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
    
    // Сохраняем ID продукта для последующего пересчета статусов
    affectedProductIds.push(product.id);
  }

  // Пересчитываем статусы для всех затронутых продуктов
  console.log(`🔄 Пересчитываем статусы для ${affectedProductIds.length} продуктов...`);
  for (const productId of affectedProductIds) {
    try {
      await supabase.rpc('update_product_analytics', {
        p_product_id: productId,
        p_family_id: familyId
      });
      console.log(`✅ Статус продукта #${productId} обновлен`);
    } catch (error) {
      console.error(`❌ Ошибка обновления статуса продукта #${productId}:`, error);
      // Продолжаем выполнение даже при ошибке
    }
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

  // Пересчитываем кэш статусов типов продуктов
  console.log('🔄 Пересчитываем кэш статусов типов продуктов...');
  try {
    await supabase.rpc('recalculate_product_type_stats', {
      p_family_id: familyId
    });
    console.log('✅ Кэш статусов типов продуктов обновлен');
  } catch (error) {
    console.error('❌ Ошибка пересчета кэша типов продуктов:', error);
    // Не прерываем выполнение - это некритичная ошибка
  }

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
    console.log('✅ Updating pending receipt status to completed:', pendingReceiptId);
    const { data: updatedReceipt, error: updateError } = await supabase
      .from('pending_receipts')
      .update({
        status: 'completed',
        parsed_data: parsedData,
        processed_at: new Date().toISOString()
      })
      .eq('id', pendingReceiptId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating pending receipt status:', updateError);
      throw updateError;
    }

    console.log('✅ Receipt status updated successfully:', {
      id: updatedReceipt.id,
      status: updatedReceipt.status,
      itemsCount: parsedData?.items?.length || 0
    });
    console.log('📡 Realtime should now notify all subscribers about this change');
    
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

