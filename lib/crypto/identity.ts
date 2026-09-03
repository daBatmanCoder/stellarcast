/**
 * Stealth identity generation using secp256k1
 * Implements cryptographically secure key generation with @noble/curves
 */

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { StealthIdentity, StealthMetaAddress } from '../types/stealth';

/**
 * Generate a new stealth identity with independent spending and viewing keys
 * Uses crypto.getRandomValues for secure randomness (never Math.random)
 */
export function generateStealthIdentity(): StealthIdentity {
  const spendingPrivateKey = secp256k1.utils.randomSecretKey();
  const viewingPrivateKey = secp256k1.utils.randomSecretKey();

  const spendingPublicKey = secp256k1.getPublicKey(spendingPrivateKey, true);
  const viewingPublicKey = secp256k1.getPublicKey(viewingPrivateKey, true);

  return {
    spendingPrivateKey,
    viewingPrivateKey,
    spendingPublicKey,
    viewingPublicKey,
  };
}

/**
 * Convert StealthIdentity to StealthMetaAddress (public info only)
 */
export function identityToMetaAddress(
  identity: StealthIdentity
): StealthMetaAddress {
  return {
    spendingPublicKey: identity.spendingPublicKey,
    viewingPublicKey: identity.viewingPublicKey,
    scheme: 1,
  };
}

/**
 * Encode StealthMetaAddress as st:eth:0x... format per ERC-6538
 */
export function encodeMetaAddress(meta: StealthMetaAddress): string {
  const spendHex = Buffer.from(meta.spendingPublicKey).toString('hex');
  const viewHex = Buffer.from(meta.viewingPublicKey).toString('hex');
  return `st:eth:0x${meta.scheme.toString(16).padStart(2, '0')}${spendHex}${viewHex}`;
}

/**
 * Decode ERC-6538 meta-address string
 */
export function decodeMetaAddress(encoded: string): StealthMetaAddress {
  if (!encoded.startsWith('st:eth:0x')) {
    throw new Error('Invalid meta-address format');
  }

  const hex = encoded.slice(9);
  if (hex.length !== 2 + 66 + 66) {
    throw new Error('Invalid meta-address length');
  }

  const scheme = parseInt(hex.slice(0, 2), 16);
  if (scheme !== 1) {
    throw new Error(`Unsupported scheme: ${scheme}`);
  }

  const spendingPublicKey = Buffer.from(hex.slice(2, 68), 'hex');
  const viewingPublicKey = Buffer.from(hex.slice(68), 'hex');

  return {
    spendingPublicKey,
    viewingPublicKey,
    scheme: 1,
  };
}
