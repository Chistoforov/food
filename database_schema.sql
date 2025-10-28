-- Создание таблиц для Grocery Tracker App

-- Таблица семей
CREATE TABLE families (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  member_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица продуктов
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  last_purchase DATE,
  avg_days INTEGER,
  predicted_end DATE,
  status VARCHAR(20) DEFAULT 'calculating' CHECK (status IN ('ending-soon', 'ok', 'calculating')),
  calories INTEGER DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  purchase_count INTEGER DEFAULT 0,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица чеков
CREATE TABLE receipts (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  items_count INTEGER DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('processed', 'pending', 'error')),
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица истории покупок продуктов
CREATE TABLE product_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  quantity INTEGER DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Таблица месячной статистики
CREATE TABLE monthly_stats (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  month VARCHAR(10) NOT NULL, -- '2024-10'
  year INTEGER NOT NULL,
  total_spent DECIMAL(10,2) DEFAULT 0,
  total_calories INTEGER DEFAULT 0,
  avg_calories_per_day INTEGER DEFAULT 0,
  receipts_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(family_id, month, year)
);

-- Индексы для оптимизации запросов
CREATE INDEX idx_products_family_id ON products(family_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_receipts_family_id ON receipts(family_id);
CREATE INDEX idx_receipts_date ON receipts(date);
CREATE INDEX idx_product_history_product_id ON product_history(product_id);
CREATE INDEX idx_product_history_family_id ON product_history(family_id);
CREATE INDEX idx_product_history_date ON product_history(date);
CREATE INDEX idx_monthly_stats_family_id ON monthly_stats(family_id);
CREATE INDEX idx_monthly_stats_month ON monthly_stats(month, year);

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Функция для пересчета месячной статистики
CREATE OR REPLACE FUNCTION recalculate_monthly_stats(p_family_id INTEGER, p_month VARCHAR(10), p_year INTEGER)
RETURNS VOID AS $$
DECLARE
    v_total_spent DECIMAL(10,2) := 0;
    v_total_calories INTEGER := 0;
    v_avg_calories_per_day INTEGER := 0;
    v_receipts_count INTEGER := 0;
    v_days_in_month INTEGER;
BEGIN
    -- Получаем количество дней в месяце
    v_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', (p_year || '-' || p_month || '-01')::DATE) + INTERVAL '1 month - 1 day'));
    
    -- Вычисляем общую сумму потраченную в месяце
    SELECT COALESCE(SUM(total_amount), 0)
    INTO v_total_spent
    FROM receipts 
    WHERE family_id = p_family_id 
    AND EXTRACT(YEAR FROM date) = p_year 
    AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM (p_year || '-' || p_month || '-01')::DATE);
    
    -- Вычисляем общее количество калорий в месяце
    SELECT COALESCE(SUM(p.calories * ph.quantity), 0)
    INTO v_total_calories
    FROM product_history ph
    JOIN products p ON ph.product_id = p.id
    WHERE ph.family_id = p_family_id 
    AND EXTRACT(YEAR FROM ph.date) = p_year 
    AND EXTRACT(MONTH FROM ph.date) = EXTRACT(MONTH FROM (p_year || '-' || p_month || '-01')::DATE);
    
    -- Вычисляем среднее количество калорий в день
    v_avg_calories_per_day := CASE 
        WHEN v_days_in_month > 0 THEN v_total_calories / v_days_in_month 
        ELSE 0 
    END;
    
    -- Подсчитываем количество чеков
    SELECT COUNT(*)
    INTO v_receipts_count
    FROM receipts 
    WHERE family_id = p_family_id 
    AND EXTRACT(YEAR FROM date) = p_year 
    AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM (p_year || '-' || p_month || '-01')::DATE);
    
    -- Обновляем или создаем запись статистики
    INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count)
    VALUES (p_family_id, p_month, p_year, v_total_spent, v_total_calories, v_avg_calories_per_day, v_receipts_count)
    ON CONFLICT (family_id, month, year) 
    DO UPDATE SET 
        total_spent = EXCLUDED.total_spent,
        total_calories = EXCLUDED.total_calories,
        avg_calories_per_day = EXCLUDED.avg_calories_per_day,
        receipts_count = EXCLUDED.receipts_count,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Функция для пересчета статистики при изменении продукта
CREATE OR REPLACE FUNCTION recalculate_stats_on_product_change()
RETURNS TRIGGER AS $$
DECLARE
    v_family_id INTEGER;
    v_month VARCHAR(10);
    v_year INTEGER;
    v_current_date DATE;
