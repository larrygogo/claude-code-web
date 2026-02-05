import React from 'react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { Menu, X } from 'lucide-react';

interface MobileHeaderProps {
  title?: string;
}

export function MobileHeader({ title = 'Claude Code' }: MobileHeaderProps) {
  const { isSidebarOpen, toggleSidebar, mobileHeaderActions } = useUIStore();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="flex h-14 items-center px-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <h1 className="ml-3 text-lg font-semibold truncate flex-1">{title}</h1>
        {mobileHeaderActions && (
          <div className="flex items-center gap-1 ml-2">
            {mobileHeaderActions}
          </div>
        )}
      </div>
    </header>
  );
}
