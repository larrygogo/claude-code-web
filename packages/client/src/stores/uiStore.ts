import React from 'react';
import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  isMobile: boolean;
  mobileHeaderActions: React.ReactNode | null;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setIsMobile: (isMobile: boolean) => void;
  setMobileHeaderActions: (actions: React.ReactNode | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  isMobile: false,
  mobileHeaderActions: null,

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setIsMobile: (isMobile) => set({ isMobile }),
  setMobileHeaderActions: (actions) => set({ mobileHeaderActions: actions }),
}));
