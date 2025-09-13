import React, { useState, useEffect } from 'react';
// 간소화된 유틸리티 함수들
const generateRandomPassword = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const getAuthToken = () => {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('gateway-auth-token');
      if (stored) {
        const authData = JSON.parse(stored);
        if (Date.now() > authData.expiresAt) {
          return null;
        }
        return authData;
      }
    } catch (error) {
      console.error('Auth token parse error:', error);
    }
  }
  return null;
};

const isAdmin = () => {
  const authToken = getAuthToken();
  return authToken && authToken.isAdmin;
};

const gatewayFetch = async (endpoint, options = {}) => {
  const url = `/api${endpoint}`;
  
  const defaultOptions = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  const authToken = getAuthToken();
  if (authToken && authToken.isAdmin) {
    // 관리자인 경우 환경변수에서 설정한 관리자 비밀번호 사용
    defaultOptions.headers['Authorization'] = `Bearer WINTER09@!`;
  }
  
  try {
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      headers: { ...defaultOptions.headers, ...options.headers },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Gateway API Error:', error);
    return { success: false, error: error.message };
  }
};

const getErrorMessage = (error, defaultMessage = '서버 오류가 발생했습니다.') => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return defaultMessage;
};

const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  } catch (error) {
    console.error('클립보드 복사 실패:', error);
    return false;
  }
};
import './Gateway.css';

