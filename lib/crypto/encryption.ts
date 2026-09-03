/**
 * HKDF key derivation and AES-GCM encryption
 * Domain-separated keys for signaling, no raw ECDH shared secrets as AES keys
 */

import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 as sha256Noble } from '@noble/hashes/sha2.js';
import { EncryptedPayload } from '../types/stealth';

const SIGNALING_INFO = new TextEncoder().encode('ens-erc5564-webrtc-signaling-v1');

/**
 * Derive signaling encryption key from shared secret using HKDF-SHA256
 * Domain-separated to prevent key reuse across contexts
 */
export function deriveSignalingKey(sharedSecret: Uint8Array): Uint8Array {
  return hkdf(sha256Noble, sharedSecret, undefined, SIGNALING_INFO, 32);
}

/**
 * Encrypt payload with AES-256-GCM
 * Uses crypto.getRandomValues for nonce (never reused)
 */
export async function encryptAESGCM(
  plaintext: Uint8Array,
  key: Uint8Array
): Promise<EncryptedPayload> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(key),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonce) },
    cryptoKey,
    new Uint8Array(plaintext)
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    nonce,
  };
}

/**
 * Decrypt payload with AES-256-GCM
 * Returns null if decryption fails (wrong key or tampering)
 */
export async function decryptAESGCM(
  encrypted: EncryptedPayload,
  key: Uint8Array
): Promise<Uint8Array | null> {
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(key),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encrypted.nonce) },
      cryptoKey,
      new Uint8Array(encrypted.ciphertext)
    );

    return new Uint8Array(plaintext);
  } catch {
    return null;
  }
}

/**
 * Encrypt JSON payload for signaling
 */
export async function encryptSignalingPayload(
  payload: unknown,
  sharedSecret: Uint8Array
): Promise<EncryptedPayload> {
  const key = deriveSignalingKey(sharedSecret);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  return encryptAESGCM(plaintext, key);
}

/**
 * Decrypt JSON payload from signaling
 */
export async function decryptSignalingPayload<T>(
  encrypted: EncryptedPayload,
  sharedSecret: Uint8Array
): Promise<T | null> {
  const key = deriveSignalingKey(sharedSecret);
  const plaintext = await decryptAESGCM(encrypted, key);

  if (!plaintext) {
    return null;
  }

  try {
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}
