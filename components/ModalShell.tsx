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
  mobileBottomSheet = false,
}: ModalShellProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    setIsMobile(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
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

  if (!mounted || !isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && allowOverlayClose && onClose) {
      onClose();
    }
  };

  const currentlyMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
  const isBottomSheet = mobileBottomSheet && (isMobile || currentlyMobile);

  const modalContent = (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.72)',
          zIndex: 1000,
        }}
      />

      <div
        onClick={handleOverlayClick}
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: isBottomSheet ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: isBottomSheet ? 0 : 16,
          zIndex: 1010,
        }}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: isBottomSheet ? '100%' : 400,
            maxHeight: isBottomSheet ? 'min(92dvh, 640px)' : 'none',
            borderRadius: isBottomSheet ? '8px 8px 0 0' : 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
            paddingBottom: isBottomSheet ? 'max(16px, env(safe-area-inset-bottom))' : 0,
            overflowY: isBottomSheet ? 'auto' : 'visible',
          }}
        >
          {isBottomSheet && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 6 }}>
              <div
                style={{
                  width: 36,
                  height: 4,
                  backgroundColor: 'var(--border-subtle)',
                  borderRadius: 2,
                }}
              />
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
}
