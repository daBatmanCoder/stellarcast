'use client';

import { useState, useEffect } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { toChecksumAddress, authenticateWithWallet, reauthenticateWithWallet } from '@/lib/wallet/wallet-auth';
import { generateStealthIdentity, identityToMetaAddress, encodeMetaAddress } from '@/lib/crypto/identity';
import { storeIdentity, loadIdentity, getAuthInfo, clearIdentity } from '@/lib/storage/identity-store';
import { resolveSepoliaENS, reverseResolveSepoliaENS } from '@/lib/ens/resolver';
import { requestENSOwnershipSignature, verifyENSOwnership } from '@/lib/ens/ownership';
import { storeENSVerification, getENSVerification } from '@/lib/storage/ens-store';
import type { StealthIdentity } from '@/lib/types/stealth';

type FlowStep = 'connect' | 'claim-ens' | 'sign-proof' | 'authenticating';

interface WalletConnectProps {
  onIdentityReady: (identity: StealthIdentity, metaAddress: string, ensName?: string) => void;
}

export function WalletConnect({ onIdentityReady }: WalletConnectProps) {
  const metamask = useMetaMask();
  const [flowStep, setFlowStep] = useState<FlowStep>('connect');
  const [authError, setAuthError] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string>('');
  
  // ENS claim state
  const [claimedENS, setClaimedENS] = useState<string>('');
  const [suggestedENS, setSuggestedENS] = useState<string>('');
  const [isResolvingENS, setIsResolvingENS] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [addressMatch, setAddressMatch] = useState<boolean | null>(null);

  // Suggest ENS from reverse resolution when wallet connects
  useEffect(() => {
    const suggestENS = async () => {
      if (metamask.isConnected && metamask.address && flowStep === 'claim-ens') {
        setIsResolvingENS(true);
        const reverseName = await reverseResolveSepoliaENS(metamask.address);
        if (reverseName) {
          setSuggestedENS(reverseName);
          setClaimedENS(reverseName);
        }
        setIsResolvingENS(false);
      }
    };

    suggestENS();
  }, [metamask.isConnected, metamask.address, flowStep]);

  // Step 1: Connect wallet
  const handleWalletConnect = async () => {
    const success = await metamask.connect();
    if (success && metamask.address) {
      // Check if already has verified ENS
      const existing = await getENSVerification(metamask.address);
      if (existing) {
        setClaimedENS(existing.ensName);
        // Skip to auth
        await handleAuthenticate(existing.ensName);
      } else {
        setFlowStep('claim-ens');
      }
    }
  };

  // Step 2: Verify ENS forward-resolves to connected address
  const handleVerifyENS = async () => {
    if (!claimedENS.trim() || !metamask.address) return;

    setIsResolvingENS(true);
    setAuthError('');
    
    try {
      const resolved = await resolveSepoliaENS(claimedENS.trim());
      setResolvedAddress(resolved);
      
      if (resolved) {
        const matches = resolved.toLowerCase() === metamask.address.toLowerCase();
        setAddressMatch(matches);
        
        if (matches) {
          setFlowStep('sign-proof');
        } else {
          setAuthError(`${claimedENS} resolves to ${resolved.slice(0, 10)}... (not your address)`);
        }
      } else {
        setAuthError(`${claimedENS} not found on Sepolia`);
        setAddressMatch(false);
      }
    } catch (error) {
      setAuthError('ENS resolution failed');
      setAddressMatch(false);
    } finally {
      setIsResolvingENS(false);
    }
  };

  // Step 3: Sign ownership proof
  const handleSignProof = async () => {
    if (!metamask.address || !claimedENS) return;

    setFlowStep('authenticating');
    setAuthError('');

    try {
      const checksummed = toChecksumAddress(metamask.address);
      
      // Request signature
      const { message, signature } = await requestENSOwnershipSignature(
        claimedENS,
        checksummed
      );

      // Verify signature client-side
      const valid = await verifyENSOwnership(
        claimedENS,
        checksummed,
        signature,
        message
      );

      if (!valid) {
        throw new Error('Signature verification failed');
      }

      // Store verified binding
      await storeENSVerification({
        walletAddress: metamask.address,
        ensName: claimedENS,
        chainId: 11155111,
        message,
        signature,
        verifiedAt: new Date().toISOString()
      });

      // Continue to auth
      await handleAuthenticate(claimedENS);
    } catch (error) {
      setFlowStep('sign-proof');
      setAuthError(error instanceof Error ? error.message : 'Signature failed');
    }
  };

  // Continue without ENS
  const handleContinueWithoutENS = async () => {
    setFlowStep('authenticating');
    await handleAuthenticate();
  };

  // Final authentication step
  const handleAuthenticate = async (ensName?: string) => {
    if (!metamask.address) return;

    try {
      const checksummed = toChecksumAddress(metamask.address);
      
      // Check for existing identity
      const authInfo = await getAuthInfo();
      
      if (authInfo && authInfo.walletAddress.toLowerCase() === metamask.address.toLowerCase()) {
        try {
          const encryptionKey = await reauthenticateWithWallet(
            checksummed,
            authInfo.authNonce,
            authInfo.authTimestamp
          );
          
          const userIdentity = await loadIdentity(metamask.address, encryptionKey);
          
          if (!userIdentity) {
            throw new Error('DECRYPT_FAILED');
          }
          
          const meta = identityToMetaAddress(userIdentity);
          const metaAddress = encodeMetaAddress(meta);
          onIdentityReady(userIdentity, metaAddress, ensName);
          return;
        } catch (decryptError) {
          await clearIdentity(metamask.address);
          setWarningMessage('Previous identity couldn\'t be unlocked — created a new one.');
        }
      }
      
      // Create new identity
      const { encryptionKey, nonce } = await authenticateWithWallet(checksummed);
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
      onIdentityReady(userIdentity, metaAddress, ensName);
    } catch (error) {
      setFlowStep('claim-ens');
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    }
  };

  // Render UI based on flow step
  if (!metamask.isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] animate-fade-in">
          <div className="card p-8 space-y-6">
            <div className="text-center space-y-3">
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                MetaMask Required
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Install MetaMask to continue
              </p>
            </div>
            <a 
              href="https://metamask.io/download/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-primary w-full"
            >
              Install MetaMask
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[500px] animate-fade-in">
        <div className="card p-8 space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
              flowStep === 'connect' ? 'bg-[var(--accent)]' : 'bg-[var(--elevated)]'
            }`} style={{ color: 'var(--text-primary)' }}>
              1
            </div>
            <div className="w-12 h-0.5 bg-[var(--border)]"></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
              flowStep === 'claim-ens' || flowStep === 'sign-proof' || flowStep === 'authenticating' 
                ? 'bg-[var(--accent)]' : 'bg-[var(--elevated)]'
            }`} style={{ color: 'var(--text-primary)' }}>
              2
            </div>
            <div className="w-12 h-0.5 bg-[var(--border)]"></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
              flowStep === 'sign-proof' || flowStep === 'authenticating' ? 'bg-[var(--accent)]' : 'bg-[var(--elevated)]'
            }`} style={{ color: 'var(--text-primary)' }}>
              3
            </div>
          </div>

          {/* Messages */}
          {warningMessage && (
            <div className="card p-4" style={{ borderColor: 'var(--warn)' }}>
              <p style={{ color: 'var(--warn)', fontSize: '13px' }}>
                {warningMessage}
              </p>
            </div>
          )}

          {authError && (
            <div className="card p-4" style={{ borderColor: 'var(--warn)' }}>
              <p style={{ color: 'var(--warn)', fontSize: '13px' }}>
                {authError}
              </p>
            </div>
          )}

          {/* Step 1: Connect */}
          {flowStep === 'connect' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                  Connect Wallet
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Connect MetaMask on Sepolia to continue
                </p>
              </div>

              <button
                onClick={handleWalletConnect}
                disabled={metamask.isConnecting}
                className="btn btn-primary w-full"
              >
                {metamask.isConnecting ? 'Connecting...' : 'Connect MetaMask'}
              </button>
            </div>
          )}

          {/* Step 2: Claim ENS */}
          {flowStep === 'claim-ens' && metamask.isConnected && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                  Claim ENS
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Verify ownership of your Sepolia ENS name
                </p>
              </div>

              <div className="card p-4" style={{ backgroundColor: 'var(--elevated)' }}>
                <p className="mono text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {metamask.address}
                </p>
              </div>

              <div className="space-y-2">
                <label style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
                  ENS Name
                </label>
                <input
                  type="text"
                  value={claimedENS}
                  onChange={(e) => setClaimedENS(e.target.value)}
                  placeholder="name.eth"
                  disabled={isResolvingENS}
                  className="w-full px-4 py-3 rounded-lg"
                  style={{
                    backgroundColor: 'var(--elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '15px'
                  }}
                />
                {suggestedENS && suggestedENS !== claimedENS && (
                  <button
                    onClick={() => setClaimedENS(suggestedENS)}
                    className="text-xs"
                    style={{ color: 'var(--accent)' }}
                  >
                    Use suggested: {suggestedENS}
                  </button>
                )}
              </div>

              {addressMatch !== null && (
                <div className={`card p-4`} style={{ 
                  borderColor: addressMatch ? 'var(--success)' : 'var(--warn)' 
                }}>
                  <p style={{ 
                    color: addressMatch ? 'var(--success)' : 'var(--warn)', 
                    fontSize: '13px' 
                  }}>
                    {addressMatch 
                      ? `✓ ${claimedENS} resolves to your address`
                      : `✗ Address mismatch`
                    }
                  </p>
                  {resolvedAddress && (
                    <p className="mono text-xs truncate mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      Resolves to: {resolvedAddress}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleVerifyENS}
                  disabled={!claimedENS.trim() || isResolvingENS}
                  className="btn btn-primary w-full"
                >
                  {isResolvingENS ? 'Verifying...' : 'Verify ENS'}
                </button>

                <button
                  onClick={handleContinueWithoutENS}
                  className="btn btn-secondary w-full text-sm"
                >
                  Continue without ENS
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Sign Proof */}
          {flowStep === 'sign-proof' && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                  Prove Ownership
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Sign a message to prove you own {claimedENS}
                </p>
              </div>

              <div className="card p-4 space-y-3" style={{ backgroundColor: 'var(--elevated)' }}>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>ENS</span>
                  <span style={{ color: 'var(--accent)', fontSize: '15px', fontWeight: 600 }}>
                    {claimedENS}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Address</span>
                  <span className="mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {metamask.address?.slice(0, 10)}...{metamask.address?.slice(-8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Chain</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Sepolia (11155111)
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSignProof}
                  className="btn btn-primary w-full"
                >
                  Sign Ownership Proof
                </button>

                <button
                  onClick={() => setFlowStep('claim-ens')}
                  className="btn btn-secondary w-full text-sm"
                >
                  ← Back
                </button>
              </div>

              <p style={{ color: 'var(--text-tertiary)', fontSize: '11px', lineHeight: '1.5' }}>
                You'll sign: "STELLARCAST ENS ownership" + your ENS, address, chain ID, and nonce. 
                This proves you control both the wallet and ENS.
              </p>
            </div>
          )}

          {/* Step 4: Authenticating */}
          {flowStep === 'authenticating' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-12 h-12 rounded-full" style={{
                border: '3px solid var(--surface)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 1s linear infinite'
              }}></div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Setting up identity...
              </p>
            </div>
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
