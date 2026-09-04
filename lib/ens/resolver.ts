/**
 * Sepolia + Mainnet ENS Resolver
 * Resolves ENS names on both Sepolia testnet and mainnet using viem
 */

import { createPublicClient, http } from 'viem';
import { sepolia, mainnet } from 'viem/chains';

// Create public clients with reliable RPCs
const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum-rpc.publicnode.com')
});

/**
 * Normalize ENS name (lowercase, ensure .eth)
 */
function normalizeEnsName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (!lower.endsWith('.eth')) {
    return `${lower}.eth`;
  }
  return lower;
}

/**
 * Resolve ENS name to Ethereum address on Sepolia
 */
export async function resolveSepoliaENS(name: string): Promise<string | null> {
  if (!name || !name.includes('.eth')) {
    return null;
  }

  try {
    const normalized = normalizeEnsName(name);
    
    // Use viem's built-in ENS resolution for Sepolia
    const address = await sepoliaClient.getEnsAddress({
      name: normalized
    });

    return address || null;
  } catch (error) {
    console.error('Failed to resolve Sepolia ENS:', error);
    return null;
  }
}

/**
 * Resolve ENS name to Ethereum address on mainnet
 */
export async function resolveMainnetENS(name: string): Promise<string | null> {
  if (!name || !name.includes('.eth')) {
    return null;
  }

  try {
    const normalized = normalizeEnsName(name);
    
    // Use viem's built-in ENS resolution for mainnet
    const address = await mainnetClient.getEnsAddress({
      name: normalized
    });

    return address || null;
  } catch (error) {
    console.error('Failed to resolve mainnet ENS:', error);
    return null;
  }
}

/**
 * Reverse resolve: given an address, find its primary ENS name on Sepolia
 */
export async function reverseResolveSepoliaENS(address: string): Promise<string | null> {
  if (!address || !address.startsWith('0x')) {
    return null;
  }

  try {
    // Use viem's built-in reverse ENS resolution for Sepolia
    const ensName = await sepoliaClient.getEnsName({
      address: address as `0x${string}`
    });

    return ensName || null;
  } catch (error) {
    console.error('Failed to reverse resolve Sepolia ENS:', error);
    return null;
  }
}

/**
 * Reverse resolve: given an address, find its primary ENS name on mainnet
 */
export async function reverseResolveMainnetENS(address: string): Promise<string | null> {
  if (!address || !address.startsWith('0x')) {
    return null;
  }

  try {
    // Use viem's built-in reverse ENS resolution for mainnet
    const ensName = await mainnetClient.getEnsName({
      address: address as `0x${string}`
    });

    return ensName || null;
  } catch (error) {
    console.error('Failed to reverse resolve mainnet ENS:', error);
    return null;
  }
}

/**
 * ENS resolution result with network source
 */
export interface ENSResult {
  name: string;
  network: 'sepolia' | 'mainnet';
}

/**
 * Resolve ENS for an address, checking Sepolia first, then mainnet
 * Returns the ENS name and which network it's from
 */
export async function resolveENSWithNetwork(address: string): Promise<ENSResult | null> {
  if (!address || !address.startsWith('0x')) {
    return null;
  }

  // Try Sepolia first (preferred for product)
  const sepoliaName = await reverseResolveSepoliaENS(address);
  if (sepoliaName) {
    return { name: sepoliaName, network: 'sepolia' };
  }

  // Fallback to mainnet
  const mainnetName = await reverseResolveMainnetENS(address);
  if (mainnetName) {
    return { name: mainnetName, network: 'mainnet' };
  }

  return null;
}

/**
 * Forward resolve ENS name, checking if it matches the connected address
 * Checks both Sepolia and mainnet
 */
