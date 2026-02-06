import React, { useRef, useEffect } from 'react';
import { Skill } from '@claude-web/shared';
import { cn } from '@/lib/utils';
import { Terminal } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  filter: string;
  skills: Skill[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onSelect: (skill: Skill) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
}

export function getFilteredSkills(skills: Skill[], filter: string): Skill[] {
  if (!filter) return skills;
  const lowerFilter = filter.toLowerCase();
  return skills.filter(skill =>
    skill.name.toLowerCase().includes(lowerFilter) ||
    skill.description?.toLowerCase().includes(lowerFilter)
  );
}

export function CommandPalette({
  isOpen,
  filter,
  skills,
  selectedIndex,
  onSelectedIndexChange,
  onSelect,
  onClose,
  position = 'top',
}: CommandPaletteProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const filteredSkills = getFilteredSkills(skills, filter);

  // Scroll to selected item
  useEffect(() => {
    if (isOpen && listRef.current) {
      const selectedItem = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || filteredSkills.length === 0) {
    return null;
  }

  return (
    <div
      ref={listRef}
      className={cn(
        'absolute left-0 right-0 z-50 max-h-[200px] overflow-y-auto',
        'bg-popover border rounded-lg shadow-lg',
        position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
      )}
    >
      {filteredSkills.map((skill, index) => (
        <div
          key={skill.name}
          className={cn(
            'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors',
            index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
          )}
          onClick={() => onSelect(skill)}
          onMouseEnter={() => onSelectedIndexChange(index)}
        >
          <Terminal className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm">/{skill.name}</div>
            {skill.description && (
              <div className="text-xs text-muted-foreground truncate">
                {skill.description}
              </div>
            )}
          </div>
          {skill.isBuiltin && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              内置
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
