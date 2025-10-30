// Скрипт для добавления тестовых чеков и проверки статистики
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Загружаем переменные окружения
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Не найдены переменные окружения VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function addTestReceipts() {
  console.log('🚀 Начинаем добавление тестовых чеков...')
  
  try {
    // Читаем SQL файл
    const sqlContent = fs.readFileSync('./add_test_receipts.sql', 'utf8')
    
    // Разбиваем на отдельные запросы
    const queries = sqlContent
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('--'))
    
    console.log(`📝 Найдено ${queries.length} SQL запросов для выполнения`)
    
    // Выполняем каждый запрос
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i]
      if (query.trim()) {
        console.log(`⏳ Выполняем запрос ${i + 1}/${queries.length}...`)
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { sql_query: query })
          
          if (error) {
            console.error(`❌ Ошибка в запросе ${i + 1}:`, error)
            // Продолжаем выполнение других запросов
          } else {
            console.log(`✅ Запрос ${i + 1} выполнен успешно`)
          }
        } catch (err) {
          console.error(`❌ Исключение в запросе ${i + 1}:`, err.message)
        }
      }
    }
    
    // Проверяем результаты
    await checkStatistics()
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error)
  }
}

async function checkStatistics() {
  console.log('\n📊 Проверяем статистику...')
  
  try {
    // Получаем месячную статистику
    const { data: monthlyStats, error: statsError } = await supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', 1)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    
    if (statsError) {
      console.error('❌ Ошибка получения статистики:', statsError)
      return
    }
    
    console.log('\n📈 Месячная статистика:')
    monthlyStats.forEach(stat => {
      console.log(`${stat.year}-${stat.month}:`)
      console.log(`  💰 Потрачено: $${stat.total_spent}`)
      console.log(`  🔥 Калории: ${stat.total_calories}`)
      console.log(`  📅 Среднее калорий в день: ${stat.avg_calories_per_day}`)
      console.log(`  🧾 Количество чеков: ${stat.receipts_count}`)
      console.log('')
    })
    
    // Получаем информацию о продуктах
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('family_id', 1)
      .order('purchase_count', { ascending: false })
    
    if (productsError) {
      console.error('❌ Ошибка получения продуктов:', productsError)
      return
    }
    
    console.log('🛒 Топ продуктов по количеству покупок:')
    products.slice(0, 10).forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} - ${product.purchase_count} покупок, ${product.calories} калорий`)
    })
    
    // Получаем информацию о чеках
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('*')
      .eq('family_id', 1)
      .order('date', { ascending: false })
    
    if (receiptsError) {
      console.error('❌ Ошибка получения чеков:', receiptsError)
      return
    }
    
    console.log('\n🧾 Последние чеки:')
    receipts.slice(0, 5).forEach((receipt, index) => {
      console.log(`${index + 1}. ${receipt.date} - $${receipt.total_amount} (${receipt.items_count} товаров)`)
    })
    
    console.log('\n✅ Тестовые данные успешно добавлены!')
    console.log(`📊 Всего продуктов: ${products.length}`)
    console.log(`🧾 Всего чеков: ${receipts.length}`)
    console.log(`📈 Записей статистики: ${monthlyStats.length}`)
    
  } catch (error) {
    console.error('❌ Ошибка проверки статистики:', error)
  }
}

// Запускаем скрипт
addTestReceipts()
