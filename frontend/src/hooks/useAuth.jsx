import React, { useState, useCallback, useContext, createContext, useEffect } from 'react';
import { getApiUrl } from '../utils/networkUtils';

let dynamicApiBase = import.meta.env.VITE_dynamicApiBase_URL || '/api';

async function initializeDynamicApi() {
  try {
    dynamicApiBase = await getApiUrl();
  } catch (error) {
    console.warn('Failed to get dynamic API URL, using fallback');
  }
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminInfo, setAdminInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeDynamicApi();
    
    // 로컬 스토리지에서 인증 정보 복원
    const storedAuth = localStorage.getItem('admin_auth');
    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth);
        setIsAuthenticated(true);
        setAdminInfo(authData);
      } catch (error) {
        localStorage.removeItem('admin_auth');
      }
    }
  }, []);

  const login = useCallback(async (password) => {
    setLoading(true);
    
    try {
      // Gateway 인증 엔드포인트 사용 (admin 비번 또는 임시 비번)
      const response = await fetch(`${dynamicApiBase}/gateway-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data?.success) {
        const authData = {
          username: data.isAdmin ? 'ADMIN' : 'TEMP',
          token: data.sessionToken, // gw_* 토큰
          isAdmin: !!data.isAdmin,
          expiresAt: data.expiresAt || null,
          loginTime: new Date().toISOString(),
        };

        setIsAuthenticated(true);
        setAdminInfo(authData);
        localStorage.setItem('admin_auth', JSON.stringify(authData));

        return { success: true };
      }

      return { success: false, error: data?.error || '인증에 실패했습니다.' };
    } catch (error) {
      return { success: false, error: '네트워크 오류가 발생했습니다.' };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setAdminInfo(null);
    localStorage.removeItem('admin_auth');
  }, []);

  const getAllSessions = useCallback(async () => {
    if (!isAuthenticated) return [];

    try {
      // gateway-admin 엔드포인트로 실제 sessions 테이블 조회
      const bearer = adminInfo?.token || (import.meta.env.VITE_GATEWAY_ADMIN_PASSWORD ? `${import.meta.env.VITE_GATEWAY_ADMIN_PASSWORD}` : '');
      const headers = bearer ? { 'Authorization': `Bearer ${bearer}` } : {};
      const response = await fetch(`${dynamicApiBase}/gateway-admin?type=sessions`, { headers });

      if (response.ok) {
        const data = await response.json();
        // 서버는 { sessions: [...], total, page, ... } 형태를 반환
        return data.sessions || [];
      }

      if (response.status === 401 || response.status === 403) {
        // 토큰이 유효하지 않음 → 자동 로그아웃 유도
        console.warn('Admin token invalid. Forcing logout.');
        logout();
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch all sessions:', error);
      return [];
    }
  }, [isAuthenticated, adminInfo, logout]);

  const deleteSession = useCallback(async (sessionCode) => {
    if (!isAuthenticated) return false;

    try {
      const response = await fetch(`${dynamicApiBase}/admin/sessions/${sessionCode}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminInfo?.token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  }, [isAuthenticated, adminInfo]);

  const value = {
    isAuthenticated,
    adminInfo,
    loading,
    login,
    logout,
    getAllSessions,
    deleteSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};