import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
const DATA_PATH = path.join(process.cwd(), 'api', 'data', 'dongam_spirit.json')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// 데이터는 번들 시 JSON import로 포함됩니다.
async function loadSpirits() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[generate-prompt] Failed to access spirits json:', e)
    return { spirits: [] }
  }
}

// 종합적인 조직문화 분석 보고서 생성을 위한 프롬프트 함수
function buildPrompt(payload, spirit) {
  const { activityName, coreText, teamLeaderObservation, outcomes, outputs, factors, keyLearning } = payload
  
  let prompt = `다음 내용을 바탕으로 "${spirit.name}" 조직문화 관점에서 종합적인 분석 보고서를 작성해 주세요.\n\n`
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
  
  // 핵심 행동들 포함
  if (spirit.behaviors && spirit.behaviors.length > 0) {
    prompt += `**핵심 행동들**:\n`
    spirit.behaviors.forEach(behavior => {
      if (behavior.id !== '행동1') { // 제목 제외
        prompt += `- ${behavior.name}\n`
      }
    })
    prompt += `\n`
  }
  
  // 유형 요소들 (주요 레버들로 표시)
  if (spirit.tangible_elements && spirit.tangible_elements.length > 0) {
    prompt += `**주요 실천 방안**:\n`
    spirit.tangible_elements.forEach(element => {
      prompt += `- ${element.name}\n`
    })
    prompt += `\n`
  }
  
  // 무형 요소들 (핵심 신념/가치로 표시)
  if (spirit.intangible_elements && spirit.intangible_elements.length > 0) {
    prompt += `**핵심 신념/가치**:\n`
    spirit.intangible_elements.forEach(element => {
      if (element.name && element.name.trim()) { // 빈 요소 제외
        prompt += `- ${element.name}\n`
      }
    })
    prompt += `\n`
  }
  
  prompt += `위 활동을 ${spirit.name} 관점에서 종합적으로 분석하여 다음 JSON 형태로 응답해 주세요:\n\n`
  prompt += `{\n`
  prompt += `  "affected_elements": [\n`
  
  // 실제 동암정신 요소들의 ID와 이름을 포함하여 **전체 요소** 예시 생성
  const exampleElements = []
  
  // 유형 요소들 (전체 포함)
  if (spirit.tangible_elements && spirit.tangible_elements.length > 0) {
    spirit.tangible_elements.forEach(element => {
      exampleElements.push(`    {\n      "element_id": "${element.id}",\n      "element_name": "${element.name}",\n      "contribution_level": "high|medium|low",\n      "activity_source": "ca|leader",\n      "evidence": "구체적인 기여 활동 내용과 근거"\n    }`)
    })
  }
  
  // 무형 요소들 (전체 포함)
  if (spirit.intangible_elements && spirit.intangible_elements.length > 0) {
    spirit.intangible_elements.forEach(element => {
      if (element.name && element.name.trim()) { // 빈 요소 제외
        exampleElements.push(`    {\n      "element_id": "${element.id}",\n      "element_name": "${element.name}",\n      "contribution_level": "high|medium|low",\n      "activity_source": "ca|leader",\n      "evidence": "구체적인 기여 활동 내용과 근거"\n    }`)
      }
    })
  }
  
  // 행동 요소들 (전체 포함, 제목 제외)
  if (spirit.behaviors && spirit.behaviors.length > 0) {
    spirit.behaviors.forEach(behavior => {
      if (behavior.id !== '행동1') { // 제목 제외
        exampleElements.push(`    {\n      "element_id": "${behavior.id}",\n      "element_name": "${behavior.name}",\n      "contribution_level": "high|medium|low",\n      "activity_source": "ca|leader",\n      "evidence": "구체적인 기여 활동 내용과 근거"\n    }`)
      }
    })
  }
  
  if (exampleElements.length > 0) {
    prompt += exampleElements.join(',\n') + `\n`
  } else {
    // 폴백: 일반적인 예시
    prompt += `    {\n      "element_id": "유형_1",\n      "element_name": "[소통 절차/방식] 주기적 도전과제 대화, 논의",\n      "contribution_level": "high",\n      "activity_source": "ca",\n      "evidence": "CA가 정기적으로 팀원들과 도전과제에 대한 대화 세션을 주도하여 소통 문화 개선에 크게 기여했습니다."\n    },\n`
    prompt += `    {\n      "element_id": "무형_1",\n      "element_name": "세상은 완벽하지 않아도 괜찮다",\n      "contribution_level": "medium",\n      "activity_source": "leader",\n      "evidence": "팀장의 지속적인 긍정적 마인드셋 전파로 팀원들이 완벽주의에서 벗어나 수용적 태도를 갖게 되었습니다."\n    }\n`
  }
  
  prompt += `  ],\n`
  prompt += `  "ca_theoretical_value": {\n`
  prompt += `    "communication_transformation": "소통 문화의 질적 전환에 대한 상세한 분석과 성과 (예: CA가 주도한 대화 세션의 효과, 참여도 향상 등)",\n`
  prompt += `    "trust_building": "신뢰 기반 조직문화 구축에 대한 분석 (예: 심리적 안전감 증대, 문제 해결 속도 향상 등)",\n`
  prompt += `    "intangible_assets": "무형 자산의 가시적 변화 분석 (예: 마인드셋 전환, 스트레스 감소, 창의성 향상 등)"\n`
  prompt += `  },\n`
  prompt += `  "leader_effectiveness": {\n`
  prompt += `    "risk_management": "위험 관리 체계의 체계화 및 도전 문화 정착 효과",\n`
  prompt += `    "empowerment": "권한 위임을 통한 조직 역량 강화 및 자율성 증진 효과",\n`
  prompt += `    "growth_mindset": "성장 마인드셋 확산 및 학습 문화 조성 효과"\n`
  prompt += `  },\n`
  prompt += `  "overall_culture_improvement": {\n`
  prompt += `    "collaboration": "협력 중심 조직문화로의 전환 및 부서간 협업 증가 효과",\n`
  prompt += `    "learning_organization": "학습하는 조직으로의 진화 및 혁신 문화 형성 효과",\n`
  prompt += `    "sustainability": "지속가능한 변화 동력 확보 및 장기적 효과 지속성"\n`
  prompt += `  },\n`
  prompt += `  "key_insights": {\n`
  prompt += `    "success_factors": "핵심 성공 요인 분석 (CA-팀장 협력 시너지, 단계적 변화 관리, 측정 가능한 성과 등)",\n`
  prompt += `    "ca_motivation_message": "Change Agent에게 전하는 격려와 동기부여 메시지 (지금까지의 노력과 성과를 인정하며, 앞으로도 변화를 이끌어갈 수 있다는 용기를 주는 내용)",\n`
  prompt += `    "leader_guidance_message": "팀장에게 전하는 실천적 조언과 응원 메시지 (리더십의 긍정적 영향을 확인해주며, 지속적인 지원과 발전 방향에 대한 구체적 가이드)",\n`
  prompt += `    "future_recommendations": "향후 발전 제안 (수평 확산, 심화 단계, 외부 연계 등 실현 가능한 구체적 방향)"\n`
  prompt += `  },\n`
  prompt += `  "analysis_summary": {\n`
  prompt += `    "total_elements": 0,\n`
  prompt += `    "ca_contributions": 0,\n`
  prompt += `    "leader_contributions": 0,\n`
  prompt += `    "high_impact": 0,\n`
  prompt += `    "medium_impact": 0,\n`
  prompt += `    "low_impact": 0\n`
  prompt += `  }\n`
  prompt += `}\n\n`
  prompt += `분석 시 주의사항:\n`
  prompt += `1. affected_elements: element_id는 반드시 위에 제시된 실제 ID를 사용하세요\n`
  prompt += `2. contribution_level은 "high", "medium", "low" 중 하나를 사용\n`
  prompt += `3. activity_source는 "ca" (CA활동) 또는 "leader" (팀장활동) 중 하나\n`
  prompt += `4. ca_theoretical_value, leader_effectiveness, overall_culture_improvement: 각 섹션별로 구체적이고 상세한 분석 내용 작성\n`
  prompt += `5. key_insights:\n`
  prompt += `   - ca_motivation_message: Change Agent의 노력을 구체적으로 인정하고, 변화 과정에서의 어려움을 공감하며, 앞으로도 지속할 수 있는 용기를 주는 따뜻하고 진심어린 메시지\n`
  prompt += `   - leader_guidance_message: 팀장의 리더십이 조직에 미친 긍정적 영향을 명확히 제시하고, 실천 가능한 구체적 조언과 함께 지속적 발전을 응원하는 메시지\n`
  prompt += `   - future_recommendations: 현실적이고 실현 가능한 발전 방향 제시\n`
  prompt += `6. analysis_summary: affected_elements 배열을 기반으로 정확한 통계 계산\n`
  prompt += `7. 모든 텍스트는 한국어로 작성하고, 특히 동기부여 메시지는 진심과 따뜻함이 느껴지도록 작성\n`
  prompt += `8. 조직문화 변화는 어려운 일임을 인정하면서도, 지금까지의 성과를 바탕으로 지속할 수 있다는 희망적 메시지 포함`
  
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