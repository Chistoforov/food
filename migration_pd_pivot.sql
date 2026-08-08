-- ============================================================================
-- Migration: PD Scraper Pivot — консолидированная миграция для нового Supabase-проекта
-- Дата: 2026-08-08
-- Контекст: план /Users/d.chistoforov/.claude/plans/tidy-moseying-valiant.md
--
-- Что делает:
--   1. Ядро приложения (families, products, receipts, product_history, monthly_stats,
--      user_profiles, family_invitations, product_name_cache, product_type_stats)
--      без калорий, image_url, receipt_language, price/unit_price в history.
--   2. Каталог Pingo Doce (catalog_products, catalog_price_history) + pg_trgm.
--   3. Все актуальные триггеры и функции (последние версии из FIX_AUTH_NO_FAIL,
--      migration_update_product_stats_function, migration_fix_early_depletion_in_cache,
--      IMPROVED_TRIGGER_WITH_AUTO_UPDATE, CREATE_UPDATE_FUNCTION_FOR_CRON).
--
-- Что НЕ переносится (сознательно, по плану pivot):
--   - pending_receipts (весь receipt-upload flow уходит)
--   - products.calories, products.price
--   - product_history.price, product_history.unit_price
--   - receipts.image_url
--   - user_profiles.receipt_language
--   - monthly_stats.total_calories, monthly_stats.avg_calories_per_day
--   - триггер recalculate_stats_on_product_update (реагировал только на калории)
--   - функция cleanup_old_pending_receipts()
--
-- НАКАТЫВАТЬ ТОЛЬКО НА ПУСТУЮ БД. Идемпотентности нет (IF NOT EXISTS/OR REPLACE
-- расставлены, но семантика на первый прогон).
-- ============================================================================

-- 0. Расширения
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. УТИЛИТА: updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. ТАБЛИЦЫ
-- ============================================================================

