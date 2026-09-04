'use client';

import { useState } from 'react';
import { ModalShell } from './ModalShell';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { IconCheck, IconClose, IconCopy } from './ui/Icons';
import type { ReceivingStatus } from '@/lib/stealth/receiving';

interface ViewStealthAddressModalProps {
  isOpen: boolean;
  metaAddress: string;
  walletAddress: string;
  receivingStatus: ReceivingStatus;
  onClose: () => void;
  onSetupReceiving?: () => void;
}

export function ViewStealthAddressModal({
  isOpen,
  metaAddress,
  walletAddress,
  receivingStatus,
  onClose,
  onSetupReceiving,
}: ViewStealthAddressModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!metaAddress) return;
    await navigator.clipboard.writeText(metaAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusLabel =
    receivingStatus === 'ready'
      ? 'Registered for receiving'
      : receivingStatus === 'needs-setup'
        ? 'Local keys only — not registered yet'
        : receivingStatus === 'keys-mismatch'
          ? 'Local keys do not match on-chain registration'
          : receivingStatus === 'checking'
            ? 'Checking registration…'
            : 'Not ready';

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} allowOverlayClose mobileBottomSheet>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          backgroundColor: 'var(--accent-primary)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        }}
      />

      <IconButton
        label="Close"
        onClick={onClose}
        style={{ position: 'absolute', top: 8, right: 8 }}
      >
        <IconClose size={18} />
      </IconButton>

      <div style={{ padding: '24px 24px 0' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Stealth address</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
          This is your stealth meta-address. Viewers derive one-time payment addresses from it — it is not a normal wallet address.
        </p>
      </div>

      <div style={{ padding: '16px 24px 24px' }}>
        <div
          style={{
            padding: 12,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px' }}>Wallet</p>
          <p className="mono" style={{ fontSize: 12, margin: 0, wordBreak: 'break-all' }}>
            {walletAddress || '—'}
          </p>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-body)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Meta-address</p>
            <IconButton
              label={copied ? 'Copied' : 'Copy meta-address'}
              onClick={handleCopy}
              disabled={!metaAddress}
              size={28}
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </IconButton>
          </div>
          <p
            className="mono"
            style={{
              fontSize: 12,
              margin: 0,
              wordBreak: 'break-all',
              lineHeight: 1.45,
              color: metaAddress ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {metaAddress || 'Connect and sign in to generate local stealth keys.'}
          </p>
        </div>

        <p
          style={{
            fontSize: 12,
            color:
              receivingStatus === 'ready'
                ? 'var(--success)'
                : receivingStatus === 'keys-mismatch' || receivingStatus === 'needs-setup'
                  ? 'var(--warn)'
                  : 'var(--text-muted)',
            margin: '0 0 16px',
          }}
        >
          {statusLabel}
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          {(receivingStatus === 'needs-setup' || receivingStatus === 'keys-mismatch') && onSetupReceiving && (
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                onClose();
                onSetupReceiving();
              }}
            >
              Set up receiving
            </Button>
          )}
          <Button variant="secondary" fullWidth onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
