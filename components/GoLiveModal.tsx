'use client';

import { useState, useEffect, useRef } from 'react';
import { ModalShell } from './ModalShell';
import { resolveSepoliaENS, getStealthMetaSlots } from '@/lib/ens/resolver';
import { requestENSOwnershipSignature, verifyENSOwnership } from '@/lib/ens/ownership';
import type { StealthIdentity, StealthMetaAddress } from '@/lib/types/stealth';
import {
  generateStealthIdentity,
  identityToMetaAddress,
  encodeMetaAddress,
  identityMatchesMeta,
  tryDecodeMetaAddress,
  importIdentityFromRecipientJson,
  serializeRecipientJson,
} from '@/lib/crypto/identity';
import { registerReceivingMetaAddress } from '@/lib/stealth/receiving';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

type Step = 'ens-verify' | 'stealth-setup' | 'stream-config';
type StealthSetupMode = 'checking' | 'matched' | 'need-keys' | 'create';
type NeedKeysChoice = 'ask' | 'import' | 'lost';

interface GoLiveModalProps {
  isOpen: boolean;
  ensName: string;
  metaAddress: string;
  walletAddress: string;
  identity: StealthIdentity | null;
  onClose: () => void;
  onStartStream: (title: string, category: string) => void | Promise<void>;
  onEnsVerified?: (ensName: string, signature: string, message: string) => void | Promise<void>;
  onKeysUpdated: (identity: StealthIdentity, metaAddress: string) => Promise<void>;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function GoLiveModal({
  isOpen,
  ensName,
  metaAddress,
  walletAddress,
  identity,
  onClose,
  onStartStream,
  onEnsVerified,
  onKeysUpdated,
}: GoLiveModalProps) {
  const [step, setStep] = useState<Step>('ens-verify');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Science & Technology');
  const [verifying, setVerifying] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [ensInput, setEnsInput] = useState(ensName);
  const [activeEns, setActiveEns] = useState(ensName);
  const [stealthMetaAddress, setStealthMetaAddress] = useState(metaAddress);
  const [ensMeta, setEnsMeta] = useState<StealthMetaAddress | null>(null);
  const [stealthSetupMode, setStealthSetupMode] = useState<StealthSetupMode>('checking');
  const [needKeysChoice, setNeedKeysChoice] = useState<NeedKeysChoice>('ask');
  const [keysReady, setKeysReady] = useState(false);
  const [existingSlots, setExistingSlots] = useState<Array<{ slot: number; value: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEnsInput(ensName);
    setActiveEns(ensName);
    setStealthMetaAddress(metaAddress);
    setStep('ens-verify');
    setError('');
    setStealthSetupMode('checking');
    setNeedKeysChoice('ask');
    setKeysReady(false);
    setExistingSlots([]);
    setEnsMeta(null);
    setPublishing(false);
    setStarting(false);
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
    'Other',
  ];

  const applySlotResult = (
    slots: Array<{ slot: number; value: string }>,
    currentIdentity: StealthIdentity | null
  ) => {
    setExistingSlots(slots);
    const slot1 = slots.find((s) => s.slot === 1) || slots[0];
    if (!slot1) {
      setEnsMeta(null);
      setStealthSetupMode('create');
      setKeysReady(!!currentIdentity);
      if (currentIdentity) {
        setStealthMetaAddress(encodeMetaAddress(identityToMetaAddress(currentIdentity)));
      }
      return;
    }

    const parsed = tryDecodeMetaAddress(slot1.value);
    setEnsMeta(parsed);
    setStealthMetaAddress(slot1.value);

    if (currentIdentity && parsed && identityMatchesMeta(currentIdentity, parsed)) {
      setStealthSetupMode('matched');
      setKeysReady(true);
      return;
    }

    setStealthSetupMode('need-keys');
    setNeedKeysChoice('ask');
    setKeysReady(false);
  };

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
        return;
      }

      if (resolvedAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        setError(`You don't own ${name}. Resolved to ${resolvedAddress.slice(0, 10)}...`);
        return;
      }

      const { message, signature } = await requestENSOwnershipSignature(name, walletAddress);
      const isValid = await verifyENSOwnership(name, walletAddress, signature, message);

      if (!isValid) {
        setError('Signature verification failed');
        return;
      }

      setActiveEns(name);
      await onEnsVerified?.(name, signature, message);

