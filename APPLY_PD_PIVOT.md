# Миграция: PD Scraper Pivot (консолидированная схема нового проекта)

Файл: `migration_pd_pivot.sql`
Дата: 2026-08-08
План: `/Users/d.chistoforov/.claude/plans/tidy-moseying-valiant.md`

## Что накатывается

Ядро приложения + каталог Pingo Doce в **пустой** Supabase-проект.

**11 таблиц:** `families`, `catalog_products`, `catalog_price_history`, `products`, `receipts`, `product_history`, `monthly_stats`, `product_name_cache`, `product_type_stats`, `user_profiles`, `family_invitations`.

**Расширения:** `pg_trgm` (для fuzzy-match «raw name с чека → каталог»).

**Функции:** `update_updated_at_column`, `normalize_product_name`, `get_cached_translation`, `save_translation_cache`, `recalculate_monthly_stats`, `recalculate_stats_on_history_insert`, `update_product_analytics`, `calculate_product_type_status`, `recalculate_single_product_type_stats`, `recalculate_product_type_stats`, `trigger_recalculate_product_type_stats`, `trigger_recalculate_product_type_stats_on_receipt`, `update_all_product_statuses`, `delete_products_without_history`, `recalculate_stats_after_receipt_delete`, `recalculate_family_analytics`, `recalculate_all_analytics`, `handle_new_user`, `create_my_profile`.

**Триггеры:** updated_at на families/products/monthly_stats/product_name_cache/product_type_stats, автопересчёт monthly_stats при insert в product_history, автоудаление продуктов без истории, автопересчёт при удалении чека, авто-статусы типов при изменении products/receipts, auth-триггер на auth.users.

**RLS:** только на `user_profiles` и `family_invitations` (как в прошлой версии).

## Отличия от старой схемы (что вырезано)

| Убрано | Почему |
|---|---|
| `pending_receipts` | receipt-upload flow целиком уходит |
| `products.calories`, `monthly_stats.total_calories`, `avg_calories_per_day` | калорий больше не считаем |
| `products.price` | текущая цена — из `catalog_products` + `catalog_price_history` |
| `product_history.price`, `unit_price` | вычисляется JOIN'ом на `catalog_price_history` |
| `receipts.image_url` | скрапер не сохраняет картинку чека |
| `user_profiles.receipt_language` | выбора языка чека больше нет |
| Триггер `recalculate_stats_on_product_update` | реагировал только на изменение калорий |
| Функция `cleanup_old_pending_receipts` | вместе с pending_receipts |
| Спец-логика `handle_new_user` для `site4people@gmail.com` (family_id=1) | БД пустая, привязки к старой семье не нужно |

## Отличия от старой схемы (что добавлено / изменено)

- `receipts.external_id TEXT UNIQUE` — `trNumber` из PD, идемпотентность синка чеков.
- `product_history.catalog_product_id INTEGER REFERENCES catalog_products(id) ON DELETE SET NULL` — связь позиции чека с каталогом, для цены на дату покупки.
- `product_name_cache.catalog_product_id` — сохранённый результат матчинга, чтобы не гонять pg_trgm повторно.
- `catalog_products` + GIN `pg_trgm` индекс по `name`.
- `catalog_price_history` (snapshot цены при изменении).
- `recalculate_monthly_stats` переписан: `total_spent = SUM(qty * price_on_date)` через JOIN на `catalog_price_history` (fallback: ближайший available snapshot, потом самый ранний, потом 0). `receipts.total_amount` больше НЕ используется — в чеках PD его нет.

## Применение

### Способ 1 (рекомендуется): через Supabase MCP

Убедиться, что `mcp__supabase__*` тулы доступны в текущей сессии Claude Code. Если нет — перезапустить сессию (после `claude mcp add supabase --project-ref=<ref> --SUPABASE_ACCESS_TOKEN=<token>`).

```
mcp__supabase__list_tables            # проверить, что БД пустая
mcp__supabase__apply_migration        # прогнать migration_pd_pivot.sql целиком
mcp__supabase__list_tables            # verify: 11 таблиц
```

### Способ 2 (fallback): через Supabase Dashboard

1. https://app.supabase.com → выбрать новый проект (создан 2026-08-08).
2. SQL Editor → New query.
3. Скопировать содержимое `migration_pd_pivot.sql` → Run.
4. Ожидается: `Success. No rows returned` (либо серия NOTICE).

## Проверка после наката

```sql
-- 1. Расширение
SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
-- ожидается: 1 строка

-- 2. Таблицы (11 штук)
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- ожидается: catalog_price_history, catalog_products, families,
--            family_invitations, monthly_stats, product_history,
--            product_name_cache, product_type_stats, products,
--            receipts, user_profiles

-- 3. Ключевые функции
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'handle_new_user', 'create_my_profile',
    'recalculate_monthly_stats', 'update_product_analytics',
    'calculate_product_type_status', 'update_all_product_statuses',
    'recalculate_family_analytics'
  )
ORDER BY routine_name;
-- ожидается: 7 строк

-- 4. GIN pg_trgm индекс
SELECT indexname FROM pg_indexes
WHERE indexname = 'idx_catalog_products_name_trgm';
-- ожидается: 1 строка

-- 5. RLS
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_profiles', 'family_invitations');
-- ожидается: обе с rowsecurity = true

-- 6. Триггер на auth.users
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- ожидается: 1 строка
```

## Откат

Если что-то пошло не так и БД реально пустая (нет production-данных):

```sql
-- Полный сброс public-схемы (ОСТОРОЖНО: сносит всё)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres;
```

Также удалить триггер с auth.users отдельно (он не в public):
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

## Дальнейшие шаги (не входят в эту миграцию)

1. Скрапер `scraper/` — `pd-client.ts` → `catalog-sync.ts` → `orders-sync.ts` → бэкфилл 176 чеков.
2. Env для скрапера на VPS: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (обход RLS), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `PD_FAMILY_ID`.
3. Чистка UI и Vercel serverless (упоминается в плане; отдельные фиксы).
