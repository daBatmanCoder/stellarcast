/**
 * Core types for ERC-5564 stealth addresses and ERC-6538 meta-addresses
 */

export interface StealthIdentity {
  spendingPrivateKey: Uint8Array; // 32 bytes
  viewingPrivateKey: Uint8Array; // 32 bytes
  spendingPublicKey: Uint8Array; // 33 bytes compressed
  viewingPublicKey: Uint8Array; // 33 bytes compressed
}

export interface StealthMetaAddress {
  spendingPublicKey: Uint8Array; // 33 bytes compressed
  viewingPublicKey: Uint8Array; // 33 bytes compressed
  scheme: 1; // ERC-6538 scheme 1 (secp256k1)
}

export interface GeneratedStealthAddress {
  stealthAddress: Uint8Array; // 20 bytes Ethereum address
  ephemeralPublicKey: Uint8Array; // 33 bytes compressed
  viewTag: number; // 0-255 for fast scanning
  sharedSecret: Uint8Array; // 32 bytes
}

export interface OfferPayload {
  sdp: string; // WebRTC offer SDP
  replyMetaAddress: StealthMetaAddress; // Fresh B1 for answer
  timestamp: number;
}

export interface AnswerPayload {
  sdp: string; // WebRTC answer SDP
  timestamp: number;
}

export interface EncryptedPayload {
  ciphertext: Uint8Array;
  nonce: Uint8Array; // 12 bytes for AES-GCM
  ephemeralPublicKey?: Uint8Array; // For ECDH-based encryption
}

export interface Announcement {
  schemeId: bigint;
  stealthAddress: string; // hex address
  ephemeralPublicKey: string; // hex
  metadata: string; // hex-encoded encrypted payload
  viewTag: number;
  txHash: string;
  timestamp: number;
}
