/**
 * ENS Ownership Verification Storage
 * Stores verified ENS bindings with signature proof
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ENSVerificationDB extends DBSchema {
  ensVerifications: {
    key: string; // wallet address (lowercase)
    value: {
      walletAddress: string;
      ensName: string;
      chainId: number;
      message: string;
      signature: string;
      verifiedAt: string;
    };
  };
}

let db: IDBPDatabase<ENSVerificationDB> | null = null;

async function initDB(): Promise<void> {
  if (db) return;

  db = await openDB<ENSVerificationDB>('stellarcast-ens', 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('ensVerifications')) {
        database.createObjectStore('ensVerifications');
      }
    },
  });
}

export interface ENSVerification {
  walletAddress: string;
  ensName: string;
  chainId: number;
  message: string;
  signature: string;
  verifiedAt: string;
}

/**
 * Store verified ENS binding
 */
export async function storeENSVerification(verification: ENSVerification): Promise<void> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const key = verification.walletAddress.toLowerCase();
  await db.put('ensVerifications', verification, key);
}

/**
 * Get verified ENS binding for wallet
 */
export async function getENSVerification(walletAddress: string): Promise<ENSVerification | null> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const key = walletAddress.toLowerCase();
  const verification = await db.get('ensVerifications', key);
  return verification || null;
}

/**
 * Clear ENS verification for wallet
 */
export async function clearENSVerification(walletAddress: string): Promise<void> {
  await initDB();
  if (!db) throw new Error('DB not initialized');

  const key = walletAddress.toLowerCase();
  await db.delete('ensVerifications', key);
}

/**
 * Check if wallet has verified ENS
 */
export async function hasVerifiedENS(walletAddress: string): Promise<boolean> {
  const verification = await getENSVerification(walletAddress);
  return !!verification;
}
