import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('Health check - Testing Supabase connection...')
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Not set')
    console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Not set')

    // 간단한 쿼리로 연결 테스트
    const { data, error } = await supabase
      .from('sessions')
      .select('count(*)')
      .limit(1)

    if (error) {
      console.error('Supabase connection error:', error)
      return res.status(500).json({ 
        status: 'error', 
        message: 'Database connection failed',
        error: error.message,
        details: error
      })
    }

    console.log('Supabase connection successful')
    res.status(200).json({ 
      status: 'ok', 
      message: 'API and database are working',
      timestamp: new Date().toISOString(),
      database: 'connected'
    })
  } catch (error) {
    console.error('Health check error:', error)
    res.status(500).json({ 
      status: 'error', 
      message: 'Health check failed',
      error: error.message 
    })
  }
}