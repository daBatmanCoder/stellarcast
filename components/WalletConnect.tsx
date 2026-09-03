'use client';

import { useState } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { toChecksumAddress, authenticateWithWallet, reauthenticateWithWallet } from '@/lib/wallet/wallet-auth';
import { generateStealthIdentity, identityToMetaAddress, encodeMetaAddress } from '@/lib/crypto/identity';
import { storeIdentity, loadIdentity, hasIdentity, getAuthInfo } from '@/lib/storage/identity-store';
import type { StealthIdentity } from '@/lib/types/stealth';

interface WalletConnectProps {
  onIdentityReady: (identity: StealthIdentity, metaAddress: string) => void;
}

export function WalletConnect({ onIdentityReady }: WalletConnectProps) {
  const metamask = useMetaMask();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string>('');

  const handleConnect = async () => {
    const success = await metamask.connect();
    if (!success || !metamask.address) return;

    setIsAuthenticating(true);
    setAuthError('');

    try {
      const checksummedAddress = toChecksumAddress(metamask.address);
      
      // Check if identity already exists for this wallet
      const authInfo = await getAuthInfo();
      
      if (authInfo && authInfo.walletAddress.toLowerCase() === metamask.address.toLowerCase()) {
        // Re-authenticate with existing identity
        const encryptionKey = await reauthenticateWithWallet(
          checksummedAddress,
          authInfo.authNonce,
          authInfo.authTimestamp
        );
        
        const userIdentity = await loadIdentity(metamask.address, encryptionKey);
        if (!userIdentity) {
          throw new Error('Failed to decrypt identity');
        }
        
        const meta = identityToMetaAddress(userIdentity);
        const metaAddress = encodeMetaAddress(meta);
        onIdentityReady(userIdentity, metaAddress);
      } else {
        // Create new identity bound to this wallet
        const { encryptionKey, nonce } = await authenticateWithWallet(checksummedAddress);
        
        const userIdentity = generateStealthIdentity();
        await storeIdentity(
          userIdentity,
          metamask.address,
          encryptionKey,
          nonce,
          new Date().toISOString()
        );
        
        const meta = identityToMetaAddress(userIdentity);
        const metaAddress = encodeMetaAddress(meta);
        onIdentityReady(userIdentity, metaAddress);
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] animate-fade-in">
        <div className="card p-8 space-y-6">
          <div className="text-center space-y-3">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Connect Wallet
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Connect MetaMask to create your stealth identity
            </p>
          </div>

          {!metamask.isInstalled && (
            <div className="card p-4 space-y-3" style={{ borderColor: 'var(--warn)' }}>
              <p style={{ color: 'var(--warn)', fontWeight: 600, fontSize: '14px' }}>
                MetaMask Not Detected
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                Please install MetaMask to continue
              </p>
              <a 
                href="https://metamask.io/download/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-primary w-full"
              >
                Install MetaMask
              </a>
            </div>
          )}

          {(metamask.error || authError) && (
            <div className="card p-4" style={{ borderColor: 'var(--warn)' }}>
              <p style={{ color: 'var(--warn)', fontSize: '13px' }}>
                {authError || metamask.error}
              </p>
            </div>
          )}

          {metamask.isConnected && !isAuthenticating ? (
            <div className="space-y-4">
              <div className="card p-4" style={{ borderColor: 'var(--success)' }}>
                <div className="flex items-center gap-3">
                  <div className="status-dot" style={{ backgroundColor: 'var(--success)' }}></div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}>
                      Connected
                    </p>
                    <p className="mono truncate" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {toChecksumAddress(metamask.address!)}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConnect}
                className="btn btn-primary w-full"
              >
                Sign to Continue
              </button>

              <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', lineHeight: '1.5' }}>
                Sign a message to encrypt your stealth keys locally. This does not grant access to your funds.
              </p>
            </div>
          ) : isAuthenticating ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-10 h-10 rounded-full" style={{
                border: '3px solid var(--surface)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 1s linear infinite'
              }}></div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Check MetaMask...
              </p>
            </div>
          ) : (
            <button
              onClick={metamask.connect}
              disabled={!metamask.isInstalled || metamask.isConnecting}
              className="btn btn-primary w-full"
            >
              {metamask.isConnecting ? 'Connecting...' : 'Connect MetaMask'}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
