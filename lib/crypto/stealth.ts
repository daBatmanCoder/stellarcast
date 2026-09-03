/**
 * ERC-5564 stealth address derivation and scanning
 * Implements ECDH shared secret, view tags, and stealth address generation
 */

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 as sha256Noble } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import {
  StealthMetaAddress,
  GeneratedStealthAddress,
  StealthIdentity,
} from '../types/stealth';

/**
 * Generate stealth address for recipient (sender side)
 * Returns stealth address, ephemeral public key, view tag, and shared secret
 */
export function generateStealthAddress(
  recipientMeta: StealthMetaAddress
): GeneratedStealthAddress {
  const ephemeralPrivateKey = secp256k1.utils.randomSecretKey();
  const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, true);

  const sharedPoint = secp256k1.getSharedSecret(
    ephemeralPrivateKey,
    recipientMeta.viewingPublicKey
  );
  const sharedSecret = sha256Noble(sharedPoint.slice(1));

  const viewTag = sharedSecret[0];

  const stealthPrivateKeyScalar = BigInt('0x' + Buffer.from(sharedSecret).toString('hex'));
  
  const hashPoint = secp256k1.ProjectivePoint.BASE.multiply(stealthPrivateKeyScalar);
  const spendingPoint = secp256k1.ProjectivePoint.fromHex(recipientMeta.spendingPublicKey);
  const stealthPoint = spendingPoint.add(hashPoint);
  
  const stealthPublicKey = stealthPoint.toRawBytes(true);

  const publicKeyHash = keccak_256(stealthPublicKey.slice(1));
  const stealthAddress = publicKeyHash.slice(-20);

  return {
    stealthAddress,
    ephemeralPublicKey,
    viewTag,
    sharedSecret,
  };
}

/**
 * Check if announcement is for recipient (recipient side)
 * Returns shared secret if match, null otherwise
 */
export function checkStealthAddress(
  identity: StealthIdentity,
  ephemeralPublicKey: Uint8Array,
  stealthAddress: Uint8Array,
  viewTag: number
): Uint8Array | null {
  const sharedPoint = secp256k1.getSharedSecret(
    identity.viewingPrivateKey,
    ephemeralPublicKey
  );
  const sharedSecret = sha256Noble(sharedPoint.slice(1));

  if (sharedSecret[0] !== viewTag) {
    return null;
  }

  const stealthPrivateKeyScalar = BigInt('0x' + Buffer.from(sharedSecret).toString('hex'));
  const hashPoint = secp256k1.ProjectivePoint.BASE.multiply(stealthPrivateKeyScalar);
  const spendingPoint = secp256k1.ProjectivePoint.fromHex(identity.spendingPublicKey);
  const stealthPoint = spendingPoint.add(hashPoint);
  const stealthPublicKey = stealthPoint.toRawBytes(true);

  const publicKeyHash = keccak_256(stealthPublicKey.slice(1));
  const computedAddress = publicKeyHash.slice(-20);

  if (Buffer.compare(computedAddress, stealthAddress) === 0) {
    return sharedSecret;
  }

  return null;
}

/**
 * Compute stealth private key from identity and shared secret (recipient side)
 */
export function computeStealthPrivateKey(
  identity: StealthIdentity,
  sharedSecret: Uint8Array
): Uint8Array {
  const stealthPrivateKeyScalar = BigInt('0x' + Buffer.from(sharedSecret).toString('hex'));
  const spendingScalar = BigInt('0x' + Buffer.from(identity.spendingPrivateKey).toString('hex'));

  const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const combinedScalar = (spendingScalar + stealthPrivateKeyScalar) % n;

  const privateKeyBytes = new Uint8Array(32);
  const hex = combinedScalar.toString(16).padStart(64, '0');
  for (let i = 0; i < 32; i++) {
    privateKeyBytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return privateKeyBytes;
}
