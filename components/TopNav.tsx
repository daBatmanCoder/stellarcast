'use client';

import { SearchBar } from './ui/SearchBar';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { IconBrowse, IconInbox, IconLive, IconMenu } from './ui/Icons';
import { truncateAddress } from '@/lib/utils/asset';

interface TopNavProps {
  isConnected: boolean;
  address?: string;
  verifiedEnsName?: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  unreadCount?: number;
  onConnect: () => void;
  onMenuToggle?: () => void;
  onGoLive?: () => void;
  onInboxToggle?: () => void;
  onBrowse?: () => void;
}

export function TopNav({
  isConnected,
  address,
  verifiedEnsName,
  searchQuery,
  onSearchChange,
  unreadCount = 0,
  onConnect,
  onMenuToggle,
  onGoLive,
  onInboxToggle,
  onBrowse,
}: TopNavProps) {
  return (
    <nav
      aria-label="Primary"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 'var(--nav-height)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 0' }}>
        <IconButton
          label="Open menu"
          className="nav-mobile-only"
          onClick={onMenuToggle}
          style={{ display: undefined }}
        >
          <IconMenu size={20} />
        </IconButton>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div
            aria-hidden
            style={{
              width: 30,
              height: 30,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            S
          </div>
          <span
            className="nav-brand-text"
            style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}
          >
            STELLARCAST
          </span>
        </div>

        <button
          type="button"
          className="nav-desktop-only btn btn-ghost"
          onClick={onBrowse}
          style={{ height: 32, padding: '0 10px', fontSize: 14, fontWeight: 600 }}
        >
          <IconBrowse size={16} />
          Browse
        </button>
      </div>

      {/* Center search */}
      <div
        className="nav-search"
        style={{
          flex: '0 1 420px',
          display: 'flex',
          justifyContent: 'center',
          minWidth: 0,
        }}
      >
        <SearchBar value={searchQuery} onChange={onSearchChange} placeholder="Search streams or categories" />
      </div>

      {/* Right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          flex: '1 1 0',
          minWidth: 0,
        }}
      >
        {onInboxToggle && (
          <div style={{ position: 'relative' }}>
            <IconButton label="Inbox" tooltip="Access inbox" onClick={onInboxToggle}>
              <IconInbox size={18} />
            </IconButton>
            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} unread`}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: 'var(--live)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  pointerEvents: 'none',
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
        )}

        {isConnected && onGoLive && (
          <Button variant="live" size="sm" onClick={onGoLive} className="nav-go-live">
            <IconLive size={14} />
            <span className="nav-desktop-only">Go Live</span>
          </Button>
        )}

        {isConnected && address ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 32,
              padding: '0 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              maxWidth: 180,
            }}
          >
            <span className="status-dot" style={{ background: 'var(--success)' }} aria-hidden />
            <span className="truncate-1" style={{ fontSize: 13, fontWeight: 600 }}>
              {verifiedEnsName || truncateAddress(address)}
            </span>
          </div>
        ) : (
          <Button variant="primary" size="sm" onClick={onConnect}>
            Connect
          </Button>
        )}
      </div>

      <style>{`
        .nav-mobile-only { display: none !important; }
        @media (max-width: 1023px) {
          .nav-mobile-only { display: inline-flex !important; }
          .nav-desktop-only { display: none !important; }
          .nav-search { flex: 1 1 auto; max-width: none; }
        }
        @media (max-width: 640px) {
          .nav-brand-text { display: none; }
          .nav-go-live span { display: none; }
        }
      `}</style>
    </nav>
  );
}
