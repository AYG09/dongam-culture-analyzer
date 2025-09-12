import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// 동암정신 데이터 (정적)
const spiritsData = {
  "spirits": [
    {
      "id": "spirit_01",
      "name": "불우재(不尤哉) 정신",
      "description": "온갖 난관에도 좌절하지 않으며 하늘을 원망하지 않고 남이나 주변을 절대 탓하지 않는다.",
      "image": "/culture_maps/불우재정신.png"
    },
    {
      "id": "spirit_02", 
      "name": "숭조위선 효우정신",
      "description": "조상을 높여 소중히 여기고 부모에게 효도하며 형제 간에 우애한다.",
      "image": "/culture_maps/숭조위선효우정신.png"
    },
    {
      "id": "spirit_03",
      "name": "불굴의 도전정신과 개척정신", 
      "description": "고난과 시련 속에서도 좌절하지 않고 도전하며 새로운 길을 개척한다.",
      "image": "/culture_maps/불굴의도전정신과개척정신.png"
    },
    {
      "id": "spirit_04",
      "name": "미래를 예측하는 통찰력",
      "description": "시대의 흐름을 읽고 미래를 내다보는 혜안을 통해 더 나은 방향을 설정하고 준비한다.",
      "image": "/culture_maps/미래를 예측하는 통찰.png"
    },
    {
      "id": "spirit_05",
      "name": "미풍양속의 계승",
      "description": "아름답고 좋은 풍속을 지키며 후대에도 이어 나간다.",
      "image": "/culture_maps/미풍양속의 계승.png"
    },
    {
      "id": "spirit_06",
      "name": "상생적 공존공영의 인화정신",
      "description": "더불어 함께 잘 살아가기 위해 여러 사람이 서로 협력하고 화합한다.",
      "image": "/culture_maps/상생적 공존공영의 인화정신.png"
    },
    {
      "id": "spirit_07",
      "name": "환경을 중시하는 사회적 책임경영",
      "description": "환경을 중요하게 생각하는 경영을 통하여 사회적 가치 창출을 추구하는 책임경영을 한다.",
      "image": "/culture_maps/환경을 중시하는 사회적 책임경영.png"
    }
  ]
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

function getSpiritById(spiritId) {
  return spiritsData.spirits.find(s => s.id === spiritId)
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
      // GET /api/spirits - 동암정신 목록 반환
      res.status(200).json(spiritsData)
    } else if (req.method === 'POST') {
      // POST /api/generate-prompt - 프롬프트 생성
      const { spiritId, activityName, coreText, text, teamLeaderObservation, outcomes, outputs, factors, keyLearning } = req.body
      
      if (!spiritId) {
        res.status(400).json({ error: 'spiritId is required' })
        return
      }
      
      const spirit = getSpiritById(spiritId)
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