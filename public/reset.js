// 🔥 시스템 완전 리셋 스크립트
console.log('🚀 시스템 완전 리셋 시작...');

// IndexedDB 완전 삭제
async function resetEverything() {
  try {
    // 1. IndexedDB 삭제
    if ('indexedDB' in window) {
      const deleteReq = indexedDB.deleteDatabase('CultureAnalysisDB');
      deleteReq.onsuccess = () => console.log('✅ IndexedDB 삭제 완료');
      deleteReq.onerror = () => console.log('⚠️ IndexedDB 삭제 실패');
    }
    
    // 2. 로컬 스토리지 정리
    localStorage.clear();
    sessionStorage.clear();
    
    console.log('✅ 브라우저 스토리지 정리 완료');
    
    // 3. 강제 새로고침
    setTimeout(() => {
      console.log('🔄 페이지 강제 새로고침...');
      window.location.reload(true);
    }, 1000);
    
  } catch (error) {
    console.error('❌ 리셋 실패:', error);
  }
}

resetEverything();