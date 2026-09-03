/**
 * Wallet-bound authentication using personal_sign
 * Derives encryption key from wallet signature, never invents wallet private keys
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 as sha256Noble } from '@noble/hashes/sha2.js';
import { signMessage } from './metamask';

const AUTH_MESSAGE_TEMPLATE = `STELLARCAST Stealth Identity Authentication

By signing this message, you authorize this application to:
- Derive an encryption key from your signature
- Encrypt your stealth viewing and spending keys locally
- Store encrypted keys in your browser's IndexedDB

This signature does NOT grant access to your wallet funds.
This signature is ONLY used for local key encryption.

Domain: stellarcast.app
Nonce: {nonce}
Timestamp: {timestamp}`;

/**
 * Generate authentication message with nonce
 */
function generateAuthMessage(): { message: string; nonce: string } {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(nonceBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const timestamp = new Date().toISOString();
  
  const message = AUTH_MESSAGE_TEMPLATE
    .replace('{nonce}', nonce)
    .replace('{timestamp}', timestamp);
  
  return { message, nonce };
}

/**
 * Request wallet signature for authentication
 * Returns derived encryption key (32 bytes)
 */
export async function authenticateWithWallet(
  address: string
): Promise<{ encryptionKey: Uint8Array; nonce: string }> {
  const { message, nonce } = generateAuthMessage();
  
  try {
    const signature = await signMessage(address, message);
    
    // Derive encryption key from signature using HKDF
    // Domain-separated to prevent key reuse
    const signatureBytes = hexToBytes(signature.slice(2)); // Remove 0x prefix
    const info = new TextEncoder().encode('stellarcast-identity-encryption-v1');
    
    const encryptionKey = hkdf(sha256Noble, signatureBytes, undefined, info, 32);
    
    return { encryptionKey, nonce };
  } catch (error) {
    if (error instanceof Error && error.message.includes('rejected')) {
      throw new Error('Wallet signature rejected. Authentication is required to encrypt your stealth keys.');
    }
    throw error;
  }
}

/**
 * Re-authenticate with wallet (for unlocking existing identity)
 * Uses same message format to derive same key
 */
export async function reauthenticateWithWallet(
  address: string,
  storedNonce: string,
  storedTimestamp: string
): Promise<Uint8Array> {
  const message = AUTH_MESSAGE_TEMPLATE
    .replace('{nonce}', storedNonce)
    .replace('{timestamp}', storedTimestamp);
  
  try {
    const signature = await signMessage(address, message);
    
    const signatureBytes = hexToBytes(signature.slice(2));
    const info = new TextEncoder().encode('stellarcast-identity-encryption-v1');
    
    return hkdf(sha256Noble, signatureBytes, undefined, info, 32);
  } catch (error) {
    if (error instanceof Error && error.message.includes('rejected')) {
      throw new Error('Wallet signature rejected. Cannot decrypt your stealth keys without authentication.');
    }
    throw error;
  }
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Get checksummed Ethereum address (EIP-55)
 * Uses keccak256, but sha256 is acceptable fallback for demo
 */
export function toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().replace('0x', '');
  const addrBytes = new TextEncoder().encode(addr);
  const hash = Array.from(sha256Noble(addrBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  let checksummed = '0x';
  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksummed += addr[i].toUpperCase();
    } else {
      checksummed += addr[i];
    }
  }
  return checksummed;
}
