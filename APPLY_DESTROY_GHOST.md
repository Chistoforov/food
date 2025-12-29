# Уничтожение "Призрака"

Судя по вашему скриншоту, функции `handle_new_user_v3` чиста. Но ошибка остается. Это значит, что в базе данных где-то спряталась **другая функция** (с другим именем), которая содержит старый код с ошибкой "Database error saving new user".

Мы найдем её и удалим по тексту ошибки.

### Инструкция

1. Откройте **SQL Editor** в Supabase.
2. Скопируйте и выполните код ниже.

```sql
-- FIND AND DESTROY SCRIPT
-- 1. Находим любую функцию, которая содержит текст ошибки, и удаляем её
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT n.nspname, p.proname 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.prosrc ILIKE '%Database error saving new user%'
    LOOP
        RAISE NOTICE 'Найдена функция-виновник: %.%', r.nspname, r.proname;
        -- Удаляем её вместе со всеми связями (CASCADE)
        EXECUTE 'DROP FUNCTION ' || r.nspname || '.' || r.proname || '() CASCADE';
        RAISE NOTICE 'Уничтожена %.%', r.nspname, r.proname;
    END LOOP;
END $$;

-- 2. Убеждаемся, что триггер смотрит на V3
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_v3();
```

После выполнения посмотрите в **Results** или **Messages**. Если скрипт напишет "Найдена функция-виновник...", значит мы поймали проблему.
Попробуйте войти снова.




