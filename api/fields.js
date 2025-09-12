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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    const { method } = req
    const path = req.url.split('?')[0]
    const segments = path.split('/').filter(Boolean)
    
    if (method === 'POST' && segments[1] === 'fields' && segments[2] === 'lock') {
      // POST /api/fields/lock
      return await lockField(req, res)
    } else if (method === 'POST' && segments[1] === 'fields' && segments[2] === 'unlock') {
      // POST /api/fields/unlock
      return await unlockField(req, res)
    } else if (method === 'POST' && segments[1] === 'fields' && segments[2] === 'update') {
      // POST /api/fields/update
      return await updateField(req, res)
    } else if (method === 'GET' && segments[1] === 'fields' && segments[3] === 'updates') {
      // GET /api/fields/{session_code}/updates
      return await getFieldUpdates(req, res, segments[2])
    } else {
      res.status(404).json({ error: 'Not found' })
    }
  } catch (error) {
    console.error('Fields API Error:', error)
    res.status(500).json({ error: error.message })
  }
}

async function lockField(req, res) {
  const { sessionCode, fieldId, userId } = req.body
  
  if (!sessionCode || !fieldId || !userId) {
    res.status(400).json({ success: false, message: 'Missing required fields' })
    return
  }
  
  try {
    // 현재 시간
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
      .single()
    
    if (existing && existing.locked_by && existing.locked_by !== userId) {
      // 다른 사용자가 락을 걸고 있는 경우
      const lockedAt = new Date(existing.locked_at)
      if (now.getTime() - lockedAt.getTime() < LOCK_TIMEOUT_MS) {
        res.status(200).json({ success: false, message: 'Field is locked by another user' })
        return
      }
    }
    
    // 락 설정
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
    
    res.status(200).json({ success: true, message: 'Field locked' })
  } catch (error) {
    console.error('Lock field error:', error)
    res.status(200).json({ success: false, message: 'Failed to lock field' })
  }
}

async function unlockField(req, res) {
  const { sessionCode, fieldId, userId } = req.body
  
  if (!sessionCode || !fieldId || !userId) {
    res.status(400).json({ success: false, message: 'Missing required fields' })
    return
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
    
    res.status(200).json({ success: true, message: 'Field unlocked' })
  } catch (error) {
    console.error('Unlock field error:', error)
    res.status(200).json({ success: true, message: 'Unlock attempted despite error' })
  }
}

async function updateField(req, res) {
  const { sessionCode, fieldId, value, userId } = req.body
  
  if (!sessionCode || !fieldId || !userId) {
    res.status(400).json({ success: false, message: 'Missing required fields' })
    return
  }
  
  try {
    // 락 확인
    const { data: existing } = await supabase
      .from('field_states')
      .select('*')
      .eq('session_code', sessionCode)
      .eq('field_id', fieldId)
      .single()
    
    if (existing && existing.locked_by && existing.locked_by !== userId) {
      const lockedAt = new Date(existing.locked_at)
      const now = new Date()
      if (now.getTime() - lockedAt.getTime() < LOCK_TIMEOUT_MS) {
        res.status(200).json({ success: false, message: 'Field is locked by another user' })
        return
      }
    }
    
    // 값 업데이트
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
    
    res.status(200).json({ success: true, message: 'Field updated' })
  } catch (error) {
    console.error('Update field error:', error)
    res.status(200).json({ success: false, message: 'Failed to update field' })
  }
}

async function getFieldUpdates(req, res, sessionCode) {
  const { since = 0 } = req.query
  const sinceDate = new Date(parseInt(since) || 0)
  
  try {
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
    
    if (error) throw error
    
    const fields = {}
    const values = {}
    let lastUpdate = since
    
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
    
    res.status(200).json({
      fields,
      values,
      lastUpdate
    })
  } catch (error) {
    console.error('Get field updates error:', error)
    res.status(200).json({
      fields: {},
      values: {},
      lastUpdate: since
    })
  }
}