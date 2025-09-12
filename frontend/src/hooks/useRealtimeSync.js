import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiUrl } from '../utils/networkUtils';

let dynamicApiBase = import.meta.env.VITE_dynamicApiBase_URL || 'http://localhost:65432/api';

// 동적 API URL 초기화
async function initializeRealtimeApi() {
  try {
    dynamicApiBase = await getApiUrl();
  } catch (error) {
    console.warn('Failed to get dynamic API URL for realtime sync, using fallback');
  }
}

export const useRealtimeSync = (sessionCode) => {
  const [fieldStates, setFieldStates] = useState({});
  const [fieldValues, setFieldValues] = useState({});
  const [lastUpdate, setLastUpdate] = useState(0);
  
  const userId = useRef(generateUserId()).current;
  const pollInterval = useRef(null);
  const lockTimeouts = useRef({});

  // 컴포넌트 초기화 시 동적 API URL 설정
  useEffect(() => {
    initializeRealtimeApi();
  }, []);

  // 고유 사용자 ID 생성
  function generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 필드 상태 폴링
  const pollUpdates = useCallback(async () => {
    if (!sessionCode) return;

    try {
      const response = await fetch(
        `${dynamicApiBase}/fields/${sessionCode}/updates?since=${lastUpdate}`
      );
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.lastUpdate > lastUpdate) {
          // 서버에서 받은 필드 상태로 완전히 대체 (단순화)
          console.log(`[DEBUG] Updating field states:`, data.fields);
          setFieldStates(data.fields || {});
          setFieldValues(prev => ({ ...prev, ...data.values }));
          setLastUpdate(data.lastUpdate);
        }
      } else if (response.status === 404) {
        // 세션이 없는 경우 - 무시하고 계속
        console.log('Session not found, will retry...');
      } else {
        console.error('Failed to poll field updates:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to poll field updates:', error);
    }
  }, [sessionCode, lastUpdate]);

  // 필드 잠금 요청
  const lockField = useCallback(async (fieldId) => {
    if (!sessionCode) return false;

    try {
      const response = await fetch(`${dynamicApiBase}/fields/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCode,
          fieldId,
          userId
        })
      });

      const result = await response.json();
      if (result.success) {
        // 5분 후 자동 잠금 해제
        if (lockTimeouts.current[fieldId]) {
          clearTimeout(lockTimeouts.current[fieldId]);
        }
        
        lockTimeouts.current[fieldId] = setTimeout(() => {
          unlockField(fieldId);
        }, 300000); // 5분
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to lock field:', error);
      return false;
    }
  }, [sessionCode, userId]);

  // 필드 잠금 해제
  const unlockField = useCallback(async (fieldId) => {
    if (!sessionCode) return;

    // 타임아웃 정리
    if (lockTimeouts.current[fieldId]) {
      clearTimeout(lockTimeouts.current[fieldId]);
      delete lockTimeouts.current[fieldId];
    }

    try {
      await fetch(`${dynamicApiBase}/fields/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCode,
          fieldId,
          userId
        })
      });
    } catch (error) {
      console.error('Failed to unlock field:', error);
    }
  }, [sessionCode, userId]);

  // 필드 값 업데이트
  const updateFieldValue = useCallback(async (fieldId, value) => {
    if (!sessionCode) return false;

    try {
      const response = await fetch(`${dynamicApiBase}/fields/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCode,
          fieldId,
          value,
          userId
        })
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Failed to update field:', error);
      return false;
    }
  }, [sessionCode, userId]);

  // 필드가 다른 사용자에 의해 잠겨있는지 확인
  const isFieldLocked = useCallback((fieldId) => {
    const fieldState = fieldStates[fieldId];
    // 필드 상태가 없거나, 활성화되지 않았거나, 잠금자가 없으면 잠금되지 않음
    if (!fieldState || !fieldState.isActive || !fieldState.lockedBy) {
      return false;
    }
    
    // 다른 사용자가 잠금한 경우만 true
    return fieldState.lockedBy !== userId;
  }, [fieldStates, userId]);

  // 필드가 내가 잠근 것인지 확인
  const isFieldLockedByMe = useCallback((fieldId) => {
    const fieldState = fieldStates[fieldId];
    if (!fieldState || !fieldState.isActive) return false;
    
    return fieldState.lockedBy === userId;
  }, [fieldStates, userId]);

  // 필드 값 가져오기
  const getFieldValue = useCallback((fieldId) => {
    const valueState = fieldValues[fieldId];
    return valueState ? valueState.value : '';
  }, [fieldValues]);

  // 폴링 시작/중지
  useEffect(() => {
    if (sessionCode) {
      // 즉시 한 번 실행
      pollUpdates();
      
      // 500ms마다 폴링 (더 빠른 반응)
      pollInterval.current = setInterval(pollUpdates, 500);
      
      return () => {
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
        }
        
        // 모든 잠금 해제
        Object.keys(lockTimeouts.current).forEach(fieldId => {
          unlockField(fieldId);
        });
      };
    }
  }, [sessionCode, pollUpdates]);

  return {
    userId,
    lockField,
    unlockField,
    updateFieldValue,
    isFieldLocked,
    isFieldLockedByMe,
    getFieldValue,
    fieldStates,
    fieldValues
  };
};