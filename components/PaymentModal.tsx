'use client';

import { useState, useEffect } from 'react';
import type { LiveRoom } from '@/lib/data/seed-rooms';

type PaymentStatus = 'idle' | 'paying' | 'confirming' | 'success' | 'error';

interface PaymentModalProps {
  isOpen: boolean;
  room: LiveRoom | null;
  ensName: string;
  onClose: () => void;
  onSuccess: (txHash: string, sharedSecret: Uint8Array) => void;
  onPay: () => Promise<{ txHash: string; sharedSecret: Uint8Array }>;
}

export function PaymentModal({
  isOpen,
  room,
  ensName,
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
      setError(err instanceof Error ? err.message : 'Payment failed');
      setStatus('error');
    }
  };

  if (!isOpen || !room) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && status === 'idle') onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6 space-y-6"
        style={{
          backgroundColor: 'var(--elevated)',
          border: '1px solid var(--border)'
        }}
      >
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Access Payment
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Private payment via stealth address
          </p>
        </div>

        {status === 'idle' && (
          <>
            {/* Room info */}
            <div
              className="p-4 rounded-lg space-y-3"
              style={{ backgroundColor: 'var(--surface)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Room</span>
                <span className="text-sm font-medium truncate ml-4" style={{ color: 'var(--text-primary)' }}>
                  {room.title}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Your Identity</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                  {ensName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Amount</span>
                <span className="text-lg font-bold mono" style={{ color: 'var(--text-primary)' }}>
                  0.01 ETH
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Network</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Sepolia
                </span>
              </div>
            </div>

            <div
              className="p-3 rounded-lg text-xs space-y-1"
              style={{
                backgroundColor: 'rgba(145, 70, 255, 0.1)',
                border: '1px solid rgba(145, 70, 255, 0.3)',
                color: 'var(--text-secondary)'
              }}
            >
              <p>• Payment sent to stealth address (ERC-5564)</p>
              <p>• Room password delivered to your Inbox</p>
              <p>• Private & non-custodial</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-secondary)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                className="flex-1 py-3 rounded-lg font-semibold transition-colors"
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
                Pay 0.01 ETH
              </button>
            </div>
          </>
        )}

        {status === 'paying' && (
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
              Check MetaMask to confirm transaction...
            </p>
          </div>
        )}

        {status === 'confirming' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-8 space-y-4">
              <div
                className="w-12 h-12 rounded-full"
                style={{
                  border: '3px solid var(--surface)',
                  borderTopColor: 'var(--accent)',
                  animation: 'spin 1s linear infinite'
                }}
              ></div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Confirming on Sepolia...
              </p>
            </div>

            {txHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-xs hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                View on Etherscan →
              </a>
            )}
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center py-12 space-y-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: 'var(--success)', color: 'white' }}
            >
              ✓
            </div>
            <p className="font-semibold" style={{ color: 'var(--success)' }}>
              Payment Confirmed!
            </p>
            <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
              Check your Inbox for the encrypted room password
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg"
              style={{
                backgroundColor: 'rgba(255,0,0,0.1)',
                border: '1px solid var(--live)'
              }}
            >
              <p className="text-sm" style={{ color: 'var(--live)' }}>
                {error}
              </p>
            </div>

            <button
              onClick={() => setStatus('idle')}
              className="w-full py-3 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'var(--surface)',
                color: 'var(--text-secondary)'
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
