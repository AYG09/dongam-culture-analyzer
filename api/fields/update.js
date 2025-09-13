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

    // UPDATE → INSERT 패턴으로 duplicate key 오류 방지
    const updateData = {
      user_id: userId,
      value: value || '',
      updated_at: new Date().toISOString()
    }
    console.log(`[UPDATE API] Attempting to update field: sessionCode=${sessionCode}, fieldId=${fieldId}, userId=${userId}`)

    const { data: updateResult, error: updateError } = await supabase
      .from('field_states')
      .update(updateData)
      .eq('session_code', sessionCode)
      .eq('field_id', fieldId)
      .select()

    if (updateError) {
      console.error('[UPDATE API] Update error:', updateError)
      throw updateError
    }

    if (updateResult && updateResult.length > 0) {
      console.log(`[UPDATE API] Updated existing record:`, updateResult)
    } else {
      // 레코드가 없으면 INSERT
      console.log(`[UPDATE API] No existing record, inserting new one`)
      const insertData = {
        session_code: sessionCode,
        field_id: fieldId,
        user_id: userId,
        value: value || '',
        updated_at: new Date().toISOString()
      }
      
      const { data: insertResult, error: insertError } = await supabase
        .from('field_states')
        .insert(insertData)
        .select()

      if (insertError) {
        console.error('[UPDATE API] Insert error:', insertError)
        throw insertError
      }
      console.log(`[UPDATE API] Inserted new record:`, insertResult)
    }

    console.log(`[UPDATE API] Field update completed successfully`)
    return res.status(200).json({ success: true, message: 'Field updated' })
  } catch (error) {
    console.error('Update field error:', error)
    return res.status(200).json({ success: false, message: 'Failed to update field' })
  }
}
