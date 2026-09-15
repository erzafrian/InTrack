import { useState, useEffect } from 'react';
import { getMe, login as loginApi, logout as logoutApi } from '../api/auth';

import { AuthContext } from './auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    const clearSession = () => setUser(null);
    window.addEventListener('auth-expired', clearSession);
    return () => window.removeEventListener('auth-expired', clearSession);
  }, []);

  async function checkAuth() {
    try {
      const res = await getMe();
      setUser(res.data.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password, rememberMe = false) {
    const res = await loginApi(email, password, rememberMe);
    setUser(res.data.data);
    return res.data.data;
  }

  async function logout() {
    await logoutApi();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