const AdminGateway = () => {
  // 탭 상태
  const [activeTab, setActiveTab] = useState('passwords');
  
  // 비밀번호 관리 상태
  const [passwords, setPasswords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // 세션 관리 상태
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionTotal, setSessionTotal] = useState(0);
  
  // 새 비밀번호 폼 상태
  const [newPassword, setNewPassword] = useState({
    password: '',
    description: '',
    expireHours: 24,
    maxUses: '',
    autoGenerate: false
  });

  // 컴포넌트 마운트시 권한 확인 및 데이터 로드
  useEffect(() => {
    if (!isAdmin()) {
      setError('관리자 권한이 필요합니다.');
      return;
    }
    loadPasswords();
  }, []);

  // 임시 비밀번호 목록 로드
  const loadPasswords = async () => {
    setLoading(true);
    try {
      const result = await gatewayFetch('/gateway-admin', {
        method: 'GET'
      });

      if (result.success) {
        setPasswords(result.data.tempPasswords || []);
        setError('');
      } else {
        setError(result.error || '비밀번호 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // 새 비밀번호 생성
  const handleCreatePassword = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const payload = {
        ...newPassword,
        maxUses: newPassword.maxUses ? parseInt(newPassword.maxUses) : null
      };

      const result = await gatewayFetch('/gateway-admin', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (result.success) {
        await loadPasswords(); // 목록 새로고침
        setShowCreateForm(false);
        resetForm();
        alert(`비밀번호가 생성되었습니다: ${result.data.tempPassword.password}`);
      } else {
        setError(result.error || '비밀번호 생성에 실패했습니다.');
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  // 비밀번호 삭제
  const handleDeletePassword = async (id, password) => {
    if (!confirm(`비밀번호 "${password}"를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const result = await gatewayFetch(`/gateway-admin?password=${encodeURIComponent(password)}`, {
        method: 'DELETE'
      });

      if (result.success) {
        await loadPasswords(); // 목록 새로고침
        alert(result.data.message || '비밀번호가 삭제되었습니다.');
      } else {
        setError(result.error || '비밀번호 삭제에 실패했습니다.');
      }
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  // 폼 리셋
  const resetForm = () => {
    setNewPassword({
      password: '',
      description: '',
      expireHours: 24,
      maxUses: '',
      autoGenerate: false
    });
  };

  // 자동 생성 토글
  const handleAutoGenerateToggle = () => {
    const autoGenerate = !newPassword.autoGenerate;
    setNewPassword({
      ...newPassword,
      autoGenerate,
      password: autoGenerate ? generateRandomPassword() : ''
    });
  };

  // 비밀번호 복사
  const handleCopyPassword = async (password) => {
    const success = await copyToClipboard(password);
    if (success) {
      alert('비밀번호가 복사되었습니다!');
    } else {
      alert('복사에 실패했습니다. 수동으로 복사해주세요.');
    }
  };

  // 세션 목록 로드
  const loadSessions = async (search = '', page = 1) => {
    setSessionsLoading(true);
    try {
      const params = new URLSearchParams({
        type: 'sessions',
        page: page.toString(),
        limit: '20'
      });
      
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const result = await gatewayFetch(`/gateway-admin?${params}`, {
        method: 'GET'
      });

      if (result.success) {
        setSessions(result.data.sessions || []);
        setSessionTotal(result.data.total || 0);
        setSessionPage(page);
        setError('');
      } else {
        setError(result.error || '세션 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setSessionsLoading(false);
    }
  };

  // 세션 삭제
  const handleDeleteSession = async (sessionId) => {
    if (!confirm(`세션 "${sessionId}"을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const result = await gatewayFetch(`/gateway-admin?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      });

      if (result.success) {
        await loadSessions(sessionSearch, sessionPage); // 목록 새로고침
        alert(result.data.message || '세션이 삭제되었습니다.');
      } else {
        setError(result.error || '세션 삭제에 실패했습니다.');
      }
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  // 세션 검색
  const handleSessionSearch = () => {
    setSessionPage(1);
    loadSessions(sessionSearch, 1);
  };

  // 탭 변경 시 데이터 로드
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'sessions' && sessions.length === 0) {
      loadSessions();
    }
  };

  // 권한 없음
  if (!isAdmin()) {
    return (
      <div className="admin-gateway-container">
        <div className="admin-error">
          <h2>접근 권한 없음</h2>
          <p>관리자 권한이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-gateway-container">
      <div className="admin-header">
        <h2>Gateway 관리자 패널</h2>
        <p>임시 비밀번호와 세션을 관리할 수 있습니다.</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'passwords' ? 'active' : ''}`}
          onClick={() => handleTabChange('passwords')}
        >
          임시 비밀번호 관리
        </button>
        <button 
          className={`tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => handleTabChange('sessions')}
        >
          세션 관리
        </button>
      </div>

      {error && (
        <div className="admin-error-message">
          {error}
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {/* 비밀번호 관리 탭 */}
      {activeTab === 'passwords' && (
        <div className="tab-content">
          {/* 새 비밀번호 생성 버튼 */}
          <div className="admin-actions">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="create-password-btn"
            >
              {showCreateForm ? '취소' : '새 비밀번호 생성'}
            </button>
            <button
              onClick={loadPasswords}
              className="refresh-btn"
              disabled={loading}
            >
              {loading ? '새로고침 중...' : '새로고침'}
            </button>
          </div>

      {/* 비밀번호 생성 폼 */}
      {showCreateForm && (
        <div className="create-form-container">
          <h3>새 임시 비밀번호 생성</h3>
          <form onSubmit={handleCreatePassword} className="create-form">
            <div className="form-row">
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newPassword.autoGenerate}
                    onChange={handleAutoGenerateToggle}
                  />
                  자동 생성
                </label>
              </div>
            </div>

            {!newPassword.autoGenerate && (
              <div className="form-group">
                <label>비밀번호:</label>
                <input
                  type="text"
                  value={newPassword.password}
                  onChange={(e) => setNewPassword({...newPassword, password: e.target.value})}
                  placeholder="비밀번호 입력"
                  required
                />
              </div>
            )}

            {newPassword.autoGenerate && (
              <div className="form-group">
                <label>생성된 비밀번호:</label>
                <div className="generated-password">
                  <code>{newPassword.password}</code>
                  <button
                    type="button"
                    onClick={() => setNewPassword({
                      ...newPassword,
                      password: generateRandomPassword()
                    })}
                    className="regenerate-btn"
                  >
                    다시 생성
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>설명:</label>
              <input
                type="text"
                value={newPassword.description}
                onChange={(e) => setNewPassword({...newPassword, description: e.target.value})}
                placeholder="비밀번호 용도 설명"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>유효 시간 (시간):</label>
                <input
                  type="number"
                  value={newPassword.expireHours}
                  onChange={(e) => setNewPassword({...newPassword, expireHours: parseInt(e.target.value)})}
                  min="1"
                  max="8760"
                />
              </div>
              <div className="form-group">
                <label>최대 사용 횟수:</label>
                <input
                  type="number"
                  value={newPassword.maxUses}
                  onChange={(e) => setNewPassword({...newPassword, maxUses: e.target.value})}
                  placeholder="무제한"
                  min="1"
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" disabled={creating} className="submit-btn">
                {creating ? '생성 중...' : '생성'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
                className="cancel-btn"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 비밀번호 목록 */}
      <div className="passwords-container">
        <h3>임시 비밀번호 목록 ({passwords.length}개)</h3>
        
        {loading ? (
          <div className="loading">비밀번호 목록을 불러오는 중...</div>
        ) : passwords.length === 0 ? (
          <div className="no-passwords">등록된 임시 비밀번호가 없습니다.</div>
        ) : (
          <div className="passwords-list">
            {passwords.map((pwd) => {
              // 비밀번호 상태 계산
              const now = new Date();
              const expiresAt = new Date(pwd.expires_at);
              const isExpired = now > expiresAt;
              const isExhausted = pwd.max_uses && pwd.used_count >= pwd.max_uses;
              
              let status, statusText;
              if (isExpired) {
                status = 'expired';
                statusText = '만료';
              } else if (isExhausted) {
                status = 'exhausted';
                statusText = '소진';
              } else {
                status = 'active';
                statusText = '활성';
              }
              
              // 남은 시간 계산
              const timeRemaining = isExpired ? '만료됨' : 
                Math.ceil((expiresAt - now) / (1000 * 60 * 60)) + '시간 남음';
              
              // 사용 정보
              const usageInfo = pwd.max_uses ? 
                `${pwd.used_count}/${pwd.max_uses}회` : 
                `${pwd.used_count}회 (무제한)`;
              
              return (
              <div key={pwd.id} className={`password-item ${status}`}>
                <div className="password-header">
                  <div className="password-main">
                    <code className="password-text" onClick={() => handleCopyPassword(pwd.password)}>
                      {pwd.password}
                    </code>
                    <span className={`status-badge ${status}`}>
                      {statusText}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeletePassword(pwd.id, pwd.password)}
                    className="delete-btn"
                    title="삭제"
                  >
                    🗑️
                  </button>
                </div>
                
                <div className="password-details">
                  {pwd.description && (
                    <p className="description">{pwd.description}</p>
                  )}
                  <div className="meta-info">
                    <span>생성: {new Date(pwd.created_at).toLocaleString()}</span>
                    <span>만료: {timeRemaining}</span>
                    <span>사용: {usageInfo}</span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
        </div>
      )}

      {/* 세션 관리 탭 */}
      {activeTab === 'sessions' && (
        <div className="tab-content">
          {/* 세션 검색 */}
          <div className="session-controls">
            <div className="search-box">
              <input
                type="text"
                placeholder="세션 ID, IP 주소, User Agent로 검색..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSessionSearch()}
              />
              <button onClick={handleSessionSearch} className="search-btn">
                검색
              </button>
            </div>
            <button
              onClick={() => loadSessions(sessionSearch, sessionPage)}
              className="refresh-btn"
              disabled={sessionsLoading}
            >
              {sessionsLoading ? '새로고침 중...' : '새로고침'}
            </button>
          </div>

          {/* 세션 목록 */}
          <div className="sessions-container">
            <h3>활성 세션 목록 ({sessionTotal}개)</h3>
            
            {sessionsLoading ? (
              <div className="loading">세션 목록을 불러오는 중...</div>
            ) : sessions.length === 0 ? (
              <div className="no-sessions">활성 세션이 없습니다.</div>
            ) : (
              <div className="sessions-list">
                {sessions.map((session) => (
                  <div key={session.session_token || session.id} className="session-item">
                    <div className="session-header">
                      <div className="session-main">
                        <code className="session-id">{session.session_token || 'N/A'}</code>
                        <span className="session-ip">{session.ip_address}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteSession(session.session_token || session.id)}
                        className="delete-btn"
                        title="세션 삭제"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    <div className="session-details">
                      <div className="meta-info">
                        <span>로그인: {new Date(session.timestamp).toLocaleString()}</span>
                        <span>사용자: {session.password_used}</span>
                        <span>성공: {session.success ? '✅' : '❌'}</span>
                      </div>
                      {session.user_agent && (
                        <p className="user-agent">{session.user_agent}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 페이지네이션 */}
            {sessionTotal > 20 && (
              <div className="pagination">
                <button
                  onClick={() => loadSessions(sessionSearch, sessionPage - 1)}
                  disabled={sessionPage <= 1 || sessionsLoading}
                >
                  이전
                </button>
                <span>페이지 {sessionPage}</span>
                <button
                  onClick={() => loadSessions(sessionSearch, sessionPage + 1)}
                  disabled={sessionPage * 20 >= sessionTotal || sessionsLoading}
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGateway;