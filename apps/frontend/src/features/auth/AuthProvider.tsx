import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAccessToken } from '../../lib/api';
import { User } from '../../types';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (name: string, phone: string, password: string) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const authenticate = useCallback(async (url: string, payload: object) => {
    const { data } = await api.post<{ accessToken: string; user: User }>(url, payload);
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  useEffect(() => {
    api.post<{ accessToken: string; user: User }>('/auth/refresh')
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        setUser(data.user);
      })
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    login: (phone, password) => authenticate('/auth/login', { phone, password }),
    register: (name, phone, password) => authenticate('/auth/register', { name, phone, password }),
    updateProfile: async (name) => {
      const { data } = await api.patch<User>('/users/me', { name });
      setUser(data);
    },
    logout: async () => {
      try {
        await api.post('/auth/logout');
      } finally {
        setAccessToken(null);
        setUser(null);
      }
    },
  }), [authenticate, ready, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