-- 2.1. Семьи (unit of data sharing)
CREATE TABLE families (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  member_count INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.2. Каталог Pingo Doce (source of truth для цен)
CREATE TABLE catalog_products (
  id SERIAL PRIMARY KEY,
  external_id TEXT UNIQUE NOT NULL,        -- SFCC product_id ("48149" и т.п.)
  name TEXT NOT NULL,                      -- "Leite UHT Magro"
  brand TEXT,                              -- "Pingo Doce"
  category1 TEXT,                          -- item_category (крупная категория)
  category2 TEXT,                          -- item_category2 (подкатегория)
  url TEXT,
  image_url TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true           -- false если исчез из каталога
);

CREATE INDEX idx_catalog_products_name_trgm ON catalog_products USING gin (name gin_trgm_ops);
CREATE INDEX idx_catalog_products_category2 ON catalog_products(category2);
CREATE INDEX idx_catalog_products_is_active ON catalog_products(is_active);

-- 2.3. История цен каталога
CREATE TABLE catalog_price_history (
  id SERIAL PRIMARY KEY,
  catalog_product_id INTEGER REFERENCES catalog_products(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  price_per_unit DECIMAL(10,4),            -- €/L, €/KG если указано
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (catalog_product_id, captured_at)
);

CREATE INDEX idx_catalog_price_history_product ON catalog_price_history(catalog_product_id, captured_at DESC);

-- 2.4. Продукты пользователя
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  product_type VARCHAR(255),               -- дженерик-категория для группировки
  last_purchase DATE,
  avg_days INTEGER,
  predicted_end DATE,
  status VARCHAR(20) DEFAULT 'calculating' CHECK (status IN ('ending-soon', 'ok', 'calculating')),
  purchase_count INTEGER DEFAULT 0,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_family_id ON products(family_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_product_type ON products(product_type);
CREATE INDEX idx_products_family_product_type ON products(family_id, product_type);

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.5. Чеки (из скрапера PD)
CREATE TABLE receipts (
  id SERIAL PRIMARY KEY,
  external_id TEXT UNIQUE,                 -- trNumber из PD (20 цифр) — идемпотентность
  date DATE NOT NULL,
  items_count INTEGER DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,    -- вычисляется скрапером через JOIN на price_history
  status VARCHAR(20) DEFAULT 'processed' CHECK (status IN ('processed', 'pending', 'error')),
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_receipts_family_id ON receipts(family_id);
CREATE INDEX idx_receipts_date ON receipts(date);
CREATE INDEX idx_receipts_external_id ON receipts(external_id);

-- 2.6. История покупок (позиции чеков)
CREATE TABLE product_history (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  catalog_product_id INTEGER REFERENCES catalog_products(id) ON DELETE SET NULL,  -- NULL если матч не найден
  date DATE NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,        -- дробное для KG; -1 = early depletion; 0 = virtual
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  receipt_id INTEGER REFERENCES receipts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_history_product_id ON product_history(product_id);
CREATE INDEX idx_product_history_family_id ON product_history(family_id);
CREATE INDEX idx_product_history_date ON product_history(date);
CREATE INDEX idx_product_history_receipt_id ON product_history(receipt_id);
CREATE INDEX idx_product_history_catalog_product_id ON product_history(catalog_product_id);

-- 2.7. Месячная статистика (кэш агрегатов)
CREATE TABLE monthly_stats (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  month VARCHAR(10) NOT NULL,              -- 'YYYY-MM'
  year INTEGER NOT NULL,
  total_spent DECIMAL(10,2) DEFAULT 0,
  receipts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, month, year)
);

CREATE INDEX idx_monthly_stats_family_id ON monthly_stats(family_id);
CREATE INDEX idx_monthly_stats_month ON monthly_stats(month, year);

CREATE TRIGGER update_monthly_stats_updated_at BEFORE UPDATE ON monthly_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.8. Кэш переводов названий (raw name с чека → каталог + локальное имя)
CREATE TABLE product_name_cache (
  id SERIAL PRIMARY KEY,
  original_name VARCHAR(500) NOT NULL,
  normalized_original VARCHAR(500) NOT NULL,
  translated_name VARCHAR(255) NOT NULL,
  product_type VARCHAR(255),
  catalog_product_id INTEGER REFERENCES catalog_products(id) ON DELETE SET NULL,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(normalized_original, family_id)
);

CREATE INDEX idx_product_name_cache_normalized ON product_name_cache(normalized_original, family_id);
CREATE INDEX idx_product_name_cache_family ON product_name_cache(family_id);

CREATE TRIGGER update_product_name_cache_updated_at BEFORE UPDATE ON product_name_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.9. Кэш статусов по типам продуктов
CREATE TABLE product_type_stats (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  product_type VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ending-soon', 'ok', 'calculating')),
  product_count INTEGER DEFAULT 0,
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, product_type)
);

CREATE INDEX idx_product_type_stats_family_id ON product_type_stats(family_id);
CREATE INDEX idx_product_type_stats_product_type ON product_type_stats(product_type);
CREATE INDEX idx_product_type_stats_status ON product_type_stats(status);

CREATE TRIGGER update_product_type_stats_updated_at BEFORE UPDATE ON product_type_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2.10. Профили пользователей (Supabase Auth)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  family_id INTEGER REFERENCES families(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.11. Приглашения в семью
CREATE TABLE family_invitations (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  UNIQUE(email, status)
);

-- ============================================================================
-- 3. RLS (только для таблиц с auth-контекстом)
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view invitations for their family"
  ON family_invitations FOR SELECT
  USING (family_id IN (SELECT family_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create invitations for their family"
  ON family_invitations FOR INSERT
  WITH CHECK (family_id IN (SELECT family_id FROM user_profiles WHERE id = auth.uid()));

-- ============================================================================
-- 4. ФУНКЦИИ: работа с именами (product_name_cache)
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_product_name(input_name VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
  RETURN LOWER(TRIM(REGEXP_REPLACE(input_name, '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_cached_translation(
  p_original_name VARCHAR,
  p_family_id INTEGER
)
RETURNS TABLE (
  translated_name VARCHAR,
  product_type VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT pnc.translated_name, pnc.product_type
  FROM product_name_cache pnc
  WHERE pnc.normalized_original = normalize_product_name(p_original_name)
    AND pnc.family_id = p_family_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION save_translation_cache(
  p_original_name VARCHAR,
  p_translated_name VARCHAR,
  p_product_type VARCHAR,
  p_family_id INTEGER
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO product_name_cache (
    original_name, normalized_original, translated_name, product_type, family_id, usage_count
  ) VALUES (
    p_original_name, normalize_product_name(p_original_name),
    p_translated_name, p_product_type, p_family_id, 1
  )
  ON CONFLICT (normalized_original, family_id)
  DO UPDATE SET
    usage_count = product_name_cache.usage_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ФУНКЦИЯ: пересчёт месячной статистики
-- Отличие от старой версии: total_spent считается через JOIN на catalog_price_history
-- (цена товара на дату покупки), калории убраны, receipts.total_amount игнорируется
-- (в чеках PD его нет).
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_monthly_stats(
  p_family_id INTEGER,
  p_month VARCHAR(10),
  p_year INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_total_spent DECIMAL(10,2) := 0;
  v_receipts_count INTEGER := 0;
  v_target_month INTEGER;
BEGIN
  v_target_month := EXTRACT(MONTH FROM (p_year || '-' || SPLIT_PART(p_month, '-', 2) || '-01')::DATE);

  -- Сумма трат за месяц = SUM(qty * price_on_date)
  -- Игнорируем позиции без catalog_product_id (не смогли сматчить) и с quantity <= 0
  -- (early depletion / virtual). Fallback цены: снапшот на дату или до неё; если нет —
  -- самая ранняя доступная (для бэкфилла исторических чеков).
  SELECT COALESCE(SUM(
    ph.quantity * COALESCE(
      (SELECT cph.price
         FROM catalog_price_history cph
        WHERE cph.catalog_product_id = ph.catalog_product_id
          AND cph.captured_at::date <= ph.date
        ORDER BY cph.captured_at DESC
        LIMIT 1),
      (SELECT cph.price
         FROM catalog_price_history cph
        WHERE cph.catalog_product_id = ph.catalog_product_id
        ORDER BY cph.captured_at ASC
        LIMIT 1),
      0
    )
  ), 0)
  INTO v_total_spent
  FROM product_history ph
  WHERE ph.family_id = p_family_id
    AND ph.catalog_product_id IS NOT NULL
    AND ph.quantity > 0
    AND EXTRACT(YEAR FROM ph.date) = p_year
    AND EXTRACT(MONTH FROM ph.date) = v_target_month;

  -- Количество чеков за месяц
  SELECT COUNT(*)
    INTO v_receipts_count
    FROM receipts
   WHERE family_id = p_family_id
     AND EXTRACT(YEAR FROM date) = p_year
     AND EXTRACT(MONTH FROM date) = v_target_month;

  INSERT INTO monthly_stats (family_id, month, year, total_spent, receipts_count)
  VALUES (p_family_id, p_month, p_year, v_total_spent, v_receipts_count)
  ON CONFLICT (family_id, month, year)
  DO UPDATE SET
    total_spent = EXCLUDED.total_spent,
    receipts_count = EXCLUDED.receipts_count,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Триггер: пересчитать месяц при вставке новой строки в product_history
CREATE OR REPLACE FUNCTION recalculate_stats_on_history_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_year INTEGER;
  v_month VARCHAR(10);
BEGIN
  v_year := EXTRACT(YEAR FROM NEW.date);
  v_month := v_year || '-' || LPAD(EXTRACT(MONTH FROM NEW.date)::TEXT, 2, '0');
  PERFORM recalculate_monthly_stats(NEW.family_id, v_month, v_year);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_stats_on_history_insert
  AFTER INSERT ON product_history
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_stats_on_history_insert();

-- ============================================================================
-- 6. ФУНКЦИИ: аналитика продукта (avg_days, predicted_end, status)
-- Из migration_update_product_stats_function.sql, 1:1 — не зависит от цен.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_analytics(p_product_id INTEGER, p_family_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_product_type VARCHAR(255);
  v_last_purchase DATE;
  v_history_count INTEGER;
  v_avg_days INTEGER;
  v_predicted_end DATE;
  v_status VARCHAR(20);
  v_days_since_purchase INTEGER;
  v_days_until_end INTEGER;
  v_intervals INTEGER[];
  v_prev_date DATE;
  v_curr_date DATE;
  v_days_diff INTEGER;
BEGIN
  SELECT product_type, last_purchase
    INTO v_product_type, v_last_purchase
    FROM products
   WHERE id = p_product_id AND family_id = p_family_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  IF v_product_type IS NOT NULL THEN
    SELECT COUNT(*)
      INTO v_history_count
      FROM product_history ph
      JOIN products p ON p.id = ph.product_id
     WHERE p.product_type = v_product_type
       AND p.family_id = p_family_id;
  ELSE
    SELECT COUNT(*)
      INTO v_history_count
      FROM product_history
     WHERE product_id = p_product_id
       AND family_id = p_family_id;
  END IF;

  IF v_history_count < 2 THEN
    UPDATE products
       SET status = 'calculating', avg_days = NULL, predicted_end = NULL, updated_at = NOW()
     WHERE id = p_product_id;
    RETURN;
  END IF;

  v_intervals := ARRAY[]::INTEGER[];

  IF v_product_type IS NOT NULL THEN
    FOR v_prev_date, v_curr_date IN
      SELECT LAG(ph.date) OVER (ORDER BY ph.date), ph.date
        FROM product_history ph
        JOIN products p ON p.id = ph.product_id
       WHERE p.product_type = v_product_type
         AND p.family_id = p_family_id
       ORDER BY ph.date ASC
    LOOP
      IF v_prev_date IS NOT NULL THEN
        v_days_diff := v_curr_date - v_prev_date;
        IF v_days_diff > 0 THEN
          v_intervals := array_append(v_intervals, v_days_diff);
        END IF;
      END IF;
    END LOOP;
  ELSE
    FOR v_prev_date, v_curr_date IN
      SELECT LAG(date) OVER (ORDER BY date), date
        FROM product_history
       WHERE product_id = p_product_id
         AND family_id = p_family_id
       ORDER BY date ASC
    LOOP
      IF v_prev_date IS NOT NULL THEN
        v_days_diff := v_curr_date - v_prev_date;
        IF v_days_diff > 0 THEN
          v_intervals := array_append(v_intervals, v_days_diff);
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF array_length(v_intervals, 1) IS NULL OR array_length(v_intervals, 1) = 0 THEN
    UPDATE products
       SET status = 'calculating', avg_days = NULL, predicted_end = NULL, updated_at = NOW()
     WHERE id = p_product_id;
    RETURN;
  END IF;

  SELECT ROUND(AVG(unnest)::NUMERIC)::INTEGER
    INTO v_avg_days
    FROM unnest(v_intervals);

  v_predicted_end := v_last_purchase + v_avg_days;
  v_days_since_purchase := CURRENT_DATE - v_last_purchase;
  v_days_until_end := v_predicted_end - CURRENT_DATE;

  IF v_days_since_purchase < 2 THEN
    v_status := 'ok';
  ELSIF v_days_until_end <= 2 THEN
    v_status := 'ending-soon';
  ELSE
    v_status := 'ok';
  END IF;

  UPDATE products
     SET avg_days = v_avg_days,
         predicted_end = v_predicted_end,
         status = v_status,
         updated_at = NOW()
   WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_product_analytics(INTEGER, INTEGER) IS
'Пересчитывает avg_days/predicted_end/status. Если у продукта есть product_type — берёт групповую историю.';

-- ============================================================================
-- 7. ФУНКЦИИ: кэш статусов типов (product_type_stats)
-- Финальная версия calculate_product_type_status — из migration_fix_early_depletion_in_cache.
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_product_type_status(
  p_family_id INTEGER,
  p_product_type VARCHAR(255)
) RETURNS VARCHAR(20) AS $$
DECLARE
  v_has_recent_purchase BOOLEAN := false;
  v_product_record RECORD;
  v_history_count INTEGER;
  v_avg_days DECIMAL;
  v_last_purchase_date DATE;
  v_predicted_end DATE;
  v_days_since_purchase INTEGER;
  v_days_until_end INTEGER;
  v_today DATE;
  v_last_history_quantity DECIMAL;
  v_is_early_depletion BOOLEAN := false;
BEGIN
  v_today := CURRENT_DATE;

  -- ПРИОРИТЕТ 1: досрочное окончание (последняя запись quantity = -1)
  FOR v_product_record IN
    SELECT p.id, p.last_purchase
      FROM products p
     WHERE p.family_id = p_family_id
       AND p.product_type = p_product_type
       AND p.last_purchase IS NOT NULL
  LOOP
    SELECT ph.quantity INTO v_last_history_quantity
      FROM product_history ph
     WHERE ph.product_id = v_product_record.id
       AND ph.family_id = p_family_id
     ORDER BY ph.date DESC, ph.id DESC
     LIMIT 1;

    IF v_last_history_quantity = -1 THEN
      v_is_early_depletion := true;
      EXIT;
    END IF;
  END LOOP;

  IF v_is_early_depletion THEN
    RETURN 'ending-soon';
  END IF;

  -- ПРИОРИТЕТ 2: правило 2 дней (только если не досрочное окончание)
  FOR v_product_record IN
    SELECT id, last_purchase
      FROM products
     WHERE family_id = p_family_id
       AND product_type = p_product_type
       AND last_purchase IS NOT NULL
  LOOP
    v_days_since_purchase := v_today - v_product_record.last_purchase;

    IF v_days_since_purchase < 2 THEN
      SELECT ph.quantity INTO v_last_history_quantity
        FROM product_history ph
       WHERE ph.product_id = v_product_record.id
         AND ph.family_id = p_family_id
       ORDER BY ph.date DESC, ph.id DESC
       LIMIT 1;

      IF v_last_history_quantity != -1 THEN
        v_has_recent_purchase := true;
        EXIT;
      END IF;
    END IF;
  END LOOP;

  IF v_has_recent_purchase THEN
    RETURN 'ok';
  END IF;

  -- ПРИОРИТЕТ 3: обычная логика avg_days + predicted_end
  SELECT COUNT(*) INTO v_history_count
    FROM product_history ph
    JOIN products p ON ph.product_id = p.id
   WHERE p.family_id = p_family_id
     AND p.product_type = p_product_type;

  IF v_history_count < 2 THEN
    RETURN 'calculating';
  END IF;

  WITH purchase_intervals AS (
    SELECT ph.date, LAG(ph.date) OVER (ORDER BY ph.date) AS prev_date
      FROM product_history ph
      JOIN products p ON ph.product_id = p.id
     WHERE p.family_id = p_family_id
       AND p.product_type = p_product_type
  )
  SELECT AVG(date - prev_date)::DECIMAL
    INTO v_avg_days
    FROM purchase_intervals
   WHERE prev_date IS NOT NULL AND (date - prev_date) > 0;

  IF v_avg_days IS NULL THEN
    RETURN 'calculating';
  END IF;

  SELECT MAX(last_purchase) INTO v_last_purchase_date
    FROM products
   WHERE family_id = p_family_id
     AND product_type = p_product_type;

  IF v_last_purchase_date IS NULL THEN
    RETURN 'calculating';
  END IF;

  v_predicted_end := v_last_purchase_date + v_avg_days::INTEGER;
  v_days_until_end := v_predicted_end - v_today;

  IF v_days_until_end <= 2 THEN
    RETURN 'ending-soon';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_product_type_status(INTEGER, VARCHAR) IS
'Статус типа с приоритетами: 1) любой продукт с quantity=-1 → ending-soon; 2) покупка < 2д (не -1) → ok; 3) avg_days/predicted_end.';

-- Пересчёт одного типа + синхронное обновление products.status (IMPROVED_TRIGGER)
CREATE OR REPLACE FUNCTION recalculate_single_product_type_stats(
  p_family_id INTEGER,
  p_product_type VARCHAR(255)
)
RETURNS VOID AS $$
DECLARE
  v_status VARCHAR(20);
  v_product_count INTEGER;
BEGIN
  IF p_product_type IS NULL OR p_product_type = '' THEN
    RETURN;
  END IF;

  v_status := calculate_product_type_status(p_family_id, p_product_type);

  SELECT COUNT(*) INTO v_product_count
    FROM products
   WHERE family_id = p_family_id AND product_type = p_product_type;

  IF v_product_count = 0 THEN
    DELETE FROM product_type_stats
     WHERE family_id = p_family_id AND product_type = p_product_type;
    RETURN;
  END IF;

  INSERT INTO product_type_stats (family_id, product_type, status, product_count, last_calculated)
  VALUES (p_family_id, p_product_type, v_status, v_product_count, NOW())
  ON CONFLICT (family_id, product_type)
  DO UPDATE SET
    status = EXCLUDED.status,
    product_count = EXCLUDED.product_count,
    last_calculated = NOW(),
    updated_at = NOW();

  UPDATE products
     SET status = v_status, updated_at = NOW()
   WHERE family_id = p_family_id
     AND product_type = p_product_type
     AND status != v_status;
END;
$$ LANGUAGE plpgsql;

-- Пересчёт всех типов семьи (для recalculate_family_analytics и bulk-ops)
CREATE OR REPLACE FUNCTION recalculate_product_type_stats(p_family_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_type_record RECORD;
BEGIN
  FOR v_type_record IN
    SELECT DISTINCT product_type
      FROM products
     WHERE family_id = p_family_id
       AND product_type IS NOT NULL
       AND product_type != ''
  LOOP
    PERFORM recalculate_single_product_type_stats(p_family_id, v_type_record.product_type);
  END LOOP;

  DELETE FROM product_type_stats
   WHERE family_id = p_family_id
     AND product_type NOT IN (
       SELECT DISTINCT product_type
         FROM products
        WHERE family_id = p_family_id
          AND product_type IS NOT NULL
          AND product_type != ''
     );
END;
$$ LANGUAGE plpgsql;

-- Триггер: пересчёт при INSERT/UPDATE/DELETE в products
CREATE OR REPLACE FUNCTION trigger_recalculate_product_type_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.product_type IS NOT NULL AND NEW.product_type != '' THEN
      PERFORM recalculate_single_product_type_stats(NEW.family_id, NEW.product_type);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.product_type IS DISTINCT FROM NEW.product_type THEN
    IF OLD.product_type IS NOT NULL AND OLD.product_type != '' THEN
      PERFORM recalculate_single_product_type_stats(OLD.family_id, OLD.product_type);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.product_type IS NOT NULL AND OLD.product_type != '' THEN
      PERFORM recalculate_single_product_type_stats(OLD.family_id, OLD.product_type);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_product_type_stats_on_product_change
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_product_type_stats();

-- Триггер: пересчёт всех типов семьи после обработки чека
CREATE OR REPLACE FUNCTION trigger_recalculate_product_type_stats_on_receipt()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'processed') THEN
    PERFORM recalculate_product_type_stats(NEW.family_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_product_type_stats_on_receipt_processed
  AFTER INSERT OR UPDATE ON receipts
  FOR EACH ROW
  WHEN (NEW.status = 'processed')
  EXECUTE FUNCTION trigger_recalculate_product_type_stats_on_receipt();

-- CRON-функция для ежедневного обновления статусов
CREATE OR REPLACE FUNCTION update_all_product_statuses()
RETURNS json AS $$
DECLARE
  v_family_record RECORD;
  v_type_record RECORD;
  v_total_updated INTEGER := 0;
  v_updated_count INTEGER := 0;
  v_families_count INTEGER := 0;
BEGIN
  FOR v_family_record IN
    SELECT DISTINCT family_id FROM products
  LOOP
    PERFORM recalculate_product_type_stats(v_family_record.family_id);
    v_families_count := v_families_count + 1;
  END LOOP;

  FOR v_type_record IN
    SELECT family_id, product_type, status
      FROM product_type_stats
     ORDER BY family_id, product_type
  LOOP
    UPDATE products
       SET status = v_type_record.status, updated_at = NOW()
     WHERE family_id = v_type_record.family_id
       AND product_type = v_type_record.product_type
       AND status != v_type_record.status;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    v_total_updated := v_total_updated + v_updated_count;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'families_processed', v_families_count,
    'products_updated', v_total_updated,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION update_all_product_statuses() TO anon, authenticated;

-- ============================================================================
-- 8. ФУНКЦИИ: автоудаление продуктов + пересчёт при удалении чека
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_products_without_history()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id INTEGER;
  v_history_count INTEGER;
BEGIN
  FOR v_product_id IN SELECT DISTINCT product_id FROM OLD_TABLE LOOP
    SELECT COUNT(*) INTO v_history_count
      FROM product_history WHERE product_id = v_product_id;

    IF v_history_count = 0 THEN
      DELETE FROM products WHERE id = v_product_id;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_products_after_history_delete
  AFTER DELETE ON product_history
  REFERENCING OLD TABLE AS OLD_TABLE
  FOR EACH STATEMENT
  EXECUTE FUNCTION delete_products_without_history();

CREATE OR REPLACE FUNCTION recalculate_stats_after_receipt_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_year INTEGER;
  v_month VARCHAR(10);
BEGIN
  v_year := EXTRACT(YEAR FROM OLD.date);
  v_month := v_year || '-' || LPAD(EXTRACT(MONTH FROM OLD.date)::TEXT, 2, '0');
  PERFORM recalculate_monthly_stats(OLD.family_id, v_month, v_year);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_stats_on_receipt_delete
  AFTER DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_stats_after_receipt_delete();

-- ============================================================================
-- 9. ФУНКЦИИ: полный пересчёт аналитики семьи (для RPC "Сброс кэша")
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_family_analytics(p_family_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_product_record RECORD;
  v_month_record RECORD;
BEGIN
  FOR v_product_record IN SELECT id FROM products WHERE family_id = p_family_id LOOP
    BEGIN
      PERFORM update_product_analytics(v_product_record.id, p_family_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'update_product_analytics failed for %: %', v_product_record.id, SQLERRM;
    END;
  END LOOP;

  FOR v_month_record IN
    SELECT DISTINCT
           EXTRACT(YEAR FROM date)::INTEGER as year,
           TO_CHAR(date, 'YYYY-MM') as month_str
      FROM (
        SELECT date FROM product_history WHERE family_id = p_family_id
        UNION
        SELECT date FROM receipts WHERE family_id = p_family_id
      ) dates
     ORDER BY year DESC, month_str DESC
  LOOP
    BEGIN
      PERFORM recalculate_monthly_stats(p_family_id, v_month_record.month_str, v_month_record.year);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'recalculate_monthly_stats failed for %: %', v_month_record.month_str, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalculate_all_analytics()
RETURNS VOID AS $$
DECLARE
  v_family_record RECORD;
BEGIN
  FOR v_family_record IN SELECT id FROM families WHERE is_active = true LOOP
    BEGIN
      PERFORM recalculate_family_analytics(v_family_record.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'recalculate_family_analytics failed for family %: %', v_family_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. AUTH: handle_new_user + create_my_profile
-- (bulletproof версия из FIX_AUTH_NO_FAIL.sql — не роняет транзакцию auth.users)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id INTEGER;
  v_invite_record RECORD;
  v_user_email TEXT;
BEGIN
  v_user_email := COALESCE(NEW.email, 'unknown@user.com');

  BEGIN
    BEGIN
      SELECT * INTO v_invite_record
        FROM family_invitations
       WHERE email = v_user_email AND status = 'pending'
       LIMIT 1;

      IF FOUND THEN
        v_family_id := v_invite_record.family_id;
        UPDATE family_invitations SET status = 'accepted' WHERE id = v_invite_record.id;
        UPDATE families SET member_count = member_count + 1 WHERE id = v_family_id;
      ELSE
        INSERT INTO families (name, member_count)
        VALUES ('Семья ' || SPLIT_PART(v_user_email, '@', 1), 1)
        RETURNING id INTO v_family_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'handle_new_user: fallback family selection: %', SQLERRM;
      SELECT id INTO v_family_id FROM families LIMIT 1;
      IF v_family_id IS NULL THEN
        INSERT INTO families (name, member_count) VALUES ('Fallback Family', 1)
        RETURNING id INTO v_family_id;
      END IF;
    END;

    IF v_family_id IS NOT NULL THEN
      INSERT INTO user_profiles (id, email, family_id)
      VALUES (NEW.id, v_user_email, v_family_id)
      ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email, family_id = EXCLUDED.family_id, updated_at = NOW();
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user CRITICAL (swallowed): % %', SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Self-healing RPC на случай, если триггер не отработал
CREATE OR REPLACE FUNCTION create_my_profile()
RETURNS jsonb
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_family_id INTEGER;
  v_invite_record RECORD;
  v_profile_exists BOOLEAN;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL THEN
    v_email := 'unknown@user.com';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = v_uid) INTO v_profile_exists;
  IF v_profile_exists THEN
    SELECT row_to_json(up) INTO v_result FROM public.user_profiles up WHERE id = v_uid;
    RETURN v_result;
  END IF;

  SELECT * INTO v_invite_record
    FROM public.family_invitations
   WHERE email = v_email AND status = 'pending'
   LIMIT 1;

  IF FOUND THEN
    v_family_id := v_invite_record.family_id;
    UPDATE public.family_invitations SET status = 'accepted' WHERE id = v_invite_record.id;
    UPDATE public.families SET member_count = member_count + 1 WHERE id = v_family_id;
  ELSE
    INSERT INTO public.families (name, member_count)
    VALUES ('Семья ' || SPLIT_PART(v_email, '@', 1), 1)
    RETURNING id INTO v_family_id;
  END IF;

  INSERT INTO public.user_profiles (id, email, family_id)
  VALUES (v_uid, v_email, v_family_id)
  RETURNING row_to_json(user_profiles) INTO v_result;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'create_my_profile: % %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION create_my_profile() TO authenticated;

-- ============================================================================
-- Готово. Проверка:
--   SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
--   -- ожидается 11: families, catalog_products, catalog_price_history, products,
--   --              receipts, product_history, monthly_stats, product_name_cache,
--   --              product_type_stats, user_profiles, family_invitations
--   SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
-- ============================================================================
