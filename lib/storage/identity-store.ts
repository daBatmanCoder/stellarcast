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
      encryptedIdentity: ArrayBuffer;
      salt: ArrayBuffer;
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
 * Derive encryption key from password using PBKDF2
 * Uses 600,000 iterations (OWASP 2023 recommendation for PBKDF2-SHA256)
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: 600_000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt StealthIdentity with password
 */
async function encryptIdentity(
  identity: StealthIdentity,
  password: string
): Promise<{ encrypted: ArrayBuffer; salt: ArrayBuffer; iv: ArrayBuffer }> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKeyFromPassword(password, salt);

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

  return { encrypted, salt: salt.buffer, iv: iv.buffer };
}

/**
 * Decrypt StealthIdentity with password
 */
async function decryptIdentity(
  encrypted: ArrayBuffer,
  salt: ArrayBuffer,
  iv: ArrayBuffer,
  password: string
): Promise<StealthIdentity | null> {
  try {
    const key = await deriveKeyFromPassword(password, new Uint8Array(salt));

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
 * Store encrypted identity
 */
export async function storeIdentity(
  identity: StealthIdentity,
  password: string
): Promise<void> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const { encrypted, salt, iv } = await encryptIdentity(identity, password);

  await db.put('identity', {
    id: 'primary',
    encryptedIdentity: encrypted,
    salt,
    iv,
    createdAt: Date.now(),
  });
}

/**
 * Load encrypted identity
 */
export async function loadIdentity(
  password: string
): Promise<StealthIdentity | null> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const record = await db.get('identity', 'primary');
  if (!record) return null;

  return decryptIdentity(
    record.encryptedIdentity,
    record.salt,
    record.iv,
    password
  );
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
