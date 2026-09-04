'use client';

import { useState, useEffect } from 'react';
import { ModalShell } from './ModalShell';
import { resolveSepoliaENS } from '@/lib/ens/resolver';
import { requestENSOwnershipSignature, verifyENSOwnership } from '@/lib/ens/ownership';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

type Step = 'ens-verify' | 'stealth-setup' | 'stream-config';

interface GoLiveModalProps {
  isOpen: boolean;
  ensName: string;
  metaAddress: string;
  walletAddress: string;
  onClose: () => void;
  onStartStream: (title: string, category: string) => void;
  onEnsVerified?: (ensName: string, signature: string, message: string) => void | Promise<void>;
}

export function GoLiveModal({
  isOpen,
  ensName,
  metaAddress,
  walletAddress,
  onClose,
  onStartStream,
  onEnsVerified,
}: GoLiveModalProps) {
  const [step, setStep] = useState<Step>('ens-verify');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Science & Technology');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [ensInput, setEnsInput] = useState(ensName);
  const [activeEns, setActiveEns] = useState(ensName);
  const [stealthMetaAddress, setStealthMetaAddress] = useState(metaAddress);

  useEffect(() => {
    if (!isOpen) return;
    setEnsInput(ensName);
    setActiveEns(ensName);
    setStealthMetaAddress(metaAddress);
    setStep('ens-verify');
    setError('');
  }, [isOpen, ensName, metaAddress]);

  const categories = [
    'Science & Technology',
    'Software Development',
    'Finance',
    'Art',
    'Events',
    'Community',
    'Education',
    'Gaming',
    'Music',
    'Other'
  ];

  const handleVerifyENS = async () => {
    const name = ensInput.trim();
    if (!name) {
      setError('Enter your ENS name (e.g. you.eth)');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const resolvedAddress = await resolveSepoliaENS(name);
      
      if (!resolvedAddress) {
        setError(`ENS name "${name}" not found on Sepolia`);
        setVerifying(false);
        return;
      }

      if (resolvedAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        setError(`You don't own ${name}. Resolved to ${resolvedAddress.slice(0, 10)}...`);
        setVerifying(false);
        return;
      }

      const { message, signature } = await requestENSOwnershipSignature(name, walletAddress);
      const isValid = await verifyENSOwnership(name, walletAddress, signature, message);

      if (!isValid) {
        setError('Signature verification failed');
        setVerifying(false);
        return;
      }

      setActiveEns(name);
      await onEnsVerified?.(name, signature, message);
      setStep('stealth-setup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleDownloadRecipient = () => {
    const recipientData = {
      schemeId: 1,
      stealthMetaAddress: stealthMetaAddress,
      spendingPublicKey: stealthMetaAddress.slice(0, 68),
      viewingPublicKey: '0x' + stealthMetaAddress.slice(68),
      ens: activeEns,
      chainId: 11155111
    };

    const blob = new Blob([JSON.stringify(recipientData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeEns || 'host'}-recipient.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStart = () => {
    if (title.trim()) {
      onStartStream(title, category);
    }
  };

  const textRecordKey = 'eth.stellarcast.stealth';
  const textRecordValue = stealthMetaAddress;

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} allowOverlayClose={step === 'ens-verify'} mobileBottomSheet={true}>
      <div style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        backgroundColor: 'var(--live)',
        borderRadius: '24px 24px 0 0'
      }} />

      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '44px',
          height: '44px',
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

      <div style={{ padding: '24px 24px 0' }}>
        <h2 style={{ 
          fontSize: '22px', 
          lineHeight: '28px', 
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '8px'
        }}>
          {step === 'ens-verify' ? 'Verify ENS Ownership' : 
           step === 'stealth-setup' ? 'Stealth Payment Setup' : 
           'Go Live'}
        </h2>
        <p style={{ 
          fontSize: '14px', 
          lineHeight: '20px',
          color: 'rgba(255, 255, 255, 0.64)'
        }}>
          {step === 'ens-verify' ? 'Prove you own your ENS name on Sepolia' :
           step === 'stealth-setup' ? 'Set up private payments for your stream' :
           'Configure your livestream'}
        </p>
      </div>

      <div style={{ padding: '20px 24px 0' }}>
        {step === 'ens-verify' && (
          <>
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(124, 92, 255, 0.1)',
              border: '1px solid rgba(124, 92, 255, 0.3)',
              marginBottom: '16px'
            }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px' }}>
                Your ENS Name
              </p>
              <input
                type="text"
                value={ensInput}
                onChange={(e) => setEnsInput(e.target.value)}
                placeholder="you.eth"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 600,
                  outline: 'none',
                  marginBottom: '8px'
                }}
              />
              <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.48)', fontFamily: 'monospace' }}>
                {walletAddress || 'Connect wallet first'}
              </p>
            </div>

            <div style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 245, 147, 0.08)',
              border: '1px solid rgba(0, 245, 147, 0.16)',
              marginBottom: '16px'
            }}>
              <p style={{ fontSize: '12px', lineHeight: '18px', color: 'rgba(255, 255, 255, 0.72)' }}>
                We'll verify you own this ENS by:
              </p>
              <ul style={{ fontSize: '12px', lineHeight: '18px', color: 'rgba(255, 255, 255, 0.64)', marginLeft: '20px', marginTop: '8px' }}>
                <li>Resolving your ENS on Sepolia</li>
                <li>Confirming it points to your wallet</li>
                <li>Requesting signature proof (personal_sign)</li>
              </ul>
            </div>

            {error && (
              <div style={{
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 92, 122, 0.1)',
                border: '1px solid rgba(255, 92, 122, 0.3)',
                marginBottom: '16px'
              }}>
                <p style={{ fontSize: '13px', color: '#FF5C7A' }}>
                  {error}
                </p>
              </div>
            )}
          </>
        )}

        {step === 'stealth-setup' && (
          <>
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 245, 147, 0.1)',
              border: '1px solid rgba(0, 245, 147, 0.3)',
              marginBottom: '16px'
            }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)', marginBottom: '8px' }}>
                ✓ ENS Verified: {activeEns}
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.64)' }}>
                Ownership confirmed on Sepolia
              </p>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(124, 92, 255, 0.08)',
              border: '1px solid rgba(124, 92, 255, 0.16)',
              marginBottom: '16px'
            }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px' }}>
                Stealth Meta-Address
              </p>
              <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.72)', wordBreak: 'break-all', marginBottom: '8px' }}>
                {stealthMetaAddress}
              </p>
              <button
                onClick={handleDownloadRecipient}
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(124, 92, 255, 0.2)',
                  border: '1px solid rgba(124, 92, 255, 0.4)',
                  color: 'var(--accent-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(124, 92, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(124, 92, 255, 0.2)';
                }}
              >
                <span>📥</span>
                Download recipient.json
              </button>
              <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.48)', marginTop: '8px', textAlign: 'center' }}>
                Keep this file offline - never upload to servers
              </p>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 185, 0, 0.08)',
              border: '1px solid rgba(255, 185, 0, 0.24)',
              marginBottom: '16px'
            }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#FFB900', marginBottom: '12px' }}>
                📝 Add to ENS Text Record
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.64)', marginBottom: '12px' }}>
                Set this text record so viewers can discover your payment address:
              </p>
              
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.56)', marginBottom: '4px' }}>
                  Key:
                </p>
                <div style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  wordBreak: 'break-all'
                }}>
                  {textRecordKey}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.56)', marginBottom: '4px' }}>
                  Value:
                </p>
                <div style={{
                  padding: '8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: 'var(--text-primary)',
                  wordBreak: 'break-all'
                }}>
                  {textRecordValue}
                </div>
              </div>

              <p style={{ fontSize: '11px', lineHeight: '16px', color: 'rgba(255, 255, 255, 0.56)' }}>
                Visit <strong>app.ens.domains</strong> → Your Name → Records → Add Text Record. Paste the key and value above.
              </p>
            </div>
          </>
        )}

        {step === 'stream-config' && (
          <>
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(124, 92, 255, 0.1)',
              border: '1px solid rgba(124, 92, 255, 0.3)',
              marginBottom: '16px'
            }}>
              <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.64)', marginBottom: '8px' }}>
                Your stream identity
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>
                  {activeEns}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--success)' }}>✓</span>
              </div>
              <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.48)' }}>
                Stealth: {stealthMetaAddress.slice(0, 18)}...{stealthMetaAddress.slice(-16)}
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.88)',
                marginBottom: '8px'
              }}>
                Stream Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you streaming?"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.88)',
                marginBottom: '8px'
              }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat} style={{ backgroundColor: 'var(--bg-surface)' }}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.88)',
                marginBottom: '8px'
              }}>
                Entry Price
              </label>
              <div style={{
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                fontFamily: 'monospace',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}>
                0.001 ETH
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.48)', marginTop: '6px' }}>
                Default price on Sepolia
              </p>
            </div>

            <div style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 245, 147, 0.1)',
              border: '1px solid rgba(0, 245, 147, 0.3)'
            }}>
              <p style={{ fontSize: '12px', lineHeight: '18px', color: 'rgba(255, 255, 255, 0.80)' }}>
                💡 Viewers pay 0.001 ETH to your stealth meta-address. Each payment generates a unique stealth address for privacy.
              </p>
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '8px 24px 24px' }}>
        {step === 'ens-verify' && (
          <button
            onClick={handleVerifyENS}
            disabled={verifying}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: verifying ? 'rgba(124, 92, 255, 0.5)' : 'var(--accent-primary)',
              border: 'none',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: verifying ? 'not-allowed' : 'pointer',
              transition: 'all 150ms ease'
            }}
            onMouseEnter={(e) => {
              if (!verifying) {
                e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!verifying) {
                e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
              }
            }}
          >
            {verifying ? 'Verifying...' : 'Verify Ownership'}
          </button>
        )}

        {step === 'stealth-setup' && (
          <button
            onClick={() => setStep('stream-config')}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: 'var(--accent-primary)',
              border: 'none',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 150ms ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
            }}
          >
            Continue to Stream Setup
          </button>
        )}

        {step === 'stream-config' && (
          <button
            onClick={handleStart}
            disabled={!title.trim()}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: title.trim() ? 'var(--live)' : 'rgba(235, 4, 0, 0.5)',
              border: 'none',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 150ms ease'
            }}
            onMouseEnter={(e) => {
              if (title.trim()) {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Start Streaming
          </button>
        )}
      </div>
    </ModalShell>
  );
}
