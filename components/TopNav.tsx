'use client';

import { useState } from 'react';

interface TopNavProps {
  isConnected: boolean;
  address?: string;
  verifiedEnsName?: string;
  onConnect: () => void;
  onMenuToggle?: () => void;
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export function TopNav({ isConnected, address, verifiedEnsName, onConnect, onMenuToggle }: TopNavProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center px-4 gap-3 topnav-mobile"
      style={{
        height: '48px',
        backgroundColor: 'var(--elevated)',
        borderBottom: '1px solid var(--border)'
      }}
    >
      {/* Hamburger menu - mobile only */}
      <button
        onClick={onMenuToggle}
        className="hamburger-btn flex items-center justify-center"
        style={{
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
          className="w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm logo-desktop"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          S
        </div>
        <span className="font-bold text-base topnav-title" style={{ color: 'var(--text-primary)' }}>
          STELLARCAST
        </span>
      </div>

      {/* Browse - desktop only */}
      <button
        className="browse-btn px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface)] rounded transition-colors"
        style={{ color: 'var(--text-primary)' }}
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
        {isConnected && address ? (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded address-badge"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--success)' }}
            ></div>
            {verifiedEnsName ? (
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                  {verifiedEnsName}
                </span>
                <span className="text-xs" style={{ color: 'var(--success)' }}>
                  ✓
                </span>
              </div>
            ) : (
              <span className="mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={onConnect}
            className="connect-btn rounded text-sm font-semibold transition-colors"
            style={{
              height: '44px',
              padding: '0 16px',
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              cursor: 'pointer'
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

      <style jsx>{`
        @media (max-width: 768px) {
          .hamburger-btn {
            display: flex !important;
          }
          .browse-btn {
            display: none;
          }
          .search-container {
            max-width: none;
          }
          .logo-desktop {
            width: 32px;
            height: 32px;
            font-size: 12px;
          }
          .topnav-title {
            font-size: 14px;
          }
          .address-badge {
            font-size: 11px;
            padding: 6px 10px;
          }
        }
        @media (min-width: 769px) {
          .hamburger-btn {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
}
