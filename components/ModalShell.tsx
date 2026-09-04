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
  const [isMobile, setIsMobile] = useState(false);

  // Handle client-side mounting + mobile detection
  useEffect(() => {
    setMounted(true);
    
    // Immediately check on mount
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

  // Don't render until mounted client-side
  if (!mounted || !isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && allowOverlayClose && onClose) {
      onClose();
    }
  };

  // Force check on every render for immediate responsiveness
  const currentlyMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
  const isBottomSheet = mobileBottomSheet && (isMobile || currentlyMobile);

  const modalContent = (
    <>
      {/* Overlay SEPARATE layer */}
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
          zIndex: 1000
        }}
      />

      {/* Centering layer SEPARATE */}
      <div
        onClick={handleOverlayClick}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          display: 'flex',
          alignItems: isBottomSheet ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: isBottomSheet ? 0 : 16,
          zIndex: 1010
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
            maxWidth: isBottomSheet ? '100%' : 400,
            maxHeight: isBottomSheet ? 'min(92dvh, 640px)' : 'none',
            borderRadius: isBottomSheet ? '20px 20px 0 0' : '24px',
            backgroundColor: '#16161D',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.48)',
            paddingBottom: isBottomSheet ? 'max(20px, env(safe-area-inset-bottom))' : 0,
            overflowY: isBottomSheet ? 'auto' : 'visible',
            animation: isBottomSheet ? 'slideUp 280ms ease-out' : 'none'
          }}
        >
          {/* Drag handle for bottom sheet */}
          {isBottomSheet && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              paddingTop: '12px',
              paddingBottom: '8px'
            }}>
              <div style={{
                width: '36px',
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.24)',
                borderRadius: '2px'
              }} />
            </div>
          )}
          {children}
        </div>
      </div>

      {/* Keyframes for sheet animation */}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );

  return createPortal(modalContent, document.body);
}
