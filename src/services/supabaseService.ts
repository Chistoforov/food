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

  static async deleteReceipt(id: number, familyId: number): Promise<void> {
    // Получаем информацию о чеке для пересчета статистики
    const { data: receipt, error: fetchError } = await supabase
      .from('receipts')
      .select('date, family_id')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    // Удаляем чек (product_history удалится автоматически через CASCADE)
    const { error: deleteError } = await supabase
      .from('receipts')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    // Пересчитываем статистику для месяца, в котором был чек
    if (receipt) {
      const receiptDate = new Date(receipt.date)
      const year = receiptDate.getFullYear()
      const month = String(receiptDate.getMonth() + 1).padStart(2, '0')
      await this.recalculateMonthlyStats(familyId, month, year)
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
    let query = supabase
      .from('monthly_stats')
      .select('*')
      .eq('family_id', familyId)

    if (month) {
      query = query.eq('month', month)
    }
    if (year) {
      query = query.eq('year', year)
    }

    const { data, error } = await query.order('month', { ascending: false })

    if (error) throw error
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
      // Сначала пробуем RPC функцию
      const { error: rpcError } = await supabase.rpc('recalculate_monthly_stats', {
        p_family_id: familyId,
        p_month: month,
        p_year: year
      })

      if (rpcError) {
        console.warn('⚠️ RPC функция недоступна, используем альтернативный метод:', rpcError)
        await this.recalculateMonthlyStatsAlternative(familyId, month, year)
      } else {
        console.log('✅ RPC вызов успешен')
      }
    } catch (error) {
      console.error('❌ Ошибка пересчета статистики:', error)
      throw error
    }
  }

  // Альтернативный метод пересчета статистики без RPC
  static async recalculateMonthlyStatsAlternative(familyId: number, month: string, year: number): Promise<void> {
    console.log('🔄 Используем альтернативный метод пересчета статистики')
    
    // Получаем все покупки за указанный месяц
    const { data: history, error: historyError } = await supabase
      .from('product_history')
      .select(`
        quantity,
        date,
        products!inner(calories)
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
      const calories = item.products?.calories || 0
      const quantity = item.quantity || 0
      return sum + (calories * quantity)
    }, 0) || 0
    
    const daysInMonth = new Date(year, parseInt(month), 0).getDate()
    const avgCaloriesPerDay = Math.round(totalCalories / daysInMonth)
    const receiptsCount = receipts?.length || 0

    console.log('📊 Вычисленная статистика:', {
      totalSpent,
      totalCalories,
      avgCaloriesPerDay,
      receiptsCount
    })

    // Обновляем или создаем запись статистики
    const { error: upsertError } = await supabase
      .from('monthly_stats')
      .upsert({
        family_id: familyId,
        month: `${year}-${month.padStart(2, '0')}`,
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
}
