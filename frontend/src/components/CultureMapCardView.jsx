import React, { useState, useMemo } from 'react';
import './CultureMapCardView.css';

const CultureMapCardView = ({ analysisData, sessionCode, selectedSpirit }) => {
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [activityFilter, setActivityFilter] = useState('all'); // 'all', 'ca', 'leader'
  const [contributionFilter, setContributionFilter] = useState('all'); // 'all', 'high', 'medium', 'low'
  const [factorTypeFilter, setFactorTypeFilter] = useState('all'); // 'all', 'tangible', 'intangible'

  // 테스트용 샘플 분석 결과 데이터 (실제 분석 결과가 없을 때 사용)
  const getSampleAnalysisData = () => {
    return {
      affected_elements: [
        // CA 활동이 기여한 요소들
        {
          element_id: "유형_1",
          element_name: "[소통 절차/방식] 주기적 도전과제 대화, 논의",
          contribution_level: "high",
          activity_source: "ca",
          evidence: "CA가 정기적으로 팀원들과 도전과제에 대한 대화 세션을 주도하여 소통 문화 개선에 크게 기여했습니다."
        },
        {
          element_id: "유형_3",
          element_name: "[소통 절차/방식] 감정표현을 존중, 피드백 문화만들기",
          contribution_level: "medium",
          activity_source: "ca",
          evidence: "CA의 적극적인 피드백 문화 조성 노력으로 팀 내 감정표현이 자유로워졌습니다."
        },
        {
          element_id: "무형_1",
          element_name: "세상은 완벽하지 않아도 괜찮다 세상과 타인에 대한 이상적인 기대를 내려 놓으면 원망보다는 수용과 이해가 생긴다",
          contribution_level: "high",
          activity_source: "ca",
          evidence: "CA의 지속적인 긍정적 마인드셋 전파로 팀원들이 완벽주의에서 벗어나 수용적 태도를 갖게 되었습니다."
        },
        {
          element_id: "무형_2",
          element_name: "우리 동료는 뒤통수 치지 않음을 모두가 믿는다",
          contribution_level: "medium",
          activity_source: "ca",
          evidence: "CA의 신뢰 구축 활동을 통해 팀 내 상호 신뢰도가 크게 향상되었습니다."
        },
        // 팀장 활동이 기여한 요소들
        {
          element_id: "유형_2",
          element_name: "[업무 절차/방식] 수용가능한 위험성 범위 도출 후 과감한 도전 - 연 1개 프로젝트 목표",
          contribution_level: "high",
          activity_source: "leader",
          evidence: "팀장이 명확한 위험 관리 프로세스를 도입하여 안전한 도전 문화를 조성했습니다."
        },
        {
          element_id: "유형_4",
          element_name: "[소통 절차/방식] 성공사례 공유를 통한 자존감(자신감) 제고",
          contribution_level: "medium",
          activity_source: "leader",
          evidence: "팀장의 정기적인 성공사례 공유 세션으로 팀원들의 자신감이 향상되었습니다."
        },
        {
          element_id: "유형_8",
          element_name: "[권한 조정] 방향/실천방안 권한을 부여하여 책임의식 제고",
          contribution_level: "high",
          activity_source: "leader",
          evidence: "팀장이 팀원들에게 의사결정 권한을 적극적으로 위임하여 책임의식이 크게 향상되었습니다."
        },
        {
          element_id: "무형_3",
          element_name: "모든 경험은 나를 위한 배움이란 믿음",
          contribution_level: "low",
          activity_source: "leader",
          evidence: "팀장의 실패를 학습 기회로 전환하는 관점 공유로 성장 마인드셋이 형성되었습니다."
        },
        {
          element_id: "무형_4",
          element_name: "동료가 잘 되어야 내가 잘 될 수 있다고 믿는다",
          contribution_level: "medium",
          activity_source: "leader",
          evidence: "팀장의 협력 문화 강조로 상생 마인드가 팀에 정착되었습니다."
        }
      ]
    };
  };

  // element_id 정규화: '유형1' → '유형_1', '무형3' → '무형_3'
  const normalizeElementId = (id) => {
    if (!id || typeof id !== 'string') return id;
    // 이미 언더스코어가 있으면 유지
    if (id.includes('_')) return id;
    // '유형' 또는 '무형' 뒤에 숫자만 오는 경우 언더스코어 삽입
    const typeMatch = id.match(/^(유형|무형)(\d{1,2})$/);
    if (typeMatch) {
      return `${typeMatch[1]}_${typeMatch[2]}`;
    }
    return id;
  };

  // LLM 분석 결과에서 영향받은 요소들 파싱
  const getAffectedElements = () => {
    console.log('analysisData:', analysisData); // 디버깅용
    
    // 분석 데이터가 존재하면 (빈 배열이어도) 그대로 사용
    if (analysisData?.affected_elements !== undefined) {
      console.log('Using real data:', analysisData.affected_elements); // 디버깅용
      // element_id 정규화 적용
      return (analysisData.affected_elements || []).map((el) => ({
        ...el,
        element_id: normalizeElementId(el.element_id),
      }));
    }
    
    // 분석 데이터가 아예 없을 때만 샘플 데이터 사용
    console.log('Using sample data'); // 디버깅용
    const sampleData = getSampleAnalysisData().affected_elements;
    console.log('Sample data:', sampleData); // 디버깅용
    return sampleData;
  };

  // 요소가 분석 결과에 포함되는지 확인
  const isElementAffected = (elementId) => {
    const affected = getAffectedElements();
    return affected.some(el => el.element_id === elementId);
  };

  // 기여도 레벨 확인
  const getContributionLevel = (elementId) => {
    const affected = getAffectedElements();
    const element = affected.find(el => el.element_id === elementId);
    return element?.contribution_level || 'none';
  };

  // 활동 소스 확인 (ca 또는 leader)
  const getActivitySource = (elementId) => {
    const affected = getAffectedElements();
    const element = affected.find(el => el.element_id === elementId);
    return element?.activity_source || 'none';
  };

  // 동암정신 JSON 데이터 구조 (폴백)
  const fallbackCultureMapData = [
    {
      "id": "결과_1",
      "text": "불우재 정신",
      "position": { "x": 650, "y": 20 },
      "width": 200, "height": 60,
      "type": "결과", "layer": 1,
      "connections": ["행동_1", "행동_2", "행동_3", "행동_4", "행동_5", "행동_6"]
    },
    {
      "id": "행동_1",
      "text": "공감하고 이해한다",
      "position": { "x": 50, "y": 150 },
      "width": 180, "height": 100,
      "type": "행동", "layer": 2,
      "connections": ["유형_1"]
    },
    {
      "id": "행동_2",
      "text": "자기 책임 문제 발생시 자기 역할을 돌아본다 - 결과에 대해 인정, 감사와 사과하기",
      "position": { "x": 250, "y": 150 },
      "width": 180, "height": 100,
      "type": "행동", "layer": 2,
      "connections": ["유형_2", "유형_6"]
    },
    {
      "id": "행동_3",
      "text": "건설적 방향으로 발언한다 '저는 oo방향으로 생각하고 방안을 도출하고 싶어요'",
      "position": { "x": 450, "y": 150 },
      "width": 180, "height": 100,
      "type": "행동", "layer": 2,
      "connections": ["유형_3", "유형_5"]
    },
    {
      "id": "행동_4",
      "text": "책임을 회피하고 싶은 상황일 때일 수록 긍정적으로 발언한다 '어려운 문제는 제가 해보겠습니다', '어려운 상황은 이해합니다. 그러나 긍정적인 생각으로 진행해 보시죠'",
      "position": { "x": 650, "y": 150 },
      "width": 280, "height": 100,
      "type": "행동", "layer": 2,
      "connections": ["유형_4"]
    },
    {
      "id": "행동_5",
      "text": "애로사항을 듣고문제점을 수용한다",
      "position": { "x": 950, "y": 150 },
      "width": 180, "height": 100,
      "type": "행동", "layer": 2,
      "connections": ["유형_8"]
    },
    {
      "id": "행동_6",
      "text": "내 잘못을 남에게 전가하지 않는다",
      "position": { "x": 1150, "y": 150 },
      "width": 180, "height": 100,
      "type": "행동", "layer": 2,
      "connections": ["유형_9", "유형_10"]
    },
    {
      "id": "유형_1",
      "text": "[소통 절차/방식] 주기적 도전과제 대화, 논의",
      "position": { "x": 50, "y": 300 },
      "width": 180, "height": 90,
      "type": "유형", "layer": 3,
      "connections": ["무형_1", "무형_2"]
    },
    {
      "id": "유형_2",
      "text": "[업무 절차/방식] 수용가능한 위험성 범위 도출 후 과감한 도전 - 연 1개 프로젝트 목표",
      "position": { "x": 250, "y": 300 },
      "width": 180, "height": 90,
      "type": "유형", "layer": 3,
      "connections": ["무형_3", "무형_4"]
    },
    {
      "id": "유형_3",
      "text": "[소통 절차/방식] 감정표현을 존중, 피드백 문화만들기",
      "position": { "x": 400, "y": 300 },
      "width": 180, "height": 90,
      "type": "유형", "layer": 3,
      "connections": ["무형_2"]
    },
    {
      "id": "유형_4",
      "text": "[소통 절차/방식] 성공사례 공유를 통한 자존감(자신감) 제고",
      "position": { "x": 600, "y": 300 },
      "width": 180, "height": 90,
      "type": "유형", "layer": 3,
      "connections": ["무형_4"]
    },
    {
      "id": "유형_5",
      "text": "[소통 절차/방식] 건설적 대화문화 정착 비난/불만표현 금지",
      "position": { "x": 500, "y": 420 },
      "width": 180, "height": 90,
      "type": "유형", "layer": 3,
      "connections": ["무형_5"]
    },
    {
      "id": "유형_6",
      "text": "[육성-학습 방식] 신입사원(경력포함) 회사 적응(시스템) 도입",
      "position": { "x": 850, "y": 300 },
      "width": 180, "height": 90,
      "type": "유형", "layer": 3,
      "connections": ["무형_3"]
    },
    {
      "id": "유형_7",
      "text": "[행사/이벤트] 실패를 감수할 수 있는 사내문화 정착 프로그램 적용",
      "position": { "x": 1030, "y": 300 },
      "width": 180, "height": 90,
      "type": "유형", "layer": 3,
      "connections": ["무형_6"]
    },
    {
      "id": "유형_8",
      "text": "[권한 조정] 방향/실천방안 권한을 부여하여 책임의식 제고",
      "position": { "x": 1210, "y": 300 },
      "width": 180, "height": 90,
      "type": "유형", "layer": 3,
      "connections": ["무형_9"]
    },
    {
      "id": "유형_9",
      "text": "[권한 조정] 업무 절차 확립 책임한계의 명확화",
      "position": { "x": 250, "y": 420 },
      "width": 180, "height": 90,
      "type": "유형", "layer": 3,
      "connections": ["무형_8"]
    },
    {
      "id": "유형_10",
      "text": "[소통 절차/방식] 난관문제 리뷰, 토론/토의 사후 모니터링 필수 수행",
      "position": { "x": 700, "y": 420 },
      "width": 180, "height": 90,
      "type": "유형", "layer": 3,
      "connections": ["무형_7"]
    },
    {
      "id": "무형_1",
      "text": "세상은 완벽하지 않아도 괜찮다 세상과 타인에 대한 이상적인 기대를 내려 놓으면 원망보다는 수용과 이해가 생긴다",
      "position": { "x": 50, "y": 600 },
      "width": 150, "height": 140,
      "type": "무형", "layer": 4,
      "connections": []
    },
    {
      "id": "무형_2",
      "text": "우리 동료는 뒤통수 치지 않음을 모두가 믿는다",
      "position": { "x": 210, "y": 600 },
      "width": 150, "height": 140,
      "type": "무형", "layer": 4,
      "connections": []
    },
    {
      "id": "무형_3",
      "text": "모든 경험은 나를 위한 배움이란 믿음",
      "position": { "x": 370, "y": 600 },
      "width": 150, "height": 140,
      "type": "무형", "layer": 4,
      "connections": []
    },
    {
      "id": "무형_4",
      "text": "동료가 잘 되어야 내가 잘 될 수 있다고 믿는다",
      "position": { "x": 530, "y": 600 },
      "width": 150, "height": 140,
      "type": "무형", "layer": 4,
      "connections": []
    },
    {
      "id": "무형_5",
      "text": "무조건적 신뢰 X, 경청과 질문(왜?)을 통해 발언자의 의도를 파악하는 것이 당연하다",
      "position": { "x": 690, "y": 600 },
      "width": 150, "height": 140,
      "type": "무형", "layer": 4,
      "connections": []
    },
    {
      "id": "무형_6",
      "text": "내가 변화할 수 있다는 믿음 '환경이 힘들어도 나의 노력이나 선택, 태도를 바꾸는 쪽으로 에너지를 쓴다.'",
      "position": { "x": 850, "y": 600 },
      "width": 150, "height": 140,
      "type": "무형", "layer": 4,
      "connections": []
    },
    {
      "id": "무형_7",
      "text": "각자 역할분담을 명확하고 공정하게 하는 것이 당연하다.",
      "position": { "x": 1010, "y": 600 },
      "width": 150, "height": 140,
      "type": "무형", "layer": 4,
      "connections": []
    },
    {
      "id": "무형_8",
      "text": "우린 어떤 행동이든 우리를 위한 일임을 모두가 믿는다",
      "position": { "x": 1170, "y": 600 },
      "width": 150, "height": 140,
      "type": "무형", "layer": 4,
      "connections": []
    },
    {
      "id": "무형_9",
      "text": "공감하고 이해한다 서로 살아온 환경이 다르기에 모두 각자의 사정을 안고 살아간다는 믿음",
      "position": { "x": 1330, "y": 600 },
      "width": 150, "height": 140,
      "type": "무형", "layer": 4,
      "connections": []
    }
  ];

  // selectedSpirit의 요소로 동적 카드 데이터 구성 (가능하면), 없으면 폴백 사용
  const cultureMapData = useMemo(() => {
    const tang = selectedSpirit?.tangible_elements || [];
    const intang = selectedSpirit?.intangible_elements || [];
    const hasDynamic = (Array.isArray(tang) && tang.length > 0) || (Array.isArray(intang) && intang.length > 0);
    if (!hasDynamic) return fallbackCultureMapData;

    const cards = [];
    // 무형 요소 → Layer 4
    intang.forEach((el) => {
      const id = normalizeElementId(el.id);
      cards.push({
        id,
        text: el.name,
        position: { x: 0, y: 0 },
        width: 150,
        height: 140,
        type: '무형',
        layer: 4,
        connections: [],
      });
    });

    // 유형 요소 → Layer 3 (연결은 있는 경우만 반영)
    tang.forEach((el) => {
      const id = normalizeElementId(el.id);
      const conns = Array.isArray(el.connected_elements) ? el.connected_elements.map(normalizeElementId) : [];
      cards.push({
        id,
        text: el.name,
        position: { x: 0, y: 0 },
        width: 180,
        height: 90,
        type: '유형',
        layer: 3,
        connections: conns,
      });
    });

    return cards;
  }, [selectedSpirit]);

  // 레이어별 색상 정의
  const layerColors = {
    1: '#2c3e50', // 결과 (진청색)
    2: '#e74c3c', // 행동 (빨간색)
    3: '#3498db', // 유형 (파란색)  
    4: '#f39c12'  // 무형 (주황색)
  };

  // 레이어별 타이틀
  const layerTitles = {
    1: '결과',
    2: '행동', 
    3: '유형',
    4: '무형'
  };

  // 필터링 함수들
  const shouldShowCard = (item) => {
    // 레이어 필터
    if (selectedLayer !== 0 && item.layer !== selectedLayer) return false;
    
    // 활동 소스 필터
    if (activityFilter !== 'all') {
      const isAffected = isElementAffected(item.id);
      if (!isAffected) return false;
      
      const activitySource = getActivitySource(item.id);
      if (activityFilter === 'ca' && activitySource !== 'ca') return false;
      if (activityFilter === 'leader' && activitySource !== 'leader') return false;
    }
    
    // 기여도 필터
    if (contributionFilter !== 'all') {
      const isAffected = isElementAffected(item.id);
      if (!isAffected) return false;
      
      const contributionLevel = getContributionLevel(item.id);
      if (contributionLevel !== contributionFilter) return false;
    }
    
    // 요인 타입 필터
    if (factorTypeFilter !== 'all') {
      const isAffected = isElementAffected(item.id);
      if (!isAffected) return false;
      
      if (factorTypeFilter === 'tangible' && item.type !== '유형') return false;
      if (factorTypeFilter === 'intangible' && item.type !== '무형') return false;
    }
    
    return true;
  };

  // 레이어별 데이터 필터링
  const getCardsByLayer = (layer) => {
    return cultureMapData.filter(item => item.layer === layer);
  };

  // 필터링된 카드 데이터 가져오기
  const getFilteredCards = () => {
    return cultureMapData.filter(item => shouldShowCard(item));
  };

  const handleCardClick = (item) => {
    setSelectedCard(item);
  };

  // 연결된 카드 렌더링 함수
  const renderConnectedCard = (connectedCard, isConnectedAffected, direction) => {
    return (
      <div 
        key={connectedCard.id}
        style={{
          backgroundColor: '#ffffff',
          border: `2px solid ${layerColors[connectedCard.layer]}`,
          borderRadius: '8px',
          padding: '12px',
          fontSize: '13px',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          position: 'relative',
          boxShadow: isConnectedAffected ? `0 3px 10px ${layerColors[connectedCard.layer]}33` : '0 1px 3px rgba(0,0,0,0.1)'
        }}
        onClick={() => setSelectedCard(connectedCard)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = `0 4px 15px ${layerColors[connectedCard.layer]}44`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = isConnectedAffected ? `0 3px 10px ${layerColors[connectedCard.layer]}33` : '0 1px 3px rgba(0,0,0,0.1)';
        }}
      >
        {/* 방향 표시 */}
        <div style={{
          position: 'absolute',
          top: '-8px',
          left: '8px',
          backgroundColor: direction === '하향' ? '#28a745' : '#dc3545',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '8px',
          fontSize: '9px',
          fontWeight: 'bold'
        }}>
          {direction === '하향' ? '↓ 영향미침' : '↑ 영향받음'}
        </div>
        
        {/* 이차 영향 표시 */}
        {isConnectedAffected && (
          <div style={{
            position: 'absolute',
            top: '-8px',
            right: '8px',
            backgroundColor: '#ffc107',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '8px',
            fontSize: '9px',
            fontWeight: 'bold'
          }}>
            이차영향
          </div>
        )}

        <div style={{ 
          fontSize: '11px', 
          color: layerColors[connectedCard.layer],
          fontWeight: 'bold',
          marginBottom: '4px',
          marginTop: '12px'
        }}>
          Layer {connectedCard.layer}: {layerTitles[connectedCard.layer]}
        </div>
        <div style={{ fontWeight: 'bold' }}>
          {connectedCard.text.length > 40 ? 
            connectedCard.text.substring(0, 40) + '...' : 
            connectedCard.text
          }
        </div>
      </div>
    );
  };

  // 카드가 연결된 다른 카드들의 ID 찾기 (양방향 - 상향+하향)
  const getConnectedCards = (cardId) => {
    const card = cultureMapData.find(item => item.id === cardId);
    const directConnections = card ? card.connections : [];
    
    // 역방향 연결 찾기 (이 카드를 연결하는 다른 카드들)
    const reverseConnections = cultureMapData
      .filter(item => item.connections && item.connections.includes(cardId))
      .map(item => item.id);
    
    // 양방향 연결 합치기 (중복 제거)
    const allConnections = [...new Set([...directConnections, ...reverseConnections])];
    
    return allConnections;
  };

  // 카드 렌더링 함수
  const renderCard = (item, isActive = false) => {
    const layerColor = layerColors[item.layer];
    const isSelected = selectedCard?.id === item.id;
    const isAffected = isElementAffected(item.id);
    const contributionLevel = getContributionLevel(item.id);
    const activitySource = getActivitySource(item.id);

    // 유형/무형 요인 구분 시각화
    const getFactorTypeIndicator = () => {
      if (!isAffected) return null;
      
      const isIntangible = item.type === '무형';
      const isTangible = item.type === '유형';
      
      if (isIntangible || isTangible) {
        return {
          label: isIntangible ? '무형요인' : '유형요인',
          color: isIntangible ? '#9b59b6' : '#27ae60',
          icon: isIntangible ? '🧠' : '⚙️'
        };
      }
      return null;
    };

    // 기여도에 따른 시각적 강조
    const getCardBackground = () => {
      if (isSelected) return layerColor;
      if (!isAffected) return '#ffffff';
      
      const factorType = getFactorTypeIndicator();
      const baseColor = factorType ? factorType.color : layerColor;
      
      switch (contributionLevel) {
        case 'high': return `linear-gradient(135deg, ${baseColor}22, ${baseColor}44)`;
        case 'medium': return `linear-gradient(135deg, ${baseColor}11, ${baseColor}22)`;
        case 'low': return `linear-gradient(135deg, ${baseColor}08, ${baseColor}11)`;
        default: return '#ffffff';
      }
    };

    const getBorderStyle = () => {
      if (!isAffected) return `3px solid ${layerColor}44`;
      
      switch (contributionLevel) {
        case 'high': return `4px solid ${layerColor}`;
        case 'medium': return `3px solid ${layerColor}`;
        case 'low': return `2px solid ${layerColor}`;
        default: return `3px solid ${layerColor}44`;
      }
    };

    const cardStyle = {
      background: getCardBackground(),
      color: isSelected ? 'white' : '#333',
      border: getBorderStyle(),
      borderRadius: '12px',
      padding: '16px',
      margin: '8px',
      cursor: 'pointer',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      minHeight: '120px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      boxShadow: isSelected ? `0 6px 25px ${layerColor}44` : 
                 isAffected ? `0 3px 15px ${layerColor}22` : '0 2px 8px rgba(0,0,0,0.08)',
      transform: isSelected ? 'translateY(-3px)' : 'none',
      opacity: isAffected || selectedLayer === 0 || selectedLayer === item.layer ? 1 : 0.6
    };

    return (
      <div
        key={item.id}
        style={cardStyle}
        onClick={() => handleCardClick(item)}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = isAffected ? `0 4px 20px ${layerColor}33` : '0 3px 12px rgba(0,0,0,0.12)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = isAffected ? `0 3px 15px ${layerColor}22` : '0 2px 8px rgba(0,0,0,0.08)';
          }
        }}
      >
        {/* 기여도 및 유형/무형 배지 */}
        {isAffected && (
          <>
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              backgroundColor: contributionLevel === 'high' ? '#e74c3c' : 
                             contributionLevel === 'medium' ? '#f39c12' : '#2ecc71',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: 'bold'
            }}>
              {contributionLevel.toUpperCase()} | {activitySource === 'ca' ? 'CA활동' : '팀장활동'}
            </div>
            
            {/* 유형/무형 요인 배지 */}
            {(() => {
              const factorType = getFactorTypeIndicator();
              if (!factorType) return null;
              return (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  left: '200px',
                  backgroundColor: factorType.color,
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {factorType.icon} {factorType.label}
                </div>
              );
            })()}
          </>
        )}

        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: layerColor,
          color: 'white',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 'bold'
        }}>
          {layerTitles[item.layer]}
        </div>
        
        <div style={{ marginTop: isAffected ? '40px' : '24px' }}>
          <h4 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '14px', 
            fontWeight: isAffected ? 'bold' : 'normal',
            lineHeight: 1.3,
            color: isSelected ? 'white' : (isAffected ? '#2c3e50' : '#666')
          }}>
            {item.text}
          </h4>
        </div>

        {/* CA/팀장 활동 기여도 시각화 강화 */}
        {isAffected && (
          <div style={{ 
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontWeight: 'bold',
              color: isSelected ? 'white' : '#2c3e50'
            }}>
              <span>✨ 구현 기여 요소</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {/* 기여도 시각적 표시 */}
                {[...Array(3)].map((__unused, i) => (
                  <div
                    key={i}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: i < (contributionLevel === 'high' ? 3 : contributionLevel === 'medium' ? 2 : 1) 
                        ? (contributionLevel === 'high' ? '#e74c3c' : contributionLevel === 'medium' ? '#f39c12' : '#2ecc71')
                        : '#dee2e6'
                    }}
                  />
                ))}
              </div>
            </div>
            
            {/* 영향 전파 미리보기 */}
            {item.connections && item.connections.length > 0 && (
              <div style={{
                fontSize: '10px',
                color: isSelected ? 'white' : '#6c757d',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>→</span>
                <span>{item.connections.length}개 요소에 영향</span>
                <div style={{
                  display: 'flex',
                  gap: '2px'
                }}>
                  {item.connections.slice(0, 2).map(connId => {
                    const connectedCard = cultureMapData.find(c => c.id === connId);
                    if (!connectedCard) return null;
                    return (
                      <div 
                        key={connId}
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: layerColors[connectedCard.layer]
                        }}
                      />
                    );
                  })}
                  {item.connections.length > 2 && (
                    <span style={{ fontSize: '8px' }}>+{item.connections.length - 2}</span>
                  )}
                </div>
              </div>
            )}
            
            {/* 활동 가치 표시 */}
            <div style={{
              fontSize: '10px',
              fontWeight: 'bold',
              color: activitySource === 'ca' ? '#007bff' : '#6f42c1',
              backgroundColor: isSelected ? 'transparent' : (activitySource === 'ca' ? '#e3f2fd' : '#f3e5f5'),
              padding: '2px 6px',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              💪 {activitySource === 'ca' ? 'CA' : '팀장'}의 노력이 만든 변화
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="culture-map-card-view" style={{ padding: '20px', backgroundColor: '#ffffff' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          margin: '0 0 8px 0',
          color: '#2c3e50'
        }}>
          🌟 동암정신 {selectedSpirit?.name || '불우재 정신'} - 문화지도 카드뷰
        </h2>
        <p style={{ 
          color: '#6c757d', 
          margin: '0 0 8px 0',
          fontSize: '14px'
        }}>
          {selectedSpirit?.name || '불우재 정신'}의 문화 분석 구조를 카드 형태로 시각화합니다.
        </p>
        {/* 참고 문서(PDF) 링크: PNG 대신 PDF 문서를 참조합니다. */}
        {(() => {
          const name = selectedSpirit?.name || '';
          const pdfCandidates = [
            { re: /(숭조위선|효우)/, path: '/동암정신/숭조위선 효우정신.pdf', label: '숭조위선 효우정신 PDF' },
            { re: /(불굴|개척)/, path: '/동암정신/불굴의 도전정신과 개척정신.pdf', label: '불굴의 도전·개척정신 PDF' },
          ];
          const matched = pdfCandidates.find(x => x.re.test(name));
          const generalPdf = '/동암정신/동암정신 7개요소.pdf';
          return (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '6px 0 10px 0' }}>
              {matched && (
                <a
                  href={matched.path}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    textDecoration: 'none',
                    background: '#343a40',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  📄 {matched.label}
                </a>
              )}
              <a
                href={generalPdf}
                target="_blank"
                rel="noreferrer"
                style={{
                  textDecoration: 'none',
                  background: '#6c757d',
                  color: 'white',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                📘 동암정신 7개요소 PDF
              </a>
            </div>
          );
        })()}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          color: '#6c757d',
          fontSize: '13px'
        }}>
          📊 총 요소: {cultureMapData.length}개 (결과: {getCardsByLayer(1).length}, 행동: {getCardsByLayer(2).length}, 유형: {getCardsByLayer(3).length}, 무형: {getCardsByLayer(4).length})
        </div>
        
        {/* 분석 결과 요약 */}
        {analysisData && getAffectedElements().length > 0 && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#e3f2fd',
            borderRadius: '8px',
            border: '2px solid #2196f3'
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#1976d2',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              📈 분석 결과 요약
            </div>
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              fontSize: '12px'
            }}>
              <div style={{
                padding: '4px 8px',
                backgroundColor: '#28a745',
                color: 'white',
                borderRadius: '12px'
              }}>
                영향받은 요소: {getAffectedElements().length}개
              </div>
              <div style={{
                padding: '4px 8px',
                backgroundColor: '#007bff',
                color: 'white',
                borderRadius: '12px'
              }}>
                CA활동: {getAffectedElements().filter(el => el.activity_source === 'ca').length}개
              </div>
              <div style={{
                padding: '4px 8px',
                backgroundColor: '#6f42c1',
                color: 'white',
                borderRadius: '12px'
              }}>
                팀장활동: {getAffectedElements().filter(el => el.activity_source === 'leader').length}개
              </div>
              <div style={{
                padding: '4px 8px',
                backgroundColor: '#27ae60',
                color: 'white',
                borderRadius: '12px'
              }}>
                유형요인: {getAffectedElements().filter(el => {
                  const element = cultureMapData.find(item => item.id === el.element_id);
                  return element && element.type === '유형';
                }).length}개
              </div>
              <div style={{
                padding: '4px 8px',
                backgroundColor: '#9b59b6',
                color: 'white',
                borderRadius: '12px'
              }}>
                무형요인: {getAffectedElements().filter(el => {
                  const element = cultureMapData.find(item => item.id === el.element_id);
                  return element && element.type === '무형';
                }).length}개
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 필터 버튼들 */}
      <div style={{
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#495057',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          🎛️ 분석 결과 필터
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 활동 소스 필터 */}
          <div>
            <label style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px', display: 'block' }}>
              활동 소스별 필터
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { value: 'all', label: '전체', color: '#6c757d' },
                { value: 'ca', label: 'CA활동만', color: '#007bff' },
                { value: 'leader', label: '팀장활동만', color: '#6f42c1' }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setActivityFilter(filter.value)}
                  style={{
                    background: activityFilter === filter.value ? filter.color : 'transparent',
                    color: activityFilter === filter.value ? 'white' : filter.color,
                    border: `2px solid ${filter.color}`,
                    padding: '6px 12px',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s ease, color 0.2s ease'
                  }}
                >
                  {filter.label} {filter.value !== 'all' && `(${getAffectedElements().filter(el => el.activity_source === filter.value).length})`}
                </button>
              ))}
            </div>
          </div>

          {/* 기여도 레벨 필터 */}
          <div>
            <label style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px', display: 'block' }}>
              기여도 레벨별 필터
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { value: 'all', label: '전체', color: '#6c757d' },
                { value: 'high', label: '높음', color: '#e74c3c' },
                { value: 'medium', label: '보통', color: '#f39c12' },
                { value: 'low', label: '낮음', color: '#2ecc71' }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setContributionFilter(filter.value)}
                  style={{
                    background: contributionFilter === filter.value ? filter.color : 'transparent',
                    color: contributionFilter === filter.value ? 'white' : filter.color,
                    border: `2px solid ${filter.color}`,
                    padding: '6px 12px',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s ease, color 0.2s ease'
                  }}
                >
                  {filter.label} {filter.value !== 'all' && `(${getAffectedElements().filter(el => el.contribution_level === filter.value).length})`}
                </button>
              ))}
            </div>
          </div>

          {/* 요인 타입 필터 */}
          <div>
            <label style={{ fontSize: '12px', color: '#6c757d', marginBottom: '4px', display: 'block' }}>
              요인 타입별 필터
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { value: 'all', label: '전체', color: '#6c757d' },
                { value: 'tangible', label: '유형요인만', color: '#27ae60' },
                { value: 'intangible', label: '무형요인만', color: '#9b59b6' }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setFactorTypeFilter(filter.value)}
                  style={{
                    background: factorTypeFilter === filter.value ? filter.color : 'transparent',
                    color: factorTypeFilter === filter.value ? 'white' : filter.color,
                    border: `2px solid ${filter.color}`,
                    padding: '6px 12px',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s ease, color 0.2s ease'
                  }}
                >
                  {filter.label} {filter.value !== 'all' && `(${getAffectedElements().filter(el => {
                    const element = cultureMapData.find(item => item.id === el.element_id);
                    return element && (filter.value === 'tangible' ? element.type === '유형' : element.type === '무형');
                  }).length})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 필터 초기화 버튼 */}
        <div style={{ marginTop: '12px', textAlign: 'right' }}>
          <button
            onClick={() => {
              setActivityFilter('all');
              setContributionFilter('all');
              setFactorTypeFilter('all');
            }}
            style={{
              background: 'none',
              color: '#6c757d',
              border: '1px solid #6c757d',
              padding: '4px 8px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '11px',
              transition: 'all 0.2s ease'
            }}
          >
            필터 초기화
          </button>
        </div>
      </div>

      {/* 레이어 탭 */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '20px',
        borderBottom: '2px solid #f1f3f4',
        paddingBottom: '10px'
      }}>
        {[1, 2, 3, 4].map(layer => (
          <button
            key={layer}
            onClick={() => setSelectedLayer(layer)}
            style={{
              background: selectedLayer === layer ? layerColors[layer] : 'transparent',
              color: selectedLayer === layer ? 'white' : layerColors[layer],
              border: `2px solid ${layerColors[layer]}`,
              padding: '8px 16px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
          >
            Layer {layer}: {layerTitles[layer]} ({getCardsByLayer(layer).length})
          </button>
        ))}
        <button
          onClick={() => setSelectedLayer(0)}
          style={{
            background: selectedLayer === 0 ? '#34495e' : 'transparent',
            color: selectedLayer === 0 ? 'white' : '#34495e',
            border: '2px solid #34495e',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            transition: 'all 0.2s ease'
          }}
        >
          전체보기
        </button>
      </div>

      {/* 필터링 결과 표시 */}
      <div style={{
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#e8f4f8',
        borderRadius: '8px',
        border: '1px solid #bee5eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{
          fontSize: '14px',
          color: '#0c5460',
          fontWeight: 'bold'
        }}>
          📋 필터링 결과: {getFilteredCards().length}개 요소
        </div>
        <div style={{
          fontSize: '12px',
          color: '#6c757d'
        }}>
          {activityFilter !== 'all' || contributionFilter !== 'all' || factorTypeFilter !== 'all' ? '필터 적용중' : '전체 표시'}
        </div>
      </div>

      {/* 카드 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '12px',
        marginBottom: '30px'
      }}>
        {getFilteredCards().map(item => renderCard(item))}
      </div>

      {/* 결과가 없을 때 */}
      {getFilteredCards().length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#6c757d',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '2px dashed #dee2e6'
        }}>
          {/* 분석 결과 자체가 빈 배열인 경우 */}
          {getAffectedElements().length === 0 ? (
            <>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                기여한 요인이 없음
              </div>
              <div style={{ fontSize: '14px' }}>
                이번 활동은 동암정신의 어떤 요소에도 기여하지 않은 것으로 분석되었습니다.
              </div>
            </>
          ) : (
            /* 필터링으로 인해 결과가 없는 경우 */
            <>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                선택한 필터 조건에 해당하는 요소가 없습니다
              </div>
              <div style={{ fontSize: '14px' }}>
                다른 필터 조건을 선택하거나 '필터 초기화' 버튼을 눌러주세요.
              </div>
            </>
          )}
        </div>
      )}

      {/* 세부 정보 패널 */}
      {selectedCard && (
        <div style={{
          marginTop: '30px',
          padding: '24px',
          backgroundColor: '#f8f9fa',
          borderRadius: '12px',
          border: `3px solid ${layerColors[selectedCard.layer]}`,
          boxShadow: `0 4px 20px ${layerColors[selectedCard.layer]}22`
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            marginBottom: '20px'
          }}>
            <h3 style={{ 
              margin: 0, 
              color: '#2c3e50',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🔍 선택된 카드 상세 분석
            </h3>
            <button 
              onClick={() => setSelectedCard(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6c757d',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'inline-block',
              backgroundColor: layerColors[selectedCard.layer],
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '12px'
            }}>
              Layer {selectedCard.layer}: {layerTitles[selectedCard.layer]}
            </div>
            <h4 style={{ 
              margin: '0 0 12px 0',
              color: '#2c3e50',
              fontSize: '20px',
              lineHeight: 1.3
            }}>
              📌 {selectedCard.text}
            </h4>
            <div style={{
              color: '#6c757d',
              fontSize: '14px',
              marginBottom: '8px'
            }}>
              ID: {selectedCard.id}
            </div>
          </div>

          {(() => {
            const allConnections = getConnectedCards(selectedCard.id);
            const directConnections = selectedCard.connections || [];
            const reverseConnections = allConnections.filter(id => !directConnections.includes(id));
            
            return allConnections.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h5 style={{ 
                  color: '#007bff',
                  margin: '0 0 12px 0',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  🔗 상호작용 요소들 ({allConnections.length}개)
                  <span style={{
                    fontSize: '12px',
                    color: '#6c757d',
                    fontWeight: 'normal'
                  }}>
                    하향 {directConnections.length}개 · 상향 {reverseConnections.length}개
                  </span>
                  {isElementAffected(selectedCard.id) && (
                    <span style={{
                      backgroundColor: '#28a745',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '8px',
                      fontSize: '10px',
                      marginLeft: '8px'
                    }}>
                      영향 전파
                    </span>
                  )}
                </h5>
              
              {/* 영향 관계 시각적 표현 */}
              {isElementAffected(selectedCard.id) && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: '#e8f5e8',
                  borderRadius: '8px',
                  border: '2px dashed #28a745'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#28a745',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    ⚡ 상호작용 네트워크 시각화
                  </div>

                  {/* 상향 영향 (영향받음) */}
                  {reverseConnections.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                      fontSize: '13px',
                      marginBottom: '8px'
                    }}>
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        flexWrap: 'wrap'
                      }}>
                        {reverseConnections.slice(0, 2).map(connId => {
                          const connectedCard = cultureMapData.find(item => item.id === connId);
                          if (!connectedCard) return null;
                          return (
                            <div 
                              key={connId}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: layerColors[connectedCard.layer],
                                color: 'white',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                            >
                              {layerTitles[connectedCard.layer]}
                            </div>
                          );
                        })}
                        {reverseConnections.length > 2 && (
                          <div style={{
                            padding: '4px 8px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '11px'
                          }}>
                            +{reverseConnections.length - 2}개
                          </div>
                        )}
                      </div>
                      <div style={{ color: '#dc3545', fontSize: '18px' }}>→</div>
                      <div style={{
                        padding: '6px 12px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        borderRadius: '16px',
                        fontWeight: 'bold'
                      }}>
                        현재 선택
                      </div>
                      <div style={{ color: '#28a745', fontSize: '18px' }}>→</div>
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        flexWrap: 'wrap'
                      }}>
                        {directConnections.slice(0, 2).map(connId => {
                          const connectedCard = cultureMapData.find(item => item.id === connId);
                          if (!connectedCard) return null;
                          return (
                            <div 
                              key={connId}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: layerColors[connectedCard.layer],
                                color: 'white',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                            >
                              {layerTitles[connectedCard.layer]}
                            </div>
                          );
                        })}
                        {directConnections.length > 2 && (
                          <div style={{
                            padding: '4px 8px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '11px'
                          }}>
                            +{directConnections.length - 2}개
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 하향만 있는 경우 */}
                  {reverseConnections.length === 0 && directConnections.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                      fontSize: '13px'
                    }}>
                      <div style={{
                        padding: '6px 12px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        borderRadius: '16px',
                        fontWeight: 'bold'
                      }}>
                        현재 선택
                      </div>
                      <div style={{ color: '#28a745', fontSize: '18px' }}>→</div>
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        flexWrap: 'wrap'
                      }}>
                        {directConnections.slice(0, 3).map(connId => {
                          const connectedCard = cultureMapData.find(item => item.id === connId);
                          if (!connectedCard) return null;
                          return (
                            <div 
                              key={connId}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: layerColors[connectedCard.layer],
                                color: 'white',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                            >
                              {layerTitles[connectedCard.layer]}
                            </div>
                          );
                        })}
                        {directConnections.length > 3 && (
                          <div style={{
                            padding: '4px 8px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            borderRadius: '12px',
                            fontSize: '11px'
                          }}>
                            +{directConnections.length - 3}개
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 하향 연결 요소들 */}
              {directConnections.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ 
                    color: '#28a745', 
                    fontSize: '14px', 
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    ⬇️ 영향을 미치는 요소들 ({directConnections.length}개)
                  </h6>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '8px'
                  }}>
                    {directConnections.map(connId => {
                      const connectedCard = cultureMapData.find(item => item.id === connId);
                      if (!connectedCard) return null;
                      
                      const isConnectedAffected = isElementAffected(connId);
                      
                      return renderConnectedCard(connectedCard, isConnectedAffected, '하향');
                    })}
                  </div>
                </div>
              )}

              {/* 상향 연결 요소들 */}
              {reverseConnections.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h6 style={{ 
                    color: '#dc3545', 
                    fontSize: '14px', 
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    ⬆️ 영향을 받는 요소들 ({reverseConnections.length}개)
                  </h6>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '8px'
                  }}>
                    {reverseConnections.map(connId => {
                      const connectedCard = cultureMapData.find(item => item.id === connId);
                      if (!connectedCard) return null;
                      
                      const isConnectedAffected = isElementAffected(connId);
                      
                      return renderConnectedCard(connectedCard, isConnectedAffected, '상향');
                    })}
                  </div>
                </div>
              )}
            </div>
            );
          })()}

          {/* LLM 분석 결과 표시 */}
          {isElementAffected(selectedCard.id) ? (
            <div>
              <h5 style={{ 
                color: '#28a745',
                margin: '0 0 12px 0',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                ✨ LLM 분석 결과
              </h5>
              <div style={{
                backgroundColor: '#ffffff',
                border: '2px solid #28a745',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ 
                    display: 'inline-block',
                    backgroundColor: getActivitySource(selectedCard.id) === 'CA활동' ? '#007bff' : '#6f42c1',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    marginBottom: '8px'
                  }}>
                    {getActivitySource(selectedCard.id)}
                  </div>
                  <div style={{ color: '#28a745', fontWeight: 'bold', marginBottom: '8px' }}>
                    기여도: {getContributionLevel(selectedCard.id) === 'high' ? '높음' : 
                              getContributionLevel(selectedCard.id) === 'medium' ? '보통' : '낮음'}
                  </div>
                </div>
                
                {/* 기여 활동 내용 */}
                <div style={{ marginBottom: '16px' }}>
                  <strong style={{ color: '#2c3e50' }}>기여 활동:</strong>
                  <div style={{ 
                    marginTop: '6px',
                    padding: '8px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    fontSize: '14px',
                    lineHeight: 1.4
                  }}>
                    {(() => {
                      const affected = getAffectedElements();
                      const element = affected.find(el => el.element_id === selectedCard.id);
                      return element?.evidence || '해당 요소에 기여하는 구체적인 활동 내용이 분석되었습니다.';
                    })()}
                  </div>
                </div>

                {/* 연결된 요소에 대한 영향 관계 */}
                {selectedCard.connections.length > 0 && (
                  <div>
                    <strong style={{ color: '#2c3e50' }}>영향 관계:</strong>
                    <div style={{ 
                      marginTop: '6px',
                      padding: '8px',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '6px',
                      fontSize: '14px',
                      lineHeight: 1.4
                    }}>
                      이 요소의 구현 기여가 연결된 {selectedCard.connections.length}개 요소
                      ({selectedCard.connections.map(id => {
                        const connectedCard = cultureMapData.find(item => item.id === id);
                        return connectedCard ? layerTitles[connectedCard.layer] : '';
                      }).filter((value, index, self) => self.indexOf(value) === index).join(', ')})에 
                      긍정적 영향을 미칩니다.
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h5 style={{ 
                color: '#6c757d',
                margin: '0 0 12px 0',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                📋 기본 정보
              </h5>
              <div style={{ 
                color: '#6c757d',
                margin: '0 0 12px 0',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
              </div>
              <div style={{
                backgroundColor: '#ffffff',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ marginBottom: '12px', color: '#6c757d' }}>
                  현재 분석에서 이 요소에 대한 직접적인 기여 활동이 확인되지 않았습니다.
                </div>
                <div style={{ 
                  fontSize: '14px',
                  color: '#6c757d',
                  lineHeight: 1.4
                }}>
                  이 요소는 {selectedCard.type} 층위에 속하며, 
                  {selectedCard.connections.length > 0 ? 
                    `${selectedCard.connections.length}개의 다른 요소와 연결되어 있습니다.` :
                    '다른 요소와의 직접적인 연결이 없는 기본 요소입니다.'
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CultureMapCardView;