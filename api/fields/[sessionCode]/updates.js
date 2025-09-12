import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// 락 만료 시간 (30초)
const LOCK_TIMEOUT_MS = 30 * 1000

export default async function handler(req, res) {
  // CORS 처리
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // GET 요청만 처리
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const { sessionCode } = req.query
    const { since = '0' } = req.query
    
    console.log(`[Field Updates] Session: ${sessionCode}, Since: ${since}`)
    
    if (!sessionCode) {
      res.status(400).json({ error: 'Session code is required' })
      return
    }

    // since 파라미터 처리
    let sinceTimestamp = 0
    if (since && since !== '0') {
      // since가 "0:1" 형태인 경우 첫 번째 부분만 사용
      const sinceParts = since.toString().split(':')
      sinceTimestamp = parseInt(sinceParts[0]) || 0
    }
    
    const sinceDate = new Date(sinceTimestamp)
    console.log(`[Field Updates] Since date: ${sinceDate.toISOString()}`)

    // 세션 존재 확인
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('code')
      .eq('code', sessionCode)
      .single()

    if (sessionError || !sessionData) {
      console.log(`[Field Updates] Session not found: ${sessionCode}`)
      res.status(404).json({ 
        error: 'Session not found',
        fields: {},
        values: {},
        lastUpdate: sinceTimestamp
      })
      return
    }

    // 만료된 락 정리
    const lockExpiry = new Date(Date.now() - LOCK_TIMEOUT_MS)
    await supabase
      .from('field_states')
      .update({ locked_by: null, locked_at: null })
      .lt('locked_at', lockExpiry.toISOString())
      .eq('session_code', sessionCode)

    // 업데이트된 필드 조회
    const { data, error } = await supabase
      .from('field_states')
      .select('*')
      .eq('session_code', sessionCode)
      .gte('updated_at', sinceDate.toISOString())
      .order('updated_at', { ascending: true })

    if (error) {
      console.error(`[Field Updates] Database error:`, error)
      throw error
    }

    console.log(`[Field Updates] Found ${data?.length || 0} field updates`)

    const fields = {}
    const values = {}
    let lastUpdate = sinceTimestamp

    if (data && data.length > 0) {
      data.forEach(field => {
        fields[field.field_id] = {
          locked_by: field.locked_by,
          locked_at: field.locked_at,
          user_id: field.user_id
        }
        values[field.field_id] = field.value || ''

        const updateTime = new Date(field.updated_at).getTime()
        if (updateTime > lastUpdate) {
          lastUpdate = updateTime
        }
      })
    }

    res.status(200).json({
      fields,
      values,
      lastUpdate,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Field Updates] Error:', error)
    res.status(500).json({
      error: 'Internal server error',
      fields: {},
      values: {},
      lastUpdate: parseInt(req.query.since) || 0
    })
  }
}