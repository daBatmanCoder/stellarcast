'use client';

import { useState, useEffect } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { toChecksumAddress, authenticateWithWallet, reauthenticateWithWallet } from '@/lib/wallet/wallet-auth';
import { generateStealthIdentity, identityToMetaAddress, encodeMetaAddress } from '@/lib/crypto/identity';
import { storeIdentity, loadIdentity, hasIdentity, getAuthInfo, clearIdentity } from '@/lib/storage/identity-store';
import { ensCache, forwardResolveENSWithNetwork, type ENSResult } from '@/lib/ens/resolver';
import type { StealthIdentity } from '@/lib/types/stealth';

interface WalletConnectProps {
  onIdentityReady: (identity: StealthIdentity, metaAddress: string) => void;
}

export function WalletConnect({ onIdentityReady }: WalletConnectProps) {
  const metamask = useMetaMask();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string>('');
  const [ensResult, setEnsResult] = useState<ENSResult | null>(null);
  const [isResolvingENS, setIsResolvingENS] = useState(false);
  const [ensLookup, setEnsLookup] = useState<string>('');
  const [lookupResult, setLookupResult] = useState<string>('');

  // Resolve ENS name when wallet connects
  useEffect(() => {
    const resolveENS = async () => {
      if (metamask.isConnected && metamask.address) {
        setIsResolvingENS(true);
        const result = await ensCache.resolve(metamask.address);
        setEnsResult(result);
        setIsResolvingENS(false);
      } else {
        setEnsResult(null);
      }
    };

    resolveENS();
  }, [metamask.isConnected, metamask.address]);

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
            // Decrypt failed - clear stale identity and create fresh one
            throw new Error('DECRYPT_FAILED');
          }
          
          const meta = identityToMetaAddress(userIdentity);
          const metaAddress = encodeMetaAddress(meta);
          onIdentityReady(userIdentity, metaAddress);
          return;
        } catch (decryptError) {
          // Handle decrypt failure by creating fresh identity
          console.warn('Failed to decrypt stored identity, creating new one');
          await clearIdentity(metamask.address);
          setWarningMessage('Previous local identity couldn\'t be unlocked — created a new one.');
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
      if (error instanceof Error && error.message !== 'DECRYPT_FAILED') {
        setAuthError(error.message);
      } else if (error instanceof Error && error.message === 'DECRYPT_FAILED') {
        setAuthError('Failed to unlock previous identity');
      } else {
        setAuthError('Authentication failed');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleResetIdentity = async () => {
    if (!metamask.address) return;
    
    await clearIdentity(metamask.address);
    setAuthError('');
    setWarningMessage('Local identity cleared. Sign to create a new one.');
  };

  const handleLookupENS = async () => {
    if (!ensLookup.trim()) return;
    
    setLookupResult('Resolving...');
    try {
      const result = await forwardResolveENSWithNetwork(ensLookup.trim(), metamask.address);
      if (result) {
        const matches = result.address.toLowerCase() === metamask.address?.toLowerCase();
        const networkLabel = result.network === 'sepolia' ? 'Sepolia' : 'mainnet';
        setLookupResult(
          matches 
            ? `✓ ${ensLookup} resolves to your address (${networkLabel})` 
            : `${ensLookup} resolves to ${result.address.slice(0, 10)}... on ${networkLabel} (not your address)`
        );
      } else {
        setLookupResult(`${ensLookup} not found on Sepolia or mainnet`);
      }
    } catch (error) {
      setLookupResult('Resolution failed');
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

          {warningMessage && (
            <div className="card p-4" style={{ borderColor: 'var(--warn)' }}>
              <p style={{ color: 'var(--warn)', fontSize: '13px' }}>
                {warningMessage}
              </p>
            </div>
          )}

          {(metamask.error || authError) && (
            <div className="card p-4 space-y-3" style={{ borderColor: 'var(--warn)' }}>
              <p style={{ color: 'var(--warn)', fontSize: '13px' }}>
                {authError || metamask.error}
              </p>
              {authError.includes('decrypt') && (
                <button
                  onClick={handleResetIdentity}
                  className="btn btn-secondary w-full text-sm"
                >
                  Reset Local Identity
                </button>
              )}
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
                    
                    {isResolvingENS ? (
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                        Resolving ENS...
                      </p>
                    ) : ensResult ? (
                      <>
                        <p style={{ color: 'var(--accent)', fontSize: '15px', fontWeight: 600, marginTop: '4px' }}>
                          {ensResult.name}
                        </p>
                        <p className="mono truncate" style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                          {toChecksumAddress(metamask.address!)}
                        </p>
                        {ensResult.network === 'mainnet' && (
                          <p style={{ color: 'var(--text-tertiary)', fontSize: '10px', fontStyle: 'italic' }}>
                            mainnet ENS
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="mono truncate" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {toChecksumAddress(metamask.address!)}
                        </p>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>
                          No ENS name
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional ENS lookup */}
              {!ensResult && (
                <div className="card p-4 space-y-3" style={{ backgroundColor: 'var(--elevated)' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                    Look up ENS name
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ensLookup}
                      onChange={(e) => setEnsLookup(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLookupENS()}
                      placeholder="name.eth"
                      className="flex-1 px-3 py-2 rounded-lg text-sm"
                      style={{
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={handleLookupENS}
                      disabled={!ensLookup.trim()}
                      className="btn btn-secondary text-sm px-4"
                    >
                      →
                    </button>
                  </div>
                  {lookupResult && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {lookupResult}
                    </p>
                  )}
                </div>
              )}

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
