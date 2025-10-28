import { useState, useEffect } from 'react'
import { SupabaseService } from '../services/supabaseService'
import { Product, Receipt, Family, ProductHistory, MonthlyStats } from '../lib/supabase'

// Хук для работы с продуктами
export const useProducts = (familyId: number) => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await SupabaseService.getProducts(familyId)
      setProducts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки продуктов')
    } finally {
      setLoading(false)
    }
  }

  const updateProduct = async (id: number, updates: Partial<Product>) => {
    try {
      setError(null)
      const updatedProduct = await SupabaseService.updateProduct(id, updates)
      setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p))
      
      // Если изменилась калорийность, пересчитываем статистику
      if (updates.calories !== undefined) {
        await SupabaseService.recalculateStatsForProduct(id, familyId)
      }
      
      return updatedProduct
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления продукта')
      throw err
    }
  }

  const createProduct = async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setError(null)
      const newProduct = await SupabaseService.createProduct(product)
      setProducts(prev => [newProduct, ...prev])
      return newProduct
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания продукта')
      throw err
    }
  }

  const deleteProduct = async (id: number) => {
    try {
      setError(null)
      await SupabaseService.deleteProduct(id)
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления продукта')
      throw err
    }
  }

  useEffect(() => {
    if (familyId) {
      fetchProducts()
    }
  }, [familyId])

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
    updateProduct,
    createProduct,
    deleteProduct
  }
}

// Хук для работы с чеками
export const useReceipts = (familyId: number) => {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReceipts = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await SupabaseService.getReceipts(familyId)
      setReceipts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки чеков')
    } finally {
      setLoading(false)
    }
  }

  const createReceipt = async (receipt: Omit<Receipt, 'id' | 'created_at'>) => {
    try {
      setError(null)
      const newReceipt = await SupabaseService.createReceipt(receipt)
      setReceipts(prev => [newReceipt, ...prev])
      return newReceipt
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания чека')
      throw err
    }
  }

  useEffect(() => {
    if (familyId) {
      fetchReceipts()
    }
  }, [familyId])

  return {
    receipts,
    loading,
    error,
    refetch: fetchReceipts,
    createReceipt
  }
}

// Хук для работы с семьями
export const useFamilies = () => {
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFamilies = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await SupabaseService.getFamilies()
      setFamilies(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки семей')
    } finally {
      setLoading(false)
    }
  }

  const createFamily = async (family: Omit<Family, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setError(null)
      const newFamily = await SupabaseService.createFamily(family)
      setFamilies(prev => [newFamily, ...prev])
      return newFamily
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания семьи')
      throw err
    }
  }

  const updateFamily = async (id: number, updates: Partial<Family>) => {
    try {
      setError(null)
      const updatedFamily = await SupabaseService.updateFamily(id, updates)
      setFamilies(prev => prev.map(f => f.id === id ? updatedFamily : f))
      return updatedFamily
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления семьи')
      throw err
    }
  }

  useEffect(() => {
    fetchFamilies()
  }, [])

  return {
    families,
    loading,
    error,
    refetch: fetchFamilies,
    createFamily,
    updateFamily
  }
}

// Хук для работы с историей продуктов
export const useProductHistory = (productId: number, familyId: number) => {
  const [history, setHistory] = useState<ProductHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await SupabaseService.getProductHistory(productId, familyId)
      setHistory(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки истории')
    } finally {
      setLoading(false)
    }
  }

  const addHistory = async (historyItem: Omit<ProductHistory, 'id' | 'created_at'>) => {
    try {
      setError(null)
      const newHistory = await SupabaseService.addProductHistory(historyItem)
      setHistory(prev => [...prev, newHistory])
      return newHistory
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка добавления истории')
      throw err
    }
  }

  useEffect(() => {
    if (productId && familyId) {
      fetchHistory()
    }
  }, [productId, familyId])

  return {
    history,
    loading,
    error,
    refetch: fetchHistory,
    addHistory
  }
}

// Хук для работы со статистикой
export const useMonthlyStats = (familyId: number, month?: string, year?: number) => {
  const [stats, setStats] = useState<MonthlyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await SupabaseService.getMonthlyStats(familyId, month, year)
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки статистики')
    } finally {
      setLoading(false)
    }
  }

  const createOrUpdateStats = async (statsData: Omit<MonthlyStats, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setError(null)
      const newStats = await SupabaseService.createOrUpdateMonthlyStats(statsData)
      setStats(prev => {
        const existing = prev.find(s => s.month === newStats.month && s.year === newStats.year)
        if (existing) {
          return prev.map(s => s.id === newStats.id ? newStats : s)
        }
        return [newStats, ...prev]
      })
      return newStats
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения статистики')
      throw err
    }
  }

  const recalculateStats = async (month?: string, year?: number) => {
    try {
      setError(null)
      setLoading(true) // Показываем индикатор загрузки
      const currentDate = new Date()
      const targetMonth = month || String(currentDate.getMonth() + 1).padStart(2, '0')
      const targetYear = year || currentDate.getFullYear()
      
      console.log('🔄 Пересчитываем статистику для:', { familyId, targetMonth, targetYear })
      
      await SupabaseService.recalculateMonthlyStats(familyId, targetMonth, targetYear)
      await fetchStats() // Обновляем локальные данные
      
      console.log('✅ Статистика успешно пересчитана')
    } catch (err) {
      console.error('❌ Ошибка пересчета статистики:', err)
      setError(err instanceof Error ? err.message : 'Ошибка пересчета статистики')
      throw err
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (familyId) {
      fetchStats()
    }
  }, [familyId, month, year])

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
    createOrUpdateStats,
    recalculateStats
  }
}
