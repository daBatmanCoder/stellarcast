'use client';

import { useEffect, useState } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { ensureSepoliaNetwork } from '@/lib/wallet/metamask';
import { SEPOLIA_CHAIN_ID } from '@/lib/blockchain/contracts';

interface NetworkGuardProps {
  children: React.ReactNode;
}

export function NetworkGuard({ children }: NetworkGuardProps) {
  const metamask = useMetaMask();
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string>('');

  const isCorrectNetwork = metamask.chainId === '0xaa36a7'; // Sepolia

  useEffect(() => {
    // Auto-switch to Sepolia when wallet connects
    if (metamask.isConnected && !isCorrectNetwork && !isSwitching) {
      handleSwitchNetwork();
    }
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

  // Show network guard if connected but wrong network
  if (metamask.isConnected && !isCorrectNetwork) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] animate-fade-in">
          <div className="card p-8 space-y-6">
            <div className="text-center space-y-3">
              <div style={{ fontSize: '3rem' }}>⚠️</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
                Wrong Network
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                This app requires Sepolia testnet
              </p>
            </div>

            <div className="card p-4 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span style={{ color: 'var(--text-tertiary)' }}>Current</span>
                <span style={{ color: 'var(--warn)' }}>{metamask.networkName}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span style={{ color: 'var(--text-tertiary)' }}>Required</span>
                <span style={{ color: 'var(--success)' }}>Sepolia</span>
              </div>
            </div>

            {switchError && (
              <div className="card p-4" style={{ borderColor: 'var(--warn)' }}>
                <p style={{ color: 'var(--warn)', fontSize: '13px' }}>
                  {switchError}
                </p>
              </div>
            )}

            <button
              onClick={handleSwitchNetwork}
              disabled={isSwitching}
              className="btn btn-primary w-full"
            >
              {isSwitching ? 'Switching...' : 'Switch to Sepolia'}
            </button>

            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
              Need test ETH? <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>sepoliafaucet.com</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
