import React, { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../utils/networkUtils';

let dynamicApiBase = import.meta.env.VITE_dynamicApiBase_URL || '/api';

// 동적 API URL 초기화
async function initializeDynamicApi() {
  try {
    dynamicApiBase = await getApiUrl();
  } catch (error) {
    console.warn('Failed to get dynamic API URL, using fallback');
  }
}

export const useSession = () => {
  const [currentSessionCode, setCurrentSessionCode] = useState(null);
  const [currentSessionName, setCurrentSessionName] = useState(null);
  const [isSessionReady, setIsSessionReady] = useState(false);
  
  // 컴포넌트 초기화 시 동적 API URL 설정
  useEffect(() => {
    initializeDynamicApi();
  }, []);

  // 로컬 스토리지에서 세션 정보 복원
  useEffect(() => {
    const storedSessionCode = localStorage.getItem('currentSessionCode');
    const storedSessionName = localStorage.getItem('currentSessionName');
    
    if (storedSessionCode && storedSessionName) {
      setCurrentSessionCode(storedSessionCode);
      setCurrentSessionName(storedSessionName);
      setIsSessionReady(true);
    }
  }, []);

  // 브라우저 종료 시 자동으로 세션 나가기
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSessionCode) {
        // navigator.sendBeacon을 사용해서 브라우저가 닫혀도 요청이 전송되도록 함
        const url = `${dynamicApiBase}/sessions/${currentSessionCode}/leave`;
        try {
          // sendBeacon을 지원하는 경우
          if (navigator.sendBeacon) {
            navigator.sendBeacon(url, JSON.stringify({}));
          } else {
            // fallback으로 동기 fetch 요청
            fetch(url, {
              method: 'POST',
              keepalive: true
            });
          }
        } catch (error) {
          console.error('Failed to send leave request on unload:', error);
        }
      }
    };

    // beforeunload 이벤트만 등록 (unload는 지원 중단됨)
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentSessionCode]);

  // 세션 참가
  const joinSession = useCallback(async (sessionCode) => {
    try {
      const response = await fetch(`${dynamicApiBase}/sessions/${sessionCode}/join`, {
        method: 'POST',
      });
      
      if (response.ok) {
        console.log(`Successfully joined session: ${sessionCode}`);
        return true;
      } else {
        console.error(`Failed to join session: ${sessionCode}`);
        return false;
      }
    } catch (error) {
      console.error('Failed to join session:', error);
      return false;
    }
  }, []);

  // 세션 선택
  const selectSession = useCallback(async (sessionCode, sessionName) => {
    // 먼저 서버에 참가 요청
    const joinSuccess = await joinSession(sessionCode);
    
    if (joinSuccess) {
      setCurrentSessionCode(sessionCode);
      setCurrentSessionName(sessionName || sessionCode);
      setIsSessionReady(true);
      localStorage.setItem('currentSessionCode', sessionCode);
      if (sessionName) {
        localStorage.setItem('currentSessionName', sessionName);
      }
    }
  }, [joinSession]);

  // 세션 종료
  const leaveSession = useCallback(async () => {
    if (currentSessionCode) {
      try {
        // 서버에 세션 나가기 요청
        await fetch(`${dynamicApiBase}/sessions/${currentSessionCode}/leave`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Failed to notify server of session leave:', error);
        // 서버 요청 실패해도 로컬 상태는 정리
      }
    }
    
    setCurrentSessionCode(null);
    setCurrentSessionName(null);
    setIsSessionReady(false);
    localStorage.removeItem('currentSessionCode');
    localStorage.removeItem('currentSessionName');
  }, [currentSessionCode]);

  // 컬처맵 데이터 저장
  const saveCultureMapData = useCallback(async (notes, connections, layerState) => {
    if (!currentSessionCode) return false;

    try {
      const response = await fetch(`${dynamicApiBase}/culture-map`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionCode: currentSessionCode,
          notes,
          connections,
          layerState,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to save culture map data:', error);
      return false;
    }
  }, [currentSessionCode]);

  // 컬처맵 데이터 로드
  const loadCultureMapData = useCallback(async () => {
    if (!currentSessionCode) return null;

    try {
      const response = await fetch(`${dynamicApiBase}/culture-map/${currentSessionCode}`);
      
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to load culture map data:', error);
      return null;
    }
  }, [currentSessionCode]);

  // 세션별 아티팩트 저장
  const saveSessionArtifact = useCallback(async (content, options = {}) => {
    if (!currentSessionCode) return null;

    try {
      const response = await fetch(`${dynamicApiBase}/session-artifacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionCode: currentSessionCode,
          content,
          ...options,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to save session artifact:', error);
      return null;
    }
  }, [currentSessionCode]);

  // 세션별 아티팩트 목록 조회
  const listSessionArtifacts = useCallback(async () => {
    if (!currentSessionCode) return [];

    try {
      const response = await fetch(`${dynamicApiBase}/session-artifacts/${currentSessionCode}`);
      
      if (response.ok) {
        const data = await response.json();
        return data.items || [];
      }
      
      return [];
    } catch (error) {
      console.error('Failed to list session artifacts:', error);
      return [];
    }
  }, [currentSessionCode]);

  return {
    currentSessionCode,
    currentSessionName,
    isSessionReady,
    selectSession,
    leaveSession,
    saveCultureMapData,
    loadCultureMapData,
    saveSessionArtifact,
    listSessionArtifacts,
  };
};