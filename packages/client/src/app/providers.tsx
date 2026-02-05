'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useIsMobile } from '@/hooks/useMediaQuery';

export function Providers({ children }: { children: React.ReactNode }) {
  const { initialize, isInitialized } = useAuthStore();
  const { setIsMobile } = useUIStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    setIsMobile(isMobile);
  }, [isMobile, setIsMobile]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
