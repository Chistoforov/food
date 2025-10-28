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
}
