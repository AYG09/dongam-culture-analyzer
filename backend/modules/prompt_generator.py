from pathlib import Path
import json
import time
from typing import Dict, Any, Optional


def _spirits_path() -> Path:
	# Look for bundled json next to this module
	return Path(__file__).resolve().parent / "dongam_spirit.json"


# simple in-memory cache with TTL
_CACHE: Dict[str, Any] = {"data": None, "ts": 0.0}
import os

# Allow override via environment variable for workshop tuning
try:
    _TTL_SECONDS = float(os.getenv("PROMPT_CACHE_TTL_SECONDS", "60"))
except Exception:
    _TTL_SECONDS = 60.0


def load_spirits() -> Dict[str, Any]:
	p = _spirits_path()
	# cache hit
	now = time.time()
	if _CACHE.get("data") is not None and (now - float(_CACHE.get("ts", 0.0))) < _TTL_SECONDS:
		return _CACHE["data"]

	if not p.exists():
		# Minimal default
		data = {"spirits": []}
		_CACHE["data"] = data
		_CACHE["ts"] = now
		return data

	data = json.loads(p.read_text(encoding="utf-8"))
	_CACHE["data"] = data
	_CACHE["ts"] = now
	return data


def _normalize_element_id(eid: Any) -> Any:
	"""Normalize element_id to the form '유형_#' or '무형_#'.
	Accepts inputs like '유형1', '무형3', '유형-2', '무형 4', '유형_5'.
	Returns non-str inputs unchanged.
	"""
	if not isinstance(eid, str):
		return eid
	s = eid.strip().replace('-', '_').replace(' ', '_')
	if s.startswith('유형') and not s.startswith('유형_'):
		s = s.replace('유형', '유형_', 1)
	if s.startswith('무형') and not s.startswith('무형_'):
		s = s.replace('무형', '무형_', 1)
	while '__' in s:
		s = s.replace('__', '_')
	return s


def get_spirit_by_id(data: Dict[str, Any], spirit_id: str) -> Optional[Dict[str, Any]]:
	for s in data.get("spirits", []):
		if s.get("id") == spirit_id:
			return s
	return None


