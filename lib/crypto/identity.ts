/**
 * Stealth identity generation and ENS URI encoding (st:eth:0x + 132 hex).
 */

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { StealthIdentity, StealthMetaAddress } from '../types/stealth';

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function parseHexBytes(value: unknown, byteLength: number, label: string): Uint8Array {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a hex string`);
  }
  let hex = value.trim().toLowerCase();
  if (hex.startsWith('0x')) hex = hex.slice(2);
  if (!/^[0-9a-f]+$/.test(hex)) {
    throw new Error(`${label} is not hex`);
  }
  if (hex.length !== byteLength * 2) {
    throw new Error(`${label} must be ${byteLength} bytes`);
  }
  return Buffer.from(hex, 'hex');
}

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

export function identityToMetaAddress(identity: StealthIdentity): StealthMetaAddress {
  return {
    spendingPublicKey: identity.spendingPublicKey,
    viewingPublicKey: identity.viewingPublicKey,
    scheme: 1,
  };
}

/** ENS / ERC-5564 URI: st:eth:0x + compressed spend (33) + compressed view (33). */
export function encodeMetaAddress(meta: StealthMetaAddress): string {
  return `st:eth:0x${toHex(meta.spendingPublicKey)}${toHex(meta.viewingPublicKey)}`;
}

/**
 * Decode st:eth:0x… or raw hex. Accepts legacy scheme-nibble (01 + 132 hex).
 */
export function decodeMetaAddress(encoded: string): StealthMetaAddress {
  const raw = encoded.trim();
  let hexBody: string;

  if (raw.startsWith('st:')) {
    const parts = raw.split(':');
    if (parts.length !== 3 || parts[0] !== 'st' || !parts[2]) {
      throw new Error('Invalid stealth meta-address URI. Expected st:eth:0x<spend><view>');
    }
    hexBody = parts[2].startsWith('0x') || parts[2].startsWith('0X') ? parts[2].slice(2) : parts[2];
  } else {
    hexBody = raw.startsWith('0x') || raw.startsWith('0X') ? raw.slice(2) : raw;
  }

  hexBody = hexBody.toLowerCase();
  if (hexBody.length === 134 && hexBody.startsWith('01')) {
    hexBody = hexBody.slice(2);
  }

  if (hexBody.length !== 132) {
    throw new Error(`Invalid stealth meta-address length: ${hexBody.length}`);
  }

  return {
    spendingPublicKey: Buffer.from(hexBody.slice(0, 66), 'hex'),
    viewingPublicKey: Buffer.from(hexBody.slice(66, 132), 'hex'),
    scheme: 1,
  };
}

export function tryDecodeMetaAddress(encoded: string | null | undefined): StealthMetaAddress | null {
  if (!encoded) return null;
  try {
    return decodeMetaAddress(encoded);
  } catch {
    return null;
  }
}

export function identityMatchesMeta(identity: StealthIdentity, meta: StealthMetaAddress): boolean {
  return (
    toHex(identity.spendingPublicKey) === toHex(meta.spendingPublicKey) &&
    toHex(identity.viewingPublicKey) === toHex(meta.viewingPublicKey)
  );
}

export interface RecipientJson {
  spendingPrivateKey: string;
  viewingPrivateKey: string;
  spendingPublicKey?: string;
  viewingPublicKey?: string;
  stealthMetaAddress?: string;
  ens?: string;
  schemeId?: number;
  chainId?: number;
}

export function serializeRecipientJson(identity: StealthIdentity, ens?: string): RecipientJson {
  const meta = identityToMetaAddress(identity);
  return {
    spendingPrivateKey: `0x${toHex(identity.spendingPrivateKey)}`,
    viewingPrivateKey: `0x${toHex(identity.viewingPrivateKey)}`,
    spendingPublicKey: `0x${toHex(identity.spendingPublicKey)}`,
    viewingPublicKey: `0x${toHex(identity.viewingPublicKey)}`,
    stealthMetaAddress: encodeMetaAddress(meta),
    ens,
    schemeId: 1,
    chainId: 11155111,
  };
}

/**
 * Import stealthPoC / Stellarcast recipient.json.
 * Recomputes pubkeys from private keys. If expected meta is given, they must match.
 */
export function importIdentityFromRecipientJson(
  raw: unknown,
  expectedMeta?: StealthMetaAddress | null
): StealthIdentity {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object') {
    throw new Error('recipient.json must be a JSON object');
  }

  const record = data as Record<string, unknown>;
  const spendingPrivateKey = parseHexBytes(record.spendingPrivateKey, 32, 'spendingPrivateKey');
  const viewingPrivateKey = parseHexBytes(record.viewingPrivateKey, 32, 'viewingPrivateKey');

  const spendingPublicKey = secp256k1.getPublicKey(spendingPrivateKey, true);
  const viewingPublicKey = secp256k1.getPublicKey(viewingPrivateKey, true);

  const identity: StealthIdentity = {
    spendingPrivateKey,
    viewingPrivateKey,
    spendingPublicKey,
    viewingPublicKey,
  };

  if (record.stealthMetaAddress && typeof record.stealthMetaAddress === 'string') {
    const fileMeta = decodeMetaAddress(record.stealthMetaAddress);
    if (!identityMatchesMeta(identity, fileMeta)) {
      throw new Error('recipient.json public meta-address does not match the private keys');
    }
  }

  if (expectedMeta && !identityMatchesMeta(identity, expectedMeta)) {
    throw new Error(
      'These keys do not match stealth-meta-address[1] on this ENS name. Refusing import.'
    );
  }

  return identity;
}
