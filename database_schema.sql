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

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_stats_updated_at BEFORE UPDATE ON monthly_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
