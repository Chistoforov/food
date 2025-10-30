// Скрипт для добавления тестовых данных через консоль браузера
// Выполните этот код в консоли браузера на странице приложения

console.log('🚀 Начинаем добавление тестовых данных...');

// Функция для выполнения SQL запроса
async function executeSQL(sql) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.error('❌ Ошибка SQL:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ Исключение:', err);
    return false;
  }
}

// Основная функция добавления данных
async function addTestData() {
  console.log('📝 Добавляем продукты...');
  
  // Добавляем продукты
  const productsSQL = `
    INSERT INTO products (name, calories, price, family_id, status) VALUES
    ('Яблоки', 52, 2.50, 1, 'ok'),
    ('Бананы', 89, 1.80, 1, 'ok'),
    ('Морковь', 41, 1.20, 1, 'ok'),
    ('Картофель', 77, 1.50, 1, 'ok'),
    ('Помидоры', 18, 3.20, 1, 'ok'),
    ('Сыр', 356, 4.50, 1, 'ok'),
    ('Йогурт', 59, 1.20, 1, 'ok'),
    ('Курица', 165, 6.50, 1, 'ok'),
    ('Яйца', 155, 2.80, 1, 'ok'),
    ('Хлеб', 1320, 1.25, 1, 'ok');
  `;
  
  await executeSQL(productsSQL);
  
  console.log('🧾 Добавляем чеки...');
  
  // Добавляем чеки
  const receiptsSQL = `
    INSERT INTO receipts (date, items_count, total_amount, status, family_id) VALUES
    ('2024-11-01', 4, 12.30, 'processed', 1),
    ('2024-10-28', 3, 8.50, 'processed', 1),
    ('2024-10-25', 5, 18.70, 'processed', 1),
    ('2024-10-22', 3, 7.80, 'processed', 1),
    ('2024-10-19', 4, 15.20, 'processed', 1);
  `;
  
  await executeSQL(receiptsSQL);
  
  console.log('📊 Добавляем историю покупок...');
  
  // Добавляем историю покупок
  const historySQL = `
    -- Чек 1 (2024-11-01)
    INSERT INTO product_history (product_id, date, quantity, price, unit_price, family_id) VALUES
    (5, '2024-11-01', 2, 5.00, 2.50, 1),
    (6, '2024-11-01', 3, 5.40, 1.80, 1),
    (7, '2024-11-01', 1, 1.20, 1.20, 1),
    (8, '2024-11-01', 1, 1.50, 1.50, 1);
    
    -- Чек 2 (2024-10-28)
    INSERT INTO product_history (product_id, date, quantity, price, unit_price, family_id) VALUES
    (5, '2024-10-28', 1, 2.50, 2.50, 1),
    (9, '2024-10-28', 1, 3.20, 3.20, 1),
    (10, '2024-10-28', 1, 4.50, 4.50, 1);
    
    -- Чек 3 (2024-10-25)
    INSERT INTO product_history (product_id, date, quantity, price, unit_price, family_id) VALUES
    (11, '2024-10-25', 1, 6.50, 6.50, 1),
    (7, '2024-10-25', 2, 2.40, 1.20, 1),
    (8, '2024-10-25', 3, 4.50, 1.50, 1),
    (9, '2024-10-25', 2, 6.40, 3.20, 1),
    (12, '2024-10-25', 1, 2.80, 2.80, 1);
    
    -- Чек 4 (2024-10-22)
    INSERT INTO product_history (product_id, date, quantity, price, unit_price, family_id) VALUES
    (10, '2024-10-22', 1, 4.50, 4.50, 1),
    (13, '2024-10-22', 2, 2.40, 1.20, 1),
    (12, '2024-10-22', 1, 2.80, 2.80, 1);
    
    -- Чек 5 (2024-10-19)
    INSERT INTO product_history (product_id, date, quantity, price, unit_price, family_id) VALUES
    (11, '2024-10-19', 1, 6.50, 6.50, 1),
    (5, '2024-10-19', 2, 5.00, 2.50, 1),
    (6, '2024-10-19', 1, 1.80, 1.80, 1),
    (14, '2024-10-19', 1, 1.25, 1.25, 1);
  `;
  
  await executeSQL(historySQL);
  
  console.log('🔄 Обновляем статистику продуктов...');
  
  // Обновляем статистику продуктов
  const updateStatsSQL = `
    UPDATE products SET 
      purchase_count = (
        SELECT COUNT(*) FROM product_history 
        WHERE product_id = products.id AND family_id = products.family_id
      ),
      last_purchase = (
        SELECT MAX(date) FROM product_history 
        WHERE product_id = products.id AND family_id = products.family_id
      )
    WHERE family_id = 1;
  `;
  
  await executeSQL(updateStatsSQL);
  
  console.log('📈 Пересчитываем месячную статистику...');
  
  // Пересчитываем месячную статистику
  await executeSQL('SELECT recalculate_monthly_stats(1, \'10\', 2024);');
  await executeSQL('SELECT recalculate_monthly_stats(1, \'11\', 2024);');
  
  console.log('✅ Тестовые данные добавлены успешно!');
  
  // Проверяем результат
  await checkResults();
}

// Функция для проверки результатов
async function checkResults() {
  console.log('🔍 Проверяем результаты...');
  
  try {
    // Проверяем продукты
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('family_id', 1);
    
    if (productsError) {
      console.error('❌ Ошибка получения продуктов:', productsError);
    } else {
      console.log(`📦 Всего продуктов: ${products.length}`);
    }
    
    // Проверяем чеки
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('*')
      .eq('family_id', 1);
    
    if (receiptsError) {
      console.error('❌ Ошибка получения чеков:', receiptsError);
    } else {
      console.log(`🧾 Всего чеков: ${receipts.length}`);
    }
    
    // Проверяем статистику
    const { data: stats, error: statsError } = await supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', 1);
    
    if (statsError) {
      console.error('❌ Ошибка получения статистики:', statsError);
    } else {
      console.log(`📊 Записей статистики: ${stats.length}`);
      stats.forEach(stat => {
        console.log(`${stat.year}-${stat.month}: $${stat.total_spent}, ${stat.total_calories} калорий`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка проверки:', error);
  }
}

// Запускаем добавление данных
addTestData();
