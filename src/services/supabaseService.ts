import { supabase, Product, Receipt, Family, ProductHistory, MonthlyStats } from '../lib/supabase'

export class SupabaseService {
  // Работа с продуктами
  static async getProducts(familyId: number): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })

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
  static async getReceipts(familyId: number): Promise<Receipt[]> {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('family_id', familyId)
      .order('date', { ascending: false })

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

  static async deleteReceipt(id: number, _familyId: number): Promise<void> {
    console.log('🗑️ Удаляем чек #' + id + ' из базы данных...')
    
    try {
      // Удаляем чек (product_history удалится автоматически через CASCADE)
      const { error: deleteError } = await supabase
        .from('receipts')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('❌ Ошибка удаления чека:', deleteError)
        throw deleteError
      }

      console.log('✅ Чек успешно удален из базы данных')
    } catch (error) {
      console.error('❌ Полная ошибка удаления:', error)
      throw error
    }
  }

  // Работа с семьями
  static async getFamilies(): Promise<Family[]> {
    const { data, error } = await supabase
      .from('families')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async createFamily(family: Omit<Family, 'id' | 'created_at' | 'updated_at'>): Promise<Family> {
    const { data, error } = await supabase
      .from('families')
      .insert([family])
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async updateFamily(id: number, updates: Partial<Family>): Promise<Family> {
    const { data, error } = await supabase
      .from('families')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
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
    const history = await this.getProductHistory(productId, familyId)
    
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
      daysBetweenPurchases.push(daysDiff)
    }

    const avgDays = Math.round(
      daysBetweenPurchases.reduce((sum, days) => sum + days, 0) / daysBetweenPurchases.length
    )

    // Предсказываем дату окончания
    const lastPurchase = new Date(history[history.length - 1].date)
    const predictedEnd = new Date(lastPurchase.getTime() + avgDays * 24 * 60 * 60 * 1000)
    const predictedEndString = predictedEnd.toISOString().split('T')[0]

    // Определяем статус
    const today = new Date()
    const daysUntilEnd = Math.floor((predictedEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    let status: 'ending-soon' | 'ok' | 'calculating' = 'ok'
    if (daysUntilEnd <= 2) {
      status = 'ending-soon'
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
        const unitPrice = item.quantity > 0 ? item.price / item.quantity : item.price
        
        await this.updateProduct(product.id, {
          last_purchase: date,
          price: unitPrice,
          calories: Math.round(item.calories / (item.quantity || 1)), // Store per unit
          purchase_count: (product.purchase_count || 0) + 1,
          original_name: item.originalName || product.original_name
        })
      } else {
        // Создаем новый продукт
        const unitPrice = item.quantity > 0 ? item.price / item.quantity : item.price
        product = await this.createProduct({
          name: item.name,
          original_name: item.originalName,
          family_id: familyId,
          last_purchase: date,
          price: unitPrice,
          calories: Math.round(item.calories / (item.quantity || 1)), // Store per unit
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
}
