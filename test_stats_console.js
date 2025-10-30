// Тест исправления статистики через консоль
// Запустите этот файл в Node.js: node test_stats_console.js

const { createClient } = require('@supabase/supabase-js');

// Замените эти значения на ваши реальные данные из Supabase
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

if (SUPABASE_URL === 'https://your-project.supabase.co' || SUPABASE_ANON_KEY === 'your-anon-key') {
  console.log('❌ Пожалуйста, установите переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY');
  console.log('Или отредактируйте этот файл и укажите ваши реальные данные Supabase');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkData() {
  console.log('🔍 Проверяем данные в базе...');
  
  try {
    // Проверяем чеки
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('*')
      .eq('family_id', 1);
    
    if (receiptsError) {
      console.error('❌ Ошибка получения чеков:', receiptsError);
      return;
    }
    
    console.log('📄 Чеков найдено:', receipts?.length || 0);
    if (receipts && receipts.length > 0) {
      console.log('📅 Даты чеков:', receipts.map(r => r.date).slice(0, 5));
    }
    
    // Проверяем продукты
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('family_id', 1);
    
    if (productsError) {
      console.error('❌ Ошибка получения продуктов:', productsError);
      return;
    }
    
    console.log('🛒 Продуктов найдено:', products?.length || 0);
    
    // Проверяем историю покупок
    const { data: history, error: historyError } = await supabase
      .from('product_history')
      .select('*')
      .eq('family_id', 1);
    
    if (historyError) {
      console.error('❌ Ошибка получения истории:', historyError);
      return;
    }
    
    console.log('📊 Записей в истории:', history?.length || 0);
    
    // Проверяем статистику
    const { data: stats, error: statsError } = await supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', 1);
    
    if (statsError) {
      console.error('❌ Ошибка получения статистики:', statsError);
      return;
    }
    
    console.log('📈 Записей статистики:', stats?.length || 0);
    if (stats && stats.length > 0) {
      console.log('📅 Месяцы со статистикой:', stats.map(s => `${s.month}-${s.year}`));
      console.log('💰 Данные статистики:', stats.map(s => ({
        month: `${s.month}-${s.year}`,
        spent: s.total_spent,
        calories: s.total_calories,
        receipts: s.receipts_count
      })));
    }
    
    return { receipts, products, history, stats };
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error);
  }
}

async function fixStats() {
  console.log('🔄 Исправляем статистику...');
  
  try {
    // Получаем все чеки
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('*')
      .eq('family_id', 1);
    
    if (receiptsError) throw receiptsError;
    
    if (!receipts || receipts.length === 0) {
      console.log('⚠️ Нет чеков для пересчета');
      return;
    }
    
    // Группируем чеки по месяцам
    const monthsData = new Map();
    
    receipts.forEach(receipt => {
      const date = new Date(receipt.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;
      
      if (!monthsData.has(key)) {
        monthsData.set(key, { year, month, totalSpent: 0, receiptsCount: 0 });
      }
      
      const data = monthsData.get(key);
      data.totalSpent += receipt.total_amount || 0;
      data.receiptsCount += 1;
    });
    
    console.log(`📅 Найдено ${monthsData.size} месяцев для пересчета:`, Array.from(monthsData.keys()));
    
    // Пересчитываем статистику для каждого месяца
    for (const [monthKey, data] of monthsData) {
      console.log(`🔄 Пересчитываем ${monthKey}...`);
      
      // Получаем историю покупок за этот месяц
      const { data: monthHistory, error: monthHistoryError } = await supabase
        .from('product_history')
        .select(`
          quantity,
          products(calories)
        `)
        .eq('family_id', 1)
        .gte('date', `${data.year}-${data.month}-01`)
        .lt('date', `${data.year}-${String(parseInt(data.month) + 1).padStart(2, '0')}-01`);
      
      if (monthHistoryError) throw monthHistoryError;
      
      // Вычисляем калории
      const totalCalories = monthHistory?.reduce((sum, h) => {
        const calories = h.products?.calories || 0;
        const quantity = h.quantity || 0;
        return sum + (calories * quantity);
      }, 0) || 0;
      
      const daysInMonth = new Date(data.year, parseInt(data.month), 0).getDate();
      const avgCaloriesPerDay = daysInMonth > 0 ? Math.round(totalCalories / daysInMonth) : 0;
      
      console.log(`📊 ${monthKey}: €${data.totalSpent.toFixed(2)}, ${totalCalories} ккал, ${data.receiptsCount} чеков`);
      
      // Удаляем старую статистику
      await supabase
        .from('monthly_stats')
        .delete()
        .eq('family_id', 1)
        .eq('month', monthKey)
        .eq('year', data.year);
      
      // Вставляем новую статистику
      const { error: insertError } = await supabase
        .from('monthly_stats')
        .insert({
          family_id: 1,
          month: monthKey,
          year: data.year,
          total_spent: data.totalSpent,
          total_calories: totalCalories,
          avg_calories_per_day: avgCaloriesPerDay,
          receipts_count: data.receiptsCount
        });
      
      if (insertError) throw insertError;
    }
    
    console.log('✅ Статистика успешно пересчитана');
    
    // Показываем финальный результат
    const { data: finalStats, error: finalStatsError } = await supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', 1)
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    
    if (finalStatsError) throw finalStatsError;
    
    console.log('📈 Финальная статистика:');
    console.table(finalStats);
    
  } catch (error) {
    console.error('❌ Ошибка исправления статистики:', error);
  }
}

async function main() {
  console.log('🚀 Запуск теста исправления статистики...');
  
  const data = await checkData();
  
  if (data && data.receipts && data.receipts.length > 0) {
    await fixStats();
  } else {
    console.log('⚠️ Нет данных для исправления');
  }
}

main().catch(console.error);
