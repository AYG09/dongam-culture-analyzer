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

  const { sessionCode, fieldId, userId } = req.body || {}
  if (!sessionCode || !fieldId || !userId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' })
  }

  try {
    const now = new Date()
    const lockExpiry = new Date(now.getTime() - LOCK_TIMEOUT_MS)

    // 만료된 락 정리
    await supabase
      .from('field_states')
      .update({ locked_by: null, locked_at: null })
      .lt('locked_at', lockExpiry.toISOString())
      .eq('session_code', sessionCode)

    // 현재 필드 상태 확인
    const { data: existing } = await supabase
      .from('field_states')
      .select('*')
      .eq('session_code', sessionCode)
      .eq('field_id', fieldId)
      .maybeSingle()

    if (existing && existing.locked_by && existing.locked_by !== userId) {
      const lockedAt = new Date(existing.locked_at)
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
        locked_by: userId,
        locked_at: now.toISOString(),
        updated_at: now.toISOString()
      })
    if (error) throw error

    return res.status(200).json({ success: true, message: 'Field locked' })
  } catch (error) {
    console.error('Lock field error:', error)
    return res.status(200).json({ success: false, message: 'Failed to lock field' })
  }
}
