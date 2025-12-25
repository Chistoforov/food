import { createClient } from '@supabase/supabase-js';

/**
 * IMPROVED API endpoint для cron job пересчета статусов продуктов
 * Использует оптимизированную SQL функцию update_all_product_statuses()
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
 * Основной обработчик запроса
 */
export default async function handler(req, res) {
  console.log('⏰ Запуск cron job пересчета статусов продуктов (IMPROVED)');
  console.log('⏰ Время:', new Date().toISOString());

  // Проверяем, что это GET или POST запрос
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Опциональная проверка авторизации cron job
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('❌ Неавторизованный запрос к cron job');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔄 Вызов update_all_product_statuses()...');
    
    // Вызываем оптимизированную SQL функцию, которая:
    // 1. Пересчитывает кэш product_type_stats для всех семей
    // 2. Обновляет статусы ВСЕХ продуктов на основе кэша
    // Всё это делается одним вызовом в БД!
    const { error } = await supabase.rpc('update_all_product_statuses');

    if (error) {
      console.error('❌ Ошибка вызова update_all_product_statuses:', error);
      throw error;
    }

    console.log('✅ Статусы всех продуктов успешно обновлены');
    console.log('✅ Cron job завершен');

    return res.status(200).json({
      success: true,
      message: 'All product statuses updated successfully',
      timestamp: new Date().toISOString()
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