export async function forwardResolveENSWithNetwork(
  name: string,
  connectedAddress?: string
): Promise<{ address: string; network: 'sepolia' | 'mainnet' } | null> {
  if (!name || !name.includes('.eth')) {
    return null;
  }

  // Try Sepolia first
  const sepoliaAddress = await resolveSepoliaENS(name);
  if (sepoliaAddress) {
    return { address: sepoliaAddress, network: 'sepolia' };
  }

  // Fallback to mainnet
  const mainnetAddress = await resolveMainnetENS(name);
  if (mainnetAddress) {
    return { address: mainnetAddress, network: 'mainnet' };
  }

  return null;
}

/**
 * Display name: ENS name if available, otherwise truncated address
 */
export function displayName(address: string, ensResult?: ENSResult | null): string {
  if (ensResult && ensResult.name.endsWith('.eth')) {
    return ensResult.name;
  }
  if (!address || !address.startsWith('0x')) {
    return 'Unknown';
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Hook to resolve and cache ENS names for addresses
 */
export class ENSCache {
  private cache = new Map<string, ENSResult | null>();
  private pending = new Map<string, Promise<ENSResult | null>>();

  async resolve(address: string): Promise<ENSResult | null> {
    // Check cache first
    if (this.cache.has(address)) {
      return this.cache.get(address) || null;
    }

    // Check if resolution is pending
    if (this.pending.has(address)) {
      return this.pending.get(address)!;
    }

    // Start new resolution
    const promise = resolveENSWithNetwork(address);
    this.pending.set(address, promise);

    try {
      const result = await promise;
      this.cache.set(address, result);
      this.pending.delete(address);
      return result;
    } catch (error) {
      this.pending.delete(address);
      return null;
    }
  }

  getDisplayName(address: string): string {
    const cached = this.cache.get(address);
    return displayName(address, cached);
  }
}

// Global ENS cache instance
export const ensCache = new ENSCache();

/**
 * Read ENS text record on Sepolia
 */
export async function getSepoliaTextRecord(name: string, key: string): Promise<string | null> {
  if (!name || !name.includes('.eth')) {
    return null;
  }

  try {
    const normalized = normalizeEnsName(name);
    
    // Use viem's built-in ENS text record resolution for Sepolia
    const textRecord = await sepoliaClient.getEnsText({
      name: normalized,
      key: key
    });

    return textRecord || null;
  } catch (error) {
    console.error(`Failed to read Sepolia ENS text record ${key}:`, error);
    return null;
  }
}

/**
 * Read ENS text record on mainnet
 */
export async function getMainnetTextRecord(name: string, key: string): Promise<string | null> {
  if (!name || !name.includes('.eth')) {
    return null;
  }

  try {
    const normalized = normalizeEnsName(name);
    
    // Use viem's built-in ENS text record resolution for mainnet
    const textRecord = await mainnetClient.getEnsText({
      name: normalized,
      key: key
    });

    return textRecord || null;
  } catch (error) {
    console.error(`Failed to read mainnet ENS text record ${key}:`, error);
    return null;
  }
}

/**
 * Find all stealth-meta-address slots for an ENS name on Sepolia
 * Returns array of { slot: number, value: string } for each occupied slot
 */
export async function getStealthMetaSlots(ensName: string): Promise<Array<{ slot: number; value: string }>> {
  const slots: Array<{ slot: number; value: string }> = [];
  
  // Check slots 1-10 (reasonable limit)
  for (let i = 1; i <= 10; i++) {
    const key = `stealth-meta-address[${i}]`;
    const value = await getSepoliaTextRecord(ensName, key);
    if (value) {
      slots.push({ slot: i, value });
    } else {
      // Stop at first empty slot for efficiency
      break;
    }
  }
  
  return slots;
}

/**
 * Find the next available stealth-meta-address slot for an ENS name
 * Returns slot number (1 if none exist, otherwise next free slot)
 */
export async function getNextStealthMetaSlot(ensName: string): Promise<number> {
  const slots = await getStealthMetaSlots(ensName);
  if (slots.length === 0) {
    return 1;
  }
  return slots[slots.length - 1].slot + 1;
}
