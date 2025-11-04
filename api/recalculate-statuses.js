import { createClient } from '@supabase/supabase-js';

/**
 * API endpoint для cron job пересчета статусов продуктов
 * Запускается раз в сутки в 1:00 для всех семей
 */

// Инициализация Supabase клиента на сервере
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Вычисляет статистику для продукта
 */
async function calculateProductStats(productId, familyId) {
  try {
    // Получаем информацию о продукте
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('product_type, last_purchase')
      .eq('id', productId)
      .single();

    if (productError) throw productError;

    // Получаем историю покупок
    let history;
    
    if (product.product_type) {
      // Если у продукта указан тип, используем историю ВСЕХ продуктов этого типа
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('family_id', familyId)
        .eq('product_type', product.product_type);

      if (productsError) throw productsError;
      
      const productIds = products.map(p => p.id);
      
      const { data: typeHistory, error: historyError } = await supabase
        .from('product_history')
        .select('*')
        .in('product_id', productIds)
        .eq('family_id', familyId)
        .order('date', { ascending: true });

      if (historyError) throw historyError;
      history = typeHistory;
    } else {
      // Если тип не указан, используем только историю конкретного продукта
      const { data: productHistory, error: historyError } = await supabase
        .from('product_history')
        .select('*')
        .eq('product_id', productId)
        .eq('family_id', familyId)
        .order('date', { ascending: true });

      if (historyError) throw historyError;
      history = productHistory;
    }

    if (!history || history.length < 2) {
      return {
        avgDays: null,
        predictedEnd: null,
        status: 'calculating'
      };
    }

    // Вычисляем среднее количество дней между покупками
    const daysBetweenPurchases = [];
    for (let i = 1; i < history.length; i++) {
      const prevDate = new Date(history[i - 1].date);
      const currDate = new Date(history[i].date);
      const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 0) {
        daysBetweenPurchases.push(daysDiff);
      }
    }

    if (daysBetweenPurchases.length === 0) {
      return {
        avgDays: null,
        predictedEnd: null,
        status: 'calculating'
      };
    }

    const avgDays = Math.round(
      daysBetweenPurchases.reduce((sum, days) => sum + days, 0) / daysBetweenPurchases.length
    );

    // Предсказываем дату окончания
    const lastPurchase = new Date(product.last_purchase);
    const predictedEnd = new Date(lastPurchase.getTime() + avgDays * 24 * 60 * 60 * 1000);
    const predictedEndString = predictedEnd.toISOString().split('T')[0];

    // Определяем статус с учетом правила 2-х дней
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastPurchaseDate = new Date(lastPurchase);
    lastPurchaseDate.setHours(0, 0, 0, 0);
    
    const daysSincePurchase = Math.floor((today.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilEnd = Math.floor((predictedEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    let status = 'ok';
    
    // ВАЖНО: Правило 2-х дней
    // Если продукт куплен недавно (меньше 2 дней назад), статус всегда "ok"
    // независимо от прогноза
    if (daysSincePurchase < 2) {
      status = 'ok';
    } else if (daysUntilEnd <= 2) {
      status = 'ending-soon';
    }

    return {
      avgDays,
      predictedEnd: predictedEndString,
      status
    };
  } catch (error) {
    console.error(`Error calculating stats for product ${productId}:`, error);
    throw error;
  }
}

/**
 * Обновляет статус продукта
 */
async function updateProductStats(productId, familyId) {
  const stats = await calculateProductStats(productId, familyId);
  
  const { error } = await supabase
    .from('products')
    .update({
      avg_days: stats.avgDays,
      predicted_end: stats.predictedEnd,
      status: stats.status
    })
    .eq('id', productId);

  if (error) throw error;
}

/**
 * Пересчитывает статусы всех продуктов для семьи
 */
async function recalculateAllProductStatuses(familyId) {
  console.log(`🔄 Начинаем пересчет статусов для семьи ${familyId}`);
  
  const { data: products, error } = await supabase
    .from('products')
    .select('id')
    .eq('family_id', familyId);

  if (error) throw error;

  if (!products || products.length === 0) {
    console.log(`⚠️ Нет продуктов для семьи ${familyId}`);
    return { productsUpdated: 0, errors: 0, typeStatsUpdated: false };
  }

  console.log(`📦 Найдено ${products.length} продуктов для семьи ${familyId}`);

  let updated = 0;
  let errors = 0;

  for (const product of products) {
    try {
      await updateProductStats(product.id, familyId);
      updated++;
    } catch (err) {
      console.error(`❌ Ошибка пересчета продукта #${product.id}:`, err);
      errors++;
    }
  }

  // Пересчитываем кэш статусов типов продуктов
  console.log(`🔄 Пересчитываем кэш статусов типов продуктов для семьи ${familyId}`);
  try {
    const { error: typeStatsError } = await supabase.rpc('recalculate_product_type_stats', {
      p_family_id: familyId
    });

    if (typeStatsError) {
      console.error(`❌ Ошибка пересчета кэша типов:`, typeStatsError);
      throw typeStatsError;
    }

    console.log(`✅ Кэш статусов типов продуктов пересчитан`);
  } catch (err) {
    console.error(`❌ Ошибка при пересчете кэша типов продуктов:`, err);
    errors++;
  }

  console.log(`✅ Семья ${familyId}: обновлено ${updated}, ошибок ${errors}`);

  return { productsUpdated: updated, errors, typeStatsUpdated: true };
}

/**
 * Основной обработчик запроса
 */
export default async function handler(req, res) {
  console.log('⏰ Запуск cron job пересчета статусов продуктов');
  console.log('⏰ Время:', new Date().toISOString());

  // Проверяем, что это GET или POST запрос
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Опциональная проверка авторизации cron job (рекомендуется в продакшене)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('❌ Неавторизованный запрос к cron job');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Получаем все активные семьи
    const { data: families, error: familiesError } = await supabase
      .from('families')
      .select('id, name')
      .eq('is_active', true);

    if (familiesError) {
      console.error('❌ Ошибка получения семей:', familiesError);
      throw familiesError;
    }

    if (!families || families.length === 0) {
      console.log('⚠️ Нет активных семей для пересчета');
      return res.status(200).json({
        success: true,
        message: 'No active families to process',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`👨‍👩‍👧‍👦 Найдено ${families.length} активных семей`);

    // Пересчитываем статусы для каждой семьи
    const results = [];
    let totalUpdated = 0;
    let totalErrors = 0;

    for (const family of families) {
      try {
        const result = await recalculateAllProductStatuses(family.id);
        results.push({
          familyId: family.id,
          familyName: family.name,
          productsUpdated: result.productsUpdated,
          typeStatsUpdated: result.typeStatsUpdated,
          errors: result.errors
        });
        totalUpdated += result.productsUpdated;
        totalErrors += result.errors;
      } catch (err) {
        console.error(`❌ Ошибка обработки семьи ${family.id}:`, err);
        results.push({
          familyId: family.id,
          familyName: family.name,
          error: err.message
        });
        totalErrors++;
      }
    }

    console.log('✅ Cron job завершен');
    console.log(`📊 Всего обновлено продуктов: ${totalUpdated}`);
    console.log(`❌ Всего ошибок: ${totalErrors}`);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      familiesProcessed: families.length,
      totalProductsUpdated: totalUpdated,
      totalErrors,
      results
    });
  } catch (error) {
    console.error('❌ Критическая ошибка в cron job:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