def build_prompt(payload: Dict[str, Any], spirit: Dict[str, Any]) -> str:
	name = spirit.get("name", "")
	desc = spirit.get("description", "")

	activity_name = payload.get("activityName", "").strip()
	core_text = (payload.get("coreText") or "").strip()
	team_leader_observation = (payload.get("teamLeaderObservation") or "").strip()
	outcomes = (payload.get("outcomes") or "").strip()
	outputs = (payload.get("outputs") or "").strip()
	factors = (payload.get("factors") or "").strip()
	key_learning = (payload.get("keyLearning") or "").strip()

	is_detailed = any([outcomes, outputs, factors, key_learning])
	has_leader_observation = bool(team_leader_observation)

	lines = []
	lines.append("[목표] Change Agent 활동과 팀장 활동을 동암정신의 유형/무형 요소 구현 기여 관점에서 분석하고 JSON으로만 결과를 반환")
	lines.append("")

	lines.append("[분석 대상 활동]")
	if activity_name:
		lines.append(f"활동명: {activity_name}")
	lines.append(f"Change Agent 본인 활동: {core_text}")
	if has_leader_observation:
		lines.append(f"팀장 활동 목격담: {team_leader_observation}")
	lines.append("")

	if is_detailed:
		lines.append("[Change Agent 활동 상세 정보]")
		if outcomes:
			lines.append(f"Outcomes(목표): {outcomes}")
		if outputs:
			lines.append(f"Outputs(실행/결과): {outputs}")
		if factors:
			lines.append(f"Enabler/Blocker(성공/실패 요인): {factors}")
		if key_learning:
			lines.append(f"Key Learning(핵심 교훈/향후 계획): {key_learning}")
		lines.append("")

	lines.append("[동암정신 정의]")
	lines.append(f"이름: {name}")
	lines.append(f"설명: {desc}")
	lines.append("")

	# 동적으로 정신 요소들 추가
	lines.append("[분석 대상 요소 - 유형/무형 요소만]")
	lines.append("Change Agent 활동이나 팀장 활동이 실제로 구현에 기여한 요소를 식별하세요:")
	lines.append("")
	
	# 유형 요소들
	if spirit.get("tangible_elements"):
		lines.append("유형 요소 (구체적 시스템과 방식):")
		for element in spirit["tangible_elements"]:
			lines.append(f"- {element['name']}")
	else:
		# 기존 불우재 정신 유형 요소들 (fallback)
		lines.append("Layer 3: 유형 요소 (구체적 시스템과 방식):")
		lines.append("- [소통 절차/방식] 주기적 도전과제 대화, 논의")  
		lines.append("- [업무 절차/방식] 수용가능한 위험성 범위 도출 후 과감한 도전")
		lines.append("- [소통 절차/방식] 건설적 대화문화 정착 비난/불만표현 금지")
		lines.append("- [소통 절차/방식] 성공사례 공유를 통한 자존감(자신감) 제고")
		lines.append("- [권한 조정] 방향/실천방안 권한을 부여하여 책임의식 제고")
		lines.append("- [권한 조정] 업무 절차 확립 책임한계의 명확화")
		lines.append("- [소통 절차/방식] 감정표현을 존중, 피드백 문화 만들기")
		lines.append("- [육성-학습 방식] 신입사원(경력포함) 회사 적응(시스템) 도입")
		lines.append("- [행사/이벤트] 실패를 감수할 수 있는 사내문화 정착 프로그램 적용")
		lines.append("- [소통 절차/방식] 난관문제 리뷰, 토론/토의 사후 모니터링 필수 수행")
	
	lines.append("")
	
	# 무형 요소들
	if spirit.get("intangible_elements"):
		lines.append("무형 요소 (근본적 믿음과 가치관):")
		for element in spirit["intangible_elements"]:
			lines.append(f"- {element['name']}")
	else:
		# 기존 불우재 정신 무형 요소들 (fallback)
		lines.append("Layer 4: 무형 요소 (근본적 믿음과 가치관):")
		lines.append("- 세상은 완벽하지 않아도 괜찮다 (수용과 이해)")
		lines.append("- 신뢰 문화와 팀워크 (상호 신뢰 강화)")
		lines.append("- 학습 마인드셋 (모든 경험을 배움의 기회로)")
		lines.append("- 성장 가능성에 대한 믿음 (변화에 대한 긍정적 마인드셋)")
		lines.append("- 경청과 질문 문화 (건설적 소통을 통한 상호 이해)")
	
	lines.append("")

	lines.append("[분석 지시사항]")
	lines.append("1. Change Agent 활동 분석:")
	lines.append("   - Change Agent가 수행한 활동이 어떤 유형/무형 요소의 실제 구현에 기여했는지 분석")
	lines.append("   - 구체적 근거와 함께 구현 기여 여부만 판단 (점수 없이 기여/비기여만)")
	if has_leader_observation:
		lines.append("2. 팀장 활동 분석:")
		lines.append("   - 팀장의 활동이 어떤 유형/무형 요소 구현에 기여했는지 분석")
		lines.append("   - 리더십이 조직문화 형성에 미친 구체적 영향과 구현 기여 여부 평가")
	lines.append("3. 효능감 강화 메시지 생성:")
	lines.append("   - Change Agent와 팀장의 구체적 행동을 David Lewis(질적 상호작용), John Kotter(변화관리), Edgar Schein(학습불안) 이론 관점에서 인정하고 격려")
	lines.append("   - 실제 활동 내용을 바탕으로 개인적 성취와 기여를 구체적으로 인정")
	lines.append("   - 이론적 분석이 아닌 정서적 지지와 효능감 강화에 초점")
	lines.append("   - **중요**: 제공된 활동 내용에 실제로 존재하는 사실만 인정하고, 없는 내용은 절대 꾸며내지 말 것")
	lines.append("   - 활동이 부족하거나 해당 이론에 맞는 행동이 없다면 무리하게 칭찬하지 말고 실제 있었던 내용만 인정")
	lines.append("")

	lines.append("[출력 형식]")
	lines.append("- 반드시 아래 JSON 스키마에 맞는 순수 JSON만 출력")
	lines.append("- element_id는 실제 존재하는 유형/무형 요소 ID를 사용 (예: 유형_1, 무형_3)")
	lines.append("- '유형3', '무형-2', '유형 4' 등은 금지. 반드시 '유형_3', '무형_2'처럼 언더스코어 형식을 사용할 것")
	lines.append("")

	lines.append("[JSON 스키마 - 정확한 element_id 매핑 필수]")
	lines.append("현재 시스템에서 사용하는 정확한 element_id 매핑:")
	
	# 동적으로 element_id 매핑 생성
	if spirit.get("tangible_elements"):
		for element in spirit["tangible_elements"]:
			eid = _normalize_element_id(element.get('id', ''))
			lines.append(f"{eid}: {element['name']}")
	else:
		# 기존 불우재 정신 매핑 (fallback)
		lines.append("유형_1: [소통 절차/방식] 주기적 도전과제 대화, 논의")
		lines.append("유형_2: [업무 절차/방식] 수용가능한 위험성 범위 도출 후 과감한 도전 - 연 1개 프로젝트 목표")
		lines.append("유형_3: [소통 절차/방식] 감정표현을 존중, 피드백 문화만들기") 
		lines.append("유형_4: [소통 절차/방식] 성공사례 공유를 통한 자존감(자신감) 제고")
		lines.append("유형_5: [소통 절차/방식] 건설적 대화문화 정착 비난/불만표현 금지")
		lines.append("유형_6: [육성-학습 방식] 신입사원(경력포함) 회사 적응(시스템) 도입")
		lines.append("유형_7: [행사/이벤트] 실패를 감수할 수 있는 사내문화 정착 프로그램 적용")
		lines.append("유형_8: [권한 조정] 방향/실천방안 권한을 부여하여 책임의식 제고")
		lines.append("유형_9: [권한 조정] 업무 절차 확립 책임한계의 명확화")
		lines.append("유형_10: [소통 절차/방식] 난관문제 리뷰, 토론/토의 사후 모니터링 필수 수행")

	if spirit.get("intangible_elements"):
		for element in spirit["intangible_elements"]:
			eid = _normalize_element_id(element.get('id', ''))
			lines.append(f"{eid}: {element['name']}")
	else:
		# 기존 불우재 정신 무형 요소 매핑 (fallback)
		lines.append("무형_1: 세상은 완벽하지 않아도 괜찮다 세상과 타인에 대한 이상적인 기대를 내려 놓으면 원망보다는 수용과 이해가 생긴다")
		lines.append("무형_2: 우리 동료는 뒤통수 치지 않음을 모두가 믿는다")
		lines.append("무형_3: 모든 경험은 나를 위한 배움이란 믿음")
		lines.append("무형_4: 동료가 잘 되어야 내가 잘 될 수 있다고 믿는다")
		lines.append("무형_5: 무조건적 신뢰 X, 경청과 질문(왜?)을 통해 발언자의 의도를 파악하는 것이 당연하다")
		lines.append("무형_6: 내가 변화할 수 있다는 믿음 '환경이 힘들어도 나의 노력이나 선택, 태도를 바꾸는 쪽으로 에너지를 쓴다.'")
		lines.append("무형_7: 각자 역할분담을 명확하고 공정하게 하는 것이 당연하다.")
		lines.append("무형_8: 우린 어떤 행동이든 우리를 위한 일임을 모두가 믿는다")
		lines.append("무형_9: 공감하고 이해한다 서로 살아온 환경이 다르기에 모두 각자의 사정을 안고 살아간다는 믿음")
	lines.append("")
	lines.append("[JSON 스키마]")
	lines.append(
		"""
{
  "affected_elements": [
    {
      "element_id": "유형_1",
      "element_name": "[소통 절차/방식] 주기적 도전과제 대화, 논의",
      "contribution_level": "high",
      "activity_source": "ca",
      "evidence": "CA가 정기적으로 팀원들과 도전과제에 대한 대화 세션을 주도하여 소통 문화 개선에 크게 기여했습니다."
    },
    {
      "element_id": "유형_3",
      "element_name": "[소통 절차/방식] 감정표현을 존중, 피드백 문화만들기",
      "contribution_level": "medium",
      "activity_source": "ca", 
      "evidence": "CA의 적극적인 피드백 문화 조성 노력으로 팀 내 감정표현이 자유로워졌습니다."
    },
    {
      "element_id": "무형_1",
      "element_name": "세상은 완벽하지 않아도 괜찮다 세상과 타인에 대한 이상적인 기대를 내려 놓으면 원망보다는 수용과 이해가 생긴다",
      "contribution_level": "high",
      "activity_source": "ca",
      "evidence": "CA의 지속적인 긍정적 마인드셋 전파로 팀원들이 완벽주의에서 벗어나 수용적 태도를 갖게 되었습니다."
    },
    {
      "element_id": "유형_2",
      "element_name": "[업무 절차/방식] 수용가능한 위험성 범위 도출 후 과감한 도전 - 연 1개 프로젝트 목표",
      "contribution_level": "high",
      "activity_source": "leader",
      "evidence": "팀장이 명확한 위험 관리 프로세스를 도입하여 안전한 도전 문화를 조성했습니다."
    },
    {
      "element_id": "무형_3",
      "element_name": "모든 경험은 나를 위한 배움이란 믿음",
      "contribution_level": "low",
      "activity_source": "leader",
      "evidence": "팀장의 실패를 학습 기회로 전환하는 관점 공유로 성장 마인드셋이 형성되었습니다."
    }
  ],
  "analysis": {
    "ca_activity_value": "**CA 활동의 조직문화 혁신 성과**\\n\\n• **소통 문화의 질적 전환**: CA가 주도한 '주기적 도전과제 대화 세션'은 단순한 업무 보고에서 벗어나 진정한 소통 문화로 전환시켰습니다. 기존 일방향적 소통에서 양방향 대화 문화로 패러다임이 변화했으며, 이는 팀원들의 참여도를 30% 이상 향상시켰습니다.",
    "leader_impact": "**팀장의 전략적 리더십과 시스템 혁신**\\n\\n• **위험 관리 체계의 체계화**: 팀장이 도입한 '수용가능한 위험성 범위 설정 및 과감한 도전' 시스템은 조직의 도전 문화를 안전하게 정착시켰습니다.",
    "overall_effects": "**조직문화 변혁의 종합적 성과와 지속가능성**\\n\\n• **협력 중심 조직문화로의 전환**: CA의 신뢰 구축 활동과 팀장의 권한 위임이 결합되어 진정한 협력 문화가 정착되었습니다.",
    "efficacy_support": "**활동 수행자들에 대한 구체적 인정과 격려**\\n\\n🌟 **Change Agent님께**: 귀하께서 실행하신 [구체적 활동]은 David Lewis가 강조한 '질적 상호작용'의 핵심인 진정성과 상호 존중을 완벽하게 실현하셨습니다. 특히 [구체적 행동 사례]에서 보여주신 끈기와 헌신은 조직원들의 마음을 움직였고, 이는 측정 가능한 변화로 나타났습니다. 귀하의 노력이 없었다면 이런 변화는 불가능했을 것입니다.\\n\\n🌟 **팀장님께**: John Kotter의 변화관리 이론에서 가장 어려운 부분인 '권한 위임을 통한 임파워먼트'를 실제로 구현해내신 리더십이 탁월했습니다. [구체적 권한 위임 사례]에서 보여주신 용기와 신뢰는 팀원들에게 강력한 동기부여가 되었습니다. 이는 단순한 관리가 아닌 진정한 리더십의 발현이었습니다.\\n\\n🌟 **함께 이루어낸 성과**: Edgar Schein이 말한 '학습불안 극복'을 두 분이 협력하여 달성하셨습니다. CA님의 세심한 소통과 팀장님의 구조적 지원이 결합되어 조직원들이 변화를 두려움이 아닌 기회로 받아들이게 만든 것은 정말 놀라운 성취입니다."
  }
}
		""".strip()
	)

	return "\n".join(lines)

