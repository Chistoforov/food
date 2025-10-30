/**
 * Прямой тест удаления без использования SupabaseService
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Переменные окружения не найдены');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDirectDelete() {
  try {
    console.log('🔍 Прямой тест удаления чеков...');
    
    // 1. Получаем список чеков
    console.log('\n1️⃣ Получаем список чеков...');
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('*')
      .eq('family_id', 1)
      .order('date', { ascending: false });
    
    if (receiptsError) {
      console.log('❌ Ошибка получения чеков:', receiptsError.message);
      return;
    }
    
    console.log(`✅ Найдено чеков: ${receipts?.length || 0}`);
    if (receipts && receipts.length > 0) {
      console.table(receipts.map(r => ({
        id: r.id,
        date: r.date,
        total: r.total_amount,
        items: r.items_count
      })));
    }
    
    if (!receipts || receipts.length === 0) {
      console.log('⚠️ Нет чеков для тестирования');
      return;
    }
    
    // 2. Пробуем удалить чек напрямую
    console.log('\n2️⃣ Пробуем удалить чек напрямую...');
    const testReceipt = receipts[0];
    console.log(`🧪 Удаляем чек #${testReceipt.id}...`);
    
    // Сначала проверим, есть ли связанные записи
    const { data: relatedHistory, error: historyError } = await supabase
      .from('product_history')
      .select('id')
      .eq('receipt_id', testReceipt.id);
    
    if (!historyError && relatedHistory) {
      console.log(`📊 Связанных записей product_history: ${relatedHistory.length}`);
    }
    
    // Удаляем чек
    const { error: deleteError } = await supabase
      .from('receipts')
      .delete()
      .eq('id', testReceipt.id);
    
    if (deleteError) {
      console.log('❌ Ошибка удаления:', deleteError.message);
      console.log('📋 Полная ошибка:', JSON.stringify(deleteError, null, 2));
      
      if (deleteError.message.includes('recalculate_monthly_stats')) {
        console.log('\n💡 ПРОБЛЕМА: Все еще есть триггер, который вызывает recalculate_monthly_stats!');
        console.log('🔧 РЕШЕНИЕ: Выполните SQL-скрипт remove_all_triggers.sql');
      } else if (deleteError.message.includes('date')) {
        console.log('\n💡 ПРОБЛЕМА: Ошибка в формировании даты!');
        console.log('🔧 РЕШЕНИЕ: Проверьте триггеры и функции в базе данных');
      }
      return;
    }
    
    console.log('✅ Чек успешно удален!');
    
    // 3. Проверяем, что чек действительно удален
    console.log('\n3️⃣ Проверяем удаление...');
    const { data: checkReceipt, error: checkError } = await supabase
      .from('receipts')
      .select('id')
      .eq('id', testReceipt.id)
      .single();
    
    if (checkError || !checkReceipt) {
      console.log('✅ Чек действительно удален из БД!');
      console.log('🎉 УДАЛЕНИЕ РАБОТАЕТ!');
    } else {
      console.log('❌ Чек все еще существует в БД!');
    }
    
  } catch (error) {
    console.log('❌ Ошибка:', error.message);
    console.log('📋 Полная ошибка:', JSON.stringify(error, null, 2));
  }
}

// Запускаем тест
testDirectDelete();
