/**
 * Protocol adapters for ENS, ERC-6538, and ERC-5564
 * Mock mode for UI testing without deployed contracts
 */

import { Announcement, StealthMetaAddress } from '../types/stealth';

export interface ProtocolAdapter {
  mode: 'mock' | 'live';
  resolveENS(name: string): Promise<string | null>;
  getMetaAddress(address: string): Promise<StealthMetaAddress | null>;
  registerStealthMetaAddress(from: string, meta: StealthMetaAddress): Promise<string>;
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

  /** Sync helper used by older demo code */
  registerMetaAddress(address: string, meta: StealthMetaAddress): void {
    this.mockRegistry.set(address.toLowerCase(), meta);
  }

  async registerStealthMetaAddress(from: string, meta: StealthMetaAddress): Promise<string> {
    this.mockRegistry.set(from.toLowerCase(), meta);
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return '0x' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async publishAnnouncement(
    schemeId: bigint,
    stealthAddress: string,
    ephemeralPublicKey: string,
    metadata: string,
    viewTag: number
  ): Promise<string> {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const txHash =
      '0x' + Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

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
 * Live adapter for actual blockchain
 */
export class LiveProtocolAdapter implements ProtocolAdapter {
  mode: 'live' = 'live';

  constructor(
    private chainId: number,
    private registryAddress: string,
    private announcerAddress: string
  ) {}

  async resolveENS(name: string): Promise<string | null> {
    const { resolveSepoliaENS } = await import('../ens/resolver');
    return await resolveSepoliaENS(name);
  }

  async getMetaAddress(address: string): Promise<StealthMetaAddress | null> {
    const { parseStealthMetaAddressFromENS } = await import('../blockchain/contracts');
    const { reverseResolveSepoliaENS, getSepoliaTextRecord } = await import('../ens/resolver');

    // Try ENS resolution first (primary source of truth)
    try {
      const ensName = await reverseResolveSepoliaENS(address);
      if (ensName) {
        // Check stealth-meta-address[1] first (standard key)
        const metaText = await getSepoliaTextRecord(ensName, 'stealth-meta-address[1]');
        if (metaText) {
          const parsed = parseStealthMetaAddressFromENS(metaText);
          if (parsed) {
            console.log(`Found stealth meta in ENS ${ensName} slot [1]`);
            return parsed;
          }
        }

        // Fall back to legacy key if present
        const legacyText = await getSepoliaTextRecord(ensName, 'eth.stellarcast.stealth');
        if (legacyText) {
          const parsed = parseStealthMetaAddressFromENS(legacyText);
          if (parsed) {
            console.log(`Found stealth meta in ENS ${ensName} legacy key`);
            return parsed;
          }
        }
      }
    } catch (error) {
      console.warn('ENS resolution failed, will try ERC-6538 registry:', error);
    }

    // Fall back to ERC-6538 registry as secondary option
    const { checkRegistryDeployed, readMetaAddress } = await import('../blockchain/contracts');
    const isDeployed = await checkRegistryDeployed(this.registryAddress);
    if (isDeployed) {
      try {
        return await readMetaAddress(this.registryAddress, address, BigInt(1));
      } catch (error) {
        console.warn('ERC-6538 registry read failed:', error);
      }
    }

    return null;
  }

  async registerStealthMetaAddress(from: string, meta: StealthMetaAddress): Promise<string> {
    const { checkRegistryDeployed, registerMetaAddress } = await import('../blockchain/contracts');
    const { waitForTransactionReceipt } = await import('../blockchain/transactions');

    const isDeployed = await checkRegistryDeployed(this.registryAddress);
    if (!isDeployed) {
      throw new Error(
        `ERC-6538 registry not deployed at ${this.registryAddress} on chain ${this.chainId}.`
      );
    }

    const txHash = await registerMetaAddress(this.registryAddress, from, meta, BigInt(1));
    await waitForTransactionReceipt(txHash);
    return txHash;
  }

  async publishAnnouncement(
    schemeId: bigint,
    stealthAddress: string,
    ephemeralPublicKey: string,
    metadata: string,
    _viewTag: number
  ): Promise<string> {
    const { checkAnnouncerDeployed, publishAnnouncement } = await import('../blockchain/contracts');

    const isDeployed = await checkAnnouncerDeployed(this.announcerAddress);
    if (!isDeployed) {
      throw new Error(
        `ERC-5564 announcer not deployed at ${this.announcerAddress} on chain ${this.chainId}. ` +
          'Cannot publish announcements without deployed contract. ' +
          'Use mock mode for testing without contracts.'
      );
    }

    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask not available');
    }

    const accounts = (await window.ethereum.request({
      method: 'eth_accounts',
    })) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error('No wallet connected. Please connect MetaMask.');
    }

    return await publishAnnouncement(
      this.announcerAddress,
      accounts[0],
      schemeId,
      stealthAddress,
      ephemeralPublicKey,
      metadata
    );
  }

  async scanAnnouncements(fromBlock?: number): Promise<Announcement[]> {
    const { checkAnnouncerDeployed, scanAnnouncements } = await import('../blockchain/contracts');

    const isDeployed = await checkAnnouncerDeployed(this.announcerAddress);
    if (!isDeployed) {
      throw new Error(
        `ERC-5564 announcer not deployed at ${this.announcerAddress} on chain ${this.chainId}. ` +
          'Cannot scan announcements without deployed contract.'
      );
    }

    const events = await scanAnnouncements(this.announcerAddress, fromBlock || 0);

    return events.map((event) => ({
      schemeId: BigInt(event.schemeId),
      stealthAddress: event.stealthAddress,
      ephemeralPublicKey: event.ephemeralPublicKey,
      metadata: event.metadata,
      viewTag: event.viewTag,
      txHash: event.txHash,
      timestamp: Date.now(),
    }));
  }
}

let activeAdapter: ProtocolAdapter = new MockProtocolAdapter();

export function getProtocolAdapter(): ProtocolAdapter {
  return activeAdapter;
}

export function setProtocolAdapter(adapter: ProtocolAdapter): void {
  activeAdapter = adapter;
}
