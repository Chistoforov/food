/**
 * Скрипт для автоматического исправления RLS политик pending_receipts
 * 
 * ИНСТРУКЦИЯ:
 * 1. Откройте консоль браузера на вашем сайте (F12)
 * 2. Скопируйте и вставьте этот код
 * 3. Запустите: applyPendingReceiptsFix()
 */

async function applyPendingReceiptsFix() {
    console.log('🔧 Начинаем исправление RLS политик для pending_receipts...');
    
    // Получаем Supabase клиент из глобального контекста
    const { createClient } = window.supabase || {};
    
    if (!createClient) {
        console.error('❌ Supabase клиент не найден!');
        console.log('💡 Убедитесь, что вы на странице приложения с загруженным Supabase');
        return;
    }
    
    const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('❌ Переменные окружения не найдены!');
        console.log('💡 Попробуйте способ через SQL Editor в Supabase Dashboard');
        return;
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    console.log('\n📝 SQL скрипт для выполнения через Supabase Dashboard:');
    console.log('=' .repeat(60));
    
    const sqlScript = `
-- Удаляем существующие политики
DROP POLICY IF EXISTS "Users can view their family's pending receipts" ON pending_receipts;
DROP POLICY IF EXISTS "Users can insert pending receipts for their family" ON pending_receipts;
DROP POLICY IF EXISTS "Users can update their family's pending receipts" ON pending_receipts;

-- Создаем правильные политики (как в других таблицах)

-- Разрешаем чтение всех pending_receipts
CREATE POLICY "Allow read access to all pending receipts" ON pending_receipts
    FOR SELECT
    USING (true);

-- Разрешаем вставку новых pending_receipts
CREATE POLICY "Allow insert access to pending receipts" ON pending_receipts
    FOR INSERT
    WITH CHECK (true);

-- Разрешаем обновление pending_receipts
CREATE POLICY "Allow update access to pending receipts" ON pending_receipts
    FOR UPDATE
    USING (true);

-- Разрешаем удаление pending_receipts
CREATE POLICY "Allow delete access to pending receipts" ON pending_receipts
    FOR DELETE
    USING (true);
`;
    
    console.log(sqlScript);
    console.log('=' .repeat(60));
    
    console.log('\n📋 ИНСТРУКЦИЯ:');
    console.log('1. Откройте https://app.supabase.com');
    console.log('2. Выберите ваш проект');
    console.log('3. Перейдите в SQL Editor (слева в меню)');
    console.log('4. Нажмите "New Query"');
    console.log('5. Скопируйте SQL выше и вставьте в редактор');
    console.log('6. Нажмите "Run" или Ctrl/Cmd + Enter');
    console.log('\n✅ После выполнения ошибка "row-level security policy" исчезнет!');
    
    // Проверяем текущие политики
    console.log('\n🔍 Проверяем текущие политики...');
    try {
        const { data: policies, error } = await supabase
            .from('pg_policies')
            .select('*')
            .eq('tablename', 'pending_receipts');
        
        if (error) {
            console.log('⚠️  Не удалось проверить политики (это нормально для anon ключа)');
        } else if (policies) {
            console.log('📊 Текущие политики:', policies);
        }
    } catch (e) {
        console.log('⚠️  Проверка политик недоступна с клиентским ключом');
    }
}

// Автоматически выводим инструкцию
console.log('');
console.log('🚀 Скрипт для исправления RLS политик загружен!');
console.log('');
console.log('Запустите:  applyPendingReceiptsFix()');
console.log('');

