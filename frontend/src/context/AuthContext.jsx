import { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken, clearToken } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('nexusfx_token');
    if (token) {
      api.me()
        .then(setUser)
        .catch(() => clearToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password, mfa_code) => {
    const data = await api.login({ username, password, mfa_code });
    if (data.mfa_required) {
      return data;
    }
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (username, email, password, invite_code) => {
    const data = await api.register({ username, email, password, invite_code });
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
