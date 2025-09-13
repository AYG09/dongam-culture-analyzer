// GET /api/spirits - 루트 라우트 버전 (단일 구현)
import fs from 'fs/promises'
import path from 'path'
const DATA_PATH = path.join(process.cwd(), 'api', 'data', 'dongam_spirit.json')

// 간단 캐시 (기본 60초)
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
    console.error('[spirits] Failed to access JSON:', e)
    return { spirits: [] }
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const data = await loadSpirits()
    res.status(200).json(data)
  } catch (error) {
    console.error('Spirits API Error:', error)
    res.status(500).json({ spirits: [] })
  }
}
