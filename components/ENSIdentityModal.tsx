'use client';

import { useState, useEffect } from 'react';
import { resolveSepoliaENS } from '@/lib/ens/resolver';
import { requestENSOwnershipSignature, verifyENSOwnership } from '@/lib/ens/ownership';
import { toChecksumAddress } from '@/lib/wallet/wallet-auth';
import type { LiveRoom } from '@/lib/data/seed-rooms';
import { ModalShell } from './ModalShell';

type Step = 'input' | 'verifying' | 'signing' | 'verified';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

interface ENSIdentityModalProps {
  isOpen: boolean;
  room: LiveRoom | null;
  walletAddress: string;
  onClose: () => void;
  onVerified: (ensName: string, signature: string, message: string) => void;
}

export function ENSIdentityModal({
  isOpen,
  room,
  walletAddress,
  onClose,
  onVerified
}: ENSIdentityModalProps) {
  const [step, setStep] = useState<Step>('input');
  const [ensName, setEnsName] = useState('');
  const [error, setError] = useState('');
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('input');
      setEnsName('');
      setError('');
      setResolvedAddress(null);
    }
  }, [isOpen]);

  const handleVerifyENS = async () => {
    if (!ensName.trim()) {
      setError('Please enter an ENS name');
      return;
    }

    setStep('verifying');
    setError('');

    try {
      const resolved = await resolveSepoliaENS(ensName.trim());
      setResolvedAddress(resolved);

      if (!resolved) {
        setError(`${ensName} not found on Sepolia`);
        setStep('input');
        return;
      }

      if (resolved.toLowerCase() !== walletAddress.toLowerCase()) {
        setError(`${ensName} resolves to ${resolved.slice(0, 10)}... (not your address)`);
        setStep('input');
        return;
      }

      // ENS matches wallet, proceed to signing
      setStep('signing');
      await handleSign();
    } catch (err) {
      setError('ENS verification failed');
      setStep('input');
    }
  };

  const handleSign = async () => {
    try {
      const checksummed = toChecksumAddress(walletAddress);
      const { message, signature } = await requestENSOwnershipSignature(ensName, checksummed);

      // Verify signature
      const valid = await verifyENSOwnership(ensName, checksummed, signature, message);
      if (!valid) {
        throw new Error('Signature verification failed');
      }

      setStep('verified');
      setTimeout(() => {
        onVerified(ensName, signature, message);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signature failed');
      setStep('input');
    }
  };

  if (!isOpen || !room) return null;

  const allowClose = step === 'input';

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} allowOverlayClose={allowClose} mobileBottomSheet={true}>
      {/* Accent rail */}
      <div style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        backgroundColor: "var(--accent-primary)",
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0'
      }} />

      {/* Close button */}
      {allowClose && (
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
            color: 'var(--text-muted)',
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
          color: 'var(--text-primary)',
          marginBottom: '8px'
        }}>
          Choose display name
        </h2>
        <p style={{ 
          fontSize: '14px', 
          lineHeight: '20px',
          color: 'rgba(255, 255, 255, 0.64)'
        }}>
          Joining: <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>{room.title}</span>
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px 0' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700,
            backgroundColor: step === 'input' || step === 'verifying' ? "var(--accent-primary)" : "var(--bg-elevated)",
            color: 'white'
          }}>
            1
          </div>
          <div style={{ flex: 1, height: '2px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700,
            backgroundColor: step === 'signing' || step === 'verified' ? "var(--accent-primary)" : "var(--bg-elevated)",
            color: 'white'
          }}>
            2
          </div>
          <div style={{ flex: 1, height: '2px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 700,
            backgroundColor: step === 'verified' ? "var(--success)" : "var(--bg-elevated)",
            color: 'white'
          }}>
            ✓
          </div>
        </div>

        {/* Input step */}
        {step === 'input' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.72)',
                marginBottom: '8px'
              }}>
                Your ENS Name (Sepolia)
              </label>
              <input
                type="text"
                value={ensName}
                onChange={(e) => setEnsName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyENS()}
                placeholder="name.eth"
                autoFocus
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  backgroundColor: "var(--bg-elevated)",
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 150ms ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(124, 92, 255, 0.4)';
                  e.currentTarget.style.backgroundColor = '#1A1A24';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.backgroundColor = "var(--bg-elevated)";
                }}
              />
            </div>

            <div style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(124, 92, 255, 0.08)',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '12px', lineHeight: '18px', color: 'rgba(255, 255, 255, 0.56)' }}>
                <div>• ENS must be registered on Sepolia</div>
                <div>• Must resolve to your connected wallet</div>
                <div>• You'll sign a message to prove ownership</div>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: 'rgba(235, 4, 0, 0.1)',
                border: '1px solid rgba(235, 4, 0, 0.3)',
                color: '#EB0400',
                fontSize: '14px',
                marginBottom: '16px'
              }}>
                {error}
              </div>
            )}
          </>
        )}

        {/* Verifying/Signing state */}
        {(step === 'verifying' || step === 'signing') && (
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
              borderTopColor: "var(--accent-primary)",
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.64)'
            }}>
              {step === 'verifying' ? 'Verifying ENS...' : 'Confirm in wallet...'}
            </p>
          </div>
        )}

        {/* Verified state */}
        {step === 'verified' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '32px 0',
            gap: '12px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: "var(--success)",
              color: 'white',
              fontSize: '32px'
            }}>
              ✓
            </div>
            <p style={{
              fontSize: '16px',
              fontWeight: 600,
              color: "var(--success)"
            }}>
              Identity Verified
            </p>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.64)'
            }}>
              Proceeding to payment...
            </p>
          </div>
        )}
      </div>

      {/* CTA stack */}
      {step === 'input' && (
        <div style={{ padding: '8px 24px 0' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
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
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Skip for now
            </button>
            <button
              onClick={handleVerifyENS}
              disabled={!ensName.trim()}
              style={{
                flex: 1,
                height: '48px',
                borderRadius: '14px',
                backgroundColor: "var(--accent-primary)",
                border: 'none',
                color: 'white',
                fontSize: '15px',
                fontWeight: 600,
                cursor: !ensName.trim() ? 'not-allowed' : 'pointer',
                opacity: !ensName.trim() ? 0.5 : 1,
                transition: 'all 150ms ease'
              }}
              onMouseEnter={(e) => {
                if (ensName.trim()) {
                  e.currentTarget.style.backgroundColor = '#6B4DEE';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--accent-primary)";
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Save name
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </ModalShell>
  );
}
