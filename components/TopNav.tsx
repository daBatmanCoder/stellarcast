'use client';

import { useState } from 'react';

interface TopNavProps {
  isConnected: boolean;
  address?: string;
  verifiedEnsName?: string;
  onConnect: () => void;
}

export function TopNav({ isConnected, address, verifiedEnsName, onConnect }: TopNavProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center px-4 gap-6"
      style={{
        height: '48px',
        backgroundColor: 'var(--elevated)',
        borderBottom: '1px solid var(--border)'
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded flex items-center justify-center font-bold text-white text-sm"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          S
        </div>
        <span className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
          Stellarcast
        </span>
      </div>

      {/* Browse */}
      <button
        className="px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface)] rounded transition-colors"
        style={{ color: 'var(--text-primary)' }}
      >
        Browse
      </button>

      {/* Search (centered) */}
      <div className="flex-1 max-w-md mx-auto">
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
      <div className="flex items-center gap-3">
        {isConnected && address ? (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded"
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
            className="px-4 py-1.5 rounded text-sm font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'white'
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
