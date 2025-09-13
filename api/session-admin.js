import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // 인증 확인
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '인증이 필요합니다.' })
    }

    const token = authHeader.substring(7)
    if (token !== process.env.GATEWAY_ADMIN_PASSWORD) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' })
    }

    switch (req.method) {
      case 'GET': {
        return await handleGetSessions(req, res)
      }

      case 'DELETE': {
        return await handleDeleteSession(req, res)
      }

      default:
        res.setHeader('Allow', ['GET', 'DELETE'])
        return res.status(405).json({ error: `Method ${req.method} not allowed` })
    }
  } catch (error) {
    console.error('Session admin API error:', error)
    return res.status(500).json({ error: '내부 서버 오류가 발생했습니다.' })
  }
}

async function handleGetSessions(req, res) {
  const { search, page = 1, limit = 20 } = req.query
  const offset = (parseInt(page) - 1) * parseInt(limit)

  try {
    let query = supabase
      .from('gateway_sessions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // 검색 기능 - 세션 ID, IP 주소, User Agent에서 검색
    if (search && search.trim()) {
      query = query.or(`session_id.ilike.%${search}%,ip_address.ilike.%${search}%,user_agent.ilike.%${search}%`)
    }

    const { data: sessions, error, count } = await query
      .range(offset, offset + parseInt(limit) - 1)

    if (error) {
      console.error('Sessions fetch error:', error)
      return res.status(500).json({ error: '세션 목록을 가져오는데 실패했습니다.' })
    }

    return res.status(200).json({
      sessions: sessions || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil((count || 0) / parseInt(limit))
    })
  } catch (error) {
    console.error('Get sessions error:', error)
    return res.status(500).json({ error: '세션 조회 중 오류가 발생했습니다.' })
  }
}

async function handleDeleteSession(req, res) {
  const { sessionId } = req.query

  if (!sessionId) {
    return res.status(400).json({ error: '세션 ID가 필요합니다.' })
  }

  try {
    const { error } = await supabase
      .from('gateway_sessions')
      .delete()
      .eq('session_id', sessionId)

    if (error) {
      console.error('Session delete error:', error)
      return res.status(500).json({ error: '세션 삭제에 실패했습니다.' })
    }

    return res.status(200).json({ 
      message: '세션이 성공적으로 삭제되었습니다.',
      sessionId 
    })
  } catch (error) {
    console.error('Delete session error:', error)
    return res.status(500).json({ error: '세션 삭제 중 오류가 발생했습니다.' })
  }
}