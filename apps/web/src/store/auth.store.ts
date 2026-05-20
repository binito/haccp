import { create } from 'zustand';
import { User } from '@/types';
import { setUser, setAccessToken, clearAuth } from '@/lib/auth';
import api from '@/lib/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  login: (user: User, accessToken: string) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  hydrated: false,

  login: (user: User, accessToken: string) => {
    setUser(user);
    setAccessToken(accessToken);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignorar erros de rede no logout
    }
    clearAuth();
    set({ user: null, isAuthenticated: false });
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      // Tenta renovar a sessão usando o refresh token (HttpOnly cookie).
      // Se o cookie estiver expirado ou ausente, cai no catch e redireciona para login.
      const { data } = await api.post<{ access_token: string; user: User }>('/auth/refresh');
      setUser(data.user);
      setAccessToken(data.access_token);
      set({ user: data.user, isAuthenticated: true, hydrated: true });
    } catch {
      clearAuth();
      set({ user: null, isAuthenticated: false, hydrated: true });
    }
  },
}));
