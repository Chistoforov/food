// Скрипт для отладки пересчета статистики
// Выполните этот код в консоли браузера на странице приложения

console.log('🔍 Отладка пересчета статистики...');

// Функция для проверки текущей статистики
async function checkStats() {
  try {
    // Получаем статистику напрямую из базы
    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'SELECT * FROM monthly_stats WHERE family_id = 1 ORDER BY year DESC, month DESC'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Статистика в базе:', data);
      return data;
    } else {
      console.log('❌ Ошибка API, используем альтернативный метод');
      return null;
    }
  } catch (error) {
    console.log('❌ Ошибка проверки статистики:', error);
    return null;
  }
}

// Функция для проверки чеков
async function checkReceipts() {
  try {
    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'SELECT id, date, total_amount, items_count FROM receipts WHERE family_id = 1 ORDER BY date DESC'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('🧾 Чеки в базе:', data);
      return data;
    }
  } catch (error) {
    console.log('❌ Ошибка проверки чеков:', error);
  }
}

// Функция для проверки истории покупок
async function checkHistory() {
  try {
    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `SELECT ph.date, ph.quantity, ph.price, p.name, p.calories 
                FROM product_history ph 
                JOIN products p ON ph.product_id = p.id 
                WHERE ph.family_id = 1 
                ORDER BY ph.date DESC 
                LIMIT 10`
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('📦 История покупок:', data);
      return data;
    }
  } catch (error) {
    console.log('❌ Ошибка проверки истории:', error);
  }
}

// Функция для ручного пересчета статистики
async function manualRecalculate() {
  console.log('🔄 Ручной пересчет статистики...');
  
  try {
    // Получаем все чеки
    const receipts = await checkReceipts();
    if (!receipts || receipts.length === 0) {
      console.log('❌ Нет чеков для пересчета');
      return;
    }
    
    // Группируем чеки по месяцам
    const monthsData = {};
    receipts.forEach(receipt => {
      const date = new Date(receipt.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;
      
      if (!monthsData[key]) {
        monthsData[key] = {
          year,
          month,
          totalSpent: 0,
          receiptsCount: 0,
          receipts: []
        };
      }
      
      monthsData[key].totalSpent += receipt.total_amount || 0;
      monthsData[key].receiptsCount += 1;
      monthsData[key].receipts.push(receipt);
    });
    
    console.log('📅 Месяцы для пересчета:', monthsData);
    
    // Для каждого месяца пересчитываем статистику
    for (const [monthKey, data] of Object.entries(monthsData)) {
      console.log(`🔄 Пересчитываем ${monthKey}...`);
      
      // Получаем историю покупок за этот месяц
      const startDate = `${data.year}-${data.month}-01`;
      const endDate = `${data.year}-${String(parseInt(data.month) + 1).padStart(2, '0')}-01`;
      
      const historyResponse = await fetch('/api/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `SELECT ph.quantity, p.calories 
                  FROM product_history ph 
                  JOIN products p ON ph.product_id = p.id 
                  WHERE ph.family_id = 1 
                  AND ph.date >= '${startDate}' 
                  AND ph.date < '${endDate}'`
        })
      });
      
      let totalCalories = 0;
      if (historyResponse.ok) {
        const history = await historyResponse.json();
        totalCalories = history.reduce((sum, item) => {
          return sum + ((item.calories || 0) * (item.quantity || 0));
        }, 0);
      }
      
      const daysInMonth = new Date(data.year, parseInt(data.month), 0).getDate();
      const avgCaloriesPerDay = Math.round(totalCalories / daysInMonth);
      
      console.log(`📊 ${monthKey}: $${data.totalSpent}, ${totalCalories} калорий, ${data.receiptsCount} чеков`);
      
      // Обновляем статистику в базе
      const updateResponse = await fetch('/api/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
                  VALUES (1, '${monthKey}', ${data.year}, ${data.totalSpent}, ${totalCalories}, ${avgCaloriesPerDay}, ${data.receiptsCount})
                  ON CONFLICT (family_id, month, year) 
                  DO UPDATE SET 
                    total_spent = EXCLUDED.total_spent,
                    total_calories = EXCLUDED.total_calories,
                    avg_calories_per_day = EXCLUDED.avg_calories_per_day,
                    receipts_count = EXCLUDED.receipts_count,
                    updated_at = NOW()`
        })
      });
      
      if (updateResponse.ok) {
        console.log(`✅ ${monthKey} обновлен`);
      } else {
        console.log(`❌ Ошибка обновления ${monthKey}`);
      }
    }
    
    // Проверяем результат
    await checkStats();
    
  } catch (error) {
    console.error('❌ Ошибка ручного пересчета:', error);
  }
}

// Основная функция отладки
async function debugRecalculate() {
  console.log('🚀 Начинаем отладку...');
  
  console.log('\n1️⃣ Проверяем текущую статистику:');
  await checkStats();
  
  console.log('\n2️⃣ Проверяем чеки:');
  await checkReceipts();
  
  console.log('\n3️⃣ Проверяем историю покупок:');
  await checkHistory();
  
  console.log('\n4️⃣ Выполняем ручной пересчет:');
  await manualRecalculate();
  
  console.log('\n✅ Отладка завершена!');
}

// Запускаем отладку
debugRecalculate();
