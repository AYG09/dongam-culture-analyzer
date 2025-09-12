import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const { sessionCode } = req.query

  if (!sessionCode) {
    return res.status(400).json({ error: 'Session code is required' })
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getSession(req, res, sessionCode)
      case 'PUT':
        return await updateSession(req, res, sessionCode)
      case 'DELETE':
        return await deleteSession(req, res, sessionCode)
      default:
        res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Session API Error:', error)
    res.status(500).json({ error: error.message || 'Unknown error' })
  }
}

async function getSession(req, res, sessionCode) {
  // 세션 정보와 마지막 접근 시간 업데이트
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('code', sessionCode)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Session not found' })
    }
    throw error
  }

  // 마지막 접근 시간 업데이트
  await supabase
    .from('sessions')
    .update({ last_access: new Date().toISOString() })
    .eq('code', sessionCode)

  res.status(200).json(data)
}

async function updateSession(req, res, sessionCode) {
  const updates = req.body

  const { data, error } = await supabase
    .from('sessions')
    .update(updates)
    .eq('code', sessionCode)
    .select()

  if (error) throw error

  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'Session not found' })
  }

  res.status(200).json(data[0])
}

async function deleteSession(req, res, sessionCode) {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('code', sessionCode)

  if (error) throw error

  res.status(200).json({ message: 'Session deleted successfully' })
}