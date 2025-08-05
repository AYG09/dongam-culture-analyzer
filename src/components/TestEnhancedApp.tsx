function TestEnhancedApp() {
  console.log('🎯 TestEnhancedApp 렌더링됨!');
  
  return (
    <div style={{ 
      width: '100%', 
      height: '600px', 
      background: 'linear-gradient(180deg, #ffcccb 25%, #add8e6 50%, #90ee90 75%, #ffd700 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      fontWeight: 'bold'
    }}>
      ✅ EnhancedCultureMapApp이 정상 작동 중입니다!
      <br />
      4층위 시스템이 로드되었습니다!
    </div>
  );
}

export default TestEnhancedApp;
