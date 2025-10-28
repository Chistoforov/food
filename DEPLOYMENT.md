# Инструкции по развертыванию

## Подготовка к развертыванию

### 1. Настройка Supabase

1. **Создайте проект в Supabase:**
   - Перейдите на [supabase.com](https://supabase.com)
   - Нажмите "New Project"
   - Выберите организацию и введите название проекта
   - Выберите регион (рекомендуется ближайший к вашим пользователям)
   - Введите пароль для базы данных

2. **Получите ключи API:**
   - В Dashboard перейдите в Settings > API
   - Скопируйте:
     - Project URL
     - anon public key

3. **Настройте базу данных:**
   - Перейдите в SQL Editor
   - Скопируйте и выполните содержимое файла `database_schema.sql`
   - Проверьте, что все таблицы созданы в разделе Table Editor

### 2. Настройка переменных окружения

Создайте файл `.env.local` в корне проекта:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Настройка Row Level Security (RLS)

В SQL Editor выполните следующие команды для настройки безопасности:

```sql
-- Включаем RLS для всех таблиц
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_stats ENABLE ROW LEVEL SECURITY;

-- Политики для families (все пользователи могут читать и создавать)
CREATE POLICY "Anyone can read families" ON families FOR SELECT USING (true);
CREATE POLICY "Anyone can create families" ON families FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update families" ON families FOR UPDATE USING (true);

-- Политики для products (все пользователи могут читать и создавать)
CREATE POLICY "Anyone can read products" ON products FOR SELECT USING (true);
CREATE POLICY "Anyone can create products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update products" ON products FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete products" ON products FOR DELETE USING (true);

-- Политики для receipts (все пользователи могут читать и создавать)
CREATE POLICY "Anyone can read receipts" ON receipts FOR SELECT USING (true);
CREATE POLICY "Anyone can create receipts" ON receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update receipts" ON receipts FOR UPDATE USING (true);

-- Политики для product_history (все пользователи могут читать и создавать)
CREATE POLICY "Anyone can read product_history" ON product_history FOR SELECT USING (true);
CREATE POLICY "Anyone can create product_history" ON product_history FOR INSERT WITH CHECK (true);

-- Политики для monthly_stats (все пользователи могут читать и создавать)
CREATE POLICY "Anyone can read monthly_stats" ON monthly_stats FOR SELECT USING (true);
CREATE POLICY "Anyone can create monthly_stats" ON monthly_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update monthly_stats" ON monthly_stats FOR UPDATE USING (true);
```

## Развертывание на Vercel

### 1. Подготовка

1. Убедитесь, что код загружен в GitHub репозиторий
2. Убедитесь, что файл `.env.local` НЕ загружен в репозиторий (добавлен в `.gitignore`)

### 2. Развертывание

1. Перейдите на [vercel.com](https://vercel.com)
2. Нажмите "New Project"
3. Подключите ваш GitHub репозиторий
4. В настройках проекта добавьте переменные окружения:
   - `VITE_SUPABASE_URL` = ваш Project URL
   - `VITE_SUPABASE_ANON_KEY` = ваш anon key
5. Нажмите "Deploy"

### 3. Проверка

После развертывания:
1. Откройте ваше приложение
2. Проверьте, что данные загружаются из Supabase
3. Попробуйте создать/обновить продукт
4. Проверьте аналитику

## Развертывание на Netlify

### 1. Подготовка

1. Создайте файл `netlify.toml` в корне проекта:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"
```

### 2. Развертывание

1. Перейдите на [netlify.com](https://netlify.com)
2. Нажмите "New site from Git"
3. Подключите ваш GitHub репозиторий
4. В настройках сборки:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. В разделе Environment variables добавьте:
   - `VITE_SUPABASE_URL` = ваш Project URL
   - `VITE_SUPABASE_ANON_KEY` = ваш anon key
6. Нажмите "Deploy site"

## Развертывание на других платформах

### GitHub Pages

1. Установите `gh-pages`:
   ```bash
   npm install --save-dev gh-pages
   ```

2. Добавьте скрипты в `package.json`:
   ```json
   {
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. Запустите деплой:
   ```bash
   npm run deploy
   ```

### Firebase Hosting

1. Установите Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Инициализируйте проект:
   ```bash
   firebase init hosting
   ```

3. Настройте `firebase.json`:
   ```json
   {
     "hosting": {
       "public": "dist",
       "ignore": [
         "firebase.json",
         "**/.*",
         "**/node_modules/**"
       ],
       "rewrites": [
         {
           "source": "**",
           "destination": "/index.html"
         }
       ]
     }
   }
   ```

4. Соберите и задеплойте:
   ```bash
   npm run build
   firebase deploy
   ```

## Мониторинг и поддержка

### Логи Supabase

- Перейдите в Dashboard > Logs для просмотра логов API
- Настройте алерты для ошибок

### Мониторинг производительности

- Используйте встроенные инструменты браузера
- Настройте мониторинг в Vercel/Netlify

### Обновления

1. Обновите код в репозитории
2. Платформа автоматически пересоберет и задеплоит изменения
3. Проверьте работоспособность после обновления

## Безопасность

### Рекомендации

1. **Никогда не коммитьте переменные окружения**
2. **Используйте RLS политики для ограничения доступа**
3. **Регулярно обновляйте зависимости**
4. **Настройте мониторинг ошибок**

### Настройка аутентификации (опционально)

Если планируете добавить аутентификацию пользователей:

1. Включите Auth в Supabase Dashboard
2. Настройте провайдеров (email, Google, etc.)
3. Обновите RLS политики для использования `auth.uid()`
4. Добавьте компоненты аутентификации в приложение
