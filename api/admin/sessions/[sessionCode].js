import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // 간단한 인증 확인 (실제로는 JWT 토큰 검증해야 함)
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { sessionCode } = req.query

  try {
    switch (req.method) {
      case 'GET':
        return await getSessionDetails(req, res, sessionCode)
      case 'DELETE':
        return await deleteSession(req, res, sessionCode)
      default:
        res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Admin session API error:', error)
    res.status(500).json({ error: error.message || 'Unknown error' })
  }
}

async function getSessionDetails(req, res, sessionCode) {
  const { data: session, error } = await supabase
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

  // 관련 아티팩트 수 조회
  const { data: artifacts, error: artifactsError } = await supabase
    .from('artifacts')
    .select('id')
    .eq('session_code', sessionCode)

  if (artifactsError) {
    console.error('Failed to get artifacts count:', artifactsError)
  }

  res.status(200).json({
    ...session,
    artifacts_count: artifacts ? artifacts.length : 0
  })
}

async function deleteSession(req, res, sessionCode) {
  // 세션과 관련 데이터 모두 삭제 (CASCADE로 자동 처리됨)
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('code', sessionCode)

  if (error) {
    throw error
  }

  res.status(200).json({ 
    success: true,
    message: 'Session deleted successfully' 
  })
}