import { supabase, Product, Receipt, ProductHistory, MonthlyStats, PendingReceipt } from '../lib/supabase'

export class SupabaseService {
  // Работа с продуктами
  static async getProducts(familyId: number, limit?: number, offset?: number): Promise<Product[]> {
    let query = supabase
      .from('products')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })

    if (limit !== undefined) {
      query = query.limit(limit)
    }

    if (offset !== undefined) {
      query = query.range(offset, offset + (limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  static async createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .insert([product])
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateProduct(id: number, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async deleteProduct(id: number): Promise<void> {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // Работа с чеками
  static async getReceipts(familyId: number, limit?: number, offset?: number): Promise<Receipt[]> {
    let query = supabase
      .from('receipts')
      .select('*')
      .eq('family_id', familyId)
      .order('date', { ascending: false })

    if (limit !== undefined) {
      query = query.limit(limit)
    }

    if (offset !== undefined) {
      query = query.range(offset, offset + (limit || 10) - 1)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  static async createReceipt(receipt: Omit<Receipt, 'id' | 'created_at'>): Promise<Receipt> {
    const { data, error } = await supabase
      .from('receipts')
      .insert([receipt])
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateReceipt(id: number, updates: Partial<Receipt>): Promise<Receipt> {
    const { data, error } = await supabase
      .from('receipts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async deleteReceipt(id: number, familyId: number): Promise<void> {
    console.log('🗑️ Удаляем чек #' + id + ' из базы данных...')
    
    try {
      // Получаем информацию о чеке для пересчета статистики
      const { data: receipt, error: fetchError } = await supabase
        .from('receipts')
        .select('date')
        .eq('id', id)
        .single()

      if (fetchError) {
        console.error('❌ Ошибка получения чека:', fetchError)
        throw fetchError
      }

      // Удаляем чек
      // CASCADE автоматически удалит:
      // 1. Записи из product_history
      // 2. Товары без истории (через триггер delete_products_without_history)
      // 3. Пересчитает статистику (через триггер recalculate_stats_after_receipt_delete)
      const { error: deleteError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('❌ Ошибка удаления чека:', deleteError)
        throw deleteError
      }

      console.log('✅ Чек успешно удален из базы данных')
      console.log('🔄 Автоматическое удаление связанных товаров и пересчет статистики...')

      // Дополнительный пересчет статистики на клиенте (для уверенности)
      if (receipt?.date) {
        const receiptDate = new Date(receipt.date)
        const year = receiptDate.getFullYear()
        const month = String(receiptDate.getMonth() + 1).padStart(2, '0')
        
        try {
          await this.recalculateMonthlyStats(familyId, month, year)
          console.log('✅ Статистика пересчитана на клиенте')
        } catch (statsError) {
          console.warn('⚠️ Ошибка пересчета статистики на клиенте (триггер БД выполнит пересчет):', statsError)
        }
      }
    } catch (error) {
      console.error('❌ Полная ошибка удаления:', error)
      throw error
    }
  }

  // Работа с историей продуктов
  static async getProductHistory(productId: number, familyId: number): Promise<ProductHistory[]> {
    const { data, error } = await supabase
      .from('product_history')
      .select('*')
      .eq('product_id', productId)
      .eq('family_id', familyId)
      .order('date', { ascending: true })

    if (error) throw error
    return data || []
  }

  // Получить историю всех продуктов с одинаковым product_type
  static async getProductTypeHistory(productType: string, familyId: number): Promise<ProductHistory[]> {
    // Сначала получаем все продукты с таким же типом
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id')
      .eq('family_id', familyId)
      .eq('product_type', productType)

    if (productsError) throw productsError
    if (!products || products.length === 0) return []

    // Получаем историю для всех этих продуктов
    const productIds = products.map(p => p.id)
    const { data, error } = await supabase
      .from('product_history')
      .select('*')
      .in('product_id', productIds)
      .eq('family_id', familyId)
      .order('date', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async addProductHistory(history: Omit<ProductHistory, 'id' | 'created_at'>): Promise<ProductHistory> {
    const { data, error } = await supabase
      .from('product_history')
      .insert([history])
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Работа со статистикой
  static async getMonthlyStats(familyId: number, month?: string, year?: number): Promise<MonthlyStats[]> {
    // Загружаем все статистики для семьи, чтобы избежать проблем с форматом месяца
    // Фильтрация по месяцу/году будет происходить на клиенте
    let query = supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', familyId)

    // Если передан month и year, строим формат 'YYYY-MM' для фильтрации
    if (month && year) {
      const monthKey = `${year}-${month.padStart(2, '0')}`
      query = query.eq('month', monthKey)
    } else if (month && !year) {
      // Если передан только месяц, фильтруем по формату 'YYYY-MM' где MM совпадает
      // Это обратная совместимость для старого формата
      query = query.like('month', `%-${month.padStart(2, '0')}`)
    } else if (!month && year) {
      // Если передан только год, фильтруем по формату 'YYYY-MM'
      query = query.like('month', `${year}-%`)
    }

    const { data, error } = await query.order('month', { ascending: false })

    if (error) throw error
    
    // Добавляем логирование для отладки
    console.log('📊 Загружена статистика:', {
      familyId,
      month: month || 'не указан',
      year: year || 'не указан',
      count: data?.length || 0,
      stats: data?.map(s => ({ month: s.month, year: s.year, spent: s.total_spent })) || []
    })
    
    return data || []
  }

  static async createOrUpdateMonthlyStats(stats: Omit<MonthlyStats, 'id' | 'created_at' | 'updated_at'>): Promise<MonthlyStats> {
    const { data, error } = await supabase
      .from('monthly_stats')
      .upsert([stats], { 
        onConflict: 'family_id,month,year',
        ignoreDuplicates: false 
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Служебные методы
  static async calculateProductStats(productId: number, familyId: number): Promise<{
    avgDays: number | null
    predictedEnd: string | null
    status: 'ending-soon' | 'ok' | 'calculating'
  }> {
    // Получаем информацию о продукте для определения его типа
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('product_type, last_purchase')
      .eq('id', productId)
      .single()

    if (productError) throw productError

    // Выбираем историю в зависимости от наличия product_type
    let history: ProductHistory[]
    
    if (product.product_type) {
      // Если у продукта указан тип, используем историю ВСЕХ продуктов этого типа
      console.log(`📊 Используем групповую историю для типа "${product.product_type}"`)
      history = await this.getProductTypeHistory(product.product_type, familyId)
    } else {
      // Если тип не указан, используем только историю конкретного продукта
      console.log(`📊 Используем индивидуальную историю для продукта #${productId}`)
      history = await this.getProductHistory(productId, familyId)
    }
    
    if (history.length < 2) {
      return {
        avgDays: null,
        predictedEnd: null,
        status: 'calculating'
      }
    }

    // Вычисляем среднее количество дней между покупками
    const daysBetweenPurchases = []
    for (let i = 1; i < history.length; i++) {
      const prevDate = new Date(history[i - 1].date)
      const currDate = new Date(history[i].date)
      const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
      // Игнорируем слишком маленькие интервалы (покупки в один день)
      if (daysDiff > 0) {
        daysBetweenPurchases.push(daysDiff)
      }
    }

    // Если нет валидных интервалов, возвращаем статус "calculating"
    if (daysBetweenPurchases.length === 0) {
      return {
        avgDays: null,
        predictedEnd: null,
        status: 'calculating'
      }
    }

    const avgDays = Math.round(
      daysBetweenPurchases.reduce((sum, days) => sum + days, 0) / daysBetweenPurchases.length
    )

    console.log(`📊 Рассчитано среднее: ${avgDays} дней (на основе ${history.length} покупок, ${daysBetweenPurchases.length} интервалов)`)

    // Предсказываем дату окончания на основе последней покупки ЭТОГО конкретного продукта
    const lastPurchase = new Date(product.last_purchase)
    const predictedEnd = new Date(lastPurchase.getTime() + avgDays * 24 * 60 * 60 * 1000)
    const predictedEndString = predictedEnd.toISOString().split('T')[0]

    // Определяем статус
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Обнуляем время для корректного сравнения дат
    
    const lastPurchaseDate = new Date(lastPurchase)
    lastPurchaseDate.setHours(0, 0, 0, 0)
    
    const daysSincePurchase = Math.floor((today.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
    const daysUntilEnd = Math.floor((predictedEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    let status: 'ending-soon' | 'ok' | 'calculating' = 'ok'
    
    // ВАЖНО: Проверяем последнюю запись КОНКРЕТНОГО продукта (а не всей группы)!
    // Это критично для корректной работы досрочного окончания в группах
    const productHistory = await this.getProductHistory(productId, familyId)
    const isEarlyDepletion = productHistory.length > 0 && productHistory[productHistory.length - 1].quantity === -1
    
    console.log(`🔍 Проверка досрочного окончания: продукт #${productId}, последняя запись quantity=${productHistory.length > 0 ? productHistory[productHistory.length - 1].quantity : 'N/A'}, isEarlyDepletion=${isEarlyDepletion}`)
    
    // Если продукт куплен недавно (меньше 2 дней назад), статус обычно "ok"
    // Это гарантирует, что только что купленный продукт точно есть минимум 2 дня
    // ИСКЛЮЧЕНИЕ: если последняя запись - досрочное окончание (quantity=-1),
    // то проверяем срок окончания независимо от даты покупки
    if (daysSincePurchase < 2 && !isEarlyDepletion) {
      status = 'ok'
      console.log(`✅ Продукт куплен ${daysSincePurchase === 0 ? 'сегодня' : 'вчера'}, гарантированно в наличии минимум 2 дня, статус = ok`)
    } else if (daysUntilEnd <= 2) {
      status = 'ending-soon'
      console.log(`⚠️  До окончания ${daysUntilEnd} дней${isEarlyDepletion ? ' (досрочное окончание)' : ''}, статус = ending-soon`)
    }

    return {
      avgDays,
      predictedEnd: predictedEndString,
      status
    }
  }

  static async updateProductStats(productId: number, familyId: number): Promise<void> {
    const stats = await this.calculateProductStats(productId, familyId)
    await this.updateProduct(productId, {
      avg_days: stats.avgDays,
      predicted_end: stats.predictedEnd,
      status: stats.status
    })
  }

  // Метод для ручного пересчета статистики
  static async recalculateMonthlyStats(familyId: number, month: string, year: number): Promise<void> {
    console.log('📊 Пересчитываем статистику с параметрами:', { familyId, month, year })
    
    try {
      // Сначала пытаемся использовать RPC функцию
      const { error: rpcError } = await supabase.rpc('recalculate_monthly_stats', {
        p_family_id: familyId,
        p_month: month,
        p_year: year
      })
      
      if (rpcError) {
        console.warn('⚠️ RPC функция недоступна, используем альтернативный метод:', rpcError.message)
        // Используем альтернативный метод при любой ошибке RPC
        await this.recalculateMonthlyStatsAlternative(familyId, month, year)
      } else {
        console.log('✅ Статистика пересчитана через RPC')
      }
    } catch (error: any) {
      // Если RPC не работает из-за сети или других причин, используем альтернативный метод
      console.warn('⚠️ Ошибка RPC (возможно сеть или права доступа), используем альтернативный метод:', error?.message || error)
      try {
        await this.recalculateMonthlyStatsAlternative(familyId, month, year)
      } catch (altError) {
        console.error('❌ Ошибка альтернативного метода пересчета:', altError)
        throw altError
      }
    }
  }

  // Альтернативный метод пересчета статистики без RPC
  static async recalculateMonthlyStatsAlternative(familyId: number, month: string, year: number): Promise<void> {
    console.log('🔄 Используем альтернативный метод пересчета статистики для:', { month, year })
    
    // Получаем все покупки за указанный месяц
    const { data: history, error: historyError } = await supabase
      .from('product_history')
      .select(`
        quantity,
        date,
        products(calories)
      `)
      .eq('family_id', familyId)
      .gte('date', `${year}-${month.padStart(2, '0')}-01`)
      .lt('date', `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`)

    if (historyError) {
      console.error('❌ Ошибка получения истории покупок:', historyError)
      throw historyError
    }

    // Получаем все чеки за указанный месяц
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('total_amount')
      .eq('family_id', familyId)
      .gte('date', `${year}-${month.padStart(2, '0')}-01`)
      .lt('date', `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-01`)

    if (receiptsError) {
      console.error('❌ Ошибка получения чеков:', receiptsError)
      throw receiptsError
    }

    // Вычисляем статистику
    const totalSpent = receipts?.reduce((sum, receipt) => sum + (receipt.total_amount || 0), 0) || 0
    const totalCalories = history?.reduce((sum, item: any) => {
      // Проверяем, что products существует и имеет calories
      const calories = (item.products && typeof item.products.calories === 'number') ? item.products.calories : 0
      const quantity = item.quantity || 0
      return sum + (calories * quantity)
    }, 0) || 0
    
    const daysInMonth = new Date(year, parseInt(month), 0).getDate()
    const avgCaloriesPerDay = daysInMonth > 0 ? Math.round(totalCalories / daysInMonth) : 0
    const receiptsCount = receipts?.length || 0

    console.log('📊 Вычисленная статистика:', {
      totalSpent,
      totalCalories,
      avgCaloriesPerDay,
      receiptsCount,
      daysInMonth,
      historyLength: history?.length || 0,
      receiptsData: receipts?.map(r => r.total_amount),
      historyData: history?.map((h: any) => ({ 
        calories: h.products?.calories, 
        quantity: h.quantity 
      }))
    })

    // Обновляем или создаем запись статистики
    const monthKey = `${year}-${month.padStart(2, '0')}`
    
    console.log('💾 Сохраняем статистику:', {
      family_id: familyId,
      month: monthKey,
      year: year,
      total_spent: totalSpent,
      total_calories: totalCalories,
      avg_calories_per_day: avgCaloriesPerDay,
      receipts_count: receiptsCount
    })
    
    const { error: upsertError } = await supabase
      .from('monthly_stats')
      .upsert({
        family_id: familyId,
        month: monthKey,
        year: year,
        total_spent: totalSpent,
        total_calories: totalCalories,
        avg_calories_per_day: avgCaloriesPerDay,
        receipts_count: receiptsCount
      }, {
        onConflict: 'family_id,month,year'
      })

    if (upsertError) {
      console.error('❌ Ошибка сохранения статистики:', upsertError)
      throw upsertError
    }

    console.log('✅ Статистика успешно пересчитана альтернативным методом')
  }

  // Метод для пересчета статистики при изменении калорийности продукта
  static async recalculateStatsForProduct(productId: number, familyId: number): Promise<void> {
    // Получаем все месяцы, где есть покупки этого продукта
    const history = await this.getProductHistory(productId, familyId)
    
    if (history.length === 0) return

    // Получаем уникальные месяцы и годы
    const months = new Set<string>()
    history.forEach(item => {
      const date = new Date(item.date)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      months.add(`${year}-${month}`)
    })

    // Пересчитываем статистику для каждого месяца
    for (const monthYear of months) {
      const [year, month] = monthYear.split('-')
      await this.recalculateMonthlyStats(familyId, month, parseInt(year))
    }
  }

  // Метод для обработки распарсенного чека
  static async processReceipt(
    familyId: number,
    items: Array<{
      name: string
      originalName?: string
      quantity: number
      price: number
      calories: number
    }>,
    total: number,
    date: string
  ): Promise<Receipt> {
    // Создаем чек
    const receipt = await this.createReceipt({
      family_id: familyId,
      date: date,
      items_count: items.length,
      total_amount: total,
      status: 'processed'
    })

    // Обрабатываем каждый товар
    for (const item of items) {
      // Ищем существующий продукт или создаем новый
      const { data: existingProducts } = await supabase
        .from('products')
        .select('*')
        .eq('family_id', familyId)
        .ilike('name', item.name)
        .limit(1)

      let product: Product

      if (existingProducts && existingProducts.length > 0) {
        // Обновляем существующий продукт
        product = existingProducts[0]
        
        // ВАЖНО: price в чеке - это уже правильная цена за купленное количество!
        // Не нужно делить или умножать - просто сохраняем как есть
        await this.updateProduct(product.id, {
          last_purchase: date,
          price: item.price, // Цена из чека - уже правильная!
          calories: item.calories, // Калории для полного количества
          purchase_count: (product.purchase_count || 0) + 1,
          original_name: item.originalName || product.original_name
        })
      } else {
        // Создаем новый продукт
        // ВАЖНО: price в чеке - это уже правильная цена за купленное количество!
        product = await this.createProduct({
          name: item.name,
          original_name: item.originalName,
          family_id: familyId,
          last_purchase: date,
          price: item.price, // Цена из чека - уже правильная!
          calories: item.calories, // Калории для полного количества
          purchase_count: 1,
          status: 'calculating',
          avg_days: null,
          predicted_end: null
        })
      }

      // Добавляем запись в историю покупок с привязкой к чеку
      await this.addProductHistory({
        product_id: product.id,
        family_id: familyId,
        date: date,
        quantity: item.quantity,
        price: item.price,
        unit_price: item.quantity > 0 ? item.price / item.quantity : item.price,
        receipt_id: receipt.id
      })

      // Обновляем статистику продукта
      await this.updateProductStats(product.id, familyId)
    }

    // Пересчитываем месячную статистику
    const receiptDate = new Date(date)
    const year = receiptDate.getFullYear()
    const month = String(receiptDate.getMonth() + 1).padStart(2, '0')
    await this.recalculateMonthlyStats(familyId, month, year)

    return receipt
  }

  // Полный пересчет аналитики для семьи
  static async recalculateFamilyAnalytics(familyId: number): Promise<void> {
    console.log(`🔄 Пересчитываем всю аналитику для семьи ${familyId}`)
    
    try {
      const { error } = await supabase.rpc('recalculate_family_analytics', {
        p_family_id: familyId
      })

      if (error) {
        console.error('❌ Ошибка пересчета аналитики семьи:', error)
        throw error
      }

      console.log('✅ Аналитика семьи пересчитана успешно')
    } catch (error) {
      console.error('❌ Полная ошибка пересчета аналитики семьи:', error)
      throw error
    }
  }

  // Полный пересчет аналитики для всех семей
  static async recalculateAllAnalytics(): Promise<void> {
    console.log('🔄 Пересчитываем всю аналитику для всех семей')
    
    try {
      const { error } = await supabase.rpc('recalculate_all_analytics')

      if (error) {
        console.error('❌ Ошибка пересчета всей аналитики:', error)
        throw error
      }

      console.log('✅ Вся аналитика пересчитана успешно')
    } catch (error) {
      console.error('❌ Полная ошибка пересчета всей аналитики:', error)
      throw error
    }
  }

  // Пересчет всех месяцев с чеками для конкретной семьи
  static async recalculateAllMonthsWithReceipts(familyId: number): Promise<void> {
    console.log('🔄 Пересчитываем все месяцы с чеками для семьи:', familyId)
    
    try {
      // Пытаемся использовать RPC функцию
      const { error } = await supabase.rpc('recalculate_all_months_with_receipts', {
        p_family_id: familyId
      })

      if (error) {
        console.warn('⚠️ RPC функция недоступна, используем ручной пересчет:', error.message)
        // Fallback: пересчитываем вручную
        await this.recalculateAllMonthsManually(familyId)
      } else {
        console.log('✅ Все месяцы с чеками пересчитаны успешно через RPC')
      }
    } catch (error: any) {
      // Если RPC не работает из-за сети или других причин, используем ручной пересчет
      console.warn('⚠️ Ошибка RPC (возможно сеть), используем ручной пересчет:', error?.message || error)
      try {
        await this.recalculateAllMonthsManually(familyId)
      } catch (manualError) {
        console.error('❌ Ошибка ручного пересчета:', manualError)
        throw manualError
      }
    }
  }

  // Ручной пересчет всех месяцев с чеками
  static async recalculateAllMonthsManually(familyId: number): Promise<void> {
    console.log('🔄 Ручной пересчет всех месяцев с чеками...')
    
    try {
      // Получаем все чеки
      const receipts = await this.getReceipts(familyId)
      
      if (receipts.length === 0) {
        console.log('⚠️ Нет чеков для пересчета')
        return
      }
      
      // Группируем чеки по месяцам
      const monthsData = new Map<string, { year: number, month: string, totalSpent: number, receiptsCount: number }>()
      
      receipts.forEach(receipt => {
        const date = new Date(receipt.date)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const key = `${year}-${month}`
        
        if (!monthsData.has(key)) {
          monthsData.set(key, { year, month, totalSpent: 0, receiptsCount: 0 })
        }
        
        const data = monthsData.get(key)!
        data.totalSpent += receipt.total_amount || 0
        data.receiptsCount += 1
      })
      
      console.log(`📅 Найдено ${monthsData.size} месяцев для пересчета:`, Array.from(monthsData.keys()))
      
      // Пересчитываем статистику для каждого месяца
      for (const [monthKey, data] of monthsData) {
        console.log(`🔄 Пересчитываем ${monthKey}...`)
        await this.recalculateMonthlyStats(familyId, data.month, data.year)
      }
      
      console.log('✅ Ручной пересчет завершен')
    } catch (error) {
      console.error('❌ Ошибка ручного пересчета:', error)
      throw error
    }
  }

  // === BACKGROUND RECEIPT PROCESSING ===
  
  /**
   * Upload receipt image to Supabase Storage and create pending receipt
   * Returns the pending receipt ID for tracking
   */
  static async uploadReceiptForProcessing(
    familyId: number,
    imageFile: File
  ): Promise<PendingReceipt> {
    try {
      // Generate unique filename
      const timestamp = Date.now()
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${familyId}/${timestamp}.${fileExt}`

      console.log('📤 Uploading image to storage:', fileName)

      // Upload image to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('❌ Upload error:', uploadError)
        throw uploadError
      }

      console.log('✅ Image uploaded successfully:', uploadData.path)

      // Create pending receipt record
      const { data: pendingReceipt, error: insertError } = await supabase
        .from('pending_receipts')
        .insert({
          family_id: familyId,
          image_url: uploadData.path,
          status: 'pending',
          attempts: 0
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ Insert error:', insertError)
        throw insertError
      }

      console.log('✅ Pending receipt created:', pendingReceipt.id)

      return pendingReceipt
    } catch (error) {
      console.error('❌ Error uploading receipt:', error)
      throw error
    }
  }

  /**
   * Trigger background processing of a pending receipt
   * This is a fire-and-forget call - user doesn't wait for completion
   */
  static async triggerReceiptProcessing(pendingReceiptId: number): Promise<void> {
    try {
      console.log('🚀 Triggering background processing for receipt:', pendingReceiptId)

      // Call the Vercel serverless function
      // Don't await - fire and forget
      fetch('/api/process-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pendingReceiptId })
      }).catch(error => {
        console.error('❌ Error triggering processing (non-blocking):', error)
      })

      console.log('✅ Processing triggered (background)')
    } catch (error) {
      console.error('❌ Error triggering processing:', error)
      // Don't throw - this is non-blocking
    }
  }

  /**
   * Get pending receipts for a family
   */
  static async getPendingReceipts(familyId: number): Promise<PendingReceipt[]> {
    const { data, error } = await supabase
      .from('pending_receipts')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  /**
   * Subscribe to pending receipt updates using Realtime
   * Returns unsubscribe function
   */
  static subscribeToPendingReceipts(
    familyId: number,
    callback: (receipt: PendingReceipt) => void
  ): () => void {
    console.log('🔔 [REALTIME] Создаем подписку на pending_receipts для family:', familyId)
    console.log('🔔 [REALTIME] Время создания:', new Date().toISOString())
    
    const channelName = `pending_receipts_${familyId}_${Date.now()}`
    console.log('🔔 [REALTIME] Имя канала:', channelName)
    
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: '' }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pending_receipts',
          filter: `family_id=eq.${familyId}`
        },
        (payload) => {
          console.log('📡 [REALTIME] ===== СОБЫТИЕ ПОЛУЧЕНО =====')
          console.log('📡 [REALTIME] Время:', new Date().toISOString())
          console.log('📡 [REALTIME] Тип события:', payload.eventType)
          console.log('📡 [REALTIME] Старые данные:', payload.old)
          console.log('📡 [REALTIME] Новые данные:', payload.new)
          console.log('📡 [REALTIME] =============================')
          
          // Обрабатываем все типы событий (INSERT, UPDATE, DELETE)
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            console.log('✅ [REALTIME] Вызываем callback с данными:', payload.new)
            callback(payload.new as PendingReceipt)
          }
        }
      )
      .subscribe((status, err) => {
        console.log('📡 [REALTIME] ----- ИЗМЕНЕНИЕ СТАТУСА ПОДПИСКИ -----')
        console.log('📡 [REALTIME] Новый статус:', status)
        console.log('📡 [REALTIME] Время:', new Date().toISOString())
        if (err) {
          console.error('❌ [REALTIME] ОШИБКА:', err)
          console.error('❌ [REALTIME] Детали ошибки:', JSON.stringify(err, null, 2))
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] УСПЕШНО ПОДПИСАЛИСЬ!')
          console.log('✅ [REALTIME] Канал:', channelName)
          console.log('✅ [REALTIME] Family ID:', familyId)
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME] ОШИБКА КАНАЛА!')
        }
        if (status === 'TIMED_OUT') {
          console.error('❌ [REALTIME] ТАЙМАУТ ПОДКЛЮЧЕНИЯ!')
        }
        if (status === 'CLOSED') {
          console.warn('⚠️ [REALTIME] КАНАЛ ЗАКРЫТ')
        }
        console.log('📡 [REALTIME] ---------------------------------------')
      })

    return () => {
      console.log('🔕 [REALTIME] Отписываемся от канала:', channelName)
      supabase.removeChannel(channel)
    }
  }

  /**
   * Delete a pending receipt (cleanup)
   */
  static async deletePendingReceipt(id: number): Promise<void> {
    const { error } = await supabase
      .from('pending_receipts')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  // === RECEIPT DETAILS AND DATE EDITING ===
  
  /**
   * Get all products from a receipt with their details
   */
  static async getReceiptProducts(receiptId: number, familyId: number): Promise<Array<ProductHistory & { product?: Product }>> {
    const { data, error } = await supabase
      .from('product_history')
      .select(`
        *,
        products (*)
      `)
      .eq('receipt_id', receiptId)
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })

    if (error) throw error
    
    // Transform the data to include product details
    return (data || []).map(item => ({
      ...item,
      product: item.products as unknown as Product
    }))
  }

  /**
   * Update receipt date and all associated product_history dates
   * This will automatically trigger recalculation of monthly stats for both old and new months
   */
  static async updateReceiptDate(
    receiptId: number, 
    familyId: number, 
    newDate: string
  ): Promise<void> {
    console.log('📅 Обновляем дату чека #' + receiptId + ' на ' + newDate)
    
    try {
      // Get the old receipt date first for stats recalculation
      const { data: oldReceipt, error: fetchError } = await supabase
        .from('receipts')
        .select('date')
        .eq('id', receiptId)
        .eq('family_id', familyId)
        .single()

      if (fetchError) {
        console.error('❌ Ошибка получения чека:', fetchError)
        throw fetchError
      }

      const oldDate = oldReceipt.date
      
      // Update the receipt date
      const { error: receiptError } = await supabase
        .from('receipts')
        .update({ date: newDate })
        .eq('id', receiptId)
        .eq('family_id', familyId)

      if (receiptError) {
        console.error('❌ Ошибка обновления даты чека:', receiptError)
        throw receiptError
      }

      console.log('✅ Дата чека обновлена')

      // Update all product_history entries for this receipt
      const { error: historyError } = await supabase
        .from('product_history')
        .update({ date: newDate })
        .eq('receipt_id', receiptId)
        .eq('family_id', familyId)

      if (historyError) {
        console.error('❌ Ошибка обновления истории продуктов:', historyError)
        throw historyError
      }

      console.log('✅ История продуктов обновлена')

      // Update last_purchase date for all products in this receipt
      const { data: productHistoryItems, error: phError } = await supabase
        .from('product_history')
        .select('product_id')
        .eq('receipt_id', receiptId)

      if (phError) {
        console.error('❌ Ошибка получения списка продуктов:', phError)
        throw phError
      }

      // For each product, update last_purchase if this was their latest purchase
      for (const item of productHistoryItems || []) {
        // Get the latest purchase date for this product
        const { data: latestPurchase } = await supabase
          .from('product_history')
          .select('date')
          .eq('product_id', item.product_id)
          .order('date', { ascending: false })
          .limit(1)
          .single()

        if (latestPurchase) {
          await supabase
            .from('products')
            .update({ last_purchase: latestPurchase.date })
            .eq('id', item.product_id)
        }
      }

      console.log('✅ Даты последних покупок обновлены')

      // Recalculate stats for both old and new months
      const oldReceiptDate = new Date(oldDate)
      const oldYear = oldReceiptDate.getFullYear()
      const oldMonth = String(oldReceiptDate.getMonth() + 1).padStart(2, '0')

      const newReceiptDate = new Date(newDate)
      const newYear = newReceiptDate.getFullYear()
      const newMonth = String(newReceiptDate.getMonth() + 1).padStart(2, '0')

      console.log('🔄 Пересчитываем статистику для старого месяца:', oldMonth, oldYear)
      await this.recalculateMonthlyStats(familyId, oldMonth, oldYear)

      // Only recalculate new month if it's different from old month
      if (oldMonth !== newMonth || oldYear !== newYear) {
        console.log('🔄 Пересчитываем статистику для нового месяца:', newMonth, newYear)
        await this.recalculateMonthlyStats(familyId, newMonth, newYear)
      }

      console.log('✅ Дата чека успешно обновлена и статистика пересчитана')
    } catch (error) {
      console.error('❌ Полная ошибка обновления даты чека:', error)
      throw error
    }
  }

  // Рассчитать статус для типа продукта на основе всех продуктов этого типа
  static async calculateProductTypeStatus(
    productType: string, 
    familyId: number
  ): Promise<'ending-soon' | 'ok' | 'calculating'> {
    try {
      // Получаем все продукты этого типа
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, last_purchase')
        .eq('family_id', familyId)
        .eq('product_type', productType)

      if (productsError) throw productsError
      if (!products || products.length === 0) return 'calculating'

      // Получаем историю ВСЕХ продуктов этого типа
      const productIds = products.map(p => p.id)
      const { data: history, error: historyError } = await supabase
        .from('product_history')
        .select('date')
        .in('product_id', productIds)
        .eq('family_id', familyId)
        .order('date', { ascending: true })

      if (historyError) throw historyError
      if (!history || history.length < 2) return 'calculating'

      // Проверяем: есть ли хоть один продукт, купленный недавно (< 2 дней)?
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let hasRecentPurchase = false
      for (const product of products) {
        const lastPurchaseDate = new Date(product.last_purchase)
        lastPurchaseDate.setHours(0, 0, 0, 0)
        const daysSince = Math.floor((today.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysSince < 2) {
          hasRecentPurchase = true
          break
        }
      }

      // Если есть недавняя покупка - статус "ok" (правило 2-х дней)
      if (hasRecentPurchase) {
        return 'ok'
      }

      // Вычисляем среднюю частоту покупки ТИПА (по всем покупкам всех продуктов)
      const daysBetweenPurchases = []
      for (let i = 1; i < history.length; i++) {
        const prevDate = new Date(history[i - 1].date)
        const currDate = new Date(history[i].date)
        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysDiff > 0) {
          daysBetweenPurchases.push(daysDiff)
        }
      }

      if (daysBetweenPurchases.length === 0) return 'calculating'

      const avgDays = Math.round(
        daysBetweenPurchases.reduce((sum, days) => sum + days, 0) / daysBetweenPurchases.length
      )

      // Находим ПОСЛЕДНЮЮ покупку любого продукта этого типа
      const lastPurchaseOfType = products.reduce((latest, product) => {
        const purchaseDate = new Date(product.last_purchase)
        return purchaseDate > latest ? purchaseDate : latest
      }, new Date(0))

      // Рассчитываем прогнозируемую дату окончания для ТИПА
      const predictedEnd = new Date(lastPurchaseOfType.getTime() + avgDays * 24 * 60 * 60 * 1000)
      const daysUntilEnd = Math.floor((predictedEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      // Определяем статус: если до окончания <= 2 дней, то заканчивается
      return daysUntilEnd <= 2 ? 'ending-soon' : 'ok'
    } catch (error) {
      console.error(`❌ Ошибка расчета статуса типа "${productType}":`, error)
      return 'calculating'
    }
  }

  // Получить агрегированную статистику по типам продуктов (для главной страницы)
  // ОПТИМИЗИРОВАНО: Использует кэш из таблицы product_type_stats вместо расчета на лету
  static async getProductTypeStats(familyId: number): Promise<Record<string, {
    status: 'ending-soon' | 'ok' | 'calculating'
    productCount: number
  }>> {
    try {
      console.log('📊 Загружаем статистику типов продуктов из кэша...')
      
      // Получаем кэшированные статусы из product_type_stats
      const { data: cachedStats, error: cacheError } = await supabase
        .from('product_type_stats')
        .select('product_type, status, product_count')
        .eq('family_id', familyId)

      if (cacheError) {
        console.error('❌ Ошибка загрузки кэша статистики:', cacheError)
        throw cacheError
      }

      // Преобразуем в нужный формат
      const stats: Record<string, {
        status: 'ending-soon' | 'ok' | 'calculating'
        productCount: number
      }> = {}

      cachedStats?.forEach(item => {
        stats[item.product_type] = {
          status: item.status as 'ending-soon' | 'ok' | 'calculating',
          productCount: item.product_count
        }
      })

      console.log('✅ Статистика типов продуктов загружена из кэша:', {
        types: Object.keys(stats).length,
        stats
      })

      return stats
    } catch (error) {
      console.error('❌ Ошибка получения статистики по типам:', error)
      throw error
    }
  }

  // Пересчитать статистику типов продуктов (обновить кэш)
  static async recalculateProductTypeStats(familyId: number): Promise<void> {
    try {
      console.log('🔄 Пересчитываем кэш статистики типов продуктов для семьи:', familyId)
      
      const { error } = await supabase.rpc('recalculate_product_type_stats', {
        p_family_id: familyId
      })

      if (error) {
        console.error('❌ Ошибка пересчета кэша статистики типов:', error)
        throw error
      }

      console.log('✅ Кэш статистики типов продуктов пересчитан')
    } catch (error) {
      console.error('❌ Ошибка пересчета статистики типов:', error)
      throw error
    }
  }

  // Повторная обработка чеков для определения типов продуктов
  static async reprocessReceipts(familyId: number, receiptIds?: number[]): Promise<{
    success: boolean
    receiptsProcessed: number
    productsUpdated: number
    results: any[]
  }> {
    try {
      const response = await fetch('/api/reprocess-receipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          familyId,
          receiptIds
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reprocess receipts')
      }

      const data = await response.json()
      
      // После успешной обработки пересчитываем статистику для всех продуктов
      if (data.success && data.productsUpdated > 0) {
        console.log('🔄 Пересчитываем статистику для обновленных продуктов...')
        
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .eq('family_id', familyId)
        
        if (products) {
          // Пересчитываем по батчам, чтобы не перегружать систему
          for (const product of products) {
            try {
              await this.updateProductStats(product.id, familyId)
            } catch (err) {
              console.warn(`⚠️ Не удалось пересчитать статистику для продукта #${product.id}:`, err)
            }
          }
        }
        
        console.log('✅ Статистика пересчитана')
      }

      return data
    } catch (error) {
      console.error('❌ Ошибка повторной обработки чеков:', error)
      throw error
    }
  }

  // Пересчет статусов всех продуктов семьи (для cron job)
  static async recalculateAllProductStatuses(familyId: number): Promise<{
    success: boolean
    productsUpdated: number
    errors: number
  }> {
    console.log(`🔄 Начинаем пересчет статусов всех продуктов для семьи ${familyId}`)
    
    try {
      // Получаем все продукты семьи
      const { data: products, error } = await supabase
        .from('products')
        .select('id')
        .eq('family_id', familyId)

      if (error) {
        console.error('❌ Ошибка получения продуктов:', error)
        throw error
      }

      if (!products || products.length === 0) {
        console.log('⚠️ Нет продуктов для пересчета')
        return { success: true, productsUpdated: 0, errors: 0 }
      }

      console.log(`📦 Найдено ${products.length} продуктов для пересчета`)

      let updated = 0
      let errors = 0

      // Пересчитываем статус для каждого продукта
      for (const product of products) {
        try {
          await this.updateProductStats(product.id, familyId)
          updated++
          
          // Небольшая задержка между запросами, чтобы не перегружать БД
          if (updated % 10 === 0) {
            console.log(`✅ Обработано ${updated}/${products.length} продуктов`)
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        } catch (err) {
          console.error(`❌ Ошибка пересчета статуса продукта #${product.id}:`, err)
          errors++
        }
      }

      console.log(`✅ Пересчет завершен: обновлено ${updated}, ошибок ${errors}`)

      return {
        success: true,
        productsUpdated: updated,
        errors
      }
    } catch (error) {
      console.error('❌ Ошибка пересчета статусов продуктов:', error)
      throw error
    }
  }

  // Добавить виртуальную покупку для корректировки avg_days
  // Это нужно, когда пользователь видит, что продукт помечен как "заканчивается",
  // но на самом деле продукт еще есть дома
  static async addVirtualPurchase(productId: number, familyId: number): Promise<void> {
    console.log(`🔄 Добавляем виртуальную покупку для продукта #${productId}`)
    
    try {
      // Создаем виртуальную покупку с сегодняшней датой
      const today = new Date().toISOString().split('T')[0]
      
      // Добавляем запись в историю с quantity=0 (виртуальная покупка)
      // price=0 и unit_price=0, т.к. это не реальная покупка
      await this.addProductHistory({
        product_id: productId,
        family_id: familyId,
        date: today,
        quantity: 0, // Виртуальная покупка - не влияет на расход
        price: 0,
        unit_price: 0
        // receipt_id не указываем - будет undefined (нет чека для виртуальной покупки)
      })

      console.log('✅ Виртуальная покупка добавлена')

      // Обновляем last_purchase на сегодня
      await this.updateProduct(productId, {
        last_purchase: today
      })

      console.log('✅ last_purchase обновлен')

      // Пересчитываем статистику продукта
      // Это пересчитает avg_days с учетом новой виртуальной покупки
      await this.updateProductStats(productId, familyId)

      console.log('✅ Статистика пересчитана, avg_days увеличен')
    } catch (error) {
      console.error('❌ Ошибка добавления виртуальной покупки:', error)
      throw error
    }
  }

  // Добавить виртуальную покупку для всех продуктов указанного типа
  static async addVirtualPurchaseForType(productType: string, familyId: number): Promise<number> {
    console.log(`🔄 Добавляем виртуальную покупку для типа продукта: "${productType}"`)
    
    try {
      // Получаем все продукты этого типа из базы данных
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .eq('family_id', familyId)
        .eq('product_type', productType)

      if (productsError) {
        console.error('❌ Ошибка получения продуктов типа:', productsError)
        throw productsError
      }

      if (!products || products.length === 0) {
        console.warn(`⚠️ Нет продуктов для типа "${productType}"`)
        return 0
      }

      console.log(`📦 Найдено ${products.length} продуктов типа "${productType}":`, products.map(p => p.name))

      // Добавляем виртуальную покупку для каждого продукта этого типа
      for (const product of products) {
        await this.addVirtualPurchase(product.id, familyId)
      }

      console.log(`✅ Виртуальные покупки добавлены для ${products.length} продуктов`)
      return products.length
    } catch (error) {
      console.error('❌ Ошибка добавления виртуальной покупки для типа:', error)
      throw error
    }
  }

  // Удаление типа продукта (очистка product_type для всех продуктов этого типа)
  static async deleteProductType(productType: string, familyId: number): Promise<void> {
    console.log(`🗑️ Удаляем тип продукта "${productType}" для семьи ${familyId}`)
    
    try {
      // Находим все продукты с этим типом
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id')
        .eq('family_id', familyId)
        .eq('product_type', productType)

      if (fetchError) {
        console.error('❌ Ошибка получения продуктов:', fetchError)
        throw fetchError
      }

      if (!products || products.length === 0) {
        console.log('⚠️ Нет продуктов с таким типом')
        return
      }

      console.log(`📦 Найдено ${products.length} продуктов с типом "${productType}"`)

      // Очищаем product_type для всех продуктов
      const { error: updateError } = await supabase
        .from('products')
        .update({ product_type: null })
        .eq('family_id', familyId)
        .eq('product_type', productType)

      if (updateError) {
        console.error('❌ Ошибка обновления продуктов:', updateError)
        throw updateError
      }

      console.log('✅ Тип продукта удален у всех продуктов')

      // Удаляем кэшированную статистику для этого типа
      const { error: deleteStatsError } = await supabase
        .from('product_type_stats')
        .delete()
        .eq('family_id', familyId)
        .eq('product_type', productType)

      if (deleteStatsError) {
        console.warn('⚠️ Ошибка удаления статистики типа (не критично):', deleteStatsError)
      }

      // Пересчитываем статусы для всех затронутых продуктов
      console.log('🔄 Пересчитываем статусы для затронутых продуктов...')
      for (const product of products) {
        try {
          await this.updateProductStats(product.id, familyId)
        } catch (err) {
          console.warn(`⚠️ Не удалось пересчитать статистику для продукта #${product.id}:`, err)
        }
      }

      console.log(`✅ Тип продукта "${productType}" успешно удален`)
    } catch (error) {
      console.error('❌ Ошибка удаления типа продукта:', error)
      throw error
    }
  }

  // Отметить продукт как досрочно закончившийся
  // Это обратная операция от виртуальной покупки - продукт закончился раньше прогноза
  static async markAsDepletedEarly(productId: number, familyId: number): Promise<void> {
    console.log(`⚠️ Отмечаем продукт #${productId} как досрочно закончившийся`)
    
    try {
      // Получаем информацию о продукте
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('last_purchase, predicted_end, avg_days')
        .eq('id', productId)
        .single()

      if (productError) {
        console.error('❌ Ошибка получения продукта:', productError)
        throw productError
      }

      const today = new Date().toISOString().split('T')[0]
      
      // Вычисляем, на сколько дней раньше закончился продукт
      const lastPurchaseDate = new Date(product.last_purchase)
      const todayDate = new Date(today)
      const actualDays = Math.floor((todayDate.getTime() - lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
      
      console.log(`📊 Продукт закончился через ${actualDays} дней вместо прогнозируемых ${product.avg_days || 'N/A'}`)
      
      // Добавляем запись в историю о досрочном окончании
      // Это создаст новую точку для расчета avg_days
      // quantity=-1 означает "досрочное окончание" (отличается от виртуальной покупки quantity=0)
      await this.addProductHistory({
        product_id: productId,
        family_id: familyId,
        date: today,
        quantity: -1, // Специальный маркер "досрочное окончание"
        price: 0,
        unit_price: 0
        // receipt_id не указываем - нет чека для досрочного окончания
      })

      console.log('✅ Запись о досрочном окончании добавлена в историю')

      // Обновляем last_purchase на сегодня, чтобы это стало новой точкой отсчета
      await this.updateProduct(productId, {
        last_purchase: today
      })

      console.log('✅ last_purchase обновлен на сегодня')

      // Пересчитываем статистику продукта
      // avg_days будет пересчитан с учетом того, что продукт закончился раньше
      // Это сделает интервалы между покупками короче и статус изменится на 'ending-soon'
      await this.updateProductStats(productId, familyId)

      console.log('✅ Статистика пересчитана, avg_days уменьшен, статус обновлен')
    } catch (error) {
      console.error('❌ Ошибка отметки о досрочном окончании:', error)
      throw error
    }
  }

  // Отметить все продукты указанного типа как досрочно закончившиеся
  static async markTypeAsDepletedEarly(productType: string, familyId: number): Promise<number> {
    console.log(`⚠️ Отмечаем все продукты типа "${productType}" как досрочно закончившиеся`)
    
    try {
      // Получаем все продукты этого типа из базы данных
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .eq('family_id', familyId)
        .eq('product_type', productType)

      if (productsError) {
        console.error('❌ Ошибка получения продуктов типа:', productsError)
        throw productsError
      }

      if (!products || products.length === 0) {
        console.warn(`⚠️ Нет продуктов для типа "${productType}"`)
        return 0
      }

      console.log(`📦 Найдено ${products.length} продуктов типа "${productType}":`, products.map(p => p.name))

      // Отмечаем каждый продукт этого типа как досрочно закончившийся
      for (const product of products) {
        await this.markAsDepletedEarly(product.id, familyId)
      }

      console.log(`✅ Все ${products.length} продуктов отмечены как досрочно закончившиеся`)
      return products.length
    } catch (error) {
      console.error('❌ Ошибка отметки типа как досрочно закончившегося:', error)
      throw error
    }
  }
}
