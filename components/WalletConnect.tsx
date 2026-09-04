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
  const [showCopied, setShowCopied] = useState(false);

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

  const handleDisconnect = () => {
    metamask.disconnect();
  };

  const handleCopyAddress = async () => {
    if (metamask.address) {
      await navigator.clipboard.writeText(toChecksumAddress(metamask.address));
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  // Common modal wrapper
  const ModalWrapper = ({ children }: { children: React.ReactNode }) => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div
        className="w-full animate-fade-in"
        style={{
          maxWidth: '440px'
        }}
      >
        <div
          className="rounded-2xl p-8 space-y-6"
          style={{
            backgroundColor: 'var(--elevated)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );

  // MetaMask not installed
  if (!metamask.isInstalled) {
    return (
      <ModalWrapper>
        <div className="text-center space-y-4">
          <div
            className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center font-bold text-white text-3xl"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            S
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              MetaMask Required
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Install MetaMask to access private streaming
            </p>
          </div>
        </div>

        <a 
          href="https://metamask.io/download/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="block w-full rounded-xl text-center font-semibold transition-all"
          style={{
            padding: '14px 24px',
            backgroundColor: 'var(--accent)',
            color: 'white'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Install MetaMask
        </a>
      </ModalWrapper>
    );
  }

  return (
    <ModalWrapper>
      {/* Header */}
      <div className="text-center space-y-4">
        <div
          className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center font-bold text-white text-3xl"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          S
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Welcome to Stellarcast
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Connect your wallet to access private streaming
          </p>
        </div>
      </div>

      {/* Warning Message */}
      {warningMessage && (
        <div
          className="p-4 rounded-xl text-sm"
          style={{
            backgroundColor: 'rgba(255, 185, 0, 0.08)',
            border: '1px solid rgba(255, 185, 0, 0.2)',
            color: 'var(--warn)'
          }}
        >
          {warningMessage}
        </div>
      )}

      {/* Error Message */}
      {authError && (
        <div
          className="p-4 rounded-xl text-sm"
          style={{
            backgroundColor: 'rgba(235, 4, 0, 0.08)',
            border: '1px solid rgba(235, 4, 0, 0.2)',
            color: 'var(--live)'
          }}
        >
          {authError}
        </div>
      )}

      {/* Connected State */}
      {metamask.isConnected && !isAuthenticating ? (
        <div className="space-y-4">
          {/* Address Display */}
          <div
            className="p-4 rounded-xl"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)'
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: 'var(--success)' }}
                ></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--success)' }}>
                    Connected
                  </p>
                  <p className="mono text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {metamask.address ? 
                      `${metamask.address.slice(0, 6)}...${metamask.address.slice(-4)}` : 
                      ''
                    }
                  </p>
                </div>
              </div>
              
              {/* Copy Button */}
              <button
                onClick={handleCopyAddress}
                className="flex-shrink-0 p-2 rounded-lg hover:bg-[var(--elevated)] transition-colors relative"
                title="Copy address"
              >
                {showCopied ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13 4L6 11L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--success)' }}/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-tertiary)' }}/>
                    <path d="M3 11V3C3 2.44772 3.44772 2 4 2H10" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-tertiary)' }}/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Primary CTA */}
          <button
            onClick={handleConnect}
            className="w-full rounded-xl font-semibold transition-all"
            style={{
              padding: '14px 24px',
              backgroundColor: 'var(--accent)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Sign to Continue
          </button>

          {/* Secondary Action */}
          <button
            onClick={handleDisconnect}
            className="w-full rounded-xl font-medium transition-colors text-sm"
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Disconnect
          </button>

          {/* Disclaimer */}
          <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            Sign a message to create your private identity.<br/>
            This does not grant access to your funds.
          </p>
        </div>
      ) : isAuthenticating ? (
        /* Authenticating State */
        <div className="flex flex-col items-center py-12 space-y-4">
          <div
            className="w-12 h-12 rounded-full"
            style={{
              border: '3px solid var(--surface)',
              borderTopColor: 'var(--accent)',
              animation: 'spin 1s linear infinite'
            }}
          ></div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Check MetaMask...
          </p>
        </div>
      ) : (
        /* Connect Button */
        <button
          onClick={metamask.connect}
          disabled={!metamask.isInstalled || metamask.isConnecting}
          className="w-full rounded-xl font-semibold transition-all disabled:opacity-50"
          style={{
            padding: '14px 24px',
            backgroundColor: 'var(--accent)',
            color: 'white'
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {metamask.isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </ModalWrapper>
  );
}
