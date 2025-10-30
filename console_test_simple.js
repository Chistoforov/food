/**
 * Простой тест удаления чеков для консоли браузера
 * 
 * ИНСТРУКЦИЯ:
 * 1. Откройте консоль браузера (F12)
 * 2. Скопируйте и вставьте этот код
 * 3. Запустите: testDeleteReceipt()
 */

async function testDeleteReceipt() {
    console.log('🔍 Тестируем удаление чеков...');
    
    // Получаем переменные окружения из window объекта
    const SUPABASE_URL = window.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
    const SUPABASE_KEY = window.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
    
    console.log('📡 Supabase URL:', SUPABASE_URL);
    console.log('🔑 Supabase Key:', SUPABASE_KEY.substring(0, 20) + '...');
    
    if (SUPABASE_URL === 'https://your-project.supabase.co' || SUPABASE_KEY === 'your-anon-key') {
        console.error('❌ Переменные окружения не найдены!');
        console.log('💡 Проверьте, что приложение загружено и переменные доступны');
        console.log('💡 Попробуйте выполнить этот код на странице вашего приложения');
        return;
    }
    
    try {
        // Загружаем Supabase клиент
        const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js@2');
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        
        console.log('✅ Supabase клиент создан');
        
        // Получаем список чеков
        console.log('📋 Получаем список чеков...');
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
        
        if (!receipts || receipts.length === 0) {
            console.log('⚠️ Нет чеков для тестирования');
            return;
        }
        
        // Показываем список чеков
        console.table(receipts.map(r => ({
            id: r.id,
            date: r.date,
            total: r.total_amount,
            items: r.items_count
        })));
        
        // Берем первый чек для тестирования
        const testReceipt = receipts[0];
        console.log(`🧪 Тестируем удаление чека #${testReceipt.id}...`);
        
        // Проверяем связанные записи
        const { data: relatedHistory } = await supabase
            .from('product_history')
            .select('id')
            .eq('receipt_id', testReceipt.id);
        
        console.log(`📊 Связанных записей product_history: ${relatedHistory?.length || 0}`);
        
        // Пробуем удалить чек
        console.log('🗑️ Удаляем чек...');
        const { error: deleteError } = await supabase
            .from('receipts')
            .delete()
            .eq('id', testReceipt.id);
        
        if (deleteError) {
            console.error('❌ ОШИБКА УДАЛЕНИЯ:', deleteError);
            
            if (deleteError.message.includes('policy') || deleteError.message.includes('RLS')) {
                console.log('\n💡 ПРОБЛЕМА НАЙДЕНА! RLS политики не настроены.');
                console.log('🔧 РЕШЕНИЕ:');
                console.log('1. Откройте Supabase Dashboard');
                console.log('2. Перейдите в SQL Editor');
                console.log('3. Выполните этот SQL:');
                console.log(`
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on receipts" ON receipts USING (true);
CREATE POLICY "Allow all operations on product_history" ON product_history USING (true);
                `);
            } else if (deleteError.message.includes('permission') || deleteError.message.includes('denied')) {
                console.log('\n💡 ПРОБЛЕМА: Нет прав на удаление');
                console.log('🔧 РЕШЕНИЕ: Проверьте RLS политики в Supabase');
            } else {
                console.log('\n💡 ПРОБЛЕМА: Неизвестная ошибка');
                console.log('🔧 РЕШЕНИЕ: Проверьте логи Supabase Dashboard');
            }
            return;
        }
        
        console.log('✅ Чек успешно удален!');
        
        // Проверяем, что чек действительно удален
        console.log('🔍 Проверяем, что чек удален из БД...');
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
        console.error('❌ Ошибка:', error);
        console.log('💡 Возможные причины:');
        console.log('   - Неправильные переменные окружения');
        console.log('   - Проблема с подключением к Supabase');
        console.log('   - Ошибка загрузки библиотеки Supabase');
    }
}

// Альтернативная функция для получения переменных из DOM
function getEnvVars() {
    console.log('🔍 Ищем переменные окружения...');
    
    // Пробуем найти в window объекте
    if (window.VITE_SUPABASE_URL && window.VITE_SUPABASE_ANON_KEY) {
        console.log('✅ Переменные найдены в window объекте');
        return {
            url: window.VITE_SUPABASE_URL,
            key: window.VITE_SUPABASE_ANON_KEY
        };
    }
    
    // Пробуем найти в script тегах
    const scripts = document.querySelectorAll('script[type="module"]');
    for (const script of scripts) {
        if (script.textContent.includes('VITE_SUPABASE_URL')) {
            const match = script.textContent.match(/VITE_SUPABASE_URL["\s]*:["\s]*["']([^"']+)["']/);
            if (match) {
                console.log('✅ URL найден в script теге');
                return {
                    url: match[1],
                    key: 'Нужно найти ключ отдельно'
                };
            }
        }
    }
    
    console.log('❌ Переменные окружения не найдены');
    console.log('💡 Убедитесь, что вы выполняете код на странице вашего приложения');
    return null;
}

// Функция для ручного ввода переменных
function setEnvVars(url, key) {
    window.VITE_SUPABASE_URL = url;
    window.VITE_SUPABASE_ANON_KEY = key;
    console.log('✅ Переменные окружения установлены вручную');
    console.log('💡 Теперь запустите: testDeleteReceipt()');
}

// Экспортируем функции
window.testDeleteReceipt = testDeleteReceipt;
window.getEnvVars = getEnvVars;
window.setEnvVars = setEnvVars;

console.log('✅ Скрипт загружен!');
console.log('💡 Команды:');
console.log('   testDeleteReceipt() - тестировать удаление');
console.log('   getEnvVars() - найти переменные окружения');
console.log('   setEnvVars(url, key) - установить переменные вручную');
console.log('');
console.log('🚀 Запустите: testDeleteReceipt()');
