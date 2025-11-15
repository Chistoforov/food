# Оптимизация: Двухэтапная обработка чеков для экономии токенов AI

## Проблема текущей реализации

**Сейчас:**
1. AI переводит ВСЕ товары на чеке (тратит токены)
2. Мы проверяем кэш ПОСЛЕ перевода
3. Если товар был в кэше, используем кэш, но токены уже потрачены впустую

**Недостаток:** Нет экономии на API токенах

---

## Решение: Двухэтапная обработка

### Этап 1: Извлечение оригинальных названий (ЛЕГКИЙ запрос)

```javascript
// Промпт для Этапа 1 (быстрый и дешевый)
const extractOnlyNamesPrompt = `
Извлеки из этого чека только оригинальные названия товаров в формате JSON:

{
  "items": [
    {
      "originalName": "точное название с чека"
    }
  ]
}

Не переводи, не добавляй калории - только названия как написано!
`;

// Отправляем чек в AI
const extractedItems = await perplexityAPI(image, extractOnlyNamesPrompt);
// Результат: [{ originalName: "MILK 1L" }, { originalName: "BREAD" }, ...]
```

### Этап 2: Проверка кэша и перевод только новых

```javascript
// Проверяем каждое название в кэше
const itemsToTranslate = [];
const cachedItems = [];

for (const item of extractedItems.items) {
  const cached = await getCachedTranslation(item.originalName, familyId);
  
  if (cached) {
    // Товар в кэше - используем сохраненный перевод
    cachedItems.push({
      originalName: item.originalName,
      name: cached.translated_name,
      productType: cached.product_type,
      // Детали (цена, количество) возьмем позже из чека
    });
  } else {
    // Товара нет в кэше - нужен перевод
    itemsToTranslate.push(item.originalName);
  }
}

// Если есть товары без перевода - отправляем только их в AI
if (itemsToTranslate.length > 0) {
  const translatePrompt = `
  Переведи эти товары на русский и определи категории:
  ${itemsToTranslate.join(', ')}
  
  Верни JSON: [{ "originalName": "...", "name": "...", "productType": "..." }]
  `;
  
  const newTranslations = await perplexityAPI(translatePrompt);
  
  // Сохраняем новые переводы в кэш
  for (const translation of newTranslations) {
    await saveCachedTranslation(
      translation.originalName,
      translation.name,
      translation.productType,
      familyId
    );
  }
}
```

### Этап 3: Извлечение деталей (цены, количество, калории)

```javascript
// Теперь извлекаем детали для ВСЕХ товаров
// У нас уже есть все переводы (из кэша или новые от AI)
const allItems = [...cachedItems, ...newTranslations];

const detailsPrompt = `
Для этих товаров извлеки цены, количество и калории:
${allItems.map(i => i.originalName).join(', ')}

Верни JSON: [{
  "originalName": "...",
  "quantity": число,
  "price": цена,
  "calories": калории для полного количества
}]
`;

const details = await perplexityAPI(image, detailsPrompt);

// Объединяем переводы с деталями
const finalItems = allItems.map(item => ({
  ...item,
  ...details.find(d => d.originalName === item.originalName)
}));
```

---

## Экономия токенов

### Пример: Чек с 10 товарами, 8 из них уже в кэше

**Текущая реализация:**
- 1 запрос: перевести + извлечь детали для 10 товаров
- Токены: ~2000 (полная обработка 10 товаров)
- Результат: 8 переводов выброшены (были в кэше)

**Оптимизированная реализация:**
- Запрос 1: извлечь только названия (10 товаров) → ~300 токенов
- Кэш: найдено 8 товаров
- Запрос 2: перевести только 2 новых товара → ~200 токенов
- Запрос 3: извлечь детали для 10 товаров → ~800 токенов
- **Итого: ~1300 токенов (экономия 35%)**

С ростом кэша экономия растет:
- 50% товаров в кэше → экономия ~25-30%
- 80% товаров в кэше → экономия ~40-50%
- 95% товаров в кэше → экономия ~60-70%

---

## Упрощенный вариант: Один умный запрос

Альтернатива без множественных запросов - включить в промпт список известных товаров:

```javascript
// Сначала извлечь названия (легкий запрос)
const names = await extractNamesOnly(image);

// Проверить кэш
const knownProducts = {};
for (const name of names) {
  const cached = await getCachedTranslation(name, familyId);
  if (cached) {
    knownProducts[name] = {
      translation: cached.translated_name,
      type: cached.product_type
    };
  }
}

// Один умный запрос с известными переводами
const smartPrompt = `
Проанализируй чек и извлеки продукты.

ИЗВЕСТНЫЕ ПЕРЕВОДЫ (используй их без изменений):
${Object.entries(knownProducts).map(([orig, trans]) => 
  `"${orig}" → "${trans.translation}" (${trans.type})`
).join('\n')}

ДЛЯ ОСТАЛЬНЫХ товаров - переведи сам.

Верни JSON со всеми товарами...
`;

const result = await perplexityAPI(image, smartPrompt);
```

**Преимущества:**
- ✅ Только 2 запроса (извлечь названия + полная обработка)
- ✅ AI использует кэшированные переводы
- ✅ Меньше токенов для переводов известных товаров
- ✅ Проще в реализации

