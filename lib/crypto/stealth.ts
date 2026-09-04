/**
 * ERC-5564 scheme 1 stealth address derivation and scanning.
 * Matches stealthPoC / ENSIP: keccak256(compressed ECDH point), view tag = first hash byte.
 */

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { padHex, parseEther, toHex as viemToHex } from 'viem';
import {
  StealthMetaAddress,
  GeneratedStealthAddress,
  StealthIdentity,
} from '../types/stealth';

const SECP256K1_N = BigInt(
  '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'
);

export const NATIVE_ETH_SENTINEL = 'eeeeeeee';
export const NATIVE_ETH_PLACEHOLDER = 'EeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

function bytesToHexStr(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/** Compressed ECDH: 33-byte SEC1 point. */
function ecdhCompressed(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  const shared = secp256k1.getSharedSecret(privateKey, publicKey, true);
  if (shared.length === 33 && (shared[0] === 2 || shared[0] === 3)) {
    return shared;
  }
  return secp256k1.Point.fromBytes(shared).toBytes(true);
}

function hashSharedSecret(compressedPoint: Uint8Array): Uint8Array {
  return keccak_256(compressedPoint);
}

function hashedPointFromSecret(hashedSharedSecret: Uint8Array): Uint8Array {
  return secp256k1.getPublicKey(hashedSharedSecret, true);
}

function stealthUncompressed(
  spendingPublicKey: Uint8Array,
  hashedSharedSecret: Uint8Array
): Uint8Array {
  const spend = secp256k1.Point.fromBytes(spendingPublicKey);
  const hashed = secp256k1.Point.fromBytes(hashedPointFromSecret(hashedSharedSecret));
  return spend.add(hashed).toBytes(false);
}

function addressFromUncompressed(uncompressed: Uint8Array): Uint8Array {
  return keccak_256(uncompressed.slice(1)).slice(-20);
}

function scalarFromBytes(bytes: Uint8Array): bigint {
  return BigInt('0x' + bytesToHexStr(bytes));
}

function bigintTo32Bytes(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

/**
 * Sender: derive a one-time stealth address from the recipient meta-address.
 * sharedSecret is the 32-byte keccak256 hash (h), also used as the scan scalar.
 */
export function generateStealthAddress(
  recipientMeta: StealthMetaAddress
): GeneratedStealthAddress {
  const ephemeralPrivateKey = secp256k1.utils.randomSecretKey();
  const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, true);

  const compressedShared = ecdhCompressed(
    ephemeralPrivateKey,
    recipientMeta.viewingPublicKey
  );
  const hashedSharedSecret = hashSharedSecret(compressedShared);
  const viewTag = hashedSharedSecret[0];

  const stealthPublicKey = stealthUncompressed(
    recipientMeta.spendingPublicKey,
    hashedSharedSecret
  );
  const stealthAddress = addressFromUncompressed(stealthPublicKey);

  return {
    stealthAddress,
    ephemeralPublicKey,
    viewTag,
    sharedSecret: hashedSharedSecret,
  };
}

/**
 * Recipient: return hashed shared secret if this announcement belongs to identity.
 */
export function checkStealthAddress(
  identity: StealthIdentity,
  ephemeralPublicKey: Uint8Array,
  stealthAddress: Uint8Array,
  viewTag: number
): Uint8Array | null {
  const compressedShared = ecdhCompressed(identity.viewingPrivateKey, ephemeralPublicKey);
  const hashedSharedSecret = hashSharedSecret(compressedShared);

  if (hashedSharedSecret[0] !== viewTag) {
    return null;
  }

  const stealthPublicKey = stealthUncompressed(
    identity.spendingPublicKey,
    hashedSharedSecret
  );
  const computedAddress = addressFromUncompressed(stealthPublicKey);

  if (Buffer.compare(computedAddress, stealthAddress) === 0) {
    return hashedSharedSecret;
  }

  return null;
}

export function computeStealthPrivateKey(
  identity: StealthIdentity,
  sharedSecret: Uint8Array
): Uint8Array {
  const stealthScalar = scalarFromBytes(sharedSecret);
  const spendingScalar = scalarFromBytes(identity.spendingPrivateKey);
  const combined = (spendingScalar + stealthScalar) % SECP256K1_N;
  return bigintTo32Bytes(combined);
}

/** ERC-5564 native ETH metadata: viewTag || 0xeeeeeeee || placeholder || amount */
export function encodeNativeEthMetadata(viewTag: number, amountWei: bigint): `0x${string}` {
  const tag = viewTag.toString(16).padStart(2, '0').slice(-2);
  const amount = padHex(viemToHex(amountWei), { size: 32 }).slice(2);
  return `0x${tag}${NATIVE_ETH_SENTINEL}${NATIVE_ETH_PLACEHOLDER}${amount}`;
}

export function parseViewTagFromMetadata(metadata: string): number {
  const body = metadata.startsWith('0x') || metadata.startsWith('0X') ? metadata.slice(2) : metadata;
  if (body.length < 2) return 0;
  const tag = parseInt(body.slice(0, 2), 16);
  return Number.isFinite(tag) ? tag : 0;
}

export function entryPriceToWei(ethAmount: string): bigint {
  return parseEther(ethAmount);
}

/**
 * Round-trip generate → check → recover. Throws if scheme 1 math is broken.
 */
export function selfCheckStealth(identity: StealthIdentity, meta: StealthMetaAddress): void {
  const generated = generateStealthAddress(meta);
  const matched = checkStealthAddress(
    identity,
    generated.ephemeralPublicKey,
    generated.stealthAddress,
    generated.viewTag
  );
  if (!matched) {
    throw new Error('ERC-5564 self-check failed: checkStealthAddress');
  }
  const stealthKey = computeStealthPrivateKey(identity, matched);
  const derivedUncompressed = secp256k1.getPublicKey(stealthKey, false);
  const derivedAddress = addressFromUncompressed(derivedUncompressed);
  if (Buffer.compare(derivedAddress, generated.stealthAddress) !== 0) {
    throw new Error('ERC-5564 self-check failed: recover');
  }
}
