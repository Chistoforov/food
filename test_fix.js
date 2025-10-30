// Простой тест исправления статистики
// Выполните этот код в консоли браузера на странице приложения

console.log('🧪 Тестируем исправление статистики...');

// Функция для проверки статистики
async function checkStats() {
  try {
    // Получаем статистику через API приложения
    const response = await fetch('/api/monthly-stats?familyId=1');
    if (response.ok) {
      const stats = await response.json();
      console.log('📊 Статистика через API:', stats);
      return stats;
    }
  } catch (error) {
    console.log('⚠️ API недоступен, проверяем через localStorage');
  }
  
  // Проверяем localStorage
  const storedStats = localStorage.getItem('monthly-stats');
  if (storedStats) {
    console.log('📊 Статистика из localStorage:', JSON.parse(storedStats));
  }
  
  return null;
}

// Функция для принудительного обновления статистики
async function forceUpdateStats() {
  console.log('🔄 Принудительно обновляем статистику...');
  
  try {
    // Ищем кнопку обновления в DOM
    const updateButton = document.querySelector('button[title="Пересчитать статистику"], button:contains("Обновить")');
    if (updateButton) {
      console.log('🔘 Нажимаем кнопку обновления...');
      updateButton.click();
      
      // Ждем немного и проверяем результат
      setTimeout(async () => {
        console.log('⏰ Проверяем результат через 3 секунды...');
        await checkStats();
      }, 3000);
    } else {
      console.log('❌ Кнопка обновления не найдена');
    }
  } catch (error) {
    console.error('❌ Ошибка принудительного обновления:', error);
  }
}

// Функция для очистки и пересчета статистики
async function clearAndRecalculate() {
  console.log('🧹 Очищаем и пересчитываем статистику...');
  
  try {
    // Очищаем localStorage
    localStorage.removeItem('monthly-stats');
    localStorage.removeItem('supabase-data');
    
    // Обновляем страницу
    console.log('🔄 Обновляем страницу...');
    window.location.reload();
  } catch (error) {
    console.error('❌ Ошибка очистки:', error);
  }
}

// Основная функция тестирования
async function testFix() {
  console.log('🚀 Начинаем тестирование...');
  
  console.log('\n1️⃣ Проверяем текущую статистику:');
  await checkStats();
  
  console.log('\n2️⃣ Принудительно обновляем статистику:');
  await forceUpdateStats();
  
  console.log('\n3️⃣ Если статистика все еще нулевая, попробуйте:');
  console.log('   - Выполните SQL из файла fix_recalculate_function.sql в Supabase Dashboard');
  console.log('   - Или нажмите кнопку "Очистить и пересчитать" ниже');
  
  // Добавляем кнопки для тестирования
  const testDiv = document.createElement('div');
  testDiv.innerHTML = `
    <div style="position: fixed; top: 10px; right: 10px; background: white; padding: 10px; border: 1px solid #ccc; border-radius: 5px; z-index: 9999;">
      <h4>Тест статистики</h4>
      <button onclick="checkStats()" style="margin: 5px; padding: 5px 10px;">Проверить статистику</button>
      <button onclick="forceUpdateStats()" style="margin: 5px; padding: 5px 10px;">Обновить статистику</button>
      <button onclick="clearAndRecalculate()" style="margin: 5px; padding: 5px 10px; background: #ff6b6b; color: white;">Очистить и пересчитать</button>
    </div>
  `;
  document.body.appendChild(testDiv);
  
  console.log('\n✅ Тестирование завершено! Кнопки добавлены в правый верхний угол.');
}

// Запускаем тестирование
testFix();
