// ПРОСТОЙ ТЕСТ УДАЛЕНИЯ ЧЕКОВ
// Скопируйте и вставьте этот код в консоль браузера

// 1. Сначала получите переменные окружения из вашего приложения
console.log('🔍 Ищем переменные окружения...');

// Пробуем найти в window объекте
if (window.VITE_SUPABASE_URL && window.VITE_SUPABASE_ANON_KEY) {
    console.log('✅ Переменные найдены!');
    console.log('URL:', window.VITE_SUPABASE_URL);
    console.log('Key:', window.VITE_SUPABASE_ANON_KEY.substring(0, 20) + '...');
} else {
    console.log('❌ Переменные не найдены в window объекте');
    console.log('💡 Убедитесь, что вы на странице вашего приложения');
    console.log('💡 Или установите их вручную:');
    console.log('   window.VITE_SUPABASE_URL = "ваш-url";');
    console.log('   window.VITE_SUPABASE_ANON_KEY = "ваш-ключ";');
}

// 2. Функция для тестирования удаления
async function testDelete() {
    const url = window.VITE_SUPABASE_URL;
    const key = window.VITE_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
        console.error('❌ Переменные окружения не установлены!');
        return;
    }
    
    try {
        // Загружаем Supabase
        const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js@2');
        const supabase = createClient(url, key);
        
        console.log('✅ Supabase подключен');
        
        // Получаем чеки
        const { data: receipts, error: receiptsError } = await supabase
            .from('receipts')
            .select('*')
            .eq('family_id', 1);
        
        if (receiptsError) {
            console.error('❌ Ошибка получения чеков:', receiptsError);
            return;
        }
        
        console.log(`📋 Найдено чеков: ${receipts?.length || 0}`);
        
        if (!receipts || receipts.length === 0) {
            console.log('⚠️ Нет чеков для тестирования');
            return;
        }
        
        // Показываем первый чек
        const testReceipt = receipts[0];
        console.log('🧪 Тестируем удаление чека:', {
            id: testReceipt.id,
            date: testReceipt.date,
            total: testReceipt.total_amount
        });
        
        // Пробуем удалить
        const { error: deleteError } = await supabase
            .from('receipts')
            .delete()
            .eq('id', testReceipt.id);
        
        if (deleteError) {
            console.error('❌ ОШИБКА УДАЛЕНИЯ:', deleteError);
            
            if (deleteError.message.includes('policy') || deleteError.message.includes('RLS')) {
                console.log('\n🔧 РЕШЕНИЕ: Выполните в Supabase SQL Editor:');
                console.log(`
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on receipts" ON receipts USING (true);
                `);
            }
        } else {
            console.log('✅ Чек удален успешно!');
            
            // Проверяем, что чек действительно удален
            const { data: check } = await supabase
                .from('receipts')
                .select('id')
                .eq('id', testReceipt.id)
                .single();
            
            if (!check) {
                console.log('🎉 УДАЛЕНИЕ РАБОТАЕТ! Обновите страницу приложения.');
            } else {
                console.log('❌ Чек все еще в БД!');
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    }
}

// 3. Функция для установки переменных вручную
function setVars(url, key) {
    window.VITE_SUPABASE_URL = url;
    window.VITE_SUPABASE_ANON_KEY = key;
    console.log('✅ Переменные установлены');
    console.log('💡 Теперь запустите: testDelete()');
}

// Экспортируем функции
window.testDelete = testDelete;
window.setVars = setVars;

console.log('✅ Скрипт загружен!');
console.log('💡 Команды:');
console.log('   testDelete() - тестировать удаление');
console.log('   setVars(url, key) - установить переменные вручную');
console.log('');
console.log('🚀 Запустите: testDelete()');
