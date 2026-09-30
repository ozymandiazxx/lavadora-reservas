import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isDemoMode = !url || !anonKey

export const supabase: SupabaseClient | null = isDemoMode ? null : createClient(url, anonKey)
