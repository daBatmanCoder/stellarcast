/**
 * Sepolia ENS Resolver
 * Resolves ENS names on Sepolia testnet (chain ID 11155111) using viem
 */

import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

// Create a public client for Sepolia ENS resolution
const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http()
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
 * Display name: ENS name if available, otherwise truncated address
 */
export function displayName(address: string, ensName?: string | null): string {
  if (ensName && ensName.endsWith('.eth')) {
    return ensName;
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
  private cache = new Map<string, string | null>();
  private pending = new Map<string, Promise<string | null>>();

  async resolve(address: string): Promise<string | null> {
    // Check cache first
    if (this.cache.has(address)) {
      return this.cache.get(address) || null;
    }

    // Check if resolution is pending
    if (this.pending.has(address)) {
      return this.pending.get(address)!;
    }

    // Start new resolution
    const promise = reverseResolveSepoliaENS(address);
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
