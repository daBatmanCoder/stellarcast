'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [mounted, setMounted] = useState(false);

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Don't render until mounted client-side
  if (!mounted || !isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && allowOverlayClose && onClose) {
      onClose();
    }
  };

  const modalContent = (
    <>
      {/* Overlay backdrop with blur */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 50
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
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: mobileBottomSheet ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: mobileBottomSheet ? 0 : 16,
          zIndex: 51,
          overflowY: 'auto',
          pointerEvents: 'auto'
        }}
      >
        {/* Card */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: mobileBottomSheet ? '100%' : 440,
            minWidth: 320,
            borderRadius: mobileBottomSheet ? '20px 20px 0 0' : 16,
            backgroundColor: '#16161D',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.48)',
            animation: 'modal-card-enter 200ms ease-out forwards',
            paddingBottom: mobileBottomSheet ? 'env(safe-area-inset-bottom, 0px)' : 0,
            margin: '0 auto',
            pointerEvents: 'auto'
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