      setStealthSetupMode('checking');
      setStep('stealth-setup');
      const slots = await getStealthMetaSlots(name);
      applySlotResult(slots, identity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleDownloadRecipient = (id: StealthIdentity | null) => {
    if (!id) {
      setError('No private keys in this session to download.');
      return;
    }
    downloadJson(`${activeEns || 'host'}-recipient.json`, serializeRecipientJson(id, activeEns));
  };

  const handleImportFile = async (file: File) => {
    setError('');
    try {
      const text = await file.text();
      const imported = importIdentityFromRecipientJson(JSON.parse(text), ensMeta);
      const encoded = encodeMetaAddress(identityToMetaAddress(imported));
      await onKeysUpdated(imported, encoded);
      setStealthMetaAddress(encoded);
      setKeysReady(true);
    } catch (err) {
      setKeysReady(false);
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const handlePublishCurrentKeys = async (id: StealthIdentity) => {
    setPublishing(true);
    setError('');
    try {
      const encoded = encodeMetaAddress(identityToMetaAddress(id));
      await onKeysUpdated(id, encoded);
      handleDownloadRecipient(id);
      const result = await registerReceivingMetaAddress(walletAddress, id, {
        ensName: activeEns,
        targetSlot: 1,
      });
      setStealthMetaAddress(result.metaEncoded);
      setKeysReady(true);
      setStep('stream-config');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish stealth-meta-address[1]');
    } finally {
      setPublishing(false);
    }
  };

  const handleGenerateAndPublish = async () => {
    const next = generateStealthIdentity();
    await handlePublishCurrentKeys(next);
  };

  const handleStealthContinue = async () => {
    if (stealthSetupMode === 'matched' || (stealthSetupMode === 'need-keys' && keysReady)) {
      setStep('stream-config');
      return;
    }
    if (stealthSetupMode === 'create') {
      if (!identity) {
        setError('Connect and sign in first so we can generate stealth keys.');
        return;
      }
      await handlePublishCurrentKeys(identity);
      return;
    }
    if (stealthSetupMode === 'need-keys' && needKeysChoice === 'lost') {
      await handleGenerateAndPublish();
    }
  };

  const handleStart = async () => {
    if (!title.trim() || !keysReady) return;
    setStarting(true);
    setError('');
    try {
      await onStartStream(title, category);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setStarting(false);
    }
  };

  const showStealthContinue =
    step === 'stealth-setup' &&
    stealthSetupMode !== 'checking' &&
    (stealthSetupMode === 'matched' ||
      stealthSetupMode === 'create' ||
      (stealthSetupMode === 'need-keys' && keysReady) ||
      (stealthSetupMode === 'need-keys' && needKeysChoice === 'lost'));

  const stealthContinueLabel =
    stealthSetupMode === 'create'
      ? publishing
        ? 'Publishing to ENS…'
        : 'Publish stealth-meta-address[1]'
      : stealthSetupMode === 'need-keys' && needKeysChoice === 'lost' && !keysReady
        ? publishing
          ? 'Generating and publishing…'
          : 'Generate new keys and overwrite [1]'
        : 'Continue to Stream Setup';

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
        }}
        aria-label="Close"
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
           step === 'stealth-setup' ? 'Stealth payment keys' :
           'Go Live'}
        </h2>
        <p style={{
          fontSize: '14px',
          lineHeight: '20px',
          color: 'rgba(255, 255, 255, 0.64)'
        }}>
          {step === 'ens-verify' ? 'Prove you own your ENS name on Sepolia' :
           step === 'stealth-setup' ? 'Viewers pay stealth-meta-address[1]. You need the matching private keys in this browser.' :
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
                ENS verified: {activeEns}
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.64)' }}>
                Ownership confirmed on Sepolia
              </p>
            </div>

            {stealthSetupMode === 'checking' && (
              <div style={{ padding: '24px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.64)' }}>
                  Reading stealth-meta-address[1]…
                </p>
              </div>
            )}

