'use client';

import { useState, useEffect } from 'react';
import type { LiveRoom } from '@/lib/data/seed-rooms';
import { ModalShell } from './ModalShell';

type PaymentStatus = 'idle' | 'paying' | 'confirming' | 'success' | 'error';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

interface PaymentModalProps {
  isOpen: boolean;
  room: LiveRoom | null;
  ensName?: string;
  isWalletConnected?: boolean;
  isConnecting?: boolean;
  onConnectWallet?: () => Promise<boolean>;
  onClose: () => void;
  onSuccess: (txHash: string, sharedSecret: Uint8Array) => void;
  onPay: () => Promise<{ txHash: string; sharedSecret: Uint8Array }>;
}

export function PaymentModal({
  isOpen,
  room,
  ensName,
  isWalletConnected = true,
  isConnecting = false,
  onConnectWallet,
  onClose,
  onSuccess,
  onPay
}: PaymentModalProps) {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setTxHash('');
      setError('');
    }
  }, [isOpen]);

  const [sharedSecret, setSharedSecret] = useState<Uint8Array | null>(null);

  const handlePay = async () => {
    setStatus('paying');
    setError('');

    try {
      const result = await onPay();
      setTxHash(result.txHash);
      setSharedSecret(result.sharedSecret);
      setStatus('confirming');

      // Wait a bit then mark as success
      setTimeout(() => {
        setStatus('success');
        setTimeout(() => {
          onSuccess(result.txHash, result.sharedSecret);
        }, 1500);
      }, 3000);
    } catch (err) {
      let errorMessage = 'Payment failed';
      
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        
        // Rate limiting
        if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')) {
          errorMessage = 'Sepolia is busy — wait a few seconds and try again';
        }
        // User rejected
        else if (msg.includes('user rejected') || msg.includes('user denied')) {
          errorMessage = 'Transaction cancelled';
        }
        // Insufficient funds
        else if (msg.includes('insufficient') || msg.includes('funds')) {
          errorMessage = 'Insufficient funds. You need ETH on Sepolia testnet';
        }
        // Network issues
        else if (msg.includes('network') || msg.includes('connection')) {
          errorMessage = 'Network error. Check your connection and try again';
        }
        // Generic
        else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
      setStatus('error');
    }
  };

  if (!isOpen || !room) return null;

  const allowClose = status === 'idle';

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
          {status === 'success' ? 'Payment Sent!' : 'Unlock stream'}
        </h2>
        <p style={{ 
          fontSize: '14px', 
          lineHeight: '20px',
          color: 'rgba(255, 255, 255, 0.64)'
        }}>
          {status === 'success' ? 'Check your inbox for access' : 'Private payment via stealth address'}
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px 0' }}>
        {status === 'idle' && (
          <>
            {/* Payment details */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: "var(--bg-elevated)",
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.56)' }}>Room</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{room.title}</span>
              </div>
{ensName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.56)' }}>Your Identity</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)' }}>{ensName}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.56)' }}>Amount</span>
                <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>
                  0.001 ETH
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.56)' }}>Network</span>
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.72)' }}>Sepolia</span>
              </div>
            </div>

            {/* How payment stays private */}
            <div style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(124, 92, 255, 0.08)',
              border: '1px solid rgba(124, 92, 255, 0.16)',
              marginBottom: '16px'
            }}>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: "var(--accent-primary)",
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ fontSize: '14px' }}>🔒</span>
                How payment stays private
              </div>
              <div style={{ fontSize: '12px', lineHeight: '18px', color: 'rgba(255, 255, 255, 0.64)' }}>
                <div style={{ marginBottom: '6px' }}>
                Your payment goes to a <strong style={{ color: 'rgba(255, 255, 255, 0.88)' }}>one-time stealth address</strong> derived from the host’s ENS <code>stealth-meta-address[1]</code> — not their public wallet.
                </div>
                <div style={{ marginBottom: '6px' }}>
                  On-chain, it looks like a payment to a random address. Nobody can link your payment to the streamer's identity.
                </div>
                <div>
                Only the host can detect the payment using their viewing key (ERC-5564).
                </div>
              </div>
            </div>

            <div style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 245, 147, 0.08)',
              border: '1px solid rgba(0, 245, 147, 0.16)'
            }}>
              <div style={{ fontSize: '12px', lineHeight: '18px', color: 'rgba(255, 255, 255, 0.64)' }}>
                ✓ One MetaMask transaction: stealth announce + payment together<br />
                ✓ Access ticket stored in your Inbox after that transaction<br />
                ✓ Private, non-custodial, no middleman
              </div>
            </div>
          </>
        )}

        {/* Paying state */}
        {status === 'paying' && (
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
              Confirm in wallet...
            </p>
          </div>
        )}

        {/* Confirming state */}
        {status === 'confirming' && (
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
              color: 'rgba(255, 255, 255, 0.64)',
              marginBottom: '8px'
            }}>
              Confirming on Sepolia...
            </p>
            {txHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '12px',
                  color: "var(--accent-primary)",
                  textDecoration: 'none',
                  transition: 'opacity 150ms ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                View on Etherscan →
              </a>
            )}
          </div>
        )}

        {/* Success state */}
        {status === 'success' && (
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
              Payment Confirmed!
            </p>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.64)',
              textAlign: 'center',
              maxWidth: '280px'
            }}>
              Check your Inbox for the encrypted room password
            </p>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
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
      </div>

      {/* CTA stack */}
      {status === 'idle' && (
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
              Cancel
            </button>
            <button
              onClick={() => {
                if (!isWalletConnected) {
                  void onConnectWallet?.();
                  return;
                }
                void handlePay();
              }}
              disabled={isConnecting}
              style={{
                flex: 1,
                height: '48px',
                borderRadius: '14px',
                backgroundColor: "var(--accent-primary)",
                border: 'none',
                color: 'white',
                fontSize: '15px',
                fontWeight: 600,
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                opacity: isConnecting ? 0.6 : 1,
                transition: 'all 150ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#6B4DEE';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--accent-primary)";
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {!isWalletConnected
                ? isConnecting ? 'Connecting…' : 'Connect wallet'
                : 'Pay 0.001 ETH'}
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ padding: '8px 24px 0' }}>
          <button
            onClick={() => setStatus('idle')}
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
              transition: 'all 150ms ease',
              marginBottom: '24px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Try Again
          </button>
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
