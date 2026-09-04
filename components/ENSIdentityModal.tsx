'use client';

import { useState, useEffect } from 'react';
import { resolveSepoliaENS } from '@/lib/ens/resolver';
import { requestENSOwnershipSignature, verifyENSOwnership } from '@/lib/ens/ownership';
import { toChecksumAddress } from '@/lib/wallet/wallet-auth';
import type { LiveRoom } from '@/lib/data/seed-rooms';

type Step = 'input' | 'verifying' | 'signing' | 'verified';

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
            Verify Your Identity
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Joining: <span style={{ color: 'var(--accent)' }}>{room.title}</span>
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'input' || step === 'verifying' ? 'bg-[var(--accent)]' : 'bg-[var(--surface)]'
            }`}
            style={{ color: 'white' }}
          >
            1
          </div>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }}></div>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'signing' || step === 'verified' ? 'bg-[var(--accent)]' : 'bg-[var(--surface)]'
            }`}
            style={{ color: 'white' }}
          >
            2
          </div>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }}></div>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'verified' ? 'bg-[var(--success)]' : 'bg-[var(--surface)]'
            }`}
            style={{ color: 'white' }}
          >
            ✓
          </div>
        </div>

        {/* Content */}
        {step === 'input' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Your ENS Name (Sepolia)
              </label>
              <input
                type="text"
                value={ensName}
                onChange={(e) => setEnsName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyENS()}
                placeholder="name.eth"
                className="w-full px-4 py-3 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
                autoFocus
              />
            </div>

            <div
              className="p-3 rounded-lg text-xs space-y-1"
              style={{
                backgroundColor: 'var(--surface)',
                color: 'var(--text-tertiary)'
              }}
            >
              <p>• ENS must be registered on Sepolia</p>
              <p>• Must resolve to your connected wallet</p>
              <p>• You'll sign a message to prove ownership</p>
            </div>

            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: 'rgba(255,0,0,0.1)',
                  border: '1px solid var(--live)',
                  color: 'var(--live)'
                }}
              >
                {error}
              </div>
            )}

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
                onClick={handleVerifyENS}
                disabled={!ensName.trim()}
                className="flex-1 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'white'
                }}
              >
                Verify
              </button>
            </div>
          </div>
        )}

        {(step === 'verifying' || step === 'signing') && (
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
              {step === 'verifying' ? 'Verifying ENS...' : 'Check MetaMask to sign...'}
            </p>
          </div>
        )}

        {step === 'verified' && (
          <div className="flex flex-col items-center py-12 space-y-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: 'var(--success)', color: 'white' }}
            >
              ✓
            </div>
            <p className="font-semibold" style={{ color: 'var(--success)' }}>
              Identity Verified
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Proceeding to payment...
            </p>
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
