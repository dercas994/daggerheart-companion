import type { Backend } from '../types'
import { createSupabaseBackend } from './supabase'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = Boolean(url && key)
export const backend: Backend | null = configured ? createSupabaseBackend(url!, key!) : null
