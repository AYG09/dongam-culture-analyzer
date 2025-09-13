// GET /api/spirits - 서버리스 디렉토리 라우트 버전
import fs from 'fs/promises'
import path from 'path'
const DATA_PATH = path.join(process.cwd(), 'api', 'data', 'dongam_spirit.json')

const TTL_SECONDS = Number(process.env.PROMPT_CACHE_TTL_SECONDS || 60)
let CACHE = { data: null, ts: 0 }

async function loadSpirits() {
  const now = Date.now() / 1000
  if (CACHE.data && now - CACHE.ts < TTL_SECONDS) return CACHE.data
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8')
    const data = JSON.parse(raw)
    CACHE = { data, ts: now }
    return data
  } catch (e) {
    console.error('[spirits/index] Failed to access JSON:', e)
    return { spirits: [] }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const data = await loadSpirits()
    res.status(200).json(data)
  } catch (error) {
    console.error('Spirits Index API Error:', error)
    res.status(500).json({ spirits: [] })
  }
}
