// Исправленный скрипт для консоли браузера
// Выполните этот код в консоли браузера на странице приложения

console.log('🔧 Исправляем статистику дашборда...');

// Получаем доступ к supabase из приложения
function getSupabaseClient() {
  // Пытаемся найти supabase в различных местах
  if (window.supabase) {
    return window.supabase;
  }
  
  // Ищем в React DevTools
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    const reactRoots = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers;
    for (const rendererId in reactRoots) {
      const renderer = reactRoots[rendererId];
      if (renderer && renderer.findFiberByHostInstance) {
        // Попробуем найти компонент с supabase
        const fiber = renderer.findFiberByHostInstance(document.body);
        if (fiber) {
          let current = fiber;
          while (current) {
            if (current.memoizedProps && current.memoizedProps.supabase) {
              return current.memoizedProps.supabase;
            }
            current = current.return;
          }
        }
      }
    }
  }
  
  // Создаем новый клиент supabase
  const supabaseUrl = 'YOUR_SUPABASE_URL'; // Замените на ваш URL
  const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'; // Замените на ваш ключ
  
  if (supabaseUrl === 'YOUR_SUPABASE_URL') {
    console.error('❌ Необходимо указать URL и ключ Supabase в скрипте');
    return null;
  }
  
  // Динамически импортируем supabase
  return window.supabase.createClient(supabaseUrl, supabaseKey);
}

// Альтернативный способ - через fetch API
async function fixStatsWithFetch() {
  console.log('🔄 Исправляем статистику через API...');
  
  try {
    // Сначала исправляем месячную статистику
    const fixStatsResponse = await fetch('/api/fix-monthly-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ familyId: 1 })
    });
    
    if (fixStatsResponse.ok) {
      console.log('✅ Статистика исправлена через API');
    } else {
      console.log('⚠️ API недоступен, используем прямой SQL');
    }
  } catch (error) {
    console.log('⚠️ API недоступен, используем прямой SQL');
  }
}

// Функция для прямого исправления статистики через SQL
async function fixStatsDirectly() {
  console.log('🔄 Исправляем статистику напрямую...');
  
  // SQL для исправления статистики
  const fixStatsSQL = `
    -- Удаляем старую статистику
    DELETE FROM monthly_stats WHERE family_id = 1;
    
    -- Пересчитываем статистику для октября 2024
    INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
    SELECT 
      1 as family_id,
      '2024-10' as month,
      2024 as year,
      COALESCE(SUM(r.total_amount), 0) as total_spent,
      COALESCE(SUM(p.calories * ph.quantity), 0) as total_calories,
      COALESCE(ROUND(SUM(p.calories * ph.quantity) / 31), 0) as avg_calories_per_day,
      COUNT(DISTINCT r.id) as receipts_count
    FROM receipts r
    LEFT JOIN product_history ph ON ph.family_id = r.family_id 
      AND EXTRACT(YEAR FROM ph.date) = 2024 
      AND EXTRACT(MONTH FROM ph.date) = 10
    LEFT JOIN products p ON ph.product_id = p.id
    WHERE r.family_id = 1 
      AND EXTRACT(YEAR FROM r.date) = 2024 
      AND EXTRACT(MONTH FROM r.date) = 10;
    
    -- Пересчитываем статистику для ноября 2024
    INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
    SELECT 
      1 as family_id,
      '2024-11' as month,
      2024 as year,
      COALESCE(SUM(r.total_amount), 0) as total_spent,
      COALESCE(SUM(p.calories * ph.quantity), 0) as total_calories,
      COALESCE(ROUND(SUM(p.calories * ph.quantity) / 30), 0) as avg_calories_per_day,
      COUNT(DISTINCT r.id) as receipts_count
    FROM receipts r
    LEFT JOIN product_history ph ON ph.family_id = r.family_id 
      AND EXTRACT(YEAR FROM ph.date) = 2024 
      AND EXTRACT(MONTH FROM ph.date) = 11
    LEFT JOIN products p ON ph.product_id = p.id
    WHERE r.family_id = 1 
      AND EXTRACT(YEAR FROM r.date) = 2024 
      AND EXTRACT(MONTH FROM r.date) = 11;
  `;
  
  console.log('📝 SQL для исправления статистики:');
  console.log(fixStatsSQL);
  console.log('\n💡 Скопируйте этот SQL и выполните в Supabase Dashboard');
}

// Функция для проверки текущего состояния
async function checkCurrentState() {
  console.log('🔍 Проверяем текущее состояние...');
  
  // Проверяем, есть ли данные в localStorage или sessionStorage
  const storedData = localStorage.getItem('supabase-data') || sessionStorage.getItem('supabase-data');
  if (storedData) {
    console.log('📦 Найдены данные в localStorage:', JSON.parse(storedData));
  }
  
  // Проверяем, есть ли React компоненты на странице
  const reactElements = document.querySelectorAll('[data-reactroot], [data-react-helmet]');
  console.log('⚛️ React элементы найдены:', reactElements.length);
  
  // Проверяем, есть ли кнопка обновления статистики
  const updateButton = document.querySelector('button[title="Пересчитать статистику"], button:contains("Обновить")');
  if (updateButton) {
    console.log('🔄 Кнопка обновления статистики найдена');
    console.log('💡 Попробуйте нажать кнопку "Обновить" в дашборде');
  }
}

// Основная функция
async function main() {
  console.log('🚀 Запускаем исправление статистики...');
  
  // Проверяем текущее состояние
  await checkCurrentState();
  
  // Пытаемся получить supabase клиент
  const supabase = getSupabaseClient();
  
  if (supabase) {
    console.log('✅ Supabase клиент найден');
    
    // Проверяем статистику
    try {
      const { data: stats, error } = await supabase
        .from('monthly_stats')
        .select('*')
        .eq('family_id', 1);
      
      if (error) {
        console.error('❌ Ошибка получения статистики:', error);
      } else {
        console.log('📊 Текущая статистика:', stats);
      }
    } catch (error) {
      console.error('❌ Ошибка:', error);
    }
  } else {
    console.log('❌ Supabase клиент не найден');
    console.log('💡 Используем альтернативные методы...');
    
    // Пытаемся исправить через API
    await fixStatsWithFetch();
    
    // Показываем SQL для ручного исправления
    await fixStatsDirectly();
  }
  
  console.log('\n🎯 Рекомендации:');
  console.log('1. Выполните SQL из файла fix_monthly_stats.sql в Supabase Dashboard');
  console.log('2. Нажмите кнопку "Обновить" в дашборде приложения');
  console.log('3. Обновите страницу приложения (F5)');
  console.log('4. Если проблема остается, проверьте консоль на ошибки');
}

// Запускаем основную функцию
main();
