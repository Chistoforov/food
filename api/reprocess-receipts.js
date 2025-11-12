// Vercel Serverless Function for reprocessing existing receipts
// This function re-analyzes receipt images to extract product types using updated AI prompt

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
 * Parses receipt image using Perplexity API (same as process-receipt.js)
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
      temperature: 0.1,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Perplexity response');
  }

  const parsedData = JSON.parse(jsonMatch[0]);
  return parsedData;
}

/**
 * Normalize product name for consistent matching
 */
function normalizeProductName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Find similar products by name and suggest product type
 */
async function findSimilarProductType(productName, familyId) {
  try {
    const normalizedName = normalizeProductName(productName);
    const nameWords = normalizedName.split(' ').filter(word => word.length > 2);
    
    if (nameWords.length === 0) return null;

    const { data, error } = await supabase
      .from('products')
      .select('name, product_type, purchase_count')
      .eq('family_id', familyId)
      .not('product_type', 'is', null)
      .order('purchase_count', { ascending: false })
      .limit(100);

    if (error || !data || data.length === 0) {
      return null;
    }

    let bestMatch = null;
    let highestScore = 0;

    for (const existingProduct of data) {
      const existingNormalized = normalizeProductName(existingProduct.name);
      const existingWords = existingNormalized.split(' ').filter(word => word.length > 2);
      
      let matchingWords = 0;
      for (const word of nameWords) {
        if (existingWords.some(ew => ew.includes(word) || word.includes(ew))) {
          matchingWords++;
        }
      }

      const totalWords = Math.max(nameWords.length, existingWords.length);
      const score = matchingWords / totalWords;

      if (score > highestScore && score >= 0.6) {
        highestScore = score;
        bestMatch = {
          productType: existingProduct.product_type,
          matchedProduct: existingProduct.name,
          similarity: Math.round(score * 100)
        };
      }
    }

    if (bestMatch) {
      console.log(`🔍 Найден похожий продукт: "${productName}" → "${bestMatch.matchedProduct}" (${bestMatch.similarity}% совпадение, тип: ${bestMatch.productType})`);
    }

    return bestMatch;
  } catch (error) {
    console.error('Ошибка поиска похожих продуктов:', error);
    return null;
  }
}

/**
 * Update product types from re-parsed receipt data
 */
async function updateProductTypes(familyId, parsedData) {
  const { items } = parsedData;
  let updatedCount = 0;

  for (const item of items) {
    if (!item.productType) {
      console.log(`⚠️ Пропускаем "${item.name}" - нет productType`);
      continue;
    }

    // Check for similar products to ensure consistent categorization
    let finalProductType = item.productType.toLowerCase();
    const similarProduct = await findSimilarProductType(item.name, familyId);
    if (similarProduct) {
      console.log(`🔄 Корректировка категории с "${finalProductType}" на "${similarProduct.productType}" на основе похожего продукта`);
      finalProductType = similarProduct.productType;
    }

    // Find existing product by name
    const { data: existingProducts } = await supabase
      .from('products')
      .select('*')
      .eq('family_id', familyId)
      .ilike('name', item.name)
      .limit(1);

    if (existingProducts && existingProducts.length > 0) {
      const product = existingProducts[0];
      
      // Update product_type if it's different or missing
      if (!product.product_type || product.product_type !== finalProductType) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            product_type: finalProductType
          })
          .eq('id', product.id);

        if (updateError) {
          console.error(`❌ Ошибка обновления "${item.name}":`, updateError);
        } else {
          console.log(`✅ Обновлен тип для "${item.name}": ${finalProductType}`);
          updatedCount++;
        }
      } else {
        console.log(`ℹ️ "${item.name}" уже имеет тип "${product.product_type}"`);
      }
    } else {
      console.log(`⚠️ Продукт "${item.name}" не найден в БД`);
    }
  }

  return updatedCount;
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
    const { familyId, receiptIds } = req.body;

    if (!familyId) {
      return res.status(400).json({ error: 'familyId is required' });
    }

    // Get receipts to reprocess
    let query = supabase
      .from('receipts')
      .select('*')
      .eq('family_id', familyId)
      .eq('status', 'processed')
      .not('image_url', 'is', null);

    // If specific receipt IDs provided, filter by them
    if (receiptIds && receiptIds.length > 0) {
      query = query.in('id', receiptIds);
    }

    const { data: receipts, error: receiptsError } = await query;

    if (receiptsError) {
      throw receiptsError;
    }

    if (!receipts || receipts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Нет чеков для обработки',
        receiptsProcessed: 0,
        productsUpdated: 0
      });
    }

    console.log(`🔄 Начинаем повторную обработку ${receipts.length} чеков...`);

    let totalProductsUpdated = 0;
    const results = [];

    // Process each receipt
    for (const receipt of receipts) {
      try {
        console.log(`📄 Обрабатываем чек #${receipt.id} от ${receipt.date}`);
        
        // Parse receipt with Perplexity
        const parsedData = await parseReceiptWithPerplexity(receipt.image_url);
        
        // Update product types
        const updatedCount = await updateProductTypes(familyId, parsedData);
        totalProductsUpdated += updatedCount;

        results.push({
          receiptId: receipt.id,
          date: receipt.date,
          success: true,
          productsUpdated: updatedCount
        });

        console.log(`✅ Чек #${receipt.id} обработан: обновлено ${updatedCount} продуктов`);
      } catch (error) {
        console.error(`❌ Ошибка обработки чека #${receipt.id}:`, error);
        results.push({
          receiptId: receipt.id,
          date: receipt.date,
          success: false,
          error: error.message
        });
      }
    }

    // Recalculate stats for all products
    console.log('🔄 Пересчитываем статистику для всех продуктов...');
    const { data: allProducts } = await supabase
      .from('products')
      .select('id')
      .eq('family_id', familyId);

    if (allProducts) {
      for (const product of allProducts) {
        // Trigger stats recalculation (this will be done by the frontend)
        console.log(`📊 Продукт #${product.id} требует пересчета статистики`);
      }
    }

    return res.status(200).json({
      success: true,
      receiptsProcessed: receipts.length,
      productsUpdated: totalProductsUpdated,
      results: results
    });

  } catch (error) {
    console.error('❌ Ошибка повторной обработки чеков:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

