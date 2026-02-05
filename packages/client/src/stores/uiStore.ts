import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  isMobile: boolean;
  theme: 'light' | 'dark' | 'system';

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setIsMobile: (isMobile: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  isMobile: false,
  theme: 'system',

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setIsMobile: (isMobile) => set({ isMobile }),
  setTheme: (theme) => set({ theme }),
}));
