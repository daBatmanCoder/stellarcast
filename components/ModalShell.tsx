'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalShellProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  allowOverlayClose?: boolean;
  mobileBottomSheet?: boolean;
}

export function ModalShell({ 
  isOpen, 
  onClose, 
  children, 
  allowOverlayClose = true,
  mobileBottomSheet = false 
}: ModalShellProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && allowOverlayClose && onClose) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, allowOverlayClose, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && allowOverlayClose && onClose) {
      onClose();
    }
  };

  const modalContent = (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1000,
          animation: 'modal-overlay-fade 160ms ease-out forwards'
        }}
      />

      {/* Centering container */}
      <div
        onClick={handleOverlayClick}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          display: 'flex',
          alignItems: mobileBottomSheet ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: mobileBottomSheet ? '0' : '16px',
          zIndex: 1010,
          overflowY: 'auto'
        }}
      >
        {/* Card */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          style={{
            position: 'relative',
            width: mobileBottomSheet ? '100%' : 'min(400px, calc(100vw - 32px))',
            maxWidth: mobileBottomSheet ? '100%' : '400px',
            borderRadius: mobileBottomSheet ? '20px 20px 0 0' : '24px',
            backgroundColor: '#16161D',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.48)',
            animation: 'modal-card-enter 200ms ease-out forwards',
            paddingBottom: mobileBottomSheet ? 'env(safe-area-inset-bottom, 0px)' : '0'
          }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes modal-overlay-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes modal-card-enter {
          from {
            opacity: 0;
            transform: scale(0.96) ${mobileBottomSheet ? 'translateY(20px)' : ''};
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          @keyframes modal-overlay-fade,
          @keyframes modal-card-enter {
            from, to {
              opacity: 1;
              transform: none;
            }
          }
        }

        @media (max-width: 640px) {
          ${mobileBottomSheet ? `
            [role="dialog"] {
              border-radius: 20px 20px 0 0 !important;
            }
          ` : ''}
        }
      `}</style>
    </>
  );

  return createPortal(modalContent, document.body);
}