**Недостатки:**
- ⚠️ AI может всё равно перевести по-своему (игнорируя подсказки)
- ⚠️ Нужно тестировать надежность

---

## Реализация в коде

### Обновленный `parseReceiptWithPerplexity()` в `process-receipt.js`

```javascript
/**
 * Stage 1: Extract original names only (lightweight)
 */
async function extractOriginalNames(imageUrl) {
  const prompt = `Извлеки из чека только оригинальные названия товаров.
Верни JSON: { "items": [{ "originalName": "название" }] }
Не переводи, только точные названия как написано!`;

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }],
      temperature: 0.1,
      max_tokens: 500  // Меньше токенов - быстрее и дешевле
    })
  });

  const data = await response.json();
  const text = data.choices[0].message.content;
  return JSON.parse(cleanJsonResponse(text));
}

/**
 * Stage 2: Translate only items not in cache
 */
async function translateNewItems(originalNames, familyId) {
  const toTranslate = [];
  const cached = {};

  // Check cache
  for (const name of originalNames) {
    const cachedItem = await getCachedTranslation(name, familyId);
    if (cachedItem) {
      cached[name] = cachedItem;
      console.log(`✅ Using cache: "${name}" → "${cachedItem.translated_name}"`);
    } else {
      toTranslate.push(name);
    }
  }

  // Translate new items if any
  const translations = {};
  if (toTranslate.length > 0) {
    console.log(`🔄 Translating ${toTranslate.length} new items...`);
    
    const prompt = `Переведи товары на русский и определи категории:
${toTranslate.join('\n')}

Верни JSON: {
  "translations": [
    { "originalName": "...", "translatedName": "...", "productType": "..." }
  ]
}`;

    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    const result = JSON.parse(cleanJsonResponse(data.choices[0].message.content));
    
    // Save to cache and build translations map
    for (const item of result.translations) {
      translations[item.originalName] = {
        translated_name: item.translatedName,
        product_type: item.productType
      };
      
      await saveCachedTranslation(
        item.originalName,
        item.translatedName,
        item.productType,
        familyId
      );
      console.log(`📝 Cached: "${item.originalName}" → "${item.translatedName}"`);
    }
  }

  // Combine cached and new translations
  return { ...cached, ...translations };
}

/**
 * Stage 3: Extract details (price, quantity, calories) with known translations
 */
async function extractDetailsWithTranslations(imageUrl, translations) {
  const knownItems = Object.entries(translations)
    .map(([orig, trans]) => `"${orig}" = "${trans.translated_name}" (${trans.product_type})`)
    .join('\n');

  const prompt = `Проанализируй чек и извлеки детали для товаров.

ИЗВЕСТНЫЕ ПЕРЕВОДЫ (используй их):
${knownItems}

Верни JSON:
{
  "items": [
    {
      "originalName": "название с чека",
      "name": "русский перевод (используй известные)",
      "productType": "категория",
      "quantity": число,
      "unit": "единица",
      "price": цена,
      "calories": калории
    }
  ],
  "total": сумма,
  "date": "YYYY-MM-DD"
}`;

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }],
      temperature: 0.2,
      max_tokens: 2000
    })
  });

  const data = await response.json();
  return JSON.parse(cleanJsonResponse(data.choices[0].message.content));
}

/**
 * Main optimized receipt parsing function
 */
async function parseReceiptWithPerplexityOptimized(imageUrl, familyId) {
  console.log('🔍 Stage 1: Extracting original names...');
  const { items: originalItems } = await extractOriginalNames(imageUrl);
  const originalNames = originalItems.map(i => i.originalName);
  
  console.log(`📋 Found ${originalNames.length} items on receipt`);
  
  console.log('🗃️ Stage 2: Checking cache and translating new items...');
  const translations = await translateNewItems(originalNames, familyId);
  
  console.log('💰 Stage 3: Extracting prices, quantities, and calories...');
  const fullData = await extractDetailsWithTranslations(imageUrl, translations);
  
  console.log('✅ Receipt processed successfully!');
  return fullData;
}
```

---

## Когда применять оптимизацию?

### ✅ Применяйте, если:
- У вас много постоянных товаров (80%+ покупок - повторяющиеся)
- Стоимость API токенов критична
- Готовы немного усложнить код

### ⏸️ Не нужно, если:
- Каждый чек содержит в основном новые товары
- Стоимость токенов не критична
- Простота кода важнее оптимизации

---

## Метрики для мониторинга

Добавьте логирование для оценки эффективности:

```javascript
// В конце обработки чека
console.log(`
📊 Receipt Processing Stats:
- Total items: ${totalItems}
- From cache: ${cachedItems} (${Math.round(cachedItems/totalItems*100)}%)
- New translations: ${newItems}
- API calls: ${apiCalls}
- Estimated tokens saved: ~${tokensSaved}
`);
```

---

## Вывод

**Текущая реализация:**
- ✅ Работает прямо сейчас
- ✅ Обеспечивает консистентность
- ✅ Простая в понимании
- ❌ Не экономит токены API

**Оптимизированная версия:**
- ✅ Экономит 30-70% токенов (зависит от размера кэша)
- ✅ Всё еще консистентна
- ⚠️ Сложнее в реализации
- ⚠️ Больше API вызовов (но меньше токенов)

Выбор зависит от ваших приоритетов!









