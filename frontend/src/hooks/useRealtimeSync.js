import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiUrl } from '../utils/networkUtils';

let dynamicApiBase = import.meta.env.VITE_dynamicApiBase_URL || '/api';

// 동적 API URL 초기화 (실패 시 '/api' 유지)
async function initializeRealtimeApi() {
  try {
    dynamicApiBase = await getApiUrl();
  } catch (error) {
    console.warn('Failed to get dynamic API URL for realtime sync, using fallback');
  }
}

// 고유 사용자 ID 생성
function generateUserId() {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const useRealtimeSync = (sessionCode) => {
  // 상태
  const [fieldStates, setFieldStates] = useState({});
  const [fieldValues, setFieldValues] = useState({});
  const [lastUpdate, setLastUpdate] = useState(0);

  // 참조들 (stale-closure 방지)
  const userIdRef = useRef(generateUserId());
  const sessionCodeRef = useRef(sessionCode);
  const lastUpdateRef = useRef(0);
  const lockTimeouts = useRef({});
  const pollTimer = useRef(null);
  const inFlight = useRef(false);
  const abortRef = useRef(null);
  const backoffMsRef = useRef(500);

  const MAX_BACKOFF = 5000;
  const MIN_BACKOFF = 500;

  // 동적 API URL 초기화
  useEffect(() => {
    initializeRealtimeApi();
  }, []);

  // sessionCode 변경 시 참조/상태 리셋
  useEffect(() => {
    sessionCodeRef.current = sessionCode;
    // 세션이 바뀌면 타임라인 초기화
    setLastUpdate(0);
    lastUpdateRef.current = 0;
    backoffMsRef.current = MIN_BACKOFF;

    // 기존 타이머 정리 후 즉시 폴링 시도
    if (pollTimer.current) clearTimeout(pollTimer.current);
    if (sessionCode) {
      if (!inFlight.current) {
        void pollLoop();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCode]);

  // lastUpdate 동기화
  useEffect(() => {
    lastUpdateRef.current = lastUpdate;
  }, [lastUpdate]);

  // 다음 폴링 예약 (가변 간격 + 지터)
  const scheduleNext = useCallback((delayMs) => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    const jitter = Math.floor(Math.random() * 200);
    pollTimer.current = setTimeout(() => {
      void pollLoop();
    }, Math.max(0, delayMs) + jitter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 필드 상태 폴링 루프 (refs만 읽어 stale 방지)
  const pollLoop = useCallback(async () => {
    const code = sessionCodeRef.current;
    if (!code) return;
    if (typeof document !== 'undefined' && document.hidden) {
      // 화면 비가시 상태 → 천천히
      scheduleNext(Math.min(Math.max(backoffMsRef.current, 2000), MAX_BACKOFF));
      return;
    }
    if (inFlight.current) return; // 이미 진행 중

    inFlight.current = true;
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    abortRef.current = new AbortController();

    try {
      const since = lastUpdateRef.current || 0;
      const res = await fetch(`${dynamicApiBase}/fields/${code}/updates?since=${since}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
          signal: abortRef.current.signal,
        }
      );

      if (res.status === 304) {
        // 변경 없음 → 백오프 증가
        backoffMsRef.current = Math.min(backoffMsRef.current + 500, MAX_BACKOFF);
      } else if (res.ok) {
        const data = await res.json();
        const serverLast = Number(data.lastUpdate || 0);
        if (serverLast > (lastUpdateRef.current || 0)) {
          setFieldStates(data.fields || {});
          setFieldValues(prev => ({ ...prev, ...(data.values || {}) }));
          setLastUpdate(serverLast);
          backoffMsRef.current = MIN_BACKOFF; // 변경 감지 → 빠르게
        } else {
          backoffMsRef.current = Math.min(backoffMsRef.current + 500, MAX_BACKOFF);
        }
      } else if (res.status === 404) {
        // 세션 없음 → 천천히 재시도
        backoffMsRef.current = Math.min(Math.max(backoffMsRef.current, 2000), MAX_BACKOFF);
      } else if (res.status === 429) {
        // 레이트 리밋 → 큰 백오프
        backoffMsRef.current = Math.min(5000, MAX_BACKOFF);
      } else {
        console.error('Failed to poll field updates:', res.status, res.statusText);
        backoffMsRef.current = Math.min(Math.max(backoffMsRef.current, 2000), MAX_BACKOFF);
      }
    } catch (err) {
      if (!(err && err.name === 'AbortError')) {
        console.error('Failed to poll field updates:', err);
        backoffMsRef.current = Math.min(Math.max(backoffMsRef.current, 2000), MAX_BACKOFF);
      }
    } finally {
      inFlight.current = false;
      scheduleNext(backoffMsRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 필드 잠금 요청
  const lockField = useCallback(async (fieldId) => {
    if (!sessionCodeRef.current) return false;
    try {
      const response = await fetch(`${dynamicApiBase}/fields/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCode: sessionCodeRef.current,
          fieldId,
          userId: userIdRef.current,
        }),
      });
      const result = await response.json();
      if (result.success) {
        // 5분 후 자동 잠금 해제
        if (lockTimeouts.current[fieldId]) {
          clearTimeout(lockTimeouts.current[fieldId]);
        }
        lockTimeouts.current[fieldId] = setTimeout(() => {
          void unlockField(fieldId);
        }, 300000);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to lock field:', error);
      return false;
    }
  }, [unlockField]);

  // 필드 잠금 해제
  const unlockField = useCallback(async (fieldId) => {
    if (!sessionCodeRef.current) return;
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
          sessionCode: sessionCodeRef.current,
          fieldId,
          userId: userIdRef.current,
        }),
      });
    } catch (error) {
      console.error('Failed to unlock field:', error);
    }
  }, []);

  // 필드 값 업데이트
  const updateFieldValue = useCallback(async (fieldId, value) => {
    if (!sessionCodeRef.current) return false;
    try {
      const response = await fetch(`${dynamicApiBase}/fields/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCode: sessionCodeRef.current,
          fieldId,
          value,
          userId: userIdRef.current,
        }),
      });
      const result = await response.json();
      if (result.success) {
        // 사용자 입력 시 즉시 빠른 폴링으로 전환하고 트리거
        backoffMsRef.current = MIN_BACKOFF;
        if (!inFlight.current) {
          void pollLoop();
        }
      }
      return result.success;
    } catch (error) {
      console.error('Failed to update field:', error);
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 폴링 시작/중지 + 가시성/온라인 상태 핸들링
  useEffect(() => {
    if (!sessionCodeRef.current) return;
    // 즉시 한 번 실행
    backoffMsRef.current = MIN_BACKOFF;
    void pollLoop();

    const onVisibility = () => {
      if (!sessionCodeRef.current) return;
      if (!document.hidden) {
        backoffMsRef.current = MIN_BACKOFF;
        if (!inFlight.current) void pollLoop();
      }
    };
    const onOnline = () => {
      if (!sessionCodeRef.current) return;
      backoffMsRef.current = MIN_BACKOFF;
      if (!inFlight.current) void pollLoop();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      if (pollTimer.current) clearTimeout(pollTimer.current);
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
      }
      // 모든 잠금 해제
      Object.keys(lockTimeouts.current).forEach((fid) => {
        void fetch(`${dynamicApiBase}/fields/unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionCode: sessionCodeRef.current,
            fieldId: fid,
            userId: userIdRef.current,
          }),
        }).catch(() => {});
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 필드가 다른 사용자에 의해 잠겨있는지 확인
  const isFieldLocked = useCallback((fieldId) => {
    const fieldState = fieldStates[fieldId];
    if (!fieldState || !fieldState.lockedBy) return false;
    return fieldState.lockedBy !== userIdRef.current;
  }, [fieldStates]);

  // 필드가 내가 잠근 것인지 확인
  const isFieldLockedByMe = useCallback((fieldId) => {
    const fieldState = fieldStates[fieldId];
    if (!fieldState) return false;
    return fieldState.lockedBy === userIdRef.current;
  }, [fieldStates]);

  // 필드 값 가져오기
  const getFieldValue = useCallback((fieldId) => {
    const valueState = fieldValues[fieldId];
    return valueState ? valueState.value : '';
  }, [fieldValues]);

  return {
    userId: userIdRef.current,
    lockField,
    unlockField,
    updateFieldValue,
    isFieldLocked,
    isFieldLockedByMe,
    getFieldValue,
    fieldStates,
    fieldValues,
  };
};