import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get('/api/auth/me');
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    await api.post('/api/auth/login', { email, password });
    await refresh();
  };
  const register = async (name, email, password) => {
    await api.post('/api/auth/register', { name, email, password });
    await refresh();
  };
  const loginWithGoogle = async (credential) => {
    await api.post('/api/auth/google', { credential });
    await refresh();
  };
  const logout = async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, loginWithGoogle, logout, refresh }}>{children}</AuthCtx.Provider>
  );
}
