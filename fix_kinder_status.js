import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Загружаем переменные окружения
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют переменные окружения');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixKinderStatus() {
  console.log('🔧 Применяем исправление для статуса Киндера...\n');
  
  // 1. Читаем и выполняем SQL миграцию
  console.log('📝 Применяем SQL миграцию...');
  const sqlMigration = fs.readFileSync('migration_update_product_stats_function.sql', 'utf8');
  
  // Разбиваем на отдельные операторы
  const statements = sqlMigration
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));
  
  for (const statement of statements) {
    if (statement.includes('CREATE OR REPLACE FUNCTION')) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.log('⚠️  Не удалось выполнить через rpc, попробуем напрямую...');
          // SQL функции обычно нужно выполнять через админский интерфейс Supabase
          console.log('💡 Выполните миграцию вручную через SQL Editor в Supabase Dashboard:');
          console.log('   https://app.supabase.com/project/_/sql');
          console.log('\nИли скопируйте содержимое файла migration_update_product_stats_function.sql\n');
          break;
        }
      } catch (err) {
        console.log('⚠️  Автоматическое применение миграции не поддерживается');
        console.log('💡 Выполните миграцию вручную через SQL Editor в Supabase Dashboard');
        break;
      }
    }
  }
  
  // 2. Найти продукты с типом "киндер"
  console.log('\n🔍 Ищем продукты с типом "киндер"...');
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .ilike('product_type', '%киндер%')
    .eq('family_id', 1);

  if (productsError) {
    console.error('❌ Ошибка получения продуктов:', productsError);
    return;
  }

  if (products.length === 0) {
    console.log('⚠️  Продукты с типом "киндер" не найдены');
    return;
  }

  console.log(`✅ Найдено продуктов: ${products.length}\n`);

  // 3. Пересчитать статусы
  for (const product of products) {
    console.log(`🔄 Пересчитываем статус для "${product.name}" (ID: ${product.id})...`);
    console.log(`   Текущий статус: ${product.status}`);
    console.log(`   Последняя покупка: ${product.last_purchase}`);
    
    try {
      // Пытаемся вызвать RPC функцию
      const { error: rpcError } = await supabase.rpc('update_product_analytics', {
        p_product_id: product.id,
        p_family_id: 1
      });

      if (rpcError) {
        console.log(`⚠️  RPC функция недоступна, применяем логику вручную...`);
        
        // Применяем новую логику вручную
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const lastPurchaseDate = new Date(product.last_purchase);
        lastPurchaseDate.setHours(0, 0, 0, 0);
        
        const daysSincePurchase = Math.floor((today - lastPurchaseDate) / (1000 * 60 * 60 * 24));
        
        let newStatus = product.status;
        if (daysSincePurchase < 2) {
          newStatus = 'ok';
          console.log(`   ✅ Продукт куплен ${daysSincePurchase === 0 ? 'сегодня' : 'вчера'}, устанавливаем статус = ok`);
        } else {
          console.log(`   ℹ️  Продукт куплен ${daysSincePurchase} дней назад, сохраняем текущий статус`);
        }
        
        if (newStatus !== product.status) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ status: newStatus })
            .eq('id', product.id);
          
          if (updateError) {
            console.error(`   ❌ Ошибка обновления:`, updateError);
          } else {
            console.log(`   ✅ Статус обновлен: ${product.status} → ${newStatus}`);
          }
        }
      } else {
        console.log(`   ✅ Статус успешно пересчитан через RPC функцию`);
      }
      
      // Получаем обновленные данные
      const { data: updated } = await supabase
        .from('products')
        .select('status, avg_days, predicted_end')
        .eq('id', product.id)
        .single();
      
      if (updated) {
        console.log(`   📊 Новые данные:`);
        console.log(`      Статус: ${updated.status}`);
        console.log(`      Средний интервал: ${updated.avg_days || 'не рассчитан'} дней`);
        console.log(`      Прогноз окончания: ${updated.predicted_end || 'не рассчитан'}`);
      }
    } catch (error) {
      console.error(`   ❌ Ошибка:`, error.message);
    }
    
    console.log('');
  }
  
  console.log('✅ Готово! Проверьте главную страницу приложения.');
}

fixKinderStatus().catch(console.error);

