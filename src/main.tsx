import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/layerSystem.css'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { databaseService } from './services/DatabaseService'

// 데이터베이스 초기화를 기다린 후 React 앱 렌더링
async function initializeApp() {
  console.log('🔄 애플리케이션 초기화 시작...');
  
  // SQL.js 라이브러리 로딩 대기 (최대 10초)
  let attempts = 0;
  while (!window.initSqlJs && attempts < 100) {
    console.log(`⏳ SQL.js 라이브러리 로딩 대기 중... (${attempts + 1}/100)`);
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!window.initSqlJs) {
    console.error('❌ SQL.js 라이브러리 로딩 실패! CDN 문제일 수 있습니다.');
    // 에러가 있어도 앱은 렌더링 (대신 대체 메시지 표시)
  } else {
    console.log('✅ SQL.js 라이브러리 로드 확인');
  }
  
  try {
    const success = await databaseService.initialize();
    if (success) {
      console.log('✅ 데이터베이스가 성공적으로 초기화되었습니다.');
    } else {
      console.error('❌ 데이터베이스 초기화에 실패했습니다.');
    }
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 중 오류:', error);
  }
  
  // 데이터베이스 초기화 완료 후 React 앱 렌더링
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

// DOM 로딩 완료 후 앱 초기화 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
