
import type { AppData } from '../types'
import { supabase } from './supabase'

export async function loadCloudData(): Promise<AppData | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError

  const user = authData.user
  if (!user) {
    throw new Error('Please sign in before loading your budget.')
  }

  const { data, error } = await supabase
    .from('user_app_state')
    .select('data')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error

  return data ? (data.data as AppData) : null
}

export async function saveCloudData(appData: AppData): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError

  const user = authData.user
  if (!user) {
    throw new Error('Please sign in before saving your budget.')
  }

  const { error } = await supabase
    .from('user_app_state')
    .upsert(
      {
        user_id: user.id,
        data: appData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) throw error
}
