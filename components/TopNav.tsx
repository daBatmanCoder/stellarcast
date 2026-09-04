'use client';

import { useState, useEffect } from 'react';

interface TopNavProps {
  isConnected: boolean;
  address?: string;
  verifiedEnsName?: string;
  onConnect: () => void;
  onMenuToggle?: () => void;
  onGoLive?: () => void;
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export function TopNav({ isConnected, address, verifiedEnsName, onConnect, onMenuToggle, onGoLive }: TopNavProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    setIsMobile(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center px-4 gap-3"
      style={{
        height: '48px',
        backgroundColor: 'var(--elevated)',
        borderBottom: '1px solid var(--border)'
      }}
    >
      {/* Hamburger menu - mobile only */}
      <button
        onClick={onMenuToggle}
        className="flex items-center justify-center"
        style={{
          display: isMobile ? 'flex' : 'none',
          width: '44px',
          height: '44px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          borderRadius: '8px',
          transition: 'background 150ms'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        aria-label="Menu"
      >
        <MenuIcon />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2">
        <div
          className="rounded flex items-center justify-center font-bold text-white"
          style={{ 
            backgroundColor: 'var(--accent)',
            width: isMobile ? '32px' : '32px',
            height: isMobile ? '32px' : '32px',
            fontSize: isMobile ? '12px' : '14px'
          }}
        >
          S
        </div>
        <span 
          className="font-bold" 
          style={{ 
            color: 'var(--text-primary)',
            fontSize: isMobile ? '14px' : '18px'
          }}
        >
          STELLARCAST
        </span>
      </div>

      {/* Browse - desktop only */}
      <button
        className="px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface)] rounded transition-colors"
        style={{ 
          color: 'var(--text-primary)',
          display: isMobile ? 'none' : 'block'
        }}
      >
        Browse
      </button>

      {/* Search (centered) - desktop / compact on mobile */}
      <div className="flex-1 max-w-md mx-auto search-container">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search"
          className="w-full px-4 py-1.5 rounded text-sm"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            outline: 'none'
          }}
        />
      </div>

      {/* Actions right */}
      <div className="flex items-center gap-2">
        {/* Go Live button - shown when connected */}
        {isConnected && onGoLive && (
          <button
            onClick={onGoLive}
            className="rounded font-semibold transition-colors"
            style={{
              height: '44px',
              padding: isMobile ? '0 12px' : '0 16px',
              backgroundColor: 'var(--live)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: isMobile ? '13px' : '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <span style={{ fontSize: '16px' }}>●</span>
            {!isMobile && 'Go Live'}
          </button>
        )}

        {isConnected && address ? (
          <div
            className="flex items-center gap-2 rounded"
            style={{ 
              backgroundColor: 'var(--surface)',
              padding: isMobile ? '6px 10px' : '6px 12px',
              fontSize: isMobile ? '11px' : '14px'
            }}
          >
            <div
              className="rounded-full"
              style={{ 
                backgroundColor: 'var(--success)',
                width: '8px',
                height: '8px'
              }}
            ></div>
            {verifiedEnsName ? (
              <div className="flex items-center gap-1">
                <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                  {verifiedEnsName}
                </span>
                <span style={{ color: 'var(--success)', fontSize: '12px' }}>
                  ✓
                </span>
              </div>
            ) : (
              <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="rounded font-semibold transition-colors"
            style={{
              height: '44px',
              padding: isMobile ? '0 12px' : '0 16px',
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: isMobile ? '13px' : '14px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent)';
            }}
          >
            Connect
          </button>
        )}
      </div>
    </nav>
  );
}
