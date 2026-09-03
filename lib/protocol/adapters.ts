/**
 * Protocol adapters for ENS, ERC-6538, and ERC-5564
 * Mock mode for UI testing without deployed contracts
 */

import { Announcement, StealthMetaAddress } from '../types/stealth';

export interface ProtocolAdapter {
  mode: 'mock' | 'live';
  resolveENS(name: string): Promise<string | null>;
  getMetaAddress(address: string): Promise<StealthMetaAddress | null>;
  publishAnnouncement(
    schemeId: bigint,
    stealthAddress: string,
    ephemeralPublicKey: string,
    metadata: string,
    viewTag: number
  ): Promise<string>;
  scanAnnouncements(fromBlock?: number): Promise<Announcement[]>;
}

/**
 * Mock adapter for demo mode
 */
export class MockProtocolAdapter implements ProtocolAdapter {
  mode: 'mock' = 'mock';
  private announcements: Announcement[] = [];
  private mockRegistry = new Map<string, StealthMetaAddress>();

  async resolveENS(name: string): Promise<string | null> {
    if (name === 'alice.eth') {
      return '0x1111111111111111111111111111111111111111';
    }
    if (name === 'bob.eth') {
      return '0x2222222222222222222222222222222222222222';
    }
    return null;
  }

  async getMetaAddress(address: string): Promise<StealthMetaAddress | null> {
    return this.mockRegistry.get(address.toLowerCase()) || null;
  }

  registerMetaAddress(address: string, meta: StealthMetaAddress): void {
    this.mockRegistry.set(address.toLowerCase(), meta);
  }

  async publishAnnouncement(
    schemeId: bigint,
    stealthAddress: string,
    ephemeralPublicKey: string,
    metadata: string,
    viewTag: number
  ): Promise<string> {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const txHash = '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const announcement: Announcement = {
      schemeId,
      stealthAddress,
      ephemeralPublicKey,
      metadata,
      viewTag,
      txHash,
      timestamp: Date.now(),
    };
    this.announcements.push(announcement);
    return announcement.txHash;
  }

  async scanAnnouncements(fromBlock?: number): Promise<Announcement[]> {
    const cutoff = fromBlock ? fromBlock : 0;
    return this.announcements.filter((a) => a.timestamp >= cutoff);
  }

  clearAnnouncements(): void {
    this.announcements = [];
  }
}

/**
 * Live adapter for actual blockchain (placeholder for viem integration)
 */
export class LiveProtocolAdapter implements ProtocolAdapter {
  mode: 'live' = 'live';

  constructor(
    private chainId: number,
    private registryAddress?: string,
    private announcerAddress?: string
  ) {}

  async resolveENS(name: string): Promise<string | null> {
    throw new Error('Live ENS resolution not implemented in prototype');
  }

  async getMetaAddress(address: string): Promise<StealthMetaAddress | null> {
    throw new Error('Live ERC-6538 registry read not implemented in prototype');
  }

  async publishAnnouncement(): Promise<string> {
    throw new Error('Live ERC-5564 announcement not implemented in prototype');
  }

  async scanAnnouncements(): Promise<Announcement[]> {
    throw new Error('Live announcement scanning not implemented in prototype');
  }
}

let activeAdapter: ProtocolAdapter = new MockProtocolAdapter();

export function getProtocolAdapter(): ProtocolAdapter {
  return activeAdapter;
}

export function setProtocolAdapter(adapter: ProtocolAdapter): void {
  activeAdapter = adapter;
}
