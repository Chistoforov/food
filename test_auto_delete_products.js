/**
 * Тест автоматического удаления товаров при удалении чека
 * 
 * Этот скрипт проверяет:
 * 1. Создание чека с товарами
 * 2. Удаление чека
 * 3. Автоматическое удаление товаров без истории
 * 4. Сохранение товаров с историей из других чеков
 * 5. Автоматический пересчет статистики
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Загружаем переменные окружения
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Ошибка: Не найдены VITE_SUPABASE_URL или VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Вспомогательные функции
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function getProductsCount(familyId) {
  const { count, error } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('family_id', familyId)
  
  if (error) throw error
  return count
}

async function getProductByName(familyId, name) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('family_id', familyId)
    .eq('name', name)
    .maybeSingle()
  
  if (error) throw error
  return data
}

async function getProductHistory(productId) {
  const { data, error } = await supabase
    .from('product_history')
    .select('*')
    .eq('product_id', productId)
  
  if (error) throw error
  return data
}

async function getMonthlyStats(familyId, month, year) {
  const { data, error } = await supabase
    .from('monthly_stats')
    .select('*')
    .eq('family_id', familyId)
    .eq('month', `${year}-${month.padStart(2, '0')}`)
    .maybeSingle()
  
  if (error) throw error
  return data
}

// Основная функция теста
async function runTest() {
  console.log('\n🧪 Начинаем тест автоматического удаления товаров\n')
  
  try {
    // Получаем первую семью для тестирования
    const { data: families, error: familiesError } = await supabase
      .from('families')
      .select('*')
      .limit(1)
    
    if (familiesError) throw familiesError
    if (!families || families.length === 0) {
      throw new Error('Не найдено семей в базе данных')
    }
    
    const familyId = families[0].id
    console.log(`✅ Используем семью #${familyId}: ${families[0].name}\n`)
    
    // Подсчитываем исходное количество товаров
    const initialProductsCount = await getProductsCount(familyId)
    console.log(`📦 Исходное количество товаров: ${initialProductsCount}\n`)
    
    // ===== ТЕСТ 1: Товар с единственной историей покупки =====
    console.log('🔬 ТЕСТ 1: Товар с единственной историей покупки')
    console.log('─'.repeat(60))
    
    // Создаем тестовый чек #1
    const testDate1 = new Date().toISOString().split('T')[0]
    const { data: receipt1, error: receipt1Error } = await supabase
      .from('receipts')
      .insert({
        family_id: familyId,
        date: testDate1,
        items_count: 1,
        total_amount: 99.99,
        status: 'processed'
      })
      .select()
      .single()
    
    if (receipt1Error) throw receipt1Error
    console.log(`✅ Создан тестовый чек #${receipt1.id}`)
    
    // Создаем уникальный товар
    const uniqueProductName = `TEST_UNIQUE_${Date.now()}`
    const { data: uniqueProduct, error: uniqueProductError } = await supabase
      .from('products')
      .insert({
        family_id: familyId,
        name: uniqueProductName,
        calories: 100,
        price: 99.99,
        purchase_count: 1,
        status: 'calculating'
      })
      .select()
      .single()
    
    if (uniqueProductError) throw uniqueProductError
    console.log(`✅ Создан уникальный товар #${uniqueProduct.id}: ${uniqueProductName}`)
    
    // Создаем историю покупки
    const { error: history1Error } = await supabase
      .from('product_history')
      .insert({
        product_id: uniqueProduct.id,
        family_id: familyId,
        date: testDate1,
        quantity: 1,
        price: 99.99,
        unit_price: 99.99,
        receipt_id: receipt1.id
      })
    
    if (history1Error) throw history1Error
    console.log(`✅ Создана история покупки для товара #${uniqueProduct.id}`)
    
    // Проверяем, что товар существует
    let product = await getProductByName(familyId, uniqueProductName)
    console.log(`✅ Товар найден: ${product ? 'ДА' : 'НЕТ'}`)
    
    // Удаляем чек
    console.log(`\n🗑️  Удаляем чек #${receipt1.id}...`)
    const { error: deleteError1 } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receipt1.id)
    
    if (deleteError1) throw deleteError1
    console.log('✅ Чек удален')
    
    // Ждем выполнения триггеров
    await sleep(1000)
    
    // Проверяем, что товар удален
    product = await getProductByName(familyId, uniqueProductName)
    if (product) {
      console.log('❌ ОШИБКА: Товар НЕ удален автоматически!')
    } else {
      console.log('✅ УСПЕХ: Товар автоматически удален (нет истории покупок)')
    }
    
    console.log('\n' + '─'.repeat(60) + '\n')
    
    // ===== ТЕСТ 2: Товар с несколькими покупками =====
    console.log('🔬 ТЕСТ 2: Товар с несколькими покупками')
    console.log('─'.repeat(60))
    
    // Создаем товар
    const sharedProductName = `TEST_SHARED_${Date.now()}`
    const { data: sharedProduct, error: sharedProductError } = await supabase
      .from('products')
      .insert({
        family_id: familyId,
        name: sharedProductName,
        calories: 200,
        price: 50.00,
        purchase_count: 2,
        status: 'calculating'
      })
      .select()
      .single()
    
    if (sharedProductError) throw sharedProductError
    console.log(`✅ Создан товар #${sharedProduct.id}: ${sharedProductName}`)
    
    // Создаем чек #2
    const { data: receipt2, error: receipt2Error } = await supabase
      .from('receipts')
      .insert({
        family_id: familyId,
        date: testDate1,
        items_count: 1,
        total_amount: 50.00,
        status: 'processed'
      })
      .select()
      .single()
    
    if (receipt2Error) throw receipt2Error
    console.log(`✅ Создан чек #${receipt2.id}`)
    
    // Создаем чек #3
    const { data: receipt3, error: receipt3Error } = await supabase
      .from('receipts')
      .insert({
        family_id: familyId,
        date: testDate1,
        items_count: 1,
        total_amount: 50.00,
        status: 'processed'
      })
      .select()
      .single()
    
    if (receipt3Error) throw receipt3Error
    console.log(`✅ Создан чек #${receipt3.id}`)
    
    // Создаем две истории покупок
    const { error: history2Error } = await supabase
      .from('product_history')
      .insert([
        {
          product_id: sharedProduct.id,
          family_id: familyId,
          date: testDate1,
          quantity: 1,
          price: 50.00,
          unit_price: 50.00,
          receipt_id: receipt2.id
        },
        {
          product_id: sharedProduct.id,
          family_id: familyId,
          date: testDate1,
          quantity: 1,
          price: 50.00,
          unit_price: 50.00,
          receipt_id: receipt3.id
        }
      ])
    
    if (history2Error) throw history2Error
    console.log(`✅ Создано 2 истории покупок для товара #${sharedProduct.id}`)
    
    // Проверяем историю
    let history = await getProductHistory(sharedProduct.id)
    console.log(`📊 Количество записей в истории: ${history.length}`)
    
    // Удаляем первый чек
    console.log(`\n🗑️  Удаляем чек #${receipt2.id}...`)
    const { error: deleteError2 } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receipt2.id)
    
    if (deleteError2) throw deleteError2
    console.log('✅ Чек удален')
    
    // Ждем выполнения триггеров
    await sleep(1000)
    
    // Проверяем, что товар НЕ удален
    product = await getProductByName(familyId, sharedProductName)
    if (!product) {
      console.log('❌ ОШИБКА: Товар удален, хотя есть история из другого чека!')
    } else {
      console.log('✅ УСПЕХ: Товар сохранен (есть история из другого чека)')
    }
    
    // Проверяем историю
    history = await getProductHistory(sharedProduct.id)
    console.log(`📊 Количество записей в истории после удаления: ${history.length}`)
    
    if (history.length === 1) {
      console.log('✅ УСПЕХ: История корректно обновлена')
    } else {
      console.log(`❌ ОШИБКА: Неправильное количество записей в истории (ожидалось 1, получено ${history.length})`)
    }
    
    // Удаляем второй чек
    console.log(`\n🗑️  Удаляем чек #${receipt3.id}...`)
    const { error: deleteError3 } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receipt3.id)
    
    if (deleteError3) throw deleteError3
    console.log('✅ Чек удален')
    
    // Ждем выполнения триггеров
    await sleep(1000)
    
    // Проверяем, что товар теперь удален
    product = await getProductByName(familyId, sharedProductName)
    if (product) {
      console.log('❌ ОШИБКА: Товар НЕ удален после удаления всех чеков!')
    } else {
      console.log('✅ УСПЕХ: Товар автоматически удален после удаления всех чеков')
    }
    
    console.log('\n' + '─'.repeat(60) + '\n')
    
    // ===== ТЕСТ 3: Проверка пересчета статистики =====
    console.log('🔬 ТЕСТ 3: Автоматический пересчет статистики')
    console.log('─'.repeat(60))
    
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    
    // Получаем статистику до
    const statsBefore = await getMonthlyStats(familyId, month, year)
    console.log(`📊 Статистика до: траты = ${statsBefore?.total_spent || 0}, чеков = ${statsBefore?.receipts_count || 0}`)
    
    // Создаем чек
    const { data: receipt4, error: receipt4Error } = await supabase
      .from('receipts')
      .insert({
        family_id: familyId,
        date: today.toISOString().split('T')[0],
        items_count: 1,
        total_amount: 123.45,
        status: 'processed'
      })
      .select()
      .single()
    
    if (receipt4Error) throw receipt4Error
    console.log(`✅ Создан чек #${receipt4.id} на сумму 123.45`)
    
    // Ждем пересчета
    await sleep(2000)
    
    // Получаем статистику после создания
    const statsAfterCreate = await getMonthlyStats(familyId, month, year)
    const expectedSpentAfterCreate = (statsBefore?.total_spent || 0) + 123.45
    const expectedCountAfterCreate = (statsBefore?.receipts_count || 0) + 1
    
    console.log(`📊 Статистика после создания: траты = ${statsAfterCreate?.total_spent || 0}, чеков = ${statsAfterCreate?.receipts_count || 0}`)
    
    // Удаляем чек
    console.log(`\n🗑️  Удаляем чек #${receipt4.id}...`)
    const { error: deleteError4 } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receipt4.id)
    
    if (deleteError4) throw deleteError4
    console.log('✅ Чек удален')
    
    // Ждем пересчета
    await sleep(2000)
    
    // Получаем статистику после удаления
    const statsAfterDelete = await getMonthlyStats(familyId, month, year)
    console.log(`📊 Статистика после удаления: траты = ${statsAfterDelete?.total_spent || 0}, чеков = ${statsAfterDelete?.receipts_count || 0}`)
    
    const spentMatch = Math.abs((statsAfterDelete?.total_spent || 0) - (statsBefore?.total_spent || 0)) < 0.01
    const countMatch = (statsAfterDelete?.receipts_count || 0) === (statsBefore?.receipts_count || 0)
    
    if (spentMatch && countMatch) {
      console.log('✅ УСПЕХ: Статистика автоматически пересчитана корректно')
    } else {
      console.log('❌ ОШИБКА: Статистика не совпадает с ожидаемой')
      console.log(`   Ожидалось: траты = ${statsBefore?.total_spent || 0}, чеков = ${statsBefore?.receipts_count || 0}`)
      console.log(`   Получено: траты = ${statsAfterDelete?.total_spent || 0}, чеков = ${statsAfterDelete?.receipts_count || 0}`)
    }
    
    console.log('\n' + '─'.repeat(60) + '\n')
    
    // Итоговая информация
    const finalProductsCount = await getProductsCount(familyId)
    console.log(`\n📦 Итоговое количество товаров: ${finalProductsCount}`)
    console.log(`📦 Изменение: ${finalProductsCount - initialProductsCount} (ожидается 0)`)
    
    if (finalProductsCount === initialProductsCount) {
      console.log('\n✅ ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ!\n')
    } else {
      console.log('\n⚠️  Обнаружены расхождения в количестве товаров\n')
    }
    
  } catch (error) {
    console.error('\n❌ Ошибка во время теста:', error)
    console.error(error)
  }
}

// Запускаем тест
runTest()

