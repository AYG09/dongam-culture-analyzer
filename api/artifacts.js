import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // CORS 처리
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    const { method } = req
    const path = req.url.split('?')[0]
    const segments = path.split('/').filter(Boolean)
    
    if (method === 'POST' && segments[1] === 'artifacts') {
      // POST /api/artifacts - 아티팩트 생성
      return await createArtifact(req, res)
    } else if (method === 'GET' && segments[1] === 'artifacts' && !segments[2]) {
      // GET /api/artifacts - 아티팩트 목록 조회
      return await listArtifacts(req, res)
    } else if (method === 'GET' && segments[1] === 'artifacts' && segments[2]) {
      // GET /api/artifacts/{id} - 특정 아티팩트 조회
      return await getArtifact(req, res, segments[2])
    } else if (method === 'DELETE' && segments[1] === 'artifacts' && segments[2]) {
      // DELETE /api/artifacts/{id} - 아티팩트 삭제
      return await deleteArtifact(req, res, segments[2])
    } else {
      res.status(404).json({ error: 'Not found' })
    }
  } catch (error) {
    console.error('Artifacts API Error:', error)
    res.status(500).json({ error: error.message })
  }
}

async function createArtifact(req, res) {
  const { content, team, label, type, sessionCode } = req.body
  
  if (!content) {
    res.status(400).json({ error: 'content is required' })
    return
  }
  
  const id = uuidv4().replace(/-/g, '').substring(0, 16)
  
  const { data, error } = await supabase
    .from('artifacts')
    .insert([{
      id,
      session_code: sessionCode || null,
      team: team || null,
      label: label || null,
      type: type || null,
      content,
      created_at: new Date().toISOString()
    }])
    .select()
  
  if (error) {
    console.error('Supabase insert error:', error)
    throw error
  }
  
  res.status(201).json({ id })
}

async function listArtifacts(req, res) {
  const { session } = req.query
  
  let query = supabase
    .from('artifacts')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (session) {
    query = query.eq('session_code', session)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Supabase select error:', error)
    throw error
  }
  
  res.status(200).json({ items: data })
}

async function getArtifact(req, res, artifactId) {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('id', artifactId)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') {
      res.status(404).json({ error: 'Artifact not found' })
      return
    }
    console.error('Supabase select error:', error)
    throw error
  }
  
  res.status(200).json(data)
}

async function deleteArtifact(req, res, artifactId) {
  const { error } = await supabase
    .from('artifacts')
    .delete()
    .eq('id', artifactId)
  
  if (error) {
    console.error('Supabase delete error:', error)
    throw error
  }
  
  res.status(200).json({ ok: true })
}