import React, { useState, useEffect } from 'react';
import './SessionManager.css';
import { getApiUrl, getNetworkInfo } from '../utils/networkUtils';
import { useAuth } from '../hooks/useAuth';
import { AdminLogin } from './AdminLogin';
import { AdminPanel } from './AdminPanel';
import AdminGateway from './AdminGateway';

export const SessionManager = ({ onSessionSelected, currentSessionCode }) => {
  const [mode, setMode] = useState('join');
  const [sessionCode, setSessionCode] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiBase, setApiBase] = useState(import.meta.env.VITE_API_BASE_URL || 'http://localhost:65432/api');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showGatewayPanel, setShowGatewayPanel] = useState(false);
  const { isAuthenticated } = useAuth();

  // Gateway 관리자 확인
  const isGatewayAdmin = () => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('gateway-auth-token');
        if (stored) {
          const authData = JSON.parse(stored);
          if (Date.now() < authData.expiresAt && authData.isAdmin) {
            return true;
          }
        }
      } catch (error) {
        console.error('Gateway auth check error:', error);
      }
    }
    return false;
  };

  // 세션 접속 URL 생성
  const generateSessionUrl = (sessionCode) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?session=${sessionCode}`;
  };

  // QR코드 URL 생성 (Google Charts API 사용)
  const generateQRCode = (sessionCode) => {
    const sessionUrl = generateSessionUrl(sessionCode);
    const encodedUrl = encodeURIComponent(sessionUrl);
    return `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodedUrl}`;
  };

  // URL 복사 기능
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('URL이 클립보드에 복사되었습니다!');
    } catch (err) {
      // 클립보드 API가 지원되지 않는 경우 대체 방법
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('URL이 클립보드에 복사되었습니다!');
    }
  };

  // 세션 목록 로드
  const loadSessions = async () => {
    try {
      const response = await fetch(`${apiBase}/sessions`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

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

  useEffect(() => {
    if (mode === 'list') {
      loadSessions();
    }
  }, [mode, apiBase]);

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

  // 기존 세션 선택
  const handleSelectExistingSession = async (selectedSession) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBase}/sessions/${selectedSession.code}/join`, {
        method: 'POST',
      });

      if (response.ok) {
        onSessionSelected(selectedSession.code);
        localStorage.setItem('currentSessionCode', selectedSession.code);
        localStorage.setItem('currentSessionName', selectedSession.name);
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

  // 날짜 포맷팅
  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('ko-KR');
  };

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
          {isGatewayAdmin() && (
            <button 
              className={mode === 'gateway' ? 'active admin-tab' : 'admin-tab'}
              onClick={() => setMode('gateway')}
            >
              🔐 임시 비밀번호 관리
            </button>
          )}
          <button 
            className={mode === 'list' ? 'active' : ''}
            onClick={() => setMode('list')}
          >
            활성 세션 목록
          </button>
        </div>

        <div className="admin-section">
          {isAuthenticated ? (
            <button 
              className="admin-panel-btn"
              onClick={() => setShowAdminPanel(true)}
            >
              🔐 관리자 패널
            </button>
          ) : (
            <button 
              className="admin-login-btn"
              onClick={() => setShowAdminLogin(true)}
            >
              🔐 관리자
            </button>
          )}
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


        {mode === 'list' && (
          <div className="sessions-list">
            {sessions.length === 0 ? (
              <p className="no-sessions">생성된 세션이 없습니다.</p>
            ) : (
              sessions.map((session) => (
                <div key={session.code} className="session-card">
                  <div className="session-header">
                    <h3>{session.name}</h3>
                    <span className="session-code">{session.code}</span>
                  </div>
                  {session.description && (
                    <p className="session-description">{session.description}</p>
                  )}
                  <div className="session-meta">
                    <span>생성: {formatDate(session.createdAt)}</span>
                    <span>참가자: {session.participantCount}명</span>
                  </div>
                  <button 
                    onClick={() => handleSelectExistingSession(session)}
                    disabled={loading}
                    className="primary-btn"
                  >
                    이 세션 선택
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {mode === 'gateway' && isGatewayAdmin() && (
          <div className="gateway-panel-container">
            <div className="gateway-info">
              <h3>🔐 임시 비밀번호 관리</h3>
              <p>워크샵, 데모, 테스트용 임시 비밀번호를 생성하고 관리할 수 있습니다.</p>
            </div>
            <AdminGateway />
          </div>
        )}

        {/* 관리자 로그인 팝업 */}
        {showAdminLogin && (
          <AdminLogin onClose={() => setShowAdminLogin(false)} />
        )}

        {/* 관리자 패널 */}
        {showAdminPanel && (
          <AdminPanel onClose={() => setShowAdminPanel(false)} />
        )}
      </div>
    </div>
  );
};