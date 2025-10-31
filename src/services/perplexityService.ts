// Service for Perplexity API integration to parse receipt images

// Use proxy server to avoid CORS issues
// Use relative path /api/perplexity for both production and development
// In development, Vite proxy will forward to localhost:3001
// In production, Vercel will forward to serverless function
const PROXY_URL = '/api/perplexity';

export interface ReceiptItem {
  name: string; // Russian name
  originalName: string; // Original name from receipt
  quantity: number;
  unit: string; // e.g., "kg", "L", "шт", "г"
  price: number;
  calories: number; // calories for the TOTAL quantity purchased
}

export interface ParsedReceipt {
  items: ReceiptItem[];
  total: number;
  date?: string;
}

/**
 * Converts an image file to base64 string
 */
async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Parses a receipt image using Perplexity API
 */
export async function parseReceiptImage(imageFile: File): Promise<ParsedReceipt> {
  try {
    // Convert image to base64
    const base64Image = await imageToBase64(imageFile);

    // Create the prompt for Perplexity
    const prompt = `Проанализируй этот чек из магазина и извлеки следующую информацию в формате JSON:

{
  "items": [
    {
      "name": "русское название продукта (понятное и читаемое)",
      "originalName": "оригинальное название с чека (как написано в магазине)",
      "quantity": число (сколько единиц товара куплено),
      "unit": "единица измерения (кг, л, шт, г, мл)",
      "price": цена (число - ТОЧНАЯ цена из чека),
      "calories": общее количество калорий для ВСЕГО купленного количества (не на 100г!)
    }
  ],
  "total": общая сумма,
  "date": "дата в формате YYYY-MM-DD"
}

ВАЖНО про названия:
- "name" - это красивое русское название (например: "Молоко 3.2% 1L", "Хлеб белый", "Яблоки")
- "originalName" - это точное название с чека как оно написано (например: "MILK 3.2% 1L", "BREAD WHITE", "APPLES")
- Если чек на русском, то оба поля могут быть одинаковыми

КРИТИЧЕСКИ ВАЖНО про quantity и price:
- "quantity" - это количество купленного товара в ЕДИНИЦАХ ИЗМЕРЕНИЯ
- "price" - это ТОЧНАЯ итоговая цена из чека (сколько заплатили)
- НИКОГДА не пересчитывай цену! Бери только финальную цену из чека!

Примеры:
1. Упакованные товары (фиксированный вес в названии):
   - "Гуакамоле 200г - 1.95€" → quantity=1, unit="шт", price=1.95
   - "Молоко 3 X 1.50€" → quantity=3, unit="шт", price=4.50

2. Товары на вес (цена за кг/г):
   - "Сыр Rambol 0.212 X 19.98 = 4.24€" → quantity=0.212, unit="кг", price=4.24
   - "Яблоки 0.5 X 2.99 = 1.50€" → quantity=0.5, unit="кг", price=1.50
   
ПРАВИЛО: price - это ВСЕГДА итоговая цена покупки (правая колонка в чеке)!

ВАЖНО про калории:
- Калории должны быть для ВСЕГО купленного количества (quantity)
- Не указывай калории "на 100г" - всегда для полного количества!

Примеры:
- Куплено 212г сыра → укажи калории для 212г
- Куплен 1 литр молока → укажи калории для 1000мл
- Куплено 0.5 кг яблок → укажи калории для 500г
- Куплено 2 упаковки по 200г → укажи калории для 400г (2 × 200г)

ПРАВИЛО: calories = (калории на 100г/100мл) × (quantity в граммах/мл)

Верни только JSON без дополнительного текста.`;

    // Make API call to Perplexity via proxy server
    console.log('Making request to:', PROXY_URL);
    
    let response;
    try {
      response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: base64Image
                  }
                }
              ]
            }
          ],
          temperature: 0.2,
          max_tokens: 2000
        })
      });
    } catch (fetchError) {
      console.error('Network error:', fetchError);
      throw new Error(`Не удалось подключиться к прокси-серверу. Убедитесь, что прокси-сервер запущен (npm run proxy) и доступен по адресу ${PROXY_URL}. Ошибка: ${fetchError instanceof Error ? fetchError.message : 'Network error'}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Perplexity API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    
    // Extract the response text
    const responseText = data.choices?.[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from Perplexity API');
    }

    // Parse the JSON response
    // Remove any markdown code blocks if present
    let jsonText = responseText.trim();
    
    // Remove <think> tags and their content (from reasoning models)
    jsonText = jsonText.replace(/<think>[\s\S]*?<\/think>/g, '');
    
    // Remove any other XML-like tags
    jsonText = jsonText.replace(/<[^>]+>/g, '');
    
    // Remove markdown code blocks
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }
    
    // Clean up extra whitespace
    jsonText = jsonText.trim();

    // Handle case where JSON is wrapped in quotes (escaped JSON string)
    // Check if the string starts and ends with quotes
    if ((jsonText.startsWith('"') && jsonText.endsWith('"')) || 
        (jsonText.startsWith("'") && jsonText.endsWith("'"))) {
      try {
        // First parse to unescape the JSON string
        jsonText = JSON.parse(jsonText);
      } catch (e) {
        // If it fails, remove the outer quotes manually
        jsonText = jsonText.slice(1, -1);
        // Unescape common escape sequences
        jsonText = jsonText
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\\\/g, '\\')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t');
      }
    }

    let parsedData;
    try {
      parsedData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Failed to parse JSON:', jsonText.substring(0, 500));
      console.error('Parse error details:', parseError);
      
      // Try to extract valid JSON by finding the first { and matching closing }
      // This handles cases where there's extra text after the JSON
      try {
        const firstBrace = jsonText.indexOf('{');
        if (firstBrace !== -1) {
          let braceCount = 0;
          let endIndex = -1;
          
          for (let i = firstBrace; i < jsonText.length; i++) {
            if (jsonText[i] === '{') braceCount++;
            if (jsonText[i] === '}') braceCount--;
            
            if (braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
          
          if (endIndex !== -1) {
            const extractedJson = jsonText.substring(firstBrace, endIndex);
            console.log('Attempting to parse extracted JSON:', extractedJson.substring(0, 200));
            parsedData = JSON.parse(extractedJson);
            console.log('Successfully parsed extracted JSON');
          } else {
            throw parseError;
          }
        } else {
          throw parseError;
        }
      } catch (secondError) {
        throw new Error(`Не удалось распарсить ответ от API. Получен текст: ${jsonText.substring(0, 200)}... Ошибка: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
    }

    // Validate the response structure
    if (!parsedData.items || !Array.isArray(parsedData.items)) {
      throw new Error('Неверная структура ответа от API (отсутствует массив items)');
    }

    // Ensure all items have required fields
    const validatedItems: ReceiptItem[] = parsedData.items.map((item: any) => ({
      name: String(item.name || 'Неизвестный продукт'),
      originalName: String(item.originalName || item.name || 'Unknown'),
      quantity: Number(item.quantity || 1),
      unit: String(item.unit || 'шт'),
      price: Number(item.price || 0),
      calories: Number(item.calories || 0)
    }));

    return {
      items: validatedItems,
      total: Number(parsedData.total || validatedItems.reduce((sum, item) => sum + item.price, 0)),
      date: parsedData.date || new Date().toISOString().split('T')[0]
    };

  } catch (error) {
    console.error('Error parsing receipt:', error);
    throw error;
  }
}

/**
 * Mock function for testing without actual API calls
 */
export async function parseReceiptImageMock(_imageFile: File): Promise<ParsedReceipt> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    items: [
      {
        name: 'Молоко 3.2% 1L',
        originalName: 'MILK 3.2% 1L',
        quantity: 1,
        unit: 'л',
        price: 1.89,
        calories: 620 // for 1 liter
      },
      {
        name: 'Хлеб белый',
        originalName: 'BREAD WHITE',
        quantity: 1,
        unit: 'шт',
        price: 1.25,
        calories: 1200 // for whole loaf
      },
      {
        name: 'Творог 500г',
        originalName: 'COTTAGE CHEESE 500G',
        quantity: 0.5,
        unit: 'кг',
        price: 2.49,
        calories: 680 // for 500g
      },
      {
        name: 'Яблоки',
        originalName: 'APPLES',
        quantity: 1.5,
        unit: 'кг',
        price: 3.45,
        calories: 780 // for 1.5kg
      }
    ],
    total: 9.08,
    date: new Date().toISOString().split('T')[0]
  };
}

