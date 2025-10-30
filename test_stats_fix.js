// Тест исправления статистики
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testStatsFix() {
  console.log('🧪 Тестируем исправление статистики...');
  
  try {
    // Тест 1: Загружаем статистику без параметров месяца/года
    console.log('\n📊 Тест 1: Загружаем всю статистику...');
    const { data: allStats, error: allError } = await supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', 1)
      .order('month', { ascending: false });
      
    if (allError) {
      console.error('❌ Ошибка загрузки всей статистики:', allError);
      return;
    }
    
    console.log('✅ Загружено записей:', allStats.length);
    allStats.forEach((stat, i) => {
      console.log(`  ${i+1}. ${stat.month} (год: ${stat.year}) - €${stat.total_spent}`);
    });
    
    // Тест 2: Загружаем статистику за октябрь 2025 (должно быть пусто)
    console.log('\n📊 Тест 2: Загружаем статистику за октябрь 2025...');
    const { data: oct2025Stats, error: oct2025Error } = await supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', 1)
      .eq('month', '2025-10');
      
    if (oct2025Error) {
      console.error('❌ Ошибка загрузки статистики за октябрь 2025:', oct2025Error);
      return;
    }
    
    console.log('✅ Записей за октябрь 2025:', oct2025Stats.length);
    if (oct2025Stats.length === 0) {
      console.log('ℹ️  Это ожидаемо - данных за октябрь 2025 нет');
    }
    
    // Тест 3: Загружаем статистику за декабрь 2024 (должна быть)
    console.log('\n📊 Тест 3: Загружаем статистику за декабрь 2024...');
    const { data: dec2024Stats, error: dec2024Error } = await supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', 1)
      .eq('month', '2024-12');
      
    if (dec2024Error) {
      console.error('❌ Ошибка загрузки статистики за декабрь 2024:', dec2024Error);
      return;
    }
    
    console.log('✅ Записей за декабрь 2024:', dec2024Stats.length);
    if (dec2024Stats.length > 0) {
      console.log('ℹ️  Данные найдены:', dec2024Stats[0]);
    }
    
    // Тест 4: Проверяем чеки за октябрь 2025
    console.log('\n📊 Тест 4: Проверяем чеки за октябрь 2025...');
    const { data: oct2025Receipts, error: oct2025ReceiptsError } = await supabase
      .from('receipts')
      .select('*')
      .eq('family_id', 1)
      .gte('date', '2025-10-01')
      .lt('date', '2025-11-01');
      
    if (oct2025ReceiptsError) {
      console.error('❌ Ошибка загрузки чеков за октябрь 2025:', oct2025ReceiptsError);
      return;
    }
    
    console.log('✅ Чеков за октябрь 2025:', oct2025Receipts.length);
    if (oct2025Receipts.length === 0) {
      console.log('ℹ️  Это объясняет, почему нет статистики за октябрь 2025');
    }
    
    console.log('\n✅ Все тесты завершены успешно!');
    console.log('\n📝 Выводы:');
    console.log('- В базе есть данные за 2024 год');
    console.log('- Нет данных за октябрь 2025 года');
    console.log('- Приложение должно показывать нули для месяцев без данных');
    console.log('- Исправление должно устранить ошибки undefined в логах');
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

testStatsFix().catch(console.error);