            {stealthSetupMode === 'matched' && (
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(0, 245, 147, 0.1)',
                border: '1px solid rgba(0, 245, 147, 0.3)',
                marginBottom: '16px'
              }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--success)', marginBottom: '8px' }}>
                  Session keys match stealth-meta-address[1]
                </p>
                <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.64)', marginBottom: '12px', wordBreak: 'break-all' }}>
                  {stealthMetaAddress}
                </p>
                <button
                  type="button"
                  onClick={() => handleDownloadRecipient(identity)}
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
                  }}
                >
                  Download recipient.json backup
                </button>
              </div>
            )}

            {stealthSetupMode === 'need-keys' && (
              <>
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 185, 0, 0.1)',
                  border: '1px solid rgba(255, 185, 0, 0.3)',
                  marginBottom: '16px'
                }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#FFB900', marginBottom: '8px' }}>
                    Found stealth-meta-address[1] on {activeEns}
                  </p>
                  <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.72)', wordBreak: 'break-all', marginBottom: '8px' }}>
                    {stealthMetaAddress}
                  </p>
                  <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.64)', lineHeight: '18px' }}>
                    That record is public. To scan or claim payments you must have the spending and viewing private keys that created it. This browser does not have them.
                  </p>
                </div>

                {needKeysChoice === 'ask' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    <button
                      type="button"
                      onClick={() => { setNeedKeysChoice('import'); setError(''); }}
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
                      }}
                    >
                      I have the private keys
                    </button>
                    <button
                      type="button"
                      onClick={() => { setNeedKeysChoice('lost'); setError(''); }}
                      style={{
                        width: '100%',
                        height: '44px',
                        borderRadius: '14px',
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: 'rgba(255, 255, 255, 0.72)',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      I don’t have them
                    </button>
                  </div>
                )}

                {needKeysChoice === 'import' && (
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(124, 92, 255, 0.08)',
                    border: '1px solid rgba(124, 92, 255, 0.16)',
                    marginBottom: '16px'
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px' }}>
                      Import recipient.json
                    </p>
                    <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.64)', marginBottom: '12px', lineHeight: '18px' }}>
                      Use the file from stealthPoC or a previous Stellarcast backup. Keys must match this ENS record. They stay in this browser session (encrypted IndexedDB).
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json,.json"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImportFile(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
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
                      }}
                    >
                      Choose recipient.json
                    </button>
                    {keysReady && (
                      <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '10px' }}>
                        Keys imported and they match the ENS record.
                      </p>
                    )}
                  </div>
                )}

                {needKeysChoice === 'lost' && (
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(235, 4, 0, 0.08)',
                    border: '1px solid rgba(235, 4, 0, 0.25)',
                    marginBottom: '16px'
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#FF5C7A', marginBottom: '8px' }}>
                      Old payments become unrecoverable
                    </p>
                    <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.72)', lineHeight: '18px' }}>
                      Generating new keys overwrites stealth-meta-address[1]. Viewers will pay the new keys. Anything already sent to the old meta-address cannot be scanned or swept from this app.
                    </p>
                  </div>
                )}
              </>
            )}

            {stealthSetupMode === 'create' && (
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(124, 92, 255, 0.08)',
                border: '1px solid rgba(124, 92, 255, 0.16)',
                marginBottom: '16px'
              }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '8px' }}>
                  No stealth-meta-address[1] on this ENS
                </p>
                <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.64)', marginBottom: '12px', lineHeight: '18px' }}>
                  We will publish this session’s spend/view public keys to your ENS, then download a recipient.json that includes the private keys. That file is the only backup.
                </p>
                <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.56)', marginBottom: '8px', wordBreak: 'break-all' }}>
                  {stealthMetaAddress}
                </p>
                <button
                  type="button"
                  onClick={() => handleDownloadRecipient(identity)}
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
                  }}
                >
                  Download recipient.json now
                </button>
              </div>
            )}
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
                <span style={{ fontSize: '12px', color: 'var(--success)' }}>keys ready</span>
              </div>
              <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.48)', wordBreak: 'break-all' }}>
                {stealthMetaAddress}
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
              >
                {categories.map((cat) => (
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
                Viewers pay this amount to a one-time ERC-5564 stealth address derived from your ENS record.
              </p>
            </div>
          </>
        )}

        {error && (
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 92, 122, 0.1)',
            border: '1px solid rgba(255, 92, 122, 0.3)',
            marginBottom: '16px'
          }}>
            <p style={{ fontSize: '13px', color: '#FF5C7A' }}>{error}</p>
          </div>
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
            }}
          >
            {verifying ? 'Verifying...' : 'Verify Ownership'}
          </button>
        )}

        {showStealthContinue && (
          <button
            onClick={() => void handleStealthContinue()}
            disabled={publishing}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: publishing ? 'rgba(124, 92, 255, 0.5)' : 'var(--accent-primary)',
              border: 'none',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: publishing ? 'not-allowed' : 'pointer',
            }}
          >
            {stealthContinueLabel}
          </button>
        )}

        {step === 'stream-config' && (
          <button
            onClick={() => void handleStart()}
            disabled={!title.trim() || !keysReady || starting}
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: title.trim() && keysReady && !starting ? 'var(--live)' : 'rgba(235, 4, 0, 0.5)',
              border: 'none',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: title.trim() && keysReady && !starting ? 'pointer' : 'not-allowed',
            }}
          >
            {starting ? 'Creating room…' : 'Start Streaming'}
          </button>
        )}
      </div>
    </ModalShell>
  );
}
