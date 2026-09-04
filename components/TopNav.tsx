'use client';

import { useEffect, useRef, useState } from 'react';
import { SearchBar } from './ui/SearchBar';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { IconBrowse, IconInbox, IconLive, IconMenu } from './ui/Icons';
import { truncateAddress } from '@/lib/utils/asset';
import type { ReceivingStatus } from '@/lib/stealth/receiving';

interface TopNavProps {
  isConnected: boolean;
  address?: string;
  verifiedEnsName?: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  unreadCount?: number;
  receivingStatus?: ReceivingStatus;
  isSwitchingAccount?: boolean;
  onConnect: () => void;
  onMenuToggle?: () => void;
  onGoLive?: () => void;
  onInboxToggle?: () => void;
  onBrowse?: () => void;
  onSetupReceiving?: () => void;
  onViewStealthAddress?: () => void;
  onSwitchAccount?: () => void;
  onDisconnect?: () => void;
}

export function TopNav({
  isConnected,
  address,
  verifiedEnsName,
  searchQuery,
  onSearchChange,
  unreadCount = 0,
  receivingStatus = 'idle',
  isSwitchingAccount = false,
  onConnect,
  onMenuToggle,
  onGoLive,
  onInboxToggle,
  onBrowse,
  onSetupReceiving,
  onViewStealthAddress,
  onSwitchAccount,
  onDisconnect,
}: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const needsReceivingSetup =
    isConnected && (receivingStatus === 'needs-setup' || receivingStatus === 'keys-mismatch');
  const receivingReady = isConnected && receivingStatus === 'ready';

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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

        {isConnected && needsReceivingSetup && onSetupReceiving && (
          <Button variant="secondary" size="sm" onClick={onSetupReceiving} className="nav-desktop-only">
            Set up receiving
          </Button>
        )}

        {isConnected && onGoLive && (
          <Button variant="live" size="sm" onClick={onGoLive} className="nav-go-live">
            <IconLive size={14} />
            <span className="nav-desktop-only">Go Live</span>
          </Button>
        )}

        {isConnected && address ? (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              title="Account menu"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 32,
                padding: '0 10px',
                borderRadius: 'var(--radius-md)',
                background: menuOpen ? 'var(--bg-surface-hover)' : 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                maxWidth: 200,
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              <span
                className="status-dot"
                style={{
                  background:
                    receivingReady
                      ? 'var(--success)'
                      : needsReceivingSetup
                        ? 'var(--warn)'
                        : receivingStatus === 'checking'
                          ? 'var(--text-muted)'
                          : 'var(--success)',
                }}
                aria-hidden
              />
              <span className="truncate-1" style={{ fontSize: 13, fontWeight: 600 }}>
                {isSwitchingAccount ? 'Switching…' : verifiedEnsName || truncateAddress(address)}
              </span>
              <span aria-hidden style={{ fontSize: 10, color: 'var(--text-muted)' }}>▾</span>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="popover-menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  minWidth: 220,
                }}
              >
                <div
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--border-subtle)',
                    marginBottom: 4,
                  }}
                >
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Signed in</p>
                  <p className="mono truncate-1" style={{ fontSize: 12, margin: '2px 0 0', fontWeight: 600 }}>
                    {address}
                  </p>
                  {verifiedEnsName && (
                    <p style={{ fontSize: 12, color: 'var(--accent-primary)', margin: '2px 0 0' }}>
                      {verifiedEnsName}
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    {receivingReady
                      ? 'Receiving ready'
                      : needsReceivingSetup
                        ? 'Stealth setup needed'
                        : receivingStatus === 'checking'
                          ? 'Checking registration…'
                          : 'Connected'}
                  </p>
                </div>

                {needsReceivingSetup && onSetupReceiving && (
                  <button
                    type="button"
                    role="menuitem"
                    className="popover-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onSetupReceiving();
                    }}
                  >
                    Set up receiving
                  </button>
                )}

                {onViewStealthAddress && (
                  <button
                    type="button"
                    role="menuitem"
                    className="popover-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onViewStealthAddress();
                    }}
                  >
                    View stealth address
                  </button>
                )}

                {onSwitchAccount && (
                  <button
                    type="button"
                    role="menuitem"
                    className="popover-item"
                    disabled={isSwitchingAccount}
                    onClick={() => {
                      setMenuOpen(false);
                      onSwitchAccount();
                    }}
                  >
                    Switch account
                  </button>
                )}

                {onDisconnect && (
                  <button
                    type="button"
                    role="menuitem"
                    className="popover-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onDisconnect();
                    }}
                    style={{ color: 'var(--live)' }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            )}
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
