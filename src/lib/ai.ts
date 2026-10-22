
import { supabase } from './supabase'

export async function askPocketwiseAI(message: string): Promise<string> {
  if (!supabase) {
    throw new Error('Pocketwise is not connected to Supabase.')
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()

  if (sessionError || !sessionData.session) {
    throw new Error('Please sign in before using Pocketwise AI.')
  }

  const { data, error } = await supabase.functions.invoke(
    'pocketwise-ai',
    {
      body: { message },
    },
  )

  if (error) {
    throw new Error('Pocketwise AI could not respond. Please try again.')
  }

  if (!data || typeof data.answer !== 'string') {
    throw new Error('Pocketwise AI returned an unexpected response.')
  }

  return data.answer
}
