import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Проверяем наличие обязательных переменных окружения
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required. Please check your environment variables.')
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is required. Please check your environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Типы данных для TypeScript
export interface Product {
  id: number
  name: string
  original_name?: string
  last_purchase: string
  avg_days: number | null
  predicted_end: string | null
  status: 'ending-soon' | 'ok' | 'calculating'
  calories: number
  price: number
  purchase_count: number
  family_id: number
  created_at: string
  updated_at: string
}

export interface Receipt {
  id: number
  date: string
  items_count: number
  total_amount: number
  status: 'processed' | 'pending' | 'error'
  family_id: number
  image_url?: string
  created_at: string
}

export interface Family {
  id: number
  name: string
  member_count: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductHistory {
  id: number
  product_id: number
  date: string
  quantity: number
  price: number
  unit_price: number
  family_id: number
  receipt_id?: number
  created_at: string
}

export interface MonthlyStats {
  id: number
  family_id: number
  month: string
  year: number
  total_spent: number
  total_calories: number
  avg_calories_per_day: number
  receipts_count: number
  created_at: string
  updated_at: string
}

export interface PendingReceipt {
  id: number
  family_id: number
  image_url: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error_message?: string
  parsed_data?: any
  created_at: string
  processed_at?: string
  attempts: number
}
