// Простой тест для проверки работы пересчета статистики
// Выполните этот код в консоли браузера на странице приложения

console.log('🧪 Тестируем пересчет статистики...');

// Функция для проверки текущей статистики через Supabase клиент
async function testRecalculate() {
  try {
    // Получаем доступ к supabase из window, если он там есть
    const supabase = window.supabase || (window as any).__SUPABASE__;
    
    if (!supabase) {
      console.error('❌ Supabase клиент не найден в window');
      console.log('💡 Убедитесь, что вы на странице приложения с загруженным Supabase');
      return;
    }
    
    console.log('✅ Supabase клиент найден');
    
    // Проверяем текущую статистику
    console.log('\n1️⃣ Проверяем текущую статистику:');
    const { data: currentStats, error: statsError } = await supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', 1)
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    
    if (statsError) {
      console.error('❌ Ошибка получения статистики:', statsError);
    } else {
      console.log('📊 Текущая статистика:', currentStats);
    }
    
    // Проверяем чеки
    console.log('\n2️⃣ Проверяем чеки:');
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, date, total_amount, items_count')
      .eq('family_id', 1)
      .order('date', { ascending: false });
    
    if (receiptsError) {
      console.error('❌ Ошибка получения чеков:', receiptsError);
    } else {
      console.log(`🧾 Найдено чеков: ${receipts?.length || 0}`);
      receipts?.forEach((r: any) => {
        console.log(`  - ${r.date}: $${r.total_amount} (${r.items_count} товаров)`);
      });
    }
    
    // Пытаемся использовать RPC функцию
    console.log('\n3️⃣ Пытаемся использовать RPC функцию:');
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('recalculate_monthly_stats', {
        p_family_id: 1,
        p_month: '10',
        p_year: 2024
      });
      
      if (rpcError) {
        console.warn('⚠️ RPC функция недоступна:', rpcError.message);
        console.log('💡 Используем альтернативный метод...');
      } else {
        console.log('✅ RPC функция работает');
      }
    } catch (rpcException: any) {
      console.warn('⚠️ Ошибка RPC (возможно сеть):', rpcException?.message || rpcException);
      console.log('💡 Это нормально - приложение будет использовать альтернативный метод');
    }
    
    // Проверяем альтернативный метод
    console.log('\n4️⃣ Тестируем альтернативный метод пересчета:');
    
    // Получаем данные за октябрь 2024
    const { data: octoberReceipts, error: octReceiptsError } = await supabase
      .from('receipts')
      .select('total_amount')
      .eq('family_id', 1)
      .gte('date', '2024-10-01')
      .lt('date', '2024-11-01');
    
    const { data: octoberHistory, error: octHistoryError } = await supabase
      .from('product_history')
      .select(`
        quantity,
        products(calories)
      `)
      .eq('family_id', 1)
      .gte('date', '2024-10-01')
      .lt('date', '2024-11-01');
    
    if (octReceiptsError || octHistoryError) {
      console.error('❌ Ошибка получения данных:', octReceiptsError || octHistoryError);
    } else {
      const totalSpent = octoberReceipts?.reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0) || 0;
      const totalCalories = octoberHistory?.reduce((sum: number, h: any) => {
        const calories = h.products?.calories || 0;
        const quantity = h.quantity || 0;
        return sum + (calories * quantity);
      }, 0) || 0;
      
      console.log('📊 Вычисленная статистика за октябрь:');
      console.log(`  💰 Потрачено: $${totalSpent}`);
      console.log(`  🔥 Калории: ${totalCalories}`);
      console.log(`  📅 Среднее в день: ${Math.round(totalCalories / 31)} ккал`);
      console.log(`  🧾 Чеков: ${octoberReceipts?.length || 0}`);
    }
    
    console.log('\n✅ Тест завершен!');
    console.log('💡 Теперь нажмите кнопку "Обновить" в дашборде приложения');
    console.log('💡 Статистика должна пересчитаться автоматически через альтернативный метод');
    
  } catch (error: any) {
    console.error('❌ Общая ошибка теста:', error);
  }
}

// Запускаем тест
testRecalculate();
