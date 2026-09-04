'use client';

import { useState } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { toChecksumAddress, authenticateWithWallet, reauthenticateWithWallet } from '@/lib/wallet/wallet-auth';
import { generateStealthIdentity, identityToMetaAddress, encodeMetaAddress } from '@/lib/crypto/identity';
import { storeIdentity, loadIdentity, getAuthInfo, clearIdentity } from '@/lib/storage/identity-store';
import type { StealthIdentity } from '@/lib/types/stealth';

interface WalletConnectProps {
  onIdentityReady: (identity: StealthIdentity, metaAddress: string, ensName?: string) => void;
}

export function WalletConnect({ onIdentityReady }: WalletConnectProps) {
  const metamask = useMetaMask();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string>('');

  const handleConnect = async () => {
    const success = await metamask.connect();
    if (!success || !metamask.address) return;

    setIsAuthenticating(true);
    setAuthError('');
    setWarningMessage('');

    try {
      const checksummedAddress = toChecksumAddress(metamask.address);
      
      // Check if identity already exists for this wallet
      const authInfo = await getAuthInfo();
      
      if (authInfo && authInfo.walletAddress.toLowerCase() === metamask.address.toLowerCase()) {
        // Re-authenticate with existing identity
        try {
          const encryptionKey = await reauthenticateWithWallet(
            checksummedAddress,
            authInfo.authNonce,
            authInfo.authTimestamp
          );
          
          const userIdentity = await loadIdentity(metamask.address, encryptionKey);
          
          if (!userIdentity) {
            throw new Error('DECRYPT_FAILED');
          }
          
          const meta = identityToMetaAddress(userIdentity);
          const metaAddress = encodeMetaAddress(meta);
          onIdentityReady(userIdentity, metaAddress);
          return;
        } catch (decryptError) {
          console.warn('Failed to decrypt stored identity, creating new one');
          await clearIdentity(metamask.address);
          setWarningMessage('Previous identity couldn\'t be unlocked — created a new one.');
        }
      }
      
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
    } catch (error) {
      if (error instanceof Error && error.message === 'DECRYPT_FAILED') {
        setAuthError('Failed to unlock previous identity');
      } else {
        setAuthError(error instanceof Error ? error.message : 'Authentication failed');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (!metamask.isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--base)' }}>
        <div className="w-full max-w-md animate-fade-in">
          <div
            className="rounded-xl p-8 space-y-6"
            style={{
              backgroundColor: 'var(--elevated)',
              border: '1px solid var(--border)'
            }}
          >
            <div className="text-center space-y-3">
              <div
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center font-bold text-white text-2xl"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                S
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                MetaMask Required
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Install MetaMask to access private streaming
              </p>
            </div>
            <a 
              href="https://metamask.io/download/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block w-full py-3 rounded-lg text-center font-semibold transition-colors"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'white'
              }}
            >
              Install MetaMask
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--base)' }}>
      <div className="w-full max-w-md animate-fade-in">
        <div
          className="rounded-xl p-8 space-y-6"
          style={{
            backgroundColor: 'var(--elevated)',
            border: '1px solid var(--border)'
          }}
        >
          {/* Header */}
          <div className="text-center space-y-3">
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center font-bold text-white text-2xl"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              S
            </div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Welcome to Stellarcast
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Connect your wallet to access private streaming
            </p>
          </div>

          {/* Messages */}
          {warningMessage && (
            <div
              className="p-4 rounded-lg text-sm"
              style={{
                backgroundColor: 'rgba(255, 185, 0, 0.1)',
                border: '1px solid var(--warn)',
                color: 'var(--warn)'
              }}
            >
              {warningMessage}
            </div>
          )}

          {authError && (
            <div
              className="p-4 rounded-lg text-sm"
              style={{
                backgroundColor: 'rgba(235, 4, 0, 0.1)',
                border: '1px solid var(--live)',
                color: 'var(--live)'
              }}
            >
              {authError}
            </div>
          )}

          {/* Connected state */}
          {metamask.isConnected && !isAuthenticating ? (
            <div className="space-y-4">
              <div
                className="p-4 rounded-lg"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)'
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: 'var(--success)' }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--success)' }}>
                      Connected
                    </p>
                    <p className="mono text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {toChecksumAddress(metamask.address!)}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConnect}
                className="w-full py-3 rounded-lg font-semibold transition-colors"
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
                Sign to Continue
              </button>

              <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                Sign a message to create your private identity. This does not grant access to your funds.
              </p>
            </div>
          ) : isAuthenticating ? (
            <div className="flex flex-col items-center py-12 space-y-4">
              <div
                className="w-12 h-12 rounded-full"
                style={{
                  border: '3px solid var(--surface)',
                  borderTopColor: 'var(--accent)',
                  animation: 'spin 1s linear infinite'
                }}
              ></div>
              <p style={{ color: 'var(--text-secondary)' }}>
                Check MetaMask...
              </p>
            </div>
          ) : (
            <button
              onClick={metamask.connect}
              disabled={!metamask.isInstalled || metamask.isConnecting}
              className="w-full py-3 rounded-lg font-semibold transition-colors"
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
              {metamask.isConnecting ? 'Connecting...' : 'Connect Wallet'}
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
