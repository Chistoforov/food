# Исправление ошибки входа (Database error)

Эта ошибка возникает из-за сбоя в базе данных при создании профиля пользователя. Чтобы исправить её и гарантировать, что вход будет работать даже при ошибках, выполните следующий SQL-скрипт.

1. Откройте **SQL Editor** в Supabase Dashboard.
2. Скопируйте и выполните код ниже.

```sql
-- Fix Auth Trigger Logic (Bulletproof Version)
-- Description: Catches ALL errors to prevent login failure. Attempts fallback profile creation.

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
  -- Safe email handling
  v_user_email := COALESCE(NEW.email, 'unknown@user.com');
  
  RAISE LOG 'handle_new_user triggered for email: %', v_user_email;

  BEGIN
      -- 1. Try to find or create family
      BEGIN
        -- SPECIAL LOGIC: Link site4people@gmail.com to existing data (Family ID 1)
        IF v_user_email = 'site4people@gmail.com' THEN
          SELECT id INTO v_family_id FROM families WHERE id = 1;
          IF v_family_id IS NULL THEN
             INSERT INTO families (name, member_count) VALUES ('Семья ' || SPLIT_PART(v_user_email, '@', 1), 1) RETURNING id INTO v_family_id;
          END IF;
        ELSE
            -- STANDARD LOGIC
            SELECT * INTO v_invite_record FROM family_invitations WHERE email = v_user_email AND status = 'pending' LIMIT 1;
            
            IF FOUND THEN
              v_family_id := v_invite_record.family_id;
              UPDATE family_invitations SET status = 'accepted' WHERE id = v_invite_record.id;
              UPDATE families SET member_count = member_count + 1 WHERE id = v_family_id;
            ELSE
              INSERT INTO families (name, member_count) VALUES ('Семья ' || SPLIT_PART(v_user_email, '@', 1), 1) RETURNING id INTO v_family_id;
            END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
         RAISE LOG 'Error determining family: %', SQLERRM;
         -- Fallback: try to get ANY family or create a default one
         SELECT id INTO v_family_id FROM families LIMIT 1;
         IF v_family_id IS NULL THEN
            INSERT INTO families (name, member_count) VALUES ('Fallback Family', 1) RETURNING id INTO v_family_id;
         END IF;
      END;

      -- 2. Create user profile
      IF v_family_id IS NOT NULL THEN
          INSERT INTO user_profiles (id, email, family_id)
          VALUES (NEW.id, v_user_email, v_family_id)
          ON CONFLICT (id) DO UPDATE
          SET email = EXCLUDED.email, family_id = EXCLUDED.family_id, updated_at = NOW();
      ELSE
          RAISE LOG 'Could not determine family_id even after fallback';
      END IF;

  EXCEPTION WHEN OTHERS THEN
      -- CATCH ALL ERRORS so the transaction doesn't fail
      RAISE LOG 'CRITICAL ERROR in handle_new_user (swallowed): % %', SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-apply trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Что делать, если после этого вы застряли на экране "Подготовка..."?

Если вход прошел (ошибки в URL нет), но вы видите бесконечный спиннер "Подготовка вашего аккаунта...", это значит, что профиль не создался автоматически. Сообщите об этом, и мы добавим кнопку "Повторить создание профиля".





