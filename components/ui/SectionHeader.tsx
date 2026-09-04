'use client';

import type { ReactNode } from 'react';
import { Button } from './Button';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function SectionHeader({ title, actionLabel, onAction, children }: SectionHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
        minHeight: 28,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {children}
        {actionLabel && onAction && (
          <Button variant="ghost" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </header>
  );
}
