'use client';

import { useState } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { toChecksumAddress } from '@/lib/wallet/wallet-auth';
import { ModalShell } from './ModalShell';

interface WalletConnectProps {
  onConnected: () => void;
  onDismiss?: () => void;
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M3 10.5V3.5C3 2.67157 3.67157 2 4.5 2H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 8.5L6 11.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export function WalletConnect({ onConnected, onDismiss }: WalletConnectProps) {
  const metamask = useMetaMask();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleCopyAddress = async () => {
    if (!metamask.address) return;
    await navigator.clipboard.writeText(toChecksumAddress(metamask.address));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDismiss = () => {
    if (metamask.isConnecting) return;
    onDismiss?.();
  };

  const finishConnect = async () => {
    setError('');
    if (metamask.isConnected) {
      onConnected();
      return;
    }
    const ok = await metamask.connect();
    if (ok) {
      onConnected();
      return;
    }
    setError(metamask.error || 'Failed to connect wallet');
  };

  if (!metamask.isInstalled) {
    return (
      <ModalShell isOpen={true} allowOverlayClose={true} onClose={() => onDismiss?.()} mobileBottomSheet={true}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          backgroundColor: 'var(--accent-primary)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0'
        }} />
        <button
          onClick={() => onDismiss?.()}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '44px',
            height: '44px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)'
          }}
          aria-label="Close"
        >
          <CloseIcon />
        </button>
        <div style={{ padding: '24px 24px 0' }}>
          <h2 style={{ fontSize: '22px', lineHeight: '28px', fontWeight: 700, marginBottom: '8px' }}>
            MetaMask Required
          </h2>
          <p style={{ fontSize: '14px', lineHeight: '20px', color: 'rgba(255, 255, 255, 0.64)' }}>
            Install MetaMask to connect
          </p>
        </div>
        <div style={{ padding: '24px' }}>
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              textAlign: 'center',
              lineHeight: '48px',
              textDecoration: 'none',
            }}
          >
            Install MetaMask
          </a>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell isOpen={true} allowOverlayClose={!metamask.isConnecting} onClose={handleDismiss} mobileBottomSheet={true}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        backgroundColor: 'var(--accent-primary)',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0'
      }} />

      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '8px',
          backgroundColor: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
        aria-label="Close"
      >
        <CloseIcon />
      </button>

      <div style={{ padding: '24px 24px 0' }}>
        <h2 style={{ fontSize: '22px', lineHeight: '28px', fontWeight: 700, marginBottom: '8px' }}>
          Connect wallet
        </h2>
        <p style={{ fontSize: '14px', lineHeight: '20px', color: 'rgba(255, 255, 255, 0.64)' }}>
          MetaMask on Sepolia. No extra signature.
        </p>
      </div>

      <div style={{ padding: '20px 24px 0' }}>
        {error && (
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'rgba(235, 4, 0, 0.1)',
            border: '1px solid rgba(235, 4, 0, 0.3)',
            color: '#EB0400',
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {metamask.isConnected && metamask.address && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 12px',
            backgroundColor: 'var(--bg-elevated)',
            borderRadius: '12px',
            marginBottom: '20px'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--success)' }}>Connected</span>
            <div style={{
              flex: 1,
              fontSize: '13px',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'rgba(255, 255, 255, 0.72)',
            }}>
              {toChecksumAddress(metamask.address).slice(0, 6)}...{toChecksumAddress(metamask.address).slice(-4)}
            </div>
            <button
              onClick={handleCopyAddress}
              style={{
                width: '32px',
                height: '32px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: copied ? 'rgba(61, 220, 151, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                color: copied ? 'var(--success)' : 'rgba(255, 255, 255, 0.56)',
                cursor: 'pointer',
              }}
              title={copied ? 'Copied!' : 'Copy address'}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '8px 24px 24px' }}>
        <button
          onClick={() => void finishConnect()}
          disabled={metamask.isConnecting}
          style={{
            width: '100%',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: 'var(--accent-primary)',
            border: 'none',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: metamask.isConnecting ? 'not-allowed' : 'pointer',
            opacity: metamask.isConnecting ? 0.6 : 1,
          }}
        >
          {metamask.isConnecting
            ? 'Connecting…'
            : metamask.isConnected
              ? 'Continue'
              : 'Connect Wallet'}
        </button>
      </div>
    </ModalShell>
  );
}
