'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { LiveRoom } from '@/lib/data/seed-rooms';

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

  if (!isOpen) return null;

  const handleRoomClick = (room: LiveRoom) => {
    onSelectRoom(room);
    onClose();
  };

  const drawerContent = (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1000
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 'min(320px, 86vw)',
          backgroundColor: 'var(--elevated)',
          zIndex: 1010,
          overflowY: 'auto',
          paddingTop: '48px',
          animation: 'slideIn 280ms ease-out'
        }}
      >
        <div style={{ padding: '16px 12px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ 
            fontSize: '13px', 
            fontWeight: 600, 
            color: 'var(--text-secondary)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em' 
          }}>
            Live Channels
          </h2>
        </div>

        <div style={{ paddingTop: '8px', paddingBottom: '8px' }}>
          {rooms.slice(0, 10).map((room) => (
            <button
              key={room.id}
              onClick={() => handleRoomClick(room)}
              style={{
                width: '100%',
                height: '48px',
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'inherit',
                transition: 'background 150ms'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: 'var(--accent)',
                  color: 'white'
                }}
              >
                {room.host.slice(2, 4).toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ 
                    fontSize: '14px', 
                    fontWeight: 500, 
                    color: 'var(--text-primary)', 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>
                    {room.hostDisplayName || `${room.host.slice(0, 6)}...${room.host.slice(-4)}`}
                  </p>
                  <span
                    style={{
                      flexShrink: 0,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      backgroundColor: 'var(--live)',
                      color: 'white'
                    }}
                  >
                    LIVE
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  {room.category} · {room.viewers.toLocaleString()}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Demo badge */}
        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          padding: '12px', 
          borderTop: '1px solid var(--border)', 
          backgroundColor: 'var(--elevated)' 
        }}>
          <p style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
            Demo rooms for hackathon
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );

  return createPortal(drawerContent, document.body);
}
