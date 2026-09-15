import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, login as loginApi, logout as logoutApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
