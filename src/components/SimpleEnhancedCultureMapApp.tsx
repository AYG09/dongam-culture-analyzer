import { useState } from 'react';

function SimpleEnhancedCultureMapApp() {
  console.log('🎯 SimpleEnhancedCultureMapApp 렌더링됨!');
  
  const [notes, setNotes] = useState([]);
  
  return (
    <div style={{ 
      width: '100%', 
      height: '600px', 
      background: 'linear-gradient(180deg, #ffcccb 25%, #add8e6 50%, #90ee90 75%, #ffd700 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
      fontWeight: 'bold',
      position: 'relative'
    }}>
      <div style={{ marginBottom: '20px' }}>
        ✅ EnhancedCultureMapApp이 정상 작동 중입니다!
      </div>
      <div style={{ marginBottom: '20px' }}>
        🎯 4층위 시스템이 로드되었습니다!
      </div>
      
      {/* 층위 라벨들 */}
      <div style={{ 
        position: 'absolute', 
        left: '20px', 
        top: '10px', 
        backgroundColor: 'rgba(255,204,203,0.8)',
        padding: '5px 10px',
        borderRadius: '5px'
      }}>
        🔴 결과 (Outcomes)
      </div>
      
      <div style={{ 
        position: 'absolute', 
        left: '20px', 
        top: '160px', 
        backgroundColor: 'rgba(173,216,230,0.8)',
        padding: '5px 10px',
        borderRadius: '5px'
      }}>
        🔵 행동 (Behaviors)
      </div>
      
      <div style={{ 
        position: 'absolute', 
        left: '20px', 
        top: '310px', 
        backgroundColor: 'rgba(144,238,144,0.8)',
        padding: '5px 10px',
        borderRadius: '5px'
      }}>
        🟢 유형 요인 (Tangible)
      </div>
      
      <div style={{ 
        position: 'absolute', 
        left: '20px', 
        top: '460px', 
        backgroundColor: 'rgba(255,215,0,0.8)',
        padding: '5px 10px',
        borderRadius: '5px'
      }}>
        🟡 무형 요인 (Intangible)
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        완전한 기능은 곧 추가됩니다...
      </div>
    </div>
  );
}

export default SimpleEnhancedCultureMapApp;
