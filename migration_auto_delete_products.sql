-- Миграция: Автоматическое удаление товаров при удалении чеков
-- Описание: При удалении чека удаляются все записи product_history (CASCADE уже настроен)
--           и товары, у которых больше не осталось истории покупок

-- Функция для удаления товаров без истории покупок
CREATE OR REPLACE FUNCTION delete_products_without_history()
RETURNS TRIGGER AS $$
DECLARE
    v_product_id INTEGER;
    v_history_count INTEGER;
BEGIN
    -- Проходим по всем продуктам из удаленных записей product_history
    FOR v_product_id IN 
        SELECT DISTINCT product_id 
        FROM OLD_TABLE
    LOOP
        -- Проверяем, осталась ли история покупок для этого продукта
        SELECT COUNT(*) INTO v_history_count
        FROM product_history
        WHERE product_id = v_product_id;
        
        -- Если истории не осталось, удаляем продукт
        IF v_history_count = 0 THEN
            DELETE FROM products WHERE id = v_product_id;
            RAISE NOTICE 'Удален продукт #% (больше нет истории покупок)', v_product_id;
        END IF;
    END LOOP;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Удаляем старый триггер, если существует
DROP TRIGGER IF EXISTS cleanup_products_after_history_delete ON product_history;

-- Создаем триггер AFTER DELETE на product_history
-- Используем REFERENCING OLD TABLE для доступа ко всем удаленным строкам
CREATE TRIGGER cleanup_products_after_history_delete
    AFTER DELETE ON product_history
    REFERENCING OLD TABLE AS OLD_TABLE
    FOR EACH STATEMENT
    EXECUTE FUNCTION delete_products_without_history();

-- Функция для пересчета статистики после удаления чека
CREATE OR REPLACE FUNCTION recalculate_stats_after_receipt_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_year INTEGER;
    v_month VARCHAR(10);
BEGIN
    -- Получаем год и месяц удаленного чека
    v_year := EXTRACT(YEAR FROM OLD.date);
    v_month := LPAD(EXTRACT(MONTH FROM OLD.date)::TEXT, 2, '0');
    
    -- Пересчитываем статистику для месяца удаленного чека
    PERFORM recalculate_monthly_stats(OLD.family_id, v_month, v_year);
    
    RAISE NOTICE 'Пересчитана статистика за %-% после удаления чека #%', v_year, v_month, OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Удаляем старый триггер, если существует
DROP TRIGGER IF EXISTS recalculate_stats_on_receipt_delete ON receipts;

-- Создаем триггер для пересчета статистики при удалении чека
CREATE TRIGGER recalculate_stats_on_receipt_delete
    AFTER DELETE ON receipts
    FOR EACH ROW
    EXECUTE FUNCTION recalculate_stats_after_receipt_delete();

-- Комментарии для понимания работы системы
COMMENT ON FUNCTION delete_products_without_history() IS 
'Автоматически удаляет товары, у которых больше не осталось истории покупок после удаления чека';

COMMENT ON FUNCTION recalculate_stats_after_receipt_delete() IS 
'Автоматически пересчитывает месячную статистику после удаления чека';

-- Проверка настроек CASCADE в product_history (должно быть уже настроено)
-- Если нет, раскомментируйте следующие строки:

-- ALTER TABLE product_history 
-- DROP CONSTRAINT IF EXISTS product_history_receipt_id_fkey;

-- ALTER TABLE product_history
-- ADD CONSTRAINT product_history_receipt_id_fkey
-- FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE;

-- Успешное завершение
DO $$
BEGIN
    RAISE NOTICE '✅ Миграция успешно применена!';
    RAISE NOTICE '📝 Теперь при удалении чека:';
    RAISE NOTICE '   1. Удаляются записи из product_history (CASCADE)';
    RAISE NOTICE '   2. Удаляются товары без истории покупок (триггер)';
    RAISE NOTICE '   3. Пересчитывается статистика за месяц (триггер)';
END $$;

