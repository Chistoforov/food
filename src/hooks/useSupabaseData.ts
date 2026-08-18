import { useState, useEffect, useCallback, useRef } from 'react'
import { SupabaseService } from '../services/supabaseService'
import { Product, Receipt, ProductHistory, MonthlyStats } from '../lib/supabase'

// Хук для работы с продуктами
export const useProducts = (familyId: number) => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const inFlightRef = useRef(false)
  const productsRef = useRef<Product[]>([])

  const fetchProducts = useCallback(async (limit?: number, offset?: number, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)
      const data = await SupabaseService.getProducts(familyId, limit, offset)

      if (append) {
        setProducts(prev => {
          const seen = new Set(prev.map(p => p.id))
          const fresh = data.filter(p => !seen.has(p.id))
          const next = [...prev, ...fresh]
          productsRef.current = next
          return next
        })
      } else {
        setProducts(data)
        productsRef.current = data
      }

      // Если вернулось меньше, чем limit, значит это последняя страница
      if (limit !== undefined && data.length < limit) {
        setHasMore(false)
      } else if (limit !== undefined) {
        setHasMore(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки продуктов')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [familyId])

  const loadMore = useCallback(async (limit: number) => {
    if (inFlightRef.current || !hasMore) return
    inFlightRef.current = true
    try {
      await fetchProducts(limit, productsRef.current.length, true)
    } finally {
      inFlightRef.current = false
    }
  }, [hasMore, fetchProducts])

  const updateProduct = async (id: number, updates: Partial<Product>) => {
    try {
      setError(null)
      const updatedProduct = await SupabaseService.updateProduct(id, updates)
      setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p))
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
      // Загружаем первые 100 продуктов при инициализации (достаточно для аналитики)
      fetchProducts(100, 0, false)
    }
  }, [familyId, fetchProducts])

  return {
    products,
    loading,
    loadingMore,
    hasMore,
    error,
    refetch: fetchProducts,
    loadMore,
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
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchReceipts = useCallback(async (limit?: number, offset?: number, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }
      setError(null)
      const data = await SupabaseService.getReceipts(familyId, limit, offset)
      
      if (append) {
        setReceipts(prev => [...prev, ...data])
      } else {
        setReceipts(data)
      }
      
      // Если вернулось меньше, чем limit, значит это последняя страница
      if (limit !== undefined && data.length < limit) {
        setHasMore(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки чеков')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [familyId])

  const loadMore = useCallback(async (limit: number) => {
    if (!hasMore || loadingMore) return
    await fetchReceipts(limit, receipts.length, true)
  }, [hasMore, loadingMore, receipts.length, fetchReceipts])

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

  const deleteReceipt = async (id: number) => {
    try {
      setError(null)
      console.log('🗑️ Удаляем чек #' + id + ' из базы данных...')
      
      await SupabaseService.deleteReceipt(id, familyId)
      
      console.log('✅ Чек удален из БД, обновляем локальное состояние...')
      setReceipts(prev => {
        const filtered = prev.filter(r => r.id !== id)
        console.log('📊 Чеков до удаления:', prev.length, 'после удаления:', filtered.length)
        return filtered
      })
      
      console.log('✅ Локальное состояние обновлено')
    } catch (err) {
      console.error('❌ Ошибка удаления чека:', err)
      setError(err instanceof Error ? err.message : 'Ошибка удаления чека')
      throw err
    }
  }

  useEffect(() => {
    if (familyId) {
      // Загружаем первые 20 чеков при инициализации
      fetchReceipts(20, 0, false)
    }
  }, [familyId, fetchReceipts])

  return {
    receipts,
    loading,
    loadingMore,
    hasMore,
    error,
    refetch: fetchReceipts,
    loadMore,
    createReceipt,
    deleteReceipt
  }
}

// Хук для работы с историей продуктов
export const useProductHistory = (productId: number, familyId: number) => {
  const [history, setHistory] = useState<ProductHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
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
  }, [productId, familyId])

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
  }, [productId, familyId, fetchHistory])

  return {
    history,
    loading,
    error,
    refetch: fetchHistory,
    addHistory
  }
}

// Хук для работы с историей типа продуктов (все продукты одного типа)
export const useProductTypeHistory = (productType: string | null, familyId: number) => {
  const [history, setHistory] = useState<ProductHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!productType) {
      setHistory([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await SupabaseService.getProductTypeHistory(productType, familyId)
      setHistory(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки истории типа продукта')
    } finally {
      setLoading(false)
    }
  }, [productType, familyId])

  useEffect(() => {
    if (productType && familyId) {
      fetchHistory()
    } else {
      setHistory([])
      setLoading(false)
    }
  }, [productType, familyId, fetchHistory])

  return {
    history,
    loading,
    error,
    refetch: fetchHistory
  }
}

// Хук для работы со статистикой
export const useMonthlyStats = (familyId: number, month?: string, year?: number) => {
  const [stats, setStats] = useState<MonthlyStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
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
  }, [familyId, month, year])

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

  const recalculateStats = useCallback(async (month?: string, year?: number) => {
    try {
      setError(null)
      setLoading(true) // Показываем индикатор загрузки
      
      // Если месяц и год не указаны, пересчитываем все месяцы с чеками
      if (!month || !year) {
        console.log('🔄 Пересчитываем статистику для всех месяцев с чеками...')
        await SupabaseService.recalculateAllMonthsWithReceipts(familyId)
      } else {
        const currentDate = new Date()
        const targetMonth = month || String(currentDate.getMonth() + 1).padStart(2, '0')
        const targetYear = year || currentDate.getFullYear()
        
        console.log('🔄 Пересчитываем статистику для:', { familyId, targetMonth, targetYear })
        
        await SupabaseService.recalculateMonthlyStats(familyId, targetMonth, targetYear)
      }
      
      await fetchStats() // Обновляем локальные данные
      
      console.log('✅ Статистика успешно пересчитана')
    } catch (err) {
      console.error('❌ Ошибка пересчета статистики:', err)
      setError(err instanceof Error ? err.message : 'Ошибка пересчета статистики')
      throw err
    } finally {
      setLoading(false)
    }
  }, [familyId, fetchStats])

  const recalculateAllAnalytics = useCallback(async () => {
    try {
      setError(null)
      setLoading(true) // Показываем индикатор загрузки
      
      console.log('🔄 Пересчитываем всю аналитику для семьи:', familyId)
      
      await SupabaseService.recalculateFamilyAnalytics(familyId)
      await fetchStats() // Обновляем локальные данные
      
      console.log('✅ Вся аналитика успешно пересчитана')
    } catch (err) {
      console.error('❌ Ошибка пересчета всей аналитики:', err)
      setError(err instanceof Error ? err.message : 'Ошибка пересчета всей аналитики')
      throw err
    } finally {
      setLoading(false)
    }
  }, [familyId, fetchStats])

  useEffect(() => {
    if (familyId) {
      fetchStats()
    }
  }, [familyId, month, year, fetchStats])

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
    createOrUpdateStats,
    recalculateStats,
    recalculateAllAnalytics
  }
}