BEGIN
    -- Получаем family_id из измененного продукта
    v_family_id := NEW.family_id;
    
    -- Получаем текущую дату
    v_current_date := CURRENT_DATE;
    v_year := EXTRACT(YEAR FROM v_current_date);
    v_month := LPAD(EXTRACT(MONTH FROM v_current_date)::TEXT, 2, '0');
    
    -- Пересчитываем статистику для текущего месяца
    PERFORM recalculate_monthly_stats(v_family_id, v_year || '-' || v_month, v_year);
    
    -- Если изменилась калорийность, пересчитываем статистику для всех месяцев, где есть покупки этого продукта
    IF OLD.calories != NEW.calories THEN
        -- Пересчитываем статистику для всех месяцев, где есть покупки этого продукта
        FOR v_year, v_month IN 
            SELECT DISTINCT 
                EXTRACT(YEAR FROM ph.date)::INTEGER,
                LPAD(EXTRACT(MONTH FROM ph.date)::TEXT, 2, '0')
            FROM product_history ph
            WHERE ph.product_id = NEW.id
        LOOP
            PERFORM recalculate_monthly_stats(v_family_id, v_year || '-' || v_month, v_year);
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Функция для пересчета статистики при добавлении новой покупки
CREATE OR REPLACE FUNCTION recalculate_stats_on_history_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_family_id INTEGER;
    v_month VARCHAR(10);
    v_year INTEGER;
BEGIN
    v_family_id := NEW.family_id;
    v_year := EXTRACT(YEAR FROM NEW.date);
    v_month := LPAD(EXTRACT(MONTH FROM NEW.date)::TEXT, 2, '0');
    
    -- Пересчитываем статистику для месяца покупки
    PERFORM recalculate_monthly_stats(v_family_id, v_year || '-' || v_month, v_year);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_stats_updated_at BEFORE UPDATE ON monthly_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Триггер для автоматического пересчета статистики при изменении продукта
CREATE TRIGGER recalculate_stats_on_product_update 
    AFTER UPDATE ON products
    FOR EACH ROW 
    EXECUTE FUNCTION recalculate_stats_on_product_change();

-- Триггер для пересчета статистики при добавлении новой покупки
CREATE TRIGGER recalculate_stats_on_history_insert
    AFTER INSERT ON product_history
    FOR EACH ROW 
    EXECUTE FUNCTION recalculate_stats_on_history_insert();

-- Вставка тестовых данных
INSERT INTO families (name, member_count) VALUES ('Моя семья', 2);
INSERT INTO families (name, member_count, is_active) VALUES ('Родители', 3, false);

-- Вставка тестовых продуктов
INSERT INTO products (name, last_purchase, avg_days, predicted_end, status, calories, price, purchase_count, family_id) VALUES
('Молоко 2L', '2024-10-21', 7, '2024-10-28', 'ending-soon', 1240, 1.89, 5, 1),
('Хлеб белый', '2024-10-25', 3, '2024-10-28', 'ending-soon', 1320, 1.25, 12, 1),
('Сникерс', '2024-10-20', 14, '2024-11-03', 'ok', 250, 0.89, 4, 1),
('Творог 500г', '2024-10-27', NULL, NULL, 'calculating', 680, 2.49, 2, 1);

-- Вставка тестовых чеков
INSERT INTO receipts (date, items_count, total_amount, status, family_id) VALUES
('2024-10-27', 5, 23.45, 'processed', 1),
('2024-10-25', 8, 45.20, 'processed', 1),
('2024-10-21', 12, 67.89, 'processed', 1);

-- Вставка истории покупок
INSERT INTO product_history (product_id, date, quantity, price, unit_price, family_id) VALUES
-- Молоко
(1, '2024-09-15', 1, 1.89, 1.89, 1),
(1, '2024-09-22', 1, 1.89, 1.89, 1),
(1, '2024-09-29', 2, 3.78, 1.89, 1),
(1, '2024-10-06', 1, 1.95, 1.95, 1),
(1, '2024-10-13', 1, 1.95, 1.95, 1),
(1, '2024-10-21', 1, 1.89, 1.89, 1),
-- Хлеб
(2, '2024-10-02', 1, 1.25, 1.25, 1),
(2, '2024-10-05', 1, 1.25, 1.25, 1),
(2, '2024-10-09', 2, 2.50, 1.25, 1),
(2, '2024-10-12', 1, 1.30, 1.30, 1),
(2, '2024-10-16', 1, 1.30, 1.30, 1),
(2, '2024-10-19', 1, 1.25, 1.25, 1),
(2, '2024-10-22', 1, 1.25, 1.25, 1),
(2, '2024-10-25', 1, 1.20, 1.20, 1),
-- Сникерс
(3, '2024-09-10', 1, 0.89, 0.89, 1),
(3, '2024-09-24', 1, 0.89, 0.89, 1),
(3, '2024-10-08', 1, 0.95, 0.95, 1),
(3, '2024-10-20', 1, 0.95, 0.95, 1),
-- Творог
(4, '2024-10-15', 1, 2.49, 2.49, 1),
(4, '2024-10-27', 1, 2.39, 2.39, 1);

-- Вставка месячной статистики
INSERT INTO monthly_stats (family_id, month, year, total_spent, total_calories, avg_calories_per_day, receipts_count) VALUES
(1, '2024-10', 2024, 456.78, 145600, 4700, 15);
