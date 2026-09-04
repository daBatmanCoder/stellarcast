'use client';

import { useState, useEffect, useRef } from 'react';
import { ModalShell } from './ModalShell';
import { resolveSepoliaENS, getStealthMetaSlots } from '@/lib/ens/resolver';
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
import {
  authenticateWithWallet,
  reauthenticateWithWallet,
} from '@/lib/wallet/wallet-auth';
import {
  storeIdentity,
  loadIdentity,
  getAuthInfo,
  getSessionWrapKey,
  setSessionWrapKey,
} from '@/lib/storage/identity-store';

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

type KeysMode = 'unknown' | 'matched' | 'need-keys' | 'create';
type NeedKeysChoice = 'ask' | 'import' | 'lost';

interface GoLiveModalProps {
  isOpen: boolean;
  ensName: string;
  metaAddress: string;
  walletAddress: string;
  identity: StealthIdentity | null;
  isConnecting?: boolean;
  onConnectWallet: () => Promise<boolean>;
  onClose: () => void;
  onStartStream: (title: string, category: string, ensName: string) => void | Promise<void>;
  onEnsResolved?: (ensName: string) => void | Promise<void>;
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
  isConnecting = false,
  onConnectWallet,
  onClose,
  onStartStream,
  onEnsResolved,
  onKeysUpdated,
}: GoLiveModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Science & Technology');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [ensInput, setEnsInput] = useState(ensName);
  const [stealthMetaAddress, setStealthMetaAddress] = useState(metaAddress);
  const [ensMeta, setEnsMeta] = useState<StealthMetaAddress | null>(null);
  const [keysMode, setKeysMode] = useState<KeysMode>('unknown');
  const [needKeysChoice, setNeedKeysChoice] = useState<NeedKeysChoice>('ask');
  const [keysReady, setKeysReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!isOpen) return;
    setEnsInput(ensName);
    setStealthMetaAddress(metaAddress);
    setError('');
    setNeedKeysChoice('ask');
    setStarting(false);
    setTitle('');
  }, [isOpen, ensName, metaAddress]);

  useEffect(() => {
    if (!isOpen || !walletAddress) return;
    const name = (ensInput || ensName).trim();
    if (!name) {
      setKeysMode('unknown');
      setKeysReady(!!identity);
      return;
    }
    let cancelled = false;
    const prefetch = async () => {
      try {
        const slots = await getStealthMetaSlots(name);
        if (cancelled) return;
        applySlotResult(slots, identity);
      } catch {
        if (!cancelled) {
          setKeysMode(identity ? 'create' : 'unknown');
          setKeysReady(!!identity);
        }
      }
    };
    void prefetch();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, walletAddress, ensName, identity]);

  const applySlotResult = (
    slots: Array<{ slot: number; value: string }>,
    currentIdentity: StealthIdentity | null
  ) => {
    const slot1 = slots.find((s) => s.slot === 1) || slots[0];
    if (!slot1) {
      setEnsMeta(null);
      setKeysMode('create');
      setKeysReady(true);
      if (currentIdentity) {
        setStealthMetaAddress(encodeMetaAddress(identityToMetaAddress(currentIdentity)));
      }
      return;
    }

    const parsed = tryDecodeMetaAddress(slot1.value);
    setEnsMeta(parsed);
    setStealthMetaAddress(slot1.value);

    if (currentIdentity && parsed && identityMatchesMeta(currentIdentity, parsed)) {
      setKeysMode('matched');
      setKeysReady(true);
      return;
    }

    setKeysMode('need-keys');
    setNeedKeysChoice('ask');
    setKeysReady(false);
  };

  const persistIdentity = async (next: StealthIdentity) => {
    let wrap = getSessionWrapKey();
    const auth = await getAuthInfo();
    const sameWallet = !!auth && auth.walletAddress.toLowerCase() === walletAddress.toLowerCase();

    if (wrap && auth && sameWallet) {
      await storeIdentity(next, walletAddress, wrap, auth.authNonce, auth.authTimestamp);
    } else if (auth && sameWallet) {
      wrap = await reauthenticateWithWallet(walletAddress, auth.authNonce, auth.authTimestamp);
      setSessionWrapKey(wrap);
      await storeIdentity(next, walletAddress, wrap, auth.authNonce, auth.authTimestamp);
    } else {
      const { encryptionKey, nonce } = await authenticateWithWallet(walletAddress);
      setSessionWrapKey(encryptionKey);
      await storeIdentity(next, walletAddress, encryptionKey, nonce, new Date().toISOString());
    }

    const encoded = encodeMetaAddress(identityToMetaAddress(next));
    await onKeysUpdated(next, encoded);
    return encoded;
  };

  const unlockStoredIdentity = async (): Promise<StealthIdentity | null> => {
    if (identity) return identity;
    const auth = await getAuthInfo();
    if (!auth || auth.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return null;
    }
    const wrap = getSessionWrapKey()
      ?? await reauthenticateWithWallet(walletAddress, auth.authNonce, auth.authTimestamp);
    setSessionWrapKey(wrap);
    const loaded = await loadIdentity(walletAddress, wrap);
    if (loaded) {
      await onKeysUpdated(loaded, encodeMetaAddress(identityToMetaAddress(loaded)));
    }
    return loaded;
  };

  const handleDownloadRecipient = (id: StealthIdentity | null, name: string) => {
    if (!id) return;
    downloadJson(`${name || 'host'}-recipient.json`, serializeRecipientJson(id, name));
  };

  const handleImportFile = async (file: File) => {
    setError('');
    try {
      const text = await file.text();
      const imported = importIdentityFromRecipientJson(JSON.parse(text), ensMeta);
      await persistIdentity(imported);
      setStealthMetaAddress(encodeMetaAddress(identityToMetaAddress(imported)));
      setKeysReady(true);
      setKeysMode('matched');
    } catch (err) {
      setKeysReady(false);
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const resolveOwnedEns = async (address: string, name: string) => {
    const resolvedAddress = await resolveSepoliaENS(name);
    if (!resolvedAddress) {
      throw new Error(`ENS name "${name}" not found on Sepolia`);
    }
    if (resolvedAddress.toLowerCase() !== address.toLowerCase()) {
      throw new Error(`You don't own ${name}. Resolved to ${resolvedAddress.slice(0, 10)}...`);
    }
    await onEnsResolved?.(name);
    const slots = await getStealthMetaSlots(name);
    applySlotResult(slots, identity);
    return slots;
  };

  const handleStart = async () => {
    if (!title.trim()) return;
    setStarting(true);
    setError('');

    try {
      let address = walletAddress;
      if (!address) {
        const ok = await onConnectWallet();
        if (!ok) {
          throw new Error('Connect your wallet to go live');
        }
        const accounts = typeof window !== 'undefined' && window.ethereum
          ? await window.ethereum.request({ method: 'eth_accounts' }) as string[]
          : [];
        address = accounts[0] || walletAddress;
        if (!address) {
          throw new Error('Wallet connected but no address yet. Try Go Live again.');
        }
      }

      const name = ensInput.trim();
      if (!name) {
        throw new Error('Enter your ENS name (e.g. you.eth)');
      }

      const slots = await resolveOwnedEns(address, name);
      const slot1 = slots.find((s) => s.slot === 1) || slots[0];
      const recorded = slot1 ? tryDecodeMetaAddress(slot1.value) : null;

      let sessionIdentity = identity ?? await unlockStoredIdentity();

      if (recorded) {
        if (sessionIdentity && identityMatchesMeta(sessionIdentity, recorded)) {
          setKeysReady(true);
        } else if (keysReady && identity && identityMatchesMeta(identity, recorded)) {
          sessionIdentity = identity;
        } else if (needKeysChoice === 'lost') {
          sessionIdentity = generateStealthIdentity();
          await persistIdentity(sessionIdentity);
          handleDownloadRecipient(sessionIdentity, name);
          await registerReceivingMetaAddress(address, sessionIdentity, {
            ensName: name,
            targetSlot: 1,
          });
        } else {
          throw new Error('This ENS already has payment keys. Import recipient.json, or choose to generate new keys.');
        }
      } else {
        if (!sessionIdentity) {
          sessionIdentity = generateStealthIdentity();
        }
        await persistIdentity(sessionIdentity);
        handleDownloadRecipient(sessionIdentity, name);
        await registerReceivingMetaAddress(address, sessionIdentity, {
          ensName: name,
          targetSlot: 1,
        });
      }

      await onStartStream(title.trim(), category, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setStarting(false);
    }
  };

  const primaryDisabled =
    starting ||
    isConnecting ||
    (!walletAddress && isConnecting) ||
    (walletAddress && !title.trim()) ||
    (keysMode === 'need-keys' && !keysReady && needKeysChoice !== 'lost');

  const primaryLabel = !walletAddress
    ? isConnecting
      ? 'Connecting…'
      : 'Connect wallet'
    : starting
      ? keysMode === 'create'
        ? 'Publishing keys and creating room…'
        : keysMode === 'need-keys' && needKeysChoice === 'lost'
          ? 'Overwriting keys and creating room…'
          : 'Creating room…'
      : 'Go Live';

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} allowOverlayClose={!starting} mobileBottomSheet={true}>
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
        disabled={starting}
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
          cursor: starting ? 'not-allowed' : 'pointer',
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
          Go Live
        </h2>
        <p style={{
          fontSize: '14px',
          lineHeight: '20px',
          color: 'rgba(255, 255, 255, 0.64)'
        }}>
          {walletAddress
            ? 'Name the room. Viewers pay your ENS stealth address.'
            : 'Connect your wallet, then create the room.'}
        </p>
      </div>

      <div style={{ padding: '20px 24px 0' }}>
        {walletAddress && (
          <p style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.48)',
            fontFamily: 'monospace',
            marginBottom: '16px'
          }}>
            {walletAddress}
          </p>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.88)',
            marginBottom: '8px'
          }}>
            ENS name
          </label>
          <input
            type="text"
            value={ensInput}
            onChange={(e) => setEnsInput(e.target.value)}
            placeholder="you.eth"
            disabled={!walletAddress || starting}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 600,
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
            Stream title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you streaming?"
            disabled={!walletAddress || starting}
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
            disabled={!walletAddress || starting}
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

        <div style={{
          padding: '12px',
          borderRadius: '12px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          marginBottom: '16px'
        }}>
          <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>0.001 ETH entry</p>
          <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.48)', marginTop: '6px' }}>
            Viewers pay a one-time stealth address from stealth-meta-address[1].
          </p>
        </div>

        {keysMode === 'matched' && (
          <p style={{ fontSize: '12px', color: 'var(--success)', marginBottom: '16px' }}>
            Payment keys already match this ENS.
          </p>
        )}

        {keysMode === 'create' && walletAddress && (
          <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.64)', marginBottom: '16px', lineHeight: '18px' }}>
            Go Live will publish payment keys to your ENS and download recipient.json. That file is the only backup.
          </p>
        )}

        {keysMode === 'need-keys' && (
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 185, 0, 0.1)',
            border: '1px solid rgba(255, 185, 0, 0.3)',
            marginBottom: '16px'
          }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#FFB900', marginBottom: '8px' }}>
              This ENS already has payment keys
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.64)', lineHeight: '18px', marginBottom: '12px' }}>
              Import the matching recipient.json, or generate new keys and overwrite the record.
            </p>

            {needKeysChoice === 'ask' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setNeedKeysChoice('import'); setError(''); }}
                  style={{
                    width: '100%',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--accent-primary)',
                    border: 'none',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  I have recipient.json
                </button>
                <button
                  type="button"
                  onClick={() => { setNeedKeysChoice('lost'); setError(''); }}
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'rgba(255, 255, 255, 0.72)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Generate new keys
                </button>
              </div>
            )}

            {needKeysChoice === 'import' && (
              <>
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
              </>
            )}

            {needKeysChoice === 'lost' && (
              <p style={{ fontSize: '12px', color: '#FF5C7A', lineHeight: '18px' }}>
                New keys overwrite stealth-meta-address[1]. Payments already sent to the old keys cannot be scanned here.
              </p>
            )}
          </div>
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
        <button
          onClick={() => {
            if (!walletAddress) {
              void onConnectWallet();
              return;
            }
            void handleStart();
          }}
          disabled={primaryDisabled}
          style={{
            width: '100%',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: primaryDisabled ? 'rgba(235, 4, 0, 0.5)' : 'var(--live)',
            border: 'none',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: primaryDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {primaryLabel}
        </button>
      </div>
    </ModalShell>
  );
}
