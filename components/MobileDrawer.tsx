'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { LiveRoom } from '@/lib/data/seed-rooms';
import { IconButton } from './ui/IconButton';
import { IconClose } from './ui/Icons';
import { SidebarItem, SidebarSection } from './ui/SidebarItem';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: LiveRoom[];
  onSelectRoom: (room: LiveRoom) => void;
}

export function MobileDrawer({ isOpen, onClose, rooms, onSelectRoom }: MobileDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleRoomClick = (room: LiveRoom) => {
    onSelectRoom(room);
    onClose();
  };

  return createPortal(
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.72)',
          zIndex: 1000,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Channels"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 'min(280px, 86vw)',
          background: 'var(--bg-surface)',
          zIndex: 1010,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            height: 'var(--nav-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px 0 12px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700 }}>Channels</span>
          <IconButton label="Close menu" onClick={onClose}>
            <IconClose size={18} />
          </IconButton>
        </div>

        <SidebarSection title="Live channels">
          {rooms.slice(0, 12).map((room) => (
            <SidebarItem key={room.id} room={room} onSelect={handleRoomClick} />
          ))}
        </SidebarSection>

        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            Demo rooms for hackathon presentation
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}
