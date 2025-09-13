import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

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
    const { error } = await supabase
      .from('field_states')
      .update({
        locked_by: null,
        locked_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('session_code', sessionCode)
      .eq('field_id', fieldId)
      .eq('locked_by', userId)

    if (error) throw error
    return res.status(200).json({ success: true, message: 'Field unlocked' })
  } catch (error) {
    console.error('Unlock field error:', error)
    // 클라이언트 동작 유지: 오류가 있어도 성공처럼 응답
    return res.status(200).json({ success: true, message: 'Unlock attempted despite error' })
  }
}
