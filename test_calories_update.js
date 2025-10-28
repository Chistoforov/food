// Тестовый скрипт для проверки автоматического пересчета статистики
// Запустите этот скрипт в консоли браузера на странице приложения

async function testCaloriesUpdate() {
  console.log('🧪 Тестирование автоматического пересчета статистики...');
  
  try {
    // Получаем первый продукт
    const products = await window.supabase
      .from('products')
      .select('*')
      .eq('family_id', 1)
      .limit(1);
    
    if (products.data.length === 0) {
      console.log('❌ Нет продуктов для тестирования');
      return;
    }
    
    const product = products.data[0];
    const originalCalories = product.calories;
    const newCalories = originalCalories + 100;
    
    console.log(`📦 Продукт: ${product.name}`);
    console.log(`📊 Исходная калорийность: ${originalCalories} ккал`);
    console.log(`🔄 Новая калорийность: ${newCalories} ккал`);
    
    // Получаем статистику до изменения
    const statsBefore = await window.supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', 1)
      .eq('month', '2024-10')
      .eq('year', 2024)
      .single();
    
    console.log(`📈 Статистика до изменения: ${statsBefore.data?.total_calories || 0} ккал`);
    
    // Обновляем калорийность продукта
    const updateResult = await window.supabase
      .from('products')
      .update({ calories: newCalories })
      .eq('id', product.id);
    
    if (updateResult.error) {
      console.log('❌ Ошибка обновления продукта:', updateResult.error);
      return;
    }
    
    console.log('✅ Калорийность продукта обновлена');
    
    // Ждем немного для срабатывания триггеров
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Получаем статистику после изменения
    const statsAfter = await window.supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', 1)
      .eq('month', '2024-10')
      .eq('year', 2024)
      .single();
    
    console.log(`📈 Статистика после изменения: ${statsAfter.data?.total_calories || 0} ккал`);
    
    // Восстанавливаем исходную калорийность
    await window.supabase
      .from('products')
      .update({ calories: originalCalories })
      .eq('id', product.id);
    
    console.log('🔄 Исходная калорийность восстановлена');
    
    // Проверяем результат
    const caloriesChanged = statsAfter.data?.total_calories !== statsBefore.data?.total_calories;
    
    if (caloriesChanged) {
      console.log('✅ Тест пройден! Статистика автоматически пересчиталась');
    } else {
      console.log('❌ Тест не пройден! Статистика не изменилась');
    }
    
  } catch (error) {
    console.log('❌ Ошибка тестирования:', error);
  }
}

// Запускаем тест
testCaloriesUpdate();
