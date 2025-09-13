// GET /api/spirits
// FastAPI의 /api/spirits와 동일한 스키마({ spirits: [...] })를 반환합니다.
// 로컬 파일 backend/modules/dongam_spirit.json을 읽어 응답하며, 간단한 메모리 캐시를 적용합니다.

import fs from 'fs/promises'
import path from 'path'

const TTL_SECONDS = Number(process.env.PROMPT_CACHE_TTL_SECONDS || 60)
let CACHE = { data: null, ts: 0 }

function spiritsJsonPath() {
  return path.join(process.cwd(), 'backend', 'modules', 'dongam_spirit.json')
}

async function loadSpirits() {
  const now = Date.now() / 1000
  if (CACHE.data && now - CACHE.ts < TTL_SECONDS) return CACHE.data
  try {
    const raw = await fs.readFile(spiritsJsonPath(), 'utf-8')
    const json = JSON.parse(raw)
    CACHE = { data: json, ts: now }
    return json
  } catch (e) {
    console.error('[spirits] Failed to read JSON:', e)
    return { spirits: [] }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const data = await loadSpirits()
    res.status(200).json(data)
  } catch (error) {
    console.error('Spirits API Error:', error)
    res.status(500).json({ spirits: [] })
  }
}
