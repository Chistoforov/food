-- ============================================================================
-- Migration: recipe instructions (шаги приготовления)
-- Контекст: /Users/d.chistoforov/.claude/plans/graceful-chasing-shamir.md
--
-- Добавляет массивы шагов приготовления в recipes.
-- TEXT[] вместо отдельной таблицы — рецепт всегда открывается целиком, порядок
-- нужен, per-step запросов нет.
--
-- Идемпотентно (ADD COLUMN IF NOT EXISTS).
-- ============================================================================

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS instructions_pt TEXT[],
  ADD COLUMN IF NOT EXISTS instructions_ru TEXT[];
