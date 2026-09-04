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
    sharedSecret,
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
 * Combine encrypted data and IV into single hex string for storage
 * Format: <iv_hex>:<encrypted_hex>
 */
export function packageEncryptedData(encrypted: string, iv: string): string {
  return `${iv}:${encrypted}`;
}

/**
 * Unpack encrypted data from storage format
 */
export function unpackEncryptedData(packed: string): { encrypted: string; iv: string } | null {
  const parts = packed.split(':');
  if (parts.length !== 2) return null;
  return { iv: parts[0], encrypted: parts[1] };
}
