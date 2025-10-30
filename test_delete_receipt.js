/**
 * Скрипт для тестирования удаления чеков
 * 
 * Использование:
 * 1. Откройте консоль браузера (F12)
 * 2. Скопируйте и вставьте этот код
 * 3. Запустите testDeleteReceipt()
 */

// Импортируем supabase из глобального контекста или создаем клиент
async function testDeleteReceipt() {
    console.log('🧪 Начинаем тестирование удаления чека...');
    
    // Получаем настройки Supabase из переменных окружения
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    console.log('📡 Supabase URL:', SUPABASE_URL);
    console.log('🔑 Supabase Key:', SUPABASE_ANON_KEY ? 'Установлен ✅' : 'НЕ установлен ❌');
    
    // Создаем клиент Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // 1. Получаем список чеков
    console.log('\n📋 Шаг 1: Получаем список чеков...');
    const { data: receipts, error: fetchError } = await supabase
        .from('receipts')
        .select('*')
        .eq('family_id', 1)
        .order('date', { ascending: false });
    
    if (fetchError) {
        console.error('❌ Ошибка при получении чеков:', fetchError);
        return;
    }
    
    console.log(`✅ Найдено чеков: ${receipts?.length || 0}`);
    if (receipts && receipts.length > 0) {
        console.table(receipts.map(r => ({
            id: r.id,
            date: r.date,
            items: r.items_count,
            total: r.total_amount
        })));
    }
    
    if (!receipts || receipts.length === 0) {
        console.log('⚠️ Нет чеков для удаления. Создайте чек сначала.');
        return;
    }
    
    // 2. Проверяем RLS политики
    console.log('\n🔒 Шаг 2: Проверяем RLS политики...');
    const { data: policies, error: policiesError } = await supabase
        .rpc('exec_sql', {
            sql: `
                SELECT tablename, policyname, cmd
                FROM pg_policies 
                WHERE schemaname = 'public' 
                AND tablename IN ('receipts', 'product_history')
                ORDER BY tablename, policyname
            `
        })
        .catch(() => {
            console.log('⚠️ Не удалось проверить политики через RPC. Проверьте вручную в Supabase Dashboard.');
            return { data: null, error: null };
        });
    
    if (policies && policies.length > 0) {
        console.log('✅ Найдены RLS политики:');
        console.table(policies);
    } else {
        console.log('❌ RLS политики не найдены или недоступны для проверки');
        console.log('   Это может быть причиной проблемы с удалением!');
        console.log('   Выполните скрипт из файла setup_rls_policies.sql');
    }
    
    // 3. Проверяем наличие поля receipt_id в product_history
    console.log('\n🔗 Шаг 3: Проверяем связь product_history -> receipts...');
    const { data: historyWithReceipt, error: historyError } = await supabase
        .from('product_history')
        .select('id, receipt_id, date')
        .limit(1);
    
    if (historyError) {
        console.error('❌ Ошибка при проверке product_history:', historyError);
    } else if (historyWithReceipt && historyWithReceipt.length > 0) {
        if (historyWithReceipt[0].receipt_id !== undefined) {
            console.log('✅ Поле receipt_id существует в product_history');
        } else {
            console.log('❌ Поле receipt_id НЕ существует в product_history');
            console.log('   Выполните миграцию из файла migration_add_receipt_id.sql');
        }
    }
    
    // 4. Пробуем удалить первый чек
    const receiptToDelete = receipts[0];
    console.log(`\n🗑️ Шаг 4: Пробуем удалить чек #${receiptToDelete.id}...`);
    console.log('   Дата:', receiptToDelete.date);
    console.log('   Сумма:', receiptToDelete.total_amount);
    
    const confirmDelete = confirm(
        `Удалить чек от ${receiptToDelete.date} на сумму €${receiptToDelete.total_amount}?`
    );
    
    if (!confirmDelete) {
        console.log('❌ Удаление отменено пользователем');
        return;
    }
    
    // Получаем связанные записи product_history
    const { data: relatedHistory, error: relatedError } = await supabase
        .from('product_history')
        .select('id')
        .eq('receipt_id', receiptToDelete.id);
    
    if (!relatedError && relatedHistory) {
        console.log(`   Связанных записей product_history: ${relatedHistory.length}`);
    }
    
    // Удаляем чек
    const { error: deleteError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptToDelete.id);
    
    if (deleteError) {
        console.error('❌ Ошибка при удалении чека:', deleteError);
        console.log('\n📝 Возможные причины:');
        console.log('   1. Не настроены RLS политики для DELETE');
        console.log('   2. Нет прав на удаление');
        console.log('   3. Проблема с CASCADE удалением связанных записей');
        console.log('\n💡 Решение:');
        console.log('   Выполните SQL-скрипт из файла setup_rls_policies.sql');
        return;
    }
    
    console.log('✅ Чек успешно удален!');
    
    // 5. Проверяем, что чек действительно удален
    console.log('\n✓ Шаг 5: Проверяем, что чек удален из базы...');
    const { data: checkReceipt, error: checkError } = await supabase
        .from('receipts')
        .select('id')
        .eq('id', receiptToDelete.id)
        .single();
    
    if (checkError || !checkReceipt) {
        console.log('✅ Чек действительно удален из базы данных!');
    } else {
        console.log('❌ Чек все еще существует в базе данных!');
        console.log('   Это означает, что удаление не сработало на уровне БД');
        console.log('   Проверьте RLS политики в Supabase Dashboard');
    }
    
    // 6. Проверяем, что связанные записи тоже удалены
    if (relatedHistory && relatedHistory.length > 0) {
        console.log('\n🔗 Шаг 6: Проверяем удаление связанных записей...');
        const { data: checkHistory, error: checkHistoryError } = await supabase
            .from('product_history')
            .select('id')
            .eq('receipt_id', receiptToDelete.id);
        
        if (!checkHistoryError) {
            if (checkHistory && checkHistory.length === 0) {
                console.log('✅ Все связанные записи product_history удалены (CASCADE работает)');
            } else {
                console.log(`⚠️ Осталось ${checkHistory?.length || 0} записей product_history`);
                console.log('   CASCADE может не работать правильно');
            }
        }
    }
    
    console.log('\n🎉 Тестирование завершено!');
    console.log('\n📊 Итоговый результат:');
    
    const allGood = !deleteError && (!checkReceipt || checkError);
    
    if (allGood) {
        console.log('✅ Удаление работает корректно!');
        console.log('   Обновите страницу, чтобы увидеть изменения в UI');
    } else {
        console.log('❌ Удаление НЕ работает');
        console.log('\n📝 Следующие шаги:');
        console.log('   1. Откройте Supabase Dashboard');
        console.log('   2. Перейдите в SQL Editor');
        console.log('   3. Выполните скрипт из файла setup_rls_policies.sql');
        console.log('   4. Попробуйте удалить чек снова');
    }
}

// Экспортируем функцию для использования в консоли
window.testDeleteReceipt = testDeleteReceipt;

console.log('✅ Скрипт тестирования загружен!');
console.log('💡 Запустите: testDeleteReceipt()');

