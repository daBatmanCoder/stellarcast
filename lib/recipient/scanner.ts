/**
 * Recipient announcement scanner
 * Scans ERC-5564 announcements, filters by view tag, verifies ECDH
 */

import { StealthIdentity } from '../types/stealth';
import { checkStealthAddress } from '../crypto/stealth';
import { deriveAccessCredential } from '../crypto/credentials';
import { getProtocolAdapter } from '../protocol/adapters';

export interface ScannedAnnouncement {
  schemeId: bigint;
  stealthAddress: string;
  ephemeralPublicKey: string;
  metadata: string;
  viewTag: number;
  txHash: string;
  timestamp: number;
  matched: boolean;
  sharedSecret?: Uint8Array;
  accessCredential?: string;
}

export interface ScanProgress {
  status: 'idle' | 'scanning' | 'checking' | 'complete' | 'error';
  message: string;
  scannedCount: number;
  matchedCount: number;
  currentBlock?: number;
}

/**
 * Scan announcements for recipient identity
 * Returns only matched announcements (where viewing key works)
 */
export async function scanAnnouncementsForRecipient(
  identity: StealthIdentity,
  fromBlock: number = 0,
  onProgress?: (progress: ScanProgress) => void
): Promise<ScannedAnnouncement[]> {
  const adapter = getProtocolAdapter();
  const matched: ScannedAnnouncement[] = [];

  try {
    onProgress?.({
      status: 'scanning',
      message: 'Scanning blockchain for announcements...',
      scannedCount: 0,
      matchedCount: 0,
    });

    const announcements = await adapter.scanAnnouncements(fromBlock);

    onProgress?.({
      status: 'checking',
      message: `Checking ${announcements.length} announcements...`,
      scannedCount: announcements.length,
      matchedCount: 0,
    });

    for (let i = 0; i < announcements.length; i++) {
      const announcement = announcements[i];

      try {
        // Parse ephemeral public key and stealth address
        const ephemeralPubKey = hexToBytes(announcement.ephemeralPublicKey);
        const stealthAddr = hexToBytes(announcement.stealthAddress);

        // Check if announcement is for this identity using view tag + ECDH
        const sharedSecret = checkStealthAddress(
          identity,
          ephemeralPubKey,
          stealthAddr,
          announcement.viewTag
        );

        if (sharedSecret) {
          // Match found! Derive access credential
          const accessCredential = deriveAccessCredential(sharedSecret);

          matched.push({
            schemeId: announcement.schemeId,
            stealthAddress: announcement.stealthAddress,
            ephemeralPublicKey: announcement.ephemeralPublicKey,
            metadata: announcement.metadata,
            viewTag: announcement.viewTag,
            txHash: announcement.txHash,
            timestamp: announcement.timestamp,
            matched: true,
            sharedSecret,
            accessCredential,
          });

          onProgress?.({
            status: 'checking',
            message: `Found ${matched.length} matched announcement(s)...`,
            scannedCount: i + 1,
            matchedCount: matched.length,
          });
        }
      } catch (error) {
        console.warn('Error checking announcement:', error);
        // Continue with next announcement
      }
    }

    onProgress?.({
      status: 'complete',
      message: `Scan complete. Found ${matched.length} matched announcement(s).`,
      scannedCount: announcements.length,
      matchedCount: matched.length,
    });

    return matched;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Scan failed';
    onProgress?.({
      status: 'error',
      message: errorMessage,
      scannedCount: 0,
      matchedCount: 0,
    });
    throw error;
  }
}

/**
 * Check single announcement against recipient identity
 * Returns null if viewing key doesn't match (wrong recipient)
 */
export function checkSingleAnnouncement(
  identity: StealthIdentity,
  ephemeralPublicKeyHex: string,
  stealthAddressHex: string,
  viewTag: number
): {
  matched: boolean;
  sharedSecret?: Uint8Array;
  accessCredential?: string;
  error?: string;
} {
  try {
    const ephemeralPubKey = hexToBytes(ephemeralPublicKeyHex);
    const stealthAddr = hexToBytes(stealthAddressHex);

    const sharedSecret = checkStealthAddress(
      identity,
      ephemeralPubKey,
      stealthAddr,
      viewTag
    );

    if (!sharedSecret) {
      return {
        matched: false,
        error: 'Viewing key does not match. This announcement is not for you.',
      };
    }

    const accessCredential = deriveAccessCredential(sharedSecret);

    return {
      matched: true,
      sharedSecret,
      accessCredential,
    };
  } catch (error) {
    return {
      matched: false,
      error: error instanceof Error ? error.message : 'Check failed',
    };
  }
}

/**
 * Filter announcements by view tag (pre-filter before expensive ECDH)
 */
export function filterByViewTag(
  announcements: Array<{ viewTag: number }>,
  targetViewTag: number
): Array<{ viewTag: number }> {
  return announcements.filter(a => a.viewTag === targetViewTag);
}

/**
 * Convert hex string to bytes (handles 0x prefix)
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}
