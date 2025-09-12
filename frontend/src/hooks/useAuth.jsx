import React, { useState, useCallback, useContext, createContext, useEffect } from 'react';
import { getApiUrl } from '../utils/networkUtils';

let dynamicApiBase = import.meta.env.VITE_dynamicApiBase_URL || 'http://localhost:65432/api';

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
      const response = await fetch(`${dynamicApiBase}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'ADMIN',
          password: password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const authData = {
          username: 'ADMIN',
          token: data.token || 'admin-token',
          loginTime: new Date().toISOString(),
        };
        
        setIsAuthenticated(true);
        setAdminInfo(authData);
        localStorage.setItem('admin_auth', JSON.stringify(authData));
        
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.detail || '인증에 실패했습니다.' };
      }
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
      const response = await fetch(`${dynamicApiBase}/admin/sessions`, {
        headers: {
          'Authorization': `Bearer ${adminInfo?.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.sessions || [];
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch all sessions:', error);
      return [];
    }
  }, [isAuthenticated, adminInfo]);

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