/**
 * Demo Host Meta-Addresses
 * Deterministic generation of stealth meta-addresses for demo seed hosts
 */

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 as sha256Noble } from '@noble/hashes/sha2.js';
import type { StealthMetaAddress } from '@/lib/types/stealth';

/**
 * Generate deterministic demo meta-address for a host address
 * Uses host address as seed for reproducible keys
 */
export function generateDemoHostMetaAddress(hostAddress: string): StealthMetaAddress {
  // Hash the host address to get deterministic seed
  const seed = sha256Noble(new TextEncoder().encode(`DEMO_HOST_META:${hostAddress.toLowerCase()}`));
  
  // Derive spending key from first 32 bytes
  const spendingSeed = seed.slice(0, 32);
  const spendingPublicKey = secp256k1.getPublicKey(spendingSeed, true);
  
  // Derive viewing key from hash of spending key with salt
  const viewingSeed = sha256Noble(new Uint8Array([...seed, 1]));
  const viewingPublicKey = secp256k1.getPublicKey(viewingSeed, true);
  
  return {
    spendingPublicKey,
    viewingPublicKey,
    scheme: 1 as const
  };
}

/**
 * Cache of demo host meta-addresses
 */
const demoHostMetaCache = new Map<string, StealthMetaAddress>();

/**
 * Get or generate demo host meta-address
 */
export function getDemoHostMetaAddress(hostAddress: string): StealthMetaAddress {
  const key = hostAddress.toLowerCase();
  
  if (!demoHostMetaCache.has(key)) {
    demoHostMetaCache.set(key, generateDemoHostMetaAddress(hostAddress));
  }
  
  return demoHostMetaCache.get(key)!;
}
