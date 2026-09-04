/**
 * Receiving / stealth payment readiness helpers
 */

import type { StealthIdentity, StealthMetaAddress } from '@/lib/types/stealth';
import { identityToMetaAddress, encodeMetaAddress } from '@/lib/crypto/identity';
import { publicKeysMatch } from '@/lib/blockchain/contracts';
import { getProtocolAdapter } from '@/lib/protocol/adapters';

export type ReceivingStatus =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'needs-setup'
  | 'keys-mismatch'
  | 'error';

export interface ReceivingState {
  status: ReceivingStatus;
  localMetaEncoded: string;
  onChainMeta: StealthMetaAddress | null;
  message?: string;
}

export async function checkReceivingStatus(
  walletAddress: string,
  identity: StealthIdentity
): Promise<ReceivingState> {
  const localMeta = identityToMetaAddress(identity);
  const localMetaEncoded = encodeMetaAddress(localMeta);

  try {
    const adapter = getProtocolAdapter();
    const onChainMeta = await adapter.getMetaAddress(walletAddress);

    if (!onChainMeta) {
      return {
        status: 'needs-setup',
        localMetaEncoded,
        onChainMeta: null,
        message: 'No stealth meta-address is registered for this wallet yet.',
      };
    }

    if (!publicKeysMatch(localMeta, onChainMeta)) {
      return {
        status: 'keys-mismatch',
        localMetaEncoded,
        onChainMeta,
        message:
          'This wallet has an on-chain stealth meta-address, but this browser’s local keys do not match. Register a new meta-address to accept payments here.',
      };
    }

    return {
      status: 'ready',
      localMetaEncoded,
      onChainMeta,
      message: 'Receiving ready — viewers can pay your stealth meta-address.',
    };
  } catch (error) {
    return {
      status: 'error',
      localMetaEncoded,
      onChainMeta: null,
      message: error instanceof Error ? error.message : 'Failed to check stealth registration',
    };
  }
}

export async function registerReceivingMetaAddress(
  walletAddress: string,
  identity: StealthIdentity,
  options?: { ensName?: string; targetSlot?: number }
): Promise<{ txHash: string; metaEncoded: string; slot?: number }> {
  const meta = identityToMetaAddress(identity);
  const metaEncoded = encodeMetaAddress(meta);
  
  // If ENS name is provided, write to ENS text record (primary method)
  if (options?.ensName) {
    const { reverseResolveSepoliaENS, getNextStealthMetaSlot } = await import('@/lib/ens/resolver');
    const { setSepoliaTextRecord } = await import('@/lib/ens/text-writer');
    const { encodeStealthMetaAddressForENS } = await import('@/lib/blockchain/contracts');
    
    // Verify ownership
    const resolvedAddress = await reverseResolveSepoliaENS(walletAddress);
    if (!resolvedAddress || resolvedAddress.toLowerCase() !== options.ensName.toLowerCase()) {
      console.warn('ENS name does not match wallet address, falling back to registry');
    } else {
      // Determine slot
      const slot = options.targetSlot || (await getNextStealthMetaSlot(options.ensName));
      const key = `stealth-meta-address[${slot}]`;
      const value = encodeStealthMetaAddressForENS(meta);
      
      try {
        const txHash = await setSepoliaTextRecord(options.ensName, key, value, walletAddress);
        console.log(`Wrote stealth meta to ENS ${options.ensName} slot [${slot}]`);
        return { txHash, metaEncoded, slot };
      } catch (error) {
        console.error('ENS text record write failed:', error);
        throw error;
      }
    }
  }
  
  // Fall back to ERC-6538 registry
  const adapter = getProtocolAdapter();
  const txHash = await adapter.registerStealthMetaAddress(walletAddress, meta);
  return { txHash, metaEncoded };
}
