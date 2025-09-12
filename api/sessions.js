import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// 6자리 세션 코드 생성 (기존 로직 유지)
function generateSessionCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    switch (req.method) {
      case 'POST':
        return await createSession(req, res)
      case 'GET':
        return await getSessions(req, res)
      default:
        res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Sessions API Error:', error)
    res.status(500).json({ error: error.message || 'Unknown error' })
  }
}

async function createSession(req, res) {
  console.log('Creating session with data:', req.body)
  
  const { name, description } = req.body
  
  if (!name) {
    console.log('Error: Session name is required')
    return res.status(400).json({ error: 'Session name is required' })
  }
  
  const code = generateSessionCode()
  console.log('Generated session code:', code)

  const sessionData = {
    code,
    name,
    description: description || null,
    participant_count: 0,
    created_at: new Date().toISOString(),
    last_access: new Date().toISOString()
  }
  
  console.log('Inserting session data:', sessionData)

  const { data, error } = await supabase
    .from('sessions')
    .insert([sessionData])
    .select()

  if (error) {
    console.error('Supabase insert error:', error)
    throw error
  }
  
  console.log('Session created successfully:', data[0])
  res.status(201).json(data[0])
}

async function getSessions(req, res) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  res.status(200).json({ sessions: data })
}