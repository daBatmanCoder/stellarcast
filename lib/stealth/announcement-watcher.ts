/**
 * ERC-5564 announcement watcher for live rooms
 * Scans announcements and matches them to host's stealth addresses
 */

import { StealthIdentity, Announcement } from '../types/stealth';
import { checkStealthAddress } from '../crypto/stealth';
import { getProtocolAdapter } from '../protocol/adapters';

export interface MatchedPayment {
  announcement: Announcement;
  sharedSecret: Uint8Array;
  stealthAddress: string;
  payerEphemeralKey: string;
  timestamp: number;
}

export interface ScannerState {
  isScanning: boolean;
  lastScannedBlock: number;
  matchedPayments: MatchedPayment[];
  error: string | null;
}

/**
 * Scan announcements for payments to host's stealth addresses
 * Returns matched payments that the host can claim
 */
export async function scanForHostPayments(
  hostIdentity: StealthIdentity,
  fromBlock: number = 0,
  onProgress?: (scanned: number, matched: number) => void
): Promise<MatchedPayment[]> {
  const adapter = getProtocolAdapter();
  const matched: MatchedPayment[] = [];

  try {
    // Get all announcements from the ERC-5564 contract
    const announcements = await adapter.scanAnnouncements(fromBlock);
    
    if (!announcements || announcements.length === 0) {
      return matched;
    }

    // Check each announcement to see if it's for this host
    for (let i = 0; i < announcements.length; i++) {
      const announcement = announcements[i];
      
      try {
        // Parse ephemeral public key and stealth address
        const ephemeralPubKey = hexToBytes(announcement.ephemeralPublicKey);
        const stealthAddr = hexToBytes(announcement.stealthAddress);

        // Check if this announcement is for the host using ECDH
        const sharedSecret = checkStealthAddress(
          hostIdentity,
          ephemeralPubKey,
          stealthAddr,
          announcement.viewTag
        );

        if (sharedSecret) {
          // Match found! This payment is for the host
          matched.push({
            announcement,
            sharedSecret,
            stealthAddress: announcement.stealthAddress,
            payerEphemeralKey: announcement.ephemeralPublicKey,
            timestamp: announcement.timestamp,
          });

          onProgress?.(i + 1, matched.length);
        }
      } catch (error) {
        console.warn('Error checking announcement:', error);
        // Continue with next announcement
      }
    }

    return matched;
  } catch (error) {
    console.error('Failed to scan announcements:', error);
    throw error;
  }
}

/**
 * Poll for new announcements at regular intervals
 */
export class AnnouncementWatcher {
  private hostIdentity: StealthIdentity;
  private intervalMs: number;
  private intervalId: NodeJS.Timeout | null = null;
  private lastBlock: number = 0;
  private listeners: Array<(payments: MatchedPayment[]) => void> = [];
  private isRunning: boolean = false;

  constructor(hostIdentity: StealthIdentity, intervalMs: number = 30000) {
    this.hostIdentity = hostIdentity;
    this.intervalMs = intervalMs;
  }

  /**
   * Start watching for announcements
   */
  start(fromBlock: number = 0): void {
    if (this.isRunning) {
      console.warn('Announcement watcher already running');
      return;
    }

    this.lastBlock = fromBlock;
    this.isRunning = true;

    // Initial scan
    this.scan();

    // Set up periodic scanning
    this.intervalId = setInterval(() => {
      this.scan();
    }, this.intervalMs);

    console.log(`Announcement watcher started (scanning every ${this.intervalMs}ms from block ${fromBlock})`);
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Announcement watcher stopped');
  }

  /**
   * Add listener for matched payments
   */
  onMatch(callback: (payments: MatchedPayment[]) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove listener
   */
  offMatch(callback: (payments: MatchedPayment[]) => void): void {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  /**
   * Perform a scan
   */
  private async scan(): Promise<void> {
    try {
      const matched = await scanForHostPayments(
        this.hostIdentity,
        this.lastBlock,
        (scanned, matchedCount) => {
          console.log(`Scanned ${scanned} announcements, found ${matchedCount} matches`);
        }
      );

      if (matched.length > 0) {
        console.log(`Found ${matched.length} new payment(s) for host`);
        
        // Notify all listeners
        this.listeners.forEach(listener => {
          try {
            listener(matched);
          } catch (error) {
            console.error('Listener error:', error);
          }
        });
      }

      // Update last block to current block (avoid re-scanning)
      // In production, you'd get the current block number from the chain
      // For now, we'll just increment to avoid infinite rescanning
      this.lastBlock += 100;
    } catch (error) {
      console.error('Scan failed:', error);
    }
  }
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
