'use client';

import { useEffect, useState } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { ensureSepoliaNetwork } from '@/lib/wallet/metamask';
import { Button } from './ui/Button';
import { IconWarning } from './ui/Icons';

interface NetworkGuardProps {
  children: React.ReactNode;
}

export function NetworkGuard({ children }: NetworkGuardProps) {
  const metamask = useMetaMask();
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string>('');

  const isCorrectNetwork = metamask.chainId === '0xaa36a7'; // Sepolia

  useEffect(() => {
    if (metamask.isConnected && !isCorrectNetwork && !isSwitching) {
      handleSwitchNetwork();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metamask.isConnected, isCorrectNetwork]);

  const handleSwitchNetwork = async () => {
    setIsSwitching(true);
    setSwitchError('');

    try {
      await ensureSepoliaNetwork();
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Failed to switch network');
    } finally {
      setIsSwitching(false);
    }
  };

  if (metamask.isConnected && !isCorrectNetwork) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--bg-body)',
        }}
      >
        <div className="surface" style={{ width: '100%', maxWidth: 400, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--warn)' }}>
            <IconWarning size={20} />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Wrong network</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
            This app requires Sepolia testnet.
          </p>

          <div
            style={{
              padding: 12,
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)',
              marginBottom: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Current</span>
              <span style={{ color: 'var(--warn)' }}>{metamask.networkName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Required</span>
              <span style={{ color: 'var(--success)' }}>Sepolia</span>
            </div>
          </div>

          {switchError && (
            <p style={{ color: 'var(--warn)', fontSize: 13, marginBottom: 12 }}>{switchError}</p>
          )}

          <Button variant="primary" fullWidth onClick={handleSwitchNetwork} disabled={isSwitching}>
            {isSwitching ? 'Switching…' : 'Switch to Sepolia'}
          </Button>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
            Need test ETH?{' '}
            <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>
              sepoliafaucet.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
