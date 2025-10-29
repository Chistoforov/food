-- Добавление поля receipt_id в таблицу product_history для связи с чеками
-- Это позволит удалять все покупки продуктов при удалении чека

-- Добавляем поле receipt_id в таблицу product_history
ALTER TABLE product_history 
ADD COLUMN receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE;

-- Создаем индекс для быстрого поиска по receipt_id
CREATE INDEX idx_product_history_receipt_id ON product_history(receipt_id);

-- Функция для автоматического пересчета статистики при удалении записей из product_history
CREATE OR REPLACE FUNCTION recalculate_stats_on_history_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_family_id INTEGER;
    v_month VARCHAR(10);
    v_year INTEGER;
BEGIN
    v_family_id := OLD.family_id;
    v_year := EXTRACT(YEAR FROM OLD.date);
    v_month := LPAD(EXTRACT(MONTH FROM OLD.date)::TEXT, 2, '0');
    
    -- Пересчитываем статистику для месяца удаленной покупки
    PERFORM recalculate_monthly_stats(v_family_id, v_year || '-' || v_month, v_year);
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Триггер для пересчета статистики при удалении записей из product_history
CREATE TRIGGER recalculate_stats_on_history_delete_trigger
    AFTER DELETE ON product_history
    FOR EACH ROW 
    EXECUTE FUNCTION recalculate_stats_on_history_delete();

-- Комментарии к изменениям
COMMENT ON COLUMN product_history.receipt_id IS 'Связь с чеком, при удалении чека все связанные покупки удаляются автоматически (CASCADE)';
COMMENT ON TRIGGER recalculate_stats_on_history_delete_trigger ON product_history IS 'Автоматически пересчитывает месячную статистику при удалении покупок';

