import React, { useState } from 'react';
import './SessionHeader.css';

export const SessionHeader = ({ sessionCode, sessionName, onLeaveSession }) => {
  const [showAccessGuide, setShowAccessGuide] = useState(false);

  const handleLeaveSession = () => {
    if (window.confirm('세션을 종료하시겠습니까? 저장되지 않은 변경사항은 자동으로 저장됩니다.')) {
      onLeaveSession();
    }
  };

  // 세션 접속 URL 생성
  const generateSessionUrl = (sessionCode) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?session=${sessionCode}`;
  };

  // QR코드 URL 생성 (여러 서비스 대안)
  const generateQRCode = (sessionCode) => {
    const sessionUrl = generateSessionUrl(sessionCode);
    const encodedUrl = encodeURIComponent(sessionUrl);
    console.log('Session URL:', sessionUrl);
    console.log('QR Code URL:', `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`);
    
    // QR Server API 사용 (Google Charts 대안)
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;
  };

  // URL 복사 기능
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('URL이 클립보드에 복사되었습니다!');
    } catch (err) {
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

  return (
    <div className="session-header">
      <div className="session-info">
        <div className="session-name">{sessionName}</div>
        <div className="session-code">세션 코드: {sessionCode}</div>
      </div>
      <div className="session-actions">
        <button 
          className="access-guide-btn"
          onClick={() => setShowAccessGuide(true)}
          title="세션 접속 안내"
        >
          세션 접속안내
        </button>
        <button 
          className="leave-session-btn"
          onClick={handleLeaveSession}
          title="세션 종료"
        >
          ← 세션 종료
        </button>
      </div>
      {/* 세션 접속 안내 팝업 */}
      {showAccessGuide && (
        <div className="access-guide-overlay" onClick={() => setShowAccessGuide(false)}>
          <div className="access-guide-popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>세션 접속 안내</h3>
              <button 
                className="close-btn"
                onClick={() => setShowAccessGuide(false)}
              >
                ×
              </button>
            </div>
            
            <div className="popup-content">
              <div className="session-info-box">
                <p><strong>세션명:</strong> {sessionName}</p>
                <p><strong>세션 코드:</strong> <span className="code">{sessionCode}</span></p>
              </div>
              
              <div className="access-methods">
                <div className="qr-section">
                  <h4>📱 모바일 접속</h4>
                  <div className="qr-code-container">
                    <img 
                      src={generateQRCode(sessionCode)} 
                      alt="세션 접속 QR코드"
                      className="qr-code"
                    />
                    <p className="qr-instruction">QR코드를 스캔하여 접속하세요</p>
                  </div>
                </div>
                
                <div className="url-section">
                  <h4>💻 데스크탑/노트북 접속</h4>
                  <div className="url-container">
                    <input 
                      type="text" 
                      value={generateSessionUrl(sessionCode)} 
                      readOnly 
                      className="url-input"
                    />
                    <button 
                      onClick={() => copyToClipboard(generateSessionUrl(sessionCode))}
                      className="copy-btn"
                    >
                      📋 복사
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};