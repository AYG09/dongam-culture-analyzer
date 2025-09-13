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

    console.log(`[LOCK API] Attempt: sessionCode=${sessionCode}, fieldId=${fieldId}, userId=${userId}`)

    // 만료된 락 정리
    const { data: expiredCleanup, error: cleanupError } = await supabase
      .from('field_states')
      .update({ locked_by: null, locked_at: null })
      .lt('locked_at', lockExpiry.toISOString())
      .eq('session_code', sessionCode)
      .select()

    if (cleanupError) {
      console.error('[LOCK API] Cleanup error:', cleanupError)
    } else {
      console.log(`[LOCK API] Cleaned up ${expiredCleanup?.length || 0} expired locks`)
    }

    // 현재 필드 상태 확인
    const { data: existing, error: selectError } = await supabase
      .from('field_states')
      .select('*')
      .eq('session_code', sessionCode)
      .eq('field_id', fieldId)
      .maybeSingle()

    if (selectError) {
      console.error('[LOCK API] Select error:', selectError)
      throw selectError
    }

    console.log(`[LOCK API] Existing state:`, existing)

    if (existing && existing.locked_by && existing.locked_by !== userId) {
      const lockedAt = new Date(existing.locked_at)
      const lockAge = now.getTime() - lockedAt.getTime()
      console.log(`[LOCK API] Field locked by different user: ${existing.locked_by} (age: ${lockAge}ms, timeout: ${LOCK_TIMEOUT_MS}ms)`)
      
      if (lockAge < LOCK_TIMEOUT_MS) {
        console.log(`[LOCK API] Lock still valid, rejecting`)
        return res.status(200).json({ success: false, message: 'Field is locked by another user' })
      } else {
        console.log(`[LOCK API] Lock expired, proceeding`)
      }
    } else if (existing && existing.locked_by === userId) {
      console.log(`[LOCK API] Field already locked by same user, proceeding`)
    } else {
      console.log(`[LOCK API] Field not locked, proceeding`)
    }

    const upsertData = {
      session_code: sessionCode,
      field_id: fieldId,
      user_id: userId,
      locked_by: userId,
      locked_at: now.toISOString(),
      updated_at: now.toISOString()
    }
    console.log(`[LOCK API] Upserting:`, upsertData)

    const { data: upsertResult, error } = await supabase
      .from('field_states')
      .upsert(upsertData)
      .select()

    if (error) {
      console.error('[LOCK API] Upsert error:', error)
      throw error
    }

    console.log(`[LOCK API] Upsert success:`, upsertResult)
    return res.status(200).json({ success: true, message: 'Field locked' })
  } catch (error) {
    console.error('[LOCK API] General error:', error)
    return res.status(200).json({ success: false, message: 'Failed to lock field', error: error.message })
  }
}
