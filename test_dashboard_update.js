// Скрипт для тестирования обновления дашборда
// Выполните этот код в консоли браузера на странице приложения

console.log('🧪 Тестируем обновление дашборда...');

// Функция для проверки текущей статистики
async function checkCurrentStats() {
  try {
    const { data: stats, error } = await supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', 1)
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    
    if (error) {
      console.error('❌ Ошибка получения статистики:', error);
      return;
    }
    
    console.log('📊 Текущая статистика:');
    stats.forEach(stat => {
      console.log(`${stat.year}-${stat.month}: $${stat.total_spent}, ${stat.total_calories} калорий, ${stat.receipts_count} чеков`);
    });
    
    return stats;
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Функция для добавления тестового чека
async function addTestReceipt() {
  console.log('➕ Добавляем тестовый чек...');
  
  try {
    // Создаем чек
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        family_id: 1,
        date: '2024-11-02',
        items_count: 2,
        total_amount: 8.50,
        status: 'processed'
      })
      .select()
      .single();
    
    if (receiptError) {
      console.error('❌ Ошибка создания чека:', receiptError);
      return;
    }
    
    console.log('✅ Чек создан:', receipt.id);
    
    // Добавляем продукты в историю
    const { error: historyError } = await supabase
      .from('product_history')
      .insert([
        {
          product_id: 5, // Яблоки
          family_id: 1,
          date: '2024-11-02',
          quantity: 1,
          price: 2.50,
          unit_price: 2.50
        },
        {
          product_id: 6, // Бананы
          family_id: 1,
          date: '2024-11-02',
          quantity: 2,
          price: 3.60,
          unit_price: 1.80
        }
      ]);
    
    if (historyError) {
      console.error('❌ Ошибка добавления истории:', historyError);
      return;
    }
    
    console.log('✅ История покупок добавлена');
    
    // Пересчитываем статистику
    console.log('🔄 Пересчитываем статистику...');
    const { error: recalcError } = await supabase.rpc('recalculate_monthly_stats', {
      p_family_id: 1,
      p_month: '11',
      p_year: 2024
    });
    
    if (recalcError) {
      console.error('❌ Ошибка пересчета:', recalcError);
    } else {
      console.log('✅ Статистика пересчитана');
    }
    
    return receipt.id;
  } catch (error) {
    console.error('❌ Ошибка добавления чека:', error);
  }
}

// Функция для удаления тестового чека
async function deleteTestReceipt(receiptId) {
  console.log('🗑️ Удаляем тестовый чек...');
  
  try {
    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId);
    
    if (error) {
      console.error('❌ Ошибка удаления чека:', error);
      return;
    }
    
    console.log('✅ Чек удален');
    
    // Пересчитываем статистику
    console.log('🔄 Пересчитываем статистику...');
    const { error: recalcError } = await supabase.rpc('recalculate_monthly_stats', {
      p_family_id: 1,
      p_month: '11',
      p_year: 2024
    });
    
    if (recalcError) {
      console.error('❌ Ошибка пересчета:', recalcError);
    } else {
      console.log('✅ Статистика пересчитана');
    }
  } catch (error) {
    console.error('❌ Ошибка удаления чека:', error);
  }
}

// Основная функция тестирования
async function testDashboardUpdate() {
  console.log('🚀 Начинаем тестирование...');
  
  // Проверяем начальную статистику
  console.log('\n1️⃣ Проверяем начальную статистику:');
  await checkCurrentStats();
  
  // Добавляем тестовый чек
  console.log('\n2️⃣ Добавляем тестовый чек:');
  const receiptId = await addTestReceipt();
  
  // Проверяем статистику после добавления
  console.log('\n3️⃣ Проверяем статистику после добавления:');
  await checkCurrentStats();
  
  // Удаляем тестовый чек
  if (receiptId) {
    console.log('\n4️⃣ Удаляем тестовый чек:');
    await deleteTestReceipt(receiptId);
    
    // Проверяем статистику после удаления
    console.log('\n5️⃣ Проверяем статистику после удаления:');
    await checkCurrentStats();
  }
  
  console.log('\n✅ Тестирование завершено!');
  console.log('💡 Теперь обновите страницу приложения, чтобы увидеть изменения в дашборде');
}

// Запускаем тестирование
testDashboardUpdate();
