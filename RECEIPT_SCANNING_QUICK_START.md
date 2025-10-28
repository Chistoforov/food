# Quick Start: Receipt Scanning

## Для пользователей

### Как сканировать чек

1. **Откройте приложение** и перейдите во вкладку **"Чек"** (иконка камеры)

2. **Сфотографируйте чек** или выберите фото:
   - Нажмите **"Камера"** чтобы сделать фото
   - Нажмите **"Галерея"** чтобы выбрать существующее фото

3. **Подождите** 5-15 секунд пока AI обрабатывает чек

4. **Готово!** Все продукты автоматически добавлены в ваш список

### Советы для лучших результатов

✅ **Рекомендуется:**
- Хорошее освещение
- Чек полностью в кадре
- Чек на плоской поверхности
- Четкое изображение (без размытия)

❌ **Избегайте:**
- Темные или размытые фото
- Мятые или поврежденные чеки
- Частично обрезанные чеки

### Что делает AI

AI автоматически извлекает:
- 🏷️ Названия продуктов
- 📦 Количество (кг, л, шт)
- 💰 Цены
- 🔥 Калории для **полного купленного объема**
- 📅 Дату покупки

### Пример

**Ваш чек:**
```
Молоко 3.2% 1L    €1.89
Хлеб белый        €1.25
Творог 500г       €2.49
-------------------------
ИТОГО:            €5.63
```

**Результат в приложении:**
- Молоко 3.2% 1L → 1 л → €1.89 → 620 ккал (для 1000мл)
- Хлеб белый → 1 шт → €1.25 → 1200 ккал (для всей буханки)
- Творог 500г → 0.5 кг → €2.49 → 680 ккал (для 500г)

## Для разработчиков

### Быстрая интеграция

```typescript
import { parseReceiptImage } from './services/perplexityService';
import { SupabaseService } from './services/supabaseService';

// 1. Parse receipt image
const parsedReceipt = await parseReceiptImage(imageFile);

// 2. Process and save to database
await SupabaseService.processReceipt(
  familyId,
  parsedReceipt.items,
  parsedReceipt.total,
  parsedReceipt.date || new Date().toISOString().split('T')[0]
);

// 3. Done! Data is now in your database
```

### API Response Format

```typescript
interface ParsedReceipt {
  items: Array<{
    name: string;      // "Молоко 3.2% 1L"
    quantity: number;  // 1
    unit: string;      // "л"
    price: number;     // 1.89
    calories: number;  // 620 (for full quantity)
  }>;
  total: number;       // 5.63
  date?: string;       // "2024-10-28"
}
```

### Environment Setup

The Perplexity API key is currently hardcoded in `perplexityService.ts`.

For production, move it to environment variables:

```env
# .env.local
VITE_PERPLEXITY_API_KEY=your_api_key_here
```

```typescript
// perplexityService.ts
const PERPLEXITY_API_KEY = import.meta.env.VITE_PERPLEXITY_API_KEY;
```

### Testing

Use the mock function for testing without API calls:

```typescript
import { parseReceiptImageMock } from './services/perplexityService';

// Returns sample data instantly
const mockReceipt = await parseReceiptImageMock(imageFile);
```

### Error Handling

The service includes comprehensive error handling:

```typescript
try {
  const receipt = await parseReceiptImage(file);
  // Success handling
} catch (error) {
  if (error instanceof Error) {
    console.error('Parsing error:', error.message);
  }
  // Error handling
}
```

Common errors:
- Invalid file type
- File too large (>10MB)
- Network/API errors
- Invalid JSON response

## Технические детали

### Архитектура

```
User selects image
       ↓
Input validation
       ↓
Convert to base64
       ↓
Perplexity API call
       ↓
Parse JSON response
       ↓
Create/update products
       ↓
Add purchase history
       ↓
Update statistics
       ↓
Show success message
```

### Database Updates

При обработке чека обновляются:

1. **`receipts`** - новый чек
2. **`products`** - создание/обновление продуктов
3. **`product_history`** - запись каждой покупки
4. **`monthly_stats`** - пересчет статистики

### Performance

- Image conversion: ~100-500ms
- API call: ~5-15s
- Database operations: ~1-2s
- **Total: ~6-18s**

## FAQ

**Q: Почему обработка занимает так много времени?**
A: AI анализирует изображение и распознает текст, цены и продукты. Это сложная операция.

**Q: Можно ли редактировать распознанные данные?**
A: В текущей версии - нет. Но вы можете редактировать калорийность продуктов во вкладке "Продукты".

**Q: Что если AI ошибся?**
A: Перейдите во вкладку "Продукты" и отредактируйте данные вручную.

**Q: Сохраняются ли фото чеков?**
A: Нет, в текущей версии сохраняются только распознанные данные.

**Q: Работает ли офлайн?**
A: Нет, требуется подключение к интернету для работы AI.

## Поддержка

Проблемы? См. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) или [RECEIPT_SCANNING.md](./RECEIPT_SCANNING.md)

---

**Версия:** 1.0.0  
**Дата:** October 2024  
**Статус:** Production Ready ✅

