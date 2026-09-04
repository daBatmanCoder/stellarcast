/**
 * Room access encryption for StellaCast NFT rooms
 * Encrypts room credentials and packages them as Solidity-compatible bytes
 */

import { type Hex } from 'viem';
import { encryptAESGCM, decryptAESGCM } from './encryption';
import type { EncryptedPayload } from '../types/stealth';

/**
 * Derive room access encryption key from shared secret
 * Uses first 32 bytes of shared secret as AES-256 key
 */
export function deriveRoomAccessKey(sharedSecret: Uint8Array): Uint8Array {
  // Use the shared secret directly as AES key (already 32 bytes from ECDH)
  if (sharedSecret.length < 32) {
    throw new Error('Shared secret must be at least 32 bytes');
  }
  return sharedSecret.slice(0, 32);
}

/**
 * Encrypt room access credential
 * @param credential - Room password/credential to encrypt
 * @param sharedSecret - ECDH shared secret between host and viewer
 * @returns Encrypted payload (ciphertext + nonce)
 */
export async function encryptRoomAccess(
  credential: string,
  sharedSecret: Uint8Array
): Promise<EncryptedPayload> {
  const key = deriveRoomAccessKey(sharedSecret);
  const plaintext = new TextEncoder().encode(credential);
  return encryptAESGCM(plaintext, key);
}

/**
 * Decrypt room access credential
 * @param encrypted - Encrypted payload
 * @param sharedSecret - ECDH shared secret
 * @returns Decrypted credential or null if decryption fails
 */
export async function decryptRoomAccess(
  encrypted: EncryptedPayload,
  sharedSecret: Uint8Array
): Promise<string | null> {
  const key = deriveRoomAccessKey(sharedSecret);
  const plaintext = await decryptAESGCM(encrypted, key);
  
  if (!plaintext) {
    return null;
  }
  
  return new TextDecoder().decode(plaintext);
}

/**
 * Package encrypted room access data as Solidity bytes
 * Format: 0x<nonce_hex><ciphertext_hex>
 * 
 * CRITICAL: This concatenates iv||ciphertext as continuous hex bytes.
 * DO NOT use colon-separated format like "0xAAA:0xBBB" - that's invalid for Solidity bytes!
 * 
 * @param encrypted - Encrypted payload with nonce and ciphertext
 * @returns Hex string compatible with Solidity bytes parameter
 */
export function packageEncryptedData(encrypted: EncryptedPayload): Hex {
  const nonceHex = Buffer.from(encrypted.nonce).toString('hex');
  const ciphertextHex = Buffer.from(encrypted.ciphertext).toString('hex');
  
  // Concatenate as continuous hex: iv || ciphertext
  return `0x${nonceHex}${ciphertextHex}` as Hex;
}

/**
 * Unpack encrypted room access data from Solidity bytes
 * Format: 0x<nonce_hex><ciphertext_hex>
 * 
 * Nonce is always 12 bytes (24 hex chars) for AES-GCM
 * 
 * @param packed - Hex string from contract storage
 * @returns Encrypted payload or null if invalid format
 */
export function unpackEncryptedData(packed: Hex | string): EncryptedPayload | null {
  try {
    // Remove 0x prefix if present
    const hex = packed.startsWith('0x') ? packed.slice(2) : packed;
    
    // Validate minimum length: 12 bytes nonce + at least 1 byte ciphertext = 26 hex chars
    if (hex.length < 26) {
      return null;
    }
    
    // Extract nonce (first 12 bytes = 24 hex chars)
    const nonceHex = hex.slice(0, 24);
    const ciphertextHex = hex.slice(24);
    
    return {
      nonce: Buffer.from(nonceHex, 'hex'),
      ciphertext: Buffer.from(ciphertextHex, 'hex'),
    };
  } catch {
    return null;
  }
}

/**
 * Full flow: encrypt credential and package for contract storage
 */
export async function encryptAndPackageRoomAccess(
  credential: string,
  sharedSecret: Uint8Array
): Promise<Hex> {
  const encrypted = await encryptRoomAccess(credential, sharedSecret);
  return packageEncryptedData(encrypted);
}

/**
 * Full flow: unpack from contract and decrypt credential
 */
export async function unpackAndDecryptRoomAccess(
  packed: Hex | string,
  sharedSecret: Uint8Array
): Promise<string | null> {
  const encrypted = unpackEncryptedData(packed);
  if (!encrypted) {
    return null;
  }
  
  return decryptRoomAccess(encrypted, sharedSecret);
}
