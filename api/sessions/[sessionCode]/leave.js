import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sessionCode } = req.query

  if (!sessionCode) {
    return res.status(400).json({ error: 'Session code is required' })
  }

  try {
    // 세션 존재 여부 확인
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('code', sessionCode)
      .single()

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Session not found' })
      }
      throw sessionError
    }

    // 참가자 수 감소 (0 이하로는 내려가지 않도록)
    const newCount = Math.max((session.participant_count || 1) - 1, 0)
    
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ 
        participant_count: newCount,
        last_access: new Date().toISOString()
      })
      .eq('code', sessionCode)

    if (updateError) {
      console.error('Failed to update participant count:', updateError)
      // 참가자 수 업데이트 실패해도 나가기는 성공으로 처리
    }

    res.status(200).json({
      success: true,
      message: 'Successfully left session',
      participant_count: newCount
    })
  } catch (error) {
    console.error('Session leave error:', error)
    res.status(500).json({ error: error.message || 'Failed to leave session' })
  }
}