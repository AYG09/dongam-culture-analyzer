import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

const LOCK_TIMEOUT_MS = 30 * 1000

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { sessionCode, fieldId, value, userId } = req.body || {}
  if (!sessionCode || !fieldId || !userId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' })
  }

  try {
    // 현재 락 확인
    const { data: existing } = await supabase
      .from('field_states')
      .select('*')
      .eq('session_code', sessionCode)
      .eq('field_id', fieldId)
      .maybeSingle()

    if (existing && existing.locked_by && existing.locked_by !== userId) {
      const lockedAt = new Date(existing.locked_at)
      const now = new Date()
      if (now.getTime() - lockedAt.getTime() < LOCK_TIMEOUT_MS) {
        return res.status(200).json({ success: false, message: 'Field is locked by another user' })
      }
    }

    const { error } = await supabase
      .from('field_states')
      .upsert({
        session_code: sessionCode,
        field_id: fieldId,
        user_id: userId,
        value: value || '',
        updated_at: new Date().toISOString()
      })

    if (error) throw error
    return res.status(200).json({ success: true, message: 'Field updated' })
  } catch (error) {
    console.error('Update field error:', error)
    return res.status(200).json({ success: false, message: 'Failed to update field' })
  }
}
