import React, { useState, useEffect } from 'react';
import './SessionManager.css';
import { getApiUrl } from '../utils/networkUtils';

export const SessionManager = ({ onSessionSelected, currentSessionCode }) => {
  const [mode, setMode] = useState('join');
  const [sessionCode, setSessionCode] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiBase, setApiBase] = useState(import.meta.env.VITE_API_BASE_URL || '/api');

  // 관리자 기능들은 메인 앱의 관리자 패널로 이동됨

  // 컴포넌트 마운트 시 동적 API URL 설정
  useEffect(() => {
    async function updateApiBase() {
      try {
        const dynamicApiUrl = await getApiUrl();
        setApiBase(dynamicApiUrl);
      } catch (error) {
        console.warn('Failed to get dynamic API URL, using fallback:', error);
      }
    }
    
    updateApiBase();
  }, []);

  // 관리자 전용 기능 제거로 불필요한 useEffect 삭제

  // 세션 참가
  const handleJoinSession = async (e) => {
    e.preventDefault();
    if (!sessionCode.trim()) {
      setError('세션 코드를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBase}/sessions/${sessionCode}/join`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        onSessionSelected(sessionCode);
        localStorage.setItem('currentSessionCode', sessionCode);
        localStorage.setItem('currentSessionName', data.session.name);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || '세션에 참가할 수 없습니다.');
      }
    } catch (error) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 새 세션 생성
  const handleCreateSession = async (e) => {
    e.preventDefault();
    
    if (!sessionName.trim()) {
      setError('세션명을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBase}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sessionName.trim(),
          description: sessionDescription.trim() || '',
        }),
      });

      if (response.ok) {
        const newSession = await response.json();
        // 바로 세션 선택 (QR코드 표시 생략)
        onSessionSelected(newSession.code);
        localStorage.setItem('currentSessionCode', newSession.code);
        localStorage.setItem('currentSessionName', newSession.name);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || '세션을 생성할 수 없습니다.');
      }
    } catch (error) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 관리자 전용 기능들 제거됨

  if (currentSessionCode) {
    return null; // 이미 세션에 참가한 경우 컴포넌트를 숨김
  }

  return (
    <div className="session-manager-overlay">
      <div className="session-manager">
        <h2>동암정신 내재화 성과분석기</h2>
        <p>작업 세션을 선택하거나 생성해주세요</p>

        <div className="session-tabs">
          <button 
            className={mode === 'join' ? 'active' : ''}
            onClick={() => setMode('join')}
          >
            세션 참가
          </button>
          <button 
            className={mode === 'create' ? 'active' : ''}
            onClick={() => setMode('create')}
          >
            새 세션 생성
          </button>
          {/* 관리자 전용 탭들은 메인 앱의 관리자 패널에서만 접근 가능 */}
        </div>

        {/* 로그아웃 버튼 추가 */}
        <div className="logout-section">
          <button 
            className="logout-btn"
            onClick={() => {
              // Gateway 인증 토큰 제거
              localStorage.removeItem('gateway-auth-token');
              // 세션 정보도 정리
              localStorage.removeItem('currentSessionCode');
              localStorage.removeItem('currentSessionName');
              // 페이지 새로고침하여 Gateway 로그인 화면으로 돌아가기
              window.location.reload();
            }}
            title="로그아웃 - Gateway 인증 화면으로 돌아갑니다"
          >
            🚪 로그아웃
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {mode === 'join' && (
          <form onSubmit={handleJoinSession} className="session-form">
            <div className="form-group">
              <label htmlFor="sessionCode">세션 코드</label>
              <input
                id="sessionCode"
                type="text"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                placeholder="예: ABC123"
                maxLength={6}
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading} className="primary-btn">
              {loading ? '참가 중...' : '세션 참가'}
            </button>
          </form>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreateSession} className="session-form">
            <p className="create-info">새로운 분석 세션을 생성합니다. 생성된 코드를 팀원들과 공유하세요.</p>
            
            <div className="form-group">
              <label htmlFor="sessionName">세션명 *</label>
              <input
                id="sessionName"
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="예: 2024년 3분기 동암정신 분석"
                maxLength={100}
                disabled={loading}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="sessionDescription">세션 설명 (선택사항)</label>
              <textarea
                id="sessionDescription"
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                placeholder="세션에 대한 간단한 설명을 입력하세요."
                rows={3}
                maxLength={500}
                disabled={loading}
              />
            </div>
            
            <button 
              type="submit"
              disabled={loading || !sessionName.trim()} 
              className="primary-btn create-session-btn"
            >
              {loading ? '생성 중...' : '새 세션 생성'}
            </button>
          </form>
        )}


        {/* 관리자 기능들은 모두 메인 앱의 관리자 패널로 이동됨 */}
      </div>
    </div>
  );
};