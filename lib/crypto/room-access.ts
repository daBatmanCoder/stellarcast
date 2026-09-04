/**
 * Room Access Encryption/Decryption
 * 
 * Flow:
 * 1. Host creates room → generates random room password → encrypts access credentials with it
 * 2. Room NFT stores encrypted access data on-chain
 * 3. Viewer pays via stealth → derives same password from shared secret
 * 4. Viewer decrypts access data with password → can enter room
 * 
 * Access credentials (plaintext):
 * - Room connection URL / signaling server
 * - Room ID / session token
 * - Any other credentials needed to join (WebRTC, chat, etc.)
 * 
 * For hackathon: Simple AES-GCM encryption with password derived from stealth shared secret
 */

/**
 * Derive encryption password from stealth shared secret
 * Both host and viewer can derive the same password from the shared secret
 */
export async function deriveRoomPassword(sharedSecret: Uint8Array): Promise<CryptoKey> {
  // Use HKDF to derive a key from the shared secret
  const baseKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret as BufferSource,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('stellarcast-room-access'),
      info: new TextEncoder().encode('v1'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface RoomAccessCredentials {
  roomId: string;
  signalingUrl?: string;
  sessionToken?: string;
  hostPublicKey?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Encrypt room access credentials
 * Called by host when creating room
 */
export async function encryptRoomAccess(
  credentials: RoomAccessCredentials,
  password: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(credentials));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    password,
    plaintext
  );

  return {
    encrypted: Buffer.from(encrypted).toString('hex'),
    iv: Buffer.from(iv).toString('hex'),
  };
}

/**
 * Decrypt room access credentials
 * Called by viewer after payment
 */
export async function decryptRoomAccess(
  encryptedHex: string,
  ivHex: string,
  password: CryptoKey
): Promise<RoomAccessCredentials | null> {
  try {
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      password,
      encrypted
    );

    const json = new TextDecoder().decode(decrypted);
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to decrypt room access:', error);
    return null;
  }
}

/**
 * Generate random room credentials for hackathon demo
 * PRODUCTION: Replace with real signaling server URLs, WebRTC config, etc.
 */
export function generateDemoRoomCredentials(roomTitle: string, hostEns: string): RoomAccessCredentials {
  const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  return {
    roomId,
    signalingUrl: `wss://stellarcast-signal.example.com/${roomId}`,
    sessionToken: crypto.randomUUID(),
    hostPublicKey: '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
    metadata: {
      title: roomTitle,
      host: hostEns,
      createdAt: Date.now(),
    },
  };
}

/**
 * Combine encrypted data and IV into single hex string for Solidity bytes storage
 * Format: 0x<iv_hex><encrypted_hex> (continuous hex, NO colon separator)
 * 
 * CRITICAL: Solidity bytes parameter requires valid continuous hex.
 * DO NOT use colon-separated format like "iv:encrypted" - that breaks ABI encoding!
 */
export function packageEncryptedData(encrypted: string, iv: string): string {
  // Concatenate as continuous hex: iv || ciphertext
  return `0x${iv}${encrypted}`;
}

/**
 * Unpack encrypted data from Solidity bytes storage format
 * Format: 0x<iv_hex><encrypted_hex>
 * IV is always 12 bytes (24 hex chars) for AES-GCM
 */
export function unpackEncryptedData(packed: string): { encrypted: string; iv: string } | null {
  try {
    // Remove 0x prefix if present
    const hex = packed.startsWith('0x') ? packed.slice(2) : packed;
    
    // Validate minimum length: 12 bytes IV + at least 1 byte ciphertext = 26 hex chars
    if (hex.length < 26) {
      return null;
    }
    
    // Extract IV (first 12 bytes = 24 hex chars)
    const iv = hex.slice(0, 24);
    const encrypted = hex.slice(24);
    
    return { iv, encrypted };
  } catch {
    return null;
  }
}
