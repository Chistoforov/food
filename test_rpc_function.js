// Тестовый скрипт для проверки RPC функции recalculate_monthly_stats
// Запустите этот скрипт в консоли браузера на странице приложения

async function testRPCFunction() {
  console.log('🧪 Тестирование RPC функции recalculate_monthly_stats...');
  
  try {
    // Проверяем, что функция существует
    const { data, error } = await window.supabase.rpc('recalculate_monthly_stats', {
      p_family_id: 1,
      p_month: '10',
      p_year: 2024
    });
    
    if (error) {
      console.log('❌ Ошибка RPC вызова:', error);
      
      // Проверяем, существует ли функция в базе данных
      const { data: functions } = await window.supabase
        .from('pg_proc')
        .select('proname')
        .eq('proname', 'recalculate_monthly_stats');
      
      if (functions && functions.length === 0) {
        console.log('❌ Функция recalculate_monthly_stats не найдена в базе данных');
        console.log('💡 Нужно выполнить обновленный database_schema.sql в Supabase');
      }
      
      return;
    }
    
    console.log('✅ RPC функция работает корректно');
    console.log('📊 Результат:', data);
    
  } catch (error) {
    console.log('❌ Ошибка тестирования:', error);
  }
}

// Запускаем тест
testRPCFunction();
