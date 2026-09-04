'use client';

import { useState } from 'react';
import { useMetaMask } from '@/lib/wallet/useMetaMask';
import { toChecksumAddress, authenticateWithWallet, reauthenticateWithWallet } from '@/lib/wallet/wallet-auth';
import { generateStealthIdentity, identityToMetaAddress, encodeMetaAddress } from '@/lib/crypto/identity';
import { storeIdentity, loadIdentity, getAuthInfo, clearIdentity } from '@/lib/storage/identity-store';
import type { StealthIdentity } from '@/lib/types/stealth';
import { ModalShell } from './ModalShell';

interface WalletConnectProps {
  onIdentityReady: (identity: StealthIdentity, metaAddress: string, ensName?: string) => void;
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

export function WalletConnect({ onIdentityReady }: WalletConnectProps) {
  const metamask = useMetaMask();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!metamask.address) return;
    await navigator.clipboard.writeText(toChecksumAddress(metamask.address));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = () => {
    metamask.disconnect();
    setAuthError('');
    setWarningMessage('');
  };

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
      <ModalShell isOpen={true} allowOverlayClose={true} onClose={() => window.location.href = '/'}>
        {/* Accent rail */}
        <div style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          backgroundColor: '#7C5CFF',
          borderRadius: '24px 24px 0 0'
        }} />

        {/* Close button */}
        <button
          onClick={() => window.location.href = '/'}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '32px',
            height: '32px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            transition: 'background 150ms ease',
            color: 'rgba(255, 255, 255, 0.48)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.80)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.48)';
          }}
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        {/* Header */}
        <div style={{ padding: '24px 24px 0' }}>
          <h2 style={{ 
            fontSize: '22px', 
            lineHeight: '28px', 
            fontWeight: 700,
            color: '#FFFFFF',
            marginBottom: '8px'
          }}>
            MetaMask Required
          </h2>
          <p style={{ 
            fontSize: '14px', 
            lineHeight: '20px',
            color: 'rgba(255, 255, 255, 0.64)'
          }}>
            Install MetaMask to access private streaming
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 24px 24px' }}>
          <a 
            href="https://metamask.io/download/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              display: 'block',
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: '#7C5CFF',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              textAlign: 'center',
              lineHeight: '48px',
              textDecoration: 'none',
              transition: 'all 150ms ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#6B4DEE';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#7C5CFF';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Install MetaMask
          </a>
        </div>
      </ModalShell>
    );
  }

  const allowClose = !isAuthenticating && !metamask.isConnected;

  return (
    <ModalShell isOpen={true} allowOverlayClose={allowClose}>
      {/* Accent rail */}
      <div style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        backgroundColor: '#7C5CFF',
        borderRadius: '24px 24px 0 0'
      }} />

      {/* Close button */}
      {allowClose && (
        <button
          onClick={handleDisconnect}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.48)',
            cursor: 'pointer',
            transition: 'all 150ms ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.72)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.48)';
          }}
        >
          <CloseIcon />
        </button>
      )}

      {/* Header */}
      <div style={{ padding: '24px 24px 0' }}>
        <h2 style={{ 
          fontSize: '22px', 
          lineHeight: '28px', 
          fontWeight: 700,
          color: '#FFFFFF',
          marginBottom: '8px'
        }}>
          Welcome to Stellarcast
        </h2>
        <p style={{ 
          fontSize: '14px', 
          lineHeight: '20px',
          color: 'rgba(255, 255, 255, 0.64)'
        }}>
          Connect your wallet to access private streaming
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px 0' }}>
        {/* Messages */}
        {warningMessage && (
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 185, 0, 0.1)',
            border: '1px solid rgba(255, 185, 0, 0.3)',
            color: '#FFB900',
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            {warningMessage}
          </div>
        )}

        {authError && (
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'rgba(235, 4, 0, 0.1)',
            border: '1px solid rgba(235, 4, 0, 0.3)',
            color: '#EB0400',
            fontSize: '14px',
            marginBottom: '16px'
          }}>
            {authError}
          </div>
        )}

        {/* Connected state */}
        {metamask.isConnected && !isAuthenticating && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              backgroundColor: '#1C1C26',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#3DDC97'
                }} />
                <span style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#3DDC97',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Connected
                </span>
              </div>
              <div style={{
                flex: 1,
                fontSize: '13px',
                fontFamily: 'JetBrains Mono, monospace',
                color: 'rgba(255, 255, 255, 0.72)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {toChecksumAddress(metamask.address!).slice(0, 6)}...{toChecksumAddress(metamask.address!).slice(-4)}
              </div>
              <button
                onClick={handleCopyAddress}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  backgroundColor: copied ? 'rgba(61, 220, 151, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                  border: 'none',
                  color: copied ? '#3DDC97' : 'rgba(255, 255, 255, 0.56)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
                onMouseEnter={(e) => {
                  if (!copied) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!copied) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                  }
                }}
                title={copied ? 'Copied!' : 'Copy address'}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>
          </>
        )}

        {/* Signing state */}
        {isAuthenticating && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '32px 0',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: '3px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: '#7C5CFF',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.64)'
            }}>
              Confirm in wallet...
            </p>
          </div>
        )}
      </div>

      {/* CTA stack */}
      <div style={{ padding: '8px 24px 0' }}>
        {metamask.isConnected && !isAuthenticating ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleConnect}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '14px',
                backgroundColor: '#7C5CFF',
                border: 'none',
                color: 'white',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#6B4DEE';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#7C5CFF';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Sign to Continue
            </button>
            <button
              onClick={handleDisconnect}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '14px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'rgba(255, 255, 255, 0.72)',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 150ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 92, 122, 0.5)';
                e.currentTarget.style.color = '#FF5C7A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.72)';
              }}
            >
              Disconnect
            </button>
          </div>
        ) : !isAuthenticating ? (
          <button
            onClick={metamask.connect}
            disabled={!metamask.isInstalled || metamask.isConnecting}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: '#7C5CFF',
              border: 'none',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: !metamask.isInstalled || metamask.isConnecting ? 'not-allowed' : 'pointer',
              opacity: !metamask.isInstalled || metamask.isConnecting ? 0.5 : 1,
              transition: 'all 150ms ease'
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = '#6B4DEE';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#7C5CFF';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {metamask.isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : null}
      </div>

      {/* Footnote */}
      <div style={{ padding: '16px 24px 24px', textAlign: 'center' }}>
        <p style={{
          fontSize: '12px',
          lineHeight: '16px',
          color: 'rgba(255, 255, 255, 0.48)'
        }}>
          Sign a message to create your private identity.<br />This does not grant access to your funds.
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </ModalShell>
  );
}
