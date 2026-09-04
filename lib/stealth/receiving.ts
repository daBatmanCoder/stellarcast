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
  identity: StealthIdentity
): Promise<{ txHash: string; metaEncoded: string }> {
  const meta = identityToMetaAddress(identity);
  const metaEncoded = encodeMetaAddress(meta);
  const adapter = getProtocolAdapter();
  const txHash = await adapter.registerStealthMetaAddress(walletAddress, meta);
  return { txHash, metaEncoded };
}
