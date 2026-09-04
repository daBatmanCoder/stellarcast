'use client';

import { useState, useEffect } from 'react';
import { ModalShell } from './ModalShell';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { IconClose } from './ui/Icons';
import type { StealthIdentity } from '@/lib/types/stealth';
import {
  registerReceivingMetaAddress,
  type ReceivingStatus,
} from '@/lib/stealth/receiving';
import { getProtocolAdapter } from '@/lib/protocol/adapters';

interface StealthSetupModalProps {
  isOpen: boolean;
  walletAddress: string;
  identity: StealthIdentity | null;
  metaAddress: string;
  ensName?: string;
  initialStatus?: ReceivingStatus;
  statusMessage?: string;
  onClose: () => void;
  onRegistered: (metaAddress: string, slot?: number) => void;
}

type Phase = 'explain' | 'import' | 'registering' | 'success' | 'error';

export function StealthSetupModal({
  isOpen,
  walletAddress,
  identity,
  metaAddress,
  ensName,
  initialStatus = 'needs-setup',
  statusMessage,
  onClose,
  onRegistered,
}: StealthSetupModalProps) {
  const [phase, setPhase] = useState<Phase>('explain');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [importError, setImportError] = useState('');
  const adapterMode = getProtocolAdapter().mode;

  useEffect(() => {
    if (!isOpen) return;
    setPhase('explain');
    setError('');
    setImportError('');
    setTxHash('');
  }, [isOpen, initialStatus]);

  const handleRegister = async () => {
    if (!identity || !walletAddress) {
      setError('Connect your wallet and unlock a stealth identity first.');
      setPhase('error');
      return;
    }

    setPhase('registering');
    setError('');

    try {
      const result = await registerReceivingMetaAddress(walletAddress, identity, { ensName });
      setTxHash(result.txHash);
      setPhase('success');
      onRegistered(result.metaEncoded, result.slot);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('denied')) {
        setError('Transaction cancelled');
      } else {
        setError(msg);
      }
      setPhase('error');
    }
  };

  const handleImportKeys = () => {
    setPhase('import');
    setImportError('');
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError('');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      if (!data.spendingPrivateKey || !data.viewingPrivateKey) {
        throw new Error('Invalid recipient.json format - missing private keys');
      }

      // Import the identity
      const { storeIdentity } = await import('@/lib/storage/identity-store');

      // Parse keys from hex
      const spendingPrivateKey = new Uint8Array(Buffer.from(data.spendingPrivateKey.replace('0x', ''), 'hex'));
      const viewingPrivateKey = new Uint8Array(Buffer.from(data.viewingPrivateKey.replace('0x', ''), 'hex'));
      
      // Derive public keys
      const { secp256k1 } = await import('@noble/curves/secp256k1.js');
      const spendingPublicKey = secp256k1.getPublicKey(spendingPrivateKey, true);
      const viewingPublicKey = secp256k1.getPublicKey(viewingPrivateKey, true);

      const importedIdentity: StealthIdentity = {
        spendingPrivateKey,
        viewingPrivateKey,
        spendingPublicKey,
        viewingPublicKey,
      };

      // Get encryption key from wallet
      const { authenticateWithWallet } = await import('@/lib/wallet/wallet-auth');
      const { encryptionKey, nonce: authNonce } = await authenticateWithWallet(walletAddress);
      
      // Store the imported identity
      const authTimestamp = new Date().toISOString();
      await storeIdentity(importedIdentity, walletAddress, encryptionKey, authNonce, authTimestamp);

      // Encode meta-address
      const { encodeStealthMetaAddressForENS } = await import('@/lib/blockchain/contracts');
      const metaEncoded = encodeStealthMetaAddressForENS({
        spendingPublicKey,
        viewingPublicKey,
        scheme: 1,
      });

      setPhase('success');
      onRegistered(metaEncoded);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to import keys';
      setImportError(msg);
    }
  };

  const title =
    phase === 'success'
      ? 'Receiving ready'
      : phase === 'import'
        ? 'Import private keys'
        : initialStatus === 'keys-mismatch'
          ? 'Update stealth receiving'
          : 'Create stealth address';

  return (
    <ModalShell isOpen={isOpen} onClose={phase === 'registering' ? undefined : onClose} allowOverlayClose={phase !== 'registering'} mobileBottomSheet>
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

      {phase !== 'registering' && (
        <IconButton
          label="Close"
          onClick={onClose}
          style={{ position: 'absolute', top: 8, right: 8 }}
        >
          <IconClose size={18} />
        </IconButton>
      )}

      <div style={{ padding: '24px 24px 0' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>{title}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
          {phase === 'success'
            ? 'Viewers can now pay a one-time stealth address derived from your registered meta-address.'
            : 'To accept private stream payments, register a stealth meta-address for this wallet.'}
        </p>
      </div>

      <div style={{ padding: '16px 24px 24px' }}>
        {(phase === 'explain' || phase === 'error') && (
          <>
            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                marginBottom: 12,
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}
            >
              {statusMessage ||
                (initialStatus === 'keys-mismatch'
                  ? 'On-chain keys exist but do not match this browser. Registering will publish this device’s meta-address.'
                  : 'We’ll use your local stealth keys and publish the public meta-address to the ERC-6538 registry on Sepolia.')}
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
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px' }}>Local meta-address</p>
              <p
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--text-primary)',
                  margin: 0,
                  wordBreak: 'break-all',
                  lineHeight: 1.4,
                }}
              >
                {metaAddress || 'Generate keys by connecting your wallet first'}
              </p>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(145, 71, 255, 0.08)',
                border: '1px solid rgba(145, 71, 255, 0.2)',
                marginBottom: 16,
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>What happens</strong>
              <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                <li>Confirm a registry transaction in MetaMask</li>
                <li>Your public spend/view keys are stored on-chain</li>
                <li>Viewers generate one-time stealth payment addresses from them</li>
              </ol>
              {adapterMode === 'mock' && (
                <p style={{ margin: '8px 0 0', color: 'var(--warn)' }}>
                  Demo mode: registration is simulated locally (no on-chain tx).
                </p>
              )}
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--live)', margin: '0 0 12px' }}>{error}</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {initialStatus === 'keys-mismatch' && (
                <Button variant="primary" fullWidth onClick={handleImportKeys}>
                  Import matching keys
                </Button>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" fullWidth onClick={onClose}>
                  Not now
                </Button>
                <Button variant={initialStatus === 'keys-mismatch' ? 'secondary' : 'primary'} fullWidth onClick={handleRegister} disabled={!identity || !walletAddress}>
                  {initialStatus === 'keys-mismatch' ? 'Register new keys' : 'Create & register'}
                </Button>
              </div>
            </div>
          </>
        )}

        {phase === 'import' && (
          <>
            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 185, 0, 0.08)',
                border: '1px solid rgba(255, 185, 0, 0.24)',
                marginBottom: 16,
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
              }}
            >
              <strong style={{ color: '#FFB900' }}>⚠️ Security notice</strong>
              <p style={{ margin: '8px 0 0' }}>
                Only import keys from your own secure backup (recipient.json). Never paste keys from untrusted sources.
              </p>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                marginBottom: 16,
              }}
            >
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                Upload your recipient.json file containing private keys:
              </p>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileImport}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-body)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
                Expected format: JSON with spendingPrivateKey and viewingPrivateKey fields
              </p>
            </div>

            {importError && (
              <p style={{ fontSize: 13, color: 'var(--live)', margin: '0 0 12px' }}>{importError}</p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" fullWidth onClick={() => setPhase('explain')}>
                Back
              </Button>
            </div>
          </>
        )}

        {phase === 'registering' && (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <div
              className="spin"
              style={{
                width: 40,
                height: 40,
                margin: '0 auto 12px',
                borderRadius: '50%',
                border: '2px solid var(--bg-elevated)',
                borderTopColor: 'var(--accent-primary)',
              }}
            />
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
              {adapterMode === 'mock' ? 'Registering…' : 'Confirm in MetaMask…'}
            </p>
          </div>
        )}

        {phase === 'success' && (
          <>
            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 245, 147, 0.1)',
                border: '1px solid rgba(0, 245, 147, 0.3)',
                marginBottom: 16,
                fontSize: 13,
                color: 'var(--success)',
              }}
            >
              Stealth receiving is set up for this wallet.
            </div>
            {txHash && adapterMode === 'live' && (
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', fontSize: 12, color: 'var(--accent-primary)', marginBottom: 16 }}
              >
                View transaction →
              </a>
            )}
            <Button variant="primary" fullWidth onClick={onClose}>
              Done
            </Button>
          </>
        )}
      </div>
    </ModalShell>
  );
}
