/**
 * Простой тест удаления чеков
 * Запустите: node test_delete_simple.js
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

async function testDeleteReceipt() {
  try {
    console.log('🔍 Тестируем удаление чеков...');
    
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
      console.log('⚠️ Нет чеков для тестирования. Создайте чек сначала.');
      return;
    }
    
    // 2. Тестируем удаление
    console.log('\n2️⃣ Тестируем удаление...');
    const testReceipt = receipts[0];
    console.log(`🧪 Удаляем чек #${testReceipt.id}...`);
    
    const { error: deleteError } = await supabase
      .from('receipts')
      .delete()
      .eq('id', testReceipt.id);
    
    if (deleteError) {
      console.log('❌ Ошибка удаления:', deleteError.message);
      
      if (deleteError.message.includes('policy') || deleteError.message.includes('RLS')) {
        console.log('\n💡 ПРОБЛЕМА: RLS политики не настроены!');
        console.log('🔧 РЕШЕНИЕ:');
        console.log('1. Откройте Supabase Dashboard');
        console.log('2. Перейдите в SQL Editor');
        console.log('3. Выполните скрипт из файла fix_rls_policies.sql');
      }
      return;
    }
    
    console.log('✅ Чек успешно удален из БД!');
    
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
  }
}

// Запускаем тест
testDeleteReceipt();
