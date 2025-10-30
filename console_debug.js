/**
 * Скрипт для диагностики проблемы с удалением чеков
 * 
 * ИНСТРУКЦИЯ:
 * 1. Откройте консоль браузера (F12)
 * 2. Скопируйте и вставьте этот код
 * 3. Запустите: debugDeleteReceipt()
 */

async function debugDeleteReceipt() {
    console.log('🔍 Начинаем диагностику удаления чеков...');
    
    // 1. Проверяем переменные окружения
    console.log('\n1️⃣ Проверяем переменные окружения...');
    const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL) {
        console.error('❌ VITE_SUPABASE_URL не найден!');
        console.log('💡 Проверьте файл .env.local или .env');
        return;
    }
    
    if (!SUPABASE_KEY) {
        console.error('❌ VITE_SUPABASE_ANON_KEY не найден!');
        console.log('💡 Проверьте файл .env.local или .env');
        return;
    }
    
    console.log('✅ Переменные окружения найдены');
    console.log('📡 URL:', SUPABASE_URL);
    console.log('🔑 Key:', SUPABASE_KEY.substring(0, 20) + '...');
    
    // 2. Создаем клиент Supabase
    console.log('\n2️⃣ Создаем клиент Supabase...');
    let supabase;
    try {
        const { createClient } = await import('@supabase/supabase-js');
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Клиент Supabase создан');
    } catch (error) {
        console.error('❌ Ошибка создания клиента:', error);
        return;
    }
    
    // 3. Проверяем подключение
    console.log('\n3️⃣ Проверяем подключение к БД...');
    try {
        const { data, error } = await supabase.from('families').select('count').limit(1);
        if (error) {
            console.error('❌ Ошибка подключения:', error);
            return;
        }
        console.log('✅ Подключение к БД работает');
    } catch (error) {
        console.error('❌ Ошибка подключения:', error);
        return;
    }
    
    // 4. Получаем список чеков
    console.log('\n4️⃣ Получаем список чеков...');
    const { data: receipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('*')
        .eq('family_id', 1)
        .order('date', { ascending: false });
    
    if (receiptsError) {
        console.error('❌ Ошибка получения чеков:', receiptsError);
        return;
    }
    
    console.log(`✅ Найдено чеков: ${receipts?.length || 0}`);
    if (receipts && receipts.length > 0) {
        console.table(receipts.map(r => ({
            id: r.id,
            date: r.date,
            total: r.total_amount,
            items: r.items_count
        })));
    }
    
    if (!receipts || receipts.length === 0) {
        console.log('⚠️ Нет чеков для тестирования. Создайте чек сначала.');
        return;
    }
    
    // 5. Проверяем RLS политики (пробуем удалить тестовый чек)
    console.log('\n5️⃣ Проверяем RLS политики...');
    const testReceipt = receipts[0];
    console.log(`🧪 Тестируем удаление чека #${testReceipt.id}...`);
    
    try {
        // Сначала получаем связанные записи
        const { data: relatedHistory } = await supabase
            .from('product_history')
            .select('id')
            .eq('receipt_id', testReceipt.id);
        
        console.log(`📊 Связанных записей product_history: ${relatedHistory?.length || 0}`);
        
        // Пробуем удалить чек
        const { error: deleteError } = await supabase
            .from('receipts')
            .delete()
            .eq('id', testReceipt.id);
        
        if (deleteError) {
            console.error('❌ Ошибка удаления:', deleteError);
            
            if (deleteError.message.includes('policy') || deleteError.message.includes('RLS')) {
                console.log('\n💡 ПРОБЛЕМА НАЙДЕНА! RLS политики не настроены.');
                console.log('🔧 РЕШЕНИЕ:');
                console.log('1. Откройте Supabase Dashboard');
                console.log('2. Перейдите в SQL Editor');
                console.log('3. Выполните скрипт из файла setup_rls_policies.sql');
                console.log('4. Или выполните этот SQL:');
                console.log(`
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on receipts" ON receipts USING (true);
CREATE POLICY "Allow all operations on product_history" ON product_history USING (true);
                `);
            }
            return;
        }
        
        console.log('✅ Чек успешно удален из БД!');
        
        // 6. Проверяем, что чек действительно удален
        console.log('\n6️⃣ Проверяем, что чек удален...');
        const { data: checkReceipt, error: checkError } = await supabase
            .from('receipts')
            .select('id')
            .eq('id', testReceipt.id)
            .single();
        
        if (checkError || !checkReceipt) {
            console.log('✅ Чек действительно удален из БД!');
            console.log('🎉 УДАЛЕНИЕ РАБОТАЕТ! Обновите страницу приложения.');
        } else {
            console.log('❌ Чек все еще существует в БД!');
            console.log('💡 Возможные причины:');
            console.log('   - RLS политики не настроены правильно');
            console.log('   - Проблема с CASCADE удалением');
            console.log('   - Ошибка в триггерах БД');
        }
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error);
    }
    
    console.log('\n🎯 ДИАГНОСТИКА ЗАВЕРШЕНА');
    console.log('📝 Если удаление не работает, выполните SQL-скрипт из setup_rls_policies.sql');
}

// Экспортируем функцию
window.debugDeleteReceipt = debugDeleteReceipt;

console.log('✅ Скрипт диагностики загружен!');
console.log('💡 Запустите: debugDeleteReceipt()');
