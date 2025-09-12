import React from 'react';

export default function GuidePanel({ step, onClose, ...props }) {
  const StepGuide = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <h4>1) 기본 정보 입력</h4>
            <ul>
              <li>활동명과 핵심 내용을 간단히 작성하세요.</li>
              <li>상세 입력은 선택입니다. Outcomes/Outputs/요인/교훈을 적으면 분석이 더 정확해집니다.</li>
              <li>팀/조 이름을 입력하면 저장/불러오기 시 필터가 편리합니다.</li>
            </ul>
          </div>
        );
      case 2:
        return (
          <div>
            <h4>2) 정신 선택 · 프롬프트 생성</h4>
            <ul>
              <li>해당 활동과 가장 연계된 동암정신을 선택하세요.</li>
              <li>프롬프트 생성 버튼을 누르면, 현재 입력을 반영한 한글 프롬프트가 만들어집니다.</li>
            </ul>
          </div>
        );
      case 3:
        return (
          <div>
            <h4>3) 생성된 프롬프트</h4>
            <ul>
              <li>복사하기로 외부 LLM에 붙여넣어 분석 JSON을 받아오세요.</li>
              <li>저장 버튼으로 프롬프트를 보관할 수 있습니다.</li>
            </ul>
          </div>
        );
      case 4:
        return (
          <div>
            <h4>4) LLM 결과(JSON) 붙여넣기</h4>
            <ul>
              <li>아래 예시 스키마에 맞춰 순수 JSON만 붙여넣어 주세요.</li>
              <li>예시: {`{"activated_levers":[{"lever_name":"안정성","status":"high","evidence":"월 불량률 2%p↓"}],"summary":"..."}`}</li>
              <li>저장 버튼으로 분석 결과도 보관할 수 있습니다.</li>
            </ul>
          </div>
        );
      case 5:
        return (
          <div>
            <h4>5) 시각화</h4>
            <ul>
              <li>배경 이미지 위에 활성 레버가 점으로 표시됩니다.</li>
              <li>기준점 비교가 흐리게 표시됩니다. 좌표가 없는 레버는 하단 목록으로 안내됩니다.</li>
              <li>배경 이미지가 없다면 <code>frontend/public/culture_maps/</code> 경로에 PNG를 추가하세요.</li>
            </ul>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div {...props} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'flex', justifyContent:'flex-end', zIndex:60 }}>
      <aside className="card" style={{ width:'min(420px, 92vw)', height:'100%', overflow:'auto', padding:'16px 16px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3>도움말 가이드</h3>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>

        <div className="muted" style={{ marginBottom: 12 }}>
          현재 단계에 맞는 간단한 안내와 문제 해결 팁을 제공합니다.
        </div>

        <StepGuide />

        <div style={{ marginTop: 16 }}>
          <h4>문제 해결</h4>
          <ul>
            <li>백엔드 헬스체크: <code>http://127.0.0.1:65432/healthz</code> → {`{"ok":true}`}</li>
            <li>정신 목록: <code>/api/spirits</code> 응답에 항목이 있는지 확인</li>
            <li>저장/불러오기: <code>/api/artifacts*</code> 응답 코드 확인</li>
            <li>이미지 경로: <code>frontend/public/culture_maps/*.png</code> 파일명 일치</li>
          </ul>
        </div>

        <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          팁: 키보드 <kbd>?</kbd> 로 도움말을 여닫을 수 있습니다.
        </div>
      </aside>
    </div>
  );
}

