import { createClient } from '@supabase/supabase-js'
import spiritsData from './data/dongam_spirit.json' assert { type: 'json' }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// 데이터는 번들 시 JSON import로 포함됩니다.
async function loadSpirits() {
  try {
    return spiritsData
  } catch (e) {
    console.error('[generate-prompt] Failed to access spirits json:', e)
    return { spirits: [] }
  }
}

// 프롬프트 생성 함수 (기존 로직 유지)
function buildPrompt(payload, spirit) {
  const { activityName, coreText, teamLeaderObservation, outcomes, outputs, factors, keyLearning } = payload
  
  let prompt = `다음 내용을 바탕으로 "${spirit.name}" 조직문화 관점에서 분석해 주세요.\n\n`
  prompt += `**활동명**: ${activityName}\n`
  prompt += `**핵심 내용**: ${coreText}\n`
  
  if (teamLeaderObservation) {
    prompt += `**팀장 관찰사항**: ${teamLeaderObservation}\n`
  }
  
  if (outcomes) {
    prompt += `**목표**: ${outcomes}\n`
  }
  
  if (outputs) {
    prompt += `**실행/결과**: ${outputs}\n`
  }
  
  if (factors) {
    prompt += `**촉진/저해 요인**: ${factors}\n`
  }
  
  if (keyLearning) {
    prompt += `**주요 교훈**: ${keyLearning}\n`
  }
  
  prompt += `\n**${spirit.name}**의 관점에서:\n`
  prompt += `${spirit.description}\n\n`
  prompt += `이 활동이 조직문화에 미친 영향을 분석하고, JSON 형태로 다음과 같이 구조화해서 응답해 주세요:\n\n`
  prompt += `{\n`
  prompt += `  "spirit_analysis": {\n`
  prompt += `    "spirit_name": "${spirit.name}",\n`
  prompt += `    "relevance_score": 85,\n`
  prompt += `    "key_insights": ["통찰1", "통찰2", "통찰3"],\n`
  prompt += `    "impact_areas": ["영향영역1", "영향영역2"]\n`
  prompt += `  },\n`
  prompt += `  "activated_levers": [\n`
  prompt += `    {"lever_name": "협력", "activation_level": 80, "evidence": "구체적 근거"},\n`
  prompt += `    {"lever_name": "소통", "activation_level": 70, "evidence": "구체적 근거"}\n`
  prompt += `  ],\n`
  prompt += `  "recommendations": [\n`
  prompt += `    "개선 제안 1",\n`
  prompt += `    "개선 제안 2"\n`
  prompt += `  ]\n`
  prompt += `}`
  
  return prompt
}

function getSpiritById(spiritId, data) {
  const list = Array.isArray(data?.spirits) ? data.spirits : []
  return list.find(s => s.id === spiritId)
}

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
    if (req.method === 'GET') {
      // GET /api/generate-prompt → 동암정신 전체 데이터 반환
      const spiritsData = await loadSpirits()
      res.status(200).json(spiritsData)
    } else if (req.method === 'POST') {
      // POST /api/generate-prompt - 프롬프트 생성
      const { spiritId, activityName, coreText, text, teamLeaderObservation, outcomes, outputs, factors, keyLearning } = req.body
      
      if (!spiritId) {
        res.status(400).json({ error: 'spiritId is required' })
        return
      }
      
      const spiritsData = await loadSpirits()
      const spirit = getSpiritById(spiritId, spiritsData)
      if (!spirit) {
        res.status(404).json({ error: 'Unknown spiritId' })
        return
      }
      
      const core = (coreText || text || '').trim()
      if (!core) {
        res.status(400).json({ error: 'coreText is required' })
        return
      }
      
      const payload = {
        activityName,
        coreText: core,
        teamLeaderObservation,
        outcomes,
        outputs,
        factors,
        keyLearning
      }
      
      const prompt = buildPrompt(payload, spirit)
      res.status(200).json({ prompt })
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Generate Prompt API Error:', error)
    res.status(500).json({ error: error.message })
  }
}