/**
 * Secure IndexedDB storage with encrypted key wrapping
 * Never stores private keys in plaintext (no localStorage/sessionStorage)
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { StealthIdentity } from '../types/stealth';

interface StealthDB extends DBSchema {
  identity: {
    key: string;
    value: {
      id: string;
      walletAddress: string;
      authNonce: string;
      authTimestamp: string;
      encryptedIdentity: ArrayBuffer;
      iv: ArrayBuffer;
      createdAt: number;
    };
  };
  sessions: {
    key: string;
    value: {
      id: string;
      peerEnsName: string;
      direction: 'sender' | 'recipient';
      encryptedData: ArrayBuffer;
      salt: ArrayBuffer;
      iv: ArrayBuffer;
      createdAt: number;
      completedAt?: number;
    };
  };
}

let db: IDBPDatabase<StealthDB> | null = null;

/**
 * Initialize IndexedDB
 */
export async function initDB(): Promise<void> {
  if (db) return;

  db = await openDB<StealthDB>('ens-stealth-messenger', 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('identity')) {
        database.createObjectStore('identity', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'id' });
      }
    },
  });
}

/**
 * Import encryption key derived from wallet signature
 */
async function importEncryptionKey(
  keyBytes: Uint8Array
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(keyBytes),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt StealthIdentity with wallet-derived key
 */
async function encryptIdentity(
  identity: StealthIdentity,
  encryptionKeyBytes: Uint8Array
): Promise<{ encrypted: ArrayBuffer; iv: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await importEncryptionKey(encryptionKeyBytes);

  const plaintext = new Uint8Array(
    identity.spendingPrivateKey.length +
      identity.viewingPrivateKey.length +
      identity.spendingPublicKey.length +
      identity.viewingPublicKey.length
  );

  let offset = 0;
  plaintext.set(identity.spendingPrivateKey, offset);
  offset += identity.spendingPrivateKey.length;
  plaintext.set(identity.viewingPrivateKey, offset);
  offset += identity.viewingPrivateKey.length;
  plaintext.set(identity.spendingPublicKey, offset);
  offset += identity.spendingPublicKey.length;
  plaintext.set(identity.viewingPublicKey, offset);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return { encrypted, iv: iv.buffer };
}

/**
 * Decrypt StealthIdentity with wallet-derived key
 */
async function decryptIdentity(
  encrypted: ArrayBuffer,
  iv: ArrayBuffer,
  encryptionKeyBytes: Uint8Array
): Promise<StealthIdentity | null> {
  try {
    const key = await importEncryptionKey(encryptionKeyBytes);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      encrypted
    );

    const bytes = new Uint8Array(plaintext);

    if (bytes.length !== 32 + 32 + 33 + 33) {
      return null;
    }

    let offset = 0;
    const spendingPrivateKey = bytes.slice(offset, offset + 32);
    offset += 32;
    const viewingPrivateKey = bytes.slice(offset, offset + 32);
    offset += 32;
    const spendingPublicKey = bytes.slice(offset, offset + 33);
    offset += 33;
    const viewingPublicKey = bytes.slice(offset, offset + 33);

    return {
      spendingPrivateKey,
      viewingPrivateKey,
      spendingPublicKey,
      viewingPublicKey,
    };
  } catch {
    return null;
  }
}

/**
 * Store wallet-bound encrypted identity
 */
export async function storeIdentity(
  identity: StealthIdentity,
  walletAddress: string,
  encryptionKey: Uint8Array,
  authNonce: string,
  authTimestamp: string
): Promise<void> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const { encrypted, iv } = await encryptIdentity(identity, encryptionKey);

  await db.put('identity', {
    id: 'primary',
    walletAddress: walletAddress.toLowerCase(),
    authNonce,
    authTimestamp,
    encryptedIdentity: encrypted,
    iv,
    createdAt: Date.now(),
  });
}

/**
 * Load wallet-bound encrypted identity
 */
export async function loadIdentity(
  walletAddress: string,
  encryptionKey: Uint8Array
): Promise<StealthIdentity | null> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const record = await db.get('identity', 'primary');
  if (!record) return null;

  // Verify wallet address matches
  if (record.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error('Identity is bound to a different wallet address');
  }

  return decryptIdentity(
    record.encryptedIdentity,
    record.iv,
    encryptionKey
  );
}

/**
 * Get stored auth info for re-authentication
 */
export async function getAuthInfo(): Promise<{
  walletAddress: string;
  authNonce: string;
  authTimestamp: string;
} | null> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const record = await db.get('identity', 'primary');
  if (!record) return null;

  return {
    walletAddress: record.walletAddress,
    authNonce: record.authNonce,
    authTimestamp: record.authTimestamp,
  };
}

/**
 * Check if identity exists
 */
export async function hasIdentity(): Promise<boolean> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const record = await db.get('identity', 'primary');
  return !!record;
}

/**
 * Delete identity (for demo reset)
 */
export async function deleteIdentity(): Promise<void> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  await db.delete('identity', 'primary');
}
