import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import './AdminPanel.css';

export const AdminPanel = ({ onClose }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { getAllSessions, deleteSession, logout } = useAuth();

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const sessionList = await getAllSessions();
      setSessions(sessionList);
    } catch (error) {
      setError('세션 목록을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionCode, sessionName) => {
    if (!window.confirm(`세션 "${sessionName} (${sessionCode})"를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setLoading(true);
    const success = await deleteSession(sessionCode);
    
    if (success) {
      setSessions(sessions.filter(session => session.code !== sessionCode));
      alert('세션이 삭제되었습니다.');
    } else {
      alert('세션 삭제에 실패했습니다.');
    }
    
    setLoading(false);
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('ko-KR');
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <div className="admin-panel-overlay">
      <div className="admin-panel">
        <div className="panel-header">
          <h3>관리자 패널</h3>
          <div className="header-actions">
            <button 
              className="refresh-btn"
              onClick={loadSessions}
              disabled={loading}
            >
              🔄 새로고침
            </button>
            <button 
              className="logout-btn"
              onClick={handleLogout}
            >
              로그아웃
            </button>
            <button 
              className="close-btn"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="panel-content">
          {error && <div className="error-message">{error}</div>}
          
          <div className="sessions-section">
            <h4>활성 세션 관리</h4>
            
            {loading ? (
              <div className="loading-message">세션 목록을 불러오는 중...</div>
            ) : sessions.length === 0 ? (
              <div className="no-sessions">생성된 세션이 없습니다.</div>
            ) : (
              <div className="sessions-grid">
                {sessions.map((session) => (
                  <div key={session.code} className="session-card">
                    <div className="session-header">
                      <h5>{session.name}</h5>
                      <span className="session-code">{session.code}</span>
                    </div>
                    
                    {session.description && (
                      <p className="session-description">{session.description}</p>
                    )}
                    
                    <div className="session-meta">
                      <div className="meta-item">
                        <span className="meta-label">생성:</span>
                        <span className="meta-value">{formatDate(session.createdAt)}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">참가자:</span>
                        <span className="meta-value">{session.participantCount}명</span>
                      </div>
                      {session.lastActivity && (
                        <div className="meta-item">
                          <span className="meta-label">최근 활동:</span>
                          <span className="meta-value">{formatDate(session.lastActivity)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="session-actions">
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteSession(session.code, session.name)}
                        disabled={loading}
                      >
                        🗑️ 삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};