// Отладка кнопки "Обновить" в дашборде
// Выполните этот код в консоли браузера на странице приложения

console.log('🔍 Отладка кнопки "Обновить"...');

// Функция для поиска кнопки обновления
function findUpdateButton() {
  // Ищем кнопку по различным селекторам
  const selectors = [
    'button[title="Пересчитать статистику"]',
    'button:contains("Обновить")',
    'button:contains("Обновление")',
    'button[class*="update"]',
    'button[class*="refresh"]',
    'button[class*="recalculate"]'
  ];
  
  for (const selector of selectors) {
    try {
      const button = document.querySelector(selector);
      if (button) {
        console.log(`✅ Найдена кнопка по селектору: ${selector}`);
        return button;
      }
    } catch (e) {
      // Игнорируем ошибки селекторов
    }
  }
  
  // Ищем по тексту
  const allButtons = document.querySelectorAll('button');
  for (const button of allButtons) {
    const text = button.textContent?.toLowerCase() || '';
    if (text.includes('обновить') || text.includes('обновление') || text.includes('пересчитать')) {
      console.log(`✅ Найдена кнопка по тексту: "${button.textContent}"`);
      return button;
    }
  }
  
  console.log('❌ Кнопка "Обновить" не найдена');
  return null;
}

// Функция для проверки обработчиков событий
function checkButtonHandlers(button) {
  console.log('🔍 Проверяем обработчики кнопки...');
  
  // Проверяем onclick
  if (button.onclick) {
    console.log('✅ Найден onclick обработчик');
  } else {
    console.log('⚠️ onclick обработчик не найден');
  }
  
  // Проверяем addEventListener (сложно проверить, но попробуем)
  console.log('ℹ️ addEventListener обработчики сложно проверить извне');
  
  // Проверяем disabled состояние
  if (button.disabled) {
    console.log('⚠️ Кнопка отключена (disabled)');
  } else {
    console.log('✅ Кнопка активна');
  }
  
  // Проверяем видимость
  const style = window.getComputedStyle(button);
  if (style.display === 'none' || style.visibility === 'hidden') {
    console.log('⚠️ Кнопка скрыта');
  } else {
    console.log('✅ Кнопка видима');
  }
}

// Функция для принудительного вызова обновления
async function forceUpdate() {
  console.log('🔄 Принудительно вызываем обновление статистики...');
  
  try {
    // Ищем React компоненты
    const reactRoot = document.querySelector('#root') || document.querySelector('[data-reactroot]');
    if (reactRoot) {
      console.log('✅ Найден React root');
      
      // Пытаемся найти функцию обновления в глобальном scope
      if (window.recalculateStats) {
        console.log('✅ Найдена функция recalculateStats в window');
        await window.recalculateStats();
        return;
      }
      
      // Пытаемся найти через React DevTools
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        console.log('✅ React DevTools доступны, пытаемся найти компонент...');
        // Здесь можно добавить более сложную логику поиска
      }
    }
    
    // Пытаемся найти и вызвать функцию через eval (осторожно!)
    console.log('⚠️ Пытаемся найти функцию обновления...');
    
    // Ищем в глобальном scope
    const globalKeys = Object.keys(window);
    const updateKeys = globalKeys.filter(key => 
      key.toLowerCase().includes('update') || 
      key.toLowerCase().includes('recalculate') ||
      key.toLowerCase().includes('refresh')
    );
    
    if (updateKeys.length > 0) {
      console.log('🔍 Найдены потенциальные функции обновления:', updateKeys);
    }
    
  } catch (error) {
    console.error('❌ Ошибка принудительного обновления:', error);
  }
}

// Функция для создания тестовой кнопки
function createTestButton() {
  console.log('🔧 Создаем тестовую кнопку...');
  
  const testDiv = document.createElement('div');
  testDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 2px solid #007bff;
    border-radius: 8px;
    padding: 15px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: Arial, sans-serif;
    min-width: 200px;
  `;
  
  testDiv.innerHTML = `
    <h4 style="margin: 0 0 10px 0; color: #007bff;">Тест обновления</h4>
    <button id="test-update-btn" style="
      background: #007bff;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin: 5px;
      width: 100%;
    ">Обновить статистику</button>
    <button id="test-force-btn" style="
      background: #28a745;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin: 5px;
      width: 100%;
    ">Принудительное обновление</button>
    <button id="test-close-btn" style="
      background: #dc3545;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      margin: 5px;
      width: 100%;
    ">Закрыть</button>
  `;
  
  document.body.appendChild(testDiv);
  
  // Обработчики для тестовых кнопок
  document.getElementById('test-update-btn')?.addEventListener('click', async () => {
    console.log('🔄 Тестовая кнопка: Обновить статистику');
    const button = findUpdateButton();
    if (button) {
      button.click();
    } else {
      console.log('❌ Кнопка обновления не найдена');
    }
  });
  
  document.getElementById('test-force-btn')?.addEventListener('click', async () => {
    console.log('🔄 Тестовая кнопка: Принудительное обновление');
    await forceUpdate();
  });
  
  document.getElementById('test-close-btn')?.addEventListener('click', () => {
    testDiv.remove();
  });
  
  console.log('✅ Тестовая панель создана в правом верхнем углу');
}

// Основная функция отладки
async function debugUpdateButton() {
  console.log('🚀 Начинаем отладку кнопки "Обновить"...');
  
  // Ждем загрузки страницы
  if (document.readyState !== 'complete') {
    console.log('⏳ Ждем загрузки страницы...');
    await new Promise(resolve => {
      window.addEventListener('load', resolve);
    });
  }
  
  console.log('\n1️⃣ Ищем кнопку "Обновить":');
  const updateButton = findUpdateButton();
  
  if (updateButton) {
    console.log('\n2️⃣ Анализируем кнопку:');
    checkButtonHandlers(updateButton);
    
    console.log('\n3️⃣ Пытаемся нажать кнопку:');
    try {
      updateButton.click();
      console.log('✅ Кнопка нажата');
      
      // Ждем немного и проверяем результат
      setTimeout(() => {
        console.log('⏰ Проверяем результат через 3 секунды...');
        // Здесь можно добавить проверку изменений в DOM или консоли
      }, 3000);
      
    } catch (error) {
      console.error('❌ Ошибка при нажатии кнопки:', error);
    }
  } else {
    console.log('\n2️⃣ Кнопка не найдена, создаем тестовую панель:');
    createTestButton();
  }
  
  console.log('\n✅ Отладка завершена!');
  console.log('💡 Если кнопка не работает, попробуйте:');
  console.log('   - Обновить страницу (F5)');
  console.log('   - Проверить консоль на ошибки');
  console.log('   - Использовать тестовую панель');
}

// Запускаем отладку
debugUpdateButton();
