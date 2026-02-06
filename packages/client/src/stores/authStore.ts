import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthTokens, UserSettings } from '@claude-web/shared';
import { apiClient, login as apiLogin, refreshToken, logout as apiLogout, getCurrentUser, updateUserSettings } from '@/lib/api';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isInitialized: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  setAuthState: (user: User, tokens: AuthTokens) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isLoading: false,
      isInitialized: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await apiLogin(email, password);
          apiClient.setAccessToken(response.tokens.accessToken);
          set({
            user: response.user,
            tokens: response.tokens,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        const { tokens } = get();
        if (tokens?.refreshToken) {
          try {
            await apiLogout(tokens.refreshToken);
          } catch {
            // Ignore logout errors
          }
        }
        apiClient.setAccessToken(null);
        set({ user: null, tokens: null });
      },

      initialize: async () => {
        const { tokens } = get();

        if (!tokens?.accessToken) {
          set({ isInitialized: true });
          return;
        }

        apiClient.setAccessToken(tokens.accessToken);

        try {
          const user = await getCurrentUser();
          set({ user, isInitialized: true });
        } catch {
          // Token might be expired, try to refresh
          try {
            await get().refresh();
            const user = await getCurrentUser();
            set({ user, isInitialized: true });
          } catch {
            // Refresh failed, clear auth state
            apiClient.setAccessToken(null);
            set({ user: null, tokens: null, isInitialized: true });
          }
        }
      },

      refresh: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await refreshToken(tokens.refreshToken);
        apiClient.setAccessToken(response.tokens.accessToken);
        set({ tokens: response.tokens });
      },

      updateSettings: async (settings: Partial<UserSettings>) => {
        const { user } = get();
        if (!user) {
          throw new Error('Not logged in');
        }

        const newSettings = await updateUserSettings(settings);
        set({ user: { ...user, settings: newSettings } });
      },

      setAuthState: (user: User, tokens: AuthTokens) => {
        apiClient.setAccessToken(tokens.accessToken);
        set({ user, tokens, isInitialized: true });
      },
    }),
    {
      name: 'claude-web-auth',
      partialize: (state) => ({
        tokens: state.tokens,
      }),
    }
  )
);
