/**
 * Receiving / stealth payment readiness helpers
 * Source of truth: ENS text stealth-meta-address[1], not the ERC-6538 registry.
 */

import type { StealthIdentity, StealthMetaAddress } from '@/lib/types/stealth';
import {
  identityToMetaAddress,
  encodeMetaAddress,
  identityMatchesMeta,
  tryDecodeMetaAddress,
} from '@/lib/crypto/identity';
import { parseStealthMetaAddressFromENS } from '@/lib/blockchain/contracts';

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
  ensName?: string;
  message?: string;
}

export async function readEnsStealthMetaAddress(
  ensName: string
): Promise<{ encoded: string; meta: StealthMetaAddress } | null> {
  const { getSepoliaTextRecord } = await import('@/lib/ens/resolver');
  const text = await getSepoliaTextRecord(ensName, 'stealth-meta-address[1]');
  if (!text) return null;
  const meta = parseStealthMetaAddressFromENS(text);
  if (!meta) return null;
  return { encoded: text, meta };
}

export async function resolveHostStealthMetaAddress(options: {
  ensName?: string | null;
  encodedMeta?: string | null;
}): Promise<StealthMetaAddress | null> {
  if (options.ensName) {
    const fromEns = await readEnsStealthMetaAddress(options.ensName);
    if (fromEns) return fromEns.meta;
  }
  if (options.encodedMeta) {
    return tryDecodeMetaAddress(options.encodedMeta);
  }
  return null;
}

export async function checkReceivingStatus(
  walletAddress: string,
  identity: StealthIdentity,
  ensName?: string
): Promise<ReceivingState> {
  const localMeta = identityToMetaAddress(identity);
  const localMetaEncoded = encodeMetaAddress(localMeta);

  try {
    let resolvedEns = ensName;
    if (!resolvedEns) {
      const { reverseResolveSepoliaENS } = await import('@/lib/ens/resolver');
      resolvedEns = (await reverseResolveSepoliaENS(walletAddress)) || undefined;
    }

    if (!resolvedEns) {
      return {
        status: 'needs-setup',
        localMetaEncoded,
        onChainMeta: null,
        message: 'Verify your ENS name in Go Live, then publish stealth-meta-address[1].',
      };
    }

    const recorded = await readEnsStealthMetaAddress(resolvedEns);
    if (!recorded) {
      return {
        status: 'needs-setup',
        localMetaEncoded,
        onChainMeta: null,
        ensName: resolvedEns,
        message: `No stealth-meta-address[1] on ${resolvedEns} yet.`,
      };
    }

    if (!identityMatchesMeta(identity, recorded.meta)) {
      return {
        status: 'keys-mismatch',
        localMetaEncoded,
        onChainMeta: recorded.meta,
        ensName: resolvedEns,
        message:
          `${resolvedEns} already has stealth-meta-address[1], but this browser’s keys do not match. Import the matching private keys or you cannot scan payments.`,
      };
    }

    return {
      status: 'ready',
      localMetaEncoded,
      onChainMeta: recorded.meta,
      ensName: resolvedEns,
      message: 'Receiving ready — viewers can pay your ENS stealth meta-address.',
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

  if (!options?.ensName) {
    throw new Error('Verify an ENS name before publishing stealth keys. Do not use the ERC-6538 registry.');
  }

  const { resolveSepoliaENS } = await import('@/lib/ens/resolver');
  const { setSepoliaTextRecord } = await import('@/lib/ens/text-writer');
  const { encodeStealthMetaAddressForENS } = await import('@/lib/blockchain/contracts');
  const { waitForTransactionReceipt } = await import('@/lib/blockchain/transactions');

  const resolvedAddress = await resolveSepoliaENS(options.ensName);
  if (!resolvedAddress || resolvedAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error(`${options.ensName} does not resolve to this wallet on Sepolia`);
  }

  const slot = options.targetSlot ?? 1;
  const key = `stealth-meta-address[${slot}]`;
  const value = encodeStealthMetaAddressForENS(meta);
  const txHash = await setSepoliaTextRecord(options.ensName, key, value, walletAddress);
  await waitForTransactionReceipt(txHash);
  return { txHash, metaEncoded, slot };
}
