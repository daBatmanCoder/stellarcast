/**
 * ERC-5564 announcement watcher for live rooms
 * Scans announcements and matches them to host's stealth addresses
 */

import { StealthIdentity, Announcement } from '../types/stealth';
import { checkStealthAddress } from '../crypto/stealth';
import { getProtocolAdapter } from '../protocol/adapters';
import { getBlockNumber } from '../blockchain/transactions';

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

function sameAddress(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

export interface ScanHostPaymentsOptions {
  excludeCaller?: string;
  seenTxHashes?: Set<string>;
  onProgress?: (scanned: number, matched: number) => void;
}

/**
 * Scan announcements for payments to host's stealth addresses
 * Returns matched payments that the host can claim
 */
export async function scanForHostPayments(
  hostIdentity: StealthIdentity,
  fromBlock: number,
  options?: ScanHostPaymentsOptions
): Promise<MatchedPayment[]> {
  const adapter = getProtocolAdapter();
  const matched: MatchedPayment[] = [];
  const excludeCaller = options?.excludeCaller;
  const seenTxHashes = options?.seenTxHashes;

  try {
    const announcements = await adapter.scanAnnouncements(fromBlock);

    if (!announcements || announcements.length === 0) {
      return matched;
    }

    for (let i = 0; i < announcements.length; i++) {
      const announcement = announcements[i];

      try {
        if (
          announcement.blockNumber > 0 &&
          Number.isFinite(fromBlock) &&
          announcement.blockNumber < fromBlock
        ) {
          continue;
        }

        if (seenTxHashes?.has(announcement.txHash)) {
          continue;
        }

        if (excludeCaller && sameAddress(announcement.caller, excludeCaller)) {
          continue;
        }

        const ephemeralPubKey = hexToBytes(announcement.ephemeralPublicKey);
        const stealthAddr = hexToBytes(announcement.stealthAddress);

        const sharedSecret = checkStealthAddress(
          hostIdentity,
          ephemeralPubKey,
          stealthAddr,
          announcement.viewTag
        );

        if (sharedSecret) {
          matched.push({
            announcement,
            sharedSecret,
            stealthAddress: announcement.stealthAddress,
            payerEphemeralKey: announcement.ephemeralPublicKey,
            timestamp: announcement.timestamp,
          });

          options?.onProgress?.(i + 1, matched.length);
        }
      } catch (error) {
        console.warn('Error checking announcement:', error);
      }
    }

    return matched;
  } catch (error) {
    console.error('Failed to scan announcements:', error);
    throw error;
  }
}

export interface AnnouncementWatcherOptions {
  excludeCaller?: string;
}

/**
 * Poll for new announcements at regular intervals
 */
export class AnnouncementWatcher {
  private hostIdentity: StealthIdentity;
  private intervalMs: number;
  private excludeCaller?: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastBlock: number = 0;
  private seenTxHashes = new Set<string>();
  private listeners: Array<(payments: MatchedPayment[]) => void> = [];
  private isRunning: boolean = false;

  constructor(
    hostIdentity: StealthIdentity,
    intervalMs: number = 30000,
    options?: AnnouncementWatcherOptions
  ) {
    this.hostIdentity = hostIdentity;
    this.intervalMs = intervalMs;
    this.excludeCaller = options?.excludeCaller;
  }

  start(fromBlock: number): void {
    if (this.isRunning) {
      console.warn('Announcement watcher already running');
      return;
    }

    if (!Number.isFinite(fromBlock)) {
      throw new Error('Announcement watcher requires a concrete fromBlock');
    }

    this.lastBlock = fromBlock;
    this.isRunning = true;
    this.scan();
    this.intervalId = setInterval(() => {
      this.scan();
    }, this.intervalMs);

    console.log(`Announcement watcher started (scanning every ${this.intervalMs}ms from block ${fromBlock})`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Announcement watcher stopped');
  }

  onMatch(callback: (payments: MatchedPayment[]) => void): void {
    this.listeners.push(callback);
  }

  offMatch(callback: (payments: MatchedPayment[]) => void): void {
    this.listeners = this.listeners.filter((cb) => cb !== callback);
  }

  getLastBlock(): number {
    return this.lastBlock;
  }

  private async scan(): Promise<void> {
    try {
      const matched = await scanForHostPayments(this.hostIdentity, this.lastBlock, {
        excludeCaller: this.excludeCaller,
        seenTxHashes: this.seenTxHashes,
        onProgress: (scanned, matchedCount) => {
          console.log(`Scanned ${scanned} announcements, found ${matchedCount} matches`);
        },
      });

      const fresh = matched.filter((payment) => {
        const hash = payment.announcement.txHash;
        if (this.seenTxHashes.has(hash)) return false;
        this.seenTxHashes.add(hash);
        return true;
      });

      if (fresh.length > 0) {
        console.log(`Found ${fresh.length} new payment(s) for host`);
        this.listeners.forEach((listener) => {
          try {
            listener(fresh);
          } catch (error) {
            console.error('Listener error:', error);
          }
        });
      }

      const scannedMax = matched.reduce(
        (max, payment) => Math.max(max, payment.announcement.blockNumber || 0),
        this.lastBlock
      );

      try {
        const head = await getBlockNumber();
        this.lastBlock = Math.max(scannedMax, head);
      } catch {
        this.lastBlock = scannedMax;
      }
    } catch (error) {
      console.error('Scan failed:', error);
    }
  }
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}
